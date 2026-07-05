import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { callFunction } from '../../lib/kakaoFunctions';
import { uploadItemPhoto } from '../../lib/uploadPhoto';
import type { Place } from '../../lib/SearchContext';
import { InstructionPicker } from '../../components/InstructionPicker';
import { MAX_ITEM_PRICE, PICKUP_INSTRUCTION_PRESETS, DROPOFF_INSTRUCTION_PRESETS } from '../../lib/constants';
import { calcPlatformFee } from '../../lib/fee';
import { formatDateTime } from '../../lib/formatDateTime';
import { getErrorMessage } from '../../lib/errorMessage';
import { colors, radius, shadow, spacing, typography } from '../../lib/theme';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { PhotoPicker } from '../../components/ui/PhotoPicker';

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
  const [deliveryDeadline, setDeliveryDeadline] = useState(new Date(Date.now() + 3 * 60 * 60 * 1000));
  const [showDeliveryDeadlinePicker, setShowDeliveryDeadlinePicker] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const priceNumber = Number(price) || 0;
  const exceedsMaxPrice = priceNumber > MAX_ITEM_PRICE;
  const platformFee = calcPlatformFee(priceNumber);
  const deadlineOrderInvalid = deliveryDeadline <= validUntil;

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
      Alert.alert('위치를 가져오지 못했어요', getErrorMessage(e));
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
      Alert.alert('주소를 찾지 못했어요', getErrorMessage(e));
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
      Alert.alert('주소를 찾지 못했어요', getErrorMessage(e));
    } finally {
      setSearchingDropoff(false);
    }
  }

  function openValidUntilPicker() {
    if (Platform.OS === 'android') {
      // Android has no combined "datetime" dialog — chain a date picker
      // into a time picker and merge the two results.
      DateTimePickerAndroid.open({
        value: validUntil,
        mode: 'date',
        onChange: (_, pickedDate) => {
          if (!pickedDate) return;
          DateTimePickerAndroid.open({
            value: validUntil,
            mode: 'time',
            onChange: (_, pickedTime) => {
              if (!pickedTime) return;
              const combined = new Date(pickedDate);
              combined.setHours(pickedTime.getHours(), pickedTime.getMinutes());
              setValidUntil(combined);
            },
          });
        },
      });
    } else {
      setShowTimePicker(true);
    }
  }

  function openDeliveryDeadlinePicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: deliveryDeadline,
        mode: 'date',
        onChange: (_, pickedDate) => {
          if (!pickedDate) return;
          DateTimePickerAndroid.open({
            value: deliveryDeadline,
            mode: 'time',
            onChange: (_, pickedTime) => {
              if (!pickedTime) return;
              const combined = new Date(pickedDate);
              combined.setHours(pickedTime.getHours(), pickedTime.getMinutes());
              setDeliveryDeadline(combined);
            },
          });
        },
      });
    } else {
      setShowDeliveryDeadlinePicker(true);
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
    if (deadlineOrderInvalid) {
      Alert.alert('배송완료 마감 시각은 선택 마감 시각보다 늦어야 해요');
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

      const publicUrl = await uploadItemPhoto(user.id, photoUri, 'item');

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
        p_delivery_deadline: deliveryDeadline.toISOString(),
      });
      if (insertError) throw insertError;

      router.back();
    } catch (e) {
      Alert.alert('등록 실패', getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !exceedsMaxPrice && !deadlineOrderInvalid && agreedToTerms && !submitting;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="document-text" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>기본 정보</Text>
        </View>
        <TextField label="제목" placeholder="예: 노트북 파우치" value={title} onChangeText={setTitle} />
        <TextField
          label="설명"
          placeholder="물건에 대한 설명을 적어주세요"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <TextField
          label="배송 제안 가격 (원)"
          placeholder="배송 제안 가격 (원)"
          value={price}
          onChangeText={setPrice}
          keyboardType="number-pad"
        />
        {exceedsMaxPrice ? (
          <Text style={styles.errorText}>
            배송 제안 가격은 최대 {MAX_ITEM_PRICE.toLocaleString()}원까지 등록할 수 있어요
          </Text>
        ) : (
          priceNumber > 0 && (
            <View style={styles.feeBanner}>
              <Ionicons name="information-circle" size={16} color={colors.primary} />
              <Text style={styles.feeText}>플랫폼 수수료: {platformFee.toLocaleString()}원</Text>
            </View>
          )
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="location" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>픽업지 (물건이 있는 곳)</Text>
        </View>
        <Button
          title={locating ? '위치 확인 중...' : '현재 위치 사용'}
          onPress={usePickupCurrentLocation}
          disabled={locating}
          variant="outline"
        />
        {locating && <ActivityIndicator color={colors.primary} />}
        <TextField placeholder="픽업지 주소 검색" value={pickupQuery} onChangeText={setPickupQuery} />
        <Button
          title={searchingPickup ? '검색 중...' : '주소 검색'}
          onPress={searchPickup}
          disabled={searchingPickup || !pickupQuery.trim()}
          variant="outline"
        />
        {searchingPickup && <ActivityIndicator color={colors.primary} />}
        {pickup && (
          <Text style={styles.helperText}>
            {pickup.address} {pickup.district ? `(${pickup.district})` : ''}
          </Text>
        )}
        <Text style={styles.instructionLabel}>픽업 방법 안내</Text>
        <InstructionPicker
          presets={PICKUP_INSTRUCTION_PRESETS}
          value={pickupInstruction}
          onChange={setPickupInstruction}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flag" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>도착지 (물건이 가야 하는 곳)</Text>
        </View>
        <TextField placeholder="도착지 주소 검색" value={dropoffQuery} onChangeText={setDropoffQuery} />
        <Button
          title={searchingDropoff ? '검색 중...' : '주소 검색'}
          onPress={searchDropoff}
          disabled={searchingDropoff || !dropoffQuery.trim()}
          variant="outline"
        />
        {searchingDropoff && <ActivityIndicator color={colors.primary} />}
        {dropoff && (
          <Text style={styles.helperText}>
            {dropoff.address} {dropoff.district ? `(${dropoff.district})` : ''}
          </Text>
        )}
        <Text style={styles.instructionLabel}>드랍 방법 안내</Text>
        <InstructionPicker
          presets={DROPOFF_INSTRUCTION_PRESETS}
          value={dropoffInstruction}
          onChange={setDropoffInstruction}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="image" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>사진</Text>
        </View>
        <PhotoPicker uri={photoUri} onChange={setPhotoUri} />
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="time" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>선택 마감 시각</Text>
        </View>
        <Text style={styles.helperText}>이 시각까지 선택되지 않으면 마감돼요</Text>
        <Text style={styles.deadlineValue}>{formatDateTime(validUntil)}</Text>
        <Button title="선택 마감 시각 변경" onPress={openValidUntilPicker} variant="outline" />
        {Platform.OS === 'ios' && showTimePicker && (
          <>
            <DateTimePicker
              value={validUntil}
              mode="datetime"
              display="spinner"
              onChange={(_, date) => {
                if (date) setValidUntil(date);
              }}
            />
            <Button title="완료" onPress={() => setShowTimePicker(false)} variant="outline" />
          </>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="checkmark-done" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>배송완료 마감 시각</Text>
        </View>
        <Text style={styles.helperText}>이 시각까지 배송이 완료돼야 해요</Text>
        <Text style={styles.deadlineValue}>{formatDateTime(deliveryDeadline)}</Text>
        <Button title="배송완료 마감 시각 변경" onPress={openDeliveryDeadlinePicker} variant="outline" />
        {deadlineOrderInvalid && (
          <Text style={styles.errorText}>선택 마감 시각보다 늦어야 해요</Text>
        )}
        {Platform.OS === 'ios' && showDeliveryDeadlinePicker && (
          <>
            <DateTimePicker
              value={deliveryDeadline}
              mode="datetime"
              display="spinner"
              onChange={(_, date) => {
                if (date) setDeliveryDeadline(date);
              }}
            />
            <Button title="완료" onPress={() => setShowDeliveryDeadlinePicker(false)} variant="outline" />
          </>
        )}
      </View>

      <View style={styles.card}>
        <Pressable style={styles.termsRow} onPress={() => setAgreedToTerms((v) => !v)}>
          <Ionicons
            name={agreedToTerms ? 'checkbox' : 'square-outline'}
            size={20}
            color={agreedToTerms ? colors.primary : colors.textSecondary}
          />
          <Text style={styles.termsText}>이용약관에 동의합니다</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/terms')}>
          <Text style={styles.termsLink}>약관 보기</Text>
        </Pressable>
      </View>

      <Button
        title={submitting ? '등록 중...' : '등록하기'}
        onPress={submit}
        disabled={!canSubmit}
        loading={submitting}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    ...shadow.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs / 2,
  },
  sectionTitle: {
    ...typography.subtitle,
    fontSize: 14,
  },
  instructionLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  helperText: {
    ...typography.caption,
  },
  deadlineValue: {
    ...typography.body,
    fontWeight: '600',
  },
  errorText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  feeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  feeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  termsText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  termsLink: {
    color: colors.primary,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
