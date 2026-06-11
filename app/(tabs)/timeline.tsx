import React from "react";

import { EmptyState, Screen, ScreenHeader } from "@/components/ui";

export default function Placeholder_timeline() {
  return (
    <Screen dock scroll>
      <ScreenHeader title="timeline" back={false} />
      <EmptyState title="Under construction" body="This screen lands in the next build phase." />
    </Screen>
  );
}
