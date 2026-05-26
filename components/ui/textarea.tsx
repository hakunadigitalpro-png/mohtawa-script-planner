import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      // Placeholders rendus en italique + couleur très claire pour qu'on
      // ne les confonde JAMAIS avec du contenu réel (UX fix après revue
      // Mariam : "on a l'impression que c'est rempli").
      "flex min-h-[96px] w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm placeholder:italic placeholder:text-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
