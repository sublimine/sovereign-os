import test from 'node:test';
import assert from 'node:assert/strict';
import {coverageGaps} from '../../reconstruction/verification/reassess-routing.mjs';
const requirements=quotes=>quotes.map(requestQuote=>({requestQuote}));
test('reassessment accepts only uncovered whitespace between exact uniquely attributed clauses',()=>{
  const text='No ejecutes código ni crees archivos';
  const result=coverageGaps(text,requirements(['No ejecutes código','ni crees archivos']),text);
  assert.equal(result.covered,true);assert.deepEqual(result.gaps,[{offset:18,character:' ',whitespace:true}]);
});
test('reassessment never excuses omitted negation, changed digits or punctuation',()=>{
  for(const [text,quotes]of [['No crees archivos',['crees archivos']],['Usa 12 filas',['Usa','filas']],['A, B',['A','B']]])
    assert.equal(coverageGaps(text,requirements(quotes),text).covered,false);
});
test('invalid, paraphrased or ambiguously located source quotes cannot establish coverage',()=>{
  assert.equal(coverageGaps('No A. No A.',requirements(['No A.']),'No A.').covered,false);
  assert.equal(coverageGaps('No A ni B',requirements(['No A y B']),'No A ni B').covered,false);
  assert.equal(coverageGaps('No A',requirements(['No A']),'Absent').covered,false);
});
test('coverage retains exact offsets and distinguishes already complete clauses',()=>{
  const text='Prefijo. No A ni B. Final';
  const full=coverageGaps(text,requirements(['No A ni B.']),'No A ni B');assert.equal(full.covered,true);assert.deepEqual(full.gaps,[]);
  const gaps=coverageGaps(text,requirements(['No A','B.']),'No A ni B');
  assert.equal(gaps.covered,false);assert.deepEqual(gaps.gaps.filter(g=>!g.whitespace).map(g=>g.character),['n','i']);
});
