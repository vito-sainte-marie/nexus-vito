# Dossier de promotion Production — Relevés piste (index pompiste + jaugeage Veeder-Root)

| | |
|---|---|
| Branche | `lot-releves-piste-promotion-20261017` (base `production` 3a014991), PR vers `production` |
| Lot source | `FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016` (issue #28), PR #134 fusionnée dans `main` (ff19b8a0) |
| Cible | Production `uzhjpqpctpvxytxpxoqz` + GitHub Pages (`production`) |
| Date | 17/10/2026 |
| Périmètre | celui recetté sur Test : index de début/fin de quart (début Q1 rejoué avec les valeurs réelles), jaugeage Veeder-Root en saisie manuelle, recopie Decenium, écart de nuit |

**Ce dossier prépare ; chaque écriture Production (migrations, fusion, approbation Pages) reste soumise au GO humain correspondant.**

## 1. Contenu

Code : `NEXUS-Releves-Piste-v1.html`, `nexus-releves-piste.js`, `nexus-veeder-root.js` (nouveaux) ; `nexus-carburant-donnees.js` (options `mesureLe`, `motifCorrection`, `provenance` de `enregistrerJaugeageOuverturePompiste`, rétrocompatibles) ; `nexus-auth.js` (une ligne : écran classé OPÉRATIONNEL, comportement identique au défaut, exigé par `test_acces_hors_service_20260916`). Épreuves : 3 fichiers `test_*_20261016.js`.

Les fichiers `nexus-auth.js` / `nexus-station.js` de `main` n'ont PAS été repris : ils sont périmés par rapport à `production`.

## 2. Migrations (2)

| Version | Contenu | SHA-1 du fichier | blob git |
|---|---|---|---|
| `20261016230000` | tables `carburant_index_releves/valeurs/corrections`, `carburant_gnr_statuts`, RLS, fonctions `carburant_index_corriger_valeur` / `_marquer_recopiee` (anon sans EXECUTE) | `3bd3f899ec86266dae8f241dffc7afed636dccf9` | `53a56865…` |
| `20261017130000` | CHECK `moment` élargi (`debut_q1`) + 4 colonnes nullables ; aucune RLS ni grant | `d9b16b3876de8b3d34aefdf5fe79236256bf5244` | `72286852…` |

Mesure Production du 17/10/2026 (lecture seule) : registre 316, dernier `20261016150000` ; `20260906120000` déjà présente ; les deux versions ci-dessus absentes ; tables `carburant_index_*` absentes.

### 2.1 Exclue volontairement : `20261017120000_politique_upload_jaugeage_pompiste`

Politique INSERT sur `storage.objects` (envoi de la photo Veeder-Root par le pompiste), autorisée pour **Test seulement** (request-7). Elle étend une surface de sécurité : elle ne fait pas partie du périmètre recetté (aucun envoi réel testé) et exige un arbitrage Handoff distinct avant Production. Sans elle, l'envoi échoue proprement (état « hors ligne », `envoyerPhoto`) et la saisie manuelle des quatre volumes reste possible : c'est le périmètre testé.

## 3. Ordre

1. Préflight lecture seule : registre 316 sans les deux versions ; tables absentes ; SHA-1 des fichiers = tableau §2.
2. Migration 1 puis migration 2, **une transaction chacune** via `execute_sql` (jamais `apply_migration`) : `begin; set local lock_timeout='2s'; <fichier>; insert into supabase_migrations.schema_migrations; commit;`. Contrôle C3 (shasum du texte transmis). Arrêt à la première anomalie.
3. Invariants après : registre 318 ; RLS activée sur les 4 tables ; `anon` sans EXECUTE sur les 2 fonctions ; aucun grant TRUNCATE à anon/authenticated ; `shifts` inchangé.
4. Code (GO distincts) : fusion de la PR, puis approbation du déploiement Pages. Jamais avant l'étape 3 (la page lit des tables neuves).
5. Contrôles finaux : empreinte de l'artefact servi, page présente (200 + contenu), lecture seule Production.

## 4. Compatibilité

Nouvelles tables et nouvelle page non référencée par les écrans existants : migrations seules sans effet visible ; ancien code inchangé. `nexus-carburant-donnees.js` : paramètres optionnels, comportement par défaut identique.

## 5. Retour arrière

Avant toute donnée : `drop table carburant_index_corrections, carburant_index_valeurs, carburant_index_releves, carburant_gnr_statuts cascade; drop function carburant_index_corriger_valeur(...), carburant_index_marquer_recopiee(...)` et suppression des deux lignes du registre. Après données : désactiver l'accès (revenir à l'artefact Pages précédent) et conserver les tables. Aucune donnée Production n'est touchée par la migration.

## 6. Preuves

Épreuves du lot : 22/22, 9/9, contraintes SQL vertes ; suite 284/292 avec 8 échecs identiques à `origin/production`. Recette Test du 16–17/10 : `docs/handoff/lots/FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016/recette-test-20261016.md` (rail). Non testés : Safari iOS / caméra / envoi réel, historique manager (cas 18), régularisation Q1/Q2, entrée contextuelle, rapports D/E.
