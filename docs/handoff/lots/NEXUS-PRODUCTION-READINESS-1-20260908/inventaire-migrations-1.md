# Inventaire des migrations — candidate vs Production

Candidate figée : `ba1eed0e833c354f556128dc0ee4b0619725ed1a` (HEAD de
`config-par-environnement` au démarrage du lot, identique au commit de
`decision-1.md`). `origin/production` (`501c0c7`) est un ancêtre direct de
cette candidate (`git merge-base --is-ancestor origin/production
origin/config-par-environnement` → vrai) : aucune divergence d'historique,
21 migrations séparent les deux.

Méthode : lecture statique de chaque fichier (en-tête + corps SQL), classement
par type d'exécution et par impact sur les données existantes. Aucun accès
Supabase n'a été nécessaire pour cette partie — c'est de la lecture de dépôt.

## Légende

- **Type** : `schéma/RLS` (DDL, policy, grant — aucune ligne touchée),
  `fonction différée` (trigger/RPC redéfini — n'agit qu'aux évènements
  futurs), `écriture au déploiement` (DML exécuté une fois, à l'application
  de la migration).
- **Impact** : `aucun`, ou l'une des quatre classes demandées —
  `supprimées`, `écrasées`, `complétées`, `corrigées`.

## Les 21 migrations

