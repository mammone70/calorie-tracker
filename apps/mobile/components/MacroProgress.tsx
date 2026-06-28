import { View, Text, StyleSheet } from 'react-native';

type MacroProgressProps = {
  label: string;
  consumed: { calories: number; protein: number; fat: number; carbs: number };
  target: { calories: number; protein: number; fat: number; carbs: number };
};

function ProgressBar({ label, current, goal, unit = '' }: { label: string; current: number; goal: number; unit?: string }) {
  const pct = goal > 0 ? Math.min(current / goal, 1) : 0;
  return (
    <View style={styles.barContainer}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValues}>
          {Math.round(current)}{unit} / {Math.round(goal)}{unit}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

export function MacroProgress({ label, consumed, target }: MacroProgressProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{label}</Text>
      <ProgressBar label="Calories" current={consumed.calories} goal={target.calories} />
      <ProgressBar label="Protein" current={consumed.protein} goal={target.protein} unit="g" />
      <ProgressBar label="Fat" current={consumed.fat} goal={target.fat} unit="g" />
      <ProgressBar label="Carbs" current={consumed.carbs} goal={target.carbs} unit="g" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  barContainer: { marginBottom: 14 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { fontWeight: '600', color: '#334155' },
  barValues: { color: '#64748b', fontSize: 13 },
  barTrack: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#2563eb', borderRadius: 4 },
});
