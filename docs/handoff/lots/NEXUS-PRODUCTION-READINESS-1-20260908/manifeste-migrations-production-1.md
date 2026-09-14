# Manifeste de promotion Production — candidate `ba1eed0e833c354f556128dc0ee4b0619725ed1a`

Décision Orchestrator déterministe du 09/09/2026 : les migrations
explicitement Test/CI ne sont pas promues aveuglément en Production, en
application du principe d'isolation Test/Production. Ce manifeste liste,
pour chacune des 21 migrations séparant `origin/production` (`501c0c7`) de la
candidate, si elle appartient à la release Production ou en est exclue —
sans exécuter ni appliquer quoi que ce soit ici.

## Incluses dans la release Production (16 migrations)

Dans l'ordre chronologique, appliquées telles quelles :

1. `20260904175723_verrouiller_rpc_stock_par_site`
2. `20260904175747_login_non_enumerable`
3. `20260904190027_site_unique_shifts_mission_catalog`
4. `20260905131500_fuseau_horaire_par_site`
5. `20260905161500_seed_referentiel_advisor` — **conditionnée** à la mesure
   `comparaison-seed-referentiel-advisor.sql` (voir « Conditions » ci-dessous)
6. `20260905170000_reprise_et_unicite_shifts_en_cours` — **conditionnée** à la
   fenêtre de déploiement (13 des 16 services `en_cours` mesurés seraient
   clôturés, voir `inventaire-migrations-1.md`)
7. `20260905180000_cloture_shift_au_pointage_depart`
8. `20260905190000_cloture_shift_a_la_prise_de_poste_suivante`
9. `20260905200000_rattachement_shift_du_quart_employe`
10. `20260905213000_prise_de_poste_contrat_unique`
11. `20260906020000_garde_ecriture_site`
12. `20260906040000_garde_mutation_site`
13. `20260906060000_garde_insertion_site`
14. `20260906080000_garde_portee_findings`
15. `20260906100000_garde_createur_sites`
16. `20260906120000_pompiste_du_jour_fuseau_station` (numéro de table #17 dans
    `inventaire-migrations-1.md` — republie sous le nom canonique la fonction
    déjà reconstituée par la migration Test #16 ci-dessous ; son propre
    contenu n'est pas Test-only)

## Exclues par défaut — portée Test/CI (4 migrations)

| # | Migration | Motif d'exclusion |
|---|---|---|
| 16 | `20260906113147_pompiste_du_jour_fuseau_station_test` | son propre en-tête : reconstitution d'une dérive appliquée hors migration **sur `nexus-test`** ; aucune trace équivalente en Production à corriger de la même façon |
| 18 | `20260907222249_creer_nexus_live_events_test` | son propre en-tête : « Test uniquement — NON appliquée en Production par ce lot, aucune promotion implicite » |
| 19 | `20260908033743_acces_rls_role_ci_recette_site_test` | grant au rôle `nexus_ci_recette`, borné à `nexus-station-test` — un rôle qui n'a de sens que si la CI s'exécute contre ce projet |
| 20 | `20260908035027_lecture_sites_role_ci_recette_pour_evaluation_rls` | complète le rôle CI de la migration 19 ; même exclusion, même motif |

Reclasser l'une de ces quatre migrations comme Production nécessite une
preuve d'un besoin Production réel (par ex. la CI s'exécutant un jour contre
un projet Production distinct) — pas seulement l'absence de risque connu.

## Exclue en permanence de cette release — aucune dépendance Production réelle (1 migration)

| # | Migration | Statut | Motif |
|---|---|---|---|
| 21 | `20260908200000_actor_role_human_pour_autorisation_frederic` | **EXCLUE (permanente pour cette release)** | `alter table public.nexus_live_events add constraint ...` — cette instruction échoue si la table n'existe pas. La table est créée **uniquement** par la migration 18, elle-même Test-only et exclue ci-dessus. Aucune migration de ce dépôt ne crée `nexus_live_events` pour Production. Appliquer #21 seule en Production échouerait à l'exécution (table absente) ; l'appliquer après avoir promu #18 par erreur créerait en Production une table explicitement documentée « Test uniquement ». |

### Vérification de la dépendance applicative réelle (09/09/2026)

`decision-3.md` demande de vérifier si le code applicatif de la candidate
exige réellement `nexus_live_events` en Production avant de matérialiser
l'exclusion. Vérifié par lecture de code (pas supposé) :

