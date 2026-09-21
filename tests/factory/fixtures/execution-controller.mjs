// Trusted crash fixture. The parent kills this controller; it must not claim
// that normal cancellation/finally handlers ran. No inference or host effects.
import {IsolatedExecutionRunner} from '../../../factory/tools/execution.mjs';
process.once('message', async ({args, snapshot}) => {
  const runner = new IsolatedExecutionRunner({wallTimeMs: 10000});
  try { await runner.run({args, snapshot, onCreated: metadata => process.send(metadata)}); }
  finally { process.disconnect(); }
});
