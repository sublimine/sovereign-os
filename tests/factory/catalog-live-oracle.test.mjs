import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG_SOURCE_URLS,assessCatalogAnswer} from '../../reconstruction/verification/catalog-live-cases.mjs';
const sources=CATALOG_SOURCE_URLS.map((url,index)=>({url,httpStatus:200,status:'ADMITTED',raw:'Synthetic fixture evidence number '+index+'.'}));
const answer=()=>({exampleSecondLevel:['example.com','example.net','example.org'],exampleComAvailableForRegistration:false,ianaReferencesRfc2606:true,independentCorroborationEstablished:false,provenanceReason:'Controlled fixture explanation only, not live source verification.',scope:'documentary-policy',sourceEvidence:sources.map(s=>({url:s.url,quote:s.raw}))});
const grade=(value,records=sources)=>assessCatalogAnswer('documentary-catalog',JSON.stringify(value),records);
test('catalog external oracle accepts its complete controlled fixture and exact closed transformation',()=>{
  assert.equal(grade(answer()).passed,true);assert.equal(assessCatalogAnswer('closed-catalog','["árbol","mar","sol"]').passed,true);
  for(const body of ['["arbol","mar","sol"]','["árbol","sol","mar"]','```json\n["árbol","mar","sol"]\n```','null'])assert.equal(assessCatalogAnswer('closed-catalog',body).passed,false);
});
test('catalog external oracle rejects factual, independence and operational overclaims',()=>{
  for(const [key,value]of [['exampleSecondLevel',['example.com','example.org','example.net']],['exampleComAvailableForRegistration',true],['ianaReferencesRfc2606',false],['independentCorroborationEstablished',true],['scope','operational-dns-test'],['provenanceReason','']])assert.equal(grade({...answer(),[key]:value}).passed,false,key);
  assert.equal(grade({...answer(),extra:true}).passed,false);assert.equal(grade(null).passed,false);
});
test('catalog external oracle requires actual matching admitted sources and literal citations',()=>{
  assert.equal(grade(answer(),[]).passed,false);assert.equal(grade(answer(),sources.map(s=>({...s,status:'RETRACTED'}))).passed,false);
  const altered=answer();altered.sourceEvidence[0].quote='Plausible but unobserved sentence.';assert.equal(grade(altered).passed,false);
  const duplicate=answer();duplicate.sourceEvidence[1]=duplicate.sourceEvidence[0];assert.equal(grade(duplicate).passed,false);
  const extra=answer();extra.sourceEvidence[0].hash='not a field';assert.equal(grade(extra).passed,false);
});
