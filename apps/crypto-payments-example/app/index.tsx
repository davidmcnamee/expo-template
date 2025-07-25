import React from 'react'
import { Text, View } from 'react-native'
import { PaymentsLibProvider, PaymentView } from 'crypto-payments-lib'

export default function Home() {
    return <View>
        <Text>hello</Text>
        <PaymentsLibProvider baseUrl="http://localhost:3000/trpc">
            <PaymentView />
        </PaymentsLibProvider>
    </View>
}
