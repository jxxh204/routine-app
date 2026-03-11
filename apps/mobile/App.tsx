import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

const WEB_APP_URL = 'http://localhost:3000/today';

export default function App() {
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
  },
});
