import express from 'express';
import cors from 'cors';
import { initTRPC } from '@trpc/server';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { z } from 'zod';
import { prisma } from './db';

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
      return payment;
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