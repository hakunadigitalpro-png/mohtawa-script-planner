"use client";

/**
 * Error boundary temporaire pour /ads — affiche le message et le digest
 * pour que la cause réelle du crash soit visible pendant qu'on debug.
 * À retirer dès que l'erreur initiale sera corrigée.
 */
export default function AdsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
      <h2 className="mb-2 text-base font-semibold">
        /ads a planté (debug temporaire — error boundary)
      </h2>
      <p className="mb-2">
        <strong>Message :</strong> {error.message || "(aucun)"}
      </p>
      {error.digest ? (
        <p className="mb-2">
          <strong>Digest :</strong> {error.digest}
        </p>
      ) : null}
      {error.stack ? (
        <pre className="whitespace-pre-wrap break-words font-mono text-xs">
          {error.stack}
        </pre>
      ) : null}
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
