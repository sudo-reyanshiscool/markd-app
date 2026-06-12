import React, { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Input, Slab, Text } from "@/components/ui";
import { School } from "@/db/schemas";
import { OnboardingFrame } from "@/features/onboarding/Frame";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useTheme } from "@/providers/theme";
import { useOnboardingStore } from "@/stores/onboarding";
import { useSessionStore } from "@/stores/session";

/**
 * Typeahead against schools (verified first, limit 20 — spec §6.2).
 * Guest mode (or keyless dev) skips the server and stores free text.
 */
function useSchoolSearch(term: string) {
  const mode = useSessionStore((s) => s.mode);
  const enabled = mode === "authed" && isSupabaseConfigured && term.trim().length >= 2;
  return useQuery({
    queryKey: ["schools", term.trim().toLowerCase()],
    queryFn: async (): Promise<School[]> => {
      const { data, error } = await supabase!
        .from("schools")
        .select("*")
        .ilike("name", `%${term.trim()}%`)
        .order("verified", { ascending: false })
        .order("name")
        .limit(20);
      if (error) throw error;
      return (data ?? []) as School[];
    },
    enabled,
    staleTime: 30_000,
  });
}

export default function StepSchool() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const draft = useOnboardingStore();
  const mode = useSessionStore((s) => s.mode);
  const [term, setTerm] = useState(draft.schoolName ?? "");
  const results = useSchoolSearch(term);

  const selectSchool = (school: School) => {
    draft.set({ schoolId: school.id, schoolName: school.name });
    setTerm(school.name);
  };

  const addSchool = async () => {
    const name = term.trim();
    if (!name) return;
    if (mode === "authed" && supabase) {
      const { data, error } = await supabase
        .from("schools")
        .insert({ name, country: draft.country || null })
        .select("*")
        .single();
      if (!error && data) {
        selectSchool(data as School);
        return;
      }
    }
    draft.set({ schoolId: null, schoolName: name });
  };

  const showResults =
    mode === "authed" && term.trim().length >= 2 && term !== draft.schoolName;

  return (
    <OnboardingFrame
      step={2}
      title={t("onboarding.schoolTitle")}
      sub={t("onboarding.schoolSub")}
      nextDisabled={false}
      nextLabel={
        term.trim() || draft.schoolName ? t("onboarding.next") : t("onboarding.schoolSkip")
      }
      onNext={async () => {
        if (term.trim() && term.trim() !== draft.schoolName) await addSchool();
        if (!term.trim()) draft.set({ schoolId: null, schoolName: null });
        router.push("/onboarding/country");
      }}
    >
      <Input
        value={term}
        onChangeText={setTerm}
        placeholder={t("onboarding.schoolPlaceholder")}
        autoCapitalize="words"
        testID="onboarding-school"
      />
      {showResults ? (
        <View style={{ marginTop: 12, gap: 8 }}>
          {(results.data ?? []).map((school) => (
            <Slab
              key={school.id}
              onPress={() => selectSchool(school)}
              offset={2}
              radius={12}
              contentStyle={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text variant="bodyBold" style={{ flex: 1 }} numberOfLines={1}>
                {school.name}
              </Text>
              {school.verified ? (
                <Text variant="monoSm" color={theme.success}>
                  ✓
                </Text>
              ) : null}
              {school.country ? (
                <Text variant="caption" muted>
                  {school.country}
                </Text>
              ) : null}
            </Slab>
          ))}
          {term.trim().length >= 2 && !results.isPending ? (
            <Slab
              onPress={addSchool}
              color={theme.well}
              offset={2}
              radius={12}
              contentStyle={{ padding: 12 }}
            >
              <Text variant="bodyMedium">
                {t("onboarding.schoolAdd", { name: term.trim() })}
              </Text>
            </Slab>
          ) : null}
        </View>
      ) : null}
    </OnboardingFrame>
  );
}
