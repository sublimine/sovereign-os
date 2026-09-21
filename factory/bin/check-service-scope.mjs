#!/usr/bin/env node
// ExecCondition: exit 1 skips starting under a nested graphical-session manager.
// Environment variables alone cannot prove which manager actually owns us.
import {readFileSync} from 'node:fs';
import {isCanonicalServiceProcess} from '../lib/service-status.mjs';
let valid=false;
try{valid=isCanonicalServiceProcess(readFileSync('/proc/self/cgroup','utf8'));}catch{}
if(!valid){process.stderr.write('Sublimine service must run in the canonical user manager, not a graphical session or shell.\n');process.exitCode=1;}
