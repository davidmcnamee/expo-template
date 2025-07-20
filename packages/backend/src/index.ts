import express from 'express';
import cors from 'cors';
import { initTRPC } from '@trpc/server';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { z } from 'zod';

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
      recipient: z.string()
    }))
    .mutation(({ input }) => {
      return {
        id: Math.random().toString(36).substr(2, 9),
        ...input,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
    })
});

export type AppRouter = typeof appRouter;

const app = express();
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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});