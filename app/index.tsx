import { Text, View } from "react-native";

export default function Smoke() {
  return (
    <View className="flex-1 items-center justify-center bg-paper">
      <View className="rounded-card border-2 border-ink bg-volt px-8 py-6">
        <Text className="text-3xl font-bold text-ink">MARKD</Text>
      </View>
    </View>
  );
}
