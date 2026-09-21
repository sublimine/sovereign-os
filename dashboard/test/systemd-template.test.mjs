import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const dashboardDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const servicePath = join(dashboardDirectory, 'systemd', 'sovereign-console.service');
const environmentTemplatePath = join(dashboardDirectory, 'systemd', 'console.env.example');

test('the console user-service template is portable across checkout locations', async () => {
  const [service, environment] = await Promise.all([
    readFile(servicePath, 'utf8'),
    readFile(environmentTemplatePath, 'utf8'),
  ]);

  assert.equal(service.includes('openclaw-workspace/sovereign-os'), false);
  assert.equal(environment.includes('openclaw-workspace/sovereign-os'), false);
  assert.match(service, /^WorkingDirectory=%h$/mu);
  assert.match(service, /^ExecCondition=\/usr\/bin\/env \$\{SUBLIMINE_NODE_BIN\} \$\{SUBLIMINE_REPOSITORY_DIR\}\/dashboard\/bin\/check-console-service-scope\.mjs$/mu);
  assert.match(service, /^ExecStart=\/usr\/bin\/env \$\{SUBLIMINE_NODE_BIN\} \$\{SUBLIMINE_REPOSITORY_DIR\}\/dashboard\/server\.mjs$/mu);
  assert.match(environment, /^SUBLIMINE_NODE_BIN=\/absolute\/path\/to\/node$/mu);
  assert.match(environment, /^SUBLIMINE_REPOSITORY_DIR=\/absolute\/path\/to\/sublimine$/mu);
});
