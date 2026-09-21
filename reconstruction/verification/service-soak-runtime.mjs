// Explicit observer dependency binding. Never follows the development tree,
// installed service version, latest release, environment or caller options.
// This does not install the helper release or start any mission/worker.
import {resolve} from 'node:path';
import {realpathSync} from 'node:fs';
import {check} from './fixtures/41f5a5b88f5b3f6457ea7a7164bbaddebde333cd773a6989376b9e6aeb96eaf4/factory/lib/contracts.mjs';
import {verifyRuntimeRelease} from './fixtures/41f5a5b88f5b3f6457ea7a7164bbaddebde333cd773a6989376b9e6aeb96eaf4/factory/lib/runtime-integrity.mjs';
export {Store} from './fixtures/41f5a5b88f5b3f6457ea7a7164bbaddebde333cd773a6989376b9e6aeb96eaf4/factory/lib/store.mjs';
export {check,sha256,canonical,id,identifier,instant} from './fixtures/41f5a5b88f5b3f6457ea7a7164bbaddebde333cd773a6989376b9e6aeb96eaf4/factory/lib/contracts.mjs';
export {inspectUserService} from './fixtures/41f5a5b88f5b3f6457ea7a7164bbaddebde333cd773a6989376b9e6aeb96eaf4/factory/lib/service-status.mjs';
export {verifyRuntimeRelease};

export const SOAK_RUNTIME_ID='41f5a5b88f5b3f6457ea7a7164bbaddebde333cd773a6989376b9e6aeb96eaf4';
const directory=resolve(import.meta.dirname,'fixtures',SOAK_RUNTIME_ID);
export function verifySoakRuntime(){
  check(realpathSync(directory)===directory,'SOAK_PATH','Frozen observer runtime cannot be redirected');
  return verifyRuntimeRelease(directory,SOAK_RUNTIME_ID);
}
