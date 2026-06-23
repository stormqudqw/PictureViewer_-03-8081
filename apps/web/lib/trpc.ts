'use client';

import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@altay/api';

export const trpc = createTRPCReact<AppRouter>();

export function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}
