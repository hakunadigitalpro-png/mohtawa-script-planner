import { HooksLibrary } from "@/components/hooks-library";

export default function HooksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bibliothèque d&apos;accroches
        </h1>
        <p className="text-sm text-muted">
          Inspire-toi des formats qui marchent. Une accroche bien choisie = un scroll
          arrêté.
        </p>
      </div>

      <HooksLibrary />
    </div>
  );
}
