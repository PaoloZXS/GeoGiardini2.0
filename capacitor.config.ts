import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.geogiardini.app',
  appName: 'GeoGiardini',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  }
};

export default config;
