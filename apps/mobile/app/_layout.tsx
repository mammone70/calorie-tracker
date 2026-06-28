import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { AuthProvider } from '../contexts/AuthContext';
import { queryClient, asyncStoragePersister } from '../lib/query-client';
import { navScreenOptions } from '../lib/theme';

export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="day/[date]"
            options={{ ...navScreenOptions, headerShown: true, title: 'Day' }}
          />
          <Stack.Screen
            name="weekly-targets"
            options={{ ...navScreenOptions, headerShown: true, title: 'Weekly Targets' }}
          />
          <Stack.Screen
            name="food/search"
            options={{ ...navScreenOptions, headerShown: true, title: 'Search Foods' }}
          />
          <Stack.Screen
            name="food/create"
            options={{ ...navScreenOptions, headerShown: true, title: 'Add Food' }}
          />
        </Stack>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
