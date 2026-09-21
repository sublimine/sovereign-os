import {setTimeout as delay} from 'node:timers/promises';
import {captureProcessIdentity,ownerProcessIsAlive} from './process-identity.mjs';
import {check,id,identifier,integer,sha256,clone,timestamp} from './contracts.mjs';
import {inputSubmissionFingerprint} from './mission-inputs.mjs';

/** Local durable inbox, no HTTP listener, new cloud task or provider bypass.
 * Only this trusted coordinator can change queue state. Model proposals never
 * receive the Store. A process that is merely slow is never evicted by expiry.
 */
export class MissionQueue {
  constructor({engine,clock=timestamp,pollMs=1000,retryBaseMs=300000,retryMaxMs=3600000,maxAutomaticRetries=12}={}) {
    check(engine?.store&&typeof engine.run==='function','CONFIG','Trusted engine required');
    for(const [k,v] of Object.entries({pollMs,retryBaseMs,retryMaxMs,maxAutomaticRetries}))integer(v,k,{min:1});
    check(retryMaxMs>=retryBaseMs,'CONFIG','Retry cap cannot be below initial delay');
    Object.assign(this,{engine,store:engine.store,clock,pollMs,retryBaseMs,retryMaxMs,maxAutomaticRetries});
    this.owner=null;this.running=false;
  }
  submit(intent,options={},requestId=id('submission')) {
    identifier(requestId); const fingerprint=inputSubmissionFingerprint(intent,options,this.engine.broker);
    return this.store.transact(()=>{
      const existing=this.store.get('submission',requestId);
      if(existing){check(existing.data.fingerprint===fingerprint,'SUBMISSION_CONFLICT','Submission ID already binds another request');return this.get(existing.data.missionId);}
      const mission=this.engine.create(intent,options),createdAt=this.clock();
      const record=this.store.put('queue-job',mission.id,{missionId:mission.id,status:'QUEUED',desired:'RUN',createdAt,updatedAt:createdAt,
        attempts:0,automaticRetries:0,nextAttemptAt:createdAt,lastMissionStatus:'NEW',lastCode:null},{expectedVersion:0});
      this.store.put('submission',requestId,{missionId:mission.id,fingerprint},{expectedVersion:0});return record.data;
    });
  }
  get(missionId){identifier(missionId);const job=this.store.get('queue-job',missionId);check(job,'NOT_FOUND','Queued mission not found');return job.data;}
  list(){return this.store.list('queue-job').map(r=>r.data).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.missionId.localeCompare(b.missionId));}
  // Queue records are coordinator-owned state, not an operator command API.
  // Exposing this as a public mutator let callers write COMPLETED independently
  // of the authenticated mission result and silently suppress execution.
  #update(missionId,changes){const r=this.store.get('queue-job',missionId);check(r,'NOT_FOUND','Queued mission not found');return this.store.put('queue-job',missionId,{...r.data,...clone(changes),updatedAt:this.clock()},{expectedVersion:r.version}).data;}
  request(missionId,action) {
    check(['pause','continue','cancel'].includes(action),'QUEUE_CONTROL','Unknown queue control');
    return this.store.transact(()=>{
      const job=this.get(missionId),mission=this.engine.status(missionId).mission;
      check(!['COMPLETED','CANCELLED'].includes(mission.status)&&!['COMPLETED','CANCELLED'].includes(job.status),'QUEUE_TERMINAL','Terminal job cannot be restarted through queue control');
      const desired={pause:'PAUSE',continue:'RUN',cancel:'CANCEL'}[action];
      if(job.status==='RUNNING')return this.#update(missionId,{desired});
      if(desired==='CANCEL')this.engine.setStatus(missionId,'CANCELLED',[{code:'OWNER_CANCELLED',reason:'Cancelled from the local queue before further execution'}]);
      return this.#update(missionId,{desired,status:desired==='RUN'?'QUEUED':desired==='PAUSE'?'PAUSED':'CANCELLED',
        ...(desired==='RUN'?{nextAttemptAt:this.clock(),automaticRetries:0}:{} )});
    });
  }
  acquire() {
    return this.store.transact(()=>{
      const old=this.store.get('queue-owner','exclusive');
      check(!old?.data.ownerId||!ownerProcessIsAlive(old.data),'QUEUE_BUSY','A live or unverified legacy queue coordinator already owns this inbox');
      const owner={ownerId:id('queue-owner'),pid:process.pid,processIdentity:captureProcessIdentity(),epoch:(old?.data.epoch??0)+1,acquiredAt:this.clock()};
      this.store.put('queue-owner','exclusive',owner,{expectedVersion:old?.version??0});this.owner=owner;return owner;
    });
  }
  assertOwner(){const owner=this.store.get('queue-owner','exclusive')?.data;check(this.owner&&owner?.ownerId===this.owner.ownerId&&owner.epoch===this.owner.epoch,'QUEUE_OWNERSHIP','Current exclusive queue owner required');}
  release(){this.store.transact(()=>{this.assertOwner();const old=this.store.get('queue-owner','exclusive');this.store.put('queue-owner','exclusive',{...old.data,ownerId:null,releasedAt:this.clock()},{expectedVersion:old.version});this.owner=null;});}
  recover() {
    this.assertOwner();
    for(const job of this.list().filter(j=>j.status==='RUNNING')) {
      const mission=this.engine.status(job.missionId).mission;
      if(['COMPLETED','CANCELLED'].includes(mission.status))this.#update(job.missionId,{status:mission.status,lastMissionStatus:mission.status});
      else if(job.desired==='CANCEL'){this.engine.setStatus(job.missionId,'CANCELLED',[{code:'OWNER_CANCELLED',reason:'Durable cancellation retained after coordinator restart'}]);this.#update(job.missionId,{status:'CANCELLED'});}
      else this.#update(job.missionId,{status:job.desired==='PAUSE'?'PAUSED':'QUEUED',nextAttemptAt:this.clock(),lastCode:'COORDINATOR_RESTART'});
    }
  }
  #finish(missionId,result,{shutdown=false}={}) {
    this.assertOwner(); const job=this.get(missionId),mission=result.mission,code=mission.pending[0]?.code??null;
    const common={lastMissionStatus:mission.status,lastCode:code};
    if(['COMPLETED','CANCELLED'].includes(mission.status))return this.#update(missionId,{...common,status:mission.status});
    if(job.desired==='CANCEL'){
      this.engine.setStatus(missionId,'CANCELLED',[...mission.pending,{code:'OWNER_CANCELLED',reason:'Durable owner cancellation; existing effect records remain preserved'}]);
      return this.#update(missionId,{...common,status:'CANCELLED',lastMissionStatus:'CANCELLED'});
    }
    if(job.desired==='PAUSE')return this.#update(missionId,{...common,status:'PAUSED'});
    // A graceful service shutdown is not cancellation and costs no retry budget.
    if(shutdown&&mission.status==='PAUSED')return this.#update(missionId,{...common,status:'QUEUED',nextAttemptAt:this.clock()});
    if(['WAITING_QUOTA','WAITING_PROVIDER'].includes(mission.status)||mission.status==='FAILED'&&code==='TIMEOUT') {
      const automaticRetries=job.automaticRetries+1;
      if(automaticRetries<=this.maxAutomaticRetries){
        const waitMs=Math.min(this.retryMaxMs,this.retryBaseMs*2**Math.min(automaticRetries-1,30));
        return this.#update(missionId,{...common,status:'RETRY_WAIT',automaticRetries,nextAttemptAt:new Date(Date.parse(this.clock())+waitMs).toISOString()});
      }
      return this.#update(missionId,{...common,status:'WAITING',automaticRetries,lastCode:'AUTOMATIC_RETRY_BUDGET'});
    }
    // Missing authority, uncertain effects and exhausted quality criteria must
    // stay visible. They are not healed by a timer or by more blind attempts.
    return this.#update(missionId,{...common,status:'WAITING'});
  }
  async runNext({signal}={}) {
    this.assertOwner();check(!this.currentJob,'QUEUE_BUSY','A queue operation is already in flight');if(signal?.aborted)return null;
    const job=this.list().find(j=>j.desired==='RUN'&&['QUEUED','RETRY_WAIT'].includes(j.status)&&Date.parse(j.nextAttemptAt)<=Date.parse(this.clock()));
    if(!job)return null;
    this.currentJob=job.missionId;
    this.#update(job.missionId,{status:'RUNNING',attempts:job.attempts+1});
    const controller=new AbortController(),shutdown=()=>controller.abort();signal?.addEventListener('abort',shutdown,{once:true});
    if(signal?.aborted)shutdown();
    const poll=()=>{
      this.assertOwner(); const current=this.get(job.missionId);
      if(current.desired==='CANCEL'&&this.engine.active?.missionId===job.missionId)this.engine.cancel(job.missionId);
      else if(current.desired==='PAUSE')controller.abort();
    };
    let pollError;const timer=setInterval(()=>{try{poll();}catch(e){pollError=e;controller.abort();}},this.pollMs);
    try {
      const result=await this.engine.run(job.missionId,{signal:controller.signal,pauseOnAbort:true});
      if(pollError)throw pollError;
      return this.#finish(job.missionId,result,{shutdown:Boolean(signal?.aborted)});
    } catch(error) {
      if(error.code==='ENGINE_BUSY')return this.#update(job.missionId,{status:'QUEUED',lastCode:'ENGINE_BUSY',nextAttemptAt:new Date(Date.parse(this.clock())+5000).toISOString()});
      this.#update(job.missionId,{status:'WAITING',lastCode:error.code??'INTERNAL'});throw error;
    } finally {clearInterval(timer);signal?.removeEventListener('abort',shutdown);this.currentJob=null;}
  }
  async serve({signal}={}) {
    check(!this.running,'QUEUE_BUSY','This coordinator is already running');this.acquire();this.running=true;
    try {
      this.recover();
      while(!signal?.aborted){const result=await this.runNext({signal});if(!result)try{await delay(this.pollMs,undefined,{signal});}catch(e){if(e.name!=='AbortError')throw e;}}
    } finally {this.running=false;this.release();}
  }
}
