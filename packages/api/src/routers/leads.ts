import { z } from 'zod';
import { desc } from 'drizzle-orm';
import { leads } from '@altay/db';
import { router, publicProcedure } from '../trpc.js';
import { estimate } from '../pricing.js';

export const createLeadInput = z.object({
  name: z.string().min(2, 'Укажите имя').max(120),
  phone: z.string().min(5, 'Укажите телефон').max(40),
  message: z.string().max(2000).optional(),
  // Необязательный снимок параметров расчёта.
  route: z
    .object({
      from: z.string(),
      to: z.string(),
      weight: z.coerce.number(),
      volume: z.coerce.number(),
      cargo: z.enum(['ltl', 'ftl', 'oog']),
      speed: z.enum(['std', 'express']),
    })
    .optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadInput>;

export const leadsRouter = router({
  /** Создание заявки с сайта или из мобильного приложения. */
  create: publicProcedure.input(createLeadInput).mutation(async ({ input, ctx }) => {
    let estimatedPrice: number | null = null;
    if (input.route) {
      try {
        estimatedPrice = estimate(input.route, ctx.pricing).price;
      } catch {
        estimatedPrice = null;
      }
    }

    const [row] = await ctx.db
      .insert(leads)
      .values({
        name: input.name,
        phone: input.phone,
        message: input.message ?? null,
        fromCode: input.route?.from ?? null,
        toCode: input.route?.to ?? null,
        weightKg: input.route ? Math.round(input.route.weight) : null,
        volumeM3: input.route?.volume ?? null,
        cargoType: input.route?.cargo ?? null,
        speed: input.route?.speed ?? null,
        estimatedPrice,
        source: ctx.source,
      })
      .returning({ id: leads.id });

    return { id: row!.id, ok: true as const };
  }),

  /** Последние заявки — для админских интеграций. */
  recent: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .query(({ input, ctx }) =>
      ctx.db
        .select()
        .from(leads)
        .orderBy(desc(leads.createdAt))
        .limit(input?.limit ?? 20),
    ),
});
