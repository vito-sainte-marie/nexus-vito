---
protocol: nexus-handoff/2
kind: decision
lot_id: GOUVERNANCE-REFERENCE-CODE-20261005
seq: 3
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-3.md
---
# Décision — GO request-3 ratifié ; mandat d'enchaînement conditionnel ouvert

`APPROVED_WITH_CONDITIONS`, `closes: false`, en réponse à `request-3.md`.

Frédéric a donné le GO explicite (« go request 3, demande lui de te
déclencher et accepte les request si pas d'anomalie ») le 06/10/2026, dans
l'issue #28, sur la base du constat mesuré par `request-3.md` : transport des
deux commits de `decision-2.md` déjà intégré au rail (vérifié, pas supposé —
voir §1), refs protégées inchangées (`main=d6093b7`, `production=c259476`),
rouge CI `37356858235` requalifié par mesure locale (`296/305`, `4/4` preuve
causale), run GitHub Actions réel toujours `HUMAN`.

## 1. Vérification de l'état canonique avant arbitrage

Revérifié dans ce réveil, sans confiance aveugle dans `request-3.md` :

- HEAD canonique au départ = `origin/handoff-continuite-20260920` =
  `40a064c75e05a8fa16e0bcb5e70aa8f674ece1bf`. Le blob de `request-3.md` à
  cette révision (`cd9996af77f0059f4c006ed8044f1f9cbc655975`) est identique à
  celui déclaré par le mandat — aucune divergence.
- `origin/main` = `d6093b76519826c4f820e00f5bca9fb8148b1f96`, `origin/production`
  = `c259476fa51e46f3b30fdd93918f2f78b88aec04` — identiques aux valeurs
  déclarées par `request-3.md` et par le mandat. Aucun mouvement de Production
  ou de `main`.
- `node run-tests.js` : **296/305**, les 9 échecs strictement identiques à
  `docs/qa/ECHECS-CONNUS.json` — 0 régression, rejoué réellement sur ce HEAD.
- `node outils/verifier-apprentissage.js` : conforme, 21 règles, aucun
  doublon, aucune récurrence non promue.
- `node outils/guardians-router.js` : 0 finding sur le diff du dernier commit
  du rail avant ce réveil (dépôt de `request-3.md`, scopes
  `orchestrator`/`handoff`).
- `node outils/handoff.js verifier` : conforme avant tout dépôt (36 lots, 16
  avertissements — tous préexistants —, 11 dérogations, 0 nouvelle erreur).

**Aucune anomalie, aucune divergence inattendue, aucun nouveau rouge, aucune
contamination de périmètre, aucune preuve bloquante manquante autre que le
point déjà classé `HUMAN` (§2) n'a été trouvée.** Les conditions d'arrêt du
mandat de Frédéric ne sont donc pas réunies.

## 2. Run GitHub Actions réel — toujours HUMAN, non fabriqué

Conformément au point 2 du mandat (« geste minimal... uniquement si
techniquement permis par ce canal et sans contourner une protection ») :
`gh auth status` a été retenté dans ce réveil et reste bloqué par une
approbation qu'aucun humain ne peut donner dans ce run automatisé ; un essai
réseau direct (`curl` vers `api.github.com`) est bloqué de la même façon.
Aucun contournement du bac à sable n'a été tenté. **La gate CI réelle reste
`HUMAN`** — à obtenir par une session disposant d'un accès réseau/`gh`
fonctionnel, sur le HEAD intégré résultant de ce lot.

## 3. Mandat d'enchaînement conditionnel — ratifié tel que transmis

Le mandat de Frédéric (issue #28, 06/10/2026) autorise la poursuite autonome
du cycle Handoff pour ce lot tant qu'aucune des conditions d'arrêt qu'il
énumère n'apparaît (nouveau rouge inexpliqué, mouvement inattendu de
`main`/`production`, conflit/non-fast-forward, changement applicatif non
prévu, gate/preuve bloquante absente, opération Supabase en écriture, geste
Production, décision métier nouvelle ou élargissement de périmètre). Cette
décision matérialise ce GO dans le registre ; elle ne l'étend à aucun autre
lot et n'autorise aucun geste Production.

## Interdictions (inchangées)

Aucune fusion Production, aucun déploiement Production, aucune
migration/écriture/réparation Production, aucune mutation Supabase
Production, aucune autorisation implicite de promotion Production. Les 20
migrations rail-only restent hors décision. Tout mouvement inattendu de
Production, divergence du rail, contamination applicative ou nouvel échec CI
inexpliqué impose un **STOP** immédiat et un retour à l'arbitrage explicite
de Frédéric.
