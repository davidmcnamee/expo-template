import React from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import { router } from 'expo-router';

export default function PaymentPage() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment Details</Text>
      <Text style={styles.subtitle}>
        This is a sample payment details page using Expo Router
      </Text>
      <Button title="Go Back" onPress={() => router.back()} />
    </View>
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
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
});