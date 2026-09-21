import {keys, list, string} from './contracts.mjs';

export function validateSpecialistCharter(charter) {
  keys(charter, ['question', 'methods', 'falsifier', 'expectedBenefit', 'completion']);
  for (const f of ['question', 'falsifier', 'expectedBenefit', 'completion']) string(charter[f], `specialist ${f}`);
  list(charter.methods, 'specialist methods', {min: 1});
  charter.methods.forEach(m => string(m));
  return charter;
}
