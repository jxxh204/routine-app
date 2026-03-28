import { registerRootComponent } from 'expo';
import { Alert, ErrorUtils } from 'react-native';

import App from './App';

// Global error handler — show error details via Alert for diagnosis
const originalHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  const msg = error?.message ?? String(error);
  const stack = error?.stack?.split('\n').slice(0, 5).join('\n') ?? '';
  try {
    Alert.alert(
      isFatal ? '[FATAL ERROR]' : '[ERROR]',
      `${msg}\n\n${stack}`,
    );
  } catch { /* Alert may fail in some states */ }
  // Don't call originalHandler for fatal errors — it would kill the app
  // and we'd never see the Alert
  if (!isFatal && originalHandler) {
    originalHandler(error, isFatal);
  }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
