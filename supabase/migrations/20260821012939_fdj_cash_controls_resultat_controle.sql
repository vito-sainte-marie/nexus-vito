-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260821012939 · fdj_cash_controls_resultat_controle
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- FDJ Sprint F4 (cahier §3, FDJ-08) : "Résultat métier du contrôle = Conforme / Avec
-- écart / À revoir / Non comparable. État administratif = Brouillon / Soumis /
-- Contrôlé / Validé. Ne pas utiliser « Validé » comme unique statut métier."
-- fdj_cash_controls.statut existe déjà (7 valeurs, mélange historique de statuts
-- opérationnels) et fdj_shifts.statut porte déjà l'axe administratif brouillon/
-- valide (F1, v2.16x) — aucun des deux ne porte le jugement métier explicite que
-- demande le cahier. Colonne additive, nullable (un contrôle existant n'a jamais
-- eu ce jugement posé, on ne fabrique pas une valeur rétroactive), jamais un
-- remplacement de statut existant (Article 11 : ajouter, ne pas réécrire ce qui
-- fonctionne déjà).
alter table fdj_cash_controls add column if not exists resultat_controle text;
alter table fdj_cash_controls add constraint fdj_cash_controls_resultat_controle_check
  check (resultat_controle is null or resultat_controle in ('conforme','avec_ecart','a_revoir','non_comparable'));

-- Cahier §3, étape 6 : "Commentaire / justificatif si nécessaire", distinct du
-- code de motif (motif_ecart, déjà existant) — texte libre, jamais fusionné avec
-- le code pour ne pas perdre la valeur structurée si on veut plus tard filtrer/
-- compter par motif.
alter table fdj_cash_controls add column if not exists motif_ecart_texte text;
