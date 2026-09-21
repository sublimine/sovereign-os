import fs from 'node:fs';
import crypto from 'node:crypto';
const path='reconstruction/audit/history-departments-sigma-complement/coverage.json';
const old=fs.readFileSync(path,'utf8'),x=JSON.parse(old);
const notes={
20:'Operational state/memory/CAS/context and gate certification effects add detail beyond rendered dossier. FMEA prompt_injection/temporal_edges and authority_overreach/alternative_graph are not causal validation.',
21:'Measurement contracts preserve comparability/error; MetricDefinitions owner unresolved and FEEDS TechnicalCollectionPlan insufficient as measurement evidence.',
22:'Ontology raw terms, migration approval, dual-read and rollback preserved; owns/other_owns with sigma25/26 ambiguous, not permission to commit facts.',
23:'Blind translation and contextual ambiguity preserved; fluency/back-translation alone do not establish expertise or intent; independence floors require actual evidence.',
24:'Fusion uses admitted evidence and preserves dissent; nonexistent INDEPENDENCE case gate and generic DissentRecords producer remain unresolved.',
25:'Capability/intention/faction confidence separate; ResourceSignals generic producer and DECISION_UNIT numerical precision threshold require semantic repair.',
26:'JSON counterpart sigma18 with text describing Omega impact role corroborates erroneous reference; historical Omega18 supports proposed correction.',
27:'Causal identifiability is not reproducibility; IDENTIFIABILITY generic threshold insufficient and competing_DAGs identifier differs in case; Omega08 final role preserved.',
28:'Evidence reused for hypothesis generation/testing must be disclosed; ranking not truth; sigma27/36 feedback needs versioned provisional artifacts.',
29:'Authentic content can support misleading selection; retired leaked discriminants and benign explanation preserved; residual operational rollback is not epistemic resolution.',
30:'Protected compromise inquiry separate from endpoint response and personnel decisions; generic telemetry producer requires authentic runtime receipts and intrusion authority.',
31:'Baseline before event, pipeline/regime checks and multiplicity controls; preregistration alone not FDR control; generic MULTIPLE_TESTING threshold unresolved.',
32:'Optional CalibrationHistory cannot justify unsupported precision; pre-outcome commit and later independent resolution need immutable event evidence; forecast not warning/simulation.',
33:'WarningPolicy optional field cannot waive authorized threshold policy; watch/ACK/disposition and handover persist beyond episode; DECISION_WINDOW not merely TTL.',
34:'JSON sigma19 risk reference conflicts historical Omega19; mechanism-distinct surprise with unobservable tripwire can remain UNKNOWN resilience handoff, not invented probability.',
35:'Opportunity includes finite window, prerequisites, adverse selection and cheapest decisive validation; optional DecisionModel does not authorize invented utility or investment.',
36:'Atomic material dissent protected without false balance/vote; numerical materiality floor insufficient; broad CHALLENGES topology not mandate to activate every target.',
37:'Additional acknowledgment and unreachable correction falsifier; ClassificationPolicy compression-ratio field semantically misplaced; product publication needs independent release and recipient authority.',
38:'SELF_CONTROL/NONE gates retained even for QA; All Sigma producers mislabeled EXTERNAL; utility fitness does not supersede sigma40 outcome boundary; no self-certified/external audit.',
39:'Authentic NewEvidenceEvents and state receipts; VERSION_LINKAGE case lacks gate; runtime persists, sigma02 schedules, sigma37 publishes; resume does not revive lease or duplicate effects.',
40:'Independent outcomes, task mix, actual use and causal attribution; Latency decision-counterfactual field misplaced; proposals require shadow/test/rollback/Omega24 approval, never self-deploy.'
};
for(const s of x.sources){
 if(s.source.startsWith('config/sigma/v3/dossiers/')){
  const n=Number(s.role.split('_')[1]);s.differences=notes[n];s.relevance='Preserve the capability and boundaries; resolve documented contract defects before executable adoption. See analysis.md individual auxiliary findings; no runtime validation claimed.';
 }
 const actual=crypto.createHash('sha256').update(fs.readFileSync(s.source)).digest('hex');
 if(actual!==s.sha256)throw Error('Source changed: '+s.source);
 if(s.baseSha256){const b=crypto.createHash('sha256').update(fs.readFileSync(s.base)).digest('hex');if(b!==s.baseSha256)throw Error('Base changed: '+s.base);}
 if(!s.verifiedByteReconstruction)throw Error('Unverified reconstruction: '+s.source);
}
x.validation={sourceHashes:'92/92 matched on final validation',baseHashes:'all recorded bases matched',byteReconstruction:'all92 verified byteexact by manifests',reading:'literal bases plus every exact substitution at all recorded positions and complete residuals; not hash-only attribution',semanticStatus:'documentary audit only; no runtime tests executed',scope:'50 departmental historical dossiers;21 Sigma20–40 historical dossiers;21 Sigma20–40 V3 auxiliary JSON dossiers; historical config/charter versions outside this scope'};
const next=JSON.stringify(x,null,2)+'\n';
process.stdout.write('*** Begin Patch\n*** Update File: '+path+'\n@@\n'+old.trimEnd().split('\n').map(s=>'-'+s).join('\n')+'\n'+next.trimEnd().split('\n').map(s=>'+'+s).join('\n')+'\n*** End Patch\n');
