import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,unwrap,fixture,simulate,compare,MAX_BYTES} from '../src/core.ts';
import {DEMO} from '../web/demo.js';
const read=value=>analyze(JSON.stringify(value));

test('SQS demo unwraps SNS and EventBridge while preserving original bodies',async()=>{
 const result=await read(DEMO);assert.equal(result.messages.length,6);const first=result.messages[0];
 assert.equal(first.payload.customer,'Okan');assert.deepEqual(first.layers.map(l=>l.kind),['SQS body','Decoded JSON','SNS Message','Decoded JSON','EventBridge detail']);
 assert.equal(first.body,DEMO.Messages[0].Body);assert.equal(result.duplicateGroups,1);
 assert.equal(result.messages[1].duplicateCount,2);assert.ok(result.messages[2].findings.some(f=>f.code==='RECEIVED_REPEATEDLY'));
});
test('Lambda, arrays, single messages, and empty valid captures',async()=>{
 for(const input of [{Records:[{messageId:'id1',body:'null',eventSource:'aws:sqs'}]},[{Body:'null',MessageId:'id1'}],{Body:'null',MessageId:'id1'}]){const result=await read(input);assert.equal(result.messages[0].payload,null);}
 assert.equal((await read({Messages:[]})).observations,0);
});
test('mixed invalid records reject entire import with record number',async()=>{
 for(const input of [{Records:[{eventSource:'aws:sns',body:'x'}]},{Messages:[{Body:'x'},{}]},{Messages:[null]},42,{hello:'world'}])await assert.rejects(read(input));
 await assert.rejects(read({Messages:[{Body:'x'},{Body:{nested:'object'}}]}),/Record 2/);
});
test('invalid JSON and size/record limits fail before processing',async()=>{
 await assert.rejects(analyze('not json'),/Invalid JSON/);await assert.rejects(analyze('é'.repeat(MAX_BYTES)),/5 MiB/);
 await assert.rejects(read({Messages:Array.from({length:501},()=>({Body:'x'}))}),/too many/);
});
test('plain text is valid and missing metadata is explicit',async()=>{
 const result=(await read({Body:'warehouse: ready'})).messages[0];assert.equal(result.payload,'warehouse: ready');assert.ok(result.syntheticId);assert.equal(result.layers.length,1);
 assert.ok(result.findings.some(f=>f.code==='PLAIN_TEXT'));assert.deepEqual(result.attributes,{});
});
test('decode depth limit preserves remainder and SNS plaintext survives',()=>{
 assert.equal(unwrap(JSON.stringify({Type:'Notification',Message:'hello'})).payload,'hello');
 let value={x:1};for(let i=0;i<10;i++)value=JSON.stringify(value);assert.ok(unwrap(value).truncated);
});
test('body equality is exact, not semantic, and repeated IDs are flagged separately',async()=>{
 const result=await read({Messages:[{MessageId:'a',Body:'{"x":1}'},{MessageId:'a',Body:'{ "x": 1 }'},{MessageId:'b',Body:'{"x":1}'}]});
 assert.equal(result.duplicateGroups,1);assert.equal(result.messages[1].duplicateCount,1);assert.ok(result.messages[0].findings.some(f=>f.code==='REPEATED_ID'));
});
test('malformed timestamp and receive count do not become fabricated numbers',async()=>{
 const row=(await read({Body:'x',Attributes:{ApproximateReceiveCount:'five',SentTimestamp:'9e999'}})).messages[0];
 assert.ok(row.findings.some(f=>f.code==='INVALID_RECEIVE_COUNT'));assert.ok(row.findings.some(f=>f.code==='INVALID_TIMESTAMP'));
});
test('fixture keeps original envelope and normalizes attributes without original receipt handle',async()=>{
 const result=await read({Messages:[{Body:'{"x":1}',MessageId:'real-id',ReceiptHandle:'sensitive-original',MessageAttributes:{tag:{DataType:'String',StringValue:'hello'}}}]});
 const record=fixture(result.messages).Records[0];assert.equal(record.body,'{"x":1}');assert.equal(record.messageAttributes.tag.stringValue,'hello');assert.equal(record.receiptHandle,'QUEUEFLIGHT_LOCAL_FIXTURE');
 assert.ok(!JSON.stringify(record).includes('sensitive-original'));assert.equal((await read(fixture(result.messages))).messages[0].body,result.messages[0].body);
});
test('whole, partial, and conservative FIFO have distinct retry sets',async()=>{
 const rows=(await read(DEMO)).messages.slice(0,4), failed=[rows[1].key];
 assert.deepEqual(simulate(rows,failed,'whole').retryKeys,rows.map(r=>r.key));
 assert.deepEqual(simulate(rows,failed,'partial').retryKeys,[rows[1].key]);
 assert.deepEqual(simulate(rows,failed,'fifo').retryKeys,rows.slice(1).map(r=>r.key));
 assert.deepEqual(simulate(rows,failed,'fifo').response.batchItemFailures.map(x=>x.itemIdentifier),rows.slice(1).map(r=>r.id));
 for(const mode of ['whole','partial','fifo'])assert.equal(simulate(rows,[],mode).retryKeys.length,0);
 assert.throws(()=>simulate(rows,['unknown'],'partial'));assert.throws(()=>simulate(Array(11).fill(rows[0]),[],'whole'));assert.throws(()=>simulate(rows,[],'invalid'));
});
test('structural diff distinguishes missing/null, arrays, and escaped JSON pointer keys',()=>{
 const result=compare({'a/b':null,'~key':1,list:[1,2]},{'~key':2,list:[1]});
 assert.ok(result.changes.some(x=>x.path==='/a~1b'&&x.right===undefined&&x.left===null));assert.ok(result.changes.some(x=>x.path==='/~0key'));assert.ok(result.changes.some(x=>x.path==='/list/1'));
 assert.equal(compare({a:1,b:2},{b:2,a:1}).changes.length,0);
});
test('diff handles prototype-named keys as ordinary data and enforces resource caps',()=>{
 const left=JSON.parse('{"__proto__":{"safe":1}}'),right=JSON.parse('{"__proto__":{"safe":2}}');assert.equal(compare(left,right).changes[0].path,'/__proto__/safe');
 const big=Object.fromEntries(Array.from({length:400},(_,i)=>[String(i),i]));assert.equal(compare({},big).changes.length,300);assert.ok(compare({},big).truncated);
});
