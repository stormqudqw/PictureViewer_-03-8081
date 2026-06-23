export function fmtNumber(n: number): string {
  return n.toLocaleString('ru-RU');
}

export function dayWord(d: number): string {
  const m = d % 10;
  const h = d % 100;
  if (m === 1 && h !== 11) return 'день';
  if (m >= 2 && m <= 4 && (h < 10 || h >= 20)) return 'дня';
  return 'дней';
}

// Резервный список городов на случай, если API ещё не ответил.
export const FALLBACK_CITIES: { code: string; name: string }[] = [
  { code: 'BNL', name: 'Барнаул' },
  { code: 'NSK', name: 'Новосибирск' },
  { code: 'MSK', name: 'Москва' },
  { code: 'SPB', name: 'Санкт-Петербург' },
  { code: 'EKB', name: 'Екатеринбург' },
  { code: 'KZN', name: 'Казань' },
  { code: 'KRD', name: 'Краснодар' },
  { code: 'VVO', name: 'Владивосток' },
  { code: 'ALA', name: 'Алматы' },
  { code: 'AST', name: 'Астана' },
  { code: 'MNK', name: 'Минск' },
];
