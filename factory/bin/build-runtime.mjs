#!/usr/bin/env node
import {buildRuntimeRelease} from '../lib/runtime-release.mjs';
if(process.argv.length!==3)throw Error('Usage: node factory/bin/build-runtime.mjs EXACT_RELEASES_DIRECTORY');
process.stdout.write(JSON.stringify(buildRuntimeRelease(process.argv[2]),null,2)+'\n');
