import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

export default function LoginPage() {
  return (
    <Suspense>
      <AuthShell defaultMode="signin" />
    </Suspense>
  );
}
