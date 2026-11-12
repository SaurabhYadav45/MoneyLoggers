import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

/**
 * Reusable, accessible Theme Toggle Button
 * Supports smooth icon rotation and scale micro-interactions.
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  showLabel = false,
}) => {
  const { resolvedTheme, toggleTheme, isDark } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={`Current theme is ${resolvedTheme}. Click to switch to ${isDark ? 'light' : 'dark'} mode.`}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
      className={`
        relative inline-flex items-center justify-center p-2 rounded-xl
        text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white
        bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700/80
        border border-slate-200/80 dark:border-slate-700/70
        transition-all duration-200 active:scale-95 shadow-xs
        focus:outline-none focus:ring-2 focus:ring-indigo-500/50
        ${className}
      `}
    >
      <div className="relative w-5 h-5 flex items-center justify-center overflow-hidden">
        {/* Sun Icon (shown in dark mode to switch to light) */}
        <Sun
          className={`
            w-4 h-4 text-amber-500 absolute transition-all duration-300 transform
            ${isDark ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'}
          `}
        />
        {/* Moon Icon (shown in light mode to switch to dark) */}
        <Moon
          className={`
            w-4 h-4 text-indigo-600 dark:text-indigo-400 absolute transition-all duration-300 transform
            ${!isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'}
          `}
        />
      </div>

      {showLabel && (
        <span className="ml-2 text-xs font-semibold capitalize">
          {resolvedTheme}
        </span>
      )}
    </button>
  );
};

export default ThemeToggle;
