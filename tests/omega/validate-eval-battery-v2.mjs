import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {materializeCases,scoreRoleCase,scoreCommonCase,aggregateScores} from "../../src/eval/eval-harness.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","..");
const battery=JSON.parse(fs.readFileSync(path.join(root,"tests","omega","eval-battery-v2.json"),"utf8"));
const catalog=JSON.parse(fs.readFileSync(path.join(root,"config","production-charters.json"),"utf8"));
const errors=[]; const ids=[];
if(battery.common.length!==16) errors.push("expected 16 common executable cases");
if(Object.keys(battery.agents).length!==24) errors.push("expected 24 role suites");
for(let i=1;i<=24;i++){
  const id="omega_"+String(i).padStart(2,"0"), cases=materializeCases(battery,id);
  if(cases.length!==24) errors.push(id+" effective case count "+cases.length);
  if(battery.agents[id].length!==8) errors.push(id+" specific case count not 8");
  for(const c of battery.common){
    const good={status:"RETURN",reason_codes:[],actions:[],artifact:{},eval_behaviors:[c.expect]};
    const bad={status:"COMPLETE",reason_codes:[],actions:[c.must_not],artifact:{},eval_behaviors:[]};
    if(!scoreCommonCase(c,good,battery.response_contract).pass) errors.push(id+"/"+c.id+" common oracle rejects good response");
    if(scoreCommonCase(c,bad,battery.response_contract).pass) errors.push(id+"/"+c.id+" common oracle accepts bad response");
  }
  const charter=fs.readFileSync(path.join(root,catalog.agents.find(a=>a.id===id).path),"utf8");
  for(const c of battery.agents[id]){
    ids.push(c.id);
    if(!c.stimulus || c.stimulus.length<20) errors.push(c.id+" stimulus shallow");
    if(!charter.includes(c.expected_code)) errors.push(c.id+" expected code absent from charter");
    const good={status:"RETURN",reason_codes:[c.expected_code],actions:[],artifact:{},eval_behaviors:[]};
    const bad={status:"COMPLETE",reason_codes:[],actions:[],artifact:{},eval_behaviors:[]};
    if(!scoreRoleCase(c,good,battery.response_contract).pass) errors.push(c.id+" oracle rejects good response");
    if(scoreRoleCase(c,bad,battery.response_contract).pass) errors.push(c.id+" oracle accepts bad response");
  }
}
if(new Set(ids).size!==192) errors.push("role case IDs not unique");
const summary=aggregateScores([{agent_id:"omega_01",pass:true},{agent_id:"omega_01",pass:false}]);
if(summary.rate!==0.5) errors.push("score aggregation wrong");
if(errors.length){console.error("EVAL BATTERY V2 VALIDATION FAILED");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("EVAL BATTERY V2 VALIDATION PASSED");
console.log(JSON.stringify({agents:24,common_per_agent:16,specific_per_agent:8,effective_cases:576,deterministic_oracles:576}));
