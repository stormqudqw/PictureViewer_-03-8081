import { CITY_BY_CODE, type City } from '@altay/db';

export type CargoType = 'ltl' | 'ftl' | 'oog';
export type Speed = 'std' | 'express';

export interface EstimateInput {
  from: string;
  to: string;
  weight: number;
  volume: number;
  cargo: CargoType;
  speed: Speed;
}

export interface EstimateResult {
  routeCode: string;
  distanceKm: number;
  days: number;
  price: number;
  currency: 'RUB';
  chargeableKg: number;
}

export interface PricingConfig {
  basePrice: number;
  volumetricDivisor: number;
}

export const DEFAULT_PRICING: PricingConfig = {
  basePrice: 1000,
  volumetricDivisor: 250,
};

/** Расстояние по дуге большого круга, км. */
export function haversine(a: City, b: City): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Корректное склонение слова «день». */
export function dayWord(d: number): string {
  const m = d % 10;
  const h = d % 100;
  if (m === 1 && h !== 11) return 'день';
  if (m >= 2 && m <= 4 && (h < 10 || h >= 20)) return 'дня';
  return 'дней';
}

/**
 * Предварительный расчёт стоимости перевозки.
 * Логика перенесена один-в-один из дизайн-прототипа лендинга.
 */
export function estimate(
  input: EstimateInput,
  config: PricingConfig = DEFAULT_PRICING,
): EstimateResult {
  const from = CITY_BY_CODE[input.from];
  const to = CITY_BY_CODE[input.to];
  if (!from || !to) {
    throw new Error('Неизвестный город маршрута');
  }

  const { basePrice, volumetricDivisor } = config;

  let km = Math.round(haversine(from, to) * 1.25); // дорожный коэффициент над прямой
  if (input.from === input.to) km = 0;

  const w = Number(input.weight) || 0;
  const vol = Number(input.volume) || 0;
  const chargeable = Math.max(w, vol * volumetricDivisor);

  let price: number;
  if (input.cargo === 'ftl') {
    price = basePrice + km * 52;
  } else if (input.cargo === 'oog') {
    price = (basePrice + km * 52) * 1.6 + chargeable * 4;
  } else {
    const ratePerKg = 6 + km * 0.012;
    price = basePrice + chargeable * ratePerKg;
  }
  if (input.speed === 'express') price *= 1.4;
  price = km === 0 ? 0 : Math.max(1500, Math.round(price / 100) * 100);

  let days = km === 0 ? 0 : Math.ceil(km / 700) + 1;
  if (input.speed === 'express') days = Math.max(1, days - 1);

  return {
    routeCode: `${input.from} → ${input.to}`,
    distanceKm: km,
    days,
    price,
    currency: 'RUB',
    chargeableKg: Math.round(chargeable),
  };
}
