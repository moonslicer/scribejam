import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        ink: '#101828',
        slate: '#667085'
      }
    }
  },
  plugins: []
};

export default config;
