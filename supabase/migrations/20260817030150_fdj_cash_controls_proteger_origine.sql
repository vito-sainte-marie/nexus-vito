-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260817030150 · fdj_cash_controls_proteger_origine
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create or replace function fdj_cash_controls_proteger_origine()
returns trigger
language plpgsql
as $$
begin
  if OLD.caisse_reelle_origine is not null
     and NEW.caisse_reelle_origine is distinct from OLD.caisse_reelle_origine then
    raise exception 'fdj_cash_controls.caisse_reelle_origine est immuable une fois posé (constat d''origine, jamais réécrit).';
  end if;
  if OLD.ecart_origine is not null
     and NEW.ecart_origine is distinct from OLD.ecart_origine then
    raise exception 'fdj_cash_controls.ecart_origine est immuable une fois posé (constat d''origine, jamais réécrit).';
  end if;
  return NEW;
end;
$$;

drop trigger if exists fdj_cash_controls_proteger_origine_trg on fdj_cash_controls;
create trigger fdj_cash_controls_proteger_origine_trg
  before update on fdj_cash_controls
  for each row
  execute function fdj_cash_controls_proteger_origine();
