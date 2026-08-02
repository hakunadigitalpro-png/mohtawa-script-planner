import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

export default function RegisterPage() {
  return (
    <Suspense>
      <AuthShell defaultMode="signup" />
    </Suspense>
  );
}
