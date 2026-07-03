import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DROPOFF_INSTRUCTION_PRESETS } from '../lib/constants';

const CUSTOM = '__custom__';

export function InstructionPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [mode, setMode] = useState<string>(
    DROPOFF_INSTRUCTION_PRESETS.includes(value) || !value ? value || '' : CUSTOM
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
        {DROPOFF_INSTRUCTION_PRESETS.map((preset) => (
          <Pressable
            key={preset}
            onPress={() => selectPreset(preset)}
            style={[styles.chip, mode === preset && styles.chipSelected]}
          >
            <Text style={[styles.chipText, mode === preset && styles.chipTextSelected]}>
              {preset}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={selectCustom}
          style={[styles.chip, mode === CUSTOM && styles.chipSelected]}
        >
          <Text style={[styles.chipText, mode === CUSTOM && styles.chipTextSelected]}>
            직접 입력
          </Text>
        </Pressable>
      </View>
      {mode === CUSTOM && (
        <TextInput
          style={styles.input}
          placeholder="예: 문 앞에 두고 문자 주세요"
          value={value}
          onChangeText={onChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipSelected: {
    borderColor: '#2A5FD9',
    backgroundColor: '#EBF0FE',
  },
  chipText: {
    fontSize: 12,
    color: '#333',
  },
  chipTextSelected: {
    color: '#2A5FD9',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
  },
});
