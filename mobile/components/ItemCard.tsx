import { Image, StyleSheet, Text, View } from 'react-native';
import type { Item } from '../lib/SearchContext';
import { statusLabel } from '../lib/itemStatus';

export function ItemCard({ item, onPress }: { item: Item; onPress: () => void }) {
  return (
    <View style={styles.card} onTouchEnd={onPress}>
      {item.photo_url && <Image source={{ uri: item.photo_url }} style={styles.thumb} />}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text>
          {item.price.toLocaleString()}원 · {statusLabel(item.status)}
        </Text>
        <Text style={styles.helperText}>
          {item.pickup_district} → {item.dropoff_district}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginTop: 12,
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
  helperText: {
    color: '#555',
  },
});
