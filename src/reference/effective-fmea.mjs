export function buildEffectiveFmea(config,battery,agentId){
  const cases=battery.agents[agentId], sequence=config.agent_profile_sequence[agentId];
  if(!cases||!sequence||cases.length!==sequence.length) throw new Error("FMEA_JOIN_MISMATCH");
  return cases.map((c,i)=>{
    const profile=config.profiles[sequence[i]];
    if(!profile) throw new Error("UNKNOWN_FMEA_PROFILE");
    return {id:"FMEA_"+c.id,failure:c.expected_code,detection:[c.stimulus],containment:profile.containment,recovery:profile.recovery,revalidation:[...profile.revalidation,"oracle:"+c.expected_code],escalation:profile.escalation};
  });
}

