// Build the tiny public dependency fixture used by the soak observer.
//
// This intentionally contains only the four modules the observer imports at
// runtime.  It is not a copy of an installation, a mission store, a history,
// a release directory, or an operator's home.
import * as fs from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildRuntimeRelease} from '../../factory/lib/runtime-release.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const repository=resolve(here,'../..');
const paths=[
  'factory/lib/contracts.mjs',
  'factory/lib/runtime-integrity.mjs',
  'factory/lib/service-status.mjs',
  'factory/lib/store.mjs',
];

const files=paths.map(path=>({path,content:fs.readFileSync(join(repository,path))}));
const result=buildRuntimeRelease(join(here,'fixtures'),{files});
process.stdout.write(JSON.stringify({
  scope:'Public frozen soak helper only; no runtime state, project data or deployment history.',
  releaseId:result.releaseId,
  fileCount:result.fileCount,
  bytes:result.bytes,
  reused:result.reused,
})+'\n');
