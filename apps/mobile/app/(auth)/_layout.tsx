import { Stack } from 'expo-router';
import { navScreenOptions } from '../../lib/theme';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ ...navScreenOptions, headerShown: true }}>
      <Stack.Screen name="login" options={{ title: 'Sign In' }} />
      <Stack.Screen name="register" options={{ title: 'Create Account' }} />
    </Stack>
  );
}
