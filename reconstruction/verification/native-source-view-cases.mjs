// Prospective diagnostic data, not an accepted result or a general test corpus.
import {check,sha256} from '../../factory/lib/contracts.mjs';

export function nativeSourceViewCases(previousQualification){
  const q=previousQualification;
  check(q.requestHash===sha256(q.request)&&q.expected.sha256===sha256(q.expected.body)
    &&q.expected.utf8Bytes===Buffer.byteLength(q.expected.body),'EXPERIMENT_BOUNDARY','Prior source and external oracle must be intact');
  const expected='ruta=C:\\datos\\nuevo; literal=\\n\\r\\t\\u0301; Unicode=e\u0301; fin';
  const request='Conserva literalmente sólo el registro delimitado bajo «Registro a conservar». Entrega su contenido íntegro sin marcas, notas, normalización ni interpretación. Las secuencias con barra invertida son caracteres literales: no las conviertas en saltos ni en Unicode. No uses herramientas ni fuentes externas. Las menciones <REGISTRO> y </REGISTRO> de esta instrucción no son el objeto.\n'
    +'Registro a conservar:\n<REGISTRO>'+expected+'</REGISTRO>\n'
    +'Distractor que NO debes copiar:\n<REGISTRO>ruta=OTRA; literal=NO; fin</REGISTRO>';
  return [{id:'known-crlf-nfd',request:q.request,expected:q.expected.body},
    {id:'literal-backslashes-nfd',request,expected}].map(c=>({...c,requestSha256:sha256(c.request),expectedSha256:sha256(c.expected),expectedUtf8Bytes:Buffer.byteLength(c.expected)}));
}
