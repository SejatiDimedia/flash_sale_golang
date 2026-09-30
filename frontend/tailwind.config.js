/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        dark: {
          950: '#0D0D10', // Desktop outer background
          900: '#161619', // Mobile container base background
          850: '#1A1A1E', // Dock and header navigation
          800: '#222227', // Primary card surface
          750: '#28282E', // Secondary surface and input fields
          700: '#32323A', // Subtle borders and dividers
          600: '#42424D', // Active borders and hover states
        },
        coral: {
          DEFAULT: '#FF5A36', // Electric Coral-Orange primary accent
          hover: '#FF451A',
          active: '#E0360D',
          glow: 'rgba(255, 90, 54, 0.28)',
          subtle: 'rgba(255, 90, 54, 0.12)',
        },
        brand: {
          50: '#EEF2FF',
          500: '#FF5A36',
          600: '#FF5A36',
        },
        app: {
          bg: '#161619',
          card: '#222227',
          coral: '#FF5A36',
          dark: '#0D0D10',
          muted: '#8E8E93',
        },
      },
      backgroundImage: {
        'coral-gradient': 'linear-gradient(135deg, #FF643E 0%, #FF451A 100%)',
        'dark-card': 'linear-gradient(180deg, #242429 0%, #1F1F24 100%)',
        'dark-dock': 'linear-gradient(180deg, rgba(26, 26, 30, 0.95) 0%, rgba(22, 22, 25, 0.98) 100%)',
      },
      boxShadow: {
        'coral': '0 4px 18px 0 rgba(255, 90, 54, 0.35)',
        'coral-sm': '0 2px 10px 0 rgba(255, 90, 54, 0.25)',
        'dark-card': '0 4px 20px -2px rgba(0, 0, 0, 0.3)',
        'dock': '0 -4px 25px 0 rgba(0, 0, 0, 0.45)',
      },
    },
  },
  plugins: [],
}
