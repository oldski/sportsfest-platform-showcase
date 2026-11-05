// Showcase note: schema tests. Not runnable from this folder.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { teamSignupSchema } from './team-signup-schema';

const base = {
  organizationId: '11111111-1111-4111-8111-111111111111',
  firstName: 'Spec',
  lastName: 'Tator',
  dateOfBirth: '1990-01-01T00:00:00.000Z',
  email: 'spec.tator@example.com',
  phone: '8135551234',
  gender: 'male',
  tshirtSize: 'm',
  confirmAccuracy: true,
  waiverAgreement: true,
  eventInterests: { beach_volleyball: 1 }
};

test('accepts a payload without participationType as a player', () => {
  const r = teamSignupSchema.safeParse(base);
  assert.equal(r.success, true);
  assert.equal(r.success && r.data.participationType, 'player');
});

test('player without eventInterests is rejected', () => {
  const r = teamSignupSchema.safeParse({ ...base, eventInterests: undefined });
  assert.equal(r.success, false);
  assert.match(JSON.stringify(r.success ? {} : r.error.issues), /eventInterests/);
});

test('spectator without eventInterests is valid', () => {
  const r = teamSignupSchema.safeParse({ ...base, participationType: 'spectator', eventInterests: undefined });
  assert.equal(r.success, true);
});

test('spectator with eventInterests present is valid', () => {
  assert.equal(teamSignupSchema.safeParse({ ...base, participationType: 'spectator' }).success, true);
});

test('substitute is rejected', () => {
  assert.equal(teamSignupSchema.safeParse({ ...base, participationType: 'substitute' }).success, false);
});
