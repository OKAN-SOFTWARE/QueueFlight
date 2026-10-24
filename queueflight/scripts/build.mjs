// Copyright (c) 2026 OKAN TIKTAS. MIT License.
import {stripTypeScriptTypes} from 'node:module';
import {mkdir, readFile, writeFile, cp, rm} from 'node:fs/promises';
const root = new URL('../', import.meta.url), dist = new URL('dist/', root);
await rm(dist, {recursive:true, force:true}); await mkdir(dist, {recursive:true});
for (const name of ['index.html','style.css']) await cp(new URL(`web/${name}`,root), new URL(name,dist));
const source = await readFile(new URL('src/core.ts',root),'utf8');
const core = stripTypeScriptTypes(source,{mode:'strip'}).replace(/^export /gm,'');
const demo = (await readFile(new URL('web/demo.js',root),'utf8')).replace(/^export /gm,'');
const app = (await readFile(new URL('web/app.js',root),'utf8')).replace(/^import .*;\n/gm,'');
await writeFile(new URL('app.js',dist), '(()=> {\n\"use strict\";\n'+core+'\n'+demo+'\n'+app+'\n})();\n');
console.log('Built dist/ — separate HTML, CSS and JavaScript, ready for static hosting.');
