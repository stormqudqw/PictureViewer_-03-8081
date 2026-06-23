# Алтай Логистик

Сайт и мобильное приложение транспортной компании **«Алтай Логистик»** — грузоперевозки
по России, Казахстану и Беларуси: сборные и отдельные грузы, негабарит, склад и
международные перевозки по ЕАЭС.

Монорепозиторий построен на едином типобезопасном API (tRPC): веб, мобильное приложение
и сервер используют одни и те же типы и бизнес-логику расчёта стоимости.

## Стек

| Слой            | Технологии                                  |
| --------------- | ------------------------------------------- |
| Веб             | TypeScript, Next.js (App Router), React 19  |
| Мобильное прил. | TypeScript, Expo (React Native)             |
| Бэкенд          | NestJS + tRPC                               |
| База данных     | PostgreSQL, Drizzle ORM                     |
| API-контракт    | tRPC v11 (общий пакет `@altay/api`)         |

## Структура

```
.
├── apps
│   ├── web        # Next.js — лендинг с калькулятором и формой заявки
│   ├── mobile     # Expo (React Native) — калькулятор и заявка
│   └── server     # NestJS — хостит tRPC-эндпоинт /trpc
├── packages
│   ├── api        # tRPC-роутер (cities, calc, leads) + логика расчёта
│   └── db         # Drizzle-схема, клиент Postgres, справочник городов
└── docker-compose.yml
```

Расчёт стоимости (`packages/api/src/pricing.ts`) перенесён один-в-один из дизайн-прототипа
лендинга: расстояние по формуле гаверсинуса × дорожный коэффициент, объёмный вес,
тарифы по типу перевозки (сборный / отдельная машина / негабарит) и наценка за экспресс.

## Запуск

Требуется Node ≥ 20 и pnpm.

```bash
# 1. Зависимости
pnpm install

# 2. PostgreSQL (Docker)
docker compose up -d

# 3. Миграции + справочник городов
cp apps/server/.env.example apps/server/.env   # при необходимости поправьте DATABASE_URL
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/altay
pnpm db:generate   # сгенерировать SQL-миграции из схемы
pnpm db:migrate    # применить
pnpm db:seed       # заполнить города

# 4. Запуск сервисов
pnpm dev:server    # API на http://localhost:4000  (tRPC: /trpc)
pnpm dev:web       # сайт на http://localhost:3000
pnpm dev:mobile    # Expo dev-сервер
```

Для веба адрес API задаётся через `NEXT_PUBLIC_API_URL` (см. `apps/web/.env.example`),
для мобильного — через `EXPO_PUBLIC_API_URL` или `extra.apiUrl` в `app.json`.

## API (tRPC)

| Процедура        | Тип      | Назначение                                       |
| ---------------- | -------- | ------------------------------------------------ |
| `cities.list`    | query    | Справочник городов сети доставки                 |
| `calc.estimate`  | query    | Предварительный расчёт стоимости и срока          |
| `leads.create`   | mutation | Создание заявки (с опциональным снимком расчёта)  |
| `leads.recent`   | query    | Последние заявки (для админских интеграций)       |
