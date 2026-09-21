// A terminal process exit alone is not evidence of a complete regression.
export function assertPassingRegression(suite){
  const c=suite?.counts;
  const integer=n=>Number.isSafeInteger(n)&&n>=0;
  if(suite?.exitCode!==0||suite.signal!=null||suite.interruptedBy!=null
    ||!c||!['tests','pass','fail','cancelled','skipped','todo'].every(k=>integer(c[k]))
    ||c.pass<1||c.fail!==0||c.cancelled!==0||c.todo!==0||c.tests!==c.pass+c.skipped)
    throw Error('Complete uninterrupted passing regression required');
  if(['inputArchive','inputsStillMatch','inputArchiveVerified','inputIntegrityErrors'].some(k=>Object.hasOwn(suite,k))
    ||Object.hasOwn(suite.inputs??{},'reconstruction/verification/regression-input-archive.mjs')){
    const a=suite.inputArchive;
    if(!a||a.schema!=='sovereign.regression-input-archive.v1'||a.phase!=='prospective'
      ||typeof a.directory!=='string'||!a.directory||!/^[a-f0-9]{64}$/.test(a.manifestSha256??'')
      ||!integer(a.fileCount)||a.fileCount<1||!integer(a.blobCount)||a.blobCount<1||a.blobCount>a.fileCount||!integer(a.bytes)
      ||!suite.inputs||typeof suite.inputs!=='object'||Array.isArray(suite.inputs)||a.fileCount!==Object.keys(suite.inputs).length
      ||suite.inputsStillMatch!==true||suite.inputArchiveVerified!==true
      ||!Array.isArray(suite.inputIntegrityErrors)||suite.inputIntegrityErrors.length)
      throw Error('Verified prospective input archive and unchanged closing inputs required');
  }
  return c;
}
