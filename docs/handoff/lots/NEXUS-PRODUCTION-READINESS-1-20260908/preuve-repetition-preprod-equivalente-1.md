# Preuve — répétition PREPROD-équivalente EXÉCUTÉE

**Lot** NEXUS-PRODUCTION-READINESS-1-20260908 · **Release** 2026.09.1
**Exécutée le** 09/09/2026 sur `nexus-test` (`udljdqxerrbbbajxubfn`).
**Production n'a été ni écrite ni migrée.** Deux requêtes SELECT y ont été
posées, autorisées explicitement par Frédéric Bragance, sans donnée nominative.

## Ce que cette répétition établit, et que les précédentes n'établissaient pas

La répétition du 09/09 au matin prouvait que les migrations s'appliquent sur une
base **vide**. Nécessaire, et hors sujet : Production a quatre mois d'histoire,
un site créé pour des tests, des colonnes divergentes et des services restés
ouverts. Une migration qui passe sur du vide peut se comporter autrement sur ces
formes-là.

Celle-ci a rejoué une **histoire** : Test reconstruit à l'état que Production
sert aujourd'hui (241 migrations, borne `20260904130807`), semé des cas mesurés,
**mesuré**, puis les 26 migrations de promotion appliquées, **mesuré à nouveau**.

## Rapport d'impact

| | avant | après |
|---|---|---|
| missions divergentes | 89 | **0** |
| services divergents | 17 | **0** |
| services `en_cours` | 17 | **1** |
| services `clos_sans_pointage` | 0 | **17** |

Les 26 migrations se sont appliquées sans erreur. Le « 1 » résiduel est le
service créé par l'épreuve du parcours employé, exécutée juste avant la mesure.

**Lecture pour la décision.** Les 89 missions et les 17 services divergents
proviennent du site `site-fantome-test`, créé délibérément par Frédéric pour ses
propres tests avant l'existence de `nexus-test` : leur recalage est un ménage.
Les 17 services restés ouverts, eux, portent `site` = `site_id` = la station
réelle sur des employés dont `compte_test` vaut false — c'est l'historique de
l'équipe, et la seule ligne du rapport qui touche de vraies personnes. Ils sont
clos en `clos_sans_pointage`, **heure de fin laissée nulle, jamais inventée**.

## Le parcours employé, éprouvé en le rejouant

> `PARCOURS EMPLOYÉ INTACT : le service de la veille s'est fermé seul
> (prise_de_poste_suivante), la prise de poste du jour est passée.`

Frédéric, 09/09/2026 : « les employés utilisent NEXUS au compte-gouttes […] il
ouvre un quart, commence la journée, parfois il ne fait rien — ni inventaire, ni
missions — et ne referme même pas le quart, car pour eux NEXUS ne fonctionne pas
correctement. »

Le quart laissé ouvert est donc le comportement **ordinaire**. Or cette release
installe `shifts_un_seul_service_en_cours`. Sans filet, l'employé qui n'a pas
fermé la veille se verrait refuser sa prise de poste, avec « Un problème est
survenu, réessayez » en boucle — l'insertion de `NEXUS-Prise-De-Poste-v1.html`
ne rattrape aucune erreur d'unicité. Le filet existe
(`nexus_shifts_avant_insertion`, migration 10 de la promotion) et l'épreuve le
vérifie en **rejouant le geste**, pas en lisant le code.

**RISQUE D'ORDRE, À RETENIR POUR LA PROMOTION.** L'index est la 6e migration de
la promotion, son filet la 10e. Une release interrompue entre les deux
laisserait l'équipe incapable de prendre son poste. Cette promotion doit aller
au moins jusqu'à la 10e migration ou ne pas commencer.

## Autres verdicts

- Suite complète : aucune régression, 9 échecs connus (motifs établis, QA-007).
- Guardian QA : 0 finding sur 250 épreuves.
- Répétition recette carburants : 14/14.
- Aucun de ces trois n'interroge la base : ce sont des verdicts sur le CODE.

## Retour à l'état normal — exécuté et vérifié des deux côtés

266 migrations rejouées, recette réensemencée, mode remis en `TEST_NORMAL`,
cycle PREPROD fermé le 09/09/2026 à 16:33. Vérifié : la garde de mode déclare
« dépôt et base d'accord », et le mode contraire est bien refusé.

## Ce que cette preuve NE couvre PAS

- **La recette navigateur n'a pas eu lieu.** Aucun écran n'a été jugé sur la
  base réelle. La répétition carburants le dit elle-même : « Ceci n'est PAS la
  preuve UI ».
- Les volumes de référence datent du 09/09/2026 et **vieillissent** :
  `services_ouverts` valait 13 le 08/09 et 17 le 09/09. À re-mesurer au plus
  près de l'autorisation ; la séquence refuse au-delà de trois jours.
- Aucune opération Production n'est autorisée par cette preuve.
