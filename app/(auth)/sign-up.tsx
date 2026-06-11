import React, { useState } from "react";
import { View } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";

import { Button, Input, Screen, ScreenHeader, Text } from "@/components/ui";
import { signUpWithPassword } from "@/features/auth/actions";
import { useTheme } from "@/providers/theme";

const schema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(8),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "mismatch",
  });
type Form = z.infer<typeof schema>;

export default function SignUp() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { control, handleSubmit } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", confirm: "" },
  });

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    setBusy(true);
    try {
      await signUpWithPassword(values.email, values.password);
      // Auth listener + handle_new_user trigger take it from here.
    } catch {
      setServerError(t("auth.authFailed"));
    } finally {
      setBusy(false);
    }
  });

  return (
    <Screen scroll>
      <ScreenHeader title={t("auth.signUp")} />
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
              autoComplete="new-password"
              testID="password"
            />
          )}
        />
        <Controller
          control={control}
          name="confirm"
          render={({ field, fieldState }) => (
            <Input
              label={t("auth.confirmPassword")}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error ? t("auth.passwordMismatch") : undefined}
              secureTextEntry
              autoComplete="new-password"
              testID="confirm"
            />
          )}
        />
        {serverError ? (
          <Text variant="caption" color={theme.danger}>
            {serverError}
          </Text>
        ) : null}
        <Button
          label={t("auth.signUp")}
          size="lg"
          block
          loading={busy}
          onPress={submit}
          testID="submit"
        />
        <Link href="/(auth)/sign-in" style={{ alignSelf: "center", marginTop: 4 }}>
          <Text variant="caption" muted style={{ textDecorationLine: "underline" }}>
            {t("auth.haveAccount")} {t("auth.signIn")}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
