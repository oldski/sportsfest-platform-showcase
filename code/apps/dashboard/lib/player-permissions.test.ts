// Showcase note: the tests for the predicate (Node test runner). Not runnable from this folder.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Role } from '@workspace/database/schema';

import { canManageOrganizationPlayers } from './player-permissions';

test('super admins can manage players in any organization', () => {
  assert.equal(canManageOrganizationPlayers({ isSportsFestAdmin: true, membershipRole: null }), true);
});

test('organization admins can manage their players', () => {
  assert.equal(canManageOrganizationPlayers({ isSportsFestAdmin: false, membershipRole: Role.ADMIN }), true);
});

test('members and non-members cannot manage players', () => {
  assert.equal(canManageOrganizationPlayers({ isSportsFestAdmin: false, membershipRole: Role.MEMBER }), false);
  assert.equal(canManageOrganizationPlayers({ isSportsFestAdmin: false, membershipRole: null }), false);
});
