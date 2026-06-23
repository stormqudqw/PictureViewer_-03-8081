import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';
import { estimate } from '../pricing.js';

export const estimateInput = z.object({
  from: z.string().min(2),
  to: z.string().min(2),
  weight: z.coerce.number().min(0).max(100_000),
  volume: z.coerce.number().min(0).max(2_000),
  cargo: z.enum(['ltl', 'ftl', 'oog']),
  speed: z.enum(['std', 'express']),
});

export type EstimateInputSchema = z.infer<typeof estimateInput>;

export const calcRouter = router({
  /** Предварительный расчёт стоимости и срока доставки. */
  estimate: publicProcedure
    .input(estimateInput)
    .query(({ input, ctx }) => estimate(input, ctx.pricing)),
});
