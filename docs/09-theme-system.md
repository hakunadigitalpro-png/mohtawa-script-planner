# Spec 09 — Theme system

## Vue d'ensemble

3 modes : **Light**, **Dark**, **Custom**. Lus en SSR depuis des cookies → pas de flash au chargement (FOUC).

## Modes

### Light (défaut)

- Surface : crème warm `#FFFAF4`
- Background : `#FDF6EF` + gradient radial 3-stops (pêche / lavande / blush)
- Foreground : `#0A0612` (presque-noir)
- Accent : `#FF6B35` (orange saturé)

### Dark

- Surface : `#1A1424` (deep tinted)
- Background : `#0E0814` + gradient radial moodier (faible opacité, orange + lavande)
- Foreground : `#F8EEE5` (crème)
- Accent : `#FF6B35` conservé pour cohérence brand

### Custom

- Garde le scheme Light (background base + cards crème)
- Override les variables `--color-accent`, `--color-reel`, `--color-ring`, `--color-background` via `style` inline sur `<html>`
- L'user choisit son **accent** + sa **teinte de fond**

## Implémentation

### Tokens CSS (`globals.css`)

```css
@theme {
  --color-background: #fdf6ef;
  --color-card: #fffaf4;
  --color-accent: #ff6b35;
  /* etc. */
}

html[data-theme="dark"] {
  --color-background: #0e0814;
  --color-card: #1a1424;
  /* override */
}
```

### Cookies

3 cookies (durée 1 an chacun, `sameSite: 'lax'`, path `/`) :

| Cookie | Valeur possible | Défaut |
|---|---|---|
| `mohtawa_theme` | `light` \| `dark` \| `custom` | `light` |
| `mohtawa_accent` | HEX color `#rrggbb` | `#ff6b35` |
| `mohtawa_tint` | HEX color `#rrggbb` | `#fdf6ef` |

Helpers dans `lib/theme.ts` :

```ts
getThemeFromCookies() → { theme, accent, tint }   // lit côté server
sanitizeHex(value, fallback) → string             // validation HEX
isTheme(value) → boolean                          // type guard
dirOf(theme) → 'ltr' | 'rtl'                      // future i18n
htmlDataTheme(theme) → 'light' | 'dark'           // pour data-theme attr
```

### Lecture en SSR

`app/layout.tsx` :

```tsx
const { theme, accent, tint } = await getThemeFromCookies();
const dataTheme = htmlDataTheme(theme);  // 'light' ou 'dark'

const styleOverrides: React.CSSProperties = {};
if (theme === 'custom') {
  (styleOverrides as Record<string, string>)['--color-accent'] = accent;
  (styleOverrides as Record<string, string>)['--color-reel'] = accent;
  (styleOverrides as Record<string, string>)['--color-ring'] = accent;
  (styleOverrides as Record<string, string>)['--color-background'] = tint;
}

return (
  <html lang="fr" data-theme={dataTheme} style={styleOverrides}>
    <body>{children}</body>
  </html>
);
```

→ Le `<html>` arrive au navigateur avec le **bon** `data-theme` + style inline. **Aucun flash**.

### Mise à jour côté client

`<ThemeSwitcher>` dans `/profile` :
- Sélection d'un mode → server action `updateTheme({ theme, accent, tint })`
- Server action set les 3 cookies + `revalidatePath('/', 'layout')`
- `router.refresh()` recharge avec les nouvelles vars

```tsx
<ThemeSwitcher initialTheme={...} initialAccent={...} initialTint={...} />
```

### UI

#### Sélecteur de mode
3 cartes (Sun, Moon, Palette) avec checkmark sur le mode actif.

#### Palette accent
- 8 presets : orange / rouge / ambre / émeraude / cyan / bleu / violet / rose
- + chip "Palette" (dashed) qui ouvre un `<input type="color">` natif pour choisir librement

#### Palette tint
- 6 presets : warm cream / lavender mist / mint / ice / rose / neutral
- + chip "Palette" libre
- Caché en mode Dark (la teinte n'est pas overridable en dark)

#### Reset
Bouton "Réinitialiser par défaut" → repasse en Light + accent orange + tint crème.

## Persistence inter-devices

Actuellement : cookies uniquement → propre à un device + un navigateur.

**Évolution prévue** : sauver aussi sur `auth.users.user_metadata.theme` pour sync entre devices. Au login, copier le metadata dans les cookies.

## Limitations actuelles

1. **Custom mode n'override pas le background-image** (le gradient warm reste pêche/lavande même en custom). Si on veut un vrai custom (ex: gradient bleu), il faut désactiver les 3 radial-gradients et juste mettre `background-color: var(--color-background)`. Voir si on veut ce niveau de customisation.
2. **Dark mode ne propose pas de variantes** (pas de "Dark Lavender" ou "Dark Blue"). C'est un seul preset.
3. **Pas de "auto" mode** (suivre les préférences système `prefers-color-scheme`). Possible à ajouter en lisant `media query` côté client et en écrivant le cookie au mount.

## Tests à faire

Quand on modifie le theme system :
- [ ] Vérifier qu'un user qui charge `/dashboard` pour la première fois voit Light + orange par défaut
- [ ] Passer en Dark → tout est lisible (contraste suffisant)
- [ ] Passer en Custom + accent violet → tous les boutons "primaires" et l'icône active sidebar deviennent violet
- [ ] Custom + tint lavender → fond légèrement violet
- [ ] Reset → revient au défaut
- [ ] Recharger après chaque changement → pas de flash visible

## Évolutions possibles

- [ ] Synced sur `user_metadata` pour persistence cross-device
- [ ] Mode "Auto" suivant `prefers-color-scheme`
- [ ] Plusieurs presets dark (deep blue, charcoal, etc.)
- [ ] Custom font (choisir entre Plus Jakarta Sans, Inter, system, etc.)
- [ ] Custom radius (carré / arrondi / very-arrondi)
- [ ] Export/import du theme (JSON pour partage entre marques)
