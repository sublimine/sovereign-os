// Method-recovery records deliberately retain detailed rejected work, review
// findings and proposed instructions for the controller.  A public report is
// not entitled to replay that diagnostic corpus merely because the mission
// has a method-recovery policy.  This view exposes only a bounded, validated
// progress summary; detailed diagnoses remain behind the authenticated
// recovery contracts that consume them.
import {check,integer} from './contracts.mjs';
import {methodRecoveryReport} from './method-recovery.mjs';

const STATUSES=new Set(['INSTALLED_HISTORICALLY','PENDING']);

const unavailable=()=>({
  integrity:'UNVERIFIED',mode:null,maxRounds:null,reservedRounds:null,remainingRounds:null,rounds:[],
  scope:'Method-recovery evidence could not be revalidated. No rejected content, review finding, prior method, proposed method, actor, record reference or instruction is projected.'
});

/**
 * A small public progress surface for the opt-in recovery protocol.  It
 * validates the original recovery reader first, then copies only numeric
 * budget facts and finite lifecycle labels.  In particular, it never turns a
 * reviewer finding or model-written rationale into a report/CLI data channel.
 */
export function readPublicMethodRecovery(store,missionId){
  try{
    const internal=methodRecoveryReport(store,missionId);
    if(internal===null)return null;
    check(internal&&internal.mode==='reviewed-method-v1','PUBLIC_METHOD_RECOVERY','Unknown method-recovery mode');
    integer(internal.maxRounds,'public method-recovery maximum',{min:1,max:100});
    integer(internal.reservedRounds,'public method-recovery reservations',{min:0,max:internal.maxRounds});
    integer(internal.remainingRounds,'public method-recovery remaining',{min:0,max:internal.maxRounds});
    check(internal.reservedRounds+internal.remainingRounds===internal.maxRounds,'PUBLIC_METHOD_RECOVERY','Method-recovery budget does not balance');
    check(Array.isArray(internal.rounds)&&internal.rounds.length===internal.reservedRounds,
      'PUBLIC_METHOD_RECOVERY','Method-recovery round inventory does not match its budget');
    const rounds=internal.rounds.map((round,index)=>{
      integer(round?.round,'public method-recovery round',{min:1,max:100});
      check(round.round===index+1&&STATUSES.has(round.status),'PUBLIC_METHOD_RECOVERY','Method-recovery round sequence or status changed');
      return {round:round.round,status:round.status};
    });
    return {
      integrity:'VERIFIED',mode:internal.mode,maxRounds:internal.maxRounds,reservedRounds:internal.reservedRounds,
      remainingRounds:internal.remainingRounds,rounds,
      scope:'Verified progress summary for the bounded method-recovery protocol. It is not a certification of improvement or a disclosure of rejected products, review findings, methods, instructions, actor identities, record references or current external state.'
    };
  }catch{return unavailable();}
}
