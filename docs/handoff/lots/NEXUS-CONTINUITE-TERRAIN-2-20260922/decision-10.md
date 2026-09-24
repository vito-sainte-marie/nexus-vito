---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 10
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-14.md
---
# Décision — `request-14.md` : voie 1 retenue, strictement limitée à la dette de harnais `290a217`

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Retenir la **voie 1** de `request-14.md` §6, strictement limitée à la dette de harnais introduite
par le portage build/config `290a217`. Les deux tests originaux
`test_regularisation_manager_20260916.js` et `test_cloture_services_obsoletes_20260916.js` doivent
être réalignés pour injecter `window.NEXUS_CONFIG` dans leur contexte VM, en reprenant exactement
le comportement déjà prouvé par les harnais `*-harnais-realigne-1.js` de ce lot.

Ceci est un correctif de banc de test, pas une modification de règle métier : ne touche ni
`nexus-auth.js` au-delà du blob restauré déjà transporté (`a0b2acc5`), ni rôles/RLS/UX, ni
Supabase.

## Exigences avant fermeture de gate

1. **Diff minimal et explicable** des deux harnais originaux uniquement — aucun autre fichier
   touché.
2. **Exécution réelle** des deux tests.
3. **CI candidate complète réellement verte** — ne pas requalifier une CI rouge comme acceptable
   au seul motif que l'échec préexistait.
4. Conserver séparément la **gate Cloudflare/build**, servie exclusivement contre Supabase Test.
5. `#65` reste `NO GO` tant que ces gates ne sont pas closes.

## STOP

Retour par `request-N.md` si le diff dépasse les deux fichiers de banc, si une assertion métier
doit être affaiblie pour passer, si la CI candidate révèle une régression nouvelle et distincte de
`290a217`, ou si la gate Cloudflare/build devient contradictoire.

## Interdits

Aucun changement `main`/`production`, aucune migration ou écriture Supabase Production, aucune
promotion Production, aucun secret contourné. `NEXUS_BASE_BRANCH=handoff-continuite-20260920`
reste canonique.
