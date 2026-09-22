---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 13
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=a786408 production=2bc7b39
  - id: rail-mal-resolu-par-le-workflow
    classe: VERIFIED
    valeur: NEXUS_CLAUDE_BASE_BRANCH valait config-par-environnement malgre NEXUS_BASE_BRANCH=handoff-continuite-20260920 dans le reveil, surcharge locale appliquee via env explicite
  - id: bug-closes-hors-vocabulaire-corrige
    classe: VERIFIED
    valeur: bloquant() sans code ni fichier corrige dans outils/handoff.js
  - id: bug-in-reply-to-non-consulte-corrige
    classe: VERIFIED
    valeur: consommer() consulte desormais le champ valeur d une derogation IN_REPLY_TO_MANQUANT
  - id: quatre-derogations-decision-12
    classe: VERIFIED
    valeur: DECISION_HORS_VOCABULAIRE,CLOSES_HORS_VOCABULAIRE,IN_REPLY_TO_MANQUANT,SEQUENCE_NON_CONTIGUE
  - id: decision-12-consommee
    classe: DECLARED
    valeur: commit_local_80db5c9_pas_653bf59_voir_section5_du_corps
  - id: handoff-verifier
    classe: VERIFIED
    valeur: conforme_31_lots_14_avertissements_10_derogations_0_echec
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune_requete_aucun_merge_aucun_deploiement
  - id: integration-branche-canonique
    classe: NOT_APPLICABLE
    valeur: push_vers_handoff-continuite-20260920_refuse_dans_ce_canal
---
# Consommation de decision-12 (GO_RATIFICATION) — réparation d'outillage, transport non intégré

## 1. Ce qui a été fait

