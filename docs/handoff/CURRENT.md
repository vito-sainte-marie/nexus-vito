<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-CARBURANT-FIL-UNIQUE-20261029/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-CARBURANT-FIL-UNIQUE-20261029
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=f00eda7a
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 166-fichiers
---
# JAUGEAGE-CARBURANT-FIL-UNIQUE-20261029 : le jaugeage d'ouverture à un seul endroit

## Contexte
Le lot INVENTAIRE-CHAINE-INITIALISATION-20261027 est clos et consommé (decision-2, `012c2d5b`, rail `30b1f099`). Ce lot est ouvert par l'exécutant local, sous l'autorisation de reprise de Frédéric et sur son instruction du 29/10 (« j'approuve les cinq étapes »).

Constat Guardian sur Test (aperçu `production` f00eda7a, Employé Test B, poste Piste) : le jaugeage existe à deux endroits qui ne se parlent pas.
- Étape 1 du fil du pompiste (`NEXUS-Releves-Piste-v1`, `ecran=jauge`) : photo Veeder-Root et saisie des quatre volumes dans `carburant_releves`. Avec un relevé du jour, le fil saute correctement l'étape 1.
- Carte « Jaugeage carburants — ouverture » de l'Inventaire (`#carteJaugeageCarburant`) : saisie manuelle SP95, GO, GNR. Elle affiche « À faire » malgré ce relevé.

**Décision de Frédéric du 27/10 : choix A.** Le jaugeage d'ouverture se fait à un seul endroit, l'étape 1 du fil. La carte disparaît de l'Inventaire.

**Règle POSTE-006, confirmée par Frédéric le 27/10.** La caissière photographie le Veeder-Root chaque matin. Quand le pompiste du matin est un vacataire sans NEXUS, le manager saisit le jaugeage d'ouverture dans NEXUS dans la journée, à partir de cette photo, avec l'origine « manager ». Aucun autre rôle ne le saisit à sa place. À promouvoir dans `RULES.json` avec POSTE-001 à 005.

BRANCHE_DU_LOT: jaugeage-carburant-fil-unique-20261029

La branche est créée depuis `origin/production` (f00eda7a) et portera le code par une PR vers `production`. Ce n'est pas le rail.

## Périmètre proposé (aucune ligne écrite)
1. Retirer la carte et sa saisie de l'Inventaire, sans toucher aux données existantes.
2. Reprendre à l'étape 1 du fil le lien « Je ne peux pas faire le jaugeage » (`#lienJaugeageImpossible`, motif écrit dans `carburant_jaugeage_statuts_jour`), qui n'existe aujourd'hui que sur la carte.
3. Établir par lecture du code si le groupe `JAUGEAGE_NOM` (sous `modeJaugeageActif`) est encore atteignable. Lecture Guardian de Production à Sainte-Marie : aucun mode `jaugeage_actif` actif, catégorie et 4 produits inactifs. Rien à modifier en base.
4. Vérifier que `station_config.jaugeage_carburant_actif` (vrai en Production, probablement le drapeau de `resoudreJaugeageCarburant`) ne commande pas aussi l'étape 1 (`jaugeageApplicable`) : retirer la carte ne doit jamais faire disparaître l'étape 1.
5. Épreuves avec mutations : carte absente ; motif « impossible » accessible depuis l'étape 1 ; étape 1 sautée quand un relevé du jour existe.
6. Promouvoir POSTE-006 dans `RULES.json` et reprendre l'origine « manager » (à établir par lecture du code : ce qui existe déjà, ce qui manque).
7. Recette Guardian sur Test avant le GO de fusion. Recette en Production le mardi 3 novembre, avec la photo.

## Calendrier
La livraison doit être fusionnée avant le lundi 2 novembre, sur le GO de Frédéric. La fusion et le déploiement restent à son palier.

## À arbitrer
1. Le périmètre ci-dessus est-il le bon, notamment le point 6 (POSTE-006 et origine « manager »), qui touche une règle métier ?
2. Faut-il livrer d'un seul bloc ou séparer le retrait de la carte (point 1) du transfert du lien « impossible » (point 2), pour qu'aucun jour ne laisse le cas « impossible » sans porte ?

Aucune fusion, aucun déploiement, aucune lecture ni écriture de la Production sans le GO de Frédéric.
