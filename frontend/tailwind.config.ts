import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: {
          bg:      'var(--app-bg)',
          surface: 'var(--app-surface)',
          col:     'var(--app-col)',
          border:  'var(--app-border)',
          text:    'var(--app-text)',
          sub:     'var(--app-sub)',
          muted:   'var(--app-muted)',
          card:    '#ffffff',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card:       'var(--shadow-card)',
        'card-md':  'var(--shadow-card-md)',
      },
    },
  },
  plugins: [],
};

export default config;
