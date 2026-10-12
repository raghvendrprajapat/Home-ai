import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gharplan.app',
  appName: 'GharPlan',
  webDir: 'dist',
  loggingBehavior: 'debug',
  server: { hostname: 'localhost', androidScheme: 'https', cleartext: false },
  android: { allowMixedContent: false },
};

export default config;
