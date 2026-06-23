import {
  pgTable,
  text,
  integer,
  doublePrecision,
  serial,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const countryEnum = pgEnum('country', ['RU', 'KZ', 'BY']);
export const cargoTypeEnum = pgEnum('cargo_type', ['ltl', 'ftl', 'oog']);
export const speedEnum = pgEnum('speed', ['std', 'express']);
export const leadStatusEnum = pgEnum('lead_status', ['new', 'in_progress', 'done', 'rejected']);

/** Справочник городов сети доставки. */
export const cities = pgTable('cities', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  country: countryEnum('country').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
});

/** Заявки с сайта и из мобильного приложения. */
export const leads = pgTable('leads', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  message: text('message'),

  // Снимок параметров расчёта на момент заявки (необязательный).
  fromCode: text('from_code'),
  toCode: text('to_code'),
  weightKg: integer('weight_kg'),
  volumeM3: doublePrecision('volume_m3'),
  cargoType: cargoTypeEnum('cargo_type'),
  speed: speedEnum('speed'),
  estimatedPrice: integer('estimated_price'),

  status: leadStatusEnum('status').notNull().default('new'),
  source: text('source').notNull().default('web'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type City = typeof cities.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
