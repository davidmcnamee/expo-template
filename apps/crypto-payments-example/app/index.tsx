import React from "react";
import {
  Text,
  View,
  Platform,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { PaymentsLibProvider, PaymentView } from "crypto-payments-lib";

export default function Home() {
  const baseUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    (Platform.OS === "android"
      ? "http://10.0.2.2:3000/trpc"
      : "http://localhost:3000/trpc");

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.content}>
        <Text style={styles.text}>TEST - Can you see this?</Text>
        <Text style={styles.text}>Platform: {Platform.OS}</Text>
        <Text style={styles.text}>Base URL: {baseUrl}</Text>
        <PaymentsLibProvider baseUrl={baseUrl}>
          <PaymentView />
        </PaymentsLibProvider>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f0f0f0",
  },
  text: {
    fontSize: 18,
    color: "#000",
    marginBottom: 10,
    backgroundColor: "yellow",
    padding: 5,
  },
});
