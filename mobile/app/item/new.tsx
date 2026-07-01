import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { File } from 'expo-file-system';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { callFunction } from '../../lib/kakaoFunctions';
import type { Place } from '../../lib/SearchContext';

export default function NewItemScreen() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');

  const [pickup, setPickup] = useState<Place | null>(null);
  const [locating, setLocating] = useState(false);

  const [dropoffQuery, setDropoffQuery] = useState('');
  const [dropoff, setDropoff] = useState<Place | null>(null);
  const [searchingDropoff, setSearchingDropoff] = useState(false);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function usePickupCurrentLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('위치 권한이 필요해요');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const lng = position.coords.longitude;
      const lat = position.coords.latitude;
      const data = await callFunction<{ district: string | null; address: string | null }>(
        'kakao-local-district',
        { lng, lat }
      );
      setPickup({ address: data.address ?? '', district: data.district, lng, lat });
    } catch (e) {
      Alert.alert('위치를 가져오지 못했어요', e instanceof Error ? e.message : String(e));
    } finally {
      setLocating(false);
    }
  }

  async function searchDropoff() {
    if (!dropoffQuery.trim()) return;
    setSearchingDropoff(true);
    try {
      const data = await callFunction<Place>('kakao-address-search', { query: dropoffQuery });
      setDropoff(data);
    } catch (e) {
      Alert.alert('주소를 찾지 못했어요', e instanceof Error ? e.message : String(e));
    } finally {
      setSearchingDropoff(false);
    }
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('사진 접근 권한이 필요해요');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function submit() {
    if (!title || !price || !pickup || !dropoff || !photoUri) {
      Alert.alert('제목, 가격, 사진, 픽업지, 도착지를 모두 입력해주세요');
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요');

      const fileExt = (photoUri.split('.').pop() ?? 'jpg').toLowerCase();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      const contentType = fileExt === 'png' ? 'image/png' : fileExt === 'heic' ? 'image/heic' : 'image/jpeg';
      const arrayBuffer = await new File(photoUri).arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('item-photos')
        .upload(filePath, arrayBuffer, { contentType });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('item-photos').getPublicUrl(filePath);

      const { error: insertError } = await supabase.rpc('insert_item', {
        p_title: title,
        p_description: description || null,
        p_price: Number(price),
        p_photo_url: publicUrl,
        p_pickup_address: pickup.address,
        p_pickup_district: pickup.district,
        p_pickup_lng: pickup.lng,
        p_pickup_lat: pickup.lat,
        p_dropoff_address: dropoff.address,
        p_dropoff_district: dropoff.district,
        p_dropoff_lng: dropoff.lng,
        p_dropoff_lat: dropoff.lat,
        p_valid_until: validUntil.toISOString(),
      });
      if (insertError) throw insertError;

      router.back();
    } catch (e) {
      Alert.alert('등록 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TextInput style={styles.input} placeholder="제목" value={title} onChangeText={setTitle} />
      <TextInput
        style={styles.input}
        placeholder="설명"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <TextInput
        style={styles.input}
        placeholder="가격 (원)"
        value={price}
        onChangeText={setPrice}
        keyboardType="number-pad"
      />

      <Text style={styles.sectionTitle}>픽업지 (물건이 있는 곳)</Text>
      <Button
        title={locating ? '위치 확인 중...' : '현재 위치 사용'}
        onPress={usePickupCurrentLocation}
        disabled={locating}
      />
      {locating && <ActivityIndicator />}
      {pickup && (
        <Text style={styles.helperText}>
          {pickup.address} {pickup.district ? `(${pickup.district})` : ''}
        </Text>
      )}

      <Text style={styles.sectionTitle}>도착지 (물건이 가야 하는 곳)</Text>
      <TextInput
        style={styles.input}
        placeholder="도착지 주소 검색"
        value={dropoffQuery}
        onChangeText={setDropoffQuery}
      />
      <Button
        title={searchingDropoff ? '검색 중...' : '주소 검색'}
        onPress={searchDropoff}
        disabled={searchingDropoff || !dropoffQuery.trim()}
      />
      {searchingDropoff && <ActivityIndicator />}
      {dropoff && (
        <Text style={styles.helperText}>
          {dropoff.address} {dropoff.district ? `(${dropoff.district})` : ''}
        </Text>
      )}

      <Button title="사진 선택" onPress={pickPhoto} />
      {photoUri && <Image source={{ uri: photoUri }} style={styles.preview} />}

      <Text style={styles.helperText}>마감 시각: {validUntil.toLocaleString()}</Text>
      <Button title="마감 시각 변경" onPress={() => setShowTimePicker(true)} />
      {showTimePicker && (
        <DateTimePicker
          value={validUntil}
          mode="datetime"
          onChange={(_, date) => {
            setShowTimePicker(false);
            if (date) setValidUntil(date);
          }}
        />
      )}

      <View style={styles.submitRow}>
        <Button title={submitting ? '등록 중...' : '등록하기'} onPress={submit} disabled={submitting} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    marginTop: 8,
  },
  helperText: {
    color: '#555',
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  submitRow: {
    marginTop: 12,
  },
});
