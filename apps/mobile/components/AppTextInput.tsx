import { TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { colors } from '../lib/theme';

export function AppTextInput({ style, showSoftInputOnFocus = true, ...props }: TextInputProps) {
  return (
    <TextInput
      {...props}
      style={[styles.input, style]}
      placeholderTextColor={colors.placeholder}
      selectionColor={colors.primary}
      showSoftInputOnFocus={showSoftInputOnFocus}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    color: colors.inputText,
  },
});
