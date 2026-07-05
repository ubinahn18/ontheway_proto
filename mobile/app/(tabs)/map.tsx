import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { callFunction } from '../../lib/kakaoFunctions';
import { useSearch, type Item } from '../../lib/SearchContext';
import { colors, radius, shadow, spacing, typography } from '../../lib/theme';

const PIN_COLORS = {
  origin: colors.primary,
  destination: colors.success,
  pickup: colors.warning,
  dropoff: colors.info,
};

type NaviResult = {
  viaVertices: { lng: number; lat: number }[];
};

export default function MapScreen() {
  const router = useRouter();
  const { origin, destination, results } = useSearch();
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('items')
          .select('id')
          .eq('selected_by', user.id)
          .in('status', ['selected', 'delivered'])
          .order('selected_at', { ascending: false })
          .limit(1);
        if (cancelled) return;
        if (!data?.[0]) {
          setActiveItem(null);
          return;
        }
        const { data: full } = await supabase.rpc('get_item_with_coords', {
          p_item_id: data[0].id,
        });
        if (!cancelled) setActiveItem((full?.[0] as Item) ?? null);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  useEffect(() => {
    if (!activeItem || !origin || !destination) {
      setRouteCoords([]);
      return;
    }
    callFunction<NaviResult>('kakao-navi-proxy', {
      originLng: origin.lng,
      originLat: origin.lat,
      destLng: destination.lng,
      destLat: destination.lat,
      pickupLng: activeItem.pickup_lng,
      pickupLat: activeItem.pickup_lat,
      dropoffLng: activeItem.dropoff_lng,
      dropoffLat: activeItem.dropoff_lat,
    })
      .then((navi) => {
        setRouteCoords(navi.viaVertices.map((v) => ({ latitude: v.lat, longitude: v.lng })));
      })
      .catch(() => setRouteCoords([]));
  }, [activeItem, origin, destination]);

  if (!origin || !destination) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyCard}>
          <Ionicons name="map-outline" size={32} color={colors.textSecondary} />
          <Text style={styles.emptyText}>배송 찾기 탭에서{'\n'}출발지/목적지를 먼저 설정해주세요</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: origin.lat,
          longitude: origin.lng,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
      >
        <Marker
          coordinate={{ latitude: origin.lat, longitude: origin.lng }}
          title="내 출발지"
          pinColor={PIN_COLORS.origin}
        />
        <Marker
          coordinate={{ latitude: destination.lat, longitude: destination.lng }}
          title="내 목적지"
          pinColor={PIN_COLORS.destination}
        />

        {activeItem ? (
          <>
            <Marker
              coordinate={{ latitude: activeItem.pickup_lat, longitude: activeItem.pickup_lng }}
              title={`[픽업] ${activeItem.title}`}
              pinColor={PIN_COLORS.pickup}
              onCalloutPress={() => router.push(`/item/${activeItem.id}`)}
            />
            <Marker
              coordinate={{ latitude: activeItem.dropoff_lat, longitude: activeItem.dropoff_lng }}
              title={`[도착] ${activeItem.title}`}
              pinColor={PIN_COLORS.dropoff}
              onCalloutPress={() => router.push(`/item/${activeItem.id}`)}
            />
            {routeCoords.length > 1 && (
              <Polyline coordinates={routeCoords} strokeColor={colors.primary} strokeWidth={4} />
            )}
          </>
        ) : (
          <>
            {results.map((item) => (
              <Marker
                key={`${item.id}-pickup`}
                coordinate={{ latitude: item.pickup_lat, longitude: item.pickup_lng }}
                title={`[픽업] ${item.title}`}
                description={`${item.price.toLocaleString()}원`}
                pinColor={PIN_COLORS.pickup}
                onCalloutPress={() => router.push(`/item/${item.id}`)}
              />
            ))}
            {results.map((item) => (
              <Marker
                key={`${item.id}-dropoff`}
                coordinate={{ latitude: item.dropoff_lat, longitude: item.dropoff_lng }}
                title={`[도착] ${item.title}`}
                description={`${item.price.toLocaleString()}원`}
                pinColor={PIN_COLORS.dropoff}
                onCalloutPress={() => router.push(`/item/${item.id}`)}
              />
            ))}
          </>
        )}
      </MapView>

      <View style={styles.legend}>
        <LegendDot color={PIN_COLORS.origin} label="출발지" />
        <LegendDot color={PIN_COLORS.destination} label="목적지" />
        <LegendDot color={PIN_COLORS.pickup} label="픽업지" />
        <LegendDot color={PIN_COLORS.dropoff} label="도착지" />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    margin: spacing.xxl,
    gap: spacing.md,
    padding: spacing.xxl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  map: {
    flex: 1,
  },
  legend: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...typography.caption,
  },
});
