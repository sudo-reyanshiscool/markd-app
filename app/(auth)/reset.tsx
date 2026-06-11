import React, { useState } from "react";
import { View } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";

import { Button, Input, Screen, ScreenHeader, Text } from "@/components/ui";
import { resetPassword } from "@/features/auth/actions";
import { useTheme } from "@/providers/theme";

const schema = z.object({ email: z.string().trim().email() });
type Form = z.infer<typeof schema>;

export default function Reset() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const submit = handleSubmit(async ({ email }) => {
    setBusy(true);
    setServerError(null);
    try {
      await resetPassword(email);
      setSent(true);
    } catch {
      setServerError(t("auth.authFailed"));
    } finally {
      setBusy(false);
    }
  });

  return (
    <Screen scroll>
      <ScreenHeader title={t("auth.reset")} />
      <View style={{ gap: 16 }}>
        {sent ? (
          <Text variant="heading">{t("auth.resetSent")}</Text>
        ) : (
          <>
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
                  keyboardType="email-address"
                />
              )}
            />
            {serverError ? (
              <Text variant="caption" color={theme.danger}>
                {serverError}
              </Text>
            ) : null}
            <Button label={t("auth.reset")} size="lg" block loading={busy} onPress={submit} />
          </>
        )}
      </View>
    </Screen>
  );
}
