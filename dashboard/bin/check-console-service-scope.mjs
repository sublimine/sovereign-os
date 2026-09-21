#!/usr/bin/env node
// ExecCondition: a Console started from XRDP's nested user manager must not
// impersonate the persistent local control surface.
import {readFileSync} from 'node:fs';

let valid = false;
try {
  const uid = process.getuid();
  const expected = `/user.slice/user-${uid}.slice/user@${uid}.service/app.slice/sovereign-console.service`;
  const current = String(readFileSync('/proc/self/cgroup', 'utf8'))
    .split('\n')
    .find(line => line.startsWith('0::'))
    ?.slice(3);
  valid = current === expected;
} catch {
  valid = false;
}

if (!valid) {
  process.stderr.write('Sublimine Console must run in the canonical user manager, not a graphical session or shell.\n');
  process.exitCode = 1;
}
