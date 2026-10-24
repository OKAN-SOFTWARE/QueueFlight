// Copyright (c) 2026 OKAN TIKTAS. MIT License.
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export interface Layer { kind: string; value: Json }
export interface Finding { code: string; evidence: string }
export interface Message {
  key: string; id: string; body: string; bytes: number; digest: string;
  attributes: Record<string, string>; messageAttributes: Record<string, Json>;
  arn: string | null; region: string | null; md5: string | null;
  layers: Layer[]; payload: Json; findings: Finding[]; duplicateCount: number;
  syntheticId: boolean;
}
export interface Capture { format: string; messages: Message[]; duplicateGroups: number; observations: number }
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_RECORDS = 500;
const encoder = new TextEncoder();
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
function object(value: unknown): value is Record<string, Json> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function dictionary(value: unknown): Record<string, string> {
  if (!object(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
}
export function unwrap(body: string): {layers: Layer[]; payload: Json; truncated: boolean} {
  let value: Json = body;
  const layers: Layer[] = [{kind: 'SQS body', value}];
  let progressed = false;
  for (let step = 0; step < 6; step++) {
    progressed = false;
    if (typeof value === 'string') {
      try { value = JSON.parse(value) as Json; layers.push({kind: 'Decoded JSON', value}); progressed = true; }
      catch { break; }
    } else if (object(value) && value.Type === 'Notification' && typeof value.Message === 'string') {
      value = value.Message; layers.push({kind: 'SNS Message', value}); progressed = true;
    } else if (object(value) && typeof value.source === 'string' && typeof value['detail-type'] === 'string' && own(value, 'detail')) {
      value = value.detail; layers.push({kind: 'EventBridge detail', value}); progressed = true;
    }
    if (!progressed) break;
  }
  const canContinue = typeof value === 'string' ? (() => {try {JSON.parse(value);return true;}catch{return false;}})() : object(value) && ((value.Type === 'Notification' && typeof value.Message === 'string') || (typeof value.source === 'string' && typeof value['detail-type'] === 'string' && own(value, 'detail')));
  return {layers, payload: value, truncated: layers.length === 7 && Boolean(canContinue)};
}
export async function analyze(input: string): Promise<Capture> {
  if (typeof input !== 'string' || encoder.encode(input).length > MAX_BYTES) throw new Error('Capture exceeds the 5 MiB limit.');
  let data: unknown;
  try { data = JSON.parse(input); } catch { throw new Error('Invalid JSON. Paste a complete SQS response or Lambda SQS event.'); }
  let rows: unknown[], format: string;
  if (object(data) && Array.isArray(data.Messages)) { rows = data.Messages; format = 'SQS ReceiveMessage'; }
  else if (object(data) && Array.isArray(data.Records)) { rows = data.Records; format = 'Lambda SQS event'; }
  else if (Array.isArray(data)) { rows = data; format = 'Message array'; }
  else if (object(data) && (own(data, 'Body') || own(data, 'body'))) { rows = [data]; format = 'Single message'; }
  else throw new Error('Expected Messages[], Records[], a message array, or a single Body/body message.');
  if (rows.length > MAX_RECORDS) throw new Error(`Capture has too many records. Limit: ${MAX_RECORDS}.`);
  const messages: Message[] = [];
  for (const [index, row] of rows.entries()) {
    if (!object(row)) throw new Error(`Record ${index + 1} must be an object.`);
    if (row.eventSource !== undefined && row.eventSource !== 'aws:sqs') throw new Error(`Record ${index + 1} is not an SQS event.`);
    const body = row.Body ?? row.body;
    if (typeof body !== 'string') throw new Error(`Record ${index + 1} needs a string Body or body. No records were imported.`);
    const attributes = dictionary(row.Attributes ?? row.attributes);
    const originalId = row.MessageId ?? row.messageId;
    const id = typeof originalId === 'string' && originalId ? originalId : `queueflight-local-${index + 1}`;
    const decoded = unwrap(body);
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(body))), byte => byte.toString(16).padStart(2, '0')).join('');
    const findings: Finding[] = [];
    if (decoded.layers.length === 1) findings.push({code: 'PLAIN_TEXT', evidence: 'Body is not JSON. Plain text is valid in SQS; this is not proof of a failure.'});
    const count = attributes.ApproximateReceiveCount;
    if (count !== undefined && /^\d+$/.test(count) && Number(count) >= 3) findings.push({code: 'RECEIVED_REPEATEDLY', evidence: `ApproximateReceiveCount=${count}. Repeated receives can have several causes; this does not establish processing failure.`});
    if (count !== undefined && !/^\d+$/.test(count)) findings.push({code: 'INVALID_RECEIVE_COUNT', evidence: 'ApproximateReceiveCount is not an unsigned integer string.'});
    const sent = attributes.SentTimestamp;
    if (sent !== undefined && (!/^\d+$/.test(sent) || !Number.isFinite(Number(sent)) || Number(sent) > 8640000000000000)) findings.push({code: 'INVALID_TIMESTAMP', evidence: 'SentTimestamp cannot be read as an epoch-millisecond timestamp.'});
    if (decoded.truncated) findings.push({code: 'UNWRAP_LIMIT', evidence: 'Stopped after six decoding steps. Remaining envelope is preserved.'});
    if (id.startsWith('queueflight-local-') && originalId !== id) findings.push({code:'SYNTHETIC_ID', evidence:'No message ID was supplied; a local fixture ID was assigned.'});
    const rawAttrs = row.MessageAttributes ?? row.messageAttributes;
    const md5 = row.MD5OfBody ?? row.md5OfBody;
    messages.push({key:`record-${index}`, id, body, bytes:encoder.encode(body).length, digest, attributes,
      messageAttributes:object(rawAttrs) ? rawAttrs : {}, arn:typeof row.eventSourceARN === 'string' ? row.eventSourceARN : null,
      region:typeof row.awsRegion === 'string' ? row.awsRegion : null, md5:typeof md5 === 'string' && /^[a-f\d]{32}$/i.test(md5) ? md5 : null,
      layers:decoded.layers, payload:decoded.payload, findings, duplicateCount:1, syntheticId:!(typeof originalId === 'string' && originalId)});
  }
  const groups = new Map<string, Message[]>();
  for (const message of messages) { const group = groups.get(message.digest) ?? []; group.push(message); groups.set(message.digest, group); }
  const idCounts = new Map<string, number>();
  for (const message of messages) idCounts.set(message.id, (idCounts.get(message.id) ?? 0) + 1);
  for (const group of groups.values()) for (const message of group) {
    message.duplicateCount = group.length;
    if (group.length > 1) message.findings.push({code:'IDENTICAL_BODY', evidence:`${group.length} imported observations have byte-identical UTF-8 bodies (SHA-256). This is not proof of duplicate delivery.`});
    if ((idCounts.get(message.id) ?? 0) > 1) message.findings.push({code:'REPEATED_ID', evidence:'This message ID appears more than once in the capture; fixture responses cannot distinguish those observations.'});
  }
  return {format, messages, duplicateGroups:[...groups.values()].filter(group => group.length > 1).length, observations:messages.length};
}
export function fixture(messages: Message[]): {Records: Record<string, unknown>[]} {
  return {Records:messages.map(message => ({messageId:message.id, receiptHandle:'QUEUEFLIGHT_LOCAL_FIXTURE', body:message.body,
    attributes:{...message.attributes}, messageAttributes:Object.fromEntries(Object.entries(message.messageAttributes).map(([key, value]) => {
      if (!object(value)) return [key, {}];
      return [key, Object.fromEntries(Object.entries(value).map(([name, item]) => [name[0].toLowerCase() + name.slice(1), item]))];
    })), md5OfBody:message.md5 ?? '00000000000000000000000000000000', eventSource:'aws:sqs',
    eventSourceARN:message.arn ?? 'arn:aws:sqs:us-east-1:000000000000:queueflight-local', awsRegion:message.region ?? 'us-east-1'}))};
}
export type RetryMode = 'whole' | 'partial' | 'fifo';
export function simulate(messages: Message[], failedKeys: string[], mode: RetryMode) {
  if (!['whole','partial','fifo'].includes(mode)) throw new Error('Unknown simulation mode.');
  if (messages.length > 10) throw new Error('Simulator supports up to 10 selected records.');
  const known = new Set(messages.map(message => message.key));
  if (failedKeys.some(key => !known.has(key))) throw new Error('Failed selection includes a record outside this batch.');
  const failed = new Set(failedKeys);
  const firstFailure = messages.findIndex(message => failed.has(message.key));
  const retry = messages.filter((message, index) => mode === 'whole' ? failed.size > 0 : mode === 'fifo' ? firstFailure >= 0 && index >= firstFailure : failed.has(message.key));
  const kept = messages.filter(message => !retry.includes(message));
  return {mode, retryKeys:retry.map(message => message.key), acknowledgedKeys:kept.map(message => message.key),
    response:mode === 'whole' ? null : {batchItemFailures:[...new Set(retry.map(message => message.id))].map(id => ({itemIdentifier:id}))}};
}
export interface Difference { path: string; left: unknown; right: unknown; kind: string }
export function compare(left: Json, right: Json): {changes: Difference[]; truncated: boolean} {
  const changes: Difference[] = [], pending = [{path:'', left:left as unknown, right:right as unknown, depth:0}];
  let visited = 0, truncated = false;
  while (pending.length) {
    const item = pending.pop()!;
    if (++visited > 10000 || changes.length >= 300) { truncated = true; break; }
    if (Object.is(item.left, item.right)) continue;
    const a = item.left, b = item.right;
    const bothArrays = Array.isArray(a) && Array.isArray(b), bothObjects = object(a) && object(b);
    if ((bothArrays || bothObjects) && item.depth < 48) {
      const keys = [...new Set([...Object.keys(a as object), ...Object.keys(b as object)])].sort().reverse();
      const budget = Math.max(0, 10000 - visited - pending.length);
      if (keys.length > budget) truncated = true;
      for (const key of keys.slice(0, budget)) pending.push({path:`${item.path}/${key.replaceAll('~','~0').replaceAll('/','~1')}`, left:own(a as object,key) ? (a as any)[key] : undefined, right:own(b as object,key) ? (b as any)[key] : undefined, depth:item.depth + 1});
    } else {
      if ((bothArrays || bothObjects) && item.depth >= 48) truncated = true;
      changes.push({path:item.path || '/', left:a, right:b, kind:a === undefined ? 'added' : b === undefined ? 'removed' : 'changed'});
    }
  }
  return {changes, truncated};
}
