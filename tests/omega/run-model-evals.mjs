import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {materializeCases,scoreRoleCase,scoreCommonCase,aggregateScores} from "../../src/eval/eval-harness.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","..");
const battery=JSON.parse(fs.readFileSync(path.join(root,"tests","omega","eval-battery-v2.json"),"utf8"));
const responsePath=process.argv[2];
if(!responsePath){
  console.log(JSON.stringify({status:"VALIDATION_DEBT",reason:"MODEL_RESPONSES_NOT_SUPPLIED",required_format:"array of {agent_id,case_id,response}",cases:576}));
  process.exit(2);
}
const rows=JSON.parse(fs.readFileSync(path.resolve(responsePath),"utf8"));
const scored=[];
for(const row of rows){
  const testCase=materializeCases(battery,row.agent_id).find(c=>c.id===row.case_id);
  if(!testCase) throw new Error("UNKNOWN_CASE "+row.agent_id+"/"+row.case_id);
  const result=testCase.case_type==="ROLE_SPECIFIC"?scoreRoleCase(testCase,row.response,battery.response_contract):scoreCommonCase(testCase,row.response,battery.response_contract);
  scored.push({...result,agent_id:row.agent_id,case_id:row.case_id});
}
console.log(JSON.stringify(aggregateScores(scored),null,2));
