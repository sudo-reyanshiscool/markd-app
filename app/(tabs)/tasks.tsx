import React from "react";

import { EmptyState, Screen, ScreenHeader } from "@/components/ui";

export default function Placeholder_tasks() {
  return (
    <Screen dock scroll>
      <ScreenHeader title="tasks" back={false} />
      <EmptyState title="Under construction" body="This screen lands in the next build phase." />
    </Screen>
  );
}
