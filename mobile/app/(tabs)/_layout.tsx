import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: '둘러보기' }} />
      <Tabs.Screen name="map" options={{ title: '지도' }} />
      <Tabs.Screen name="my-items" options={{ title: '내 아이템' }} />
      <Tabs.Screen name="my-selections" options={{ title: '내 선택' }} />
    </Tabs>
  );
}
