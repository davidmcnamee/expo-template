const isDev = process.env.EXPO_ENV !== 'production';

// https://docs.expo.dev/versions/latest/config/app/
export default {
  expo: {
    scheme: "acme",
    plugins: [
      "expo-router"
    ],
    name: `Crypto Payments Example${isDev ? ' Dev' : ''}`,
    slug: `crypto-payments-example${isDev ? '-dev' : ''}`,
    icon: `./assets/icon${isDev ? '-dev' : ''}.png`,
    splash: {
      image: `./assets/icon${isDev ? '-dev' : ''}.png`,
      backgroundColor: "#252627",
      resizeMode: "contain"
    },
    notification: {
      icon: `./assets/icon${isDev ? '-dev' : ''}.png`
    },
    ios: {
      bundleIdentifier: `io.mcnamee.crypto-payments-example${isDev ? '-dev' : ''}`
    },
    android: {
      package: `io.mcnamee.cryptopaymentsexample${isDev ? 'dev' : ''}`,
      adaptiveIcon: {
        foregroundImage: `./assets/icon${isDev ? '-dev' : ''}-adaptive.png`,
        backgroundColor: "#252627"
      },
      notification: {
        icon: `./assets/icon${isDev ? '-dev' : ''}.png`
      }
    },
    extra: {
      environment: isDev ? 'development' : 'production'
    }
  }
};
