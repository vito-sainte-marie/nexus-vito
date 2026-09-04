-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260824131251 · split_validation_piste_boutique_audits_caisse
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- v2.234 — validation indépendante Piste / Boutique (demande de Frédéric,
-- amélioration UX Historique Verify : statut global "X/Y caisses validées").
-- Jusqu'ici, audits_caisse.valide_le/valide_par/commentaire_validation
-- étaient un SEUL évènement de validation couvrant Piste ET Boutique en même
-- temps (un seul clic "Confirmer la validation" pour les deux). Ce lot rend
-- la validation indépendante par caisse, tout en conservant les anciennes
-- colonnes intactes et à jour (elles restent la vérité pour
-- nexus-progression.js/"Mes Caisses", qui gate provisoire/définitif sur
-- valide_le — Article 11, ne rien casser côté employé).

alter table audits_caisse
  add column if not exists valide_le_piste timestamptz null,
  add column if not exists premiere_validation_le_piste timestamptz null,
  add column if not exists valide_par_piste uuid null,
  add column if not exists commentaire_validation_piste text null,
  add column if not exists valide_le_boutique timestamptz null,
  add column if not exists premiere_validation_le_boutique timestamptz null,
  add column if not exists valide_par_boutique uuid null,
  add column if not exists commentaire_validation_boutique text null;

comment on column audits_caisse.valide_le_piste is 'v2.234 — horodatage de la DERNIÈRE validation manager de la caisse Piste (validation initiale ou correction ultérieure). NULL tant que Piste n''a jamais été validée.';
comment on column audits_caisse.premiere_validation_le_piste is 'v2.234 — horodatage de la TOUTE PREMIÈRE validation de la caisse Piste, immuable une fois posé. Si valide_le_piste diffère de cette valeur, la validation a été corrigée depuis (badge Historique "Validé puis ajusté").';
comment on column audits_caisse.valide_par_piste is 'v2.234 — auteur (employees.id) de la DERNIÈRE validation/correction de la caisse Piste.';
comment on column audits_caisse.commentaire_validation_piste is 'v2.234 — commentaire de la DERNIÈRE validation/correction de la caisse Piste.';
comment on column audits_caisse.valide_le_boutique is 'v2.234 — équivalent de valide_le_piste pour la caisse Boutique.';
comment on column audits_caisse.premiere_validation_le_boutique is 'v2.234 — équivalent de premiere_validation_le_piste pour la caisse Boutique.';
comment on column audits_caisse.valide_par_boutique is 'v2.234 — équivalent de valide_par_piste pour la caisse Boutique.';
comment on column audits_caisse.commentaire_validation_boutique is 'v2.234 — équivalent de commentaire_validation_piste pour la caisse Boutique.';

-- Backfill : les audits déjà validés avant ce lot ont été validés
-- ATOMIQUEMENT (un seul clic pour les deux caisses) — on répartit fidèlement
-- ce même évènement réel (même instant, même auteur, même commentaire) sur
-- les deux nouvelles paires de colonnes. Rien n'est inventé : c'est
-- factuellement ce qui s'est passé (Article 5).
update audits_caisse
set valide_le_piste = valide_le, premiere_validation_le_piste = valide_le, valide_par_piste = valide_par, commentaire_validation_piste = commentaire_validation,
    valide_le_boutique = valide_le, premiere_validation_le_boutique = valide_le, valide_par_boutique = valide_par, commentaire_validation_boutique = commentaire_validation
where valide_le is not null;
