-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260830211432 · inventaire_reglages_specifiques_par_champ
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table public.inventaire_regles_produit add column if not exists champs_specifiques text[] not null default '{}'::text[];

create or replace function public.nexus_inventaire_detecter_champs_specifiques()
returns trigger language plpgsql as $$
declare c public.inventaire_categories%rowtype;
begin
  select cat.* into c
  from public.inventaire_zone_produit z
  join public.inventaire_categories cat on cat.id=z.categorie_id
  where z.id=new.produit_id;
  if not found then return new; end if;

  new.champs_specifiques := array_remove(array[
    case when new.profil is distinct from c.profil then 'profil' end,
    case when new.cycle_frequence is distinct from c.cycle_frequence then 'cycle_frequence' end,
    case when new.report_veille_autorise is distinct from c.report_veille_autorise then 'report_veille_autorise' end,
    case when new.duree_max_vente_jours is distinct from c.duree_max_vente_jours then 'duree_max_vente_jours' end,
    case when new.action_echeance is distinct from c.action_echeance then 'action_echeance' end,
    case when new.mode_agregation_ventes is distinct from c.mode_agregation_ventes then 'mode_agregation_ventes' end,
    case when new.validation_manager_requise is distinct from c.validation_manager_requise then 'validation_manager_requise' end,
    case when new.comptage_masque is distinct from c.comptage_masque then 'comptage_masque' end,
    case when new.seuil_minimal is distinct from c.seuil_minimal then 'seuil_minimal' end,
    case when new.controle_aleatoire is distinct from c.controle_aleatoire then 'controle_aleatoire' end,
    case when new.photo_obligatoire is distinct from c.photo_obligatoire then 'photo_obligatoire' end,
    case when new.quarts_comptage is distinct from c.quarts_comptage then 'quarts_comptage' end,
    case when new.reapprovisionnable is distinct from c.reapprovisionnable then 'reapprovisionnable' end,
    case when new.frequence_controle is distinct from c.frequence_controle then 'frequence_controle' end,
    case when new.delai_max_jours_sans_controle is distinct from c.delai_max_jours_sans_controle then 'delai_max_jours_sans_controle' end
  ], null);
  return new;
end $$;

drop trigger if exists trg_inventaire_regles_produit_champs_specifiques on public.inventaire_regles_produit;
create trigger trg_inventaire_regles_produit_champs_specifiques
before insert or update of profil, cycle_frequence, report_veille_autorise, duree_max_vente_jours, action_echeance, mode_agregation_ventes, validation_manager_requise, comptage_masque, seuil_minimal, controle_aleatoire, photo_obligatoire, quarts_comptage, reapprovisionnable, frequence_controle, delai_max_jours_sans_controle
on public.inventaire_regles_produit for each row execute function public.nexus_inventaire_detecter_champs_specifiques();

create or replace function public.nexus_inventaire_propagation_regle_categorie()
returns trigger language plpgsql as $$
begin
  update public.inventaire_regles_produit r set
    profil = case when not ('profil'=any(r.champs_specifiques)) then new.profil else r.profil end,
    cycle_frequence = case when not ('cycle_frequence'=any(r.champs_specifiques)) then new.cycle_frequence else r.cycle_frequence end,
    report_veille_autorise = case when not ('report_veille_autorise'=any(r.champs_specifiques)) then new.report_veille_autorise else r.report_veille_autorise end,
    duree_max_vente_jours = case when not ('duree_max_vente_jours'=any(r.champs_specifiques)) then new.duree_max_vente_jours else r.duree_max_vente_jours end,
    action_echeance = case when not ('action_echeance'=any(r.champs_specifiques)) then new.action_echeance else r.action_echeance end,
    mode_agregation_ventes = case when not ('mode_agregation_ventes'=any(r.champs_specifiques)) then new.mode_agregation_ventes else r.mode_agregation_ventes end,
    validation_manager_requise = case when not ('validation_manager_requise'=any(r.champs_specifiques)) then new.validation_manager_requise else r.validation_manager_requise end,
    comptage_masque = case when not ('comptage_masque'=any(r.champs_specifiques)) then new.comptage_masque else r.comptage_masque end,
    seuil_minimal = case when not ('seuil_minimal'=any(r.champs_specifiques)) then new.seuil_minimal else r.seuil_minimal end,
    controle_aleatoire = case when not ('controle_aleatoire'=any(r.champs_specifiques)) then new.controle_aleatoire else r.controle_aleatoire end,
    photo_obligatoire = case when not ('photo_obligatoire'=any(r.champs_specifiques)) then new.photo_obligatoire else r.photo_obligatoire end,
    quarts_comptage = case when not ('quarts_comptage'=any(r.champs_specifiques)) then new.quarts_comptage else r.quarts_comptage end,
    reapprovisionnable = case when not ('reapprovisionnable'=any(r.champs_specifiques)) then new.reapprovisionnable else r.reapprovisionnable end,
    frequence_controle = case when not ('frequence_controle'=any(r.champs_specifiques)) then new.frequence_controle else r.frequence_controle end,
    delai_max_jours_sans_controle = case when not ('delai_max_jours_sans_controle'=any(r.champs_specifiques)) then new.delai_max_jours_sans_controle else r.delai_max_jours_sans_controle end,
    updated_at = now()
  from public.inventaire_zone_produit z
  where r.produit_id=z.id and z.categorie_id=new.id;
  return new;
end $$;

drop trigger if exists trg_inventaire_categories_propagation_regles on public.inventaire_categories;
create trigger trg_inventaire_categories_propagation_regles
after update of profil, cycle_frequence, report_veille_autorise, duree_max_vente_jours, action_echeance, mode_agregation_ventes, validation_manager_requise, comptage_masque, seuil_minimal, controle_aleatoire, photo_obligatoire, quarts_comptage, reapprovisionnable, frequence_controle, delai_max_jours_sans_controle
on public.inventaire_categories for each row execute function public.nexus_inventaire_propagation_regle_categorie();
