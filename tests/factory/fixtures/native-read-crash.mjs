// Isolated crash fixture. NEVER a live inference or the installed service.
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {FactoryEngine} from '../../../factory/lib/engine.mjs';
import {runBoundedReadEntry} from '../../../factory/lib/bounded-read-entry.mjs';
import {BOUNDED_READ_MODE} from '../../../factory/lib/bounded-read-spec.mjs';
import {NATIVE_READ_PROFILE,NATIVE_READ_TOOL_BINDING} from '../../../factory/providers/native-read-policy.mjs';
import {inferenceRequestHash,instructionProfile} from '../../../factory/providers/instruction-profiles.mjs';
import {canonical,sha256} from '../../../factory/lib/contracts.mjs';

const [directory,boundary]=process.argv.slice(2);
if(!directory||!['BEFORE_CALL_COMMIT','AFTER_CALL_COMMIT','PREPARED','DISPATCH_INTENT','ACKNOWLEDGED','COMPLETED','OUTCOME'].includes(boundary))throw Error('Invalid crash fixture');
const e=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'jobs')});
const mission=e.create('Read input.txt and derive the sum from only its supplied integers.',{entryMode:BOUNDED_READ_MODE,
  nativeReadTransport:NATIVE_READ_PROFILE,instructionProfile:'scoped-v1',allowedTools:['workspace.read'],inferenceBudget:{mode:'mission-calls-v1',maxCalls:3}});
writeFileSync(join(e.broker.registerWorkspace(mission.id).path,'input.txt'),'13\n17\n');
const crash=at=>{if(boundary===at)process.kill(process.pid,'SIGKILL');};
const put=e.store.put.bind(e.store);
e.store.put=(type,...args)=>{const r=put(type,...args);if(type==='native-read-continuation')crash('BEFORE_CALL_COMMIT');return r;};
const execute=e.broker.execute.bind(e.broker);
e.broker.execute=async request=>{crash('AFTER_CALL_COMMIT');return execute(request);};
e.workers.providerFactory=()=>{throw Error('No planner or reviewer may run in the crash fixture');};
e.workers.nativeProviderFactory=()=>({async generate(request){
  const s=request.nativeSession,ids={threadId:'crash-sim-thread',turnId:'crash-sim-turn'},callId='crash-sim-call';
  s.bind(ids);
  const prepared=await s.prepare({...ids,callId,namespace:NATIVE_READ_TOOL_BINDING.namespace,tool:NATIVE_READ_TOOL_BINDING.name,arguments:{path:'input.txt'}});
  crash('PREPARED');const p=prepared.frames.at(-1).event;
  s.dispatch({callId,responseHash:sha256(p.responseJson)});crash('DISPATCH_INTENT');
  s.ack({...ids,callId,responseJson:p.responseJson});crash('ACKNOWLEDGED');
  const value={action:'final',tool:'',argsJson:'',body:'13 + 17 = 30.',claims:[],method:'fixture-sum',reason:''};
  await request.validate(value);const transcript=s.finish({...ids,outputJson:canonical(value)});crash('COMPLETED');
  const receipt={kind:'inference',simulation:true,status:'completed',...ids,contextHash:inferenceRequestHash(request),toolPolicy:NATIVE_READ_PROFILE,
    nativeTranscript:{schema:transcript.schema,head:transcript.head,callbackCount:1},instructionProfile:{id:NATIVE_READ_PROFILE,hash:instructionProfile(NATIVE_READ_PROFILE).hash}};
  s.retainOutcome({value,receipt});crash('OUTCOME');throw Error('Crash point was not reached');
},async close(){return {processExitObserved:true};}});
await runBoundedReadEntry(e,mission);throw Error('Unexpected fixture completion');
