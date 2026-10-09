---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PHILOSOPHIE-LANGAGE-AUDIT-1-20260908
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=501c0c7
  - id: audit-resultats
    classe: VERIFIED
    valeur: docs/nexus/AUDIT-PHILOSOPHIE-LANGAGE-RESULTATS-20260908.md, 15 principes confrontes, vocabulaire et Guardians etat reel
  - id: contradiction-fondatrice
    classe: NOT_APPLICABLE
    valeur: aucune trouvee entre decisions canoniques existantes
  - id: portee-lang-003
    classe: DECLARED
    valeur: 4810 occurrences 62 ecrans, 305 doctrine, 108 moteurs, trois portees non tranchees
  - id: bible-constitution-continuity-modifiees
    classe: NOT_APPLICABLE
    valeur: aucune ecriture sur la memoire canonique, propositions seulement
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Audit Philosophie / Bible / Vocabulaire / Langage — request-1

Répond au cadrage `docs/nexus/AUDIT-PHILOSOPHIE-LANGAGE-20260908.md` (commit `47b4600`).

Ce lot ne modifie aucune mémoire canonique. Il livre l'audit et la confrontation
des sources demandés, avec la liste des écarts et une seule question réellement
soumise à arbitrage.

## Résultat complet

`docs/nexus/AUDIT-PHILOSOPHIE-LANGAGE-RESULTATS-20260908.md` (ce commit) : matrice
des 15 principes fondateurs du cadrage confrontés à `BIBLE.md`, `NEXUS-Constitution-v1.md`
(document fondateur du 23/07/2026), `CONTINUITY.md`, Guardian Philosophie et
`RULES.json` ; état réel du vocabulaire dans le code (Conseiller NEXUS vs
Directeur d'Exploitation/Coach Terrain, autonomie X jours vs couverture,
Prêt pour Production) ; état des règles Guardian candidates face à ce qui est
déjà mécanisé (`outils/guardian-bible.js`, `outils/guardian-regles-metier.js`,
`nexus-mesure.js`) ; propositions non appliquées de mise à jour Bible/doctrine.

## Constat central

Aucune contradiction fondatrice entre décisions canoniques n'a été trouvée. Le
renommage Conseiller NEXUS → Directeur d'Exploitation/Coach Terrain est déjà
tranché par la Bible (depuis son commit fondateur, avant ce cadrage) ; le code
n'a simplement pas encore suivi — c'est une dette de propagation à tracer au
Backlog, pas un arbitrage. Deux principes du cadrage (absence ≠ zéro pour
l'affichage, décision humaine sensible non automatisée) sont déjà vrais en
pratique (`nexus-mesure.js`, corrections EVAL-001/DEBUG-001/COACH-001 du
08/09/2026) mais absents de `BIBLE.md` comme lignes explicites — proposition
d'ajout de deux phrases, non appliquée dans ce lot.

## Le seul point qui a réellement besoin d'un arbitrage de Frédéric

**Portée de l'interdiction du tiret cadratin (LANG-003).** Mesure réelle sur le
dépôt (pas une estimation) : 4 810 occurrences dans 62 écrans `NEXUS-*.html`,
305 dans la documentation doctrinale/gouvernance/Handoff elle-même (y compris
les échanges Claude ↔ Orchestrator de cette issue), 108 dans les moteurs. La
majorité sondée dans les écrans est du commentaire de développement, mais pas
tout : `NexusVocab.prevision()` produit une phrase réellement affichée à
l'utilisateur avec un tiret cadratin.

Trois portées possibles, non tranchées par ce document :
1. contenu produit par NEXUS et lu par l'utilisateur final seulement ;
2. + toute nouvelle documentation NEXUS à partir de son adoption, sans réécrire l'historique ;
3. rétroactif sur l'existant (chantier de réécriture des 62 écrans avant activation bloquante).

La règle est techniquement triviale à détecter et à câbler (`CANDIDAT_GUARDIAN`
réel), mais QA-002 impose de mesurer avant de câbler un détecteur — la câbler
sur la portée 3 sans arbitrage produirait plusieurs milliers de findings d'un
coup et ferait désactiver la garde avant qu'elle ait servi à quoi que ce soit.
Elle reste donc non câblée tant que la portée n'est pas choisie.

Point mineur annexe, à confirmer plutôt qu'à arbitrer lourdement : marquer
`NEXUS-Constitution-v1.md` Art.12/13 (« Conseiller NEXUS » unique) comme
partiellement historique par une note de révision, sur le modèle des deux
chantiers déjà notés en fin de ce même document — sans réécrire les articles.

## Guardian Philosophie NEXUS — pourquoi une question est posée ici

Consultatif par arbitrage Q75 (`NEXUS-ORCHESTRATION-GUARDIANS-1-20260907/decision-1.md`),
donc pas de veto formel applicable à ce lot documentaire. La question posée en
`4.1` du document de résultat n'est pas motif d'habitude ou de prudence : câbler
`LANG-003` sans arbitrage romprait QA-002 (détecteur non calibré avant mise en
CI) et changerait rétroactivement, sans décision, la façon dont Claude et
l'Orchestrator rédigent ce protocole. C'est exactement le type de choix que le
critère 2 du Guardian réserve à une vraie valeur de jugement humain, pas à une
préférence d'agent.

## Ce qui n'a pas été fait

Aucune modification de `BIBLE.md`, `NEXUS-Constitution-v1.md`, `CONTINUITY.md`.
Aucun renommage de code. Aucun câblage Guardian. Aucun changement `main`/
`production`. Aucune opération Supabase.

## Retour attendu

Arbitrage de la portée `LANG-003` (§4.1 du document de résultat), et
confirmation ou non des deux ajouts Bible proposés (§5.1) et de la note de
révision Constitution (§4.2). Sans quoi ce lot reste en l'état : audit livré,
rien câblé, rien réécrit.
