import {sha256} from '../../factory/lib/contracts.mjs';

// Read-only coherent metadata fingerprint for preserving a source qualification.
// Not journal verification: Store.verifyJournal separately checks its validity.
// node:sqlite rows have a null prototype; copy them before canonical encoding.
export function readHistoryFingerprint(db){
  const ownSnapshot=!db.isTransaction;
  if(ownSnapshot)db.exec('BEGIN');
  try{
    const row=db.prepare('SELECT seq,hash FROM events ORDER BY seq DESC LIMIT 1').get();
    const plain=rows=>rows.map(row=>({...row}));
    const result={head:row?{...row}:null,
      recordsHash:sha256(plain(db.prepare('SELECT type,id,version,hash FROM records ORDER BY type,id,version').all())),
      headsHash:sha256(plain(db.prepare('SELECT type,id,version FROM heads ORDER BY type,id').all()))};
    if(ownSnapshot)db.exec('COMMIT');return result;
  }catch(error){if(ownSnapshot&&db.isTransaction)db.exec('ROLLBACK');throw error;}
}
