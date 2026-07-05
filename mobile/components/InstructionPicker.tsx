import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../lib/theme';
import { Chip } from './ui/Chip';
import { TextField } from './ui/TextField';

const CUSTOM = '__custom__';

export function InstructionPicker({
  presets,
  value,
  onChange,
}: {
  presets: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [mode, setMode] = useState<string>(
    presets.includes(value) || !value ? value || '' : CUSTOM
  );

  function selectPreset(preset: string) {
    setMode(preset);
    onChange(preset);
  }

  function selectCustom() {
    setMode(CUSTOM);
    onChange('');
  }

  return (
    <View style={styles.container}>
      <View style={styles.chipRow}>
        {presets.map((preset) => (
          <Chip
            key={preset}
            label={preset}
            selected={mode === preset}
            onPress={() => selectPreset(preset)}
          />
        ))}
        <Chip label="직접 입력" selected={mode === CUSTOM} onPress={selectCustom} />
      </View>
      {mode === CUSTOM && (
        <TextField placeholder="예: 문 앞에 두고 문자 주세요" value={value} onChangeText={onChange} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
