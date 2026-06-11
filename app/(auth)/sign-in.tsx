import React, { useState } from "react";
import { Platform, View } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { Button, Input, Screen, ScreenHeader, Text } from "@/components/ui";
import { signInWithApple, signInWithPassword } from "@/features/auth/actions";
import { useTheme } from "@/providers/theme";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});
type Form = z.infer<typeof schema>;

export default function SignIn() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { apple } = useLocalSearchParams<{ apple?: string }>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    setBusy(true);
    try {
      await signInWithPassword(values.email, values.password);
      // useAuthListener flips the gate; no manual navigation needed.
    } catch {
      setServerError(t("auth.authFailed"));
    } finally {
      setBusy(false);
    }
  });

  const appleFlow = async () => {
    setServerError(null);
    setBusy(true);
    try {
      await signInWithApple();
    } catch {
      setServerError(t("auth.authFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader title={t("auth.signIn")} />
      <View style={{ gap: 16 }}>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Input
              label={t("auth.email")}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error ? t("auth.emailInvalid") : undefined}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              testID="email"
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <Input
              label={t("auth.password")}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error ? t("auth.passwordShort") : undefined}
              secureTextEntry
              autoComplete="current-password"
              testID="password"
            />
          )}
        />
        {serverError ? (
          <Text variant="caption" color={theme.danger}>
            {serverError}
          </Text>
        ) : null}
        <Button
          label={t("auth.signIn")}
          size="lg"
          block
          loading={busy}
          disabled={!formState.isValid && formState.isSubmitted}
          onPress={submit}
          testID="submit"
        />
        {Platform.OS === "ios" && apple === "1" ? (
          <Button
            label={t("auth.apple")}
            variant="secondary"
            size="lg"
            icon="logo-apple"
            block
            loading={busy}
            onPress={appleFlow}
          />
        ) : null}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <Link href="/(auth)/reset">
            <Text variant="caption" muted style={{ textDecorationLine: "underline" }}>
              {t("auth.forgot")}
            </Text>
          </Link>
          <Link href="/(auth)/sign-up">
            <Text variant="caption" style={{ textDecorationLine: "underline" }}>
              {t("auth.noAccount")} {t("auth.signUp")}
            </Text>
          </Link>
        </View>
      </View>
    </Screen>
  );
}
