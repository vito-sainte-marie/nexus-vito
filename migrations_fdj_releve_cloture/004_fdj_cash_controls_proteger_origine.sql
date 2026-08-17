-- Migration : fdj_cash_controls_proteger_origine (16/08/2026)
-- Sécurisation structurelle demandée par Frédéric, point 3 : "Garantir
-- côté base/RPC que `caisse_reelle_origine` et `ecart_origine` ne puissent
-- jamais être réécrits après leur première valeur."
--
-- Jusqu'ici (v2.108), cette garantie n'était qu'un contrat de discipline
-- applicative : NEXUS-FDJ-v1.html::validerQuart pose ces deux colonnes une
-- seule fois (upsert initial), et NEXUS-FDJ-Manager-v1.html::enregistrerEdition
-- les omet volontairement de son propre upsert. Rien n'empêchait pour
-- autant un bug futur, un correctif de données en base, ou une nouvelle
-- fonctionnalité d'écraser ces colonnes par erreur. Ce trigger déplace la
-- garantie au niveau de la base : toute tentative de modifier une valeur
-- déjà posée (non nulle) échoue explicitement, quelle que soit la requête
-- SQL/PostgREST qui l'émet.

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

-- Note : un upsert (INSERT ... ON CONFLICT DO UPDATE) exécute la branche
-- UPDATE lorsque la ligne existe déjà — ce trigger s'applique donc aussi
-- au chemin utilisé par validerQuart()/enregistrerEdition(), pas seulement
-- à un UPDATE explicite. La toute première écriture (ligne inexistante,
-- OLD absent) n'est jamais bloquée : seule une valeur déjà non nulle
-- devient protégée.
