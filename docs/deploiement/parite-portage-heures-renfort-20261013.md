# Parité du portage manuel — heures, renfort Q1, réconciliation Verify / Paye

Condition 3 de la decision-2 (request-4, APPROVED_WITH_CONDITIONS). Portage `45c7078` comparé à la branche source `fast-track-heures-renfort-20261012` (`a2710e9`, base rail `7978abb`), le 13/10/2026.

## Méthode

Pour chacun des sept fichiers touchés, toute ligne ajoutée par la source (≥ 12 caractères, espaces rognés) est cherchée telle quelle dans le fichier porté. Une ligne absente n'est pas forcément un défaut : le portage est réécrit sur la version Production du fichier. Chaque absence est donc rapprochée à la main d'un équivalent.

## Résultat

| Fichier | Lignes ajoutées | Absentes à l'identique |
|---|---|---|
| `nexus-verify-moteur.js` | 45 | 0 |
| `nexus-paye-dossier-pdf.js` | 6 | 0 |
| `NEXUS-Verify-v1.html` | 264 | 0 |
| `nexus-paye-moteur.js` | 414 | 2 |
| `nexus-paye-donnees.js` | 104 | 1 |
| `NEXUS-Paye-v1.html` | 128 | 27 |
| `NEXUS-Parametres-Station-v1.html` | 115 | 3 |

Les 33 absences sont des lignes reformulées ou recomposées pour s'insérer dans la version Production (règles SMU #95, sélection `station_config`, bandeau de navigation). Ce qui a été vérifié :

- **Moteurs** : la ligne « Journée constatée par Verify, absente du planning » est portée sous la forme « Journée constatée, absente du planning de travail » (même cas, même traitement) ; `ecartsVerifyPlanning`, `heuresAutres`, la priorité caisse / piste sur renfort et le conflit d'affectation sont présents.
- **Écran Paye** : sont présents les tuiles « Heures de caisse », « Heures de piste », « Heures de renfort », « Heures supplémentaires », « Écarts à examiner », la section des écarts (`ecartsSection`) et le formulaire d'horaire exceptionnel (`hxEmployee`, `addHoraire`). Les lignes absentes sont ces mêmes blocs, recomposés.
- **Paramètres Station** : le renfort effectif et la lecture de `station_config` sont présents ; la requête de sélection est celle de Production, élargie.
- **Épreuves** : les dix épreuves renfort, heures supplémentaires et réconciliation du dépôt passent sur le portage.

## Limites

La méthode compare des lignes, pas un comportement : elle ne prouve pas l'identité fonctionnelle. Les épreuves ci-dessus la contrôlent sur les cas Ruddy, renfort effectif, réconciliation et cockpit, mais aucune recette navigateur n'a été rejouée sur le portage lui-même. Q4 et B ne sont pas implémentés dans le portage.
