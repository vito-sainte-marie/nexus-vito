# A4-4 : retirer le score de ponctualité de l'équipe (inventaire + avant/après, sans code)

Base : branche `claude/a4-4-ponctualite` (1c31f7a7). Source du score : `NexusPonctualite.scoreEquipe(tauxAnomalies)` (nexus-ponctualite.js:68), 100 − taux×200, borné 0–100.

## 1. Inventaire (fichier:ligne, ce qui s'affiche ou se décide)
| # | Où | Aujourd'hui |
|---|----|-------------|
| 1 | NEXUS-Radar-Manager-v1.html:177-182, 229, 234 | `calculerEquipe` → axe « Équipe » du radar à 8 axes, valeur 0–100 |
| 2 | NEXUS-Radar-Manager-v1.html:243-253 | `couleurStatut` : Sain ≥70 / À surveiller ≥40 / À agir <40 ; compteurs « n sains », « n à agir » du verdict |
| 3 | nexus-app-donnees.js:87-100 | `equipeScore` renvoyé à l'accueil |
| 4 | nexus-boussole-moteur.js:49-53 + NEXUS-App-v1.html:1851, 1887 | `statutEquipe(equipeScore)` : Sous contrôle ≥90, À surveiller ≥70, À corriger. Carte « Équipe » de l'accueil |
| 5 | nexus-brief-donnees.js:744-762 | `equipeScore` passé à `domaineEquipe` du Brief |
| 6 | nexus-secteurs-moteur.js:581-623 (l. 596-597) | `contribMaitrise = equipeScore − 50` → `valeur` du secteur Équipe → entre dans l'Indice Boussole global |
| 7 | nexus-rapport-direction-moteur.js:167, 790-805, 408-409 | chapitre Équipe : lit `tauxPonctualite` (un fait), pas le score. **Aucun score à retirer**, constat « ponctualité < 85 % » conservé |
| 8 | NEXUS-Progression-v1.html:546, 583 ; nexus-progression.js:420-542 | `statutPonctualiteVal` : statut par collaborateur, pas le score d'équipe. Hors périmètre |
| 9 | nexus-risques-donnees.js:547 | signal `ponctualite_recurrente` par collaborateur : fait, conservé |

Aucun autre écran (Résultats Équipe, Cockpit) n'affiche de note de ponctualité d'équipe.

## 2. Avant / après
- **Radar Manager** — avant : axe Équipe tracé avec une valeur et une couleur. Après : axe non tracé, étiquette « Équipe : non noté », sous-titre « données de pointage en cours de fiabilisation » ; le taux et le nombre de pointages restent lisibles au détail (niveau 3). Verdict : Équipe ne compte plus dans « sains » ni « à agir » ; le compteur « domaines pilotés » baisse d'un.
- **Accueil, carte Équipe** — avant : pastille Sous contrôle / À surveiller / À corriger. Après : pastille neutre « Non noté » ; détail inchangé (« Ponctualité mesurée sur N pointages, … »).
- **Secteur Équipe / Indice Boussole** — avant : le score pèse dans l'indice global. Après : `contribMaitrise = null`, le secteur sort du calcul du global ; le global affiche « calculé sans l'Équipe, données de pointage en cours de fiabilisation ». Même mécanique que « calculé sans la Marge, objectif non défini » (A4-1).
- **Brief** — avant : carte secteur Équipe notée. Après : carte factuelle sans note (même règle).
- **Conservés** : `tauxPonctualite`, taux d'anomalies, nombre de pointages, `collaborateursASurveiller`, signaux de risque, constat du rapport direction. Rien n'est supprimé en base ni dans le moteur de mesure ; `scoreEquipe` reste exporté mais n'est plus appelé (ou retiré avec son épreuve si Guardian le demande).

## 3. Recette (Guardian)
- E1 axe Équipe non tracé, aucune couleur de jugement ; E2 verdict Radar sans Équipe ; E3 carte Équipe de l'accueil « Non noté » avec son détail ; E4 Indice Boussole : mention « calculé sans l'Équipe … » visible, valeur globale = celle des autres secteurs ; E5 taux et collaborateurs à surveiller inchangés ; E6 Rapport direction inchangé.

## 4. Question
Livrer dans #417 (même branche, mêmes fichiers) ou dans une PR distincte ? Recommandation : dans #417, car le retrait fait partie de la condition de fusion posée par Guardian.
