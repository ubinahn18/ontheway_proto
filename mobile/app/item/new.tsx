import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  Image,
  Pressable,
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
import { InstructionPicker } from '../../components/InstructionPicker';
import { MAX_ITEM_PRICE } from '../../lib/constants';
import { calcPlatformFee } from '../../lib/fee';

export default function NewItemScreen() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');

  const [pickupQuery, setPickupQuery] = useState('');
  const [pickup, setPickup] = useState<Place | null>(null);
  const [pickupInstruction, setPickupInstruction] = useState('');
  const [locating, setLocating] = useState(false);
  const [searchingPickup, setSearchingPickup] = useState(false);

  const [dropoffQuery, setDropoffQuery] = useState('');
  const [dropoff, setDropoff] = useState<Place | null>(null);
  const [dropoffInstruction, setDropoffInstruction] = useState('');
  const [searchingDropoff, setSearchingDropoff] = useState(false);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const priceNumber = Number(price) || 0;
  const exceedsMaxPrice = priceNumber > MAX_ITEM_PRICE;
  const platformFee = calcPlatformFee(priceNumber);

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

  async function searchPickup() {
    if (!pickupQuery.trim()) return;
    setSearchingPickup(true);
    try {
      const data = await callFunction<Place>('kakao-address-search', { query: pickupQuery });
      setPickup(data);
    } catch (e) {
      Alert.alert('주소를 찾지 못했어요', e instanceof Error ? e.message : String(e));
    } finally {
      setSearchingPickup(false);
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
    if (exceedsMaxPrice) {
      Alert.alert('가격 상한 초과', `가격은 최대 ${MAX_ITEM_PRICE.toLocaleString()}원까지 등록할 수 있어요`);
      return;
    }
    if (!agreedToTerms) {
      Alert.alert('이용약관에 동의해주세요');
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
        p_price: priceNumber,
        p_photo_url: publicUrl,
        p_pickup_address: pickup.address,
        p_pickup_district: pickup.district,
        p_pickup_lng: pickup.lng,
        p_pickup_lat: pickup.lat,
        p_pickup_instruction: pickupInstruction || null,
        p_dropoff_address: dropoff.address,
        p_dropoff_district: dropoff.district,
        p_dropoff_lng: dropoff.lng,
        p_dropoff_lat: dropoff.lat,
        p_dropoff_instruction: dropoffInstruction || null,
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

  const canSubmit = !exceedsMaxPrice && agreedToTerms && !submitting;

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
      {exceedsMaxPrice ? (
        <Text style={styles.errorText}>
          가격은 최대 {MAX_ITEM_PRICE.toLocaleString()}원까지 등록할 수 있어요
        </Text>
      ) : (
        priceNumber > 0 && (
          <Text style={styles.helperText}>플랫폼 수수료: {platformFee.toLocaleString()}원</Text>
        )
      )}

      <Text style={styles.sectionTitle}>픽업지 (물건이 있는 곳)</Text>
      <Button
        title={locating ? '위치 확인 중...' : '현재 위치 사용'}
        onPress={usePickupCurrentLocation}
        disabled={locating}
      />
      {locating && <ActivityIndicator />}
      <TextInput
        style={styles.input}
        placeholder="픽업지 주소 검색"
        value={pickupQuery}
        onChangeText={setPickupQuery}
      />
      <Button
        title={searchingPickup ? '검색 중...' : '주소 검색'}
        onPress={searchPickup}
        disabled={searchingPickup || !pickupQuery.trim()}
      />
      {searchingPickup && <ActivityIndicator />}
      {pickup && (
        <Text style={styles.helperText}>
          {pickup.address} {pickup.district ? `(${pickup.district})` : ''}
        </Text>
      )}
      <Text style={styles.instructionLabel}>픽업 방법 안내</Text>
      <InstructionPicker value={pickupInstruction} onChange={setPickupInstruction} />

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
      <Text style={styles.instructionLabel}>드랍 방법 안내</Text>
      <InstructionPicker value={dropoffInstruction} onChange={setDropoffInstruction} />

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

      <Pressable style={styles.termsRow} onPress={() => setAgreedToTerms((v) => !v)}>
        <Text style={styles.checkbox}>{agreedToTerms ? '☑' : '☐'}</Text>
        <Text style={styles.termsText}>이용약관에 동의합니다</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/terms')}>
        <Text style={styles.termsLink}>약관 보기</Text>
      </Pressable>

      <View style={styles.submitRow}>
        <Button
          title={submitting ? '등록 중...' : '등록하기'}
          onPress={submit}
          disabled={!canSubmit}
        />
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
  instructionLabel: {
    fontWeight: '500',
    fontSize: 13,
    color: '#333',
    marginTop: 4,
  },
  helperText: {
    color: '#555',
  },
  errorText: {
    color: '#c0392b',
    fontWeight: '600',
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  checkbox: {
    fontSize: 18,
  },
  termsText: {
    fontSize: 14,
  },
  termsLink: {
    color: '#2A5FD9',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  submitRow: {
    marginTop: 12,
  },
});
