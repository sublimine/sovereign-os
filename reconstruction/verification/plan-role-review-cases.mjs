// Authored closed fixtures, NOT generated plans or measured real-world data.
// This suite isolates role-fit judgment. Expected labels are never model input.
export const intent='Produce an in-memory measurement-integrity report from these supplied interval readouts. Readout A is 2.00 g with interval [1.98,2.02] g; readout B is 500 mg with interval [490,510] mg. Use the supplied exact conversion 1000 mg = 1 g. Report the nominal sum and bounding interval in g, preserve input precision, explain dimensional conversion and interval propagation, and identify limits. No source acquisition, human contact, files, code execution or external tools. Use one material product with independent acceptance.';

function proposal(roleId){
  return {requirements:[{id:'report',text:intent,requestQuote:intent,criteria:[
    {id:'measurement',text:'The report preserves both original readouts and intervals, converts all values to g with the supplied exact conversion, adds nominal values and interval endpoints, distinguishes the bounding interval from a probability interval, and reports no extra measurement precision.',evaluation:'content'},
    {id:'limits',text:'Keep the supplied-reading scope, assumptions and missing information explicit. No source acquisition, human contact, files, execution or external tools; all reasoning remains in memory.',evaluation:'content'},
    {id:'boundary',text:'The producer cannot accept its own report. An independent reviewer must recalculate units and interval endpoints and inspect the public argument before delivery.',evaluation:'runtime.independent_review'},
  ]}],nodes:[{id:'measurement',title:'Measurement-integrity report',purpose:'measurement-integrity',roleIds:[roleId],reviewerRoleIds:['omega_22'],requirementIds:['report'],dependencies:[],
    method:{id:'unit-conversion-interval-propagation',rationale:'All premises are supplied. Manual dimensional conversion and endpoint addition establish this closed interval report without acquiring empirical data.',alternatives:['Re-express both readouts and bounds in mg, add there, then convert back to g and compare.']},
    instructions:'Keep both supplied readouts and their units visible. Convert nominal values and both interval endpoints into g using the supplied definition, sum consistently, and explain interval bounds and precision limitations. Do not call tools, contact people or invent measurements. Return the report candidate for separate review.',
    outputKind:'measurement-integrity-report',criteria:[],requiredEffects:[],tools:[],specialist:null}],finalNodeId:'measurement',routingRationale:'One closed calculation product is sufficient; its independent review checks the candidate before delivery. No collection, interview or additional material product is necessary.'};
}

export const cases=[
  {id:'case-0',expectedDecision:'ACCEPT',expectedFit:'PASS',plan:proposal('veritas_07'),
    oracleReason:'Measurement/calculation facet directly fits supplied dimensional conversion, precision and interval propagation.'},
  {id:'case-1',expectedDecision:'RETURN',expectedFit:'FAIL',plan:proposal('sigma_09'),
    oracleReason:'Only producer role changes: human elicitation is not the requested measurement-integrity calculation. Its tacit-gap, expert/consent/question inputs and interview product are absent and contact is prohibited. General model ability does not demonstrate that this assigned facet is causally appropriate.'},
];
