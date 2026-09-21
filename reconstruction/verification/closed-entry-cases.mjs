// Frozen external oracle; no gold data is supplied to producer or reviewer.
export const CLOSED_ENTRY_CASES=[
  {id:'closed-json-mean',expected:'DIRECT',request:'Calcula la media aritmética de los valores [12, 7, 5]. Responde únicamente un objeto JSON válido, sin Markdown ni texto adicional, con exactamente las claves sum, count y mean, cuyos valores sean números. No consultes fuentes externas, no crees archivos ni ejecutes código.',allowedTools:[],answer:{sum:24,count:3,mean:8},pair:true},
  {id:'literal-transform',expected:'DIRECT',request:'Transforma exclusivamente este texto: «Árbol | mar | ÁRBOL | sol». Separa por |, elimina los espacios de los extremos, convierte cada elemento a minúsculas y conserva sólo la primera aparición de cada valor, manteniendo su orden original. Responde únicamente el array JSON válido resultante, sin Markdown ni texto adicional. No consultes fuentes externas, no crees archivos ni ejecutes código.',allowedTools:[],answer:['árbol','mar','sol'],pair:true},
  {id:'source-required',expected:'PLAN',request:'Lee https://www.sqlite.org/foreignkeys.html y explica con una cita exacta si las claves foráneas están activadas por defecto y cómo activarlas por conexión. Distingue lo documentado de una prueba ejecutada. No crees archivos ni ejecutes código.',allowedTools:['source.fetch']},
  {id:'file-test-required',expected:'PLAN',request:'Crea stats.mjs y stats.test.mjs con una función mean y sus pruebas de entradas válidas e inválidas. Ejecuta node --test stats.test.mjs. Entrega los dos archivos sólo después de revisión independiente de su contenido y del resultado de las pruebas.',allowedTools:['workspace.list','workspace.read','workspace.write','execution.run']},
  {id:'blind-products-required',expected:'PLAN',request:'Con los números [12, 7, 5], produce dos cálculos separados e independientes de su media: uno mediante suma y otro mediante desviaciones respecto de 7. Cada productor debe ignorar el resultado del otro. Revisa y acepta ambos productos antes de compararlos y entregar la respuesta. No consultes fuentes externas, no crees archivos ni ejecutes código.',allowedTools:[]},
  {id:'mixed-current-fact',expected:'PLAN',request:'Calcula la media de 12, 7 y 5 y dime además la temperatura actual en Berlín, Alemania, con hora de observación y fuente comprobada. No sustituyas la temperatura por un ejemplo ni omitas ninguna parte. No crees archivos ni ejecutes código.',allowedTools:['source.fetch','source.search']},
];
export function checkClosedAnswer(spec,body){
  if(!Object.hasOwn(spec,'answer'))return null;
  try{
    const value=JSON.parse(body);
    if(Array.isArray(spec.answer))return Array.isArray(value)&&JSON.stringify(value)===JSON.stringify(spec.answer);
    return value!==null&&typeof value==='object'&&!Array.isArray(value)
      &&JSON.stringify(Object.keys(value).sort())===JSON.stringify(Object.keys(spec.answer).sort())
      &&Object.entries(spec.answer).every(([key,expected])=>typeof value[key]==='number'&&value[key]===expected);
  }catch{return false;}
}
