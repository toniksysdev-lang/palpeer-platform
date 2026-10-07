/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-secondary': 'rgb(var(--color-surface-secondary) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          hover: 'rgb(var(--color-primary-hover) / <alpha-value>)',
          foreground: 'rgb(var(--color-primary-foreground) / <alpha-value>)',
          50: '#e6f2f3',
          100: '#cce5e7',
          200: '#99cbd0',
          300: '#66b1b8',
          400: '#3397a1',
          500: '#0f626a',
          600: '#0a4a50',
          700: '#08383d',
          800: '#052629',
          900: '#031416',
        },
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
        navy: {
          600: '#27517d',
          800: '#16324f',
        },
      },
      fontFamily: {
        sans: ['"Rubik"', 'Segoe UI', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Rubik"', 'Segoe UI', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        soft: 'var(--shadow-card)',
        card: 'var(--shadow-card)',
        panel: 'var(--shadow-raised)',
        raised: 'var(--shadow-raised)',
        sidebar: 'var(--shadow-sidebar)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'auth-rise': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s infinite',
        'toast-in': 'toast-in 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'auth-rise': 'auth-rise 0.55s ease-out both',
      },
      transitionTimingFunction: {
        smooth: 'ease',
      },
    },
  },
  plugins: [],
};
