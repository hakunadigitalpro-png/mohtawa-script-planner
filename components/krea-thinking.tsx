"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * Bulle "Krea réfléchit" affichée pendant une génération IA — remplace un
 * indicateur générique par le visage + la voix de la mascotte-coach. Fait
 * défiler `messages` toutes les ~2.5s pour donner l'impression qu'elle
 * réfléchit vraiment, pas un spinner figé.
 */
export function KreaThinking({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, 2500);
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-accent/20 bg-accent/5 px-6 py-10 text-center">
      <div className="relative flex size-16 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
        <Image
          src="/mascot/krea-avatar.png"
          alt="Krea"
          width={64}
          height={64}
          className="relative size-16 rounded-full border-2 border-card object-cover object-top shadow-sm"
        />
      </div>
      <div className="relative rounded-2xl bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm">
        <span aria-live="polite">{messages[index]}</span>
        <span className="absolute -top-1.5 start-1/2 size-3 -translate-x-1/2 rotate-45 bg-card" />
      </div>
    </div>
  );
}
