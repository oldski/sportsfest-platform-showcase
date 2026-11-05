# Code folder

Real files from the SportsFest platform, copied out of the private repository and scrubbed
of secrets, identifiers and client-specific copy. Each file starts with a short showcase note
saying what to look at. The folder keeps the monorepo's paths so the shape is visible from the
tree alone. It is not runnable: imports of files that were not copied are left as written.

## Monorepo and tooling

- `turbo.json` — the Turborepo task graph for three apps and twelve packages; `globalEnv` lists every environment variable the build depends on (names only; several analytics entries are template leftovers that the product does not use).
- `pnpm-workspace.yaml` — the workspace is three globs: apps, packages, tooling.
- `tooling/typescript-config/` — shared TypeScript presets (`base`, `nextjs`, `react-library`) that every app and package extends.

## Design system

- `packages/ui/package.json` — the shared UI package: shadcn/ui components on Radix primitives, Tailwind, TanStack Table, Recharts, and no app-specific dependency.
- `packages/ui/src/components/button.tsx` — the base Button with its variant system; every surface in the product uses it.
- `packages/ui/src/components/data-table.tsx` — the composed DataTable that every list in the product is built on.
- `packages/ui/src/components/chart.tsx` — the Recharts wrapper under every analytics card.
- `apps/dashboard/components/organizations/slug/players/players-data-table.tsx` — a product table composed from DataTable: role filter and badge, row actions, CSV, Excel and PDF exports.
