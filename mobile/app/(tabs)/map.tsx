import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useSearch } from '../../lib/SearchContext';
import { colors, radius, shadow, spacing, typography } from '../../lib/theme';

export default function MapScreen() {
  const router = useRouter();
  const { origin, destination, results } = useSearch();

  if (!origin || !destination) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyCard}>
          <Ionicons name="map-outline" size={32} color={colors.textSecondary} />
          <Text style={styles.emptyText}>둘러보기 탭에서{'\n'}출발지/목적지를 먼저 설정해주세요</Text>
        </View>
      </View>
    );
  }

  return (
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
        pinColor="blue"
      />
      <Marker
        coordinate={{ latitude: destination.lat, longitude: destination.lng }}
        title="내 목적지"
        pinColor="green"
      />
      {results.map((item) => (
        <Marker
          key={`${item.id}-pickup`}
          coordinate={{ latitude: item.pickup_lat, longitude: item.pickup_lng }}
          title={`[픽업] ${item.title}`}
          description={`${item.price.toLocaleString()}원`}
          onCalloutPress={() => router.push(`/item/${item.id}`)}
        />
      ))}
      {results.map((item) => (
        <Marker
          key={`${item.id}-dropoff`}
          coordinate={{ latitude: item.dropoff_lat, longitude: item.dropoff_lng }}
          title={`[도착] ${item.title}`}
          description={`${item.price.toLocaleString()}원`}
          pinColor="orange"
          onCalloutPress={() => router.push(`/item/${item.id}`)}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },
  emptyCard: {
    alignItems: 'center',
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
});
