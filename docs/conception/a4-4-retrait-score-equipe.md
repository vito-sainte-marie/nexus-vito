# A4-4 : retrait de tout score d'équipe tiré du pointage (décision du gérant du 27/11/2026)

Règle : aucun jugement sur une personne ou une équipe n'est tiré du pointage tant que les données ne sont pas fiabilisées. Les faits mesurés restent lisibles au niveau 3 ; le calcul reste dans le moteur.

## 1. Écrans touchés (avant → après)
| # | Écran / fichier | Après |
|---|-----------------|-------|
| 1 | Radar Manager, axe Équipe (NEXUS-Radar-Manager-v1.html) | non tracé ; « Équipe : non noté », sous-titre « données de pointage en cours de fiabilisation » ; hors compteurs du verdict ; « domaines pilotés » − 1 |
| 2 | Accueil, carte Équipe (NEXUS-App-v1.html, nexus-boussole-moteur.js, nexus-app-donnees.js) | pastille neutre « Non noté » ; détail « Ponctualité mesurée sur N pointages… » ; plus de « employé(s) à surveiller » |
| 3 | Secteur Équipe (nexus-secteurs-moteur.js) | `valeur` null, `contribMaitrise` null : sort de l'Indice Boussole global |
| 4 | Brief (NEXUS-Brief-v1.html, nexus-brief-donnees.js) | carte factuelle sans note ; global « calculé sans l'Équipe, données de pointage en cours de fiabilisation » |
| 5 | Progression / Apprentissage / Mon évolution (nexus-progression.js, point 8) | ponctualité « Non noté » ; détail factuel « n retard(s) sur N pointage(s) » ; plus de score, plus d'axe de progression ni de point fort « ponctualité » |
| 6 | Signal `ponctualite_recurrente` + `collaborateursASurveiller` (nexus-risques-donnees.js, point 9) | plus émis ; lignes déjà stockées filtrées à la lecture ; donc ni carte, ni liste « à surveiller », ni Conseiller. Le calcul reste dans nexus-ponctualite.js |
| 7 | Rapport direction (point 7) | inchangé (fait : taux de ponctualité) |
| 8 | nexus-ponctualite.js | `scoreEquipe` supprimé avec son épreuve |

Aucun écran ne demande de refonte : tous se conforment par neutralisation. Les badges de Progression (calculerBadges) ne dépendent pas du score et sont inchangés.

## 2. Recette (Guardian)
E1 axe Équipe non tracé, aucune couleur de jugement ; E2 verdict Radar sans Équipe ; E3 carte Équipe « Non noté » avec son détail ; E4 mention « calculé sans l'Équipe… » sur l'Indice Boussole ; E5 faits (taux, nombre de pointages) lisibles au niveau 3 ; E6 Rapport direction inchangé ; E7 aucun statut ni couleur de jugement sur un collaborateur dans Progression, Radar, accueil, Brief, Conseiller.

## 3. Épreuves
test_ponctualite_a4_4.js (aucun `scoreEquipe`, E7), test_retard_null_consommateurs_20260919.js, test_risques_batching_nexus_risk_signals.js, test_secteurs_statut_metier_v2218.js, test_versions_scripts_20261121.js.
