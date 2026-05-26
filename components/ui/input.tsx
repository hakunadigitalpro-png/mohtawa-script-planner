import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      // Placeholders en italique + couleur très claire pour ne JAMAIS être
      // confondus avec du contenu réel (UX fix après revue Mariam).
      "flex h-11 w-full rounded-full border border-input bg-card px-4 text-sm placeholder:italic placeholder:text-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
