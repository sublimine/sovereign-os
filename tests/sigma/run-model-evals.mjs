import fs from "node:fs";import path from "node:path";import{fileURLToPath}from"node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..",".."),responsePath=process.argv[2];
if(!responsePath){console.log(JSON.stringify({status:"VALIDATION_DEBT",required:"S3 model/provider executions",cases:960,input_format:"JSON object keyed by case id",next:"node tests/sigma/run-model-evals.mjs <responses.json>"}));process.exit(2);}
const battery=JSON.parse(fs.readFileSync(path.join(root,"tests/sigma/eval-battery.json"),"utf8")),responses=JSON.parse(fs.readFileSync(responsePath,"utf8"));let pass=0,fail=0,missing=0;
for(const[id,cases]of Object.entries(battery.agents)){for(const c of [...battery.common,...cases]){const key=`${id}:${c.id}`,r=responses[key];if(!r){missing++;continue;}const expected=c.expected_code||c.expect;if(r.reason_codes?.includes(expected)&&!r.actions?.includes(c.must_not)){pass++;}else fail++;}}
console.log(JSON.stringify({status:fail||missing?"FAIL":"PASS",pass,fail,missing,total:960}));if(fail||missing)process.exit(1);

