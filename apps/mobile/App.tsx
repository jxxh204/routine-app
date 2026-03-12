import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL?.trim();

export default function App() {
  if (!WEB_APP_URL) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loader}>
          <Text style={styles.errorTitle}>환경변수 누락</Text>
          <Text style={styles.errorText}>
            EXPO_PUBLIC_WEB_APP_URL 을 설정해 주세요.
          </Text>
        </View>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        source={{ uri: WEB_APP_URL }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator size="large" />
          </View>
        )}
      />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
