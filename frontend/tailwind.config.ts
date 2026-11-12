import type { Config } from 'tailwindcss';
import scrollbar from 'tailwind-scrollbar';

const config: Config = {
  // 1. Enable class-based dark mode for manual toggling
  darkMode: 'class',

  // 2. Define where Tailwind should look for classes
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      // 3. Custom Fonts (Optional - Ensure you import Inter in index.css or HTML)
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      
      // 4. Custom Animations for the UI
      animation: {
        'marquee': 'marquee 40s linear infinite', // Slower, smoother ticker
        'pulse-slow': 'pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite', // For background blobs
        'fade-in': 'fadeIn 0.5s ease-out forwards', // Smooth page loads
        'float': 'float 6s ease-in-out infinite', // Floating effect
        'gradient': 'gradient 8s ease infinite', // Gradient animation
      },

      // 5. Keyframes definitions
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }, // Moves left
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        gradient: {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center',
          },
        },
      },

      // 6. Custom Glass Colors (Optional helpers)
      colors: {
        glass: {
          border: 'rgba(255, 255, 255, 0.2)',
          surface: 'rgba(255, 255, 255, 0.1)',
        },
        // Custom color palette for financial theme
        primary: {
          50: '#eef8ff',
          100: '#d8eeff',
          200: '#b3ddff',
          300: '#7ac8ff',
          400: '#3aa7ff',
          500: '#0a85ff',
          600: '#0068e5',
          700: '#0052b8',
          800: '#004397',
          900: '#00397d',
          950: '#002452',
        },
        secondary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        market: {
          up: '#10b981', // emerald
          down: '#ef4444', // red
          neutral: '#64748b', // slate
        }
      },
      
      // 7. Custom Gradients
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-linear': 'linear-gradient(135deg, var(--tw-gradient-stops))',
        'market-up': 'linear-gradient(to right, #10b981, #059669)',
        'market-down': 'linear-gradient(to right, #ef4444, #dc2626)',
        'glass': 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
        'glass-dark': 'linear-gradient(135deg, rgba(30,41,59,0.3), rgba(2,6,23,0.2))',
      },
      
      // 8. Backdrop Blur Values
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        DEFAULT: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '40px',
        '3xl': '64px',
      },
      
      // 9. Border Radius Values
      borderRadius: {
        none: '0',
        sm: '0.125rem',
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
        '5xl': '2.5rem',
        full: '9999px',
      }
    },
  },

  // 7. Plugins
  plugins: [
    scrollbar({ nocompatible: true }), // Custom scrollbar plugin
  ],
};

export default config;