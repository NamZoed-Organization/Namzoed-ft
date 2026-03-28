import { registerRootComponent } from 'expo';

import App from './App';

// Suppress noisy dev-only HMR bridge errors that don't affect app behaviour
if (__DEV__) {
  const _err = console.error;
  console.error = (...args) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (msg.includes('InvocationTargetException')) return;
    _err(...args);
  };
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
