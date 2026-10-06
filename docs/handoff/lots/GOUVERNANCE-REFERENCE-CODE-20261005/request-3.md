---
protocol: nexus-handoff/2
kind: request
lot_id: GOUVERNANCE-REFERENCE-CODE-20261005
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=c259476
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7-production=c259476-inchanges
  - id: transport-decision2-consommation
    classe: VERIFIED
    valeur: commits-714b7d5-77bf42a
  - id: transport-six-commits-deja-integres
    classe: VERIFIED
    valeur: 27ca3ca-7fa73c6-1f835a0-b6ff903-fdebb7f-b25096d-presents-sur-le-rail
  - id: correctif-garde-immuabilite-rejoue
    classe: VERIFIED
    valeur: test_migrations_immuables-vert-240-migrations-point-de-divergence
  - id: preuve-causale-garde
    classe: VERIFIED
    valeur: test_garde_immuabilite_merge_base_20261005-4-sur-4
  - id: regression-suite
    classe: VERIFIED
    valeur: 296-sur-305-9-echecs-connus-inchanges
  - id: guardians-apprentissage
    classe: VERIFIED
    valeur: handoff-verifier-conforme-apprentissage-21-regles-conforme-guardians-0-finding-diff-cible
  - id: ci-run-github-reel
    classe: HUMAN
    valeur: non-declenchable-ni-observable-depuis-ce-canal-run-a-obtenir-apres-integration-rail
  - id: migrations-rail-only-hors-decision
    classe: DECLARED
    valeur: 20-non-traitees
  - id: transport-vers-rail
    classe: HUMAN
    valeur: deux-commits-pousses-sur-claude-issue-28-20261006-0015-pas-encore-fast-forward-sur-handoff-continuite-20260920
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-ecriture-aucune-migration-aucun-merge-aucun-deploiement
---
# request-3 — decision-2 consommée, rouge CI qualifié localement, run GitHub Actions réel toujours à obtenir

Fait suite à `decision-2.md` (`APPROVED_WITH_CONDITIONS`, `closes: false`),
elle-même en réponse à `request-2.md`. Périmètre exécuté dans ce réveil :
vérification de l'état canonique réel (pas de confiance aveugle dans
`request-2.md`), matérialisation et consommation de `decision-2.md` via
`outils/handoff.js` exclusivement, re-mesure locale du correctif de la
garde d'immuabilité, tentative d'observation d'un run CI réel. Aucun
fichier applicatif touché.

## 1. SHA et transport — confirmé déjà intégré, pas dupliqué

- HEAD canonique au départ de ce réveil : `17638d56a19a97ceb714ccbafa1fbc74794c6eae`
  (= `origin/handoff-continuite-20260920`, confirmé avant toute écriture).
  **Contrairement à ce que `request-2.md` §1 déclarait (« transport prouvé,
  pas encore intégré »), les six commits qu'il énumère sont déjà présents
  sur le rail** — vérifié par `git log --oneline` sur `handoff-continuite-20260920`
  lui-même, pas sur une branche `claude/issue-*` tierce : `27ca3ca`,
  `7fa73c6`, `1f835a0`, `b6ff903`, `fdebb7f`, `b25096d`, plus `17638d5`
  (dépôt de `request-2.md` lui-même). Aucun commit n'a été dupliqué.
- SHA Production observé, inchangé : `c259476fa51e46f3b30fdd93918f2f78b88aec04`
  (= `origin/production`). SHA `main` observé, inchangé :
  `d6093b76519826c4f820e00f5bca9fb8148b1f96` (= `origin/main`). Les deux
  identiques aux valeurs déclarées par `request-2.md` (preuve
  `refs-protegees`) — aucun mouvement de Production ou de `main` pendant ce
  lot.
- HEAD de ce checkout après ce réveil : `77bf42a295a20040bc3d0767d2df20d507df954c`,
  deux commits ajoutés, tous deux par `outils/handoff.js` :
  1. `714b7d5` — `decision-2.md` de ce lot (déposée via `handoff.js
     decision`, `APPROVED_WITH_CONDITIONS`, `closes: false`), matérialisant
     l'arbitrage relayé dans l'issue #28 le 06/10/2026 (« Go request »).
  2. `77bf42a` — consommée via `handoff.js consommer` + miroirs régénérés.
