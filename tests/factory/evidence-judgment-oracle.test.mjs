import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceCases,judgeEvidenceOutput} from '../../reconstruction/verification/evidence-judgment-cases.mjs';
test('Qualification oracle: paired labels, exact quotes and genuine unknowns cannot be converted into passes',()=>{
  assert.equal(evidenceCases.length,4);
  for(const c of evidenceCases){assert.equal(c.variants.length,2);
    for(const v of c.variants){const value={...v.expected,support:[{sourceId:c.sources[0].id,quote:c.sources[0].raw}],reason:'Synthetic oracle test, not a model verdict'};
      assert.equal(judgeEvidenceOutput(value,c,v).pass,true);
      assert.equal(judgeEvidenceOutput({...value,decision:'UNKNOWN'},c,v).pass,false);
      assert.equal(judgeEvidenceOutput({...value,support:[{sourceId:'invented',quote:'invented'}]},c,v).pass,false);
      assert.equal(judgeEvidenceOutput({...value,support:[]},c,v).pass,false);
    }
  }
});
