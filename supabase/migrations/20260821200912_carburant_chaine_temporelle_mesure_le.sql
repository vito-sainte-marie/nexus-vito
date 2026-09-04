-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260821200912 · carburant_chaine_temporelle_mesure_le
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Chaîne temporelle carburant (21/08/2026, demande de Frédéric) : chaque
-- mesure physique doit porter son instant réel, distinct de created_at (qui
-- n'est que l'instant d'écriture en base). Sert d'ancre pour ne plus jamais
-- comparer un stock mesuré en cours de journée aux ventes de TOUTE la
-- journée (bug à l'origine des faux écarts +1022L SP95 / +912L GO).

ALTER TABLE carburant_releves
  ADD COLUMN IF NOT EXISTS mesure_le timestamptz;
COMMENT ON COLUMN carburant_releves.mesure_le IS
  'Instant physique RÉEL de la mesure (jaugeage), distinct de created_at (instant d''écriture en base, qui peut légèrement différer). Source selon origine : reception_livraison -> heure de fin de jaugeage de la visite (précise, secondes) ; terrain_pompiste -> cree_le de la version (précise) ; manager -> approximation par created_at, faute de mieux (aucune saisie d''heure dédiée sur ce parcours).';

ALTER TABLE carburant_releve_versions
  ADD COLUMN IF NOT EXISTS mesure_le timestamptz;
COMMENT ON COLUMN carburant_releve_versions.mesure_le IS
  'Miroir de carburant_releves.mesure_le pour CETTE version précise (couche de preuve append-only) — voir carburant_releves.mesure_le pour la convention de source par origine.';

ALTER TABLE carburant_controles
  ADD COLUMN IF NOT EXISTS reference_mesure_le timestamptz,
  ADD COLUMN IF NOT EXISTS fenetre_debut timestamptz,
  ADD COLUMN IF NOT EXISTS fenetre_fin timestamptz;
COMMENT ON COLUMN carburant_controles.reference_mesure_le IS
  'Instant physique réel de l''ancre utilisée pour ce contrôle (mesure_le du relevé/point zéro de référence) — rend le calcul auditable. NULL sur les contrôles posés avant le 21/08/2026 (logique jour-par-jour antérieure, honnêtement non renseigné plutôt que reconstitué).';
COMMENT ON COLUMN carburant_controles.fenetre_debut IS
  'Borne de début (exclue) de la fenêtre de ventes réellement retenue pour ce contrôle — égale à reference_mesure_le en régime normal.';
COMMENT ON COLUMN carburant_controles.fenetre_fin IS
  'Borne de fin (incluse) de la fenêtre de ventes réellement retenue pour ce contrôle — égale à la mesure_le du relevé contrôlé lui-même quand elle est connue, sinon à la fin de journée par repli.';
