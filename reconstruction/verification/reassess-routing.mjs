// Post-run mechanical reassessment. NEVER edits the original grade or corpus.
import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {canonical,check,sha256} from '../../factory/lib/contracts.mjs';
import {ROUTING_CASES,gradeRouting} from './routing-cases.mjs';

export function coverageGaps(request,requirements,needle){
  const begin=request.indexOf(needle);
  if(begin<0||request.indexOf(needle,begin+1)>=0)return {covered:false,reason:'MISSING_OR_AMBIGUOUS_CLAUSE',gaps:[]};
  const covered=new Set();
  for(const r of requirements){
    if(typeof r.requestQuote!=='string'||!r.requestQuote)continue;
    const at=request.indexOf(r.requestQuote);if(at<0||request.indexOf(r.requestQuote,at+1)>=0)continue;
    for(let i=Math.max(at,begin);i<Math.min(at+r.requestQuote.length,begin+needle.length);i++)covered.add(i);
  }
  const gaps=[];
  for(let i=0;i<needle.length;i++)if(!covered.has(begin+i))gaps.push({offset:begin+i,character:needle[i],whitespace:/\s/u.test(needle[i])});
  return {covered:gaps.every(g=>g.whitespace),reason:gaps.length?'UNCOVERED_CHARACTERS':'EXACT_COVERAGE',gaps};
}
export function reassessRouting(directory){
  const inputs={};
  const read=path=>{const bytes=readFileSync(join(directory,path));inputs[path]=sha256(bytes);return JSON.parse(bytes);};
  const qualification=read('qualification.json'),original=read('summary.json');
  check(original.completedAt&&original.notRunCaseIds.length===0,'QUALIFICATION_ACTIVE','All original cases must have a final saved report');
  check(qualification.caseHash===sha256(readFileSync(new URL('./routing-cases.mjs',import.meta.url)))
    &&canonical(qualification.cases)===canonical(ROUTING_CASES),'GOLD_DRIFT','Original gold and baseline grader must remain unchanged');
  const results=ROUTING_CASES.map(c=>{
    const prior=read(c.id+'/summary.json'),plan=read(c.id+'/plan.json');
    check(canonical(gradeRouting(c,plan))===canonical(prior.grade),'ORIGINAL_GRADE','Cannot reproduce original frozen structural grade');
    const clauses=c.criticalQuotes.map(quote=>({quote,...coverageGaps(c.request,plan?.requirements??[],quote)}));
    const checks={...prior.checks,literalCriticalClausesCovered:clauses.every(q=>q.covered)};
    return {caseId:c.id,originalPassed:prior.passed,originalUncoveredQuotes:prior.grade.uncoveredQuotes,
      reassessedPassed:Object.values(checks).every(v=>v===true),checks,clauses,
      onlyChangedCheck:'literalCriticalClausesCovered; uncovered whitespace only. Punctuation, negations, numbers and every other character remain mandatory.'};
  });
  return {version:'routing-whitespace-reassessment-v1',createdAt:new Date().toISOString(),directory:resolve(directory),inputs,
    harnessHash:sha256(readFileSync(new URL(import.meta.url))),originalPassed:original.passed,results,
    reassessedStructuralPass:results.every(r=>r.reassessedPassed),semanticAudit:'PENDING',
    scope:'Post hoc mechanical correction, not a preregistered new experiment or semantic approval. Original files/FAIL and all other checks unchanged; no inference or product execution.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [directory,output]=process.argv.slice(2);check(directory&&output,'USAGE','Original finished directory and NEW output file required');
  const result=reassessRouting(directory);writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
  process.stdout.write(JSON.stringify({output,originalPassed:result.originalPassed,reassessedStructuralPass:result.reassessedStructuralPass,
    cases:result.results.map(r=>({caseId:r.caseId,originalPassed:r.originalPassed,reassessedPassed:r.reassessedPassed,remaining:r.clauses.filter(c=>!c.covered)}))})+'\n');
}
