// Actual SIGKILL/SQLite boundaries; all model responses explicitly simulated.
import fs from 'node:fs';import {join} from 'node:path';
import {FactoryEngine} from '../../../factory/lib/engine.mjs';
import {captureProcessIdentity} from '../../../factory/lib/process-identity.mjs';
import {methodRecoveryIntent,methodRecoveryFixtureProvider} from './method-recovery-model.mjs';
const [directory,boundary]=process.argv.slice(2);
if(!directory||!['before-origin','after-origin','after-review','before-completion','after-completion'].includes(boundary))throw Error('Exact fixture arguments required');
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
engine.workers.providerFactory=methodRecoveryFixtureProvider('sim-child');
const m=engine.create(methodRecoveryIntent,{allowedTools:[],maxNodeAttempts:1,maxPlanAttempts:1,
  methodRecovery:{mode:'reviewed-method-v1',maxRounds:1},inferenceBudget:{mode:'mission-calls-v1',maxCalls:8}});
fs.writeFileSync(join(directory,'fixture.json'),JSON.stringify({missionId:m.id,owner:captureProcessIdentity(),boundary}),{flag:'wx',mode:0o600});
const kill=()=>process.kill(process.pid,'SIGKILL'),append=engine.store.append.bind(engine.store),install=engine.ledger.install.bind(engine.ledger);
engine.store.append=(kind,data)=>{
  if(boundary==='before-origin'&&kind==='record.committed'&&data.type==='method-recovery-round')kill();
  if(boundary==='before-completion'&&kind==='record.committed'&&data.type==='method-recovery-completion')kill();
  if(boundary==='after-origin'&&kind==='mission.status'&&data.status==='PLANNING'&&engine.store.list('method-recovery-round').length)kill();
  if(boundary==='after-completion'&&kind==='planning.accepted'&&engine.store.list('method-recovery-completion').length)kill();
  return append(kind,data);
};
engine.ledger.install=(...args)=>{if(boundary==='after-review'&&engine.store.list('method-recovery-round').length)kill();return install(...args);};
const result=await engine.run(m.id);throw Error('Expected controlled SIGKILL was not reached: '+JSON.stringify(result.mission.pending));
