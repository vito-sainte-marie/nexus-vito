<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-CARBURANT-FIL-UNIQUE-20261029/request-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-CARBURANT-FIL-UNIQUE-20261029
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=d968c5a0
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 166-fichiers
  - id: merge-production
    classe: VERIFIED
    valeur: PR162=d968c5a0 pointe-lot=50ef98e3
  - id: recette-test
    classe: VERIFIED
    valeur: Guardian-conforme-30-10 commentaire-6520337922
---
# JAUGEAGE-CARBURANT-FIL-UNIQUE-20261029 : request-2 — demande de clôture

BRANCHE_DU_LOT: jaugeage-carburant-fil-unique-20261029

La decision-1 (APPROVED_WITH_CONDITIONS) a été exécutée. Le lot est implémenté, recetté sur Test, fusionné et déployé.

## Preuve des conditions de decision-1

1. **Fusion.** PR #162 fusionnée par Frédéric dans `production` : d968c5a0. La pointe du lot est 50ef98e3 (contenue dans d968c5a0). Points 1 et 2 livrés atomiquement : carte de jaugeage retirée d'Inventaire, étape 1 du fil conservée et indépendante.
2. **Épreuves avec mutations.** `test_jaugeage_fil_unique_20261029.js` : 11 épreuves, 11 mutations, vert.
3. **Recette Test, deux parties.** Faite par Guardian le 30/10, conforme (commentaire #160 6520337922). Étape 1 sautée quand un relevé du jour existe, vérifiée.
4. **Déploiement.** Guardian a vérifié le contenu servi sur app.nexusconseil.net, sans connexion ni écriture : Inventaire servi sans `carteJaugeageCarburant` ; Relevés piste servi avec le lien « impossible » et `ecrireAvecReessai`.
5. **Données de Test.** Les trois lignes créées par la recette ont été supprimées sur identifiants exacts, sous le GO de Frédéric donné en session (simulation 1+1+1 puis contrôle 0/0/0). Aucune autre donnée existante modifiée ou supprimée.
6. **Conditions respectées.** POSTE-006 appliquée avec l'origine « manager », sans nouveau choix métier ; analyse de JAUGEAGE_NOM et des drapeaux limitée à la lecture du code ; aucune opération en Production sous la decision-1 (le déploiement est le geste de Frédéric).

## Limites et suites (hors décision)

- La recette en Production avec photo est planifiée le mardi 3/11, hors de cette décision.
- La cause de l'échec du premier « Confirmer » n'est pas établie ; elle est atténuée par une nouvelle tentative après rafraîchissement de session et par un journal d'erreur structuré. Le cas « session de la veille » n'a pas pu être reproduit : couvert par revue de code.
- Restes mineurs pour un lot suivant : clé d'idempotence de la preuve dans `enregistrerJaugeageOuverturePompiste`, indicateur « Enregistrement… » (la sauvegarde dépasse 3 s).

## À arbitrer

Clore le lot JAUGEAGE-CARBURANT-FIL-UNIQUE-20261029 (closes: true).
