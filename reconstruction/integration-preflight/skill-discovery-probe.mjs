// Read-only local skill discovery. No thread, inference, or account mutation.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,lstat,rm,writeFile} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const output=process.argv[2];
if(!output)throw Error('New evidence output path required');
const directory=await mkdtemp(join(tmpdir(),'sovereign-skill-probe-'));
const names=new Set(),codexHome=process.env.CODEX_HOME||join(homedir(),'.codex');
let child,exitWait,timer;
try {
  for(const file of ['/etc/codex/config.toml',join(codexHome,'config.toml'),'/.codex/config.toml',join(tmpdir(),'.codex/config.toml')]) {
    let info;try{info=await lstat(file);}catch(e){if(e.code==='ENOENT')continue;throw e;}
    if(!info.isFile()||info.size>1024*1024)throw Error('Unsupported configuration metadata');
    for(const line of (await readFile(file,'utf8')).split(/\r?\n/)) {
      const t=line.trim();if(!t||t.startsWith('#')||!t.includes('mcp_servers'))continue;
      const m=t.match(/^\[mcp_servers\.([A-Za-z0-9_-]+)(?:\.[A-Za-z0-9_-]+)*\]\s*(?:#.*)?$/);
      if(!m)throw Error('Unsupported MCP metadata syntax');names.add(m[1]);
    }
  }
  const disabled=['shell_tool','unified_exec','code_mode','code_mode_host','code_mode_only','apps','plugins','hooks','multi_agent','multi_agent_v2','browser_use','computer_use','image_generation','view_image','deferred_executor','tool_suggest','memories','goals'];
  const config=['features.code_mode_host={enabled=false,disable_in_process_fallback=false}','agents.enabled=false','notify=[]','web_search="disabled"',...[...names].map(n=>`mcp_servers.${n}.enabled=false`)];
  const env=Object.fromEntries(['HOME','PATH','CODEX_HOME','XDG_CONFIG_HOME','XDG_DATA_HOME','XDG_RUNTIME_DIR','LANG'].filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]]));
  child=spawn('/home/cardeex/.local/bin/codex',['app-server','--stdio',...disabled.flatMap(f=>['--disable',f]),...config.flatMap(v=>['-c',v])],{cwd:directory,env,stdio:['pipe','pipe','pipe']});
  let pending,buffer='',id=0,bytes=0,stderrBytes=0,failure;
  const fail=e=>{failure??=e;pending?.reject(failure);pending=null;child.kill();};
  exitWait=new Promise(r=>child.once('exit',()=>{fail(Error('Probe exited'));r();}));
  child.on('error',()=>fail(Error('Probe launch failed')));
  child.stdin.on('error',()=>fail(Error('Probe input closed')));
  child.stderr.on('data',x=>stderrBytes+=x.length);
  child.stdout.on('data',chunk=>{
    bytes+=chunk.length;if(bytes>8*1024*1024)return fail(Error('Metadata byte limit'));
    buffer+=chunk.toString('utf8');let pos;
    while((pos=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,pos);buffer=buffer.slice(pos+1);if(!line.trim())continue;
      let m;try{m=JSON.parse(line);}catch{return fail(Error('Invalid metadata JSON'));}
      if(m.id!==undefined&&m.method)return fail(Error('Unexpected server request'));
      if(m.id!==undefined){if(!pending||m.id!==pending.id)return fail(Error('Unexpected response'));
        const p=pending;pending=null;m.error?p.reject(Error('Metadata request failed')):p.resolve(m.result);}
      if(m.method==='mcpServer/startupStatus/updated'&&['starting','ready'].includes(m.params?.status))return fail(Error('Unexpected MCP startup'));
    }
  });
  const call=(method,params)=>new Promise((resolve,reject)=>{if(failure)return reject(failure);pending={resolve,reject,id:++id};child.stdin.write(JSON.stringify({id,method,params})+'\n');});
  timer=setTimeout(()=>fail(Error('Metadata timeout')),25000);
  await call('initialize',{clientInfo:{name:'sovereign_skill_probe',version:'0.1.0'},capabilities:{experimentalApi:true}});
  child.stdin.write(JSON.stringify({method:'initialized',params:{}})+'\n');
  const listing=await call('skills/list',{cwds:['/home/cardeex'],forceReload:true});
  const matches=listing.data.flatMap(e=>e.skills).filter(s=>s.name==='sovereign-factory');
  if(matches.length!==1||!matches[0].enabled||matches[0].path!==join(codexHome,'skills/sovereign-factory/SKILL.md'))throw Error('Expected one enabled Sovereign skill');
  const skill=matches[0],body=await readFile(skill.path);
  const result={capturedAt:new Date().toISOString(),scope:'Local Codex skills/list discovery only; no inference or assurance of selection in every current chat.',skill:{name:skill.name,path:skill.path,scope:skill.scope,enabled:skill.enabled,sha256:createHash('sha256').update(body).digest('hex')},requestMethods:['initialize','skills/list'],inferences:0,stderrBytes};
  await writeFile(resolve(output),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
  process.stdout.write(JSON.stringify(result)+'\n');
} finally {
  clearTimeout(timer);
  if(child){child.stdin.end();child.kill();const killer=setTimeout(()=>child.kill('SIGKILL'),2000);await exitWait;clearTimeout(killer);}
  await rm(directory,{recursive:true,force:true});
}
