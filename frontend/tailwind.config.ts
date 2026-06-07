import type { Config } from 'tailwindcss';

// PartSelect brand, matched to the live site: teal #347778 + gold #F3C04C, sharp corners.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    // The real PartSelect UI has no rounded boxes — flatten radius globally.
    borderRadius: {
      none: '0',
      sm: '0',
      DEFAULT: '0',
      md: '0',
      lg: '0',
      xl: '0',
      '2xl': '0',
      '3xl': '0',
      full: '0',
    },
    extend: {
      colors: {
        brand: {
          teal: '#347778',
          tealDark: '#2B6263',
          tealDeep: '#1E4748',
          tealTint: '#E6EFEF',
          yellow: '#F3C04C',
          yellowDark: '#DCA82E',
          ink: '#18484A',
        },
        ok: { DEFAULT: '#1E8E5A', bg: '#E7F4EC' },
        bad: { DEFAULT: '#C2351F', bg: '#FBEAE7' },
        warn: { DEFAULT: '#B5740A', bg: '#FBF1DE' },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(24,72,74,0.08), 0 1px 1px rgba(24,72,74,0.06)',
        float: '0 10px 30px rgba(24,72,74,0.20)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        blink: { '0%,100%': { opacity: '0.2' }, '50%': { opacity: '1' } },
      },
      animation: {
        'fade-up': 'fade-up 0.25s ease-out',
        blink: 'blink 1.2s infinite',
      },
    },
  },
  plugins: [],
};
export default config;
