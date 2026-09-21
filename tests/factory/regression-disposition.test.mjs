import test from 'node:test';
import assert from 'node:assert/strict';
import {assertPassingRegression} from '../../reconstruction/verification/regression-disposition.mjs';
const passing=()=>({exitCode:0,signal:null,interruptedBy:null,counts:{tests:3,pass:2,fail:0,cancelled:0,skipped:1,todo:0}});
test('deployment qualification allows a complete passing cut and explicit skipped tests',()=>{
  assert.deepEqual(assertPassingRegression(passing()),passing().counts);
  const legacy=passing();delete legacy.interruptedBy;assert.doesNotThrow(()=>assertPassingRegression(legacy));
});
test('an interrupted zero exit is never passing regression evidence',()=>{
  for(const change of [{interruptedBy:'SIGTERM'},{interruptedBy:'SIGINT'},{signal:'SIGTERM'},{exitCode:1},{exitCode:null}])
    assert.throws(()=>assertPassingRegression({...passing(),...change}),/uninterrupted passing/);
});
test('missing, inconsistent, failed, cancelled and unfinished summaries cannot certify deployment',()=>{
  for(const counts of [undefined,{}, {...passing().counts,tests:4},{...passing().counts,pass:0},
    {...passing().counts,fail:1},{...passing().counts,cancelled:1},{...passing().counts,todo:1},
    {...passing().counts,skipped:-1},{...passing().counts,tests:3.5}])
    assert.throws(()=>assertPassingRegression({...passing(),counts}),/passing regression/);
});
const archived=()=>({...passing(),inputs:{'a.mjs':'a'.repeat(64)},inputArchive:{schema:'sovereign.regression-input-archive.v1',
  directory:'/private/fixture/input-archive',manifestSha256:'b'.repeat(64),fileCount:1,blobCount:1,bytes:10,phase:'prospective'},
  inputsStillMatch:true,inputArchiveVerified:true,inputIntegrityErrors:[]});
test('new archived summary needs complete input-integrity results as well as passing tests',()=>{
  assert.deepEqual(assertPassingRegression(archived()),passing().counts);
  for(const change of [{inputArchive:null},{inputsStillMatch:false},{inputArchiveVerified:false},
    {inputIntegrityErrors:[{check:'current-inputs',code:'REGRESSION_INPUT_ARCHIVE'}]},
    {inputArchive:{...archived().inputArchive,phase:'post-close-matching'}},
    {inputArchive:{...archived().inputArchive,fileCount:2}},{inputArchive:{...archived().inputArchive,manifestSha256:'wrong'}},
    {inputArchive:{...archived().inputArchive,bytes:-1}},{inputArchive:{...archived().inputArchive,blobCount:2}}])
    assert.throws(()=>assertPassingRegression({...archived(),...change}),/input archive/);
});
test('partially present new integrity fields cannot masquerade as legacy qualification',()=>{
  for(const key of ['inputArchive','inputsStillMatch','inputArchiveVerified','inputIntegrityErrors']){
    const cut=archived();delete cut[key];assert.throws(()=>assertPassingRegression(cut),/input archive/);
  }
});
test('removing every archive field still fails when the pinned archive module identifies the new generation',()=>{
  const cut={...passing(),inputs:{'reconstruction/verification/regression-input-archive.mjs':'a'.repeat(64)}};
  assert.throws(()=>assertPassingRegression(cut),/input archive/);
});
