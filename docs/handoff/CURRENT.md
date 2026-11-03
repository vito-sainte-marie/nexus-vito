<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/INVENTAIRE-CAISSE-RENFORT-20261102/request-8.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 8
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=5751a9b0
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 174-fichiers
---
# Fermeture du soir du fil caisse : quart partagé, arbitrage requis

## Branche du lot
BRANCHE_DU_LOT: handoff-continuite-20260920

## Constat
`inventaire_quarts` est une ligne par (site, date, quart), partagée. `validerCloture()` la passe à `cloture` avec `cloture_le` pour tous. `inventaireFait` (Accueil) et `faitsInventaire().clotureFaite` jugent « clôture faite » sur ce `cloture_le`. Dans les deux ordres (caissière puis pompiste, ou l'inverse), la fermeture de l'un efface le lien de l'autre ; le comptage Q2 de la caissière n'a pas lieu si le pompiste clôture d'abord ; les produits piste restent sans alerte `cloture_incomplete` si la caissière clôture d'abord. Épreuve : « quart partagé » dans `test_fil_caisse_missions_fermeture_20261103.js`.

## État livré
Étape 3 masquée (`FERMETURE_OUVERTE = false`, 97d19c20, PR #175). Entrée Accueil/Missions et étape 2 seules. Sémantique de clôture inchangée.

## Options (règle de travail ou schéma : arbitrage de Frédéric)
a. Garder l'étape 3 masquée.
b. Règle : le pompiste ou le manager clôture le quart en dernier ; la caissière compte sa caisse avant.
c. Clôture par employé (nouveau statut ou colonne : migration).
d. Juger « clôture faite » sur le `a_valide_cloture` propre à l'employé (change la sémantique de l'Accueil).

## Preuve des conditions de decision-4
- Fil affiché seulement si `piloteCaisseCourant === true` et `roleDuJour === 'caissiere'` : épreuves pilote / non-pilote / autre rôle / inter-sites.
- Aucune catégorie ni produit nouveau ; comptage à l'aveugle (étape 3 sans `dernierStock`).
- Aucune migration, policy, grant ni règle d'alerte. Défaut A (RLS update_inventaire_alertes) non contourné.
- Changement de quart arrêté au libellé. Lectures seules de `inventaire_quart_employes`.
