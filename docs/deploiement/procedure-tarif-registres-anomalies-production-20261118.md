# Procédure : registres tarifaires T2, journal des décisions et anomalies (six migrations, Production)

**BROUILLON. Rien n'est exécuté.** Ce document décrit ce qu'il faudra faire, pas ce qui a été fait.
Origine : commentaire 6992262167 de Guardian sur #160. Code concerné : #331 (registres, moteur, anomalies) puis #332 (écran).
Aucune migration n'a été appliquée en Production. Aucune lecture de Production n'a été faite pour écrire ce document.

## 0. Garde de projet : décision A exécutée

Les six migrations portaient une garde « projet Test » qui les refusait en Production. La décision A (Guardian, 6992560740) est appliquée : **une seule version de chaque fichier**, qui sert à la répétition et à la Production. La garde d'identité est remplacée par un bloc `do $prerequis$` neutre : il lève `prerequis_migrations : <étiquette> : objets absents : ...` si un objet attendu manque (`sites`, `employees`, `import_batches` et, pour les migrations 2 à 6, les objets des précédentes). Aucune identité de projet n'est supposée. La migration 6 garde en plus son contrôle `ordre_migrations`. Le diff est limité à la garde.

Limite : les commentaires d'en-tête des fichiers disent encore « Test uniquement ». Laissés volontairement, à relire avant tout GO.

