import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Linking, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL?.trim();
const ALLOWED_HOSTS = (process.env.EXPO_PUBLIC_WEB_APP_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host: string) => host.trim().toLowerCase())
  .filter(Boolean);

function getParsedUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isAllowedUrl(rawUrl: string) {
  const parsed = getParsedUrl(rawUrl);
  if (!parsed) return false;

  const isHttps = parsed.protocol === 'https:';
  if (!isHttps) return false;

  if (ALLOWED_HOSTS.length === 0) {
    return true;
  }

  return ALLOWED_HOSTS.includes(parsed.hostname.toLowerCase());
}

function AppError({ title, detail }: { title: string; detail: string }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loader}>
        <Text style={styles.errorTitle}>{title}</Text>
        <Text style={styles.errorText}>{detail}</Text>
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

export default function App() {
  if (!WEB_APP_URL) {
    return (
      <AppError
        title="환경변수 누락"
        detail="EXPO_PUBLIC_WEB_APP_URL 을 설정해 주세요."
      />
    );
  }

  if (!isAllowedUrl(WEB_APP_URL)) {
    return (
      <AppError
        title="보안 설정 오류"
        detail="HTTPS URL 및 허용 도메인(EXPO_PUBLIC_WEB_APP_ALLOWED_HOSTS)을 확인해 주세요."
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        source={{ uri: WEB_APP_URL }}
        startInLoadingState
        originWhitelist={['https://*']}
        onShouldStartLoadWithRequest={(request) => {
          if (isAllowedUrl(request.url)) {
            return true;
          }

          void Linking.openURL(request.url);
          return false;
        }}
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
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});
