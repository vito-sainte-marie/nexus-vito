---
protocol: nexus-handoff/2
kind: request
lot_id: PARCOURS-POMPISTE-LOT3-INVENTAIRE-MISSIONS-20261023
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=73c88a47 production=7cbbb479
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 161-fichiers
---
# PARCOURS-POMPISTE-LOT3-INVENTAIRE-MISSIONS-20261023 : Inventaire plus rapide, Missions du pompiste, nettoyage des services de recette Test

*Déposé sur instruction de Frédéric (23/10/2026, « dépose la demande du Lot 3 » après validation du déploiement de #152). `lot_actif` vérifié avant dépôt : PARCOURS-POMPISTE-CORRECTIFS-RECETTE-20261022 est à l'état DECISION_CONSOMMEE (action prouvée par 53ba5b0e), aucun lot en statut actif. #152 est fusionnée (7cbbb479) et son déploiement validé par Frédéric. Aucun code n'est écrit avant la décision.*

## Source des constats

Diagnostic en lecture seule sur Test du 23/10 (rien modifié, rien écrit), accès `postgres` via MCP qui contourne la RLS : les temps SQL sont des temps serveur, pas ce que voit un employé. Le code a été LU, pas exécuté dans un navigateur connecté.

## Les trois volets demandés par Frédéric

1. **Inventaire : charger le plan une seule fois, paralléliser les chargements indépendants.**
   - Constaté dans le code : `NEXUS-Inventaire-v1.html` (init l.4236) et `nexus-inventaire-*-donnees.js` enchaînent environ 30 à 45 allers-retours réseau, tous en séquence. `chargerEtAppliquerPlanQuart` est appelée deux fois (à l'init puis dans `demarrerOuvertureComptage`). C'est un décompte de lecture, pas une mesure.
   - Mesuré côté serveur : la requête produits de la zone piste (6 lignes) prend 3,3 ms. Le serveur n'est pas en cause.
   - À faire : retirer le second appel de `chargerEtAppliquerPlanQuart` ; `Promise.all` sur ce qui est indépendant (zones, rôle du jour, quart employé, modes aveugle, mode de jaugeage, derniers stocks). Pas de RPC dans ce lot.
   - **Mesure : Claude Guardian chronomètre au navigateur, avant et après**, sur le même compte et le même quart. Je ne chiffre aucun gain avant cette mesure ; « 5-7 s » est le constat de Frédéric, et « 150 ms par aller-retour » une hypothèse non mesurée.
   - Épreuve : le plan n'est chargé qu'une fois à l'ouverture du comptage, et un résultat identique est obtenu (mêmes produits, mêmes quantités attendues) avant et après.
2. **Missions : déplier « disponibles » quand aucune mission obligatoire n'existe.** Aujourd'hui seul « obligatoires » est ouvert, d'où une page quasi vide pour un rôle sans obligatoire. Épreuves : sans obligatoire, « disponibles » est ouvert ; avec obligatoires, le comportement actuel est conservé.
3. **Données Test : nettoyer seulement les services de recette que j'ai créés, par un script borné** (modèle : `outils/remise-a-zero-recette-pompiste-20261022.sh`). Refus de Production et de tout projet autre que Test, simulation par défaut, `--executer` pour valider, bornes par identifiants. Les services d'Employé Test A/B créés par d'autres auteurs ne sont pas touchés ; la liste exacte des lignes est affichée avant tout retrait.

## Limites

Aucune écriture en Production, aucun déploiement, aucune fusion sans GO de Frédéric. Aucune migration prévue. Hors lot : décision sur ce que le pompiste doit voir après la prise de poste au-delà du déplié de « disponibles » ; RPC de contexte du quart ; cron `nexus-inventaire-reviews`.

## À arbitrer

1. Approuver les trois volets.
2. Exécutant à désigner (la règle provisoire interdit à Claude de prendre en charge un exécutant `github-actions-claude` sans demande explicite de Frédéric).
3. Confirmer que la mesure de Claude Guardian (avant/après) est une condition de clôture du volet 1.
