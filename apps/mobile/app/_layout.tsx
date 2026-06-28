import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { AuthProvider } from '../contexts/AuthContext';
import { queryClient, asyncStoragePersister } from '../lib/query-client';

export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <AuthProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="day/[date]" options={{ headerShown: true, title: 'Day' }} />
          <Stack.Screen name="food/search" options={{ headerShown: true, title: 'Search Foods' }} />
          <Stack.Screen name="food/create" options={{ headerShown: true, title: 'Add Food' }} />
        </Stack>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
