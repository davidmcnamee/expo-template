import { Stack } from 'expo-router';
import { PaymentsLibProvider } from 'crypto-payments-lib';

export default function RootLayout() {
  return (
    <PaymentsLibProvider baseUrl="http://localhost:3000/trpc">
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Crypto Payments' }} />
        <Stack.Screen name="payment" options={{ title: 'Payment Details' }} />
      </Stack>
    </PaymentsLibProvider>
  );
}
