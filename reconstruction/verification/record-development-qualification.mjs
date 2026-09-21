import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {IsolatedExecutionRunner} from '../../factory/tools/execution.mjs';
import {sha256,canonical} from '../../factory/lib/contracts.mjs';
const [stateDir,oracleDirectory,output]=process.argv.slice(2);
if(!stateDir||!oracleDirectory||!output)throw Error('Exact state directory, completed external oracle directory and new evidence output required');
const {missionId}=JSON.parse(fs.readFileSync(join(stateDir,'qualification.json'),'utf8'));
const oracle=JSON.parse(fs.readFileSync(join(oracleDirectory,'summary.json'),'utf8'));
if(!oracle.passed||oracle.exitCode!==0||!oracle.unchanged||oracle.total!==174||oracle.failures.length)throw Error('External graph oracle is not passed');
if(sha256(fs.readFileSync(join(oracleDirectory,'execution.json')))!==oracle.executionHash){
  // Original oracle hashes canonical parsed JSON, not presentation whitespace.
  if(sha256(JSON.parse(fs.readFileSync(join(oracleDirectory,'execution.json'),'utf8')))!==oracle.executionHash)throw Error('External execution evidence changed');
}
const engine=new FactoryEngine({databasePath:join(stateDir,'state.sqlite'),workspaceRoot:join(stateDir,'workspaces'),executionRunner:new IsolatedExecutionRunner()});
try{
  const before=engine.report(missionId);
  if(before.mission.status!=='COMPLETED'||!before.final)throw Error('Actual development mission is not complete');
  const reentry=await engine.run(missionId),report=engine.report(missionId);
  if(reentry.mission.status!=='COMPLETED'||canonical(before.metrics)!==canonical(report.metrics)||before.effects.length!==report.effects.length)throw Error('Completed reentry did not preserve calls/effects');
  const artifact=engine.registry.assertUsable(report.final.id,{missionId,purpose:report.final.payload.purpose});
  const reviewer=engine.store.get('review',artifact.reviews.at(-1)).data,reviewRun=engine.store.get('run',reviewer.reviewerRunId).data;
  const command=['node','--test','graph.test.mjs'];
  const receiptMatches=r=>r.tool==='execution.run'&&r.status==='SUCCEEDED'&&r.result.exitCode===0&&r.result.cwd==='.'&&canonical(r.result.argv)===canonical(command)&&r.result.simulation===false;
  const producer=artifact.payload.toolReceipts.map(s=>engine.registry.verifiedToolReceipt(s)).find(receiptMatches);
  const independent=engine.registry.getToolObservations(reviewRun.id).find(o=>o.principalId===reviewRun.id&&receiptMatches(o));
  if(!producer||!independent||producer.principalId===independent.principalId||producer.result.snapshotHash!==independent.result.snapshotHash)throw Error('Exact independent paired executions absent');
  const workspace=engine.broker.workspace(missionId),files=oracle.candidateFiles.map(f=>({path:f.path,sha256:sha256(fs.readFileSync(join(workspace,f.path)))}));
  if(canonical(files)!==canonical(oracle.candidateFiles))throw Error('Accepted files differ from externally tested files');
  const snapshot=engine.broker.executionSnapshot(missionId);
  if(snapshot.hash!==independent.result.snapshotHash)throw Error('Final workspace snapshot changed');
  const result={capturedAt:new Date().toISOString(),scope:'Actual subscription development: accepted plan, produced files, actual producer execution, independent reread/rerun and review, completed same candidate. External 174-case oracle matches exact accepted bytes. Does not certify full factory, worldwide superiority, arbitrary graphs or efficiency.',
    missionId,stateDir:resolve(stateDir),workspace,artifactId:artifact.id,artifactHash:artifact.payloadHash,reviewId:reviewer.id,reviewerRunId:reviewRun.id,
    files,snapshotHash:snapshot.hash,requiredEffects:artifact.payload.requiredEffects,
    executions:{producer:{id:producer.id,principalId:producer.principalId,completedAt:producer.result.completedAt},reviewer:{id:independent.id,principalId:independent.principalId,completedAt:independent.result.completedAt}},
    oracle:{directory:resolve(oracleDirectory),summaryHash:sha256(fs.readFileSync(join(oracleDirectory,'summary.json'))),casesHash:oracle.casesHash,total:oracle.total,passed:oracle.passed},
    metrics:report.metrics,checks:reviewer.result.checks.map(c=>({id:c.criterionId,verdict:c.verdict,evidenceKinds:[...new Set(c.evidence.map(e=>e.kind))]})),
    reviewRetry:engine.store.list('review-retry').filter(r=>r.data.missionId===missionId).map(r=>r.data),reentry:{completed:true,newInferences:0,newBrokerEffects:0}};
  fs.writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
  process.stdout.write(JSON.stringify({output,missionId,status:'COMPLETED',oracleCases:oracle.total,files:files.length,metrics:report.metrics})+'\n');
}finally{engine.close();}
