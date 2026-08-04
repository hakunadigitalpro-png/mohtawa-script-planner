-- =====================================================================
-- 0034 — Rate-limiting des appels IA (protection de la facture Claude/Groq)
--
-- Les Server Actions IA (générer script/story/vlog/autopsie, assistant de
-- thèmes) pouvaient être déclenchées en boucle par un utilisateur connecté →
-- coût / DoS financier. On journalise chaque appel par utilisateur et on
-- refuse au-delà d'une limite glissante.
--
-- Limites : 15 appels / minute ET 150 / heure par utilisateur (larges pour
-- l'usage normal, basses pour stopper un abus). Ajuste les seuils ci-dessous
-- si besoin.
--
-- Idempotent. À exécuter dans le SQL Editor de Supabase.
-- =====================================================================

create table if not exists public.ai_usage_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  action     text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_log_user_time_idx
  on public.ai_usage_log(user_id, created_at);

alter table public.ai_usage_log enable row level security;

-- Un utilisateur ne voit que ses propres lignes (l'écriture passe par la RPC).
drop policy if exists "ai_usage_select_self" on public.ai_usage_log;
create policy "ai_usage_select_self" on public.ai_usage_log
  for select to authenticated
  using (user_id = auth.uid());

-- Compte les appels récents de l'utilisateur courant, refuse si au-dessus de
-- la limite, sinon journalise l'appel. SECURITY DEFINER : écrit dans la table
-- de log sans exposer d'INSERT direct au client.
create or replace function public.check_ai_rate_limit(p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_minute int;
  v_hour   int;
begin
  if v_uid is null then
    raise exception 'ai_not_authenticated';
  end if;

  select count(*) into v_minute
  from public.ai_usage_log
  where user_id = v_uid and created_at > now() - interval '1 minute';

  select count(*) into v_hour
  from public.ai_usage_log
  where user_id = v_uid and created_at > now() - interval '1 hour';

  if v_minute >= 15 or v_hour >= 150 then
    raise exception 'ai_rate_limited';
  end if;

  insert into public.ai_usage_log(user_id, action) values (v_uid, p_action);
end$$;

revoke all on function public.check_ai_rate_limit(text) from public;
grant execute on function public.check_ai_rate_limit(text) to authenticated;
