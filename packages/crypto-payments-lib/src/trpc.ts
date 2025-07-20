import {
  createWSClient, httpBatchLink, createTRPCClient as rawCreateTRPCClient,
  splitLink,
  wsLink
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "backend";

export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();

export function createTrpcClient({ baseUrl }: { baseUrl: string }) {
  if(!baseUrl.startsWith('http')) {
    throw new Error('Invalid base URL, must start with http or https');
  }
  if(!baseUrl.endsWith('/trpc')) {
    throw new Error('Invalid base URL, must end with /trpc');
  }
  const wsClient = createWSClient({
    url: baseUrl.replace('http://', 'ws://').replace('https://', 'wss://'),
  });

  const client = rawCreateTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition(op) {
          // Use WebSocket for subscriptions, HTTP for queries and mutations
          return op.type === "subscription";
        },
        true: wsLink({
          client: wsClient,
        }),
        false: httpBatchLink({
          url: baseUrl,
        }),
      }),
    ],
  });
  return client;
}
