import {keys,string,integer} from '../lib/contracts.mjs';

// Pure proposal validation, shared without importing a provider into the broker.
export function validateSearchArgs(args) {
  keys(args,['query','limit']);
  string(args.query,'public search query',{max:2000});
  integer(args.limit,'search result limit',{min:1,max:10});
}
