---
protocol: nexus-handoff/2
kind: request
lot_id: GOUVERNANCE-REFERENCE-CODE-20261005
seq: 4
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=c259476
  - id: decision3-consommation
    classe: VERIFIED
    valeur: commits-5f50896-9607a36
  - id: transport-sept-commits-deja-integres
    classe: VERIFIED
    valeur: 40a064c-et-ancetres-presents-sur-le-rail
  - id: regression-suite
    classe: VERIFIED
    valeur: 296-sur-305-9-echecs-connus-inchanges
  - id: guardians-apprentissage
    classe: VERIFIED
    valeur: handoff-verifier-conforme-apprentissage-21-regles-conforme-guardians-0-finding-diff-cible
  - id: ci-run-github-reel
    classe: HUMAN
    valeur: non-declenchable-ni-observable-depuis-ce-canal-run-a-obtenir-apres-fusion-pr
  - id: pr-integration-ouverte
    classe: DECLARED
    valeur: claude-issue-28-20261006-0049-vers-handoff-continuite-20260920-deux-commits-handoff-seuls
  - id: migrations-rail-only-hors-decision
    classe: DECLARED
    valeur: 20-non-traitees
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-ecriture-aucune-migration-aucun-merge-aucun-deploiement
---
# request-4 — decision-3 consommée ; PR d'intégration ouverte ; run CI réel toujours à obtenir

Fait suite à `decision-3.md` (`APPROVED_WITH_CONDITIONS`, `closes: false`),
elle-même en réponse à `request-3.md`, matérialisant le GO explicite de
Frédéric du 06/10/2026 dans l'issue #28 et le mandat d'enchaînement
conditionnel qui l'accompagne. Périmètre exécuté dans ce réveil :
vérification fraîche de l'état canonique (pas de confiance aveugle dans
`request-3.md`), matérialisation et consommation de `decision-3.md` via
`outils/handoff.js` exclusivement, tentative renouvelée d'obtention d'un run
CI réel, et — nouveau par rapport aux réveils précédents — ouverture d'une
pull request d'intégration vers le rail, mécanisme d'intégration propre
offert par ce canal plutôt qu'un transport manuel. Aucun fichier applicatif
touché.

## 1. SHA et transport

- HEAD canonique au départ de ce réveil : `40a064c75e05a8fa16e0bcb5e70aa8f674ece1bf`
  (= `origin/handoff-continuite-20260920`, confirmé avant toute écriture). Le
  blob de `request-3.md` à ce HEAD (`cd9996af77f0059f4c006ed8044f1f9cbc655975`)
  est identique à celui déclaré par le mandat de Frédéric — aucune divergence.
- SHA Production observé, inchangé : `c259476fa51e46f3b30fdd93918f2f78b88aec04`
  (= `origin/production`). SHA `main` observé, inchangé :
  `d6093b76519826c4f820e00f5bca9fb8148b1f96` (= `origin/main`). Aucun
  mouvement de Production ou de `main` pendant ce lot.
- HEAD de ce checkout après ce réveil : `9607a36fb46cb27be94fc8fb92e1f10e42af21fb`,
  deux commits ajoutés, tous deux par `outils/handoff.js` :
  1. `5f50896` — `decision-3.md` de ce lot (déposée via `handoff.js
     decision`, `APPROVED_WITH_CONDITIONS`, `closes: false`), matérialisant
     le GO de Frédéric relayé dans l'issue #28 le 06/10/2026.
  2. `9607a36` — consommée via `handoff.js consommer` + miroirs régénérés.
- **Nouveau — intégration par PR plutôt que par fast-forward manuel.** Ce
  canal ne peut toujours écrire que sur sa propre branche
  (`claude/issue-28-20261006-0049`), identique au blocage structurel
  documenté depuis le 06/09/2026. Mais cette session dispose d'un mécanisme
  d'ouverture de PR légitime (ni contournement, ni écriture directe sur une
  ref protégée) : une pull request a été ouverte depuis cette branche vers
  `handoff-continuite-20260920`. Elle ne contient que les deux commits
  Handoff ci-dessus — aucun fichier applicatif. La fusionner (fast-forward ou
  merge, au choix de qui la revoit) constitue le geste d'intégration complet ;
  aucune fusion n'a été faite par ce réveil lui-même.

