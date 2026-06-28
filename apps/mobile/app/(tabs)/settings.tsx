import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

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
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  item: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemText: { fontSize: 16, fontWeight: '600' },
  itemHint: { color: '#64748b', marginTop: 4, fontSize: 13 },
  danger: { borderColor: '#fecaca' },
  dangerText: { color: '#dc2626' },
});
