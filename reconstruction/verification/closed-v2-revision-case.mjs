// Operator-authored prospective case. Expected output is external to inference.
export const REVISION_RECORDS=Object.freeze([
  {id:'A',revision:3,active:true,amount:5},
  {id:'B',revision:2,active:true,amount:7},
  {id:'A',revision:1,active:true,amount:99},
  {id:'C',revision:4,active:false,amount:10},
  {id:'B',revision:2,active:true,amount:0},
  {id:'D',revision:1,active:true,amount:-2},
  {id:'C',revision:2,active:true,amount:100},
  {id:'A',revision:3,active:false,amount:5},
  {id:'É',revision:1,active:true,amount:4},
  {id:'a',revision:0,active:true,amount:0},
  {id:'D',revision:0,active:false,amount:99},
  {id:'😀',revision:1,active:true,amount:3},
  {id:String.fromCodePoint(0xE000),revision:1,active:true,amount:1},
].map(Object.freeze));
export const CLOSED_V2_REVISION_CASE=Object.freeze({
  id:'revision-ledger-codepoints-v2',family:'transformation',modes:['adaptive','planned'],
  closedEntryVersion:'closed-response-v2',allowedTools:[],maxCalls:8,
  request:'Transforma únicamente los registros JSON suministrados abajo. Para cada id conserva el registro con el MAYOR valor numérico de revision; sólo si hay empate de revision conserva su ÚLTIMA aparición en el array. Después, y no antes, conserva únicamente los registros cuyo active sea true. No reactives un id con una revisión anterior. Devuelve únicamente un objeto JSON válido con exactamente items y total, sin claves repetidas, Markdown ni texto adicional. items es un array de objetos con exactamente id, revision y amount, preservando sus valores y tipos. Incluye los ceros y negativos. Ordena items lexicográficamente por los valores numéricos de los puntos de código Unicode de id, sin cambiar mayúsculas, acentos ni caracteres: no uses orden por unidades UTF-16 ni orden lingüístico. Los IDs incluyen U+E000 y U+1F600. total es la suma entera de amount de los items retenidos. No consultes fuentes externas, crees archivos ni ejecutes código.\n'+JSON.stringify(REVISION_RECORDS),
  expected:{items:[{id:'B',revision:2,amount:0},{id:'D',revision:1,amount:-2},{id:'a',revision:0,amount:0},
    {id:'É',revision:1,amount:4},{id:String.fromCodePoint(0xE000),revision:1,amount:1},{id:'😀',revision:1,amount:3}],total:6},
});
