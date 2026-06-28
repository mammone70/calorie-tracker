/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0f172a',
        surface: '#1e293b',
        'surface-alt': '#334155',
        border: '#475569',
        'border-light': '#334155',
        foreground: '#f8fafc',
        'foreground-secondary': '#cbd5e1',
        muted: '#94a3b8',
        primary: '#3b82f6',
        'primary-dark': '#2563eb',
        danger: '#f87171',
        'danger-dark': '#dc2626',
        'danger-border': '#7f1d1d',
        track: '#334155',
        'dot-override': '#f87171',
        'dot-weekly': '#3b82f6',
      },
      padding: {
        safe: 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      },
    },
  },
  plugins: [],
};
