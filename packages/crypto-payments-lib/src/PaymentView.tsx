import React, { useState } from 'react';
import { StyleSheet, Text, View, Button, TextInput, Alert } from 'react-native';
import { CryptoPayments, CryptoPaymentOptions } from './index';

export function PaymentView() {
  const [amount, setAmount] = useState('0.001');
  const [currency, setCurrency] = useState<'BTC' | 'ETH' | 'USDC'>('BTC');
  const [address, setAddress] = useState('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    
    const options: CryptoPaymentOptions = {
      amount: parseFloat(amount),
      currency,
      recipientAddress: address
    };

    try {
      const result = await CryptoPayments.processPayment(options);
      CryptoPayments.showPaymentAlert(result);
    } catch (error) {
      Alert.alert('Error', 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.form}>
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
        title={loading ? 'Processing...' : 'Send Payment'}
        onPress={handlePayment}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    width: '100%',
    maxWidth: 400,
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
});