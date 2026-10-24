// Optional real-browser check. Install Playwright and its Chromium browser first.
import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const child=spawn(process.execPath,[fileURLToPath(new URL('./serve.mjs',import.meta.url))],{env:{...process.env,PORT:'14388'},stdio:['ignore','pipe','pipe']});
let browser;
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server timeout')),5000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Server exited ${code}`));});});
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1100},permissions:['clipboard-read','clipboard-write']});const page=await context.newPage();const errors=[],external=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:14388'))external.push(r.url());});
 await page.goto('http://127.0.0.1:14388');await page.waitForFunction(()=>document.getElementById('stat-total').textContent==='6');
 assert.match(await page.locator('#payload').textContent(),/Okan/);await page.locator('#compare-tab').click();assert.ok(await page.locator('#diff-body tr').count()>0);
 await page.locator('#retry-tab').click();await page.locator('#retry-records input').nth(2).check();assert.equal(await page.locator('#retry-count').textContent(),'6');
 await page.locator('#retry-mode').selectOption('partial');assert.equal(await page.locator('#retry-count').textContent(),'1');
 const pending=page.waitForEvent('download');await page.locator('#export').click();assert.equal((await pending).suggestedFilename(),'queueflight-lambda-fixture.json');
 await page.locator('#paste').click();await page.locator('#capture-input').fill('{"Messages":[{"MessageId":"x","Body":"hello"}]}');await page.locator('#analyze').click();await page.waitForFunction(()=>document.getElementById('stat-total').textContent==='1');
 await page.locator('#inspect-tab').click();assert.equal(await page.locator('#payload').textContent(),'hello');
 await page.locator('#reset').click();assert.equal(await page.locator('#stat-total').textContent(),'0');await page.locator('#demo').click();await page.waitForFunction(()=>document.getElementById('stat-total').textContent==='6');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('Real-browser flow passed: import, demo, compare, retry, export, clear, responsive width, no external requests.');
}finally{if(browser)await browser.close();child.kill();}
