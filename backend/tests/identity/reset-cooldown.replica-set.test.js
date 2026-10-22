import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import mongoose from 'mongoose';
import {IdentityRepository} from '../../src/services/identity/identity.repository.js';
import {IdentityGuard} from '../../src/models/identity/identity-guard.model.js';
import {User} from '../../src/models/identity/user.model.js';
const uri=process.env.QUERY_TEST_REPLICA_SET_URI;
test('first reset cooldown is visible in its transaction, rolls back, and admits one concurrent claim',{skip:!uri},async()=>{
 const url=new URL(uri);assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));assert.equal(url.username+url.password+url.search+url.hash,'');
 await mongoose.connect(uri,{dbName:'tro_lam_reset_guard_'+randomBytes(12).toString('hex')});
 try{
  await IdentityGuard.createIndexes();
  const repo=new IdentityRepository();const id=String(new mongoose.Types.ObjectId());const now=new Date();
  // Establish a transaction snapshot before the first guard exists, as the service does.
  await mongoose.connection.transaction(async session=>{
   await User.findOne({_id:id}).session(session).exec();
   const claimed=await repo.claimAdminPasswordReset(id,now,60000,{session});assert.ok(claimed,'first request must not look rate limited');
  });
  await mongoose.connection.transaction(async session=>assert.equal(await repo.claimAdminPasswordReset(id,now,60000,{session}),null));
  const rollbackId=String(new mongoose.Types.ObjectId());
  await assert.rejects(mongoose.connection.transaction(async session=>{assert.ok(await repo.claimAdminPasswordReset(rollbackId,now,60000,{session}));throw new Error('local rollback');}),/local rollback/);
  assert.equal(await IdentityGuard.countDocuments({key:'password-reset:'+rollbackId}),0);
  const raceId=String(new mongoose.Types.ObjectId());
  const race=await Promise.allSettled([0,1].map(()=>mongoose.connection.transaction(async session=>{
   await User.findOne({_id:raceId}).session(session).exec();return Boolean(await repo.claimAdminPasswordReset(raceId,now,60000,{session}));
  })));
  assert.equal(race.filter(r=>r.status==='fulfilled'&&r.value===true).length,1);
  assert.equal(await IdentityGuard.countDocuments({key:'password-reset:'+raceId}),1);
  for(const r of race.filter(r=>r.status==='rejected'))assert.equal(r.reason.code,11000);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
