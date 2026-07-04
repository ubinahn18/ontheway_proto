import { Alert, Image, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { radius, spacing } from '../../lib/theme';
import { Button } from './Button';

export function PhotoPicker({
  uri,
  onChange,
}: {
  uri: string | null;
  onChange: (uri: string) => void;
}) {
  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('카메라 권한이 필요해요');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) onChange(result.assets[0].uri);
  }

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('사진 접근 권한이 필요해요');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) onChange(result.assets[0].uri);
  }

  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        <View style={styles.buttonHalf}>
          <Button title="사진 촬영" onPress={takePhoto} variant="outline" />
        </View>
        <View style={styles.buttonHalf}>
          <Button title="앨범에서 선택" onPress={pickFromLibrary} variant="outline" />
        </View>
      </View>
      {uri && <Image source={{ uri }} style={styles.preview} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  buttonHalf: {
    flex: 1,
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
  },
});
