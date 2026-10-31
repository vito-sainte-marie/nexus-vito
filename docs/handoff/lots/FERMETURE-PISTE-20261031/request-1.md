---
protocol: nexus-handoff/2
kind: request
lot_id: FERMETURE-PISTE-20261031
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=e4e4c75c
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 168-fichiers
---
# FERMETURE-PISTE-20261031 : request-1 — fil de fermeture de la piste en fin de quart, avant tout code

BRANCHE_DU_LOT: fermeture-piste-20261031

## Demande de Frédéric

Spécification Guardian #160 (6536472203), maquette validée par Frédéric le 30/10 à 20 h 25, précision 6536422242. Trois écrans pour le pompiste en service :
- A, avant l'heure : ouverture réduite à une ligne, lien gris « Fermer la piste maintenant », entrée « Fermeture de la piste » dans le menu ☰ (groupe Carburant, à la place de « Relevés d'index » pour le pompiste) ;
- B, fermeture (à l'heure, par le lien ou par le menu) : bloc « Fermeture de la piste · avant HH h MM », compteur « 0 sur 2 », étape 1 index de fin de quart (fin_q1 ou fin_q2), étape 2 inventaire de clôture zone piste, un seul bouton plein « Commencer la fermeture », fil chaîné comme l'ouverture ;
- C, quart terminé : « Quart terminé. Merci [prénom] », récap réel sans valeur inventée, bouton plein « Terminer mon service », lien « Je reste encore : voir les missions ».

Le manager garde l'écran de choix. Style : celui de l'Accueil en service livré.

## Ce que cette demande fait et ne fait pas

**Aucun code.** Elle fixe le périmètre, les points ouverts et les épreuves, pour arbitrage. La PR aura pour base `production`, la request de clôture suivra la fusion, la recette est celle du Guardian, la fusion est celle de Frédéric. Aucune opération en Production de ma part sans GO.

## Preuve des conditions

- Lot précédent RELEVES-FIN-QUART-20261030 clos : decision-1 APPROVED closes:true (rail 2cd3f676), consommée avec `--cloture` (rail 14e2c43a).
- Demande explicite de Frédéric de déposer cette request après cette clôture.
- Lecture seule de `origin/production` : `nexus-station.js`, `nexus-auth.js`, `nexus-pointage-regles.js`, `NEXUS-Pointage-v1.html`, `NEXUS-Parametres-Station-v1.html`, `nexus-accueil-piste.js`.

## Ce que le code dit aujourd'hui

1. **Règle normal / étendu : elle existe.** `nexus-station.js` : `JOURS_ETENDUS = ['Thu','Fri','Sat']`, `cleHoraireDuJour(timezone, instant)` rend `etendu` ces jours-là et `normal` sinon, jugé sur le fuseau de la station. Écran Paramètres Station : « Dimanche à Mercredi » = normal, « Jeudi à Samedi » = étendu. La règle de décision vit en base (`calculer_horaires_quart`) ; le JS en est la formulation éprouvable. `nexus-carburant-moteur.js:848` lit `fin_etendu || fin_normal`, `NEXUS-Inventaire-Manager-v1` lit `fin_normal`. **Aucun appelant ne lit aujourd'hui la fin du quart pour le jour sur l'Accueil** : la fermeture proposera l'heure de fin par la même règle, sans la recopier.
2. **Écart d'heures à lever.** La spécification cite quart 1 : 12:45 / 13:45 et quart 2 : 20:05 / 22:05. Les valeurs par défaut du code sont 13:15 / 14:15 et 20:10 / 22:10, et un SQL de correction des horaires (`outils/correction-horaires-production-a-executer-par-frederic.sql`) est préparé. J'ignore si ce SQL est appliqué en Production et je ne le mesure pas sans GO. **Règle proposée : l'écran lit `station_config.horaires` du site, jamais une constante ; les chiffres de la maquette ne sont que des exemples.**
3. **« Terminer mon service » : ce que ça fait réellement.** Il n'existe aujourd'hui aucun bouton de fin de service sur l'Accueil. Le départ est un pointage (`NEXUS-Pointage-v1`, type `depart`, photo de la mise en alarme requise). Les colonnes `shifts.cloture_par` / `cloture_source` ne sont écrites que par la clôture de ménage (NEXUS `cycle_pilote`, ou le manager) et par le changement de quart. Elles ne sont pas faites pour une fin volontaire de l'employé.
   **Proposition : le bouton s'appelle « Pointer mon départ » et mène au pointage de départ existant, sans nouvelle écriture dans `shifts`.** Le libellé suit l'action. Si Frédéric préfère « Terminer mon service » avec une écriture directe, c'est une décision distincte (nouvelle source de clôture, migration, Test d'abord) que je chiffrerai à part.
4. L'Accueil du pompiste (`nexus-accueil-piste.js`) est un module pur : modèle de vue puis HTML, un lien de fil unique `filLien`. Le même principe vaut ici : un seul calcul de l'étape de fermeture, consommé par l'heure, le lien et le menu.

## Périmètre proposé

- Fil de fermeture : 1. index de fin (fin_q1 / fin_q2) ; 2. inventaire de clôture zone piste. Reprise à l'étape restante, comme l'ouverture.
- Le bloc remplace l'ouverture terminée 45 minutes avant la fin du quart du service ouvert (`quartDuJour`, jamais l'horloge pour choisir le quart ; l'horloge ne sert qu'au déclenchement du bloc).
- Trois accès, une seule cible : l'heure, le lien « Fermer la piste maintenant », l'entrée du menu.
- Écran C : récap fait uniquement de valeurs lues (heures de première et dernière étape d'ouverture et de fermeture, missions faites sur total, points du jour) ; une valeur absente est omise, jamais estimée. Sous-ligne « La piste est prête pour le quart du soir » pour le matin ; pour le soir, formule à valider par Frédéric.
- Menu : « Fermeture de la piste » (sous-titre « Index de fin, puis inventaire de clôture ») remplace « Relevés d'index » pour le pompiste ; Réception carburant reste.

## Épreuves de mutation prévues

1. Bloc de fermeture absent avant l'heure, présent après (instant injecté, fuseau de la station).
2. Lien et entrée de menu présents avant l'heure.
3. Les trois accès ont la même cible et la même étape.
4. Un seul bouton plein par écran (A, B, C).
5. Récap sans valeur inventée : une donnée retirée disparaît de la ligne, aucun repli sur un chiffre calculé.
6. Régime normal le mercredi, étendu le jeudi, jugés sur le fuseau de la station.
7. Aucune constante d'heure de fin dans le module.
8. Libellé du bouton C identique à l'action réelle.

## Limites

- Aucune migration prévue dans cette proposition.
- Je n'ai pas relu les horaires réels de Production ; la recette Guardian en tranchera.
- Le lien « Fermer la piste maintenant » avant l'heure : la maquette ne dit pas si un inventaire de clôture trop tôt est accepté par `inventaire_quarts`. À vérifier au développement sur Test.

## À arbitrer

1. Ce périmètre est-il retenu comme base d'un lot de développement ?
2. Écran C : bouton « Pointer mon départ » vers le pointage existant (recommandé), ou fin de service avec écriture dans `shifts` (lot distinct, migration) ?
3. Heures : lecture de `station_config.horaires`, sans constante (recommandé).
4. Formule de l'écran C pour le quart du soir.
