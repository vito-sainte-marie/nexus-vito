-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831102222 · inventaire_mouvements_transfert_integrite
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'inventaire_mouvements_transfert_zones_check'
      and conrelid = 'public.inventaire_mouvements'::regclass
  ) then
    alter table public.inventaire_mouvements
      add constraint inventaire_mouvements_transfert_zones_check
      check (
        type_mouvement <> 'transfert'
        or (
          zone_source_id is not null
          and zone_destination_id is not null
          and zone_source_id <> zone_destination_id
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'inventaire_mouvements_transfert_quantite_check'
      and conrelid = 'public.inventaire_mouvements'::regclass
  ) then
    alter table public.inventaire_mouvements
      add constraint inventaire_mouvements_transfert_quantite_check
      check (type_mouvement <> 'transfert' or quantite > 0);
  end if;
end $$;

comment on constraint inventaire_mouvements_transfert_zones_check on public.inventaire_mouvements is
  'Un transfert interne doit avoir une source et une destination différentes.';
comment on constraint inventaire_mouvements_transfert_quantite_check on public.inventaire_mouvements is
  'Un transfert interne déplace une quantité strictement positive.';
