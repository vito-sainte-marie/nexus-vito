<!-- en-attente wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/160 -->
# DATES-COURTES-LOT5-PREVENTION-PERTES-20261122 : conception du lot 5 « Prévention des pertes »

Déposée en file d'attente le 22/11/2026 sur instruction du pilote (option 2), sans toucher au lot actif `INVENTAIRE-CAISSE-RENFORT-20261102` ni à `STATE.json`. Canal d'exécution : issue #160 (consigne Guardian, code Claude Code), PR #353 en brouillon vers `production`.

## Demande du pilote (22/11/2026, 11 h 17, 11 h 21, 11 h 22, 11 h 50)
Contre-auditer la maquette « Prévention des pertes » de NEXUS Dates courtes et produire une version améliorée pour Manager, Gérant et Créateur, puis la faire transposer par Claude Code dans la PR #353 :
1. « Priorités du jour » en tête : compteurs À traiter, À vérifier, À certifier, cliquables, calculés sur données réelles, sans doublon.
2. Liste courte des produits prioritaires : produit, EAN en détail, DLC, quantité, ancienneté, priorité, action attendue. Aucune action déclenchée automatiquement.
3. A, B, C, D conservés : A avec 0 à 7 j, 8 à 14 j indicatifs, plus de 14 j exclus, non certifiées en sous-partie ; B avec « Voir le détail des pertes », prix figé ou reconstitué, ligne sans prix jamais valorisée ; C et D avec raisons d'indisponibilité.
4. Marge en lecture secondaire par (i) : marge potentielle exposée sur A, marge théorique non réalisée sur B, formule, période, provenance des prix HT, données manquantes ; « Calcul indisponible » si prix ou nature fiscale non fiables ; jamais présentée comme perte certaine ; aucune nouvelle carte.
5. Exigence UX prioritaire : compréhension immédiate, minimum d'actions, confirmation visible, correction facile, mobile 375 et bureau 1280, Jour et Nuit, états dégradés.

## Arbitrages acquis (pilote, 22/11/2026, 11 h 28)
- C1 APPROVED : droits de certification inchangés (manager, gérant, créateur ; le renfort termine sans certifier). Aucune migration.
- C2 APPROVED : « Partiellement reconstitué » sur B, avec montant concerné et origine du prix dans le détail.
- C3 APPROVED_WITH_CONDITIONS : actions de prévention au lot 6. Le lot 5 prépare le parcours sans table ni traitement ; en version livrée, « Décider une action » est désactivé ; aucun bouton ne simule un enregistrement.

## Preuves
- VERIFIED : lot 1 en Production, migration `20261121120000` appliquée le 22/11 (md5 `c4cf02839b7c925bca42ba28bbb67bbe`), PR #352 fusionnée (`7e78868d`), mise en ligne réussie.
- VERIFIED : recette RLS du lot 1 sur Test avec comptes `authenticated` réels, 36/36 (issue #160, 7079549597).
- VERIFIED : nature fiscale de `products` HT, preuve élevée, lecture seule Production autorisée, 3 articles, 2 taux de TVA (issue #160, 7080834555).
- VERIFIED : maquettes CC de #353 revues conformes, tête `8a030408`, bannière intégrée (issue #160, 7081567265).
- DECLARED : proposition Guardian, page HTML autonome (maquette, contre-audit, avant/après, 18 cas de recette dont 16 vérifiés dans la page sur jeu fictif, 2 hors maquette). Remise à CC par le pilote ; pas encore dans le dépôt.
- HUMAN : arbitrages C1, C2, C3 et choix de l'option 2 par le pilote.

## Ce qui n'est pas prouvé
- La transposition par CC dans `outils/maquettes/dates-courtes/` n'est pas faite.
- Les deux cas hors maquette restent à jouer : permissions sur Test avec comptes réels ; compréhension des libellés par un manager sur iPhone.

## Contrat attendu
- OWNER_NEXT : Claude Code (transposition dans #353, skill `nexus-design-experience`, NEXUS-REFERENTIEL-CONCEPTION v1.0, captures Jour et Nuit à 375 et 1280, rapport `test_charte_interface.js`).
- Puis Guardian : contre-audit et recette refaits sur la version réellement intégrée, y compris les 16 contrôles de maquette, puis les deux cas restants séparément.
- STOP : aucune fusion, migration ou écriture en Production sans autorisation distincte du pilote.

## À arbitrer
Approuver la conception du lot 5 avec les arbitrages C1, C2, C3 acquis, sous les conditions UX et de recette ci-dessus.
