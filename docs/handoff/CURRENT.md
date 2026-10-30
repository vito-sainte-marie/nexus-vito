<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/MENU-ACCUEIL-EMPLOYE-20261030/request-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: MENU-ACCUEIL-EMPLOYE-20261030
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=d799fa58
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 167-fichiers
---
# MENU-ACCUEIL-EMPLOYE-20261030 : request-3 — demande rectificative (option B pour l'Inventaire du renfort)

BRANCHE_DU_LOT: menu-accueil-employe-20261030

Cette demande **consigne un écart** à la condition de decision-1 (e94d6276, APPROVED_WITH_CONDITIONS, option A) sans réécrire request-1 ni request-2. Il vient de Frédéric, propriétaire de la décision produit, relayé par Guardian sur #160 (6523148647, 6523163725, 6523197391).

## Ce qui change

- **Avant (option A)** : le lien « Inventaire » du menu du renfort reste actif, tel quel.
- **Après (option B, décision finale de Frédéric, 30/10, 8 h 47)** : pour le renfort, l'entrée Inventaire est **présente, grisée, non cliquable** (`aria-disabled`, sans `href`), avec la mention **« Désactivé par le manager »**. Les libellés « bientôt disponible » des deux premiers commentaires sont remplacés par celui-ci.
- **Inchangé** : les autres postes ; le manager et le gérant gardent le lien actif ; l'exclusion `roleDuJour !== 'renfort'` et les contrôles Inventaire de l'Accueil ne sont pas modifiés ; interface seule, ni colonne ni migration ; rien en Production.

## Preuve des conditions de decision-1

Conditions de decision-1 (e94d6276), une par une, sur la branche du lot (e0d43d1d) :

1. **Implémenter l'option A** : **non tenue, par décision de Frédéric** — c'est l'objet de cette demande (option B pour le seul lien du renfort). Écart tracé ici, non silencieux.
2. **Interface seule, sans colonne ni migration** : tenue. `git diff --stat` de la branche : `NEXUS-App-v1.html`, `nexus-menu-accueil.js`, `test_menu_accueil_20261030.js`, `test_accueil_hors_service_20260918.js` ; aucun fichier de migration ni de schéma.
3. **Ne pas modifier `roleDuJour !== 'renfort'` ni les contrôles Inventaire de l'Accueil** : tenue. L'épreuve « l'App branche le menu, garde l'exclusion du renfort » vérifie `const inventaireApplicable = enService && roleDuJour !== 'renfort';`.
4. **Vérifier par tests** les entrées selon le poste, l'absence de Jaugeage et Index pour les employés, la recherche réservée aux manager et gérant : tenue. Épreuves « pompiste », « caissière », « renfort », « aucun employé n'a Jaugeage ni Index », « manager et gérant », « recherche », avec mutants tués.

## Preuves

- Poussé sur la branche du lot (PR brouillon #164) : e0d43d1d.
- `test_menu_accueil_20261030.js` : épreuve du renfort (entrée présente, sans `href`, `aria-disabled`, mention), épreuve des autres postes (lien actif, sans mention), deux mutants tués (renfort actif, mention retirée). `test_accueil_hors_service_20260918.js` : 172 verts.
- Suite complète : mêmes 7 échecs que la base, aucun de plus.

## À arbitrer

L'arbitre prend-il acte de l'écart de l'option A à l'option B, décidé par Frédéric, comme périmètre du lot ? Les conditions de decision-1 pour le reste sont respectées.
