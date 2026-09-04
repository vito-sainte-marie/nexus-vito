# Fiche de recette NEXUS — modèle

Une fiche par version mise en production. Copier ce fichier sous
`docs/recettes/AAAA-MM-JJ-<sujet>.md`, le remplir pendant la recette sur
`test.nexusconseil.net`, et le committer **avant** la promotion en
production.

Règle : la production ne reçoit que le SHA exact validé ici. Si le SHA
change, la recette est à refaire — une fiche ne vaut que pour l'objet
qu'elle a réellement éprouvé.

---

## Identification

| | |
|---|---|
| Fonctionnalité testée | |
| Commit testé (SHA complet) | |
| Branche | |
| Date de recette | |
| Recette menée par | |

## Migrations

| Fichier | Appliquée sur Test le | Volumes avant → après | Procédure de retour |
|---|---|---|---|
| | | | |

Un script `down` ne suffit pas. Pour chaque migration, cocher :

- [ ] Sauvegarde prise avant application (préciser où et comment la restaurer)
- [ ] Volumes de lignes relevés avant ET après, table par table
- [ ] Écart des volumes expliqué (une suppression voulue est un écart *expliqué*, pas un écart *toléré*)
- [ ] Procédure de restauration rédigée **et essayée** sur Test
- [ ] Le code compatible est prêt et validé AVANT toute application en production

## Rôles contrôlés

| Rôle | Compte | Testé | Anomalie |
|---|---|---|---|
| Manager | Manager Test | ☐ | |
| Caissière | Caissière Test 1 | ☐ | |
| Caissière (simultanéité) | Caissière Test 2 | ☐ | |
| Pompiste | Pompiste Test | ☐ | |
| Renfort | Renfort Test | ☐ | |

## Scénarios

| # | Scénario | Attendu | Résultat | Statut |
|---|---|---|---|---|
| 1 | | | | ☐ réussi / ☐ échoué |

Scénarios d'isolation à repasser à chaque version, quelle que soit la
fonctionnalité — ce sont eux qui ont manqué jusqu'ici :

| # | Scénario | Statut |
|---|---|---|
| I1 | Deux caissières connectées en même temps : aucune donnée de l'une visible chez l'autre | ☐ |
| I2 | Une nouvelle prise de poste ne récupère aucun état d'un service précédent | ☐ |
| I3 | Aucune écriture ne porte le `site_id` de production | ☐ |
| I4 | Un employé n'atteint aucune page manager, même en saisissant son adresse | ☐ |
| I5 | Le bandeau MODE TEST est visible sur tous les écrans | ☐ |

## Anomalies connues, non bloquantes

| Anomalie | Impact | Suivi |
|---|---|---|
| 9 tests de non-régression en échec (inventaire ×5, réception ×2, carburant ×1, pilotage ×1) | Antérieur au 04/09/2026, sans lien avec cette version | à reprendre |

## Décision

| | |
|---|---|
| Recette validée le | |
| Mise en production autorisée par | |
| SHA promu en production | |
| Non-régression en production vérifiée le | |
| Retour arrière possible vers | |

> Sans nom ni date dans ce bloc, la version **n'est pas autorisée** en
> production.
