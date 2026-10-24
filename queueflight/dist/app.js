(()=> {
"use strict";
// Copyright (c) 2026 OKAN TIKTAS. MIT License.
                                                                                       
                                                    
                                                           
                          
                                                                       
                                                                              
                                                                
                                                                              
                       
 
                                                                                                               
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_RECORDS = 500;
const encoder = new TextEncoder();
const own = (value        , key        ) => Object.prototype.hasOwnProperty.call(value, key);
function object(value         )                                { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function dictionary(value         )                         {
  if (!object(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === 'string'))                          ;
}
function unwrap(body        )                                                       {
  let value       = body;
  const layers          = [{kind: 'SQS body', value}];
  let progressed = false;
  for (let step = 0; step < 6; step++) {
    progressed = false;
    if (typeof value === 'string') {
      try { value = JSON.parse(value)        ; layers.push({kind: 'Decoded JSON', value}); progressed = true; }
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
async function analyze(input        )                   {
  if (typeof input !== 'string' || encoder.encode(input).length > MAX_BYTES) throw new Error('Capture exceeds the 5 MiB limit.');
  let data         ;
  try { data = JSON.parse(input); } catch { throw new Error('Invalid JSON. Paste a complete SQS response or Lambda SQS event.'); }
  let rows           , format        ;
  if (object(data) && Array.isArray(data.Messages)) { rows = data.Messages; format = 'SQS ReceiveMessage'; }
  else if (object(data) && Array.isArray(data.Records)) { rows = data.Records; format = 'Lambda SQS event'; }
  else if (Array.isArray(data)) { rows = data; format = 'Message array'; }
  else if (object(data) && (own(data, 'Body') || own(data, 'body'))) { rows = [data]; format = 'Single message'; }
  else throw new Error('Expected Messages[], Records[], a message array, or a single Body/body message.');
  if (rows.length > MAX_RECORDS) throw new Error(`Capture has too many records. Limit: ${MAX_RECORDS}.`);
  const messages            = [];
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
    const findings            = [];
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
  const groups = new Map                   ();
  for (const message of messages) { const group = groups.get(message.digest) ?? []; group.push(message); groups.set(message.digest, group); }
  const idCounts = new Map                ();
  for (const message of messages) idCounts.set(message.id, (idCounts.get(message.id) ?? 0) + 1);
  for (const group of groups.values()) for (const message of group) {
    message.duplicateCount = group.length;
    if (group.length > 1) message.findings.push({code:'IDENTICAL_BODY', evidence:`${group.length} imported observations have byte-identical UTF-8 bodies (SHA-256). This is not proof of duplicate delivery.`});
    if ((idCounts.get(message.id) ?? 0) > 1) message.findings.push({code:'REPEATED_ID', evidence:'This message ID appears more than once in the capture; fixture responses cannot distinguish those observations.'});
  }
  return {format, messages, duplicateGroups:[...groups.values()].filter(group => group.length > 1).length, observations:messages.length};
}
function fixture(messages           )                                       {
  return {Records:messages.map(message => ({messageId:message.id, receiptHandle:'QUEUEFLIGHT_LOCAL_FIXTURE', body:message.body,
    attributes:{...message.attributes}, messageAttributes:Object.fromEntries(Object.entries(message.messageAttributes).map(([key, value]) => {
      if (!object(value)) return [key, {}];
      return [key, Object.fromEntries(Object.entries(value).map(([name, item]) => [name[0].toLowerCase() + name.slice(1), item]))];
    })), md5OfBody:message.md5 ?? '00000000000000000000000000000000', eventSource:'aws:sqs',
    eventSourceARN:message.arn ?? 'arn:aws:sqs:us-east-1:000000000000:queueflight-local', awsRegion:message.region ?? 'us-east-1'}))};
}
                                                     
function simulate(messages           , failedKeys          , mode           ) {
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
                                                                                         
function compare(left      , right      )                                              {
  const changes               = [], pending = [{path:'', left:left           , right:right           , depth:0}];
  let visited = 0, truncated = false;
  while (pending.length) {
    const item = pending.pop() ;
    if (++visited > 10000 || changes.length >= 300) { truncated = true; break; }
    if (Object.is(item.left, item.right)) continue;
    const a = item.left, b = item.right;
    const bothArrays = Array.isArray(a) && Array.isArray(b), bothObjects = object(a) && object(b);
    if ((bothArrays || bothObjects) && item.depth < 48) {
      const keys = [...new Set([...Object.keys(a          ), ...Object.keys(b          )])].sort().reverse();
      const budget = Math.max(0, 10000 - visited - pending.length);
      if (keys.length > budget) truncated = true;
      for (const key of keys.slice(0, budget)) pending.push({path:`${item.path}/${key.replaceAll('~','~0').replaceAll('/','~1')}`, left:own(a          ,key) ? (a       )[key] : undefined, right:own(b          ,key) ? (b       )[key] : undefined, depth:item.depth + 1});
    } else {
      if ((bothArrays || bothObjects) && item.depth >= 48) truncated = true;
      changes.push({path:item.path || '/', left:a, right:b, kind:a === undefined ? 'added' : b === undefined ? 'removed' : 'changed'});
    }
  }
  return {changes, truncated};
}

// Copyright (c) 2026 OKAN TIKTAS. MIT License. Entirely fictional data.
const DEMO = {Messages:[
 {MessageId:'demo-okan-001', Body:JSON.stringify({Type:'Notification',MessageId:'demo-sns-1',TopicArn:'arn:aws:sns:us-east-1:000000000000:demo-orders',Message:JSON.stringify({version:'0',source:'demo.orders','detail-type':'OrderCreated',detail:{orderId:'ORD-1042',customer:'Okan',total:49.99,currency:'USD',items:2}})}), Attributes:{ApproximateReceiveCount:'1',SentTimestamp:'1792828800000'}},
 {MessageId:'demo-phoenix-002', Body:JSON.stringify({orderId:'ORD-1043',customer:'Phoenix',total:29.5,currency:'USD',items:1}), Attributes:{ApproximateReceiveCount:'5',SentTimestamp:'1792828860000'}},
 {MessageId:'demo-mira-003', Body:JSON.stringify({orderId:'ORD-1044',customer:'Mira',total:'unknown',currency:'USD',items:3}), Attributes:{ApproximateReceiveCount:'7',SentTimestamp:'1792828920000'}},
 {MessageId:'demo-phoenix-004', Body:JSON.stringify({orderId:'ORD-1043',customer:'Phoenix',total:29.5,currency:'USD',items:1}), Attributes:{ApproximateReceiveCount:'2',SentTimestamp:'1792828980000'}},
 {MessageId:'demo-plain-005', Body:'warehouse notification: inventory sync queued', Attributes:{ApproximateReceiveCount:'1'}},
 {MessageId:'demo-okan-006', Body:JSON.stringify({orderId:'ORD-1042',customer:'Okan',total:59.99,currency:'USD',items:3}), Attributes:{ApproximateReceiveCount:'1',SentTimestamp:'1792829040000'}}
]};

// Copyright (c) 2026 OKAN TIKTAS. MIT License.
const $ = id => document.getElementById(id);
let capture = null, activeKey = null, layerIndex = -1, selected = new Set(), failures = new Set(), generation = 0, currentView = 'inspect', responseText = '';
function status(text, error=false) { $('status').textContent=text; $('status').classList.toggle('error',error); }
function element(tag,text,cls) {const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
function pretty(value) {if(value===undefined)return '(missing)';try{return JSON.stringify(value,null,2);}catch{return '[JSON is too deeply nested to display]';}}
function message(key) {return capture?.messages.find(item=>item.key===key);}
function active() {return message(activeKey);}
async function download(value,name) {const json=JSON.stringify(value,null,2);if(globalThis.__TAURI__?.core?.invoke){return globalThis.__TAURI__.core.invoke('export_json',{json,filename:name});}const url=URL.createObjectURL(new Blob([json+'\n'],{type:'application/json'}));const a=element('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function copy(text) {try{await navigator.clipboard.writeText(text);status('Copied to clipboard. Imported data can contain sensitive details; review before sharing.');}catch{status('Clipboard access failed. Select the text and copy it manually.',true);}}
function updateStats() {
 const rows=capture?.messages??[];
 $('stat-total').textContent=String(rows.length);
 $('stat-duplicates').textContent=String(capture?.duplicateGroups??0);
 $('stat-receives').textContent=String(rows.filter(row=>row.findings.some(f=>f.code==='RECEIVED_REPEATEDLY')).length);
 $('stat-nested').textContent=String(rows.filter(row=>row.layers.some(layer=>['SNS Message','EventBridge detail'].includes(layer.kind))).length);
 $('capture-count').textContent=`${rows.length} observations`;
 $('capture-format').textContent=capture?.format??'Awaiting input';
}
function renderList() {
 const list=$('message-list');list.replaceChildren();
 const query=$('search').value.toLowerCase();
 for(const row of capture?.messages??[]) {
  if(query&&!`${row.id} ${row.body}`.toLowerCase().includes(query))continue;
  const wrap=element('div',undefined,'message-row'+(row.key===activeKey?' current':''));
  const check=element('input');check.type='checkbox';check.checked=selected.has(row.key);check.setAttribute('aria-label',`Select ${row.id}`);
  check.onchange=()=>{if(check.checked)selected.add(row.key);else selected.delete(row.key);failures.delete(row.key);renderSelection();renderRetry();};
  const button=element('button',undefined,'message-button');button.type='button';button.setAttribute('aria-pressed',String(row.key===activeKey));
  button.append(element('span',row.id,'message-title'));
  const count=row.attributes.ApproximateReceiveCount??'unknown';
  button.append(element('span',`${row.bytes.toLocaleString()} bytes · receives ${count}`,'message-summary'));
  const flags=element('div',undefined,'message-flags');
  if(row.duplicateCount>1)flags.append(element('span',`IDENTICAL ×${row.duplicateCount}`));
  if(row.findings.some(f=>f.code==='RECEIVED_REPEATEDLY'))flags.append(element('span','REPEATED RECEIVES','attention'));
  if(row.layers.some(l=>l.kind==='SNS Message'))flags.append(element('span','SNS'));
  if(row.layers.some(l=>l.kind==='EventBridge detail'))flags.append(element('span','EVENTBRIDGE'));
  button.append(flags);button.onclick=()=>{activeKey=row.key;layerIndex=-1;renderList();renderDetail();};
  wrap.append(check,button);list.append(wrap);
 }
 if(!list.children.length)list.append(element('p',capture?'No messages match this filter.':'Import a capture to inspect messages.','empty'));
 renderSelection();
}
function renderSelection() {
 $('selection-count').textContent=`${selected.size} selected`;
 $('export').disabled=selected.size===0;
 const count=capture?.messages.length??0;
 $('select-all').checked=count>0&&selected.size===count;
 $('select-all').indeterminate=selected.size>0&&selected.size<count;
}
function renderDetail() {
 const row=active();$('metadata').replaceChildren();$('layers').replaceChildren();$('findings').replaceChildren();
 $('export-one').disabled=!row;$('copy-payload').disabled=!row;
 if(!row){$('detail-id').textContent='Choose a message';$('payload').textContent='Import a capture or load the fictional demo.';return;}
 $('detail-id').textContent=row.id;
 const stamp=row.attributes.SentTimestamp;
 const sent=stamp&&/^\d+$/.test(stamp)&&Number(stamp)<=8640000000000000?new Date(Number(stamp)).toISOString():'Not supplied / invalid';
 for(const [label,value] of [['Body size',`${row.bytes} bytes`],['Receive count',row.attributes.ApproximateReceiveCount??'Not supplied'],['Sent (UTC)',sent],['SHA-256',row.digest.slice(0,12)+'…']]) {
  const item=element('div',undefined,'meta-item');item.append(element('span',label),element('strong',value));$('metadata').append(item);
 }
 if(layerIndex<0||layerIndex>=row.layers.length)layerIndex=row.layers.length-1;
 row.layers.forEach((layer,index)=>{const button=element('button',`${index+1} · ${layer.kind}`,'layer'+(index===layerIndex?' active':''));button.setAttribute('aria-pressed',String(index===layerIndex));button.onclick=()=>{layerIndex=index;renderDetail();};$('layers').append(button);});
 $('payload-label').textContent=row.layers[layerIndex].kind;
 const value=row.layers[layerIndex].value;
 const display=typeof value==='string'?value:pretty(value);
 $('payload').textContent=display.length>200000?display.slice(0,200000)+'\n[Display truncated. Fixture export preserves the full body.]':display;
 for(const finding of row.findings){const item=element('div',undefined,'finding');item.append(element('code',finding.code),element('p',finding.evidence));$('findings').append(item);}
 if(!row.findings.length)$('findings').append(element('p','No configured observations matched. This does not establish that processing will succeed.','muted'));
}
function populateCompare() {
 for(const id of ['compare-left','compare-right']){const select=$(id);select.replaceChildren();for(const row of capture?.messages??[]){const option=element('option',row.id);option.value=row.key;select.append(option);}}
 if((capture?.messages.length??0)>1)$('compare-right').selectedIndex=1;
 renderCompare();
}
function renderCompare() {
 const left=message($('compare-left').value),right=message($('compare-right').value);$('diff-body').replaceChildren();
 if(!left||!right){$('diff-summary').textContent='Import messages to compare their unwrapped payloads.';return;}
 const result=compare(left.payload,right.payload);
 $('diff-summary').textContent=`${result.changes.length} changed paths${result.truncated?' · Comparison limit reached; some differences may be omitted.':result.changes.length===0?' · Payloads match structurally.':''}`;
 for(const change of result.changes){const tr=element('tr');for(const value of [change.path,pretty(change.left),pretty(change.right)])tr.append(element('td',value.length>2000?value.slice(0,2000)+'…':value));$('diff-body').append(tr);}
}
function renderRetry() {
 const rows=(capture?.messages??[]).filter(row=>selected.has(row.key));const mode=$('retry-mode').value;
 $('retry-records').replaceChildren();responseText='';$('copy-response').disabled=true;
 if(rows.length===0||rows.length>10){$('retry-records').append(element('p',rows.length?'Select at most 10 observations for the retry lab.':'Select messages with the checkboxes on the left.','muted'));$('ack-count').textContent='0';$('retry-count').textContent='0';$('retry-response').textContent='No simulation yet.';$('retry-explanation').textContent='';return;}
 for(const row of rows){const item=element('div',undefined,'retry-row');item.append(element('span',row.id));const label=element('label');const check=element('input');check.type='checkbox';check.checked=failures.has(row.key);check.onchange=()=>{if(check.checked)failures.add(row.key);else failures.delete(row.key);renderRetry();};label.append(check,document.createTextNode(' Hypothetical failure'));item.append(label);$('retry-records').append(item);}
 const result=simulate(rows,[...failures].filter(key=>selected.has(key)),mode);
 $('ack-count').textContent=String(result.acknowledgedKeys.length);$('retry-count').textContent=String(result.retryKeys.length);
 $('retry-explanation').textContent=mode==='whole'?(failures.size?'A thrown error fails the complete invocation, including messages that may already have been processed.':'No hypothetical failure: the whole batch succeeds.'):
 mode==='fifo'?'Conservative FIFO example: stop at the first failure; return that record and all later records in this batch.':'Standard queue example: report only the selected failures. Successful processing can still be duplicated in real at-least-once delivery.';
 if(result.response){responseText=pretty(result.response);$('retry-response').textContent=responseText;$('copy-response').disabled=false;}
 else $('retry-response').textContent=failures.size?'Function throws → no successful batch response.':'Function succeeds → entire batch acknowledged.';
}
function setView(name) {
 currentView=name;
 for(const view of ['inspect','compare','retry']){$(`${view}-view`).hidden=view!==name;$(`${view}-tab`).classList.toggle('active',view===name);$(`${view}-tab`).setAttribute('aria-pressed',String(view===name));}
 if(name==='compare')renderCompare();if(name==='retry')renderRetry();
}
async function load(text,title,token) {
 const next=await analyze(text);
 if(token!==generation)return;
 capture=next;activeKey=next.messages[0]?.key??null;layerIndex=-1;selected=new Set(next.messages.slice(0,10).map(row=>row.key));failures=new Set();$('search').value='';
 $('capture-title').textContent=title;updateStats();renderList();renderDetail();populateCompare();renderRetry();
 status(`${next.messages.length} observations imported locally. Counts describe this capture, not the live queue. Fixture exports include original bodies; review before sharing.`);
}
async function run(operation){try{await operation();}catch(error){status(error.message||'Unable to complete this operation.',true);}}
$('demo').onclick=()=>run(()=>load(JSON.stringify(DEMO),'Fictional checkout capture',++generation));
$('paste').onclick=()=>{$('paste-error').textContent='';$('paste-dialog').showModal();};
$('analyze').onclick=async()=>{const token=++generation;$('analyze').disabled=true;try{await load($('capture-input').value,'Pasted JSON capture',token);if(token===generation){$('paste-dialog').close();$('capture-input').value='';}}catch(error){$('paste-error').textContent=error.message;}finally{$('analyze').disabled=false;}};
$('import').onclick=()=>run(async()=>{
 if(globalThis.__TAURI__?.core?.invoke){const token=++generation;const text=await globalThis.__TAURI__.core.invoke('import_capture');if(text!==null)await load(text,'Native file capture',token);}
 else $('file').click();
});
$('file').onchange=()=>run(async()=>{const file=$('file').files[0];if(!file)return;const token=++generation;try{if(file.size>MAX_BYTES)throw new Error('File exceeds 5 MiB.');const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());await load(text,file.name,token);}finally{$('file').value='';}});
$('reset').onclick=()=>{generation++;capture=null;activeKey=null;selected.clear();failures.clear();$('search').value='';$('capture-input').value='';$('file').value='';$('capture-title').textContent='No capture loaded';$('paste-dialog').close();updateStats();renderList();renderDetail();populateCompare();renderRetry();status('Session fields cleared. Downloads and clipboard contents remain on your device.');};
$('search').oninput=renderList;
$('select-all').onchange=()=>{selected=$('select-all').checked?new Set((capture?.messages??[]).map(row=>row.key)):new Set();failures.clear();renderList();renderRetry();};
$('export').onclick=()=>run(async()=>{const rows=(capture?.messages??[]).filter(row=>selected.has(row.key));if(!rows.length)return;const saved=await download(fixture(rows),'queueflight-lambda-fixture.json');if(saved===false){status('Export canceled.');return;}status('Local Lambda fixture downloaded. Body is preserved; receipt handles and missing metadata are synthetic. Review before sharing.');});
$('export-one').onclick=()=>run(async()=>{const row=active();if(row)await download(fixture([row]),'queueflight-message-fixture.json');});
$('copy-payload').onclick=()=>{const row=active();if(row){const value=row.layers[layerIndex].value;void copy(typeof value==='string'?value:pretty(value));}};
$('copy-response').onclick=()=>{if(responseText)void copy(responseText);};
$('compare-left').onchange=renderCompare;$('compare-right').onchange=renderCompare;$('retry-mode').onchange=renderRetry;
for(const view of ['inspect','compare','retry'])$(`${view}-tab`).onclick=()=>setView(view);
void run(()=>load(JSON.stringify(DEMO),'Fictional checkout capture',++generation));

})();
