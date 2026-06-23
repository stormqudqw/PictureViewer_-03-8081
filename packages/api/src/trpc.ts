import { initTRPC } from '@trpc/server';
import type { Database } from '@altay/db';
import type { PricingConfig } from './pricing.js';
import { DEFAULT_PRICING } from './pricing.js';

export interface Context {
  db: Database;
  pricing: PricingConfig;
  /** Источник заявки: web | mobile. */
  source: string;
}

export interface CreateContextOptions {
  db: Database;
  pricing?: PricingConfig;
  source?: string;
}

export function createContext(opts: CreateContextOptions): Context {
  return {
    db: opts.db,
    pricing: opts.pricing ?? DEFAULT_PRICING,
    source: opts.source ?? 'web',
  };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
