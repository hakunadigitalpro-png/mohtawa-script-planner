import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Brand } from "@/lib/types";

const COOKIE_NAME = "active_brand";

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
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, created_by, created_at")
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data as Brand[]) ?? [];
}

export async function resolveActiveBrand(): Promise<{
  brands: Brand[];
  active: Brand | null;
}> {
  const brands = await listUserBrands();
  if (brands.length === 0) return { brands, active: null };
  const stored = await getActiveBrandId();
  const active = brands.find((b) => b.id === stored) ?? brands[0];
  return { brands, active };
}