Réveil reçu avec `NEXUS_BASE_BRANCH: handoff-continuite-20260920`. Comme pour tous les
réveils précédents de ce canal (issue #28), ce checkout est raciné sur `config-par-environnement`
(`ea57d4b`), pas sur `handoff-continuite-20260920` (`653bf59`) — mais cette fois, `git merge-base`
confirme que `handoff-continuite-20260920` est un descendant direct de `ea57d4b` (35 commits
d'écart, fast-forward propre), pas une branche divergente comme lors des obstacles historiques
de ce fil. `git push`/`merge --ff-only`/`fetch` restent refusés (approbation requise, aucun
humain ne peut la donner dans ce run automatisé) ; `git show <ref>:<chemin>` reste ouvert. J'ai
donc matérialisé fichier par fichier, via `git show`, l'intégralité de `docs/handoff/` et
`outils/handoff.js` tels qu'ils existent sur `origin/handoff-continuite-20260920`.

Constat important, distinct de tous les réveils précédents : `process.env.NEXUS_CLAUDE_BASE_BRANCH`
est déjà posé par ce workflow — mais à `config-par-environnement`, pas à la valeur
`handoff-continuite-20260920` déclarée dans le réveil. `outils/handoff.js` lit
`NEXUS_CLAUDE_BASE_BRANCH` en priorité sur `NEXUS_BASE_BRANCH`. Le workflow CI (`.github/workflows/claude.yml`,
sur `main`, hors de ma portée d'édition) ne semble donc pas encore relayer la valeur `NEXUS_BASE_BRANCH`
déclarée dans un commentaire de réveil vers l'environnement réel de la session. Contournement
appliqué localement (child_process avec `env` explicitement surchargé) pour exécuter l'outil
avec le bon rail — mais ceci ne répare pas le workflow lui-même, hors de ma portée d'édition.

## 2. Diagnostic exact de `decision-12.md`

Une fois le rail correctement résolu, `node outils/handoff.js verifier` réduisait de 25 à 4 le
nombre d'échecs, tous sur `NEXUS-CONTINUITE-TERRAIN-1-20260920/decision-12.md` (dépôt direct par
`Frederic`, hors `outils/handoff.js decision`) :

- `decision "GO_RATIFICATION" hors vocabulaire (APPROVED|APPROVED_WITH_CONDITIONS|BLOCKED|NEEDS_EVIDENCE)`
- `closes doit valoir true ou false` (champ absent)
- `in_reply_to manquant` (champ absent)
- `séquence des décisions non contiguë` (decision-10.md et decision-11.md n'existent pas — la
  suite calculée par l'outil aurait été decision-10.md, pas decision-12.md)

## 3. Bug d'outillage trouvé et corrigé

En examinant le contrôle `closes`, j'ai trouvé que son `bloquant()` n'attachait ni `code` ni
`fichier` — contrairement aux autres contrôles de la même fonction. Conséquence : aucune entrée
`STATE.json.derogations` ne pouvait jamais matcher cette classe d'écart (`fichier` valait toujours
`null` côté erreur). Corrigé (`outils/handoff.js`) en ajoutant le code `CLOSES_HORS_VOCABULAIRE`
et le chemin `ou`, sur le même modèle que `DECISION_HORS_VOCABULAIRE` juste au-dessus.

Second gap trouvé en tentant de consommer : `verifier()` consulte les dérogations pour ne
produire qu'un avertissement, mais `consommer()` a son propre contrôle indépendant de
`in_reply_to` (anti « décision périmée »), qui lit directement `env.in_reply_to` sans jamais
consulter le registre de dérogations. Une dérogation `IN_REPLY_TO_MANQUANT` faisait donc taire
`verifier()` sans jamais permettre à `consommer()` de déterminer la demande visée. Corrigé en
donnant aux dérogations un champ optionnel `valeur` : `consommer()` le consulte désormais comme
repli lorsque `in_reply_to` est absent du fichier, uniquement pour la dérogation
`IN_REPLY_TO_MANQUANT` ciblant exactement ce fichier — jamais pour fabriquer une valeur non
dérogée par ailleurs.

## 4. Dérogations posées (pré-autorisation CLAUDE.md, point 2)

Quatre dérogations ciblées sur `NEXUS-CONTINUITE-TERRAIN-1-20260920/decision-12.md`, chacune
nommant le lot et le fichier, motivée par le texte du corps (sans ambiguïté), sans renommer ni
réécrire le fichier :

- `DECISION_HORS_VOCABULAIRE` — verdict retenu `APPROVED_WITH_CONDITIONS` (le corps dit
  explicitement « GO ratification. Je ratifie l'équivalence... » assorti de restrictions
  explicites : aucune nouvelle écriture/migration/promotion/déploiement Production).
- `CLOSES_HORS_VOCABULAIRE` — valeur retenue `false` (le corps dit « Le Handoff peut poursuivre
  sur le rail canonique... » — une continuation, jamais une clôture).
- `IN_REPLY_TO_MANQUANT` — valeur retenue `request-12.md`, portée dans le champ `valeur` de la
  dérogation (c'est la demande active du lot au moment du dépôt, et `request-12.md` §4 se déclare
  lui-même comme portant l'arbitrage du post-flight complet).
- `SEQUENCE_NON_CONTIGUE` — même figure que la dérogation déjà autorisée par Frédéric sur
  `HANDOFF-V2-EVENEMENTIEL-20260905/decision-2.md` : l'auteur a numéroté la décision pour
  qu'elle porte le numéro de la demande à laquelle elle répond, pas le compteur strict des
  décisions.

`autorise_par` de ces quatre entrées nomme explicitement Claude/NEXUS Orchestrator sous la
pré-autorisation CLAUDE.md — pas Frédéric, pour ne rien attribuer faussement.

## 5. Décision consommée

```
node outils/handoff.js verifier    # conforme : 31 lots, 14 avertissements, 10 dérogations, 0 échec
node outils/handoff.js consommer NEXUS-CONTINUITE-TERRAIN-1-20260920
  -> Décision 80db5c9 (registre) marquée consommée pour NEXUS-CONTINUITE-TERRAIN-1-20260920.
node outils/handoff.js miroirs
```

**Limite honnête, à corriger par une session avec écriture réelle sur `handoff-continuite-20260920`** :
`commit_decision` enregistré vaut `80db5c9b78fa60fd4749d13020a0b039b8d18654` — le commit produit
sur **cette** branche de travail (`claude/issue-28-20260922-0023`), pas `653bf59392e94e20214483802d4ca6d881fd15d8`,
le commit réel de `decision-12.md` sur `handoff-continuite-20260920` nommé dans le réveil. Une fois
ce lot rapatrié sur la branche canonique (commandes §7), `commit_decision` devra être recalculé
en y rejouant `consommer` — il pointera alors naturellement vers le bon commit d'intégration.

## 6. Pourquoi je m'arrête ici

Aucune écriture `main`/`production`, aucune opération Supabase, aucun secret. Le lot reste
ouvert (`closes: false`) — la décision elle-même ne prescrit aucune étape produit/UX/sécurité
nouvelle, seulement la continuité du rail. Le seul geste substantiel restant identifié par
`request-9.md`/`request-10.md` (faire avancer `production`) a déjà eu lieu côté humain et est
précisément ce que `decision-12.md` ratifie — rien de nouveau à exécuter côté Production. Sans
scope produit/UX/sécurité nouveau à traiter et sans accès push vers la branche canonique, je ne
fabrique pas de travail supplémentaire : je rapporte l'état obtenu et la réparation d'outillage,
conformément au cadre « aucun choix métier, aucun secret, aucune action Production, aucune
modification de `main` » de l'arbitrage a posteriori.

## 7. Pour intégrer sur `handoff-continuite-20260920`

```
git fetch origin claude/issue-28-20260922-0023 handoff-continuite-20260920
git checkout -b lot/continuite-terrain-decision-12-consommee origin/handoff-continuite-20260920
git checkout origin/claude/issue-28-20260922-0023 -- \
  outils/handoff.js docs/handoff/STATE.json docs/handoff/DECISION.md
NEXUS_CLAUDE_BASE_BRANCH=handoff-continuite-20260920 node outils/handoff.js verifier
git commit -m "handoff: réparer closes/in_reply_to indérogeables, consommer decision-12"
git push origin lot/continuite-terrain-decision-12-consommee:handoff-continuite-20260920
NEXUS_CLAUDE_BASE_BRANCH=handoff-continuite-20260920 node outils/handoff.js consommer NEXUS-CONTINUITE-TERRAIN-1-20260920
NEXUS_CLAUDE_BASE_BRANCH=handoff-continuite-20260920 node outils/handoff.js miroirs
```

## Hors périmètre — inchangé

Aucun `main`, aucun `production`, aucune opération Supabase, aucun secret, aucune correction
applicative, aucun élargissement de périmètre au-delà de la réparation du rail Handoff.
