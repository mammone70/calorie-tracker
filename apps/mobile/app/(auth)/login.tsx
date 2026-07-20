import { useState } from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { AppTextInput } from '../../components/AppTextInput';
import { colors } from '../../lib/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [trustedDevice, setTrustedDevice] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      await login(email, password, trustedDevice);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Login failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Calorie Tracker</Text>
        <Text style={styles.subtitle}>Sign in to sync your data</Text>

        <AppTextInput
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
        />
        <AppTextInput
          placeholder="Password"
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={styles.trustRow}
          onPress={() => setTrustedDevice((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: trustedDevice }}
        >
          <View style={[styles.checkbox, trustedDevice && styles.checkboxChecked]}>
            {trustedDevice ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.trustLabel}>
            Trust this device — stay signed in longer on devices you own
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
        </TouchableOpacity>

        <Link href="/(auth)/register" style={styles.link}>
          Create an account
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8, color: colors.text },
  subtitle: { fontSize: 16, color: colors.textMuted, marginBottom: 32 },
  trustRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4, marginBottom: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  checkmark: { color: colors.onPrimary, fontSize: 14, fontWeight: '700', lineHeight: 16 },
  trustLabel: { flex: 1, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  button: {
    backgroundColor: colors.primaryDark,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  link: { marginTop: 24, textAlign: 'center', color: colors.primary, fontSize: 16 },
});
