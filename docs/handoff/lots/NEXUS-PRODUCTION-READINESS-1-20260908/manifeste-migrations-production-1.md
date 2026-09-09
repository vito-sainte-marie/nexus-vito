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

## Bloquée / exclue de cette release — dépendance non satisfaite (1 migration)

| # | Migration | Statut | Motif |
|---|---|---|---|
| 21 | `20260908200000_actor_role_human_pour_autorisation_frederic` | **BLOQUÉE/EXCLUE** | `alter table public.nexus_live_events add constraint ...` — cette instruction échoue si la table n'existe pas. La table est créée **uniquement** par la migration 18, elle-même Test-only et exclue ci-dessus. Aucune migration de ce dépôt ne crée `nexus_live_events` pour Production. Appliquer #21 seule en Production échouerait à l'exécution (table absente) ; l'appliquer après avoir promu #18 par erreur créerait en Production une table explicitement documentée « Test uniquement ». |

**Condition de déblocage** (l'une des deux, pas une préférence) :
1. une migration Production dédiée crée `nexus_live_events` avec un contrat
   RLS revu pour un contexte Production (le rôle `je_suis_createur()` utilisé
   par la table Test reste valide en Production, mais cela doit être vérifié
   explicitement, pas supposé identique) — puis #21 s'applique après elle ; ou
2. un besoin Production réel de NEXUS Live est démontré (le chantier
   `NEXUS-LIVE-CONTROL-CENTER-1-20260906` reste, à ce jour, un MVP Test selon
   son propre `audit-1.md`) et une décision canonique explicite promeut le
   dispositif Live en Production, migration dédiée à l'appui.

Sans l'une de ces deux preuves, #21 reste **exclue** de la présente release —
fail closed, pas une décision de convenance.

## Conditions portées par la release, pas des risques nouveaux

- **#5** (`seed_referentiel_advisor`) : exécuter
  `comparaison-seed-referentiel-advisor.sql` (même répertoire, strictement
  `SELECT`) contre Production avant application, et lire le nombre de lignes
  `ECRASEE` qu'il rapporte. Zéro ligne `ECRASEE` → application sans réserve.
  Une ou plusieurs lignes `ECRASEE` → chaque champ divergent listé doit être
  examiné avant de confirmer que l'écrasement est voulu (mise à jour d'un
  gabarit) ou qu'il écraserait une retouche manuelle à préserver.
- **#6** (`reprise_et_unicite_shifts_en_cours`) : à exécuter uniquement dans
  la fenêtre de déploiement mesurée à faible activité (voir
  `plan-reparation-rollback-1.md`, section fenêtre) — 13 services seraient
  requalifiés `clos_sans_pointage` de façon visible pour les employés
  concernés.

## Ce que ce manifeste ne fait pas

Il ne modifie aucune migration existante, ne crée aucune migration
Production pour `nexus_live_events`, et n'exécute rien contre Production. Il
fixe seulement le périmètre de la prochaine promotion, déterministe pour
16/17/19/20, conditionnée pour 5/6, bloquée pour 21.
