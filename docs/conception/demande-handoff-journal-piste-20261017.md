# JOURNAL PISTE — Arbitrage de sécurité : trois tables, RLS et fonctions d'écriture (TEST exclusivement)

**Cette demande ne contient aucun SQL appliqué.** Elle soumet au palier humain, avant exécution, une nouvelle surface de sécurité : trois tables, leurs politiques RLS, leurs grants et les fonctions d'écriture réservées aux managers. Aucune application, aucune fusion, aucun déploiement, rien en Production avant décision. Périmètre : Supabase **Test** (`udljdqxerrbbbajxubfn`).

Vocabulaire retenu : la page s'appelle **Journal Piste** (sous-titre « Relevés, contrôles et décisions »). **Relevés Piste** reste l'écran de saisie des pompistes. La configuration vit dans Paramètres Station → **Pompes et index**.

## 1. Pourquoi maintenant

Les relevés piste sont en Production (PR #135 à #137). Rien ne compare encore deux relevés entre eux ni ne distingue « non contrôlé » de « conforme ». Le Journal Piste doit contrôler automatiquement les passations (fin Q1 → début Q2) et les nuits (fin Q2 → début Q1), signaler un relevé non enregistré, et ne demander un humain que pour qualifier un écart dont la cause n'est pas dans les données.

Aucune table existante ne porte ces faits (diagnostic : `docs/conception/historique-releves-piste-20261017.md`). `nexus_ecarts_qualifications` est inadaptée : `source_module` fermé à `verify`/`fdj`, motif fermé à cinq valeurs, UPDATE autorisé donc aucune trace de correction.

## 2. Ce qui existe et ne change pas

- `carburant_index_releves`, `_valeurs`, `_corrections` : inchangées, hormis **une colonne** `config_snapshot jsonb` sur `carburant_index_releves` (photographie immuable de la configuration, écrite avec le relevé).
- Horaires : `calculer_horaires_quart` reste le **seul** moteur. Aucun horaire n'est recopié dans les nouvelles tables.
- Aucun total de ventes, aucun second moteur, aucun accès à Decenium.

## 3. Le geste demandé (à appliquer sur Test seulement, après décision)

Une migration, trois tables, toutes avec `site` et RLS activée.

**`carburant_index_config`** — append-only, une ligne par version.
Colonnes : `id`, `site`, `version` (entier croissant par site), `config jsonb` (disposition des pompes, ordre de recopie, chiffres mécanique/Decenium, état en service, litres par unité, tolérance, seuil, délai), `avant jsonb`, `motif text` (facultatif), `modifie_par uuid`, `modifie_le timestamptz`. Unique `(site, version)`. Pas de date d'effet future.

**`carburant_index_alertes`** — une ligne par événement et par cause, jamais par compteur.
Colonnes : `id`, `site`, `type` (passation | nuit | releve_manquant), `evenement` (clé de l'événement, ex. date + quart), `niveau` (orange | rouge), `statut` (ouverte | resolue_auto | qualifiee), `constat jsonb` (compteurs concernés, écarts), `raison_cloture`, `ouverte_le`, `cloturee_le`. Clé unique `(site, type, evenement)` : l'évaluation est **idempotente**.

**`carburant_index_qualifications`** — append-only, correction par nouvelle ligne.
Colonnes : `id`, `alerte_id`, `site`, `choix` (erreur_lecture | mouvement_confirme | cause_inconnue), `commentaire`, `qualifie_par uuid`, `qualifie_le`, `remplace_id` (nullable, ligne remplacée). Aucun UPDATE, aucun DELETE.

**Fonctions SECURITY DEFINER** (`search_path` fixé, fail-closed, site déduit de l'appelant, jamais d'un paramètre) :
- `enregistrer_config_piste(site, config, motif)` : insère une version ; manager/gérant du site.
- `qualifier_alerte_piste(alerte_id, choix, commentaire, remplace_id)` : insère une qualification ; manager/gérant du site de l'alerte.
- `evaluer_controles_piste(site, date)` : upsert d'alertes sur la clé unique ; résout automatiquement si le recalcul sur données **finales** ne retrouve plus l'écart (un brouillon ne résout rien). Ne modifie jamais un index.

## 4. Droits proposés

| Table | SELECT | INSERT | UPDATE | DELETE | TRUNCATE |
|---|---|---|---|---|---|
| `carburant_index_config` | manager/gérant du site | via fonction seulement | aucun | aucun | aucun |
| `carburant_index_alertes` | manager/gérant du site | via fonction seulement | via fonction (statut, clôture) | aucun | aucun |
| `carburant_index_qualifications` | manager/gérant du site | via fonction seulement | aucun | aucun | aucun |

- Aucun accès `anon`. `revoke all … from public, anon, authenticated` explicite sur chaque table et chaque fonction, puis `grant execute` aux seuls rôles nécessaires. `TRUNCATE` révoqué (voir la dette connue sur ce droit).
- Le **pompiste n'a aucun accès** à ces tables ni à ces fonctions. L'auteur d'un relevé reste lisible dans le détail d'un relevé existant, pas dans le Journal.
- Lecture par un `SELECT` direct protégé par RLS ; la RLS ne masque pas les colonnes, donc aucune colonne sensible n'est ajoutée à ces tables.

## 5. Ce qui n'est PAS prouvé

- Aucune preuve de refus n'a encore été jouée : elle sera écrite avant la migration (patron `preuve-upload-jaugeage-pompiste-test.sql`) et rejouée en transaction annulée : refus pour `anon`, pour un pompiste, pour un manager d'un autre site, pour tout UPDATE/DELETE/TRUNCATE.
- L'**échelle des compteurs** (litres par unité d'index) n'est pas confirmée. Tant qu'elle ne l'est pas, tout contrôle en litres répond « Comparaison impossible : unité non confirmée ». Ce n'est pas un blocage de la surface de sécurité, seulement des contrôles.
- Rien n'est testé sur Safari iOS.

## 6. Conditions proposées pour le GO

1. Test exclusivement ; `execute_sql`, une transaction, `lock_timeout='2s'`, tampon `schema_migrations`.
2. Preuve de refus écrite et rejouée avant et après ; postcondition mesurée : 3 tables, RLS active, aucun grant à `anon`, aucun `TRUNCATE`, aucune fonction exécutable par `anon`.
3. Retour arrière : `drop function` des trois fonctions, `drop table` des trois tables, `alter table carburant_index_releves drop column config_snapshot`. Tables neuves donc sans donnée à préserver sur Test.
4. Aucune fusion, aucun déploiement, aucune Production. Une reprise en Production exigerait un arbitrage et un GO distincts.
5. Toute évolution ultérieure de ces permissions repasse par le Handoff.

## 7. Arbitrages déjà rendus par Frédéric (17/10/2026, ouverture du lot)

1. **Surface Test** : accord de principe pour les trois tables et `config_snapshot`. L'exécution des migrations, la création des fonctions privilégiées et toute permission restent soumises à l'examen du **SQL exact** et aux preuves de sécurité. Ce n'est pas un GO d'exécution SQL.
2. **Relevé manquant** : tâche planifiée côté serveur, indépendante de l'ouverture du Journal Piste ; délai initial 30 min après la fin de quart (Paramètres Station) ; contrôle toutes les cinq minutes, à confirmer selon l'infrastructure existante ; idempotente, résolution automatique à la régularisation. Le mécanisme de planification (extension, fonction planifiée) sera décrit avec le SQL exact et fera l'objet de sa propre demande s'il touche une permission.
3. **Échelle des compteurs** : validation physique obligatoire (Frédéric ou responsable désigné). Tant qu'elle n'est pas confirmée, aucune alerte à seuil en litres n'est présentée comme fiable.
4. **Habilitations** : Journal Piste et Paramètres Station → Pompes et index réservés aux managers et gérants habilités du site. Les pompistes gardent leurs seuls droits de saisie.

Exigences : Constitution NEXUS et Guardian Philosophie ; fait / hypothèse / décision humaine distingués ; relevés historiques et configuration d'origine préservés ; aucun calcul parallèle des ventes ; maquettes avant implémentation ; preuves RLS de refus et d'autorisation documentées ; aucune modification de Production.

## 8. Décision demandée

Instruction du lot : confirmer que le SQL exact (migration, politiques, grants, trois fonctions, planification) sera présenté pour examen **avant** toute exécution, avec la preuve de refus écrite et rejouable. Aucun GO migration, permissions ou Production n'est demandé ici. Prochaine décision attendue après cette instruction : l'examen du SQL exact et des preuves.
