---
protocol: nexus-handoff/2
kind: request
lot_id: GOV-R2-EMPREINTE-DECISION-20261020
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=d3244d86
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 158-fichiers
---
# GOV-R2-EMPREINTE-DECISION-20261020 : mesure, épreuves et conception (réponse aux conditions de decision-1)

**Domaine :** gouvernance. **Préparé par :** Claude Code. **Nature :** preuves et conception ; aucun code, aucun workflow, aucune permission touchés.

## Pièces jointes au lot (lisibles par l'arbitre)

- `mesure-consommations-20261020.md` : condition 1.
- `epreuves-et-conception-r2.md` : conditions 2 à 5 (épreuves F1 à F8, source désignée, conception, options O1 à O3).

## Condition 1 : mécanisme mesuré

39 lots consommés depuis le 08/10 (la matrice disait 29). La CI ne consomme pas (une seule exception : un essai du 09/10, `36b78ecc`). Consommateurs : sessions Claude Code sous le compte partagé `vito-sainte-marie` (52 commits), `claude[bot]` relancé par la boucle autonome (14), `Claude Code` (2). La clôture R1 est restée seule parce que `outils/relancer-claude-ci.js` (l. 113 et 153) rend `RIEN_A_FAIRE` pour tout `closes: true`.

## Conditions 2 à 5

- Épreuves écrites avant code, source désignée = commentaire du relais lu par l'API ; F1 et F7 couvrent l'altération avec recalcul d'empreinte.
- Limites explicites : l'empreinte n'établit pas l'identité de l'émetteur ; `claude.yml` partage le jeton `github-actions[bot]`.
- Options O1 et O2 touchent le workflow d'armement et les permissions : documentées, non exécutées, arrêt (`SECRET_PERMISSION_SURFACE_SECURITE`, `ARMEMENT_BOUCLE_AU_NOM_DE_FREDERIC`).

## Décision demandée

1. Valider les épreuves F1 à F8 et la source désignée.
2. Autoriser, dans `outils/` seulement, le jeu rouge des épreuves puis l'outil de vérification (vert), sans câblage.
3. Reconnaître que le choix O1/O2/O3 revient à Frédéric, et rendre le palier correspondant si l'arbitre le juge nécessaire.
`closes: false`.

## Preuve des conditions de decision-1

1. **Mécanisme attribué.** Respectée : `mesure-consommations-20261020.md` (historique git de STATE.json, `relancer-claude-ci.js` l. 113 et 153, `tests.yml`) ; le cas R1 est expliqué par le juge `closes: true` → `RIEN_A_FAIRE`.
2. **Épreuves avant code, source indépendante.** Respectée : F1 à F8 écrites, aucun code ; F1 et F7 altèrent le texte et recalculent l'empreinte ; la comparaison porte sur le commentaire du relais lu par l'API.
3. **Empreinte ≠ identité.** Respectée : section C de `epreuves-et-conception-r2.md` ; risque `claude.yml` maintenu explicite.
4. **Mesure, épreuves, conception seulement.** Respectée : aucun workflow, permission, secret, identité, connecteur ou armement modifié ; O1 et O2 documentées, arrêt avant exécution.
5. **Consommation conçue mécanique.** Respectée : cinq conditions mécaniques (section D), aucun jugement métier.
