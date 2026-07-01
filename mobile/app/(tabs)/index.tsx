import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { callFunction } from '../../lib/kakaoFunctions';
import { useSearch, type Item } from '../../lib/SearchContext';

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
          <Text style={styles.sectionTitle}>내 출발지</Text>
          <Button
            title={locating ? '위치 확인 중...' : '현재 위치 사용'}
            onPress={useOriginCurrentLocation}
            disabled={locating}
          />
          {origin && (
            <Text style={styles.helperText}>
              {origin.address} {origin.district ? `(${origin.district})` : ''}
            </Text>
          )}

          <Text style={styles.sectionTitle}>내 목적지</Text>
          <TextInput
            style={styles.input}
            placeholder="목적지 주소 검색"
            value={destQuery}
            onChangeText={setDestQuery}
          />
          <Button
            title={searchingDest ? '검색 중...' : '주소 검색'}
            onPress={searchDestination}
            disabled={searchingDest || !destQuery.trim()}
          />
          {destination && (
            <Text style={styles.helperText}>
              {destination.address} {destination.district ? `(${destination.district})` : ''}
            </Text>
          )}

          <Text style={styles.sectionTitle}>반경 (km)</Text>
          <TextInput
            style={styles.input}
            placeholder="반경 (km)"
            value={radiusKm}
            onChangeText={setRadiusKm}
            keyboardType="number-pad"
          />

          <Button title={searching ? '검색 중...' : '검색하기'} onPress={search} disabled={searching} />
          {searching && <ActivityIndicator />}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card} onTouchEnd={() => router.push(`/item/${item.id}`)}>
          {item.photo_url && <Image source={{ uri: item.photo_url }} style={styles.thumb} />}
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text>{item.price.toLocaleString()}원</Text>
            <Text style={styles.helperText}>
              {item.pickup_district} → {item.dropoff_district}
            </Text>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.helperText}>검색 결과가 없어요</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  filters: {
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
  },
  helperText: {
    color: '#555',
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginBottom: 8,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontWeight: '600',
  },
});
