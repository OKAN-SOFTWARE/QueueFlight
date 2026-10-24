import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';import http from 'node:http';
test('static server serves built app, rejects writes, traversal and nonlocal Hosts',async t=>{
 const child=spawn(process.execPath,[fileURLToPath(new URL('../scripts/serve.mjs',import.meta.url))],{env:{...process.env,PORT:'14387'},stdio:['ignore','pipe','pipe']});
 t.after(()=>{child.kill();});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server did not start')),5000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Server exited ${code}`));});});
 function request(path,method='GET',host='127.0.0.1:14387'){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:14387,path,method,headers:{Host:host}},res=>{let body='';res.on('data',data=>body+=data);res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers}));});req.on('error',reject);req.end();});}
 const home=await request('/');assert.equal(home.status,200);assert.match(home.headers['content-security-policy'],/connect-src 'none'/);
 for(const path of ['/app.js','/style.css'])assert.equal((await request(path)).status,200);
 for(const path of ['/package.json','/src/cli.ts','/../../LICENSE','/%2e%2e/LICENSE'])assert.equal((await request(path)).status,404);
 assert.equal((await request('/','POST')).status,405);assert.equal((await request('/','GET','attacker.example')).status,403);
});
