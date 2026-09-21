// Read-only protocol metadata probe. Never emits account IDs, email, or credentials.
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
const p=spawn('/home/cardeex/.local/bin/codex',['app-server','--stdio'],{stdio:['pipe','pipe','pipe']});
let id=0;const pending=new Map();let stderrBytes=0;p.stderr.on('data',x=>stderrBytes+=x.length);
const lines=createInterface({input:p.stdout});
lines.on('line',line=>{let m;try{m=JSON.parse(line);}catch{return;}if(pending.has(m.id)){const cb=pending.get(m.id);pending.delete(m.id);m.error?cb.reject(new Error(m.error.message)):cb.resolve(m.result);}else if(m.id!==undefined&&m.method)p.stdin.write(JSON.stringify({id:m.id,error:{code:-32601,message:'Read-only preflight denies server requests'}})+'\n');});
const call=(method,params)=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});p.stdin.write(JSON.stringify({id:n,method,params})+'\n');});
const timer=setTimeout(()=>{p.kill();process.exitCode=1;console.log(JSON.stringify({error:'metadata timeout',stderrBytes}));},25000);
try{
 const init=await call('initialize',{clientInfo:{name:'sovereign_preflight',version:'0.0.1'}});
 p.stdin.write(JSON.stringify({method:'initialized',params:{}})+'\n');
 const a=await call('account/read',{refreshToken:false});
 console.log(JSON.stringify({initialize:{platformFamily:init.platformFamily,platformOs:init.platformOs},account:{type:a.account?.type??null,planType:a.account?.planType??null,requiresOpenaiAuth:a.requiresOpenaiAuth}}));
 const rates=await call('account/rateLimits/read',null);
 const cleanWindow=w=>w?{usedPercent:w.usedPercent,windowDurationMins:w.windowDurationMins,resetsAt:w.resetsAt}:null;
 const clean=r=>({limitId:r.limitId,planType:r.planType,primary:cleanWindow(r.primary),secondary:cleanWindow(r.secondary)});
 console.log(JSON.stringify({rateLimits:rates.rateLimits?clean(rates.rateLimits):null,rateLimitsByLimitId:Object.fromEntries(Object.entries(rates.rateLimitsByLimitId??{}).map(([k,v])=>[k,clean(v)]))}));
 const profiles=await call('permissionProfile/list',{cwd:process.cwd()});
 console.log(JSON.stringify({permissionProfiles:profiles}));
}catch(e){console.log(JSON.stringify({error:e.message}));process.exitCode=1;}finally{clearTimeout(timer);p.stdin.end();p.kill();lines.close();}
