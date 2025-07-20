import { Alert } from 'react-native';

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export interface CryptoPaymentOptions {
  amount: number;
  currency: 'BTC' | 'ETH' | 'USDC';
  recipientAddress: string;
}

export class CryptoPayments {
  static async processPayment(options: CryptoPaymentOptions): Promise<PaymentResult> {
    // Simulate payment processing
    return new Promise((resolve) => {
      setTimeout(() => {
        const success = Math.random() > 0.3; // 70% success rate
        if (success) {
          resolve({
            success: true,
            transactionId: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          });
        } else {
          resolve({
            success: false,
            error: 'Payment failed - insufficient funds or network error'
          });
        }
      }, 2000);
    });
  }

  static showPaymentAlert(result: PaymentResult) {
    if (result.success) {
      Alert.alert('Payment Successful', `Transaction ID: ${result.transactionId}`);
    } else {
      Alert.alert('Payment Failed', result.error || 'Unknown error');
    }
  }
}

export { PaymentView } from './PaymentView';
export default CryptoPayments;
