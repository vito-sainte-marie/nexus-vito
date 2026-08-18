-- FDJ Fiabilisation Étape 5 (18/08/2026) — voir NEXUS-Data-Dictionary-v2.md v2.144
alter table public.fdj_stock_movements
  add column if not exists idempotency_key uuid null;

create unique index if not exists fdj_stock_movements_idempotency_key_uniq
  on public.fdj_stock_movements (idempotency_key)
  where idempotency_key is not null;

create or replace function public.fdj_incrementer_appro_shift_count(
  p_site text,
  p_shift_id uuid,
  p_game_id uuid,
  p_delta numeric
) returns numeric
language plpgsql
security invoker
as $$
declare
  v_nouvel_appro numeric;
begin
  insert into public.fdj_shift_counts (site, shift_id, game_id, appro, updated_at)
  values (p_site, p_shift_id, p_game_id, p_delta, now())
  on conflict (shift_id, game_id) do update
    set appro = coalesce(public.fdj_shift_counts.appro, 0) + excluded.appro,
        updated_at = now()
  returning appro into v_nouvel_appro;
  return v_nouvel_appro;
end;
$$;
