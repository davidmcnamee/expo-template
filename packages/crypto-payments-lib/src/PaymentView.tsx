import React, { useState } from 'react';
import { StyleSheet, Text, View, Button, TextInput, Alert } from 'react-native';
import { useTRPC } from './trpc';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSubscription }  from '@trpc/tanstack-react-query'

export function PaymentView() {
  const [amount, setAmount] = useState('0.001');
  const [currency, setCurrency] = useState<'BTC' | 'ETH' | 'USDC'>('BTC');
  const [address, setAddress] = useState('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const trpc = useTRPC();

  const healthQuery = useQuery(trpc.health.queryOptions());
  const paymentMethodsQuery = useQuery(trpc.getPaymentMethods.queryOptions());
  const createPaymentMutation = useMutation(trpc.createPayment.mutationOptions());

  useSubscription(trpc.onPaymentUpdate.subscriptionOptions(undefined, {
    onData: (data: any) => {
      console.log('Received subscription data:', data);
      if (data.type === 'created') {
        setRecentPayments(prev => [data.payment, ...prev.slice(0, 4)]);
        Alert.alert('Payment Update', `New payment created: ${data.payment.id}`);
      } else if (data.type === 'statusChange') {
        setRecentPayments(prev => 
          prev.map(p => p.id === data.payment.id ? data.payment : p)
        );
        Alert.alert('Payment Update', `Payment ${data.payment.id} status: ${data.payment.status}`);
      }
    },
    onError: (error: any) => {
      console.error('Subscription error:', error);
    },
    onStarted: () => {
      console.log('Subscription started');
    },
  }));

  const handleTrpcPayment = () => {
    createPaymentMutation.mutate({
      amount: parseFloat(amount),
      currency,
      recipient: address
    }, {
      onSuccess: (data: any) => {
        Alert.alert('tRPC Payment Created', `Payment ID: ${data.id}`);
      },
      onError: (error: any) => {
        Alert.alert('tRPC Error', error.message);
      }
    });
  };

  return (
    <View style={styles.form}>
      <Text style={styles.subtitle}>Server Status:</Text>
      <Text>{healthQuery.data ? `${healthQuery.data.status} - ${healthQuery.data.timestamp}` : 'Loading...'}</Text>
      
      <Text style={styles.subtitle}>Available Payment Methods:</Text>
      {paymentMethodsQuery.data?.map((method: any) => (
        <Text key={method.id}>{method.name} ({method.symbol})</Text>
      ))}
      
      <Text style={styles.subtitle}>Payment Form:</Text>
      <Text>Amount:</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />
      
      <Text>Currency: {currency}</Text>
      <View style={styles.currencyButtons}>
        {(['BTC', 'ETH', 'USDC'] as const).map((curr) => (
          <Button
            key={curr}
            title={curr}
            onPress={() => setCurrency(curr)}
            color={currency === curr ? '#007AFF' : '#8E8E93'}
          />
        ))}
      </View>
      
      <Text>Recipient Address:</Text>
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        multiline
      />
      
      <Button 
        title="Send via tRPC" 
        onPress={handleTrpcPayment}
        disabled={createPaymentMutation.isPending}
      />

      <Text style={styles.subtitle}>Recent Payments (Live Updates):</Text>
      {recentPayments.length === 0 ? (
        <Text>No recent payments. Create one to see live updates!</Text>
      ) : (
        recentPayments.map((payment) => (
          <View key={payment.id} style={styles.paymentItem}>
            <Text>ID: {payment.id.slice(0, 8)}...</Text>
            <Text>Amount: {payment.amount} {payment.currency}</Text>
            <Text>Status: {payment.status}</Text>
            <Text>To: {payment.recipient.slice(0, 20)}...</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    width: '100%',
    maxWidth: 400,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    marginVertical: 10,
    borderRadius: 5,
  },
  currencyButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 10,
  },
  spacer: {
    height: 20,
  },
  paymentItem: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    marginVertical: 5,
    borderRadius: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
});