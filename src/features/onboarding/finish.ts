import { STARTER_TASKS } from "@/constants/tracks";
import { updateProfile } from "@/features/auth/api";
import { localBackend } from "@/lib/backend";
import { SupabaseBackend } from "@/lib/backend/remote";
import { supabase } from "@/lib/supabase";
import { useOnboardingStore } from "@/stores/onboarding";
import { useSessionStore } from "@/stores/session";

/**
 * Spec §6 step 7, in order: (a) profile, (b) first subject at position 0,
 * (c) exactly three starter tasks on that subject. Works for both guest
 * (local) and authed (Supabase) sessions.
 */
export async function completeOnboarding(): Promise<void> {
  const draft = useOnboardingStore.getState();
  const session = useSessionStore.getState();

  if (session.mode === "authed" && session.userId && supabase) {
    const backend = new SupabaseBackend(supabase, session.userId);
    await updateProfile(session.userId, {
      name: draft.name || null,
      school_id: draft.schoolId,
      country: draft.country || null,
      exam_track: draft.track,
      year_group: draft.yearGroup,
      onboarded_at: new Date().toISOString(),
    });
    const subject = await backend.insert("subjects", {
      name: draft.subjectName.trim(),
      board: null,
      target_grade: null,
      color: draft.subjectColor,
      position: 0,
      archived_at: null,
    });
    for (const starter of STARTER_TASKS) {
      await backend.insert("tasks", {
        subject_id: subject.id,
        text: starter.text,
        done: false,
        priority: starter.priority,
        estimate_minutes: null,
        topic: null,
        due_date: null,
        recurrence: null,
        snoozed_until: null,
        completed_at: null,
      });
    }
  } else {
    await localBackend.setProfile({
      name: draft.name || null,
      school_name: draft.schoolName,
      country: draft.country || null,
      exam_track: draft.track,
      year_group: draft.yearGroup,
    });
    const subject = await localBackend.insert("subjects", {
      name: draft.subjectName.trim(),
      board: null,
      target_grade: null,
      color: draft.subjectColor,
      position: 0,
      archived_at: null,
    });
    for (const starter of STARTER_TASKS) {
      await localBackend.insert("tasks", {
        subject_id: subject.id,
        text: starter.text,
        done: false,
        priority: starter.priority,
        estimate_minutes: null,
        topic: null,
        due_date: null,
        recurrence: null,
        snoozed_until: null,
        completed_at: null,
      });
    }
    session.setGuestOnboarded(true);
  }

  draft.reset();
}
