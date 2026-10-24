// Integration checks against a minimal DOM. Real browser checks are separate.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {webcrypto} from 'node:crypto';
class Node {
 constructor(tag='div'){this.tag=tag;this.nodes=[];this._text='';this._value='';this.checked=false;this.open=false;this.classList={toggle(){},add(){}};}
 set textContent(value){this._text=String(value);this.nodes=[];}get textContent(){return this._text+this.nodes.map(n=>n.textContent).join('');}
 get children(){return this.nodes;}get value(){return this._value||(this.tag==='select'?this.nodes[0]?.value:'')||'';}set value(v){this._value=v;}
 set selectedIndex(i){this._value=this.nodes[i]?.value??'';}append(...nodes){this.nodes.push(...nodes);}replaceChildren(...nodes){this._text='';this.nodes=nodes;}setAttribute(){}click(){return this.onclick?.();}showModal(){this.open=true;}close(){this.open=false;}
}
const waitFor=async predicate=>{const deadline=Date.now()+5000;while(!predicate()){if(Date.now()>deadline)throw new Error('UI initialization timeout');await new Promise(resolve=>setTimeout(resolve,10));}};
test('built browser bundle boots demo, changes selection, compares, simulates, imports, and clears',async()=>{
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8'),elements=new Map();
 for(const match of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"/g))elements.set(match[2],new Node(match[1]));
 elements.get('retry-mode').value='whole';
 const context=vm.createContext({document:{getElementById:id=>elements.get(id),createElement:tag=>new Node(tag),createTextNode:text=>({textContent:text})},crypto:webcrypto,TextEncoder,TextDecoder,URL,Blob,setTimeout,console,navigator:{clipboard:{writeText:async()=>{}}}});
 vm.runInContext(await readFile(new URL('../dist/app.js',import.meta.url),'utf8'),context);await waitFor(()=>elements.get('stat-total').textContent==='6');
 const $=id=>elements.get(id);
 assert.equal($('stat-total').textContent,'6');assert.match($('payload').textContent,/Okan/);assert.equal($('layers').children.length,5);
 $('compare-tab').click();assert.equal($('compare-view').hidden,false);assert.ok($('diff-body').children.length>0);
 $('retry-tab').click();const first=$('retry-records').children[1].children[1].children[0];first.checked=true;first.onchange();assert.equal($('retry-count').textContent,'6');
 $('retry-mode').value='partial';$('retry-mode').onchange();assert.equal($('retry-count').textContent,'1');assert.match($('retry-response').textContent,/demo-phoenix-002/);
 $('paste').click();$('capture-input').value='{"Messages":[{"Body":"<img src=x onerror=alert(1)>","MessageId":"new"}]}';await $('analyze').onclick();assert.equal($('stat-total').textContent,'1');assert.match($('payload').textContent,/<img/);
 $('paste').click();$('capture-input').value='broken';await $('analyze').onclick();assert.match($('paste-error').textContent,/Invalid JSON/);assert.equal($('stat-total').textContent,'1');
 $('reset').click();assert.equal($('stat-total').textContent,'0');assert.equal($('capture-input').value,'');assert.equal($('export').disabled,true);
 await $('demo').onclick();assert.equal($('stat-total').textContent,'6');
});
