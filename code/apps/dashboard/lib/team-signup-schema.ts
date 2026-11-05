// Showcase note: the signup payload schema the API route validates with. Players must rank
// their event interests; spectators may omit them. The marketing form has a sibling schema.

import { z } from 'zod';

import { Gender, ParticipationType, TShirtSize } from '@workspace/database/schema';

/** Roles the public signup form may submit. `substitute` is reserved until its roster behavior is designed. */
export const SIGNUP_PARTICIPATION_TYPES = [ParticipationType.PLAYER, ParticipationType.SPECTATOR] as const;

/**
 * Validation for POST /api/team-signup. Spectators skip event interests;
 * players must rank at least one event.
 */
export const teamSignupSchema = z
  .object({
    organizationId: z.string().uuid('Invalid organization ID'),
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().min(1, 'Last name is required').max(100),
    dateOfBirth: z.string().datetime('Invalid date of birth').transform((str) => new Date(str)),
    email: z.string().email('Invalid email address').max(255),
    phone: z.string().optional(),
    gender: z.nativeEnum(Gender),
    tshirtSize: z.nativeEnum(TShirtSize),
    confirmAccuracy: z.boolean().refine((val) => val === true, 'You must confirm the accuracy of your information'),
    waiverAgreement: z.boolean().refine((val) => val === true, 'You must agree to the waiver terms'),
    participationType: z.enum(SIGNUP_PARTICIPATION_TYPES).default(ParticipationType.PLAYER),
    eventInterests: z.record(z.string(), z.number().min(1).max(5)).optional()
  })
  .superRefine((data, ctx) => {
    const hasInterests = data.eventInterests && Object.keys(data.eventInterests).length > 0;
    if (data.participationType === ParticipationType.PLAYER && !hasInterests) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['eventInterests'],
        message: 'Event interests are required for players'
      });
    }
  });

export type TeamSignupInput = z.infer<typeof teamSignupSchema>;
