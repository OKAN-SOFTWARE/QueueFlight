// Copyright (c) 2026 OKAN TIKTAS. MIT License.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
const routes = new Map([['/', ['index.html','text/html']],['/index.html',['index.html','text/html']],['/style.css',['style.css','text/css']],['/app.js',['app.js','text/javascript']],['/core.js',['core.js','text/javascript']],['/demo.js',['demo.js','text/javascript']]]);
const port=Number(process.env.PORT ?? 4320);
if (!Number.isInteger(port)||port<1||port>65535) throw new Error('Invalid PORT.');
const server=http.createServer(async(req,res)=>{
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  if (!/^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host??'')) return res.writeHead(403).end();
  if (!['GET','HEAD'].includes(req.method)) return res.writeHead(405).end();
  const route=routes.get(req.url);if (!route) return res.writeHead(404).end();
  try {const body=await readFile(new URL(`../dist/${route[0]}`,import.meta.url));res.writeHead(200,{'Content-Type':`${route[1]}; charset=utf-8`});res.end(req.method==='HEAD'?undefined:body);}catch{res.writeHead(500).end('Run npm run build first.');}
});
server.on('error',error=>{console.error(error.code);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`QueueFlight → http://127.0.0.1:${port}\nCtrl+C to stop.`));
