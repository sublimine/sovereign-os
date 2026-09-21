import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMultisourceAnswer,urls} from '../../reconstruction/verification/multisource-case.mjs';
const sources=[{url:urls[0],raw:'Synthetic fixture only: general=OFF.'},{url:urls[1],raw:'Synthetic fixture only: flag1=ON.'}];
const answer={predeterminado_general:'OFF',compilacion_con_flag_1:'ON',ajuste_por_conexion:true,cambio_dentro_transaccion:'sin_efecto',
  relacion_documentos:'compatibles_condicionalmente',independencia_demostrada:false,estado_local_medido:false,
  explicacion:'Synthetic oracle fixture; no real web source or semantic judgment.',fuentes:sources.map(s=>({url:s.url,cita:s.raw}))};
test('multisource oracle accepts the frozen synthetic case and rejects each altered substantive field',()=>{
  assert.equal(assessMultisourceAnswer(JSON.stringify(answer),sources).passed,true);
  for(const key of ['predeterminado_general','compilacion_con_flag_1','ajuste_por_conexion','cambio_dentro_transaccion','relacion_documentos','independencia_demostrada','estado_local_medido']){
    const changed={...answer,[key]:typeof answer[key]==='boolean'?!answer[key]:'WRONG'};
    assert.equal(assessMultisourceAnswer(JSON.stringify(changed),sources).passed,false,key);
  }
});
test('multisource oracle rejects invented, duplicate, long and missing quotes, unknown fields and invalid JSON',()=>{
  for(const fuentes of [[],[answer.fuentes[0],answer.fuentes[0]],answer.fuentes.map(s=>({...s,cita:'not observed'})),
    answer.fuentes.map(s=>({...s,cita:'word '.repeat(13)}))])
    assert.equal(assessMultisourceAnswer(JSON.stringify({...answer,fuentes}),sources).passed,false);
  assert.equal(assessMultisourceAnswer(JSON.stringify({...answer,extra:'cannot ignore ungraded claims'}),sources).passed,false);
  assert.equal(assessMultisourceAnswer('not JSON',sources).passed,false);
  assert.equal(assessMultisourceAnswer('null',sources).passed,false);
});
