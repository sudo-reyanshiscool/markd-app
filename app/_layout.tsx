import "../global.css";
import "@/lib/i18n";

import React, { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  Unbounded_700Bold,
  Unbounded_800ExtraBold,
  Unbounded_900Black,
} from "@expo-google-fonts/unbounded";
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from "@expo-google-fonts/bricolage-grotesque";
import {
  AzeretMono_500Medium,
  AzeretMono_700Bold,
} from "@expo-google-fonts/azeret-mono";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { useTheme } from "@/providers/theme";
import { useSessionStore } from "@/stores/session";
import {
  QUERY_CACHE_BUSTER,
  queryClient,
  queryPersister,
} from "@/lib/queryClient";
import { useAuthListener, useGateState } from "@/features/auth/hooks";
import { ConsentDialog } from "@/features/settings/ConsentDialog";
import { initObservability } from "@/lib/observability";

void SplashScreen.preventAutoHideAsync().catch(() => {});

initObservability();

function RootNavigator() {
  const theme = useTheme();
  const gate = useGateState();
  useAuthListener();

  useEffect(() => {
    if (gate.ready) void SplashScreen.hideAsync().catch(() => {});
  }, [gate.ready]);

  if (!gate.ready) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  return (
    <>
      <StatusBar style={theme.name === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Protected guard={gate.showAuth}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={gate.showOnboarding}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={gate.showApp}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="focus" options={{ animation: "fade_from_bottom" }} />
          <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
        </Stack.Protected>
        {/* share/[slug] and +not-found are auto-registered file routes and stay public */}
      </Stack>
      <ConsentDialog />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Unbounded_700Bold,
    Unbounded_800ExtraBold,
    Unbounded_900Black,
    BricolageGrotesque_400Regular,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    AzeretMono_500Medium,
    AzeretMono_700Bold,
  });

  // Zustand persist rehydrates async on native; wait so gates don't flicker.
  const hydrated = useSessionStore.persist?.hasHydrated() ?? true;

  if (!fontsLoaded || !hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: queryPersister, buster: QUERY_CACHE_BUSTER }}
        >
          <RootNavigator />
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
