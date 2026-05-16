# ADR — PDF Export via Print CSS du navigateur

- **Date** : 2026-05-15
- **Statut** : ✅ Accepted

## Contexte

Les utilisateurs doivent pouvoir exporter une fiche vidéo complète en PDF :
- Pour partager avec un client (alternative au lien de partage)
- Pour archiver
- Pour imprimer en réunion

Quelle approche technique ?

## Options envisagées

### A. Puppeteer (server-side headless Chrome)
- ➕ Rendu parfait (le même que le navigateur)
- ➕ Layout HTML/CSS standard
- ➖ **Très lourd à déployer sur Vercel** : Chromium = 100+ MB, dépasse les limites serverless
- ➖ Coût en cold start (~3-5s)
- ➖ Solutions tierces (Browserless) à $50-100/mois pour du volume

### B. `react-pdf` / `@react-pdf/renderer`
- ➕ Génère un PDF côté server depuis des composants React custom
- ➖ Syntaxe **différente** de React standard (`<View>`, `<Text>`, pas de Tailwind)
- ➖ Doubler le code de chaque page (une version "web", une version "pdf")
- ➖ Layout/CSS limités

### C. `jsPDF` côté client
- ➕ Léger (~150 KB)
- ➕ Server-side optionnel
- ➖ API impérative et galère (calcul de positions à la main)
- ➖ Pas de support natif pour HTML complexe

### D. `html2canvas` + `jsPDF`
- ➕ Capture du DOM en image puis PDF
- ➖ **Très mauvaise qualité** (texte = pixels, pas sélectionnable)
- ➖ Multi-pages mal géré
- ➖ Polices custom non garanties

### E. Print CSS du navigateur (`window.print()`)
- ➕ **Aucune dépendance**
- ➕ Le navigateur gère tout (multi-pages, fonts, contraste)
- ➕ L'utilisateur peut choisir "Enregistrer en PDF" dans la boîte de dialogue natif
- ➕ CSS standard avec `@media print` pour adapter le layout
- ➕ Texte sélectionnable, qualité parfaite
- ➖ Le user voit la boîte de dialogue d'impression du navigateur (UX moins fluide qu'un download direct)
- ➖ Le format/marges dépend des préférences du user (mais on peut suggérer via `@page`)

## Décision

**Print CSS du navigateur**, option E.

L'expérience est légèrement moins "click-and-done" qu'un download direct, mais elle est :
- Gratuite (0 dépendance, 0 service externe)
- Robuste (le navigateur fait son boulot)
- Maintenable (juste du HTML+CSS)
- Cross-platform (marche partout où il y a un navigateur)

Pour un SaaS solo, **éviter Puppeteer et les services tiers = des heures économisées sur l'infra et le debugging**.

## Implémentation

### Route dédiée

`app/print/[id]/page.tsx` rend la fiche en layout imprimable. **Hors du route group `(app)`** → pas de sidebar.

### CSS dédié

`app/print/[id]/print.css` :
- Layout 800px max, padding généreux
- Header sobre + sections (Plan / Script / Storyboard / Performances)
- Storyboard en grille 2 colonnes (16:9 par scène)
- Stories en row de 5 cartes phone (9:16)
- `page-break-inside: avoid` sur chaque card pour éviter les coupes

```css
@media print {
  body { background: #fff; }
  .no-print { display: none !important; }
  .print-page { padding: 0; max-width: none; }
  .print-section { page-break-inside: avoid; }
}
```

### Trigger

`<PrintActions>` (client) :
```tsx
<button onClick={() => window.print()}>
  Imprimer / Enregistrer en PDF
</button>
```

## Workflow utilisateur

1. Sur `/content/[id]` → clic "Exporter PDF"
2. Ouverture de `/print/[id]` dans un nouvel onglet
3. Clic "Imprimer / Enregistrer en PDF"
4. Boîte de dialogue navigateur → destination "Enregistrer en PDF"
5. Le PDF est généré localement par le navigateur

## Conséquences

### Positives
- 0 dépendance ajoutée
- 0 coût d'infra (pas de Puppeteer, pas de service)
- Maintenance trivial : c'est du HTML + CSS
- L'utilisateur a le contrôle sur la mise en page (marges, format)

### Négatives
- 1 clic en plus pour l'utilisateur (la modal print)
- Pas de "download direct" (mais le user comprend vite)
- Le rendu peut légèrement varier selon le navigateur (Chrome / Firefox / Safari)

## Use cases couverts

✅ Reel complet (plan + script + storyboard avec images + perf)
✅ Story complète (plan + 5 stories phone-frame + perf)
✅ Multi-pages automatique (le navigateur gère les sauts)
✅ Images en haute résolution (le navigateur retient l'original)

## Évolutions possibles

Si on a besoin d'un vrai download server-side dans le futur (ex: "envoyer le PDF par email automatique") :
- Migrer vers une Edge Function Supabase qui appelle un service Puppeteer hosted
- Ou utiliser `@vercel/og` pour des "images PDFables" simples (factures, certificats...)

## Liens

- [07-sharing-public-pages.md](../07-sharing-public-pages.md) — section Print
- `app/print/[id]/print.css`