## 2. Re-qualification du rouge CI `37356858235` — mesures rejouées sur ce HEAD

Rejoué réellement (pas recopié du rapport précédent), sur le HEAD canonique
avant dépôt de ce réveil :

- `node run-tests.js` : **296/305**, les 9 échecs strictement identiques à
  la liste historique tolérée (`docs/qa/ECHECS-CONNUS.json`) — 0 régression.
- `node outils/handoff.js verifier` : conforme avant et après dépôt (36
  lots, 15 avertissements après consommation — tous préexistants —, 11
  dérogations, 0 nouvelle erreur).
- `node outils/verifier-apprentissage.js` : conforme, 21 règles, aucun
  doublon, aucune récurrence non promue.
- `node outils/guardians-router.js` : 0 finding sur le diff des deux commits
  de ce réveil (scopes `orchestrator`/`handoff`) — cohérent, aucun fichier
  applicatif touché.

## 3. Run GitHub Actions réel — toujours NON OBTENU, classé HUMAN

Conformément au mandat (point 2 : « uniquement si techniquement permis par
ce canal et sans contourner une protection ») : `gh auth status` a été
retenté dans ce réveil et reste bloqué par une approbation qu'aucun humain
ne peut donner dans ce run automatisé ; une tentative réseau directe
(`curl` vers `api.github.com`) est bloquée de la même façon. Aucun
contournement du bac à sable n'a été tenté. **Aucun run ID, aucune
conclusion CI réelle n'a donc été obtenu dans ce réveil.** La gate CI reste
explicitement `HUMAN` — elle sera obtenue par le run CI GitHub Actions réel
que la fusion de la PR d'intégration (§1) déclenchera sur
`handoff-continuite-20260920`.

## 4. Définition des autorités — inchangée depuis decision-1

- `origin/production` : autorité du code applicatif réellement servi, des
  migrations applicatives et des tests applicatifs de référence. Non
  modifié par ce lot.
- `handoff-continuite-20260920` : autorité du protocole Handoff. Les deux
  commits de ce réveil relèvent exclusivement de cette autorité.
- Les 20 migrations rail-only restent hors décision, non traitées,
  conformément au mandat.

## 5. Conformité au mandat d'enchaînement conditionnel

Aucun des critères d'arrêt énumérés par Frédéric n'est apparu dans ce
réveil : pas de nouveau rouge/échec non expliqué, pas de mouvement inattendu
de `main`/`production`, pas de conflit ni de divergence de SHA (le HEAD de
départ correspondait exactement au HEAD déclaré), aucun changement
applicatif, aucune gate/preuve bloquante absente au-delà du point déjà
classé `HUMAN` depuis `decision-1.md`, aucune opération Supabase, aucun
geste Production, aucune décision métier nouvelle. Conformément au point 4
du mandat, ce réveil poursuit donc le cycle sans solliciter un nouveau GO
explicite de Frédéric, et réveille ChatGPT (issue #28) avec ce retour.

## 6. Blocages restants

1. **Fusion de la PR d'intégration** (§1) — reste à faire par qui dispose
   du droit de fusion sur `handoff-continuite-20260920` (Frédéric, ou une
   session habilitée). Lien de la PR donné séparément dans le commentaire
   d'issue qui accompagne ce dépôt.
2. **Run GitHub Actions réel sur le HEAD intégré** (§3) — seul point encore
   `HUMAN`. Prochain geste minimal : fusionner la PR, puis observer le run
   CI GitHub Actions qui en résulte sur `handoff-continuite-20260920`, et
   rapporter son run ID et sa conclusion exacte.
3. Mécanique outillée de déclaration automatique du merge-base à l'ouverture
   d'un lot (`request-1.md` §3) : toujours non construite, reste posée pour
   un lot d'outillage séparé — non traitée dans ce réveil.

## Interdictions (inchangées)

Aucune fusion Production, aucun déploiement Production, aucune
migration/écriture/réparation Production, aucune mutation Supabase
Production, aucune autorisation implicite de promotion Production à partir
de ce retour. Tout mouvement inattendu de Production, divergence du rail,
contamination applicative ou nouvel échec CI inexpliqué impose un **STOP**
immédiat et un retour à l'arbitrage explicite de Frédéric.
