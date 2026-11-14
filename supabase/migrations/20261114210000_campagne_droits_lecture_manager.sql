-- Campagne V2, correctif C1 de Guardian (commentaire 6883112254 sur #160) : droits de lecture des tables de promotion.
-- Défaut corrigé : la politique `lecture_meme_site` filtrait sur `site` seul, donc tout employé du site (caissier compris)
-- lisait prix d'achat, remises, coûts, stocks de départ et ventes de promotion. La lecture passe aux rôles manager et gerant
-- du même site (le créateur garde `createur_lit_si_autorise`, conditionnée par `sites.acces_createur_autorise`).
-- Les contrôles d'appartenance manquants sont ajoutés aux écritures : `campagne_id` doit appartenir au site de la ligne,
-- `batch_id` aussi pour les annulations de ventes.
-- Migration nouvelle : aucune migration précédente n'est modifiée. Les tables absentes d'un environnement sont ignorées
-- (to_regclass), ce qui permet de la jouer avant ou après la migration des livraisons.

do $$
declare
  t text;
  lecture text[] := array[
    'campagne_livraisons','campagne_livraisons_annulations','campagne_livraison_lignes','campagne_conditionnement_achat',
    'campagne_stock_depart','campagne_objectifs_produits','campagne_mesures_produits','campagne_couts',
    'fournisseurs_conditions','campagne_ventes_points','campagne_ventes_annulations'];
  avec_campagne text[] := array['campagne_livraisons','campagne_stock_depart','campagne_objectifs_produits','campagne_mesures_produits','campagne_couts','campagne_ventes_points'];
  insertion text[] := array['campagne_livraisons','campagne_stock_depart','campagne_objectifs_produits','campagne_ventes_points','campagne_ventes_annulations','campagne_conditionnement_achat'];
  ecriture text[] := array['campagne_mesures_produits','campagne_couts','fournisseurs_conditions'];
  manager text := 'site = current_employee_site_id() and current_employee_role() in (''manager'',''gerant'')';
  controle text;
begin
  -- Lecture : manager et gerant du même site seulement.
  foreach t in array lecture loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists lecture_meme_site on %I', t);
    execute format('drop policy if exists lecture_manager_meme_site on %I', t);
    execute format('create policy lecture_manager_meme_site on %I for select using (%s)', t, manager);
  end loop;

  -- Insertions : même rôle, plus l'appartenance de la campagne, de l'import ou de la livraison au site.
  foreach t in array insertion loop
    if to_regclass('public.' || t) is null then continue; end if;
    controle := case
      when t = any (avec_campagne) then format(' and exists (select 1 from campagnes_nexus c where c.id = %I.campagne_id and c.site = %I.site)', t, t)
      when t = 'campagne_ventes_annulations' then ' and exists (select 1 from import_batches b where b.id = campagne_ventes_annulations.batch_id and b.site = campagne_ventes_annulations.site)'
      else '' end;
    execute format('drop policy if exists insertion_manager_meme_site on %I', t);
    execute format('create policy insertion_manager_meme_site on %I for insert with check (%s%s)', t, manager, controle);
  end loop;

  -- Écriture complète (réglages) : même contrôle d'appartenance quand la table porte une campagne.
  foreach t in array ecriture loop
    if to_regclass('public.' || t) is null then continue; end if;
    controle := case when t = any (avec_campagne)
      then format(' and exists (select 1 from campagnes_nexus c where c.id = %I.campagne_id and c.site = %I.site)', t, t) else '' end;
    execute format('drop policy if exists ecriture_manager_meme_site on %I', t);
    execute format('create policy ecriture_manager_meme_site on %I for all using (%s) with check (%s%s)', t, manager, manager, controle);
  end loop;

  -- Lignes et annulations de livraison : la livraison visée doit être du même site (contrôle conservé).
  foreach t in array array['campagne_livraison_lignes','campagne_livraisons_annulations'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists insertion_manager_meme_site on %I', t);
    execute format('create policy insertion_manager_meme_site on %I for insert with check (%s and exists (select 1 from campagne_livraisons l where l.id = %I.livraison_id and l.site = %I.site))', t, manager, t, t);
  end loop;
end $$;

-- Source du stock de départ : les deux valeurs de la migration des livraisons, plus le relevé théorique Decenium et le comptage.
do $$
begin
  if to_regclass('public.campagne_stock_depart') is not null then
    alter table campagne_stock_depart drop constraint if exists campagne_stock_depart_source_check;
    alter table campagne_stock_depart add constraint campagne_stock_depart_source_check
      check (source in ('inventaire','saisie_initiale','releve_theorique_decenium','comptage'));
  end if;
end $$;
