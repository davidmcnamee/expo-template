import React, { useState } from 'react';
import { StyleSheet, Text, View, Button, TextInput, Alert } from 'react-native';
import { useTRPC } from './trpc';
import { useMutation, useQuery } from '@tanstack/react-query';

export function PaymentView() {
  const [amount, setAmount] = useState('0.001');
  const [currency, setCurrency] = useState<'BTC' | 'ETH' | 'USDC'>('BTC');
  const [address, setAddress] = useState('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
  const [loading, setLoading] = useState(false);
  const trpc = useTRPC();

  const healthQuery = useQuery(trpc.health.queryOptions());
  const paymentMethodsQuery = useQuery(trpc.getPaymentMethods.queryOptions());
  const createPaymentMutation = useMutation(trpc.createPayment.mutationOptions());

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
});