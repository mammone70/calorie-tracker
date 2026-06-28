import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';

export const colors = {
  background: '#0f172a',
  surface: '#1e293b',
  surfaceAlt: '#334155',
  border: '#475569',
  borderLight: '#334155',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  primary: '#3b82f6',
  primaryDark: '#2563eb',
  danger: '#f87171',
  dangerDark: '#dc2626',
  dangerBorder: '#7f1d1d',
  inputBackground: '#1e293b',
  inputBorder: '#475569',
  inputText: '#f8fafc',
  placeholder: '#64748b',
  track: '#334155',
  dotOverride: '#f87171',
  dotWeekly: '#3b82f6',
  onPrimary: '#ffffff',
};

export const navScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  headerTitleStyle: { color: colors.text },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};

export const tabScreenOptions: BottomTabNavigationOptions = {
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopColor: colors.borderLight,
  },
  tabBarInactiveTintColor: colors.textMuted,
  tabBarActiveTintColor: colors.primary,
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  headerTitleStyle: { color: colors.text },
  headerShadowVisible: false,
  sceneStyle: { backgroundColor: colors.background },
};
