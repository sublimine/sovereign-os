import * as fs from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {MissionQueue} from '../../factory/lib/queue.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
const stateDir='/home/cardeex/.local/state/sovereign-factory',missionId='mission:78afdee6-1b1c-4b97-a68e-bdbce1d0bb86',output=process.argv[2];
if(!output)throw Error('Explicit new evidence output file required');
const engine=new FactoryEngine({databasePath:join(stateDir,'state.sqlite'),workspaceRoot:join(stateDir,'workspaces')});
try{
  const report=engine.report(missionId),queue=new MissionQueue({engine}).get(missionId);
  if(report.mission.status!=='COMPLETED'||queue.status!=='COMPLETED'||report.final?.payload.body!=='42'||report.effects.length||report.metrics.liveCompleted!==report.metrics.completed)throw Error('Real queue qualification outcome has not passed');
  engine.registry.assertUsable(report.final.id,{missionId,purpose:report.final.payload.purpose});
  const service=execFileSync('systemctl',['--user','show','sovereign-factory.service','-p','ActiveState','-p','SubState','-p','MainPID','-p','UnitFileState','-p','NRestarts'],{encoding:'utf8'});
  const linger=execFileSync('loginctl',['show-user','cardeex','-p','Linger','-p','State'],{encoding:'utf8'});
  const result={capturedAt:new Date().toISOString(),scope:'Actual submit→user service→plan→candidate→independent runtime-evidence review→COMPLETED. Includes the earlier missing-operational-evidence failure and correction. Does not certify complete factory, efficiency, or multi-day uptime.',
    missionId,stateDir,queue,service,linger,unitSha256:sha256(fs.readFileSync('/home/cardeex/.config/systemd/user/sovereign-factory.service')),
    body:'42',artifactId:report.final.id,artifactHash:report.final.payloadHash,metrics:report.metrics,reviewCount:report.reviews.length,effectCount:report.effects.length,
    runtimeObservations:engine.store.list('runtime-observation').filter(r=>r.data.signed.data.missionId===missionId).map(r=>({id:r.id,hash:sha256(r.data.signed),kind:r.data.signed.data.kind})),
    checks:report.reviews.find(r=>r.artifactId===report.final.id&&r.result.decision==='ACCEPT')?.result.checks.map(c=>({id:c.criterionId,verdict:c.verdict,evidenceKinds:[...new Set(c.evidence.map(e=>e.kind))]}))};
  fs.writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});process.stdout.write(JSON.stringify({output,missionId,body:result.body,metrics:result.metrics,service,linger})+'\n');
}finally{engine.close();}
