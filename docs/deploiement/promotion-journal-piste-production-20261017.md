# Dossier de promotion Production — Journal Piste (migration 20261017140000)

| | |
|---|---|
| Branche | `journal-piste-recette-20261017`, PR #138 (brouillon) vers `production` |
| Lot | `JOURNAL-PISTE-20261017` (rail Handoff : request-3 déposée, decision-2 attendue) |
| Cible | Production `uzhjpqpctpvxytxpxoqz` + GitHub Pages (`production`) |
| Date | 17/10/2026 |

**Ce dossier prépare ; migration, fusion et déploiement exigent chacun un GO distinct de Frédéric. Rien n'a été appliqué en Production.**

## 1. Migration

`20261017140000_journal_piste_config_alertes_qualifications.sql` (blob git `0a5c73f92f01a4c8e35a5921bc0daf40ab72597f`) : 3 tables neuves (`carburant_index_config`, `carburant_index_alertes`, `carburant_index_qualifications`) avec RLS par site, colonne nullable `config_snapshot` sur `carburant_index_releves`, fonctions `piste_*`, `enregistrer_config_piste`, `qualifier_alerte_piste`, `evaluer_controles_piste`, job pg_cron `nexus-journal-piste` (`*/5`). Le motif « truncate » relevé par la garde ne vise aucune table existante.

Mesure Production (lecture seule, `begin read only … rollback`, identité `postgres`) : registre 319, dernière `20261017130000` ; estampille absente ; 3 tables, 16 fonctions, colonne `config_snapshot` et job absents ; `carburant_index_releves` présente (créée par `20261016230000`).

## 2. Ordre

1. Préflight lecture seule : estampille absente, objets absents, blob = ci-dessus.
2. Migration en une transaction via `execute_sql` (jamais `apply_migration`), après `20261017130000`.
3. Invariants : RLS activée sur les 3 tables ; `anon` sans EXECUTE sur toutes les fonctions `piste_*` et RPC ; aucun TRUNCATE accordé à anon/authenticated ; job présent une seule fois.
4. Code (GO distincts) : fusion puis approbation Pages, jamais avant l'étape 3.
5. Contrôles finaux : empreinte de l'artefact servi, pages présentes, lecture seule Production.

## 3. Compatibilité

L'ancien code servi ne nomme aucun objet de la migration : migration seule sans effet visible. Le nouveau code sans migration ne casse que les pages neuves (Journal Piste, section « Pompes et index »).

## 4. Retour arrière

Avant données : `cron.unschedule('nexus-journal-piste')`, suppression des triggers, fonctions et tables, de la colonne `config_snapshot` et de la ligne du registre. Après données : revenir à l'artefact Pages précédent et conserver les tables (append-only).

## 5. Preuves

Recette Test : harnais 8/8, preuves SQL d'isolation par site, recette navigateur avec compte manager (données conformes, heure Martinique, aucun total de ventes ni classement).
