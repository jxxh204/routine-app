import { registerRootComponent } from 'expo';
import { ErrorUtils } from 'react-native';

import App from './App';

// Global error handler to prevent crashes from unhandled errors
const originalHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.warn(`[GlobalErrorHandler] ${isFatal ? 'FATAL' : 'non-fatal'}:`, error);
  if (originalHandler) {
    originalHandler(error, isFatal);
  }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
