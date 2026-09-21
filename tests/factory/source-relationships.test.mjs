import test from 'node:test';
import assert from 'node:assert/strict';
import {describeSourceRelationships} from '../../factory/lib/source-relationships.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
const source=(id,url,text)=>({id,hash:sha256(text),url});
test('relationships expose exact copies across origins without certifying roots',()=>{
  const sources=[source('source:a','https://first.example/record','measured=12'),source('source:b','https://mirror.example/copy','measured=12')];
  const before=structuredClone(sources),r=describeSourceRelationships(sources);
  assert.deepEqual(sources,before);assert.equal(r.uniqueContentCount,1);
  assert.deepEqual(r.identicalContent,[{hash:sha256('measured=12'),sourceIds:['source:a','source:b']}]);
  assert.deepEqual(r.sharedHttpOrigin,[]);assert.equal(r.rootIndependence,'NOT_ESTABLISHED');
});
test('shared normalized HTTP origin is not conflated with derivation or independence',()=>{
  const r=describeSourceRelationships([source('source:a','https://EXAMPLE.com:443/first','default=off'),source('source:b','https://example.com/second','configured=on'),
    source('source:c','https://example.com:444/third','different=record'),source('source:d','http://example.com/fourth','other=record')]);
  assert.deepEqual(r.sharedHttpOrigin,[{origin:'https://example.com',sourceIds:['source:a','source:b']}]);
  assert.deepEqual(r.identicalContent,[]);assert.equal(r.uniqueContentCount,4);assert.equal(r.rootIndependence,'NOT_ESTABLISHED');
});
test('different hosts including suffix lookalikes do not establish independent evidence',()=>{
  const r=describeSourceRelationships([source('source:a','https://sqlite.org/a','x'),source('source:b','https://sqlite.org.attacker.example/b','y')]);
  assert.deepEqual(r.sharedHttpOrigin,[]);assert.equal(r.rootIndependence,'NOT_ESTABLISHED');
  assert.match(r.interpretation,/different bytes or origins do not prove independent evidence/);
});
test('group representation stays linear for many copies and preserves every source identity',()=>{
  const sources=Array.from({length:500},(_,i)=>source(`source:s${i}`,'https://example.com/'+i,'copy'));
  const r=describeSourceRelationships(sources);
  assert.equal(r.identicalContent.length,1);assert.equal(r.sharedHttpOrigin.length,1);
  assert.equal(r.identicalContent[0].sourceIds.length,500);assert.equal(r.sharedHttpOrigin[0].sourceIds.length,500);
  assert.equal(r.sourceCount,500);assert.equal(r.uniqueContentCount,1);
});
test('duplicate identities, invalid hashes and non-HTTP or credentialed URLs are rejected',()=>{
  const one=source('source:a','https://example.com/a','x');
  assert.throws(()=>describeSourceRelationships([one,one]),{code:'SCHEMA'});
  assert.throws(()=>describeSourceRelationships([{...one,hash:'invented'}]),{code:'SCHEMA'});
  for(const url of ['file:///etc/passwd','data:text/plain,fixture','https://user:secret@example.com/','invalid URL'])
    assert.throws(()=>describeSourceRelationships([{...one,url}]),{code:'SOURCE_URL'});
});
