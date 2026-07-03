import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { callFunction } from '../../lib/kakaoFunctions';
import { useSearch, type Item } from '../../lib/SearchContext';
import { colors, radius, shadow, spacing, typography } from '../../lib/theme';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { ItemCard } from '../../components/ItemCard';

export default function BrowseScreen() {
  const router = useRouter();
  const {
    origin,
    setOrigin,
    destination,
    setDestination,
    radiusKm,
    setRadiusKm,
    results,
    setResults,
  } = useSearch();

  const [destQuery, setDestQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [searchingDest, setSearchingDest] = useState(false);
  const [searching, setSearching] = useState(false);

  async function useOriginCurrentLocation() {
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
      setOrigin({ address: data.address ?? '', district: data.district, lng, lat });
    } catch (e) {
      Alert.alert('위치를 가져오지 못했어요', e instanceof Error ? e.message : String(e));
    } finally {
      setLocating(false);
    }
  }

  async function searchDestination() {
    if (!destQuery.trim()) return;
    setSearchingDest(true);
    try {
      const data = await callFunction<{
        address: string;
        district: string | null;
        lng: number;
        lat: number;
      }>('kakao-address-search', { query: destQuery });
      setDestination(data);
    } catch (e) {
      Alert.alert('주소를 찾지 못했어요', e instanceof Error ? e.message : String(e));
    } finally {
      setSearchingDest(false);
    }
  }

  async function search() {
    if (!origin || !destination) {
      Alert.alert('출발지와 목적지를 먼저 설정해주세요');
      return;
    }
    setSearching(true);
    try {
      const radiusMeters = (Number(radiusKm) || 3) * 1000;
      const { data, error } = await supabase.rpc('items_matching_route', {
        seeker_origin_lng: origin.lng,
        seeker_origin_lat: origin.lat,
        seeker_dest_lng: destination.lng,
        seeker_dest_lat: destination.lat,
        origin_radius_meters: radiusMeters,
        dest_radius_meters: radiusMeters,
      });
      if (error) throw error;
      setResults((data as Item[]).sort((a, b) => b.price - a.price));
    } catch (e) {
      Alert.alert('검색 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={results}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.filters}>
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Ionicons name="navigate" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>내 출발지</Text>
            </View>
            <Button
              title={locating ? '위치 확인 중...' : '현재 위치 사용'}
              onPress={useOriginCurrentLocation}
              disabled={locating}
              variant="outline"
            />
            {origin && (
              <Text style={styles.helperText}>
                {origin.address} {origin.district ? `(${origin.district})` : ''}
              </Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Ionicons name="flag" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>내 목적지</Text>
            </View>
            <TextField
              placeholder="목적지 주소 검색"
              value={destQuery}
              onChangeText={setDestQuery}
            />
            <Button
              title={searchingDest ? '검색 중...' : '주소 검색'}
              onPress={searchDestination}
              disabled={searchingDest || !destQuery.trim()}
              variant="outline"
            />
            {destination && (
              <Text style={styles.helperText}>
                {destination.address} {destination.district ? `(${destination.district})` : ''}
              </Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Ionicons name="locate" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>반경 (km)</Text>
            </View>
            <TextField
              placeholder="반경 (km)"
              value={radiusKm}
              onChangeText={setRadiusKm}
              keyboardType="number-pad"
            />
          </View>

          <Button title={searching ? '검색 중...' : '검색하기'} onPress={search} disabled={searching} />
          {searching && <ActivityIndicator color={colors.primary} style={styles.spinner} />}
        </View>
      }
      renderItem={({ item }) => <ItemCard item={item} onPress={() => router.push(`/item/${item.id}`)} />}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={32} color={colors.textSecondary} />
          <Text style={styles.helperText}>검색 결과가 없어요</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  filters: {
    gap: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.subtitle,
  },
  helperText: {
    ...typography.caption,
  },
  spinner: {
    marginTop: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
});