| # | Migration | Type | Impact données | Note |
|---|---|---|---|---|
| 1 | `20260904175723_verrouiller_rpc_stock_par_site` | fonction (RPC `SECURITY DEFINER` reverrouillée au site de l'appelant) | aucun | ferme une lecture publique du stock sans authentification |
| 2 | `20260904175747_login_non_enumerable` | schéma/RLS (révoque `employees_public` à `anon`) | aucun | mesure provisoire assumée comme telle par son propre en-tête ; le remplacement (Edge Function) reste un lot à part |
| 3 | `20260904190027_site_unique_shifts_mission_catalog` | écriture au déploiement + schéma (drop default) | **corrigées** — `shifts.site_id := site`, `mission_catalog.site := site_id`, uniquement où les deux colonnes divergent | nombre de lignes réellement affectées en Production : inconnu sans lecture |
| 4 | `20260905131500_fuseau_horaire_par_site` | écriture au déploiement (sites) + fonction différée (triggers carburant) | **complétées** — `sites.timezone` seulement où `NULL` ; jamais une valeur déjà renseignée | fail-closed si un site reste sans fuseau après l'étape 4 : la migration échoue plutôt que de deviner |
| 5 | `20260905161500_seed_referentiel_advisor` | écriture au déploiement (`INSERT … ON CONFLICT (code) DO UPDATE`) | **complétées** pour les codes absents ; **écrasées** pour un code déjà présent avec une valeur différente | **point d'attention n°1** — voir ci-dessous |
| 6 | `20260905170000_reprise_et_unicite_shifts_en_cours` | écriture au déploiement (repair one-shot) + schéma (index unique partiel) | **corrigées** — services bloqués `en_cours` passés à `clos_sans_pointage`, `heure_fin` laissée `NULL` (jamais inventée) | nombre de services concernés en Production : inconnu sans lecture ; **point d'attention n°2** |
| 7 | `20260905180000_cloture_shift_au_pointage_depart` | fonction différée (trigger `AFTER` sur pointages) | aucun au déploiement | n'agira qu'aux pointages de départ futurs |
| 8 | `20260905190000_cloture_shift_a_la_prise_de_poste_suivante` | fonction différée (trigger `BEFORE INSERT` sur shifts) | aucun au déploiement | doit rester `BEFORE`, l'index unique l'impose (documenté dans le fichier) |
| 9 | `20260905200000_rattachement_shift_du_quart_employe` | fonction différée (trigger de garde INSERT/UPDATE) | aucun — portée explicitement non rétroactive (« aucune reprise rétroactive n'est faite ») | 6 lignes historiques à `shift_id NULL` restent telles quelles, assumé |
| 10 | `20260905213000_prise_de_poste_contrat_unique` | fonction différée (corrige un trigger dont l'ordre alphabétique cassait #8) | aucun au déploiement | corrige un trigger jamais fonctionnel depuis l'application (constat documenté dans le fichier) |
| 11 | `20260906020000_garde_ecriture_site` | schéma/RLS (policy `pointages`) | aucun | ferme une écriture de pointage sur un site arbitraire |
| 12 | `20260906040000_garde_mutation_site` | schéma/RLS (UPDATE/DELETE sur `advisor_rules`, `apprentissage_snapshots`) | aucun | aucune donnée réattribuée, aucun privilège élargi (assumé par le fichier) |
| 13 | `20260906060000_garde_insertion_site` | schéma/RLS (INSERT sur les deux mêmes tables) | aucun | ferme la dernière face du même motif |
| 14 | `20260906080000_garde_portee_findings` | schéma/RLS (3 policies : badges, points, quart-employés) | aucun | trouvailles de la garde statique elle-même |
| 15 | `20260906100000_garde_createur_sites` | schéma/RLS (policies créateur sur `sites`) | aucun | tranche une tension doctrinale documentée dans le fichier (propriété plateforme vs refus d'accès fonctionnel) |
| 16 | `20260906113147_pompiste_du_jour_fuseau_station_test` | fonction (reconstitution fidèle d'une dérive appliquée hors migration sur `nexus-test`) | aucun | **portée Test** — corrige une dérive de traçabilité, pas un besoin Production |
| 17 | `20260906120000_pompiste_du_jour_fuseau_station` | fonction (redéfinit `est_pompiste_du_jour`, republie #16 sous le nom canonique) | aucun | fail-closed si fuseau absent/invalide, exige un service `en_cours` |
| 18 | `20260907222249_creer_nexus_live_events_test` | schéma (nouvelle table + RLS) | aucun | son propre en-tête : « Test uniquement — NON appliquée en Production par ce lot, aucune promotion implicite » |
| 19 | `20260908033743_acces_rls_role_ci_recette_site_test` | schéma/RLS (grant au rôle `nexus_ci_recette`, borné à `nexus-station-test`) | aucun | rôle CI, moindre privilège documenté (pas de `BYPASSRLS`) |
| 20 | `20260908035027_lecture_sites_role_ci_recette_pour_evaluation_rls` | schéma/RLS (SELECT sur `sites` pour le même rôle CI) | aucun | lecture nécessaire à l'évaluation d'une sous-requête, pas à un accès aux lignes (RLS `authenticated` reste fermée à ce rôle) |
| 21 | `20260908200000_actor_role_human_pour_autorisation_frederic` | schéma (élargit une contrainte `CHECK`) | aucun | ouvre la valeur `human` déjà acceptée côté contrat JS, ne change aucune policy RLS |

## Point d'attention n°1 — `seed_referentiel_advisor` (migration 5)

Le fichier documente lui-même que `advisor_rules` et `nexus_language_templates`
n'existent QUE dans la base de Production actuelle (insérées hors migration,
le dump de schéma d'origine ne portait aucune donnée). Cette migration les
rend enfin reproductibles par `ON CONFLICT (code) DO UPDATE` : idempotente si
les valeurs Production sont déjà identiques à celles codées ici, mais
**silencieusement écrasante** sur tout champ qui aurait divergé depuis (un
libellé retouché à la main en Production, par exemple). Impact réel : **INCONNU
sans une lecture Production** comparant, ligne par ligne sur les `code`
listés, la valeur actuelle à celle de la migration. C'est la première mesure
à faire dès qu'une session dispose d'un accès Production en lecture seule.

## Point d'attention n°2 — `reprise_et_unicite_shifts_en_cours` (migration 6)

Repair one-shot sur des lignes `shifts.statut = 'en_cours'` réellement
bloquées (service déjà daté la veille, ou doublon de service ouvert par le
même employé). Le nombre de lignes concernées en Production est inconnu sans
lecture : c'est la seconde mesure prioritaire, avec le détail des employés et
services touchés, avant toute promotion.

## Candidates dont la portée Production reste à trancher (pas une décision technique)

Quatre migrations (16, 18, 19, 20) sont scopées Test/CI par leur propre
contenu (rôle `nexus_ci_recette`, table `nexus_live_events` explicitement
« Test uniquement »). Les promouvoir en Production ne casserait rien
(schéma additif, RLS restrictive par défaut), mais leur utilité en Production
n'est pas évidente si CI ne s'exécute jamais contre ce projet. Ce n'est pas
une décision technique déterministe — je la signale sans trancher :
`NEXUS-PRODUCTION-READINESS-1-20260908` peut soit les promouvoir (elles sont
sans risque connu), soit les exclure explicitement de la procédure de
promotion et les documenter comme « Test/CI only » de façon permanente dans
`docs/nexus/`. Les deux choix sont défendables ; le choisir est un jugement de
fondateur.

## Ce que cet inventaire NE fait PAS

- Il ne mesure rien en Production : aucune lecture Supabase Production n'a
  eu lieu (aucun identifiant/réseau Production disponible dans ce canal —
  cohérent avec la restriction documentée depuis le 06/09/2026 sur ce
  workflow GitHub Issue).
- Il ne construit pas PREPROD, ne définit pas la fenêtre de déploiement, ne
  fixe pas les critères `Prêt pour Production` dans NEXUS Live, et ne rédige
  pas le plan de réparation en avant détaillé — ces points restent ouverts,
  voir `request-2.md`.
