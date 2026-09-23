<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/decision-7.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
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
# Décision — arbitrage des deux points matériels de `request-8.md`

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`, en réponse à `request-8.md`.

## Motif

Les deux points signalés par `request-8.md` §4 et §5 sont bien de nature différente, comme le
distingue le réveil : le premier est un défaut de harnais de test qui n'affecte aucune règle
produit ; le second est une hypothèse de comportement Cloudflare pour laquelle aucune observation
réelle n'existe encore pour la candidate #65 spécifiquement. Aucun des deux n'appelle une nouvelle
règle métier/UX/rôle/RLS ; aucun des deux ne nécessite l'arbitrage de Frédéric.

## Point 1 (`request-8.md` §4) — harnais de test : APPROVED

Le patch d'une ligne proposé (ajout de `window.NEXUS_CONFIG` au `ctx.window` construit par `banc()`
dans `test_cloture_services_obsoletes_20260916.js` et `test_regularisation_manager_20260916.js`) est
**autorisé tel que rédigé** dans `preuve-diff-nexus-auth-corrige-65-20260923.md` §4. Motif : il ne
touche aucun fichier applicatif, ne change aucune assertion, et fait apprendre aux deux harnais une
précondition qui n'existait pas dans `fe36a8e` (`NEXUS_CONFIG` fail-closed) — exactement le même
geste que `test_securite_lot_isolation_20260904.js` fait déjà sur le rail. Aucun choix métier/produit,
aucun secret, aucune action Production, aucune modification de `main` : les quatre conditions
cumulatives de l'arbitrage a posteriori outillage/QA sont réunies.

Doit être appliqué **dans le même commit** que le correctif `nexus-auth-corrige-65-20260923.js`, sur
`rebuild/carburants-65-20260922`, par la session outillée qui effectue le transport — pas avant,
pour ne jamais laisser la candidate dans un état où le patch de test existe sans le correctif source
qui le rend nécessaire.

## Point 2 (`request-8.md` §5) — normalisation `.html` : reste BLOQUÉ

**Non autorisé dans ce lot.** La condition posée par le réveil (« nécessité prouvée par le
comportement/configuration Cloudflare de la candidate ») n'est pas remplie : `preuve-cloudflare-
humaine-65-portage-1.md` §1 établit que le build Cloudflare de #65 échoue *avant* l'étape de déploiement
(`bash: outils/build.sh: No such file or directory`, code 127, « étape deploy : non exécutée »).
Aucune page de la candidate n'a donc jamais été servie par Cloudflare Pages — il n'existe encore
aucune observation, humaine ou automatisée, de la façon dont Cloudflare traite l'extension `.html`
pour ce projet/cette branche précis. L'incident du 04/09/2026 qui a motivé `NexusPage`/`nexus-page.js`
concerne le rail après refonte, pas une mesure prise sur #65.

**Preuve externe manquante, nommée précisément** : après le portage mécanique des 7 fichiers déjà
autorisé (`preuve-cloudflare-humaine-65-portage-1.md` §3) et un build/déploiement Cloudflare Pages
réussi de `rebuild/carburants-65-20260922` (ou de la PR #65 elle-même une fois fusionnée), une
observation — humaine avec accès au tableau de bord Cloudflare Pages, ou Claude depuis une session
avec accès réseau sortant — doit constater si une URL sans suffixe (ex. `/NEXUS-Pointage-v1`) sert la
page correspondante ou échoue/redirige, pour ce projet Cloudflare précis. Tant que cette observation
n'existe pas, appliquer la normalisation proposée en `request-8.md` §5 serait une correction
préventive non justifiée par un comportement observé — ce que `decision-6.md` exclut déjà en limitant
le transport « aux éléments réellement nécessaires à la chaîne build/config ».

**Condition de déblocage, pour la suite** : si cette observation confirme que Cloudflare retire
l'extension `.html` pour ce projet, le correctif local déjà rédigé par `request-8.md` §5 (normaliser
`.html` des deux côtés de la comparaison dans `nexusCategorieAcces`, sans dépendre de `NexusPage`) est
pré-autorisé comme correction défensive équivalente — à condition qu'il ne casse aucun test existant,
preuve à l'appui avant tout commit. Si l'observation infirme le risque, ce point se clôt sans code.

## Rappels maintenus, inchangés

1. **Aucun chiffre de suite candidate ne doit être déclaré sans exécution réelle sur l'arbre
   candidate.** `217/224` reste une déduction par construction pour 17/19 fichiers et un correctif
   proposé non exécuté pour 2/19 — pas une mesure. Cette décision ne change pas ce statut.
2. **La gate d'identité `nexus-config.js` réellement servi vers Supabase Test reste une condition
   cumulative**, posée par `decision-3.md`/`decision-4.md`, inchangée par cette décision : aucune
   recette navigateur avant elle.

## Transport — même limite technique que `decision-5.md`/`decision-6.md`

Écriture directe sur `rebuild/carburants-65-20260922` et sur `.github/workflows/*.yml` restent hors
de portée de cet agent dans ce canal, quelle que soit la branche. Cette décision autorise le contenu
des deux points, pas un moyen de les transporter que ce canal n'a pas. Aucune sollicitation de
Frédéric n'est due pour ce seul blocage de transport, conformément à `decision-4.md`.

## Conditions d'arrêt (STOP)

Retour par nouveau `request-N.md` canonique — pas d'exécution silencieuse au-delà — si : l'observation
Cloudflare devient accessible et contredit l'hypothèse ci-dessus ; le patch de test harnais casse une
autre assertion une fois réellement exécuté ; ou un risque matériel nouveau apparaît pendant le
transport.

## Interdits absolus

Aucun changement `main`/`production`, aucune migration/écriture Supabase Production, aucun
déploiement/promotion Production, aucune nouvelle règle métier/UX/RLS/rôle, aucun secret exposé.
`NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste le rail de ce lot. La candidate n'est toujours
pas déclarée prête.
