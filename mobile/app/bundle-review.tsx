import { useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useSearch } from '../lib/SearchContext';
import { openAndroidDateTimePicker } from '../lib/openAndroidDateTimePicker';
import { formatDateTime } from '../lib/formatDateTime';
import { getErrorMessage } from '../lib/errorMessage';
import { colors, radius, shadow, spacing, typography } from '../lib/theme';
import { Button } from '../components/ui/Button';

export default function BundleReviewScreen() {
  const router = useRouter();
  const { selectedPackage, setSelectedPackage } = useSearch();
  const [stopTimes, setStopTimes] = useState<(Date | null)[]>(
    new Array(selectedPackage?.stopOrder.length ?? 0).fill(null)
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!selectedPackage) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={32} color={colors.textSecondary} />
        <Text style={styles.helperText}>선택된 조합이 없어요</Text>
      </View>
    );
  }

  const bundle = selectedPackage;

  function applyTime(index: number, time: Date) {
    if (index === 0) {
      if (bundle.latestPickupBy && time > new Date(bundle.latestPickupBy)) {
        Alert.alert(
          '픽업 시간이 너무 늦어요',
          `모든 배송완료 마감을 맞추려면 첫 픽업을 ${formatDateTime(bundle.latestPickupBy)} 이전에 해야 해요`
        );
        return;
      }
      // first pickup time anchors the whole cascade — recompute every
      // subsequent stop's estimated time from it
      const times: Date[] = [time];
      for (let k = 1; k < bundle.stopOrder.length; k++) {
        const legSec = bundle.legDurationsSec[k] ?? 0;
        times.push(new Date(times[k - 1].getTime() + legSec * 1000));
      }
      setStopTimes(times);
    } else {
      setStopTimes((prev) => {
        const next = [...prev];
        next[index] = time;
        return next;
      });
    }
  }

  function openPickerFor(index: number) {
    const current = stopTimes[index] ?? new Date();
    if (Platform.OS === 'android') {
      openAndroidDateTimePicker(current, (picked) => applyTime(index, picked));
    } else {
      setEditingIndex(index);
    }
  }

  async function confirmSelection() {
    if (stopTimes.some((t) => !t)) {
      Alert.alert('모든 정류지의 예상 시각을 입력해주세요');
      return;
    }
    setSubmitting(true);
    try {
      const pickupEtaByItem = new Map<string, Date>();
      const deliveryEtaByItem = new Map<string, Date>();
      bundle.stopOrder.forEach((stop, i) => {
        const time = stopTimes[i]!;
        if (stop.kind === 'pickup') pickupEtaByItem.set(stop.itemId, time);
        else deliveryEtaByItem.set(stop.itemId, time);
      });

      const itemIds = bundle.items.map((item) => item.id);
      const { error } = await supabase.rpc('select_items', {
        p_item_ids: itemIds,
        p_pickup_etas: itemIds.map((id) => pickupEtaByItem.get(id)!.toISOString()),
        p_delivery_etas: itemIds.map((id) => deliveryEtaByItem.get(id)!.toISOString()),
        p_total_detour_minutes: bundle.totalDetourMinutes,
        p_total_extra_toll_fare: bundle.totalExtraTollFare,
        p_total_extra_distance_meters: bundle.totalExtraDistanceMeters,
      });
      if (error) throw error;

      Alert.alert('선택 완료', '업로더들에게 알림이 전송됐어요');
      setSelectedPackage(null);
      router.back();
    } catch (e) {
      Alert.alert('선택 실패', getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>배송 {bundle.items.length}개 묶음</Text>
        <Text style={styles.price}>{bundle.totalPrice.toLocaleString()}원</Text>
        <Text style={styles.helperText}>
          +{bundle.totalDetourMinutes}분 · 톨비 {bundle.totalExtraTollFare.toLocaleString()}원
        </Text>
        {bundle.latestPickupBy && (
          <View style={styles.deadlineRow}>
            <Ionicons name="alarm-outline" size={14} color={colors.danger} />
            <Text style={styles.deadlineText}>
              {formatDateTime(bundle.latestPickupBy)} 이전 출발 필요
            </Text>
          </View>
        )}
      </View>

      {bundle.stopOrder.map((stop, i) => {
        const item = bundle.items.find((it) => it.id === stop.itemId)!;
        const time = stopTimes[i];
        const isPickup = stop.kind === 'pickup';
        return (
          <View key={`${stop.itemId}-${stop.kind}`} style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{i + 1}</Text>
              </View>
              <Ionicons
                name={isPickup ? 'location' : 'flag'}
                size={16}
                color={isPickup ? colors.warning : colors.info}
              />
              <Text style={styles.sectionTitle}>
                {isPickup ? '픽업' : '도착'}: {item.title}
              </Text>
            </View>

            {isPickup ? (
              <>
                <Text style={styles.bodyText}>{item.pickup_address}</Text>
                <View style={styles.itemInfoRow}>
                  {item.photo_url ? (
                    <Image source={{ uri: item.photo_url }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Ionicons name="cube-outline" size={20} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={styles.itemInfoBody}>
                    {item.description && (
                      <Text style={styles.helperText} numberOfLines={2}>
                        {item.description}
                      </Text>
                    )}
                    <Text style={styles.priceTag}>{item.price.toLocaleString()}원</Text>
                  </View>
                </View>
                {item.pickup_instruction && (
                  <Text style={styles.helperText}>픽업 안내: {item.pickup_instruction}</Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.bodyText}>{item.dropoff_address}</Text>
                {item.dropoff_instruction && (
                  <Text style={styles.helperText}>도착 안내: {item.dropoff_instruction}</Text>
                )}
                {item.delivery_deadline && (
                  <Text style={styles.helperText}>
                    배송완료 마감: {formatDateTime(item.delivery_deadline)}
                  </Text>
                )}
              </>
            )}

            <Button
              title={
                i === 0
                  ? time
                    ? `첫 픽업 시각: ${formatDateTime(time)}`
                    : '첫 픽업 예정 시각 선택'
                  : time
                    ? formatDateTime(time)
                    : '픽업/도착 시각 선택 (첫 픽업 시각 입력 시 자동완성)'
              }
              onPress={() => openPickerFor(i)}
              variant="outline"
            />
            {Platform.OS === 'ios' && editingIndex === i && (
              <>
                <DateTimePicker
                  value={time ?? new Date()}
                  mode="datetime"
                  display="spinner"
                  onChange={(_, date) => {
                    if (date) applyTime(i, date);
                  }}
                />
                <Button title="완료" onPress={() => setEditingIndex(null)} variant="outline" />
              </>
            )}
          </View>
        );
      })}

      <Button
        title={submitting ? '선택 중...' : '이 조합으로 선택하기'}
        onPress={confirmSelection}
        disabled={submitting || stopTimes.some((t) => !t)}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  headerCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.xs,
    ...shadow.card,
  },
  title: {
    ...typography.title,
    fontSize: 18,
  },
  price: {
    ...typography.price,
    color: colors.primary,
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
  },
  sectionTitle: {
    ...typography.subtitle,
    fontSize: 14,
  },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  bodyText: {
    ...typography.body,
  },
  helperText: {
    ...typography.caption,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  deadlineText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '600',
  },
  itemInfoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  itemInfoBody: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
  },
  thumbPlaceholder: {
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceTag: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
});
