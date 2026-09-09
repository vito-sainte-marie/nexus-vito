# Plan de réparation en avant / rollback — candidate `ba1eed0e833c354f556128dc0ee4b0619725ed1a`

Portée : les 16 migrations du manifeste Production
(`manifeste-migrations-production-1.md`). Principe déjà tranché par Frédéric
(réveil du 09/09/2026, repris ici sans le rouvrir) : réparation en avant
privilégiée, rollback code distinct du rollback données.

## Rollback CODE (symétrique, déterministe, déjà lisible dans chaque fichier)

Un rollback code annule l'effet DDL/fonction d'une migration sans toucher les
lignes déjà écrites. Pour les 16 migrations incluses :

| Migration | Rollback code |
|---|---|
| #1 verrouiller_rpc_stock_par_site | `CREATE OR REPLACE FUNCTION` vers la version précédente (à extraire de la migration baseline si besoin d'un retour arrière — non nécessaire sauf régression prouvée) |
| #2 login_non_enumerable | `GRANT SELECT ON employees_public TO anon` (ré-ouverture explicite, jamais silencieuse) |
| #3 site_unique_shifts_mission_catalog | schéma seul (`DROP DEFAULT`) réversible par `ALTER ... SET DEFAULT` ; le DML (voir rollback DONNÉES) n'est pas réversible par du code |
| #4 fuseau_horaire_par_site | `ALTER TABLE sites DROP COLUMN timezone` — supprime la colonne, donc toute lecture qui en dépend (Q61/Q62 pompiste-du-jour) redevient fail-closed par absence de colonne, pas par une valeur erronée |
| #5 seed_referentiel_advisor | aucun rollback code : DML pur (voir DONNÉES) |
| #6 reprise_et_unicite_shifts_en_cours | l'index unique partiel est `DROP INDEX` ; le DML n'est pas réversible par du code (voir DONNÉES) |
| #7–#10 (triggers cloture/prise de poste) | `DROP TRIGGER` / restauration de la version antérieure de la fonction |
| #11–#15, #17 (policies RLS) | `DROP POLICY` restaure le comportement antérieur — **à ne faire qu'en connaissance de cause** : ce sont des fermetures de faille, un rollback rouvre la faille |

**Règle absolue** : aucun rollback code n'est déclenché sans que la
régression qu'il corrige soit elle-même mesurée et documentée — un rollback
appliqué par précaution sans preuve de régression est lui-même un changement
Production non justifié.

## Rollback DONNÉES — distinct, plus rare, jamais automatique

Seules deux migrations écrivent des données existantes plutôt que du schéma :

- **#3** (`shifts.site_id`, `mission_catalog.site`) : la valeur d'origine
  n'est PAS conservée par la migration (`UPDATE` direct, pas de colonne
  d'archive). Un rollback donnée nécessiterait un dump PRÉALABLE de ces deux
  colonnes avant application — **à faire systématiquement avant #3**, sinon
  aucun rollback donnée n'est possible, seulement une réparation en avant.
- **#6** (`shifts.statut`) : la migration écrit `heure_fin = NULL` (jamais
  une valeur inventée) et `statut = 'clos_sans_pointage'`. L'état d'origine
  (`statut = 'en_cours'`, `heure_fin = NULL`) est reconstituable exactement
  à partir du `WHERE` de la migration elle-même — un rollback donnée pour #6
  est donc possible en théorie, mais **réparation en avant reste préférée**
  (principe déjà tranché) : si un service a été clôturé à tort, la correction
  attendue est un nouveau pointage/une correction manuelle par le manager,
  pas une réécriture technique qui prétendrait que rien ne s'est passé.
- **#5** (`advisor_rules`, `nexus_language_templates`) : `ON CONFLICT DO
  UPDATE` écrase silencieusement un champ divergent (voir manifeste,
  condition #5). Avant d'appliquer, dumper les lignes existantes des `code`
  listés dans la migration (31 + 6 lignes, jamais plus) permet un rollback
  donnée exact si l'écrasement s'avère indésirable.

**Conséquence pratique** : avant toute exécution de #3, #5 ou #6 en
Production, un export `SELECT` des lignes concernées (mêmes prédicats que la
migration) doit être conservé hors dépôt, avec horodatage et lien vers la
release — sinon la réparation en avant est la SEULE option, jamais un choix.

## Fenêtre de déploiement — ce qui est mesuré, ce qui reste INCONNU

Mesuré (déclaré par l'Orchestrator, 08/09/2026 ~20:57 Martinique, voir
`inventaire-migrations-1.md`) : 16 services `en_cours`, dont 13 seraient
requalifiés par #6. C'est une mesure ponctuelle, pas une fenêtre — le
nombre de services en cours varie dans la journée et selon le jour de
semaine.

**INCONNU tant que non mesuré à nouveau juste avant la gate** (exigence déjà
posée par le réveil du 09/09/2026, reprise ici sans l'affaiblir) :
- le nombre de services `en_cours` au moment précis de l'exécution ;
- si une commande carburant ou une clôture de caisse est en cours d'écriture
  au même instant (fenêtre de verrou à éviter, pas seulement un chiffre bas).

Critère de fenêtre proposé, fail-closed par défaut : ne pas exécuter #6 tant
que le nombre de services `en_cours` mesuré immédiatement avant n'est pas
documenté et que la variation avec la mesure du 08/09 (16) n'est pas
expliquée si elle dépasse un facteur 2 dans un sens ou l'autre — un chiffre
inhabituel dit que l'activité du site a changé de nature depuis la mesure de
référence, pas seulement qu'elle a varié normalement.

## Ce que ce plan NE fait pas

Il ne dump rien, n'exécute rien, ne calcule aucune fenêtre optimale en
l'absence de mesure fraîche. Il fixe la méthode (quoi dumper avant quoi,
quand préférer réparation en avant à rollback donnée) pour que la gate finale
n'ait pas à l'improviser.
