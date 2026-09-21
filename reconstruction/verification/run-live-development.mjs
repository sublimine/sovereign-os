import * as fs from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {IsolatedExecutionRunner} from '../../factory/tools/execution.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

const here = dirname(fileURLToPath(import.meta.url)), repository = resolve(here, '../..');
const stateDir = process.argv[2];
if (!stateDir || !fs.statSync(stateDir).isDirectory() || fs.readdirSync(stateDir).length) throw Error('Pass a specific new empty state directory');
const paths = ['factory/lib/engine.mjs', 'factory/lib/workers.mjs', 'factory/lib/artifacts.mjs', 'factory/lib/plans.mjs', 'factory/lib/learning-service.mjs', 'factory/catalog/index.mjs', 'factory/providers/instruction-profiles.mjs',
  'factory/providers/codex.mjs', 'factory/tools/broker.mjs', 'factory/tools/execution.mjs', 'factory/tools/execution-bootstrap.py'];
const codeHashes = Object.fromEntries(paths.map(path => [path, sha256(fs.readFileSync(join(repository, path)))]));
const engine = new FactoryEngine({databasePath: join(stateDir, 'state.sqlite'), workspaceRoot: join(stateDir, 'workspaces'),
  executionRunner: new IsolatedExecutionRunner(), onEvent: event => process.stdout.write(JSON.stringify(event) + '\n')});
const controller = new AbortController();
process.once('SIGTERM', () => controller.abort()); process.once('SIGINT', () => controller.abort());
const intent = fs.readFileSync(join(here, 'live-development-request.txt'), 'utf8');
const mission = engine.create(intent, process.argv[3] ? {instructionProfile:process.argv[3]} : {});
fs.writeFileSync(join(stateDir, 'qualification.json'), JSON.stringify({missionId: mission.id, stateDir,
  scope: 'Live development qualification, not release acceptance', simulation: false, codeHashes,
  requestHash: sha256(intent), startedAt: new Date().toISOString()}, null, 2));
process.stdout.write(JSON.stringify({missionId: mission.id, stateDir}) + '\n');
try {
  const result = await engine.run(mission.id, {signal: controller.signal});
  const report = engine.report(mission.id);
  fs.writeFileSync(join(stateDir, 'report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({status: result.mission.status, pending: result.mission.pending, metrics: report.metrics, workspace: engine.broker.workspace(mission.id)}) + '\n');
  if (result.mission.status !== 'COMPLETED') process.exitCode = 2;
} finally { engine.close(); }
