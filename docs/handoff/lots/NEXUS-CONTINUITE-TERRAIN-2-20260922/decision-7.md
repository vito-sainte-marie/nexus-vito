---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 7
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-8.md
---
# Décision — transport du correctif `nexus-auth.js` (candidate #65), fail-closed sur `window.NEXUS_CONFIG`

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`. Arbitrage technique déterministe,
sans nouvelle règle métier, en réponse à `request-8.md`.

## 1 — Lignée de base

La lignée `fe36a8e:nexus-auth.js` (962 lignes) reste la base fonctionnelle.
Seul le hunk fail-closed `window.NEXUS_CONFIG` déjà préparé dans
`nexus-auth-corrige-65-20260923.js` est transporté. Le `nexus-auth.js` amputé
actuellement présent sur `rebuild/carburants-65-20260922` (305 lignes) n'est
pas réintroduit.

## 2 — Harnais de test

Les deux adaptations strictement nécessaires sont autorisées :
`test_cloture_services_obsoletes_20260916.js` et
`test_regularisation_manager_20260916.js` reçoivent `window.NEXUS_CONFIG`
dans leur contexte `vm`, sans toucher à une seule assertion métier.

## 3 — Cloudflare / `.html`

Aucune application préventive de la normalisation Cloudflare/`.html` dans la
logique d'accès. Hors du transport build/config autorisé tant que le défaut
n'est pas reproduit. Reste une preuve de preview obligatoire : observer les
URLs réellement servies et les parcours Pointage/Prise-de-poste. Si le
retrait d'extension reproduit une erreur/boucle, retour immédiat avec preuve
exacte avant toute correction applicative — pas de correction anticipée.

## 4 — Critère de retour à la baseline

Sur la candidate uniquement : correctif + 2 harnais, suite complète, retour
à la baseline de cette lignée sans nouvel échec. La liste des échecs connus
n'est jamais modifiée pour obtenir du vert.

## 5 — Ordre de poursuite

CI candidate verte → preuve séparée du `nexus-config.js` réellement servi,
ciblant exclusivement Supabase Test → recette navigateur non destructive,
parcours d'accès concernés par Cloudflare inclus.

## 6 — Limite de canal

Si ce canal ne peut ni écrire la branche candidate ni observer la preview,
le prochain `request-N.md` canonique doit nommer le geste externe exact
requis — cette limite de canal n'équivaut jamais à une gate Créateur.

## Invariants

Aucun `main`/`production`, aucune migration/écriture Supabase Production,
aucun déploiement/promotion Production, aucune nouvelle règle
métier/UX/RLS/rôle.
