# Code folder

Real files from the SportsFest platform, copied out of the private repository and scrubbed
of secrets, identifiers and client-specific copy. Each file starts with a short showcase note
saying what to look at. The folder keeps the monorepo's paths so the shape is visible from the
tree alone. It is not runnable: imports of files that were not copied are left as written.

## Monorepo and tooling

- `turbo.json` — the Turborepo task graph for three apps and twelve packages; `globalEnv` lists the declared environment variables (names only; several analytics entries are template leftovers that the product does not use).
- `pnpm-workspace.yaml` — the workspace is three globs: apps, packages, tooling.
- `tooling/typescript-config/` — shared TypeScript presets (`base`, `nextjs`, `react-library`) that every app and package extends.

## Design system

- `packages/ui/package.json` — the shared UI package: shadcn/ui components on Radix primitives, Tailwind, TanStack Table, Recharts, and no app-specific dependency.
- `packages/ui/src/components/button.tsx` — the base Button with its variant system; every surface in the product uses it.
- `packages/ui/src/components/data-table.tsx` — the composed DataTable that every list in the product is built on.
- `packages/ui/src/components/chart.tsx` — the Recharts wrapper under every analytics card.
- `apps/dashboard/components/organizations/slug/players/players-data-table.tsx` — a product table composed from DataTable: role filter and badge, row actions, CSV, Excel and PDF exports.

## Data model and tenancy

- `packages/database/src/schema.ts` — excerpt of the Drizzle schema: tenant core, event-year scope, and the SportsFest tables. The omitted definitions are listed in a comment at the top.
- `packages/database/rls-policies.sql` — Supabase row-level security policies. They guard the Supabase API surface; the app's own queries are scoped in the data layer (see the note in the file).

## Payments

- `apps/dashboard/lib/stripe.ts` — the Stripe client, configured for card and ACH.
- `apps/dashboard/app/api/stripe/create-payment-intent/route.ts` — leg one: validate the cart server-side, apply deposit and coupon math, create the PaymentIntent.
- `apps/dashboard/app/api/stripe/confirm-payment/route.ts` — leg two: record the confirmed payment and advance the order status; ACH lands as processing.
- `apps/dashboard/app/api/stripe/webhook/route.ts` — leg three: signature-verified, idempotent reconciliation of Stripe events into payments and orders, including delayed ACH settlement.
- `apps/dashboard/components/organizations/slug/registration/sponsorship-payment-method-selector.tsx` — card versus bank transfer in the sponsorship payment UI.

## Email

- `packages/email/src/provider/` — the provider contract and its implementations (Resend in production; Nodemailer, SendGrid, Postmark, console).
- `packages/email/src/templates/purchase-confirmation-email.tsx` — one React Email template with plain-data props.
- `packages/email/src/send-purchase-confirmation-email.ts` — the sender: render, pick provider, send.

## Auth, permissions, and server actions

- `packages/auth/src/providers.ts` — Auth.js providers: Microsoft Entra ID and Google OAuth, plus the template's credentials, TOTP and recovery flows, with sign-in rate limiting.
- `packages/auth/src/providers.types.ts` — provider ids shared by config and UI.
- `packages/auth/src/adapter.ts` — the Drizzle adapter, so auth tables share the schema.
- `apps/dashboard/lib/player-permissions.ts` and `.test.ts` — a small, exhaustively tested permission predicate.
- `apps/dashboard/actions/players/update-player.ts` — a server action end to end: validate, authorize, transact, revalidate.

## Public signup across two apps

- `apps/dashboard/lib/team-signup-schema.ts` and `.test.ts` — the API payload schema; players must rank interests, spectators may skip them.
- `apps/dashboard/app/api/team-signup/route.ts` — the public write endpoint: validate, insert player and interests, notify the organizer, add to Constant Contact.
- `apps/dashboard/lib/constant-contact.ts` — hand-written Constant Contact v3 client with rotating refresh tokens persisted in the database.
- `apps/marketing/components/team-signup/signup-schema.ts` and `.test.ts` — the form-side schema in the marketing app.
- `apps/marketing/components/team-signup/event-interest-ranking.tsx` — the drag-and-drop event ranking on the signup form.

## External content

- `apps/dashboard/data/wordpress/get-recruitment-documents.ts` — pulls the client's recruiting documents from their WordPress site over its REST API.

## Public API

- `apps/public-api/app/organization/route.ts` — an API-key-authenticated route from the third app.

## Observability

- `packages/monitoring/src/provider/sentry/sentry.{client,server,edge}.config.ts` — Sentry configuration per runtime; DSNs come from the environment.
- `apps/dashboard/actions/admin/get-sentry-stats.ts` — the admin health card reading issue counts from the Sentry API.
