// Mechanical provenance capture only. Emits an apply_patch; never writes files.
// Updating pins is a reviewed change, never an automatic runtime recovery.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const groups = ['omega', 'sigma', 'sigma-complement', 'pi', 'departments'];
const files = groups.flatMap(group => ['roles', 'sources'].map(kind => ({ path: `reconstruction/audit/${group}/${kind}.json`, kind })));
files.push(...['pi', 'sigma'].map(group => ({ path: `reconstruction/design/${group}-reconciliation.json`, kind: `${group}-mapping` })));
const hash = data => createHash('sha256').update(data).digest('hex');
const roles = [];
const inputs = files.map(file => {
  const raw = readFileSync(resolve(root, file.path));
  if (file.kind === 'roles') {
    for (const role of JSON.parse(raw).roles) roles.push({ id: role.id, source: file.path, roleSha256: hash(JSON.stringify(role)) });
  }
  return { ...file, sha256: hash(raw) };
});
roles.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
if (roles.length !== 154 || new Set(roles.map(role => role.id)).size !== 154) throw new Error('Expected the audited 154-role corpus, not a runtime agent count');
const manifest = { version: 1, status: 'AUDITED_DESCRIPTIONS_NOT_EXECUTION_PROOF', inputs, roles };
const target = resolve(root, 'factory/catalog/manifest.json');
const body = JSON.stringify(manifest, null, 2) + '\n';
let previous;
try { previous = readFileSync(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (previous === body) { process.stdout.write('UNCHANGED\n'); }
else if (previous === undefined) process.stdout.write(`*** Begin Patch\n*** Add File: ${target}\n${body.trimEnd().split('\n').map(line => '+' + line).join('\n')}\n*** End Patch\n`);
else process.stdout.write(`*** Begin Patch\n*** Update File: ${target}\n@@\n${previous.trimEnd().split('\n').map(line => '-' + line).join('\n')}\n${body.trimEnd().split('\n').map(line => '+' + line).join('\n')}\n*** End Patch\n`);
