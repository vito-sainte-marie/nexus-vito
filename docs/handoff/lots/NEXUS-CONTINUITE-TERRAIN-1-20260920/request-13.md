---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 13
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: LEAN
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=a786408 production=2bc7b39
  - id: verifier-0-echec
    classe: VERIFIED
    valeur: 31_lots_15_avertissements_10_derogations_0_echec
  - id: consommer-local-preuve
    classe: VERIFIED
    valeur: mecanisme_prouve_commit_local_pas_canonique
  - id: consommer-canonique-reel
    classe: NOT_APPLICABLE
    valeur: aucune_ecriture_possible_sur_handoff-continuite-20260920_patch_fourni
  - id: decision-12-non-reecrite
    classe: VERIFIED
    valeur: identique_octet_pour_octet_a_git_show_canonique
---
# Dérogations de forme sur decision-12.md, consommation, et obstacle d'intégration

## 1. Ce qui a été fait

Les 4 défauts annoncés par le réveil ont été revérifiés avant toute écriture et sont
exactement ceux attendus, sans surprise :

- `SEQUENCE_NON_CONTIGUE` — decision-12.md suit decision-9.md, decision-10.md et
  decision-11.md n'existent nulle part.
- `DECISION_HORS_VOCABULAIRE` — `decision: GO_RATIFICATION` n'appartient pas à
  `APPROVED|APPROVED_WITH_CONDITIONS|BLOCKED|NEEDS_EVIDENCE`.
- `CLOSES_INVALIDE` — `closes` est absent de l'enveloppe.
- `IN_REPLY_TO_MANQUANT` — `in_reply_to` est absent de l'enveloppe.

4 dérogations ciblées ont été ajoutées à `STATE.json.derogations`, chacune nommant le lot ET
le fichier (`NEXUS-CONTINUITE-TERRAIN-1-20260920/decision-12.md`), sans renommer ni réécrire
`decision-12.md`. Verdict retenu pour chaque défaut, tiré du corps de la décision lui-même et
du précédent direct `decision-9.md` du même lot (même auteur, même famille de « GO ») :

- `DECISION_HORS_VOCABULAIRE` → **APPROVED** (le corps ne pose aucune condition nouvelle au-delà
  des invariants déjà en vigueur — Production/Supabase/merge — restatés, pas ajoutés).
- `CLOSES_INVALIDE` → **closes=false** (« Le Handoff peut poursuivre sur le rail canonique... »).
- `IN_REPLY_TO_MANQUANT` → `in_reply_to=request-12.md` posé via `valeur_retenue`, le mécanisme
  prévu par `outils/handoff.js` pour ce code précis — c'est le champ que `consommer`,
  `reveil-handoff.js` et `reveil-orchestrateur.js` lisent réellement, pas seulement un
  avertissement en prose.

Autorité : ces 4 dérogations relèvent de la pré-autorisation `CLAUDE.md` — « Déroger à un
défaut de FORME d'enveloppe Handoff sur un fichier déjà publié » —, les quatre conditions
cumulatives étant remplies : `decision-12.md` n'est ni renommé ni réécrit ; chaque dérogation
nomme le lot ET le fichier ; le motif dit la cause réelle (numérotation reprise sur le rang de
la demande, vocabulaire non canonique mais corps sans ambiguïté, champs simplement omis) ;
chaque dérogation reste imprimée à voix haute par `verifier` à chaque exécution — elles ne font
disparaître aucun écart.

`node outils/handoff.js verifier` : **0 échec, 31 lots, 15 avertissements, 10 dérogations**
(6 préexistantes + les 4 ci-dessus). Aucun des 4 codes ciblés n'a produit d'échec résiduel.

## 2. Consommation — prouvée localement, pas encore réelle sur le rail canonique

`node outils/handoff.js consommer NEXUS-CONTINUITE-TERRAIN-1-20260920` a réussi dans cette
session : `statut=DECISION_CONSOMMEE`, `derniere_decision=decision-12.md`.

