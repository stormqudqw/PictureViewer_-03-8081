// Канонический справочник городов «Алтай Логистик».
// Используется и для расчёта стоимости (координаты), и для наполнения БД.

export type Country = 'RU' | 'KZ' | 'BY';

export interface City {
  code: string;
  name: string;
  country: Country;
  lat: number;
  lng: number;
}

export const CITIES: City[] = [
  { code: 'BNL', name: 'Барнаул', country: 'RU', lat: 53.36, lng: 83.76 },
  { code: 'NSK', name: 'Новосибирск', country: 'RU', lat: 55.03, lng: 82.92 },
  { code: 'MSK', name: 'Москва', country: 'RU', lat: 55.75, lng: 37.62 },
  { code: 'SPB', name: 'Санкт-Петербург', country: 'RU', lat: 59.94, lng: 30.31 },
  { code: 'EKB', name: 'Екатеринбург', country: 'RU', lat: 56.84, lng: 60.65 },
  { code: 'KZN', name: 'Казань', country: 'RU', lat: 55.79, lng: 49.12 },
  { code: 'KRD', name: 'Краснодар', country: 'RU', lat: 45.04, lng: 38.98 },
  { code: 'VVO', name: 'Владивосток', country: 'RU', lat: 43.12, lng: 131.89 },
  { code: 'ALA', name: 'Алматы', country: 'KZ', lat: 43.24, lng: 76.89 },
  { code: 'AST', name: 'Астана', country: 'KZ', lat: 51.13, lng: 71.43 },
  { code: 'MNK', name: 'Минск', country: 'BY', lat: 53.9, lng: 27.57 },
];

export const CITY_BY_CODE: Record<string, City> = Object.fromEntries(
  CITIES.map((c) => [c.code, c]),
);

export const COUNTRY_NAMES: Record<Country, string> = {
  RU: 'Россия',
  KZ: 'Казахстан',
  BY: 'Беларусь',
};
