import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { callFunction } from '../../lib/kakaoFunctions';
import { useSearch, type Item } from '../../lib/SearchContext';

type NaviResult = {
  directDurationSec: number;
  viaDurationSec: number;
  diffMinutes: number;
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
    setSelecting(true);
    try {
      const { error } = await supabase.rpc('select_item', { p_item_id: item.id });
      if (error) throw error;
      Alert.alert('선택 완료', '업로더에게 알림이 전송됐어요');
      router.back();
    } catch (e) {
      Alert.alert('선택 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSelecting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <Text>아이템을 찾을 수 없어요</Text>
      </View>
    );
  }

  const isOwnItem = currentUserId === item.uploader_id;
  const isExpired = new Date(item.valid_until).getTime() < Date.now();
  const canSelect = item.status === 'available' && !isOwnItem && !isExpired;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {item.photo_url && <Image source={{ uri: item.photo_url }} style={styles.photo} />}
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.price}>{item.price.toLocaleString()}원</Text>
      {item.description && <Text>{item.description}</Text>}

      <Text style={styles.sectionTitle}>픽업지</Text>
      <Text>{item.pickup_address}</Text>
      <Text style={styles.sectionTitle}>도착지</Text>
      <Text>{item.dropoff_address}</Text>

      <Text style={styles.sectionTitle}>마감 시각</Text>
      <Text>{new Date(item.valid_until).toLocaleString()}</Text>

      <Text style={styles.sectionTitle}>경유 시 추가 소요 시간</Text>
      {!origin || !destination ? (
        <Text style={styles.helperText}>
          둘러보기 탭에서 내 출발지/목적지를 먼저 설정해야 계산할 수 있어요
        </Text>
      ) : naviLoading ? (
        <ActivityIndicator />
      ) : naviError ? (
        <Text style={styles.helperText}>{naviError}</Text>
      ) : navi ? (
        <Text style={styles.diff}>+{navi.diffMinutes}분 더 소요</Text>
      ) : null}

      <View style={styles.selectRow}>
        <Button
          title={
            isOwnItem
              ? '내가 등록한 아이템이에요'
              : isExpired
                ? '마감된 아이템이에요'
                : item.status !== 'available'
                  ? '이미 선택된 아이템이에요'
                  : selecting
                    ? '선택 중...'
                    : '선택하기'
          }
          onPress={select}
          disabled={!canSelect || selecting}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  price: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionTitle: {
    fontWeight: '600',
    marginTop: 8,
  },
  helperText: {
    color: '#555',
  },
  diff: {
    fontSize: 18,
    fontWeight: '700',
    color: '#c0392b',
  },
  selectRow: {
    marginTop: 16,
  },
});
