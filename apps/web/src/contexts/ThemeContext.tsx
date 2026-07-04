import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ColorMode = 'light' | 'dark';
export type ColorTheme = 'default' | 'pink-galore';

const COLOR_MODE_KEY = 'calorie-tracker-color-mode';
const LEGACY_MODE_KEY = 'calorie-tracker-theme';
const COLOR_THEME_KEY = 'calorie-tracker-color-theme';

const THEME_COLORS: Record<ColorTheme, Record<ColorMode, string>> = {
  default: {
    light: '#fafafa',
    dark: '#161616',
  },
  'pink-galore': {
    light: '#fafafa',
    dark: '#1e1e1e',
  },
};

export const COLOR_THEME_OPTIONS: { value: ColorTheme; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'pink-galore', label: 'Pink Galore' },
];

function readStoredColorMode(): ColorMode {
  if (typeof window === 'undefined') return 'dark';
  const stored =
    localStorage.getItem(COLOR_MODE_KEY) ?? localStorage.getItem(LEGACY_MODE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

function readStoredColorTheme(): ColorTheme {
  if (typeof window === 'undefined') return 'default';
  const stored = localStorage.getItem(COLOR_THEME_KEY);
  return stored === 'pink-galore' ? 'pink-galore' : 'default';
}

export function applyColorTheme(colorMode: ColorMode, colorTheme: ColorTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', colorMode === 'dark');
  root.classList.add('theme');
  root.classList.toggle('theme-pink-galore', colorTheme === 'pink-galore');

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', THEME_COLORS[colorTheme][colorMode]);
  }
}

type ThemeContextValue = {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>(readStoredColorMode);
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(readStoredColorTheme);

  useEffect(() => {
    applyColorTheme(colorMode, colorTheme);
    localStorage.setItem(COLOR_MODE_KEY, colorMode);
    localStorage.setItem(COLOR_THEME_KEY, colorTheme);
  }, [colorMode, colorTheme]);

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
  }, []);

  const setColorTheme = useCallback((theme: ColorTheme) => {
    setColorThemeState(theme);
  }, []);

  const value = useMemo(
    () => ({ colorMode, setColorMode, colorTheme, setColorTheme }),
    [colorMode, setColorMode, colorTheme, setColorTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