Les empreintes du §1 sont celles des fichiers du candidat (#331, tête `8d3af48b`). Rien n'a été appliqué en Production, ni sur Test avec ces nouvelles versions.

## 1. Les six migrations, dans l'ordre

Ordre obligatoire (chaque fichier vérifie ou suppose les précédents) :

| # | Fichier | Empreinte (16 premiers car. du SHA-256) | Objets | Risque |
|---|---|---|---|---|
| 1 | `20261117020430_tarif_registres.sql` | `28485767f90670db` | fonction `tarif_cle_reference`, 10 tables `tarif_*` (familles, rattachements, seuils, réglages, exceptions, prix décidés, application, régimes, contrôles réglementaires, décisions), 1 index | Faible : ajout seul, aucune table existante touchée |
| 2 | `20261117020652_tarif_registres_controles_rls.sql` | `5f2271e09cd444bd` | 4 fonctions de contrôle (`SECURITY INVOKER`), 3 déclencheurs, politiques RLS | Moyen : isolation par site portée ici ; à vérifier par rôle |
| 3 | `20261117020851_tarif_registres_vues.sql` | `a6251f2238766d7a` | 3 vues `security_invoker` (`v_tarif_prix_application_actifs`, `v_tarif_exceptions_effectives`, `v_tarif_incoherences`) | Faible : lecture seule, droits `authenticated` et `service_role` |
| 4 | `20261117021059_tarif_registres_comptes_desactives.sql` | `dcf7597074f7cd86` | politique `compte_actif_obligatoire` (RESTRICTIVE) par registre, remplace `v_tarif_exceptions_effectives` | Moyen : ne peut que retirer un accès ; à passer en dernier des quatre T2 |
| 5 | `20261117161325_tarif_decision_journal.sql` | `b4e70015376ddf84` | colonne `tarif_decisions.prix_decide_id`, index unique, déclencheur, RPC `tarif_enregistrer_decisions(jsonb)` | Moyen : première écriture applicative ; exige 1 à 4 |
| 6 | `20261118120000_tarif_anomalies_verifications.sql` | `0ee24d78e2a3c2ac` | tables `tarif_anomalies_verifications`, `tarif_anomalies_reevaluations`, 3 index, politique `lot_import_meme_site`, RPC `tarif_marquer_verifie`, `tarif_enregistrer_reevaluations` | Moyen : exige 1 à 5 (il le vérifie lui-même : `ordre_migrations`) |

SHA-256 complets (fichiers du candidat, à recalculer par `shasum -a 256`) :

- 1 `28485767f90670dbefc852a76601a38eb2f7eaf241ccbb0316df2a717a0f6249`
- 2 `5f2271e09cd444bdc61d06eea03083665be355920b72bebda79c68a0772e9873`
- 3 `a6251f2238766d7aa3a8dc3715025a43c83257bcd208ac37e3caccc1108ec520`
- 4 `dcf7597074f7cd862a843cfde83e1fbaa691ee5bf3a034e349d6b884200e1eab`
- 5 `b4e70015376ddf842dd4b9938a1f4ec7f314adb0350724c3280456349a8b7636`
- 6 `0ee24d78e2a3c2acdf0d5e3f6ac5709c366ead359f6e842fab1ef7271da6114d`

Toutes sont **additives** : aucune table, vue ou fonction existante de Production n'est modifiée ou supprimée, aucune donnée n'est réécrite. Les fonctions écrivantes sont `SECURITY INVOKER` : la RLS s'applique à la personne connectée, aucune élévation de droits. Le site n'est jamais un paramètre.

## 2. Droits des RPC (à contrôler après la migration 6)

| Rôle | `tarif_marquer_verifie` | `tarif_enregistrer_reevaluations` | Annuler une vérification |
|---|---|---|---|
| gérant | oui | oui | oui (toute saisie) |
| manager | oui | oui | sa propre saisie seulement (règle `annulation_roles_meme_site`, cas 19 ok, cas 20 refusé) |
| créateur de la ligne (sans rôle gérant ni manager) | refusé | refusé | refusé |
| pompiste, caissier | refusé | refusé | refusé |
| compte désactivé | refusé (`compte_actif_obligatoire`) | refusé | refusé |
| `anon` | refusé (pas d'`EXECUTE`) | refusé | refusé |

Le site n'est jamais transmis par l'appelant : il est lu dans la ligne `employees` de la personne connectée.

## 3. Avant : mesure du catalogue (lecture seule, par le pilote, filtrée)

Geste du pilote : aucune lecture de Production sans le GO du pilote. Requêtes de catalogue uniquement, aucune table de données.

```sql
-- a) Ce qui existe déjà (attendu : 0 ligne partout avant la migration 1)
select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and (c.relname like 'tarif\_%' or c.relname like 'v\_tarif\_%') order by 1;
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'tarif\_%' order by 1;
-- b) Registre des migrations : les six estampilles doivent être absentes
select version from supabase_migrations.schema_migrations
where version in ('20261117020430','20261117020652','20261117020851','20261117021059','20261117161325','20261118120000');
-- c) Prérequis de la migration 6 : doivent exister (sinon elle s'arrête d'elle-même)
select to_regclass('public.import_batches') is not null as import_batches, to_regclass('public.sites') is not null as sites,
       to_regclass('public.employees') is not null as employees;
```

Chaque mesure est datée et signée ; elle alimente `docs/deploiement/qualification-ordre-migration-code.json` (entrée par migration : `blob_migration`, date, mesure, justification). **La qualification est un geste du pilote** ; je n'écris aucune entrée à sa place.

## 4. Qualification (garde « ordre migration → code »)

Aujourd'hui la CI « Garde ordre migration → code » liste ces six migrations comme **non qualifiées** et fait échouer « Construire et éprouver l'artefact » sur #331 (attendu, c'est la garde qui joue son rôle). Elle passera quand le pilote aura ajouté, pour chacune des six, une entrée datée dans le fichier de qualification.

Raisonnement d'ordre (à faire valider) : les six migrations sont additives et le code (#331, #332) lit ou écrit les nouvelles tables seulement après action humaine. Une migration appliquée **avant** le code ne casse rien (tables non utilisées). Du code déployé **avant** les migrations casserait les écrans concernés (`PGRST` sur tables ou fonctions absentes). **Ordre retenu : les six migrations d'abord, le code ensuite.**

## 5. Application (geste du pilote, après GO explicite, hors heures d'affluence)

Claude n'écrit pas en Production. Pour chaque migration, dans l'ordre du §1 :

1. Relire l'empreinte du fichier appliqué contre le tableau du §1 (versions de Production après décision A).
2. Appliquer la migration seule (une transaction).
3. Passer les **vérifications du §6** correspondantes. Si l'une échoue : **arrêt** (§7), on n'applique pas la suivante.

Aucun import de données dans les tables `tarif_*` n'est fait par ces migrations. Les registres restent vides tant que personne ne saisit.

## 6. Vérifications après chaque migration (lecture seule)

- **Après 1** : les 10 tables et la fonction existent ; RLS activée sur chacune (`relrowsecurity`) ; `anon` sans droit sur `tarif_cle_reference` (`has_function_privilege('anon', …, 'execute') = false`).
- **Après 2** : 3 déclencheurs présents (`tgenabled = 'O'`) ; 4 fonctions de contrôle sans `SECURITY DEFINER` (`prosecdef = false`) ; politiques d'isolation par site présentes sur chaque registre.
- **Après 3** : 3 vues avec `security_invoker=true` (`reloptions`) ; `anon` et `public` sans droit (`has_table_privilege`).
- **Après 4** : une politique `compte_actif_obligatoire`, `permissive = false` (restrictive), par registre ; `v_tarif_exceptions_effectives` filtre les comptes actifs.
- **Après 5** : `tarif_enregistrer_decisions(jsonb)` est `SECURITY INVOKER`, `EXECUTE` réservé à `authenticated`, pas à `anon` ; colonne `prix_decide_id` et index unique présents.
- **Après 6** : 2 tables, 3 index (dont `tarif_anom_verif_active_uq` sur 5 colonnes : site, clé, cause, empreinte, `fichier_hash`) ; 2 RPC `SECURITY INVOKER`, `EXECUTE` réservé à `authenticated` ; politique `lot_import_meme_site` restrictive.
- **Après chacune** : les tables existantes de Production n'ont pas bougé (nombre de lignes de `employees`, `sites`, `import_batches` identique à la mesure d'avant) et le registre `schema_migrations` porte l'estampille attendue.
- **Après 6, matrice du §2 : contrôles de catalogue en lecture seule uniquement** (`has_function_privilege`, `pg_policies`, `prosecdef`, `relrowsecurity`). Aucun contrôle par rôle en Production : il créerait des comptes fictifs et des lignes, même en transaction annulée, ce qui est une écriture. La matrice par rôle est prouvée par la répétition sur Test (39/39).

La répétition équivalente a été faite par Guardian sur Test (transaction annulée, accord du pilote) : 39/39, contrôle 73 inchangé (130 / 138 / `1752f6f4…`), contrôle 40 inchangé, rien laissé.

## 7. Critère d'arrêt

On arrête, sans appliquer la suivante, dès qu'une des conditions est vraie :

- une migration lève une erreur (y compris `prerequis_migrations` ou `ordre_migrations`) ;
- une vérification du §6 donne un résultat différent de l'attendu ;
- le nombre de lignes d'une table existante change ;
- un rôle qui devrait être refusé ne l'est pas (matrice du §2).

On ne « corrige pas en avançant » : on consigne l'écart, on décide du retour arrière, on réexamine.

## 8. Retour arrière

Les migrations n'ayant écrit aucune donnée, le retour arrière consiste à retirer leurs objets, **dans l'ordre inverse** :

1. **Code** : annuler (revert) d'abord #332, puis #331, par PR sur `production` (protégée, PR obligatoire). Sans le code, les nouvelles tables ne sont plus lues.
2. **Migration 6** : script existant `docs/deploiement/retour-arriere-tarif-anomalies-verifications-20261118.sql`. Il supprime, dans `begin; … commit;`, les RPC `tarif_enregistrer_reevaluations(jsonb)` et `tarif_marquer_verifie(jsonb)`, puis les deux tables. La suppression des tables emporte leurs index, **y compris l'index unique à cinq colonnes** (`tarif_anom_verif_active_uq`) : vérifié par lecture du script, pas besoin de `drop index` séparé. **Il perd les vérifications enregistrées** : les exporter avant si elles comptent, par un `select` en lecture seule dont le résultat est gardé hors du dépôt (à ajouter au script au moment du lot du §0).
3. **Migrations 5 à 1** : scripts `retour-arriere-tarif-registres-5-decision-journal-20261118.sql`, `...-4-comptes-desactives-...`, `...-3-vues-...`, `...-2-controles-rls-...`, `...-1-registres-...` (tous du 20261118, chacun en `begin; ... commit;`), à passer dans l'ordre 6, 5, 4, 3, 2, 1. Le retrait de 4 recrée `v_tarif_exceptions_effectives` telle que la migration 3 la définit ; le retrait de 2 laisse les tables sans RLS jusqu'au retrait de 1. **Le retrait de 1 perd toutes les données des 10 registres : les exporter avant.** Le script de la 6 commence par un export en lecture seule des deux tables. Répétition complète sur base jetable : `outils/recette/anomalies_verifications/40_repetition_chaine_complete.sql` (état initial, retraits, migrations 1 à 6, retraits, état vide ; un `rollback` final). **Non encore exécutée.**
4. Retirer ensuite les estampilles correspondantes du registre des migrations seulement sur décision du pilote.

Ordre de décision : le retour arrière du code est sans risque de données ; le retrait des objets SQL est destructeur pour tout ce qui aurait été saisi entre-temps. Il se décide au cas par cas, jamais automatiquement.

## 9. Ce qui reste hors de cette procédure

- Aucune lecture ni écriture Decenium.
- Aucun chargement de données (lots T1, relevés) dans les tables d'application.
- Aucune recette en Production tant que le pilote n'a pas donné son accord ; la recette de l'écran n'a été faite que sur le banc local (Chromium, client simulé, données T1), jamais contre une base réelle avec les migrations appliquées.

## 10. Conditions pour dire « prêt »

1. Décision A exécutée (garde neutre, empreintes du §1) : fait dans #331 `8d3af48b`, à relire par Guardian.
2. Scripts de retour arrière 1 à 5 écrits (faits) et répétition complète (script 40) **rejouée sur Test avec succès** : à faire.
3. Mesure du catalogue de Production prise par le pilote, et les six migrations qualifiées dans le fichier de qualification.
4. Cette procédure relue et validée par Guardian puis par le pilote.
5. GO explicite du pilote pour l'application et pour la fusion.
