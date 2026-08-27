import { cookies } from "next/headers";
import { cache } from "react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import type { Brand } from "@/lib/types";

const COOKIE_NAME = "active_brand";

export type BrandRole = "owner" | "admin" | "editor" | "viewer";

export async function getActiveBrandId(): Promise<string | null> {
  const c = await cookies();
  return c.get(COOKIE_NAME)?.value ?? null;
}

export async function setActiveBrandId(brandId: string) {
  const c = await cookies();
  c.set(COOKIE_NAME, brandId, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function listUserBrands(): Promise<Brand[]> {
  const supabase = await createClient();
  // Le logo est embarqué via la relation 1:1 brand_kits (PK = brand_id) :
  // une seule requête au lieu de deux, pour afficher le logo à la place de
  // l'initiale dans le switcher.
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, created_by, created_at, brand_kits(logo_url)")
    .order("created_at", { ascending: true });
  if (error) return [];

  type Row = Omit<Brand, "logo_url"> & {
    brand_kits: { logo_url: string | null } | { logo_url: string | null }[] | null;
  };
  return ((data ?? []) as Row[]).map(({ brand_kits, ...b }) => {
    const kit = Array.isArray(brand_kits) ? brand_kits[0] : brand_kits;
    return { ...b, logo_url: kit?.logo_url ?? null };
  });
}

/**
 * Résout la marque active + le rôle de l'user courant dessus (client = rôle
 * "viewer", cantonné au Calendrier — voir les guards dans dashboard/
 * analytics/hooks/brands). `role` est null si aucune marque n'est active.
 *
 * Mémoïsé par requête (React cache) : le layout ET la page appellent tous
 * les deux `resolveActiveBrand()` — sans ça, chaque navigation refaisait
 * la liste des marques + la requête `brand_members` deux fois.
 */
export const resolveActiveBrand = cache(async (): Promise<{
  brands: Brand[];
  active: Brand | null;
  role: BrandRole | null;
}> => {
  const brands = await listUserBrands();
  if (brands.length === 0) return { brands, active: null, role: null };
  const stored = await getActiveBrandId();
  const active = brands.find((b) => b.id === stored) ?? brands[0];

  const user = await getCachedUser();
  let role: BrandRole | null = null;
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("brand_members")
      .select("role")
      .eq("brand_id", active.id)
      .eq("user_id", user.id)
      .maybeSingle();
    role = (data?.role as BrandRole | undefined) ?? null;
  }

  return { brands, active, role };
});
