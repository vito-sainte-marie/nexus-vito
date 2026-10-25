<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/PRISE-DE-POSTE-UN-ECRAN-20261025/request-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: PRISE-DE-POSTE-UN-ECRAN-20261025
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=f56edb0d production=f6b145df
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 164-fichiers
---
# PRISE-DE-POSTE-UN-ECRAN-20261025 : correctif de Frédéric (25/10, 08:10), pas de présélection

## Preuve des conditions de decision-1
decision-1 approuvait la présélection d'après le planning. Le correctif de Frédéric ci-dessous la retire de ce lot ; les conditions qui n'avaient d'objet que pour elle ne s'appliquent plus. Ce qui a été fait, et ce qui reste vrai :

- **Lecture Production** : faite en lecture seule, filtrée `vito-sainte-marie`, agrégats par statut et tache, sans identifiant ni nom d'employé, aucune mutation. Détail et résultat dans `docs/executions-lot-PRISE-DE-POSTE-UN-ECRAN-20261025.md` (commit `a7710c5`). Résultat : 335 lignes de l'été (27/07 → 31/08), **toutes non publiées**, aucune sur les 14 derniers jours.
- **Écart de condition, écrit tel quel** : la lecture avait le GO de Frédéric, mais ma seconde requête a **dépassé la condition de decision-1** : toutes les dates au lieu des 14 derniers jours, lignes non publiées incluses, au lieu des seules lignes publiées. Aucune donnée personnelle n'a été restituée, rien n'a été écrit.
- **Aucune nouvelle lecture Production** ne sera faite dans ce lot.
- `shifts.role_prevu` n'est la source d'aucune proposition de poste (maintenu).
- **Mutations** : aucune en Production. L'épreuve avec mutation de « Ma progression » (ni service, ni pointage, ni retard) est maintenue pour la construction.
- PR en brouillon vers `production`, recette Guardian sur l'aperçu, sans fusion, promotion ni déploiement (maintenu).
- Les données de planning fictives sur Test, prévues pour la présélection, ne sont plus nécessaires dans ce lot.

## Correctif de Frédéric (25/10/2026, 08:10)
1. **Pas de présélection d'après le planning dans ce lot.** Les trois cartes (Piste, Caisse, Renfort) s'affichent sans présélection. Les employés sont polyvalents.
2. Le point 2 de « Avant de commencer » (lecture du planning sur Test et en Production) est **annulé** pour ce lot.
3. **« Ma progression » reste toujours visible** en bas de l'écran. Journée terminée : « Ma progression » passe en premier avec « Votre service est terminé ». L'inversion pour les jours de repos attend le lot suivant.
4. **Règle n°4 de la partie F, remplacée par** : « Les employés sont polyvalents : sans l'option planning, aucun poste n'est présélectionné à la prise de poste. »

Tout le reste de la request-1 est inchangé : un appui sur la carte, retrait de « Deux chemins », rappel de sécurité, graphisme NEXUS, images WebP, règles 1, 2, 3 et 5, preuves. **Objectif d'appuis : 1 appui, sans présélection, en touchant sa carte.** Le périmètre A, B (sans présélection), C (sans l'inversion repos), D, E et F est celui de la request-1 ; le hors-périmètre aussi.

## Lot suivant, en fiche seulement : OPTION-PLANNING-PRISE-DE-POSTE (non déposé)
Interrupteur « Rattacher la prise de poste au planning » dans Paramètres Station, désactivé par défaut ; nouvelle colonne booléenne de `station_config`, défaut `false`, migration testée sur Test puis appliquée en Production sur GO de Frédéric. Activé : poste du jour mis en avant, jour de repos inverse l'écran. Désactivé ou planning absent : comportement de ce lot. Lecture tolérante : colonne absente ou nulle vaut désactivé. Il n'aura de sens qu'une fois le planning réellement publié dans NEXUS.

## À arbitrer
1. Ce recadrage (pas de présélection, pas de lecture Production, « Ma progression » toujours visible) convient-il ?
2. Le lot est construit sans jeu de planning fictif, PR en brouillon vers `production`, recette Claude Guardian sur l'aperçu.

Aucune fusion, aucun déploiement, aucune lecture ni écriture de la Production sans le GO de Frédéric.
