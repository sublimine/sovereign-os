// Pure schema leaf: do not import runtime services from this module. Plans and
// role-review codecs may be independent ESM entry points in either order.
const str={type:'string'},closed=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const blindExecutionSchema={anyOf:[{type:'null'},
  closed({kind:{enum:['closed-blind-material-v1'],type:'string'},protocolNodeId:str,comparisonNodeId:str}),
  closed({kind:{enum:['closed-blind-comparison-v1'],type:'string'},materialNodeId:str})]};
