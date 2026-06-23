import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter, createContext } from '@altay/api';
import { getDb } from '@altay/db';

/**
 * Express-middleware с tRPC-роутером.
 * Монтируется в main.ts по пути `/trpc`.
 */
export const trpcMiddleware = trpcExpress.createExpressMiddleware({
  router: appRouter,
  createContext: ({ req }) =>
    createContext({
      db: getDb(),
      source: (req.headers['x-trpc-source'] as string | undefined) ?? 'web',
    }),
});
