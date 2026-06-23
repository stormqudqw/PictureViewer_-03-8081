import { CITIES, COUNTRY_NAMES } from '@altay/db';
import { router, publicProcedure } from '../trpc.js';

export const citiesRouter = router({
  /** Список городов сети доставки для селектов калькулятора. */
  list: publicProcedure.query(() =>
    CITIES.map((c) => ({
      code: c.code,
      name: c.name,
      country: c.country,
      countryName: COUNTRY_NAMES[c.country],
    })),
  ),
});
