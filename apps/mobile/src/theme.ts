export const theme = {
  bg: '#FCFCFB',
  bgAlt: '#F6F5F2',
  ink: '#16171A',
  blue: '#1956E6',
  border: '#E0DFDA',
  muted: '#5C5E62',
  muted2: '#8A8C90',
  muted3: '#9A9C9F',
  white: '#FFFFFF',
  darkMuted: '#8C8E92',
  darkLine: '#2C2E33',
};

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
