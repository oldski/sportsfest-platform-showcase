// Showcase note: form schema tests. Not runnable from this folder.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { signupFormSchema } from './signup-schema';

const base = {
  organizationId: '11111111-1111-4111-8111-111111111111',
  firstName: 'Spec',
  lastName: 'Tator',
  dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
  email: 'spec.tator@example.com',
  phone: '8135551234',
  gender: 'male',
  tshirtSize: 'm',
  confirmAccuracy: true,
  waiverAgreement: true,
  participationType: 'player',
  eventInterests: {
    beach_volleyball: 1,
    tug_of_war: 2,
    corn_toss: 3,
    bote_beach_challenge: 4,
    beach_dodgeball: 5
  }
};

test('defaults to playing and requires eventInterests', () => {
  const r = signupFormSchema.safeParse({ ...base, eventInterests: undefined });
  assert.equal(r.success, false);
});

test('spectator may omit eventInterests', () => {
  const r = signupFormSchema.safeParse({ ...base, participationType: 'spectator', eventInterests: undefined });
  assert.equal(r.success, true);
});

test('player with all five interests is valid', () => {
  assert.equal(signupFormSchema.safeParse(base).success, true);
});
