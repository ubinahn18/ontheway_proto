import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { callFunction } from '../../lib/kakaoFunctions';
import { useSearch } from '../../lib/SearchContext';
import { searchItemsAlongRoute } from '../../lib/routeSearch';
import { searchItemBundles } from '../../lib/bundleSearch';
import { colors, radius, shadow, spacing, typography } from '../../lib/theme';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { Chip } from '../../components/ui/Chip';
import { ItemCard } from '../../components/ItemCard';
import { PackageCard } from '../../components/PackageCard';

const DETOUR_FILTERS = [15, 30, 45] as const;
const ITEM_COUNTS = [1, 2, 3] as const;

export default function BrowseScreen() {
  const router = useRouter();
  const {
    origin,
    setOrigin,
    destination,
    setDestination,
    results,
    setResults,
    packageResults,
    setPackageResults,
    setSelectedPackage,
  } = useSearch();

  const [originQuery, setOriginQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [searchingOrigin, setSearchingOrigin] = useState(false);
  const [searchingDest, setSearchingDest] = useState(false);
  const [searching, setSearching] = useState(false);
  const [maxDetourMinutes, setMaxDetourMinutes] = useState<number>(15);
  const [itemCount, setItemCount] = useState<(typeof ITEM_COUNTS)[number]>(1);

  const filteredResults = useMemo(
    () => results.filter((item) => item.detourMinutes <= maxDetourMinutes),
    [results, maxDetourMinutes]
  );
  const filteredPackages = useMemo(
    () => packageResults.filter((bundle) => bundle.totalDetourMinutes <= maxDetourMinutes),
    [packageResults, maxDetourMinutes]
  );

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

  async function searchOrigin() {
    if (!originQuery.trim()) return;
    setSearchingOrigin(true);
    try {
      const data = await callFunction<{
        address: string;
        district: string | null;
        lng: number;
        lat: number;
      }>('kakao-address-search', { query: originQuery });
      setOrigin(data);
    } catch (e) {
      Alert.alert('주소를 찾지 못했어요', e instanceof Error ? e.message : String(e));
    } finally {
      setSearchingOrigin(false);
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
      if (itemCount === 1) {
        const candidates = await searchItemsAlongRoute(origin, destination);
        setResults(candidates);
        setPackageResults([]);
      } else {
        const bundles = await searchItemBundles(origin, destination, itemCount);
        setPackageResults(bundles);
        setResults([]);
      }
    } catch (e) {
      Alert.alert('검색 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }

  const header = (
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
        <TextField
          placeholder="출발지 주소 검색"
          value={originQuery}
          onChangeText={setOriginQuery}
        />
        <Button
          title={searchingOrigin ? '검색 중...' : '주소 검색'}
          onPress={searchOrigin}
          disabled={searchingOrigin || !originQuery.trim()}
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
          <Ionicons name="albums" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>배송 개수</Text>
        </View>
        <View style={styles.chipRow}>
          {ITEM_COUNTS.map((count) => (
            <Chip
              key={count}
              label={`${count}개`}
              selected={itemCount === count}
              onPress={() => setItemCount(count)}
            />
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <View style={styles.labelRow}>
          <Ionicons name="time" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>추가 소요시간</Text>
        </View>
        <View style={styles.chipRow}>
          {DETOUR_FILTERS.map((minutes) => (
            <Chip
              key={minutes}
              label={`${minutes}분 이내`}
              selected={maxDetourMinutes === minutes}
              onPress={() => setMaxDetourMinutes(minutes)}
            />
          ))}
        </View>
      </View>

      <Button title={searching ? '검색 중...' : '검색하기'} onPress={search} disabled={searching} />
      {searching && <ActivityIndicator color={colors.primary} style={styles.spinner} />}
    </View>
  );

  if (itemCount > 1) {
    return (
      <FlatList
        contentContainerStyle={styles.container}
        data={filteredPackages}
        keyExtractor={(_, i) => String(i)}
        ListHeaderComponent={header}
        renderItem={({ item: bundle }) => (
          <PackageCard
            bundle={bundle}
            onPress={() => {
              setSelectedPackage(bundle);
              router.push('/bundle-review');
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="albums-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.helperText}>
              {packageResults.length > 0 ? '선택한 시간 안에는 결과가 없어요' : '검색 결과가 없어요'}
            </Text>
          </View>
        }
      />
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={filteredResults}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <ItemCard
          item={item}
          onPress={() => router.push(`/item/${item.id}`)}
          detourMinutes={item.detourMinutes}
          extraTollFare={item.extraTollFare}
          latestPickupBy={item.latestPickupBy}
        />
      )}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={32} color={colors.textSecondary} />
          <Text style={styles.helperText}>
            {results.length > 0 ? '선택한 시간 안에는 결과가 없어요' : '검색 결과가 없어요'}
          </Text>
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
