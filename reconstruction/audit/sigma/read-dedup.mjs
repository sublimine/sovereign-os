// Read-only audit helper: exact-byte line references, no normalization or semantic filtering.
import fs from 'node:fs';
import crypto from 'node:crypto';
const base=['docs/sigma/00-SIGMA-CONSTITUTION.md','docs/sigma/01-SIGMA-SYSTEM-ARCHITECTURE.md','docs/sigma/24-SIGMA-DEPARTMENT-INTERFACES.md','docs/sigma/agents/v3/sigma-01-dossier.md'];
for(let i=1;i<=5;i++)base.push(`config/sigma/v3/charters/sigma-${String(i).padStart(2,'0')}.system.md`);
const later=[];
for(let i=2;i<=40;i++){
  const id=String(i).padStart(2,'0');
  if(i>5)later.push(`config/sigma/v3/charters/sigma-${id}.system.md`);
  later.push(`docs/sigma/agents/v3/sigma-${id}-dossier.md`);
}
const seen=new Map(),entries=[];
for(const file of [...base,...later]){
  const bytes=fs.readFileSync(file),lines=bytes.toString('utf8').match(/[^\n]*\n|[^\n]+$/g)||[],fresh=[],references=[];
  lines.forEach((text,i)=>{
    const sha256=crypto.createHash('sha256').update(text).digest('hex');
    if(seen.has(text))references.push({line:i+1,sha256,original:seen.get(text)});
    else {seen.set(text,{file,line:i+1});fresh.push({line:i+1,sha256,text});}
  });
  entries.push({file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),lines:lines.length,fresh,references});
}
const file=process.argv[2],offset=Number(process.argv[3]||0),count=Number(process.argv[4]||100),entry=entries.find(e=>e.file===file);
if(file==='--index')console.log(JSON.stringify(entries.map(({file,sha256,lines,fresh,references})=>({file,sha256,lines,freshLines:fresh.length,repeatedLines:references.length})),null,2));
else if(file==='--references')console.log(JSON.stringify(entries));
else if(file==='--coverage')console.log(JSON.stringify(entries.filter(e=>Number(e.file.match(/sigma-(\d+)/)?.[1])===offset).map(({file,sha256,lines,fresh,references})=>({file,sha256,lines,fresh:fresh.map(x=>x.line),references:references.map(x=>[x.line,x.original.file,x.original.line])}))));
else if(!entry)throw Error('Unknown corpus file');
else {
  console.log(JSON.stringify({file,sha256:entry.sha256,lines:entry.lines,freshTotal:entry.fresh.length,readFreshRange:[offset,Math.min(offset+count,entry.fresh.length)],exactRepeatedLines:entry.references.length}));
  for(const x of entry.fresh.slice(offset,offset+count))process.stdout.write(`${x.line}: ${x.text}`);
}
