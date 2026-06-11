import React from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { EmptyState, Screen } from "@/components/ui";

export default function NotFound() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <Screen>
      <EmptyState
        title="404"
        body={t("common.error")}
        doodle="burst"
        cta={t("common.back")}
        onCta={() => router.replace("/")}
      />
    </Screen>
  );
}
