import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc, getApiUrl } from './src/trpc';
import { HomeScreen } from './src/screens/HomeScreen';

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getApiUrl()}/trpc`,
          headers: () => ({ 'x-trpc-source': 'mobile' }),
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <HomeScreen />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
