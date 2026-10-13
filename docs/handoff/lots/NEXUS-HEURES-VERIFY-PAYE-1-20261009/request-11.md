---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-HEURES-VERIFY-PAYE-1-20261009
seq: 11
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=c516322 production=f36679f
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 147-fichiers
  - id: pr106-tete
    classe: VERIFIED
    valeur: c857f4135733e87743eba2963e640a2547ba955c
  - id: pr106-ci
    classe: VERIFIED
    valeur: build-SUCCESS-non-regression-SUCCESS
  - id: recette-pr106-servie
    classe: HUMAN
    valeur: non-faite
---
# Demande d'arbitrage — PR #106 : une présence Verify n'est pas « hors planning » sans planning

Ce texte se suffit. Demande d'arbitrage seulement ; ni GO ni ordre d'exécution.

## Constat

Dans Paye, les éléments à traiter d'une salariée présente dans Verify affichaient « Fonction prévue : absent du planning ». Cause mesurée en lecture seule : aucun planning n'est publié depuis septembre (`planning_shifts` s'arrête au 31/08, le reste est en brouillon) et le classeur de planning n'a pas d'onglet octobre. Paye comparait chaque journée Verify à un planning vide.

## Règle posée par Frédéric (13/10)

Verify fait foi. Le planning sert à rapprocher les informations et à faire remonter des anomalies. Une personne présente dans Verify le jour J ne peut pas être considérée comme hors planning quand aucun planning n'existe.

## Ce que fait la PR #106 (`paye-verify-sans-planning-20261013` vers `production`, tête `c857f41`, 1 commit, partie de `f36679f`)

- `nexus-paye-moteur.js` : la carte « hors planning » n'est plus émise quand aucun planning n'existe pour le jour et que la personne n'a aucun shift sur le mois. Les heures ne changent pas.
- Restent signalés : absente alors qu'un collègue est planifié le jour même ; planifiée d'autres jours du mois ; repos ou congé contredit par Verify ; caisse et piste le même jour ; journée de plus de 12 h ; poste introuvable.
- Quatre épreuves réalignées (lecture de `detailJours` au lieu de la carte supprimée), une ajoutée (collègue planifié, pas elle : une carte).
- Aucun taux, aucune retenue, aucune écriture Production.

## État mesuré

| Mesure | Valeur |
|---|---|
| épreuves Paye ciblées | vertes ; 17/17 simulations Paye |
| suite complète | 7 rouges inventaire/réception, identiques sur `origin/production` |
| CI de la PR | « Construire et éprouver l'artefact » SUCCESS ; `non-regression` SUCCESS (2 exécutions) ; Cloudflare Pages SUCCESS ; Pages SKIPPED (attendu) |
| recette navigateur sur URL servie | non faite |

## Effet de bord à connaître

Les décisions déjà enregistrées par le manager sur d'anciennes cartes « hors planning » ne se rattachent plus à rien : ces cartes ne sont plus générées. Les heures ne sont pas touchées.

## Geste demandé

Verdict sur la règle, puis, séparément, GO nominatifs pour la fusion de #106 et pour le déploiement Pages. Rien n'est fusionné ni déployé par cette demande. Indépendante de #105 (request-10) : les deux touchent `nexus-paye-moteur.js` à des endroits distincts.

## Hors périmètre, non tranché

Publication d'un planning d'octobre (décision de Frédéric ; rien importé ni inventé). Q4 et B restent ouvertes.
