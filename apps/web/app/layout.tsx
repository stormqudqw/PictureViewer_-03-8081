import type { Metadata, Viewport } from 'next';
import { Geologica, Golos_Text, IBM_Plex_Mono } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const geologica = Geologica({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-geologica',
  display: 'swap',
});

const golos = Golos_Text({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-golos',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500'],
  variable: '--font-mono-ibm',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Алтай Логистик — грузоперевозки по России, Казахстану и Беларуси',
  description:
    'Транспортная компания «Алтай Логистик»: сборные и отдельные грузы, негабарит, склад и международные перевозки по России, Казахстану и Беларуси. Прозрачный расчёт стоимости за 30 секунд.',
  keywords: [
    'грузоперевозки',
    'логистика',
    'Алтай Логистик',
    'доставка грузов',
    'Россия Казахстан Беларусь',
    'сборный груз',
  ],
  openGraph: {
    title: 'Алтай Логистик — доставим груз туда, где вас ждут',
    description: 'Грузоперевозки по России, Казахстану и Беларуси. От 1 кг до фуры.',
    type: 'website',
    locale: 'ru_RU',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FCFCFB',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${geologica.variable} ${golos.variable} ${mono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
