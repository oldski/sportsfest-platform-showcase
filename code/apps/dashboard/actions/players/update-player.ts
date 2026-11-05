// Showcase note: a server action in its full shape: Zod-validated input, session and permission
// check, a transaction that also removes roster rows when a player becomes a spectator, then
// path revalidation. Mutations in the product are server actions, not API routes.

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getAuthContext } from '@workspace/auth/context';
import { canManageOrganizationPlayers } from '~/lib/player-permissions';
import { db, eq, and } from '@workspace/database/client';
import {
  playerTable,
  membershipTable,
  teamRosterTable,
  eventRosterTable,
  TShirtSize,
  ParticipationType
} from '@workspace/database/schema';

const updatePlayerSchema = z.object({
  playerId: z.string().uuid('Invalid player ID'),
  organizationId: z.string().uuid('Invalid organization ID'),
  phone: z.string().max(32, 'Phone number too long').nullable().optional(),
  tshirtSize: z.nativeEnum(TShirtSize, { errorMap: () => ({ message: 'Invalid t-shirt size' }) }),
  participationType: z.enum([ParticipationType.PLAYER, ParticipationType.SPECTATOR], {
    errorMap: () => ({ message: 'Role must be playing or spectating' })
  })
});

export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;

export type UpdatePlayerResult = {
  success: boolean;
  error?: string;
};

export async function updatePlayer(
  input: UpdatePlayerInput
): Promise<UpdatePlayerResult> {
  try {
    const { session } = await getAuthContext();

    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized: Please sign in' };
    }

    const validatedData = updatePlayerSchema.parse(input);

    // Check if user has permission to manage players in this organization
    const [membership] = await db
      .select({
        role: membershipTable.role
      })
      .from(membershipTable)
      .where(
        and(
          eq(membershipTable.userId, session.user.id),
          eq(membershipTable.organizationId, validatedData.organizationId)
        )
      );

    // Allow organization admins or super admins
    const canManage = canManageOrganizationPlayers({
      isSportsFestAdmin: session.user.isSportsFestAdmin === true,
      membershipRole: membership?.role ?? null
    });

    if (!canManage) {
      return { success: false, error: 'Unauthorized: You do not have permission to manage players in this organization' };
    }

    // Get the existing player to verify it belongs to this organization
    const [existingPlayer] = await db
      .select({
        id: playerTable.id,
        organizationId: playerTable.organizationId
      })
      .from(playerTable)
      .where(eq(playerTable.id, validatedData.playerId));

    if (!existingPlayer) {
      return { success: false, error: 'Player not found' };
    }

    if (existingPlayer.organizationId !== validatedData.organizationId) {
      return { success: false, error: 'Player does not belong to this organization' };
    }

    // Update the player. A spectator cannot sit on rosters, so switching to
    // spectator clears their team and event roster rows in the same transaction.
    // (A player record belongs to one event year, so every roster row is that year's.)
    const isBecomingSpectator = validatedData.participationType === ParticipationType.SPECTATOR;
    await db.transaction(async (tx) => {
      await tx
        .update(playerTable)
        .set({
          phone: validatedData.phone,
          tshirtSize: validatedData.tshirtSize,
          participationType: validatedData.participationType,
          updatedAt: new Date()
        })
        .where(eq(playerTable.id, validatedData.playerId));

      if (isBecomingSpectator) {
        await tx.delete(eventRosterTable).where(eq(eventRosterTable.playerId, validatedData.playerId));
        await tx.delete(teamRosterTable).where(eq(teamRosterTable.playerId, validatedData.playerId));
      }
    });

    // Revalidate the players page and the teams page (rosters may have changed)
    revalidatePath('/organizations/[slug]/players', 'page');
    revalidatePath('/organizations/[slug]/teams', 'page');

    return { success: true };
  } catch (error) {
    console.error('Error updating player:', error);

    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || 'Validation error' };
    }

    return { success: false, error: 'Failed to update player' };
  }
}
