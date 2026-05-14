import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { Sidebar } from "@/components/sidebar";
import { NoBrandWelcome } from "@/components/no-brand";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { brands, active } = await resolveActiveBrand();

  if (brands.length === 0) {
    return <NoBrandWelcome email={user.email ?? null} />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar brands={brands} active={active} userEmail={user.email ?? null} />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-6 py-8 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
