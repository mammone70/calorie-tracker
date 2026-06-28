import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../lib/theme';

export default function SettingsScreen() {
  const { logout, sync } = useAuth();

  const handleSync = async () => {
    try {
      await sync();
      Alert.alert('Sync complete', 'Your data has been synced with the server.');
    } catch (error) {
      Alert.alert('Sync failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.item} onPress={() => router.push('/weekly-targets')}>
        <Text style={styles.itemText}>Weekly macro defaults</Text>
        <Text style={styles.itemHint}>Set default targets for each day of the week</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={handleSync}>
        <Text style={styles.itemText}>Sync now</Text>
        <Text style={styles.itemHint}>Push local changes and pull updates</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.item, styles.danger]} onPress={handleLogout}>
        <Text style={[styles.itemText, styles.dangerText]}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  item: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  itemText: { fontSize: 16, fontWeight: '600', color: colors.text },
  itemHint: { color: colors.textMuted, marginTop: 4, fontSize: 13 },
  danger: { borderColor: colors.dangerBorder },
  dangerText: { color: colors.danger },
});
