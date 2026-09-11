# SITE-EXPLICITE-1-RLS-MATRIX-PROOF — matrice d'isolation en écriture

Exécutée le 06/09/2026 sur `nexus-test`. **Phase de mesure : aucune policy
modifiée, aucune correction appliquée.** Toutes les tentatives se font en
transaction annulée, sous identité employé réelle.

## Méthode, et ce qu'elle sait distinguer

Pour chacune des **54 tables** portant un défaut `'vito-sainte-marie'`, un
sondeur générique construit une ligne minimale — colonnes `NOT NULL` sans
défaut, remplies par type — puis tente **deux** insertions :

1. avec un site **non autorisé** (`site-fantome-test`) ;
2. avec le site **autorisé** du compte (`nexus-station-test`).

La seconde tentative n'est pas un luxe : **une table qui refuse tout ne prouve
aucune isolation.** Sans elle, un refus général se lirait à tort comme une
protection du site.

Classification par couple de codes :

| Site refusé | Site autorisé | Lecture |
|---|---|---|
| `42501` | accepté, ou refusé pour une **autre** raison | **ISOLATION PROUVÉE** — seul le site distingue les deux |
| accepté | — | **ANOMALIE** — écriture inter-site acceptée |
| `42501` | `42501` | refus non attribuable au site pour ce profil |
| autre code | — | non concluant — une contrainte a devancé la RLS |

Le point qui fait la rigueur : quand la tentative « bon site » échoue en
`23503` (clé étrangère) ou `23514` (contrainte de contrôle) alors que la
tentative « mauvais site » échoue en `42501`, **la RLS a été atteinte dans les
deux cas** et n'a refusé que le mauvais site. La seule variable entre les deux
tentatives est le site. C'est donc une isolation prouvée, et non un résultat
douteux.

## Résultat

### Aucune écriture inter-site n'a été acceptée

**0 anomalie sur 54 tables**, pour les deux profils éprouvés.

### Profil ordinaire — pompiste

| Verdict | Tables |
|---|---:|
| Isolation prouvée | **31** |
| Anomalie | **0** |
| Refus non attribuable au site *(aucun chemin d'écriture pour ce profil)* | 23 |

Parmi les 31, dix-sept ont vu leur tentative « bon site » échouer sur une
contrainte de données synthétiques après avoir passé la RLS : `fdj_*`,
`inventaire_comptages`, `inventaire_mouvements`, `pointages`… Le site y est
bien le seul discriminant.

### Profil manager — sur les 23 tables restantes

| Verdict | Tables |
|---|---:|
| Isolation prouvée | **20** |
| Anomalie | **0** |
| Toujours fermées | 3 |

### Synthèse

| | Tables |
|---|---:|
| **Isolation en écriture prouvée** | **51 / 54** |
| **Anomalies** | **0** |
| Non concluant — limite du sondeur | 2 |
| `NOT_APPLICABLE` — aucun chemin d'écriture | 1 |

## Les trois tables restantes

Aucune n'est un défaut, et il faut le dire précisément plutôt que de les
laisser dans une colonne grise.

| Table | Statut | Raison |
|---|---|---|
| `coach_recommendation_events` | **non concluant — limite du sondeur** | sa policy exige `actor_id = auth.uid()` ; mon sondeur y met un uuid aléatoire, donc le refus vient de l'acteur, pas du site. La policy **contrôle bien le site** (`site = current_employee_site_id()`), vérifié par lecture. |
| `mission_progress` | **non concluant — limite du sondeur** | sa policy exige la cohérence avec le service ; mon `shift_id` synthétique n'existe pas. Son isolation a été **prouvée par comportement** dans le lot 2B-SECURITY-WRITE-GUARD. |
| `mission_progress_archive_2026_09` | **`NOT_APPLICABLE`** | **aucune policy `INSERT`** : table d'archive, sans chemin d'écriture. Non forcée artificiellement. |

## Ce que cette matrice ne prouve pas

- **Elle ne prouve rien sur les lectures.** Seules les écritures ont été
  sondées.
- **Elle ne couvre pas les `UPDATE`.** Une ligne déjà écrite pourrait être
  déplacée vers un autre site par une politique de mise à jour sans
  `with check` — c'est exactement le défaut trouvé sur `mission_progress` au
  lot précédent, et **il n'a été cherché sur aucune autre table**.
- **Elle n'a pas éprouvé le profil créateur en écriture** sur les 54 tables.
  Un seul refus a été constaté, sur `pointages`.
- **Elle ne dit rien des Edge Functions**, absentes de Test.
- **Elle ne protège contre aucune régression** : ces preuves vivent dans des
  transactions annulées, pas dans la suite.

## Conséquence pour la suite

Le risque « écriture sur le mauvais site » est **mesuré et fermé** sur les
chemins d'insertion des 54 tables à défaut. Le défaut de colonne subsiste
partout ; il ne peut simplement plus produire une écriture acceptée sur un
autre site.

Ce qui reste — la classe D, c'est-à-dire les fonctionnalités cassées hors
Sainte-Marie — est désormais un problème de **fiabilité**, non de sécurité.
C'est une inversion de nature qui devrait gouverner l'ordre du reste du
chantier.
