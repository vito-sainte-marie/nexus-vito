-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803152742 · audits_caisse_validation_mes_caisses
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- "Mes Caisses" (03/08/2026, demande de Frédéric) : distinguer un écart
-- provisoire (calculé automatiquement à l'enregistrement, avant tout
-- contrôle manager) d'un écart validé (revu et confirmé par un manager).
-- Ces deux notions ne doivent JAMAIS être confondues côté employé — d'où
-- des colonnes séparées plutôt qu'un simple statut sur les colonnes
-- existantes ecart_piste/ecart_boutique.
alter table audits_caisse
  add column if not exists valide_le timestamptz,
  add column if not exists valide_par uuid references employees(id),
  add column if not exists ecart_piste_valide numeric,
  add column if not exists ecart_boutique_valide numeric,
  add column if not exists commentaire_validation text;

comment on column audits_caisse.valide_le is 'Date/heure à laquelle un manager a validé ce contrôle de caisse. NULL = encore provisoire.';
comment on column audits_caisse.valide_par is 'Manager/gérant ayant validé ce contrôle (NULL si validation rétroactive de migration).';
comment on column audits_caisse.ecart_piste_valide is 'Écart piste définitif après validation manager — distinct de ecart_piste (provisoire), jamais additionné avec lui.';
comment on column audits_caisse.ecart_boutique_valide is 'Écart boutique définitif après validation manager — distinct de ecart_boutique (provisoire), jamais additionné avec lui.';
comment on column audits_caisse.commentaire_validation is 'Commentaire du manager au moment de la validation, ou mention explicite si validation rétroactive de migration.';

-- Backfill : les ~31 lignes déjà enregistrées avant ce 03/08/2026 n'ont
-- jamais eu de vraie étape de validation manager distincte (le contrôle à
-- l'enregistrement dans Verify servait déjà de contrôle). Plutôt que de les
-- laisser indéfiniment "en cours de contrôle" (ce qui serait faux — elles
-- ont bien été vues), on les marque validées avec leurs écarts déjà connus
-- (jamais un chiffre inventé), et un commentaire de validation qui dit
-- explicitement qu'il s'agit d'une validation rétroactive de migration, pas
-- d'une revue manager ligne par ligne. Frédéric peut corriger au cas par
-- cas si besoin.
update audits_caisse
set
  valide_le = created_at,
  valide_par = null,
  ecart_piste_valide = ecart_piste,
  ecart_boutique_valide = ecart_boutique,
  commentaire_validation = 'Validation rétroactive lors de la migration "Mes Caisses" (03/08/2026) — écart déjà connu au moment de la migration, non revu individuellement ligne par ligne par un manager.'
where valide_le is null;
