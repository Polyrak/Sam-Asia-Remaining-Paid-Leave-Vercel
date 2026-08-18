import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';

const storedTheme = localStorage.getItem('theme');

export const vuetify = createVuetify({
  theme: {
    defaultTheme: storedTheme === 'dark' ? 'dark' : 'light',
    themes: {
      light: {
        colors: {
          primary: '#2E7D32',
          secondary: '#558B2F',
        },
      },
      dark: {
        colors: {
          primary: '#66BB6A',
          secondary: '#81C784',
        },
      },
    },
  },
  defaults: {
    VCard: { rounded: 'lg' },
    VBtn: { variant: 'outlined' },
  },
});