- `grep -rl "nexus_live_events"` sur le dépôt ne retourne, côté application,
  que `NEXUS-App-v1.html` (l'entrée de navigation) et
  `NEXUS-Live-Developpement-v1.html` (l'écran lui-même) — aucun moteur, RPC
  ni chemin serveur n'en dépend.
- `NEXUS-App-v1.html:1294` ajoute bien un lien de navigation vers NEXUS Live,
  visible uniquement `data-role="createur"`, avec sa propre description
  explicite : « Déploiements, Guardians et arbitrages en attente —
  **environnement Test** ». Ce lien fait partie du code candidat et serait
  donc déployé, mais sa description dit lui-même qu'il pointe vers Test.
- `NEXUS-Live-Developpement-v1.html:489-496` : la lecture de
  `nexus_live_events` est encadrée par un `if (error) { ... "Lecture du
  journal Live impossible : " + error.message ... }` — une table absente
  produit un message d'erreur explicite sur cet écran précis, jamais un
  plantage de l'application ni d'une autre page.
- `outils/producteur-evenements-live.js:26-29` documente et confirme
  n'écrire **jamais** en base lui-même (RLS réservée à `je_suis_createur()`,
  aucun `service_role`) : il n'existe donc aucun processus CI/cron qui
  écrirait automatiquement dans `nexus_live_events` en Production.
- L'audit du lot `NEXUS-LIVE-CONTROL-CENTER-1-20260906` qualifie lui-même le
  dispositif de MVP Test, jamais promu.

**Conclusion** : aucune dépendance fonctionnelle Production n'existe. Le pire
effet d'une candidate déployée sans `nexus_live_events` est un message
d'erreur lisible sur un seul écran réservé au Créateur, jamais une panne
applicative. La migration 21 est donc **exclue en permanence pour cette
release**, sans attendre une preuve supplémentaire — fail closed par défaut,
confirmé par la lecture de code plutôt que supposé.

**Condition de déblocage pour une future release** (l'une des deux, pas une
préférence) :
1. une migration Production dédiée crée `nexus_live_events` avec un contrat
   RLS revu pour un contexte Production (le rôle `je_suis_createur()` utilisé
   par la table Test reste valide en Production, mais cela doit être vérifié
   explicitement, pas supposé identique) — puis #21 s'applique après elle ; ou
2. un besoin Production réel de NEXUS Live est démontré et une décision
   canonique explicite promeut le dispositif Live en Production, migration
   dédiée à l'appui.

## Conditions portées par la release, pas des risques nouveaux

- **#5** (`seed_referentiel_advisor`) : `comparaison-seed-referentiel-advisor.sql`
  a été exécuté en lecture seule contre Production le 09/09/2026
  (`mesures-advisor-production-lecture-seule-1.md`) : **0 ligne `ECRASEE`**
  sur 37 lignes versionnées (6 gabarits + 31 règles, toutes identiques).
  Condition satisfaite pour l'état mesuré — cette mesure est **temporelle**
  et doit être rejouée juste avant la gate finale si les lignes concernées
  ont pu évoluer depuis (voir « Re-mesure finale » ci-dessous).
- **#6** (`reprise_et_unicite_shifts_en_cours`) : à exécuter uniquement dans
  la fenêtre de déploiement mesurée à faible activité (voir
  `plan-reparation-rollback-1.md`, section fenêtre) — 13 services seraient
  requalifiés `clos_sans_pointage` de façon visible pour les employés
  concernés. La mesure du 08-09/09/2026 (16 services `en_cours`) est
  également temporelle et doit être rafraîchie avant la gate.

## Re-mesure finale avant la gate

Les deux conditions ci-dessus (#5 et #6) reposent sur des mesures ponctuelles.
`re-mesure-finale-gate-1.md` (même répertoire) consolide les requêtes
`SELECT` exactes à rejouer immédiatement avant la soumission à Frédéric, pour
qu'aucune des deux ne soit acceptée sur la foi d'une mesure vieillissante.

## Ce que ce manifeste ne fait pas

Il ne modifie aucune migration existante, ne crée aucune migration
Production pour `nexus_live_events`, et n'exécute rien contre Production. Il
fixe seulement le périmètre de la prochaine promotion, déterministe pour
16/17/19/20, conditionnée (mesure temporelle à rafraîchir) pour 5/6, exclue
en permanence pour cette release pour 21.

## Ajouts du 09/09/2026 — toutes EXCLUES (Test/CI uniquement)

Cinq migrations écrites pendant la répétition PREPROD-équivalente. Toutes
répondent au même constat : **un droit ou un état accordé à chaud vivait en
base sans exister au dépôt**, et la reconstruction depuis zéro l'a perdu. Elles
n'accordent rien de nouveau ; elles rendent reproductible ce qui était déjà
décidé.

Aucune ne va en Production : le rôle `nexus_ci_recette`, le site
`nexus-station-test`, la table `nexus_live_events` et la notion même de mode de
répétition n'y existent pas. Les promouvoir échouerait sur un rôle absent — ou,
pire, créerait en Production des objets qui n'y ont aucun sens.

| # | Migration | Sort | Motif |
|---|---|---|---|
| 22 | `20260909110000_lecture_station_config_test_pour_derive_recette` | **EXCLUE — Test/CI** | SEC-018 : lecture de `station_config` par le rôle CI, bornée à la station de recette, pour constater la dérive de l'instantané |
| 23 | `20260909140000_droits_table_role_ci_recette_semis` | **EXCLUE — Test/CI** | SEC-020 : droits de table du semis. Une politique RLS sans droit de table ne s'applique à rien, et PostgreSQL répond « relation does not exist » |
| 24 | `20260909150000_usage_schema_public_role_ci_recette` | **EXCLUE — Test/CI** | SEC-021 : `usage` sur le schéma, en amont de tous les autres droits. Sans lui, un grant de table est inerte |
| 25 | `20260909160000_publication_journal_live_par_la_ci` | **EXCLUE — Test/CI** | SEC-022 : publication du journal Live, avec sa clause `actor_role in ('ci','guardian')` reprise à l'identique — c'est elle qui a refusé une usurpation le 08/09 |
| 26 | `20260909170000_mode_environnement_test_preprod` | **EXCLUE — Test/CI** | Mode `TEST_NORMAL` / `PREPROD_REHEARSAL`. La question « suis-je en répétition ? » n'a pas de sens en Production, et y répondre serait déjà une ambiguïté |

`test_manifeste_migrations_complet_20260909.js` vérifie désormais que CHAQUE
migration postérieure à l'état Production est classée ici, et qu'aucune
migration Test/CI n'échappe à l'exclusion. Le contrôle partait d'une
vérification faite à la main le matin même du 09/09 : 21 migrations, 21 citées.
Cinq heures plus tard il y en avait 26, et le manifeste ne le savait pas. Un
contrôle refait à la main ne se refait pas.

---

## INCLUSES — lot correctif du 11/09/2026

**Sept migrations, requalifiées EXCLUES → INCLUSES le 11/09/2026.**

**Pourquoi elles ne pouvaient pas rester exclues.** Le code de cette release
EXIGE désormais `pointages.service_id` et `pointages.client_event_id` : tout
nouveau pointage les renseigne, et la base les refuse sinon. Déployer ce code
sans les migrations qui créent ces colonnes rendrait **tout pointage
impossible** dès la première minute. Les deux ne se séparent plus.

`test_migrations_exigees_par_le_code_20260911.js` interdit désormais cette
séparation : si le code écrit une colonne, la migration qui la crée doit être
citée INCLUSE ici.

### Ordre d'application, et ce dont chacune dépend

| # | migration | dépend de | rôle |
|---|---|---|---|
| 1 | `20260911180000_pointages_service_id.sql` | — | crée la colonne, sa clé étrangère vers `shifts`, son index |
| 2 | `20260911180100_pointages_rattachement_historique.sql` | 1 | backfill des **75** cas certains ; laisse **17** à NULL (5 ambigus, 12 sans service) |
| 3 | `20260911180200_pointages_client_event_id.sql` | — | crée la colonne et son unicité partielle |
| 4 | `20260911180300_pointages_unicite_partielle.sql` | 1, 2 | unicité `(service_id, employee_id, type)` là où `service_id` n'est pas nul |
| 5 | `20260911180400_shifts_fin_apres_debut.sql` | — | contrainte `fin >= debut`, posée `NOT VALID` |
| 6 | `20260911180500_depart_ferme_son_propre_service.sql` | 1 | le départ ne ferme que le service que porte son pointage |
| 7 | `20260911180600_pointage_exige_service_et_evenement.sql` | 1, 3, 6 | exige les deux colonnes sur tout NOUVEAU pointage, et supprime le repli |

**L'ordre n'est pas indicatif.** 7 refuse un pointage sans `service_id` : elle
ne peut pas précéder 1. 4 indexe `service_id` : elle ne peut pas précéder le
backfill 2, sous peine de contraindre des lignes qu'on n'a pas encore
rattachées. 6 lit `new.service_id` : elle ne peut pas précéder 1.

**Ce que ces migrations ne font pas.** La contrainte `fin >= debut` reste
`NOT VALID` : sa validation exige le traitement explicite des lignes
existantes incompatibles, et n'est pas incluse. Les 17 exceptions historiques
ne sont jamais rattachées.