**Ceci est une preuve du mécanisme, pas la consommation canonique elle-même.** Ce checkout est
resté 38 commits en retard sur `handoff-continuite-20260920` (HEAD réel du rail :
`8cfe873f37c6727dde31ee74f2bf3f7923a0a277`, vérifié identique à celui annoncé par le réveil).
`git fetch`, `git checkout <ref>`, `git merge`, `git reset` vers ce rail sont tous refusés dans
ce canal (approbation requise, indisponible en run automatisé) — seul `git show <ref>:<chemin>`
(lecture seule) fonctionne. J'ai donc matérialisé fichier par fichier, via cette seule voie de
lecture, le contenu réel de `outils/handoff.js`, `docs/handoff/PROTOCOL.md` et les 22 fichiers
`request-*.md`/`decision-*.md` du lot tels qu'ils vivent sur `handoff-continuite-20260920`,
pour pouvoir exécuter le validateur pour de vrai plutôt que le tracer à la main. `decision-12.md`
n'existait donc, dans l'historique Git de CE checkout, que depuis le commit que j'ai moi-même
produit ici — `consommer` a donc enregistré `commit_decision` = ce commit local, **pas**
`653bf59392e94e20214483802d4ca6d881fd15d8` cité par le réveil comme le vrai commit canonique.

**Ce n'est pas une divergence de fond** : sur la branche réelle, `decision-12.md` est déjà
committé exactement à `653bf59392e94e20214483802d4ca6d881fd15d8` (vérifié :
`git merge-base --is-ancestor 653bf593... origin/handoff-continuite-20260920` réussit). Le jour
où les 4 dérogations ci-dessus sont ajoutées à `STATE.json` **sur** `handoff-continuite-20260920`
et que `consommer` y est rejoué, l'outil lira `git log -- decision-12.md` sur cette branche réelle
et enregistrera automatiquement `commit_decision=653bf593...` — sans que quiconque ait besoin de
l'écrire à la main. Je ne l'ai pas fabriqué ici pour éviter d'enregistrer une consommation que je
ne peux pas garantir.

## 3. Patch minimal exact pour l'intégration réelle

Le seul delta qui manque réellement à `handoff-continuite-20260920` est l'ajout des 4 objets de
dérogation ci-dessous à `STATE.json.derogations` (rien d'autre — `outils/handoff.js`,
`decision-12.md`, `request-12.md` y sont déjà corrects et inchangés) :

```json
{
  "fichier": "NEXUS-CONTINUITE-TERRAIN-1-20260920/decision-12.md",
  "regle": "SEQUENCE_NON_CONTIGUE",
  "motif": "decision-12.md est numérotée 12 alors que la dernière décision réellement déposée dans ce lot est decision-9.md : decision-10.md et decision-11.md n'ont jamais existé, aucun commit ne les porte. Défaut de FORME seulement : Frédéric, auteur de la décision, a repris le rang de la demande qu'il arbitre (request-12.md) comme numéro de décision, au lieu de poursuivre la série des décisions. Le fichier n'est ni renommé ni réécrit : le retitrer decision-10.md fabriquerait après coup une numérotation qu'il n'a jamais portée, exactement ce que l'append-only interdit. La décision reste donc la 10e décision réelle du lot sous le nom decision-12.md.",
  "autorise_par": "Claude — pré-autorisation CLAUDE.md, section « Pré-autorisations », point 2 (dérogation de FORME sur une enveloppe Handoff déjà publiée ; ni renommage ni réécriture, lot et fichier nommés, motif réel, dérogation imprimée à chaque exécution)",
  "le": "2026-09-22"
},
{
  "fichier": "NEXUS-CONTINUITE-TERRAIN-1-20260920/decision-12.md",
  "regle": "DECISION_HORS_VOCABULAIRE",
  "motif": "L'enveloppe porte `decision: GO_RATIFICATION`, absent du vocabulaire canonique (APPROVED|APPROVED_WITH_CONDITIONS|BLOCKED|NEEDS_EVIDENCE). Défaut de FORME seulement — le corps est sans ambiguïté : « GO ratification. Je ratifie l'équivalence applicative documentée par request-11 §1 à §3, corrigée et complétée par request-12. » Le même corps précise que cette ratification n'autorise aucune nouvelle écriture Production, aucune migration, aucun merge/promotion ni déploiement — ce sont les invariants déjà en vigueur, restatés, pas des conditions nouvelles ; le verdict équivaut donc à APPROVED, comme decision-9.md (« GO Créateur », même lot) l'a déjà posé pour un GO comparable assorti de ses propres conditions en prose. Verdict retenu : APPROVED. Le fichier n'est ni renommé ni réécrit.",
  "autorise_par": "Claude — pré-autorisation CLAUDE.md, section « Pré-autorisations », point 2 (dérogation de FORME sur une enveloppe Handoff déjà publiée ; ni renommage ni réécriture, lot et fichier nommés, motif réel, dérogation imprimée à chaque exécution)",
  "le": "2026-09-22"
},
{
  "fichier": "NEXUS-CONTINUITE-TERRAIN-1-20260920/decision-12.md",
  "regle": "CLOSES_INVALIDE",
  "motif": "L'enveloppe ne porte aucun champ `closes`. Défaut de FORME seulement — le corps dit explicitement : « Le Handoff peut poursuivre sur le rail canonique handoff-continuite-20260920, avec NEXUS_BASE_BRANCH=handoff-continuite-20260920, conformément à la Bible, à la gouvernance et aux décisions déjà établies. » « Poursuivre » désigne sans ambiguïté un lot qui reste ouvert, exactement comme decision-9.md du même lot (`closes: false`) pour le même auteur sur le même sujet de fond. Verdict retenu : closes=false. Le fichier n'est ni renommé ni réécrit.",
  "autorise_par": "Claude — pré-autorisation CLAUDE.md, section « Pré-autorisations », point 2 (dérogation de FORME sur une enveloppe Handoff déjà publiée ; ni renommage ni réécriture, lot et fichier nommés, motif réel, dérogation imprimée à chaque exécution)",
  "le": "2026-09-22"
},
{
  "fichier": "NEXUS-CONTINUITE-TERRAIN-1-20260920/decision-12.md",
  "regle": "IN_REPLY_TO_MANQUANT",
  "motif": "L'enveloppe ne porte aucun champ `in_reply_to`. Défaut de FORME seulement — au moment du dépôt de decision-12.md, la demande active du lot était request-12.md (la plus récente, déposée par Claude), et le corps de la décision cite explicitement « request-11 §1 à §3, corrigée et complétée par request-12 » comme objet de l'arbitrage. Le fichier n'est ni renommé ni réécrit ; la valeur retenue ci-dessous restitue la désignation que le corps porte déjà en prose, dans le champ que les outils de consommation et de réveil lisent réellement.",
  "autorise_par": "Claude — pré-autorisation CLAUDE.md, section « Pré-autorisations », point 2 (dérogation de FORME sur une enveloppe Handoff déjà publiée ; ni renommage ni réécriture, lot et fichier nommés, motif réel, dérogation imprimée à chaque exécution)",
  "le": "2026-09-22",
  "valeur_retenue": {
    "in_reply_to": "request-12.md"
  }
}
```

