---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-HEURES-VERIFY-PAYE-1-20261009
seq: 12
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=c516322 production=e5276c5
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 147-fichiers
  - id: pr107-tete
    classe: VERIFIED
    valeur: 986ac6ab014c27bc349bb4e21c9bdb9a7433f2f1
  - id: pr107-ci
    classe: VERIFIED
    valeur: build-SUCCESS-non-regression-SUCCESS
  - id: arbitrage-q4-b
    classe: HUMAN
    valeur: relaye-par-Frederic-13-10
  - id: recette-pr107-servie
    classe: VERIFIED
    valeur: B-verifie-Q4-non-couvert-sur-Test
---
# Demande d'arbitrage — PR #107 : Q4 (case vide) et B (heures exceptionnelles), arbitrages relayés par Frédéric

Ce texte se suffit. Demande d'arbitrage seulement ; ni GO ni ordre d'exécution.

## Provenance des choix

Les deux choix ci-dessous ont été **relayés par Frédéric le 13/10/2026** après que Q4 et B lui eurent été exposées sans recommandation fermée. Ils ne sont pas de moi. Cette demande soumet leur mise en œuvre à vérification et demande le verdict d'arbitrage ; elle ne les rend pas définitifs par elle-même.

- **Q4, option C** : une case vide au planning signifie « non renseigné », jamais « repos ». La présence Verify caisse/piste est conservée, avec l'information non bloquante « Présence confirmée sans planning renseigné ». Un repos ou une absence explicites contredits par Verify restent une anomalie à arbitrer. Une case vide ne génère ni absence, ni retenue, ni heure de renfort.
- **B, option 2** : les heures exceptionnelles sont des lignes distinctes `horaire_exceptionnel`, de provenance manuelle, avec plage, motif, auteur, justification et historique. Jamais d'écrasement de Verify ni du planning, jamais de double comptage. La qualification en heures supplémentaires reste indépendante. Paye distingue normales, supplémentaires et exceptionnelles. Un planning non renseigné ne bloque pas les dossiers comptables.

## Ce que fait la PR #107 (`q4-b-heures-verify-paye-20261013` vers `production`, tête `986ac6a`, 1 commit)

- `nexus-paye-moteur.js` : sans planning connu ni statut planifié, la journée émet un item informatif `ecart_verify_planning` / `planning_non_renseigné` (non bloquant, sans impact paye). Libellé de conflit reformulé. L'item d'horaire exceptionnel porte justification, provenance (`manuelle`) et historique.
- `nexus-paye-donnees.js` : `enregistrerHoraireExceptionnel` exige une justification ; la saisie précédente est empilée dans `detail.historique` au lieu d'être écrasée. Aucune migration : `nexus_paye_items.detail` et le type `horaire_exceptionnel` existent déjà dans `20261009120000`.
- `NEXUS-Paye-v1.html` : champ « Justification » obligatoire ; tuile « Heures exceptionnelles (saisies par le manager) », durée nette déjà comprise dans les heures, jamais ajoutée.
- Aucun taux, aucune majoration, aucune retenue, aucune écriture Production.

## État mesuré

| Mesure | Valeur |
|---|---|
| PR | OPEN, CLEAN, tête `986ac6ab014c27bc349bb4e21c9bdb9a7433f2f1` |
| CI | « Construire et éprouver l'artefact » SUCCESS ; `non-regression` SUCCESS (×2) ; Cloudflare Pages SUCCESS ; Pages et Supabase Preview SKIPPED (attendu) |
| épreuves ciblées | règles SMU 30/30 ; cockpit/écarts manager 61/61 |
| suite complète en local | non lancée ; les autres épreuves `test_paye*` n'ont pas de contrôle de code de sortie fiable en local |
| recette navigateur sur l'aperçu Test de la PR | faite le 13/10 pour B ; Q4 non couvert (voir section suivante) ; pas de recette sur Production |

## Recette navigateur sur NEXUS Test (13/10, aperçu `q4-b-heures-verify-paye-2026.nexus-test-ddf.pages.dev`)

Contenu servi contrôlé (redirection 308 puis 200 ; `hxJustification` et le libellé « Présence confirmée sans planning renseigné » présents ; `nexus-config.js` vise la base Test `udljdqxerrbbbajxubfn`). Session manager de Test, écran Paye d'octobre, Employé Test A.

- **B, justification obligatoire** : saisie sans justification refusée (« Justification obligatoire »).
- **B, saisie avec justification** (13/10, 09:00–18:00, pause 60 min, 8 h nettes) : total 97 h → 98 h (+1 h, pas +8 h), heures normales 91 h → 84 h, tuile « Heures exceptionnelles (saisies par le manager) » 8 h, heures supplémentaires inchangées à 6 h. Pas de double comptage.
- **B, seconde saisie du même jour** (09:00–17:30) : la tuile passe à 7,5 h, la saisie remplace la précédente sans s'y ajouter. Lecture en base Test : une seule ligne `horaire_exceptionnel`, `provenance: manuelle`, justification, motif, auteur, date ; la première saisie est conservée dans `detail.historique`.
- **Q4 : non couvert sur Test.** Employé Test A a 0 jour mesuré par Verify et 13 reconstitués : le cas « présence confirmée sans planning renseigné » ne se produit pas avec cette donnée. Seules les épreuves unitaires (30/30) le couvrent.
- **Limite d'affichage** : l'historique n'a été constaté qu'en base ; je ne l'ai pas vu à l'écran.
- **Trace laissée dans Test** : une ligne `horaire_exceptionnel` (7,5 h, 13/10) dans `nexus_paye_items`. Rien en Production.

## Points que je ne tranche pas

1. **Q2 reste ouverte** (mois déjà validés) : cette PR ne la tranche pas, ni explicitement ni implicitement.
2. Quand aucun planning n'existe pour le mois, chaque journée Verify émet maintenant l'information « planning non renseigné ». C'est conforme à Q4-C mais bruyant en octobre. Souhaité ou à regrouper ? À arbitrer.
3. Un item `planning_non_renseigné` est informatif : il ne bloque aucun dossier, conformément à la consigne.

## Dépendances

La PR #107 modifie `nexus-paye-moteur.js` aux abords de #105 (request-10) et #106 (request-11). Ordre de fusion et rebase éventuel à confirmer par le verdict.

## Geste demandé

Verdict sur la mise en œuvre de Q4-C et B-2 ; puis, séparément, GO nominatifs de Frédéric pour la fusion de #107 et le déploiement Pages. Rien n'est fusionné ni déployé par cette demande. Aucune migration ni mutation Supabase Production n'est requise ni demandée.
