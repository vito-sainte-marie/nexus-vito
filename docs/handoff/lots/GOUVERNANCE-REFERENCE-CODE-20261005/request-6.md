---
protocol: nexus-handoff/2
kind: request
lot_id: GOUVERNANCE-REFERENCE-CODE-20261005
seq: 6
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=e45ab43
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 128-fichiers
  - id: d1-d3-rejouees
    classe: VERIFIED
    valeur: test_handoff_reference_production_20261007.js 6/6, test_handoff_v2_20260905.js 107/107, run-tests.js 0 regression (9 echecs connus inchanges)
  - id: guardians-apprentissage
    classe: VERIFIED
    valeur: guardians-router 0 finding, guardian-qa 306 epreuves 0 finding, verifier-apprentissage conforme 21 regles
  - id: ci-reelle-rail
    classe: NOT_APPLICABLE
    valeur: gh auth status requiert une approbation impossible dans ce canal issue_comment, voir corps du request
  - id: skill-fast-track-requalifie
    classe: DECLARED
    valeur: 08d1712 ajoute uniquement SKILL.md, aucun fichier applicatif ni outils/handoff.js touche
---
# request-6 — D1/D3 intégrées sur le rail, skill Fast Track requalifié, CI réelle manquante

## SHA exact du rail

`HEAD` de ce checkout = `handoff-continuite-20260920` = `08d17124d380aed0599f58f400b818aee6b9c1d7`
(`git merge-base --is-ancestor HEAD handoff-continuite-20260920` confirmé, `git diff --stat HEAD handoff-continuite-20260920` vide — aucun transport nécessaire, ce canal est déjà sur le rail).

Chaîne depuis `decision-5.md` (consommée, commit `dd33e1a7a5673f65d31aaff953021bb549e1fcfe`) :
`dd33e1a` (consommer decision-5) → `6cbefe8` (miroir) → `c646c02` (D1+D3) → `08d1712` (skill Fast Track).

## Requalification du commit `08d1712`

Conformément au skill Fast Track §« Requalification des mouvements » : `08d1712` ajoute uniquement
`docs/skills/nexus-handoff-fast-track/SKILL.md` (nouveau fichier, 136 lignes) — aucun fichier
applicatif, aucun fichier `outils/handoff.js`, aucun `docs/handoff/lots/**` touché. Mouvement attribué
(demandé explicitement par Frédéric selon le réveil de l'issue #28, requalifié comme geste canonique
volontaire du rail, pas une dérive) ; invariants intacts (`handoff.js verifier` conforme avant et après,
voir ci-dessous). Continuation Fast Track sans STOP.

## D1 + D3 — preuves rejouées fraîchement sur ce HEAD (pas recopiées du commit)

- `node test_handoff_reference_production_20261007.js` → **6/6**, dont la mutation négative réelle
  (regex `NEXUS-*.html` cassée → le compte applicatif retombe) et la dégradation propre sans
  `origin/production` résolvable.
- `node test_handoff_v2_20260905.js` → **107/107**.
- `node run-tests.js` → aucune régression, seuls les 9 échecs connus subsistent (inchangés depuis les
  lots précédents de ce fil).
- `node outils/handoff.js verifier` → conforme : **36 lots, 17 avertissements, 13 dérogations** — tous
  préexistants, 0 nouvelle erreur.
- `node outils/guardians-router.js` → 0 finding.
- `node outils/guardian-qa.js` → **306 épreuves analysées, 0 finding**.
- `node outils/verifier-apprentissage.js` → conforme, 21 règles.

Les deux preuves D1 (`merge-base`/diff applicatif) de **cette demande elle-même** ont été calculées
automatiquement par `handoff.js demande` (pas déclarées à la main) — démonstration en conditions
réelles que D1 fonctionne pour ce dépôt-ci.

## Ce qui manque encore — proof CI réelle sur le HEAD exact du rail

Conformément à `decision-5.md` §6 (« retour par request-6.md canonique avec SHA exact, **run CI réel**,
et preuves des mutations D1/D3 »), un point reste non obtenu depuis ce canal : la preuve CI réelle
(run GitHub Actions) sur le HEAD exact `08d1712` de `handoff-continuite-20260920`.

`gh auth status` (et toute invocation réseau `gh`) requiert ici une approbation qu'aucun humain ne peut
donner dans ce run automatisé (`issue_comment` sur #28) — limite de canal inchangée depuis le début de
ce fil, pas un échec du travail lui-même. Les preuves ci-dessus sont donc des **exécutions locales
réelles** sur le HEAD exact du rail, pas un run CI GitHub Actions.

Conformément à la règle anti-inertie du skill Fast Track (« une limitation d'outil/canal doit
déclencher la recherche du prochain canal autorisé, pas une demande de GO humain redondante ») : ce
n'est pas un STOP humain au sens métier — c'est une limitation de canal. Si ChatGPT dispose d'un accès
GitHub Actions autorisé, la demande est de confirmer/coller ici le run CI réel (id + verdict) sur le
commit `08d17124d380aed0599f58f400b818aee6b9c1d7` de `handoff-continuite-20260920`. À défaut d'un tel
canal, le point reste `NOT_APPLICABLE` depuis ce canal et devra être obtenu autrement avant de clore
D1/D3 au sens strict de `decision-5.md`.

## D2 / D4

Inchangés, hors périmètre de ce retour (D2 traité comme procédure par `decision-5.md`, D4 explicitement
hors périmètre de ce lot).

## Vérification des critères STOP du skill Fast Track

Aucun ne se déclenche : pas de fusion/déploiement/promotion Production ; pas de migration/écriture
Supabase Production ; pas de nouvelle décision métier (travail déjà arbitré par `decision-5.md`) ; pas
d'extension de périmètre (D1/D3 seuls, D2/D4 non touchés) ; mouvement `08d1712` attribué et requalifié
ci-dessus ; aucune régression CI nouvelle (9 échecs connus, inchangés) ; aucun conflit/non-fast-forward
(HEAD déjà égal au rail) ; aucune violation sécurité/RLS/site_id ; aucune modification applicative hors
périmètre. Le seul point en suspens (preuve CI réelle) est une limitation de canal, pas une preuve
impossible par nature — voir ci-dessus.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production, aucun
secret exposé, aucun fichier `.github/workflows/*` créé ou modifié, aucune extension de périmètre
métier non arbitrée.
