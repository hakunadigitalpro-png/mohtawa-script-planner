import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ShareView } from "@/components/share/share-view";

export const metadata = {
  title: "Vidéo partagée — Kreatly",
  robots: { index: false, follow: false },
};

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_shared_content", {
    p_token: token,
  });
  if (error || !data) notFound();

  // Le bundle inclut `share_mode` (lecture seule ou commentaires autorisés)
  // et `comments` (anonymisés — pas d'email d'équipe exposé publiquement),
  // ajoutés par la migration 0012.
  return <ShareView bundle={data} token={token} />;
}
