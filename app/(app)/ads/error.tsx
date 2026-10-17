"use client";

export default function AdsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
      <h2 className="mb-2 text-base font-semibold">/ads a planté</h2>
      <p className="mb-2">
        <strong>Message :</strong> {error.message || "(masqué par Next en prod)"}
      </p>
      {error.digest ? (
        <p className="mb-2">
          <strong>Digest :</strong> {error.digest}
        </p>
      ) : null}
      <p className="mb-2 text-xs text-rose-900/70">
        Le vrai message serveur se trouve dans tes logs Vercel : projet
        mohtawa-script-planner → onglet « Logs » → filtre /ads → ligne juste
        avant ce digest.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-3 rounded-full bg-rose-900 px-3 py-1 text-xs text-white"
      >
        Réessayer
      </button>
    </div>
  );
}
