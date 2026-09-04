-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260830103732 · inventaire_cycle_observation_alertes
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Inventaire V2 — Cycle "NEXUS observe avant de conclure" (30/08/2026,
-- demande explicite de Frédéric, point 14 de son audit du 30/08/2026) :
-- "premier écart -> Sous observation -> contrôle aveugle suivant ->
-- deuxième observation -> disparition = imprécision de comptage /
-- persistance = Contrôle manager requis -> certification manager ->
-- séparation erreur de comptage / écart stock -> traitement -> vérification
-- de la régularisation."
--
-- Article 11 (une seule vérité) : réutilise inventaire_alertes telle
-- quelle (déjà le mécanisme réel en production — 432 alertes 'ecart_ouverture'
-- ouvertes, vérifié le 30/08/2026), jamais une nouvelle table. N'ajoute que
-- ce qui manque structurellement à la table existante pour porter le cycle :
--   - observations_consecutives : combien de comptages consécutifs ont
--     reconfirmé cet écart sans qu'il disparaisse entre-temps (1 =
--     première observation = "Sous observation" ; >= 2 = persistance).
--   - nature_confirmee : la décision de certification du manager (ou
--     automatique en cas de disparition) — jamais mélangée avec
--     categorie_anomalie qui, elle, qualifie déjà la SOURCE de l'anomalie
--     (saisie/continuite/mouvement/rapprochement), pas son verdict final.
--   - regularisation_requise / regularisation_verifiee_le : ferment la
--     boucle "traitement -> vérification de la régularisation" sans
--     dupliquer inventaire_mouvements/inventaire_corrections (Article 11) —
--     seulement un pointeur temporel confirmant qu'une action corrective
--     réelle a bien été faite.
--
-- Élargit le CHECK sur statut : n'ajoute 'sous_observation' et
-- 'controle_manager_requis' QU'AUX 5 valeurs déjà autorisées — jamais un
-- remplacement. Les 432 alertes 'ecart_ouverture' déjà ouvertes en
-- production restent en statut 'ouverte' (Article 5 : leur véritable
-- historique d'observations n'est pas reconstituable avec certitude,
-- aucune migration rétroactive de données réelles) ; seules les alertes
-- créées après ce lot utilisent le nouveau cycle.

alter table public.inventaire_alertes
  add column observations_consecutives integer not null default 1,
  add column nature_confirmee text null,
  add column regularisation_requise boolean not null default false,
  add column regularisation_verifiee_le timestamptz null;

alter table public.inventaire_alertes
  add constraint inventaire_alertes_nature_confirmee_check
  check (nature_confirmee is null or nature_confirmee = any (array['erreur_comptage'::text, 'ecart_stock_reel'::text]));

alter table public.inventaire_alertes drop constraint inventaire_alertes_statut_check;
alter table public.inventaire_alertes
  add constraint inventaire_alertes_statut_check
  check (statut = any (array[
    'ouverte'::text, 'en_cours'::text, 'resolue'::text, 'ignoree'::text, 'archivee'::text,
    'sous_observation'::text, 'controle_manager_requis'::text
  ]));
