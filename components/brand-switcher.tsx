"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Check,
  Plus,
  Building2,
  Settings2,
  ChevronsUpDown,
} from "lucide-react";
import { switchBrand, createBrand } from "@/app/(app)/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownLabel,
} from "@/components/ui/dropdown";
import type { Brand } from "@/lib/types";
import type { BrandRole } from "@/lib/brand";
import { BRAND_NAME_MAX } from "@/lib/constants";

export function BrandSwitcher({
  brands,
  active,
  role,
  variant = "rail",
}: {
  brands: Brand[];
  active: Brand | null;
  /** Un `viewer` est renvoyé au Calendrier depuis `/brands/[id]`. */
  role?: BrandRole | null;
  /**
   * `rail` : la pastille ronde du menu replie. `wide` : une ligne pleine
   * largeur, avec le nom de la marque lisible — dans un menu qui montre ses
   * libelles, une initiale muette serait la seule chose a deviner.
   */
  variant?: "rail" | "wide";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("brands");
  const tCommon = useTranslations("common");
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const initial = (active?.name ?? "?").slice(0, 1).toUpperCase();
  const noBrand = t("noBrandLabel");

  /**
   * Où atterrir après avoir changé de marque.
   *  - page d'une marque → la MÊME page, mais celle de la nouvelle marque ;
   *  - fiche d'un contenu → il appartient à l'ancienne marque, donc dashboard ;
   *  - reste de l'app (dashboard, calendrier, analytics…) → on ne bouge pas,
   *    la page se recharge simplement avec les données de la nouvelle marque.
   */
  const destinationFor = (brandId: string) => {
    if (pathname.startsWith("/brands/")) return `/brands/${brandId}`;
    if (pathname.startsWith("/content/")) return "/dashboard";
    return null;
  };

  return (
    <>
      <Dropdown
        align="start"
        // En ligne pleine largeur, le conteneur doit l'etre aussi : sinon un
        // nom long elargit la ligne au-dela du menu au lieu de se tronquer.
        className={variant === "wide" ? "block w-full" : undefined}
      >
        <DropdownTrigger asChild>
          {variant === "wide" ? (
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-card/60 px-2.5 py-2 text-start transition hover:bg-card"
              aria-label={t("switchLabel", { name: active?.name ?? noBrand })}
              // Un nom déjà trop long se coupe ; le survol le donne en entier.
              title={active?.name}
            >
              <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary text-xs font-bold text-foreground">
                {active?.logo_url ? (
                  <Image
                    src={active.logo_url}
                    alt=""
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                ) : (
                  <span>{initial}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {active?.name ?? noBrand}
                </span>
                <span className="block text-xs text-muted">
                  {t("switchBrandSubtitle")}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted" />
            </button>
          ) : (
          <button
            type="button"
            className="tooltip-trigger relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card text-sm font-bold text-foreground shadow-sm transition hover:scale-105"
            aria-label={t("switchLabel", { name: active?.name ?? noBrand })}
          >
            {/* Le logo remplace l'initiale dès qu'il existe. */}
            {active?.logo_url ? (
              <Image
                src={active.logo_url}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <span>{initial}</span>
            )}
            <span className="tooltip-content">{active?.name ?? noBrand}</span>
          </button>
          )}
        </DropdownTrigger>
        <DropdownContent align="start" className="min-w-56">
          <DropdownLabel>{t("myBrands")}</DropdownLabel>
          {brands.length === 0 && (
            <div className="px-4 py-2 text-sm text-muted">{t("noBrandFound")}</div>
          )}
          {brands.map((b) => (
            <DropdownItem
              key={b.id}
              onClick={() => {
                startTransition(async () => {
                  await switchBrand(b.id);
                  const dest = destinationFor(b.id);
                  if (dest) router.push(dest);
                  else router.refresh();
                });
              }}
            >
              <Building2 className="size-4 text-muted" />
              <span className="flex-1 truncate" title={b.name}>
                {b.name}
              </span>
              {active?.id === b.id && <Check className="size-4" />}
            </DropdownItem>
          ))}
          <DropdownSeparator />
          {/* Pas pour un client invité : `/brands/[id]` le renverrait
              aussitôt au Calendrier — un lien qui ne mène nulle part. */}
          {active && role !== "viewer" && (
            <>
              {/* Ouvrir la marque se faisait en deux temps — aller dans
                  « Mes marques », puis cliquer la bonne. Or c'est ici qu'on
                  pense à elle. */}
              <DropdownItem
                onClick={() => {
                  startTransition(() => {
                    router.push(`/brands/${active.id}`);
                  });
                }}
              >
                <Settings2 className="size-4 text-muted" />
                <span className="flex-1 truncate">{t("openBrand")}</span>
              </DropdownItem>
            </>
          )}
          <DropdownItem onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("newBrand")}
          </DropdownItem>
        </DropdownContent>
      </Dropdown>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("createBrandTitle")}</DialogTitle>
          </DialogHeader>
          <form
            action={(fd) =>
              startTransition(async () => {
                const res = await createBrand(fd);
                if (res?.error) setError(res.error);
                else setCreateOpen(false);
              })
            }
          >
            <DialogBody className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brand-name">{t("brandNameLabel")}</Label>
                <Input
                  id="brand-name"
                  name="name"
                  required
                  autoFocus
                  maxLength={BRAND_NAME_MAX}
                  placeholder={t("brandNamePlaceholder")}
                />
                {/* Dit AVANT que le champ ne bloque : un `maxLength` seul
                    arrête la frappe sans un mot. */}
                <p className="text-xs text-muted">
                  Juste le nom, {BRAND_NAME_MAX} caractères au plus. Ce que tu
                  fais et pour qui a sa place dans ta stratégie de contenu.
                </p>
              </div>
              {error && (
                <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "..." : tCommon("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