- **Blocage résiduel, structurel, identique à celui documenté dans ce fil
  depuis le 06/09/2026** : ce canal ne peut pousser que sur sa propre
  branche (`claude/issue-28-20261006-0015`) ; il n'a pas les moyens
  techniques d'intégrer ces deux commits sur `handoff-continuite-20260920`
  lui-même. Transport prouvé et commité, pas encore intégré au rail.
  Commandes de rapatriement en fin de ce document.

## 2. Re-qualification du rouge CI `37356858235` — mesures rejouées sur ce HEAD

Rejoué réellement (pas recopié du rapport précédent) :

- `node test_migrations_immuables_20260905.js` : vert — 240 migrations de
  Production contrôlées au point de divergence, 52 ajoutées depuis et non
  évaluées, 292 au tip courant de Production.
- `node test_garde_immuabilite_merge_base_20261005.js` : **4/4**, les
  quatre scénarios causaux confirmés.
- `node run-tests.js` : **296/305**, les 9 échecs strictement identiques à
  la liste historique tolérée (`docs/qa/ECHECS-CONNUS.json`) — 0
  régression.
- `node outils/handoff.js verifier` : conforme avant et après dépôt (36
  lots, 15 avertissements après consommation — tous préexistants —, 11
  dérogations, 0 nouvelle erreur).
- `node outils/verifier-apprentissage.js` : conforme, 21 règles, aucun
  doublon, aucune récurrence non promue.
- `node outils/guardians-router.js` : 0 finding sur le diff du dernier
  commit du rail avant ce réveil (dépôt de `request-2.md`, scopes
  `orchestrator`/`handoff`) — cohérent, ce commit ne touche aucun fichier
  applicatif. La collision `NexusStock` (dette connue ARCH-002) n'apparaît
  pas sur ce diff ciblé, mais reste documentée et non bloquante par
  construction (`|| true`) pour tout diff qui la toucherait.

## 3. Run GitHub Actions réel — toujours NON OBTENU, classé HUMAN

Conformément au point 4 de l'autorisation (« si aucun run ne peut être
obtenu, conserver explicitement la preuve CI en HUMAN/à obtenir : ne pas
déclarer la gate franchie ») : toute invocation `gh` dans ce canal
(`gh auth status`, `gh run list`) est bloquée par une approbation qu'aucun
humain ne peut donner dans ce run automatisé — confirmé à nouveau, aucun
contournement tenté. **Aucun run ID, aucune conclusion CI réelle n'a donc
été obtenu dans ce réveil.** La gate CI n'est pas qualifiée franchie ; elle
reste explicitement `HUMAN`.

## 4. Définition des autorités — inchangée depuis decision-1/request-2

- `origin/production` : autorité du code applicatif réellement servi, des
  migrations applicatives et des tests applicatifs de référence. Non
  modifié par ce lot.
- `handoff-continuite-20260920` : autorité du protocole Handoff. Les deux
  commits de ce réveil (decision-2, consommation) relèvent exclusivement de
  cette autorité.
- Les 20 migrations rail-only restent hors décision, non traitées,
  conformément au point 5 de l'autorisation de ce réveil.

## 5. Blocages restants

1. Intégration des deux commits de ce réveil sur `handoff-continuite-20260920`
   lui-même (§1, blocage structurel de canal, identique à celui qui
   affectait déjà les six commits précédents).
2. **Run CI GitHub Actions réel sur le HEAD intégré** (§3) — seul point
   encore ouvert pour clore ce lot. Prochain geste minimal recommandé :
   depuis une session avec accès réseau/`gh` fonctionnel, intégrer ce HEAD
   sur le rail (commandes ci-dessous) puis déclencher ou observer le run CI
   GitHub Actions qui en résulte, et rapporter son run ID et sa conclusion
   exacte.
3. Mécanique outillée de déclaration automatique du merge-base à l'ouverture
   d'un lot (`request-1.md` §3) : toujours non construite, reste posée pour
   un lot d'outillage séparé — non traitée dans ce réveil.

## 6. Pour intégrer depuis une session habilitée

```
git fetch origin claude/issue-28-20261006-0015 handoff-continuite-20260920
git merge-base --is-ancestor origin/handoff-continuite-20260920 origin/claude/issue-28-20261006-0015 \
  && echo "fast-forward possible"
git push origin claude/issue-28-20261006-0015:handoff-continuite-20260920
node outils/handoff.js verifier
node run-tests.js
```

**STOP. Aucun autre geste avant arbitrage sur ce retour.**
