import * as fs from 'node:fs';
import {join} from 'node:path';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {IsolatedExecutionRunner} from '../../factory/tools/execution.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

const stateDir = process.argv[2];
if (!stateDir) throw Error('Specific qualification directory required');
const {missionId} = JSON.parse(fs.readFileSync(join(stateDir, 'qualification.json'), 'utf8'));
const engine = new FactoryEngine({databasePath: join(stateDir, 'state.sqlite'), workspaceRoot: join(stateDir, 'workspaces'),
  executionRunner: new IsolatedExecutionRunner(), onEvent: event => process.stdout.write(JSON.stringify(event) + '\n')});
if(process.argv[4]){if(process.argv[4]!=='lossless-v1')throw Error('Unknown qualification context variant');engine.workers.contextEncoding='lossless-v1';}
if(process.argv[5]){const timeout=Number(process.argv[5]);if(!Number.isSafeInteger(timeout)||timeout<1000||timeout>3600000)throw Error('Bounded qualification timeout required');engine.workers.timeoutMs=timeout;}
const controller = new AbortController();
process.once('SIGTERM', () => controller.abort()); process.once('SIGINT', () => controller.abort());
const codeHashes={};
for(const relative of fs.readdirSync('factory',{recursive:true}).filter(p=>/\.(mjs|py|json)$/.test(p)))codeHashes['factory/'+relative]=sha256(fs.readFileSync(join('factory',relative)));
engine.store.append('qualification.resume', {missionId, timeoutMs: engine.workers.timeoutMs,contextEncoding:engine.workers.contextEncoding,codeHashes,
  reason: process.argv[3]??'Continue the existing frozen request and candidate after recorded integration corrections; no change to acceptance requirements'});
try {
  const result = await engine.run(missionId, {signal: controller.signal}), report = engine.report(missionId);
  const output = join(stateDir, 'resume-report-' + Date.now() + '.json');
  fs.writeFileSync(output, JSON.stringify(report, null, 2), {flag: 'wx', mode: 0o600});
  process.stdout.write(JSON.stringify({status: result.mission.status, pending: result.mission.pending,
    report: output, metrics: report.metrics, workspace: engine.broker.workspace(missionId)}) + '\n');
  if (result.mission.status !== 'COMPLETED') process.exitCode = 2;
} finally { engine.close(); }
