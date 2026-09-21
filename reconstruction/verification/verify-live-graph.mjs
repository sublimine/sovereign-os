import * as fs from 'node:fs';
import {join} from 'node:path';
import {IsolatedExecutionRunner} from '../../factory/tools/execution.mjs';
import {sha256, canonical} from '../../factory/lib/contracts.mjs';
import {graphCases, BRIDGE} from './graph-oracle.mjs';
const workspace=process.argv[2],outputDirectory=process.argv[3];
if(!workspace||!outputDirectory||!fs.statSync(workspace).isDirectory()||fs.readdirSync(outputDirectory).length)throw Error('Explicit existing candidate workspace and new empty results directory required');
const cases=graphCases(),files=['graph.mjs','graph.test.mjs','README.md'].map(path=>{
  const absolute=join(workspace,path),stat=fs.lstatSync(absolute);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>1024*1024)throw Error('Invalid candidate file');
  const content=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(fs.readFileSync(absolute));return {path,content,sha256:sha256(content)};
});
const originalFiles=files.map(({path,sha256:hash})=>({path,sha256:hash}));
for(const [path,content]of [['.qualification-bridge.mjs',BRIDGE],['.qualification-input.json',JSON.stringify(cases.map(({id,input})=>({id,input})))]] )files.push({path,content,sha256:sha256(content)});
const manifest=files.map(f=>({type:'file',path:f.path,bytes:Buffer.byteLength(f.content),sha256:f.sha256}));
fs.writeFileSync(join(outputDirectory,'cases.json'),JSON.stringify(cases,null,2),{flag:'wx',mode:0o600});
const runner=new IsolatedExecutionRunner({wallTimeMs:30000,maxOutputBytes:1024*1024});
const receipt=await runner.run({args:{argv:['node','.qualification-bridge.mjs'],cwd:'.'},snapshot:{files,manifest,hash:sha256(manifest)}});
fs.writeFileSync(join(outputDirectory,'execution.json'),JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});
let actual;try{actual=JSON.parse(receipt.stdout);}catch{actual=null;}
const checks=cases.map(c=>{const rows=Array.isArray(actual)?actual.filter(a=>a.id===c.id):[];return {id:c.id,pass:rows.length===1&&canonical(rows[0])===canonical({id:c.id,...c.expected}),expected:c.expected,actual:rows.length===1?rows[0]:null};});
const unchanged=originalFiles.every(f=>sha256(fs.readFileSync(join(workspace,f.path)))===f.sha256);
const summary={scope:'Independent controller-side exhaustive oracle on 174 frozen small cases; generated code runs only in a disposable isolated process. No expected answers enter that process.',
  candidateFiles:originalFiles,casesHash:sha256(cases),executionHash:sha256(receipt),exitCode:receipt.exitCode,unchanged,
  passed:receipt.exitCode===0&&unchanged&&Array.isArray(actual)&&actual.length===cases.length&&checks.every(c=>c.pass),
  total:checks.length,failures:checks.filter(c=>!c.pass),completedAt:new Date().toISOString()};
fs.writeFileSync(join(outputDirectory,'summary.json'),JSON.stringify(summary,null,2),{flag:'wx',mode:0o600});
process.stdout.write(JSON.stringify(summary)+'\n');if(!summary.passed)process.exitCode=2;
