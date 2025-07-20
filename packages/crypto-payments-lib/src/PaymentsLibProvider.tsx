import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTrpcClient, TRPCProvider } from './trpc';

const queryClient = new QueryClient();

export function PaymentsLibProvider({ baseUrl, children }: {
  baseUrl: string,
  children: React.ReactNode;
}) {
  const trpcClient = createTrpcClient({ baseUrl });
  
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
