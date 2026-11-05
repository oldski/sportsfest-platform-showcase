// Showcase note: Sentry on the server runtime.

import { init } from '@sentry/nextjs';

import { keys } from '../../../keys';

type Parameters<T extends (args: never) => unknown> = T extends (
  ...args: infer P
) => unknown
  ? P
  : never;

export function initializeSentryServerClient(
  props: Parameters<typeof init>[0] = {}
) {
  return init({
    dsn: keys().NEXT_PUBLIC_MONITORING_SENTRY_DSN,
    tracesSampleRate: props?.tracesSampleRate ?? 0.1,
    ...props
  });
}
