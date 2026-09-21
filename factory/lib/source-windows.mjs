import {check,clone,digest,identifier,integer,keys,list,sha256,string} from './contracts.mjs';

export const MAX_SOURCE_WINDOW_BYTES=64*1024;
export const DEFAULT_SOURCE_WINDOW_BYTES=16*1024;
const SCHEMA='sovereign.source-window.v1',MAX_SOURCE_BYTES=8*1024*1024;
const boundary=(bytes,offset)=>offset===bytes.length||(bytes[offset]&0xc0)!==0x80;

// Byte access only: callers must independently authenticate acquisition,
// admission/retraction, mission/actor authority and actual completed exposure.
// This module does NOT supply a source.read tool or change worker contexts.
function source(snapshot){
  identifier(snapshot.id);digest(snapshot.hash);string(snapshot.raw,'raw source',{min:0,max:MAX_SOURCE_BYTES});
  check(snapshot.raw.isWellFormed(),'SOURCE_WINDOW_INTEGRITY','Raw source must be complete Unicode scalar values');
  check(sha256(snapshot.raw)===snapshot.hash,'SOURCE_WINDOW_INTEGRITY','Source identity differs from raw bytes');
  const bytes=Buffer.from(snapshot.raw,'utf8');
  return {bytes,id:snapshot.id,hash:snapshot.hash};
}
function verify(material,window){
  keys(window,['schema','sourceId','sourceHash','sourceBytes','startByte','endByte','text','textSha256','completeRawDocument']);
  check(window.schema===SCHEMA&&window.sourceId===material.id&&window.sourceHash===material.hash
    &&window.sourceBytes===material.bytes.length,'SOURCE_WINDOW_INTEGRITY','Window belongs to another snapshot');
  integer(window.startByte,'window start',{max:material.bytes.length});
  integer(window.endByte,'window end',{min:window.startByte,max:material.bytes.length});
  check(window.endByte-window.startByte<=MAX_SOURCE_WINDOW_BYTES
    &&boundary(material.bytes,window.startByte)&&boundary(material.bytes,window.endByte),
    'SOURCE_WINDOW_RANGE','Window exceeds bound or splits a UTF-8 scalar');
  string(window.text,'window text',{min:0,max:MAX_SOURCE_WINDOW_BYTES});digest(window.textSha256);
  check(window.text.isWellFormed()&&Buffer.byteLength(window.text)===window.endByte-window.startByte
    &&window.text===material.bytes.subarray(window.startByte,window.endByte).toString('utf8')
    &&sha256(window.text)===window.textSha256
    &&window.completeRawDocument===(window.startByte===0&&window.endByte===material.bytes.length),
    'SOURCE_WINDOW_INTEGRITY','Text, range, hash or complete-source label changed');
  return window;
}

/** Offset and maximum length are UTF-8 bytes, not UTF-16 indices or graphemes.
 * An invalid starting boundary is rejected; only the end may retreat to fit a
 * complete scalar within the caller budget. No normalization or text extraction. */
export function readSourceWindow(snapshot,options={}){
  keys(options,['startByte','maxBytes'],[],'window request');
  const {startByte=0,maxBytes=DEFAULT_SOURCE_WINDOW_BYTES}=options;
  const material=source(snapshot);
  integer(startByte,'window start',{max:material.bytes.length});
  integer(maxBytes,'window budget',{min:4,max:MAX_SOURCE_WINDOW_BYTES});
  check(boundary(material.bytes,startByte),'SOURCE_WINDOW_RANGE','Start must be an exact UTF-8 scalar boundary');
  let endByte=Math.min(material.bytes.length,startByte+maxBytes);
  while(!boundary(material.bytes,endByte))endByte--;
  const text=material.bytes.subarray(startByte,endByte).toString('utf8');
  return verify(material,{schema:SCHEMA,sourceId:material.id,sourceHash:material.hash,sourceBytes:material.bytes.length,
    startByte,endByte,text,textSha256:sha256(text),completeRawDocument:startByte===0&&endByte===material.bytes.length});
}

