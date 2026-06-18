import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.geogiardini.app',
  appName: 'GeoGiardini',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // In produzione usa l'URL live, in dev usa localhost
    // (commenta la riga sotto per sviluppo locale)
    // url: 'https://geogiardini.it',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
