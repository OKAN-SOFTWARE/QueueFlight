// Copyright (c) 2026 OKAN TIKTAS. MIT License.
import {readFile, writeFile, stat} from 'node:fs/promises';
import {analyze, fixture, MAX_BYTES} from './core.ts';
const help=`QueueFlight 0.1.0 — local SQS inspection

node src/cli.ts analyze capture.json [--out report.json]
node src/cli.ts fixture capture.json --out fixture.json [--index 1]

Index is 1-based. Omit it to export the full capture. No AWS API calls.
Output files never overwrite. Reports include imported message bodies.
`;
async function main() {
 const [command,input,...args]=process.argv.slice(2);if(!command||command==='--help'){console.log(help);return;}
 if(!['analyze','fixture'].includes(command)||!input)throw new Error('Use --help for syntax.');
 const opts=new Map<string,string>();
 for(let i=0;i<args.length;i++){const flag=args[i];if(!['--out','--index'].includes(flag)||opts.has(flag)||!args[i+1])throw new Error('Invalid option.');opts.set(flag,args[++i]);}
 if(opts.has('--index')&&command!=='fixture')throw new Error('--index is only for fixture.');
 if((await stat(input)).size>MAX_BYTES)throw new Error('Capture exceeds 5 MiB.');
 const capture=await analyze(await readFile(input,'utf8'));
 let value: unknown=capture;
 if(command==='fixture'){
  if(!opts.has('--out'))throw new Error('Fixture export requires --out.');
  const index=opts.has('--index')?Number(opts.get('--index')):null;
  if(index!==null&&(!Number.isInteger(index)||index<1||index>capture.messages.length))throw new Error('Index is outside this capture.');
  value=fixture(index===null?capture.messages:[capture.messages[index-1]]);
 }
 const json=JSON.stringify(value,null,2)+'\n';
 if(opts.has('--out'))await writeFile(opts.get('--out')!,json,{flag:'wx',mode:0o600});else process.stdout.write(json);
}
main().catch(error=>{console.error(`QueueFlight: ${error.code ? `File operation failed (${error.code}).` : error.message}`);process.exitCode=1;});
