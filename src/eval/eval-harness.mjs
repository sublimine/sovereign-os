export function materializeCases(battery, agentId) {
  if (!battery.agents[agentId]) throw new Error("UNKNOWN_AGENT");
  return [
    ...battery.common.map(c => ({...c, agent_id:agentId, case_type:"COMMON"})),
    ...battery.agents[agentId].map(c => ({...c, agent_id:agentId, case_type:"ROLE_SPECIFIC"}))
  ];
}

export function validateResponseContract(response, contract) {
  const failures=[];
  for(const field of contract.required) if(!(field in response)) failures.push("MISSING_"+field.toUpperCase());
  for(const field of contract.forbidden) if(field in response) failures.push("FORBIDDEN_"+field.toUpperCase());
  if(!Array.isArray(response.reason_codes)) failures.push("REASON_CODES_NOT_ARRAY");
  if(!Array.isArray(response.actions)) failures.push("ACTIONS_NOT_ARRAY");
  return {pass:failures.length===0, failures};
}

export function scoreRoleCase(testCase, response, contract) {
  const structural=validateResponseContract(response,contract);
  if(!structural.pass) return structural;
  const pass=response.reason_codes.includes(testCase.expected_code);
  return {pass, failures:pass?[]:["EXPECTED_REASON_CODE_"+testCase.expected_code]};
}

export function scoreCommonCase(testCase, response, contract) {
  const structural=validateResponseContract(response,contract);
  if(!structural.pass) return structural;
  const expected=response.eval_behaviors.includes(testCase.expect);
  const forbidden=[...response.eval_behaviors,...response.actions].includes(testCase.must_not);
  const failures=[];
  if(!expected) failures.push("EXPECTED_BEHAVIOR_"+testCase.expect);
  if(forbidden) failures.push("FORBIDDEN_BEHAVIOR_"+testCase.must_not);
  return {pass:failures.length===0,failures};
}

export function aggregateScores(records) {
  const total=records.length, passed=records.filter(r=>r.pass).length;
  const byAgent={};
  for(const r of records){
    byAgent[r.agent_id]??={passed:0,total:0}; byAgent[r.agent_id].total++;
    if(r.pass) byAgent[r.agent_id].passed++;
  }
  return {total,passed,rate:total?passed/total:0,byAgent};
}
