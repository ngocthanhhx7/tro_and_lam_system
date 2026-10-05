import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { RestrictedProof } from '../../src/models/identity/restricted-proof.model.js';

test('guest order proof may be issued before email identity is verified', async () => {
  const proof = new RestrictedProof({
    purpose: 'guest_order_access',
    orderId: new mongoose.Types.ObjectId(),
    scopes: ['guest.order.read'],
    tokenHash: 'a'.repeat(64),
    expiresAt: new Date('2026-10-07T00:00:00.000Z'),
    issuedAt: new Date('2026-10-06T00:00:00.000Z'),
  });

  await assert.doesNotReject(proof.validate());
  assert.equal(proof.identityVerifiedAt, undefined);
});

test('verified guest order proof can retain its verification timestamp', async () => {
  const identityVerifiedAt = new Date('2026-10-06T12:00:00.000Z');
  const proof = new RestrictedProof({
    purpose: 'guest_order_access',
    orderId: new mongoose.Types.ObjectId(),
    scopes: ['guest.order.read'],
    tokenHash: 'b'.repeat(64),
    expiresAt: new Date('2026-10-07T00:00:00.000Z'),
    issuedAt: new Date('2026-10-06T00:00:00.000Z'),
    identityVerifiedAt,
  });

  await assert.doesNotReject(proof.validate());
  assert.deepEqual(proof.identityVerifiedAt, identityVerifiedAt);
});
