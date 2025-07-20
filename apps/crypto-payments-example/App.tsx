import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PaymentView, PaymentsLibProvider } from 'crypto-payments-lib';

function AppContent() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crypto Payments Example</Text>
      <PaymentView />
    </View>
  );
}

export default function App() {
  return (
    <PaymentsLibProvider baseUrl="http://localhost:3000/trpc">
      <AppContent />
    </PaymentsLibProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
});