Commandes exactes, depuis une session avec écriture réelle sur `handoff-continuite-20260920` :

```
git fetch origin claude/issue-28-20260922-0605 handoff-continuite-20260920
git checkout -b lot/continuite-terrain-decision-12-derogations origin/handoff-continuite-20260920
# coller les 4 objets JSON ci-dessus dans docs/handoff/STATE.json → derogations (append, ne rien réécrire ailleurs)
node outils/handoff.js verifier    # doit passer à 0 échec, 4 nouvelles dérogations imprimées
node outils/handoff.js consommer NEXUS-CONTINUITE-TERRAIN-1-20260920
# doit enregistrer commit_decision=653bf59392e94e20214483802d4ca6d881fd15d8 automatiquement
git add docs/handoff/STATE.json docs/handoff/CURRENT.md docs/handoff/DECISION.md
git commit -m "handoff: dérogations de forme decision-12.md, consommation NEXUS-CONTINUITE-TERRAIN-1-20260920"
git push origin lot/continuite-terrain-decision-12-derogations:handoff-continuite-20260920
```

## 4. Preuves

- `refs-protegees` (ci-dessous, calculée par l'outil au moment du dépôt de ce fichier).
- `verifier-0-echec` : VERIFIED — sortie complète ci-dessus, 0 échec, 4 défauts convertis en
  avertissement, 10 dérogations au total.
- `consommer-local-preuve` : VERIFIED — mécanisme prouvé dans ce checkout matérialisé
  (`commit_decision` local, pas le commit canonique — voir §2).
- `consommer-canonique-reel` : NOT_APPLICABLE — aucune écriture possible sur
  `handoff-continuite-20260920` depuis ce canal ; patch exact fourni en §3.
- `decision-12-non-reecrite` : VERIFIED — `decision-12.md` matérialisé est identique octet pour
  octet au contenu lu via `git show origin/handoff-continuite-20260920:...` ; aucune écriture
  dessus dans cette session.

## 5. Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion/autorisation
de déploiement Production, aucun nouveau scope produit/UX/sécurité. `decision-12.md` n'a été ni
renommé ni réécrit. Rien de plus que la réparation mécanique du rail Handoff n'a été entrepris
dans ce lot.
