import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {PublicSearch} from '../../factory/providers/public-search.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

const directory=process.argv[2],resuming=process.argv[3]==='--resume';
if(process.argv.length>4||process.argv[3]&&!resuming)throw Error('Usage: run-live-discovery.mjs DIRECTORY [--resume]');
if(!directory||!fs.statSync(directory).isDirectory()||(!resuming&&fs.readdirSync(directory).length))throw Error('Specific new empty qualification directory required, or explicit --resume of its recorded qualification');
if(fs.existsSync(join(directory,'summary.json'))||fs.existsSync(join(directory,'report.json')))throw Error('Qualification already has an outcome; do not overwrite it');
const intent='Investiga mediante una búsqueda web real y una fuente primaria de SQLite si se puede activar o desactivar la comprobación de claves foráneas con PRAGMA foreign_keys dentro de una transacción de varias sentencias ya iniciada. Descubre la URL, recupera su contenido y responde en español en un párrafo breve, con el enlace de la fuente, una cita literal corta y las salvedades relevantes de esa fuente. No inventes haber ejecutado SQLite: no ejecutes código ni crees archivos. Verifica los hechos después de adquirir la fuente y somete la respuesta a revisión independiente.';
const files=fs.readdirSync('factory',{recursive:true}).map(p=>'factory/'+p).filter(p=>fs.statSync(p).isFile()&&/\.(mjs|py|json)$/.test(p));
const currentHashes=Object.fromEntries(files.map(p=>[p,sha256(fs.readFileSync(p))]));
const prior=resuming?JSON.parse(fs.readFileSync(join(directory,'qualification.json'),'utf8')):null;
if(prior&&(prior.intent!==intent||sha256(prior.codeHashes)!==sha256(currentHashes)))throw Error('Resume requires the original intent and exact runtime file inventory');
const codeHashes=prior?.codeHashes??currentHashes;
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces'),searchProvider:new PublicSearch(),
  onEvent:e=>process.stdout.write(JSON.stringify(e)+'\n')});
const mission=prior?engine.store.get('mission',prior.missionId)?.data:engine.create(intent,{instructionProfile:'scoped-v1',allowedTools:['source.search','source.fetch']});
if(!mission||mission.intent!==intent)throw Error('Original qualification mission missing or changed');
if(!prior)fs.writeFileSync(join(directory,'qualification.json'),JSON.stringify({startedAt:new Date().toISOString(),missionId:mission.id,intent,codeHashes,
  scope:'Real subscription planning, discovery, public source acquisition and independent factual review. No paid API, file deliverable, code execution or deployment. One narrow qualification, not universal quality.'},null,2),{flag:'wx',mode:0o600});
const controller=new AbortController(),cancel=()=>controller.abort();process.once('SIGTERM',cancel);process.once('SIGINT',cancel);
try {
  const outcome=await engine.run(mission.id,{signal:controller.signal}),report=engine.report(mission.id);
  const effects=engine.store.list('effect').filter(r=>r.data.missionId===mission.id);
  const search=effects.find(r=>r.data.tool==='source.search'&&r.data.state==='SUCCEEDED'),fetches=effects.filter(r=>r.data.tool==='source.fetch'&&r.data.state==='SUCCEEDED');
  const sources=engine.store.list('source').filter(r=>r.data.missionId===mission.id),final=report.final;
  const sourceOrder=Boolean(search)&&fetches.length>0&&fetches.every(r=>engine.registry.committedSequence('effect',search.id,search.version)<engine.registry.committedSequence('effect',r.id,1));
  const acquiredBeforeCandidate=Boolean(final)&&sources.length>0&&sources.every(r=>engine.registry.committedSequence('source',r.id,1)<engine.registry.committedSequence('artifact',final.id,1));
  const primarySources=sources.every(r=>r.data.status==='ADMITTED'&&r.data.httpStatus===200&&['sqlite.org','www.sqlite.org'].includes(new URL(r.data.url).hostname));
  const before={calls:report.metrics.completed,searches:report.metrics.discovery.brokerAttempts,effects:effects.length};
  const repeat=outcome.mission.status==='COMPLETED'?await engine.run(mission.id):null,after=engine.report(mission.id);
  const noReplay=repeat?.mission.status==='COMPLETED'&&after.metrics.completed===before.calls&&after.metrics.discovery.brokerAttempts===before.searches&&after.effects.length===before.effects;
  const sourceUnchanged=files.every(p=>sha256(fs.readFileSync(p))===codeHashes[p]);
  const result={completedAt:new Date().toISOString(),stateDir:resolve(directory),missionId:mission.id,resumedAfterInterruption:resuming,status:outcome.mission.status,pending:outcome.mission.pending,
    checks:{sourceOrder,acquiredBeforeCandidate,primarySources,noReplay,sourceUnchanged,nativeSearchObserved:Boolean(search?.data.receipt.data.result.searchObservations.some(o=>o.actionType==='search')),
      noCodeOrFileEffects:effects.every(r=>['source.search','source.fetch'].includes(r.data.tool)),independentAcceptedFinal:final?.status==='ACCEPTED'},
    metrics:report.metrics,answer:final?.payload.body??null,sources:report.sources};
  result.passed=outcome.mission.status==='COMPLETED'&&Object.values(result.checks).every(v=>v===true);
  fs.writeFileSync(join(directory,'report.json'),JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
  fs.writeFileSync(join(directory,'summary.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
  process.stdout.write(JSON.stringify(result)+'\n');if(!result.passed)process.exitCode=2;
} finally {process.removeListener('SIGTERM',cancel);process.removeListener('SIGINT',cancel);engine.close();}
