-- Migration 0061 — Notifications push vers le téléphone (Web Push).
--
-- Un abonnement par (utilisateur × appareil × navigateur) : chaque fois
-- qu'on autorise les notifications dans Chrome Android et dans la PWA
-- iPhone ajoutée à l'écran d'accueil, le navigateur donne une URL
-- d'endpoint différente, à conserver pour pouvoir y envoyer un push.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Chacun gère ses propres appareils, c'est tout. L'envoi côté serveur
-- passe par la service role key, qui ignore ces policies.
drop policy if exists "own subs select" on public.push_subscriptions;
create policy "own subs select"
  on public.push_subscriptions for select
  using (user_id = auth.uid());

drop policy if exists "own subs insert" on public.push_subscriptions;
create policy "own subs insert"
  on public.push_subscriptions for insert
  with check (user_id = auth.uid());

drop policy if exists "own subs delete" on public.push_subscriptions;
create policy "own subs delete"
  on public.push_subscriptions for delete
  using (user_id = auth.uid());
