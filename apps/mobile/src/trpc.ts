import { createTRPCReact } from '@trpc/react-query';
import Constants from 'expo-constants';
import type { AppRouter } from '@altay/api';

export const trpc = createTRPCReact<AppRouter>();

export function getApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const fromConfig = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  return fromEnv ?? fromConfig ?? 'http://localhost:4000';
}
