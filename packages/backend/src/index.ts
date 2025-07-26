import express from 'express';
import cors from 'cors';
import { initTRPC } from '@trpc/server';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { z } from 'zod';
import { prisma } from './db';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { createEventBus, PaymentEvent, observableToAsyncGenerator } from './events';

// Choose event bus type based on environment
const eventBusType = process.env.NODE_ENV === 'production' ? 'hybrid' : 'memory';
const eventBus = createEventBus(eventBusType, process.env.REDIS_URL);
const t = initTRPC.create();

export const appRouter = t.router({
  hello: t.procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return { message: `Hello, ${input.name}!` };
    }),
  
  health: t.procedure
    .query(() => {
      return { status: 'healthy', timestamp: new Date().toISOString() };
    }),

  getPaymentMethods: t.procedure
    .query(() => {
      return [
        { id: 1, name: 'Bitcoin', symbol: 'BTC' },
        { id: 2, name: 'Ethereum', symbol: 'ETH' },
        { id: 3, name: 'Litecoin', symbol: 'LTC' }
      ];
    }),

  createPayment: t.procedure
    .input(z.object({
      amount: z.number().positive(),
      currency: z.string(),
      recipient: z.string(),
      description: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      const payment = await prisma.payment.create({
        data: {
          amount: input.amount,
          currency: input.currency,
          recipient: input.recipient,
          description: input.description,
          status: 'pending'
        }
      });
      
      // Emit payment update via event bus
      await eventBus.emit({
        type: 'created' as const,
        payment,
        timestamp: new Date(),
        userId: payment.id // or actual user ID if you have authentication
      });
      
      return payment;
    }),

  onPaymentUpdate: t.procedure
    .subscription(async function* () {
      yield* observableToAsyncGenerator(
        eventBus.subscribe(),
        (event: PaymentEvent) => ({
          type: event.type,
          payment: event.payment,
          timestamp: event.timestamp
        })
      );
    }),

  onUserPaymentUpdate: t.procedure
    .input(z.object({ userId: z.string() }))
    .subscription(async function* ({ input }) {
      yield* observableToAsyncGenerator(
        eventBus.subscribeByUserId(input.userId),
        (event: PaymentEvent) => ({
          type: event.type,
          payment: event.payment,
          timestamp: event.timestamp
        })
      );
    })
});

export type AppRouter = typeof appRouter;

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/trpc', createExpressMiddleware({
  router: appRouter,
  createContext: () => ({})
}));

app.get('/', (req, res) => {
  res.json({ message: 'tRPC Backend server is running!' });
});

// WebSocket server for subscriptions
const wss = new WebSocketServer({ server });
const handler = applyWSSHandler({
  wss,
  router: appRouter,
  createContext: () => ({})
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`WebSocket server running on ws://localhost:${port}`);
});

process.on('SIGTERM', async () => {
  handler.broadcastReconnectNotification();
  await eventBus.close();
});

process.on('SIGINT', async () => {
  await eventBus.close();
  process.exit(0);
});
