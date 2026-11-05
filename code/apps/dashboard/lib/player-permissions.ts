// Showcase note: a permission predicate small enough to test exhaustively. Server actions call
// this instead of restating the rule.

import { Role } from '@workspace/database/schema';

export type PlayerPermissionInput = {
  /** Session flag for SportsFest super admins. */
  isSportsFestAdmin: boolean;
  /** The caller's membership role in the organization, or null when not a member. */
  membershipRole: Role | null;
};

/** Super admins, and organization admins for their own organization, may view and change player records. */
export function canManageOrganizationPlayers({ isSportsFestAdmin, membershipRole }: PlayerPermissionInput): boolean {
  return isSportsFestAdmin || membershipRole === Role.ADMIN;
}
