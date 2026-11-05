// Showcase note: the form-side schema (React Hook Form + Zod) in the marketing app, mirroring
// the API schema it posts to.

import { z } from 'zod';

import { Gender, ParticipationType, TShirtSize } from './constants';

/**
 * Team signup form validation. Players must rank their event interests;
 * spectators skip that section entirely.
 */
export const signupFormSchema = z
  .object({
    organizationId: z.string().min(1, 'Organization is required'),
    firstName: z.string().min(1, 'First name is required').max(50),
    lastName: z.string().min(1, 'Last name is required').max(50),
    dateOfBirth: z.date({
      required_error: 'Date of birth is required'
    }),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(10, 'Please enter a valid 10-digit phone number').max(10, 'Please enter a valid 10-digit phone number'),
    gender: z.nativeEnum(Gender),
    tshirtSize: z.nativeEnum(TShirtSize),
    participationType: z.enum([ParticipationType.PLAYER, ParticipationType.SPECTATOR]),
    confirmAccuracy: z.boolean().refine(val => val === true, 'You must confirm the accuracy of your information'),
    waiverAgreement: z.boolean().refine(val => val === true, 'You must agree to the waiver terms'),
    eventInterests: z.record(z.string(), z.number().min(1).max(5)).optional()
  })
  .superRefine((data, ctx) => {
    const hasInterests = data.eventInterests && Object.keys(data.eventInterests).length > 0;
    if (data.participationType === ParticipationType.PLAYER && !hasInterests) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['eventInterests'],
        message: 'Please rank your event interests'
      });
    }
  });

export type SignupFormData = z.infer<typeof signupFormSchema>;
