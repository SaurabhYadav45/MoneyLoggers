import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextType {
  /** The user-configured theme setting ('light' | 'dark' | 'system') */
  theme: Theme;
  /** The actual active visual theme ('light' | 'dark') */
  resolvedTheme: ResolvedTheme;
  /** Boolean helper: true when active visual theme is dark */
  isDark: boolean;
  /** Set theme explicitly to 'light', 'dark', or 'system' */
  setTheme: (theme: Theme) => void;
  /** Quick toggle between light and dark */
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = 'moneylogger_theme';
const LEGACY_THEME_STORAGE_KEY = 'theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

/**
 * Enterprise-grade ThemeProvider
 * - Default: 'light' (as specified)
 * - Synchronizes with localStorage and documentElement classes (.dark)
 * - Supports 'system' preference detection with live media query listeners
 * - Emits custom DOM events for non-React canvas/chart integrations
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'light',
  storageKey = THEME_STORAGE_KEY,
}) => {
  // 1. Initial State Resolution (Synchronous, Light by default)
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme;

    try {
      const stored = localStorage.getItem(storageKey) || localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {
      // Ignore localStorage access errors
    }

    return defaultTheme;
  });

  // 2. Compute resolved theme ('light' | 'dark')
  const getSystemTheme = useCallback((): ResolvedTheme => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (theme === 'system') {
      return getSystemTheme();
    }
    return theme;
  });

  // 3. Update DOM & localStorage when theme or system changes
  const applyThemeToDOM = useCallback((newResolvedTheme: ResolvedTheme) => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    if (newResolvedTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      if (body) {
        body.classList.add('dark');
        body.classList.remove('light');
      }
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      if (body) {
        body.classList.remove('dark');
        body.classList.add('light');
      }
      root.style.colorScheme = 'light';
    }

    root.setAttribute('data-theme', newResolvedTheme);

    // Dispatch global event for third-party / canvas charts (TradingView, Recharts)
    window.dispatchEvent(
      new CustomEvent('moneylogger:theme-change', {
        detail: {
          theme,
          resolvedTheme: newResolvedTheme,
          isDark: newResolvedTheme === 'dark',
        },
      })
    );
  }, [theme]);

  // Apply theme to DOM on initial mount
  useEffect(() => {
    applyThemeToDOM(resolvedTheme);
  }, []);

  // Listen to system dark/light preference changes when theme === 'system'
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      const nextResolved = e.matches ? 'dark' : 'light';
      setResolvedTheme(nextResolved);
      applyThemeToDOM(nextResolved);
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme, applyThemeToDOM]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    const nextResolved = newTheme === 'system' ? getSystemTheme() : newTheme;
    setResolvedTheme(nextResolved);
    applyThemeToDOM(nextResolved);
    try {
      localStorage.setItem(storageKey, newTheme);
      localStorage.setItem(LEGACY_THEME_STORAGE_KEY, newTheme);
    } catch {
      // Ignore storage errors
    }
  }, [storageKey, getSystemTheme, applyThemeToDOM]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const currentResolved = prev === 'system' ? getSystemTheme() : prev;
      const nextTheme = currentResolved === 'dark' ? 'light' : 'dark';
      const nextResolved = nextTheme;
      setResolvedTheme(nextResolved);
      applyThemeToDOM(nextResolved);
      try {
        localStorage.setItem(storageKey, nextTheme);
        localStorage.setItem(LEGACY_THEME_STORAGE_KEY, nextTheme);
      } catch {
        // Ignore storage errors
      }
      return nextTheme;
    });
  }, [storageKey, getSystemTheme, applyThemeToDOM]);

  const contextValue = useMemo<ThemeContextType>(() => ({
    theme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    setTheme,
    toggleTheme,
  }), [theme, resolvedTheme, setTheme, toggleTheme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * useTheme Hook
 * Access current theme, resolvedTheme, isDark, and theme setter/toggler anywhere in the application.
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a <ThemeProvider />');
  }
  return context;
};
