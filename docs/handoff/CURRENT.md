<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/INVENTAIRE-CAISSE-RENFORT-20261102/request-7.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 7
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=5d9650c9
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 172-fichiers
---
# INVENTAIRE-CAISSE-RENFORT-20261102 : request-7 — L1 incrément 2 : recette validée, retouches, C4, demande d'arbitrage en vue de la fusion de #173 puis #174

## Branche du lot

BRANCHE_DU_LOT: handoff-continuite-20260920

## Objet

PR #174 (branche `claude/fil-caisse-l1-20261102`), tête ac934e7d, CI verte (non-regression, Cloudflare Pages). Cette request réunit ce qui s'est passé depuis request-6 et demande l'arbitrage de l'incrément 2 en vue d'une fusion de #173 puis #174 par Frédéric.

## Preuve des conditions de decision-4

Inchangées : fil affiché seulement si pilote + `caissiere` ; aucune catégorie ni produit créé par le code ; comptage à l'aveugle ; écritures existantes seules ; aucune migration, policy, grant ni règle d'alerte ; défaut A (RLS update_inventaire_alertes, L4a) non contourné ; changement de quart non câblé ; lectures existantes seules. Les retouches ci-dessous ne touchent que des libellés et la visibilité de deux boutons.

## 1. Décision de Frédéric (citée telle quelle, ce n'est pas une décision de l'arbitre)

Source : commentaire Guardian 6607822451 sur #160, « Décision métier de Frédéric (03/11, réponse dans la session Guardian) », qui lève le blocage `DECISION_METIER_NON_ARBITREE` de l'arbitrage de request-5 (run 41610982481) :

> « Produits du jour » = **Journaux, Pains / Sandwichs, Viennoiserie**, c'est-à-dire les catégories nommées actuelles. On n'ajoute pas « Petits articles caisse » et on ne passe pas par le profil `production_journaliere`.

`CATEGORIES_CAISSE` reste tel quel : Cigarettes, CBD, Journaux, Pains / Sandwichs, Viennoiserie. Rien n'est câblé de plus. Le filtrage par nom reste la réserve L1 acceptée à request-6 ; les identifiants stables sont cadrés en L2b.

## 2. Recette Test validée

Guardian a fait la recette sur l'aperçu Test avec Employé Test B (commentaire 6607162957) et l'a validée fonctionnellement, avec quatre retouches d'interface.

## 3. Retouches (9af5b3d5)

1. Bouton final : « Terminer ma caisse » (étape 3 non câblée).
2. Titre de catégorie : « Cigarettes · 3 sur 3 catégories », sans double numérotation.
3. Étiquette « 📍 Caisse uniquement » aux 3 endroits (+ assertion de `test_inventaire_fluidite_caissiere_20260902.js`).
4. « ‹ Précédent » et « ← Retour » masqués dans le fil caisse ; sortie par « Quitter et revenir à l'Accueil ».

`test_fil_caisse_20261102.js` : 24 contrôles ; 4 mutations (une par retouche) rougissent.

## 4. Correctif C4 (ac934e7d)

La CI de 9af5b3d5 était rouge : `test_correctifs_recette_pompiste_20261022.js`, épreuve C4, ancrait une regex sur la forme exacte `(idx === -1 || enFil()) ? ''`. La condition étant élargie par `|| filCaisseEnCours`, seul le test a été modifié (regex et ancre de mutation) ; le code de page est intact, le comportement pompiste inchangé, la mutation « compteur doublé » rougit toujours. CI de ac934e7d verte.

## Demande

1. Arbitrage de l'incrément 2 (L1) en vue d'une fusion de #173 puis #174 par Frédéric, `closes: false`.
2. Prise en compte de la décision de Frédéric ci-dessus pour request-5.

Hors demande : pas de clôture du lot ; l'entrée au fil depuis l'Accueil ou Missions (incrément 3) et le changement de quart restent à cadrer.

## Limites

Rien en Production. Aucune migration, policy, grant, secret. Suite complète : seuls les 7 échecs connus (règle `REGRESSION_PRODUIT_VS_BANC`) plus `categorie_mixte_deux_lieux` (échoue aussi sur la base 64f97ff9) ; la CI de la PR est verte.
