import { router } from './trpc.js';
import { citiesRouter } from './routers/cities.js';
import { calcRouter } from './routers/calc.js';
import { leadsRouter } from './routers/leads.js';

export const appRouter = router({
  cities: citiesRouter,
  calc: calcRouter,
  leads: leadsRouter,
});

export type AppRouter = typeof appRouter;
