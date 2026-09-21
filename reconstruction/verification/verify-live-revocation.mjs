// Real public HTTP transport; revoke locally at its asynchronous return boundary.
// No model inference, paid API, credentials, private query or delivered source.
import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ToolBroker,nodeTransport} from '../../factory/tools/broker.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

const directory=process.argv[2];
if(!directory||!fs.statSync(directory).isDirectory()||fs.readdirSync(directory).length)throw Error('Specific new empty qualification directory required');
const store=new Store(join(directory,'state.sqlite')),authority=new Authority(store);
let lease,networkCalls=0,observedResponse=null;
const broker=new ToolBroker({store,authority,workspaceRoot:join(directory,'workspaces'),transport:async options=>{
  networkCalls++;
  const response=await nodeTransport(options);
  observedResponse={httpStatus:response.statusCode,bytes:response.body.length,bodyHash:sha256(response.body)};
  authority.revoke(lease.data.id,'Qualification: revoke after actual response, before acquisition publication');
  return response;
}});
const issue=()=>authority.issue({missionId:'mission:live-revocation',principalId:'worker:live-revocation',actions:['source.fetch'],resources:['public-web'],classification:'PUBLIC',expiresAt:new Date(Date.now()+60000).toISOString()});
const url='https://www.sqlite.org/foreignkeys.html';
try {
  lease=issue();
  const request={missionId:'mission:live-revocation',principalId:'worker:live-revocation',lease,operationId:'operation:live-revocation',tool:'source.fetch',args:{url}};
  const signed=await broker.execute(request),receipt=authority.open(signed,'tool.receipt');
  const afterFirst=networkCalls,replayed=await broker.execute({...request,lease:issue()});
  const checks={realHttpResponse:observedResponse?.httpStatus===200&&observedResponse.bytes>0,
    deniedAtCompletion:receipt.status==='FAILED'&&receipt.result.error?.code==='LEASE_REVOKED',
    noContentReleased:!Object.hasOwn(receipt.result,'content'),
    durableFailure:store.get('effect',request.operationId).data.state==='FAILED',
    identicalReplay:sha256(signed)===sha256(replayed),noSecondRequest:afterFirst===1&&networkCalls===afterFirst,
    noAdmittedSource:store.list('source').length===0};
  const result={capturedAt:new Date().toISOString(),stateDir:resolve(directory),url,
    scope:'One real public HTTPS GET with local deterministic revocation at completion. No inference. Not a general networking or safety certificate.',
    brokerHash:sha256(fs.readFileSync('factory/tools/broker.mjs')),observedResponse,networkCalls,checks,passed:Object.values(checks).every(Boolean),receipt};
  fs.writeFileSync(join(directory,'summary.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
  process.stdout.write(JSON.stringify({passed:result.passed,checks,networkCalls,observedResponse})+'\n');
  if(!result.passed)process.exitCode=2;
}finally{store.close();}
