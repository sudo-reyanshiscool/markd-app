import { supabase } from "@/lib/supabase";

export interface ProfileRow {
  id: string;
  email: string;
  name: string | null;
  school_id: string | null;
  country: string | null;
  year_group: string | null;
  exam_track: "gcse" | "igcse" | "ib" | "alevel" | "other" | null;
  onboarded_at: string | null;
  plan: "free" | "pro" | "family";
  theme: "system" | "light" | "dark";
  revision_mode: boolean;
  locale: string;
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, name, school_id, country, year_group, exam_track, onboarded_at, plan, theme, revision_mode, locale",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ProfileRow | null) ?? null;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Omit<ProfileRow, "id" | "email" | "plan">>,
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}
