#!/usr/bin/env node
// Read-only toolchain gate.  It never installs packages, edits a lock, or
// parses a user document.  Run it from the same service context that will own
// extraction; `QUALIFIED` means the fixed bwrap probe passed there, not merely
// that a binary happens to exist on the host.
import {readFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

import {documentToolchainLock} from '../document-extraction-contract.mjs';
import {DocumentExtractionRunner} from '../document-extraction-runner.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const dashboard = join(directory, '..');
const lockPath = join(dashboard, 'document-extraction-toolchain.lock.json');

try {
  const lock = documentToolchainLock(JSON.parse(await readFile(lockPath, 'utf8')));
  const runner = new DocumentExtractionRunner({toolchainLock: lock});
  const result = await runner.preflight();
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.state === 'QUALIFIED' ? 0 : 1;
} catch (error) {
  process.stdout.write(JSON.stringify({
    schema: 'sublimine-document-extraction-preflight-v1',
    revision: 1,
    state: 'UNAVAILABLE',
    code: error?.code || 'DOCUMENT_EXTRACTION_PREFLIGHT_FAILED',
  }) + '\n');
  process.exitCode = 1;
}
