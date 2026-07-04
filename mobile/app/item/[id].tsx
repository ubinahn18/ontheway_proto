import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { callFunction } from '../../lib/kakaoFunctions';
import { uploadItemPhoto } from '../../lib/uploadPhoto';
import { useSearch, type Item } from '../../lib/SearchContext';
import { statusLabel } from '../../lib/itemStatus';
import { FUEL_EFFICIENCY_KM_PER_L, FUEL_PRICE_PER_L } from '../../lib/constants';
import { colors, radius, shadow, spacing, typography } from '../../lib/theme';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PhotoPicker } from '../../components/ui/PhotoPicker';
import { StarRating } from '../../components/ui/StarRating';

type NaviResult = {
  directDurationSec: number;
  viaDurationSec: number;
  diffMinutes: number;
  extraDistanceMeters: number;
  extraTollFare: number;
};

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { origin, destination } = useSearch();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [navi, setNavi] = useState<NaviResult | null>(null);
  const [naviError, setNaviError] = useState<string | null>(null);
  const [naviLoading, setNaviLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pickupEta, setPickupEta] = useState<Date | null>(null);
  const [showPickupEtaPicker, setShowPickupEtaPicker] = useState(false);
  const [deliveryEta, setDeliveryEta] = useState<Date | null>(null);
  const [showEtaPicker, setShowEtaPicker] = useState(false);
  const [deliveryPhotoUri, setDeliveryPhotoUri] = useState<string | null>(null);
  const [rating, setRating] = useState(0);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      const { data, error } = await supabase.rpc('get_item_with_coords', { p_item_id: id });
      if (!error && data?.[0]) setItem(data[0] as Item);
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!item || !origin || !destination) return;
    setNaviLoading(true);
    callFunction<NaviResult>('kakao-navi-proxy', {
      originLng: origin.lng,
      originLat: origin.lat,
      destLng: destination.lng,
      destLat: destination.lat,
      pickupLng: item.pickup_lng,
      pickupLat: item.pickup_lat,
      dropoffLng: item.dropoff_lng,
      dropoffLat: item.dropoff_lat,
    })
      .then(setNavi)
      .catch((e) => setNaviError(e instanceof Error ? e.message : String(e)))
      .finally(() => setNaviLoading(false));
  }, [item, origin, destination]);

  async function select() {
    if (!item) return;
    if (!pickupEta || !deliveryEta) {
      Alert.alert('픽업 시간과 배달 예상시각을 모두 선택해주세요');
      return;
    }
    if (pickupEta >= deliveryEta) {
      Alert.alert('픽업 시간은 배달 예상시각보다 빨라야 해요');
      return;
    }
    setSelecting(true);
    try {
      const { error } = await supabase.rpc('select_item', {
        p_item_id: item.id,
        p_pickup_eta: pickupEta.toISOString(),
        p_delivery_eta: deliveryEta.toISOString(),
      });
      if (error) throw error;
      Alert.alert('선택 완료', '업로더에게 알림이 전송됐어요');
      router.back();
    } catch (e) {
      Alert.alert('선택 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSelecting(false);
    }
  }

  async function markDelivered() {
    if (!item || !currentUserId) return;
    if (!deliveryPhotoUri) {
      Alert.alert('배송완료 사진을 올려주세요');
      return;
    }
    setDelivering(true);
    try {
      const photoUrl = await uploadItemPhoto(currentUserId, deliveryPhotoUri, 'delivery');
      const { error } = await supabase.rpc('mark_delivered', {
        p_item_id: item.id,
        p_delivery_photo_url: photoUrl,
      });
      if (error) throw error;
      Alert.alert('배송 완료 처리했어요', '업로더에게 알림이 전송됐어요');
      router.back();
    } catch (e) {
      Alert.alert('처리 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setDelivering(false);
    }
  }

  function openPickupEtaPicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: pickupEta ?? new Date(),
        mode: 'date',
        onChange: (_, pickedDate) => {
          if (!pickedDate) return;
          DateTimePickerAndroid.open({
            value: pickupEta ?? new Date(),
            mode: 'time',
            onChange: (_, pickedTime) => {
              if (!pickedTime) return;
              const combined = new Date(pickedDate);
              combined.setHours(pickedTime.getHours(), pickedTime.getMinutes());
              setPickupEta(combined);
            },
          });
        },
      });
    } else {
      setShowPickupEtaPicker(true);
    }
  }

  function openEtaPicker() {
    if (Platform.OS === 'android') {
      // Android has no combined "datetime" dialog — chain a date picker
      // into a time picker and merge the two results.
      DateTimePickerAndroid.open({
        value: deliveryEta ?? new Date(),
        mode: 'date',
        onChange: (_, pickedDate) => {
          if (!pickedDate) return;
          DateTimePickerAndroid.open({
            value: deliveryEta ?? new Date(),
            mode: 'time',
            onChange: (_, pickedTime) => {
              if (!pickedTime) return;
              const combined = new Date(pickedDate);
              combined.setHours(pickedTime.getHours(), pickedTime.getMinutes());
              setDeliveryEta(combined);
            },
          });
        },
      });
    } else {
      setShowEtaPicker(true);
    }
  }

  async function confirmDelivery() {
    if (!item) return;
    if (rating === 0) {
      Alert.alert('배송한 분에게 별점을 남겨주세요');
      return;
    }
    setConfirming(true);
    try {
      const { error } = await supabase.rpc('confirm_delivery', {
        p_item_id: item.id,
        p_rating: rating,
      });
      if (error) throw error;
      Alert.alert('배송을 확인했어요', '거래가 완료됐어요');
      router.back();
    } catch (e) {
      Alert.alert('처리 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={32} color={colors.textSecondary} />
        <Text style={styles.helperText}>아이템을 찾을 수 없어요</Text>
      </View>
    );
  }

  const isOwnItem = currentUserId === item.uploader_id;
  const isSelector = currentUserId === item.selected_by;
  const isExpired = new Date(item.valid_until).getTime() < Date.now();
  const canSelect = item.status === 'available' && !isOwnItem && !isExpired;
  const canMarkDelivered = item.status === 'selected' && isSelector;
  const canConfirmDelivery = item.status === 'delivered' && isOwnItem;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {item.photo_url ? (
        <Image source={{ uri: item.photo_url }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Ionicons name="cube-outline" size={40} color={colors.textSecondary} />
        </View>
      )}

      <View style={styles.headerCard}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{item.title}</Text>
          <StatusBadge status={item.status} />
        </View>
        <Text style={styles.price}>{item.price.toLocaleString()}원</Text>
        {item.description && <Text style={styles.description}>{item.description}</Text>}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="location" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>픽업지</Text>
        </View>
        <Text style={styles.bodyText}>{item.pickup_address}</Text>
        {item.pickup_instruction && (
          <Text style={styles.helperText}>안내: {item.pickup_instruction}</Text>
        )}

        <View style={styles.divider} />

        <View style={styles.sectionHeader}>
          <Ionicons name="flag" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>도착지</Text>
        </View>
        <Text style={styles.bodyText}>{item.dropoff_address}</Text>
        {item.dropoff_instruction && (
          <Text style={styles.helperText}>안내: {item.dropoff_instruction}</Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="time" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>픽업 마감 시각</Text>
        </View>
        <Text style={styles.bodyText}>{new Date(item.valid_until).toLocaleString()}</Text>

        {item.delivery_deadline && (
          <>
            <View style={styles.divider} />
            <View style={styles.sectionHeader}>
              <Ionicons name="checkmark-done" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>배송완료 마감 시각</Text>
            </View>
            <Text style={styles.bodyText}>{new Date(item.delivery_deadline).toLocaleString()}</Text>
          </>
        )}

        {(item.status === 'selected' || item.status === 'delivered') && item.pickup_eta && (
          <>
            <View style={styles.divider} />
            <View style={styles.sectionHeader}>
              <Ionicons name="navigate" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>픽업 예정 시각</Text>
            </View>
            <Text style={styles.bodyText}>{new Date(item.pickup_eta).toLocaleString()}</Text>
          </>
        )}

        {(item.status === 'selected' || item.status === 'delivered') && item.delivery_eta && (
          <>
            <View style={styles.divider} />
            <View style={styles.sectionHeader}>
              <Ionicons name="alarm" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>배달 예상 시각</Text>
            </View>
            <Text style={styles.bodyText}>{new Date(item.delivery_eta).toLocaleString()}</Text>
          </>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="car" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>경유 시 추가 소요 시간 · 비용 추정</Text>
        </View>
        {!origin || !destination ? (
          <Text style={styles.helperText}>
            둘러보기 탭에서 내 출발지/목적지를 먼저 설정해야 계산할 수 있어요
          </Text>
        ) : naviLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : naviError ? (
          <Text style={styles.helperText}>{naviError}</Text>
        ) : navi ? (
          <View style={styles.costBox}>
            <Text style={styles.diff}>+{navi.diffMinutes}분 더 소요</Text>
            <Text style={styles.costLine}>
              추정 주유비: 약{' '}
              {Math.max(
                0,
                Math.round(
                  (navi.extraDistanceMeters / 1000 / FUEL_EFFICIENCY_KM_PER_L) * FUEL_PRICE_PER_L
                )
              ).toLocaleString()}
              원
            </Text>
            <Text style={styles.costLine}>
              추정 도로비 차이: 약 {Math.max(0, navi.extraTollFare).toLocaleString()}원
            </Text>
          </View>
        ) : null}
      </View>

      {canSelect && (
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="navigate-outline" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>픽업 예정 시각</Text>
          </View>
          <Button
            title={pickupEta ? pickupEta.toLocaleString() : '픽업 예정 시각 선택'}
            onPress={openPickupEtaPicker}
            variant="outline"
          />
          {Platform.OS === 'ios' && showPickupEtaPicker && (
            <>
              <DateTimePicker
                value={pickupEta ?? new Date()}
                mode="datetime"
                display="spinner"
                onChange={(_, date) => {
                  if (date) setPickupEta(date);
                }}
              />
              <Button title="완료" onPress={() => setShowPickupEtaPicker(false)} variant="outline" />
            </>
          )}

          <View style={styles.divider} />

          <View style={styles.sectionHeader}>
            <Ionicons name="alarm-outline" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>배달 예상 시각</Text>
          </View>
          <Button
            title={deliveryEta ? deliveryEta.toLocaleString() : '배달 예상 시각 선택'}
            onPress={openEtaPicker}
            variant="outline"
          />
          {Platform.OS === 'ios' && showEtaPicker && (
            <>
              <DateTimePicker
                value={deliveryEta ?? new Date()}
                mode="datetime"
                display="spinner"
                onChange={(_, date) => {
                  if (date) setDeliveryEta(date);
                }}
              />
              <Button title="완료" onPress={() => setShowEtaPicker(false)} />
            </>
          )}
        </View>
      )}

      {canMarkDelivered && (
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="camera" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>배송완료 사진</Text>
          </View>
          <PhotoPicker uri={deliveryPhotoUri} onChange={setDeliveryPhotoUri} />
        </View>
      )}

      {canConfirmDelivery && (
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="star" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>배송한 분에게 별점 남기기</Text>
          </View>
          {item.delivery_photo_url && (
            <Image source={{ uri: item.delivery_photo_url }} style={styles.deliveryPhoto} />
          )}
          <StarRating value={rating} onChange={setRating} size={32} />
        </View>
      )}

      <View style={styles.actions}>
        <Button
          title={
            isOwnItem
              ? '내가 등록한 아이템이에요'
              : isExpired
                ? '마감된 아이템이에요'
                : item.status !== 'available'
                  ? statusLabel(item.status)
                  : selecting
                    ? '선택 중...'
                    : '선택하기'
          }
          onPress={select}
          disabled={!canSelect || selecting || !pickupEta || !deliveryEta}
          loading={selecting}
        />

        {canMarkDelivered && (
          <Button
            title="배송 완료"
            onPress={markDelivered}
            disabled={!deliveryPhotoUri}
            loading={delivering}
          />
        )}

        {canConfirmDelivery && (
          <Button
            title="배송 확인"
            onPress={confirmDelivery}
            disabled={rating === 0}
            loading={confirming}
          />
        )}
      </View>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: radius.lg,
  },
  photoPlaceholder: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryPhoto: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
  },
  headerCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.xs,
    ...shadow.card,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    flex: 1,
  },
  price: {
    ...typography.price,
    color: colors.primary,
    fontSize: 22,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.xs,
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
  bodyText: {
    ...typography.body,
  },
  helperText: {
    ...typography.caption,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  costBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs / 2,
  },
  diff: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
  },
  costLine: {
    ...typography.caption,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
