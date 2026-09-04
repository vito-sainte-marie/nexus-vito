-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803021323 · alertes_immediates_independantes_frequence
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


-- ============================================================
-- NEXUS Inventaire — Alertes immédiates indépendantes de la fréquence
-- de supervision (02/08/2026, section 7 du cahier des charges).
-- Ces déclencheurs vivent en base (triggers), pas dans l'écran manager :
-- ils s'exécutent au moment même de l'événement, quel que soit le rythme
-- de contrôle choisi (quotidien, hebdo, mensuel ou exception).
-- ============================================================

-- 1) Réassort / livraison déclaré sans justification.
create or replace function public.flag_mouvement_non_justifie()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type_mouvement in ('reassort', 'livraison') and (new.justification is null or btrim(new.justification) = '') then
    insert into public.inventaire_alertes (site, quart_id, produit_id, type_alerte, gravite, valeur_constatee)
    values (new.site, new.quart_id, new.produit_id, 'reassort_non_justifie', 'attention', new.quantite);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_flag_mouvement_non_justifie on public.inventaire_mouvements;
create trigger trg_flag_mouvement_non_justifie
after insert on public.inventaire_mouvements
for each row execute function public.flag_mouvement_non_justifie();

-- 2) Recomptage de clôture après une clôture déjà validée (possible
-- uniquement depuis l'ajout de "Rouvrir la clôture" — inventaire_comptages
-- est en ajout seul, jamais de mise à jour, donc une deuxième ligne
-- 'cloture' pour le même produit/quart signifie forcément un recomptage
-- après réouverture).
create or replace function public.flag_modification_apres_validation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_precedents int;
begin
  if new.type_comptage = 'cloture' then
    select count(*) into v_precedents from public.inventaire_comptages
    where quart_id = new.quart_id and produit_id = new.produit_id and type_comptage = 'cloture' and id <> new.id;
    if v_precedents > 0 then
      insert into public.inventaire_alertes (site, quart_id, produit_id, type_alerte, gravite, valeur_constatee)
      values (new.site, new.quart_id, new.produit_id, 'modification_apres_validation', 'attention', new.quantite);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_flag_modification_apres_validation on public.inventaire_comptages;
create trigger trg_flag_modification_apres_validation
after insert on public.inventaire_comptages
for each row execute function public.flag_modification_apres_validation();
