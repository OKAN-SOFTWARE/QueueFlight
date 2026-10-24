import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {DEMO} from '../web/demo.js';
const cli=fileURLToPath(new URL('../src/cli.ts',import.meta.url));
const run=args=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
test('CLI reports duplicate evidence, exports one fixture, and refuses overwrite',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'qf-cli-'));t.after(()=>rm(dir,{recursive:true,force:true}));const input=join(dir,'capture.json'),out=join(dir,'fixture.json');await writeFile(input,JSON.stringify(DEMO));
 const report=run(['analyze',input]);assert.equal(report.status,0,report.stderr);assert.equal(JSON.parse(report.stdout).duplicateGroups,1);
 const result=run(['fixture',input,'--index','2','--out',out]);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(await readFile(out,'utf8')).Records.length,1);
 if(process.platform!=='win32')assert.equal((await stat(out)).mode&0o777,0o600);
 assert.equal(run(['fixture',input,'--out',out]).status,1);assert.equal(run(['fixture',input,'--index','0','--out',join(dir,'bad')]).status,1);
 await writeFile(input,'{"private":"demo-secret-value", broken JSON}');const bad=run(['analyze',input]);assert.equal(bad.status,1);assert.ok(!bad.stderr.includes('demo-secret-value'));
});
