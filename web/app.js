// Copyright (c) 2026 OKAN TIKTAS. MIT License.
import {analyze, fixture, compare, simulate, MAX_BYTES} from '../src/core.ts';
import {DEMO} from './demo.js';
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