/** Exact fidelity, not authority, observation, entailment or factual truth. */
export function verifySourceWindow(snapshot,window){verify(source(snapshot),window);return true;}

/** Bounded literal locator over the already acquired raw. No regex, HTML
 * removal, network or fuzzy matching. Results are byte locations, NOT read
 * exposure, semantic relevance or permission to infer global factual absence. */
export function findSourceLiteral(snapshot,options){
  canonicalOptions(options);
  const {literal,startByte=0,maxMatches=16}=options,material=source(snapshot);
  string(literal,'literal query',{max:1024});
  check(literal.isWellFormed(),'SOURCE_WINDOW_RANGE','Literal query must contain complete Unicode scalars');
  integer(startByte,'literal search start',{max:material.bytes.length});
  integer(maxMatches,'literal match budget',{min:1,max:64});
  check(boundary(material.bytes,startByte),'SOURCE_WINDOW_RANGE','Search start must be a UTF-8 scalar boundary');
  const needle=Buffer.from(literal),matches=[];let cursor=startByte,nextStartByte=null;
  for(;;){
    const found=material.bytes.indexOf(needle,cursor);if(found<0)break;
    if(matches.length===maxMatches){nextStartByte=found;break;}
    matches.push({startByte:found,endByte:found+needle.length});
    // Advance one scalar, NOT the whole match, to preserve overlapping literals.
    cursor=found+1;while(!boundary(material.bytes,cursor))cursor++;
  }
  return {schema:'sovereign.source-literal-locations.v1',sourceId:material.id,sourceHash:material.hash,
    sourceBytes:material.bytes.length,literal,literalSha256:sha256(literal),startByte,maxMatches,matches,
    moreMatchesExist:nextStartByte!==null,nextStartByte,completeRawSearch:startByte===0&&nextStartByte===null,
    scope:'Literal byte locations only, not model exposure, semantic support, relevant-context coverage or factual absence. A suffix page is not a complete-document search. Read and verify selected windows separately.'};
}
function canonicalOptions(options){
  // Clone validation rejects accessors/sparse arrays before reading properties.
  // Only these scalar query fields are accepted; no executable matcher.
  clone(options);keys(options,['literal','startByte','maxMatches'],['literal'],'literal search');
}

/** A quote must occur literally inside ONE window. A quote assembled across
 * missing bytes cannot pass. Actor exposure is a separate integration gate. */
export function sourceWindowContainsQuote(snapshot,window,quote){
  verifySourceWindow(snapshot,window);string(quote,'source quote',{max:20000});
  check(quote.isWellFormed(),'SOURCE_WINDOW_RANGE','A quote cannot select half of a Unicode scalar');
  return window.text.includes(quote);
}

/** Coverage of supplied byte windows ONLY, not proof that a worker read them.
 * Overlap/duplicates do not count twice. Adjacency joins only identical bytes
 * from the same exact source; a changed source/window fails before aggregation. */
export function windowByteCoverage(snapshot,windows){
  const material=source(snapshot);list(windows,'source windows',{max:1024});
  const ranges=[];
  for(const window of windows){verify(material,window);if(window.endByte>window.startByte)ranges.push([window.startByte,window.endByte]);}
  ranges.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const merged=[];
  for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range]);}
  const gaps=[];let cursor=0;
  for(const [start,end]of merged){if(start>cursor)gaps.push([cursor,start]);cursor=end;}
  if(cursor<material.bytes.length)gaps.push([cursor,material.bytes.length]);
  return {schema:'sovereign.source-window-byte-coverage.v1',sourceId:material.id,sourceHash:material.hash,
    sourceBytes:material.bytes.length,windowCount:windows.length,coveredBytes:merged.reduce((sum,[start,end])=>sum+end-start,0),
    ranges:merged,gaps,completeRawCoverage:gaps.length===0,
    scope:'BYTE_WINDOWS_ONLY. No claim of completed model exposure, independent review, relevant context, semantic coverage or factual support.'};
}
