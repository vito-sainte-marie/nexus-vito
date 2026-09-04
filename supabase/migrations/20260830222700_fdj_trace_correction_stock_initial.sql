-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260830222700 · fdj_trace_correction_stock_initial
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create or replace function public.fdj_tracer_correction_stock_initial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.stock_initial is distinct from new.stock_initial then
    insert into public.fdj_audit_log (
      site, shift_id, entite_type, entite_id, action,
      ancienne_valeur, nouvelle_valeur, acteur_id, motif, metadata
    ) values (
      new.site,
      new.shift_id,
      'fdj_shift_counts',
      new.id,
      'correction_stock_initial',
      jsonb_build_object('stock_initial', old.stock_initial),
      jsonb_build_object('stock_initial', new.stock_initial),
      auth.uid(),
      'Correction du stock de départ avant clôture',
      jsonb_build_object('game_id', new.game_id, 'source', 'fdj_shift_counts_trigger')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fdj_trace_correction_stock_initial on public.fdj_shift_counts;
create trigger trg_fdj_trace_correction_stock_initial
after update of stock_initial on public.fdj_shift_counts
for each row
when (old.stock_initial is distinct from new.stock_initial)
execute function public.fdj_tracer_correction_stock_initial();
