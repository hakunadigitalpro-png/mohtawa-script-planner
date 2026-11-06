import type { SupabaseClient } from "@supabase/supabase-js";

export type TeamMember = { id: string; label: string };

/**
 * L'équipe d'une marque : ceux à qui on peut confier un contenu. Un client
 * invité n'en fait pas partie, il valide, il ne fabrique pas. La base refuse
 * de toute façon un responsable hors de cette liste (0094).
 */
export async function fetchTeam(
  supabase: SupabaseClient,
  brandId: string,
): Promise<TeamMember[]> {
  const { data } = await supabase
    .from("brand_members_with_emails")
    .select("user_id, email, role")
    .eq("brand_id", brandId);
  return ((data ?? []) as { user_id: string; email: string | null; role: string }[])
    .filter((m) => m.role !== "viewer")
    .map((m) => ({ id: m.user_id, label: m.email?.split("@")[0] ?? "—" }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
