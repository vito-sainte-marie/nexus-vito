---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-PAYE-COCKPIT-PRODUCTION-1-20261009
seq: 1
author: Frédéric Bragance (gate humaine)
branch: config-par-environnement
decision: APPROVED
closes: true
in_reply_to: request-1.md
---
# Gate humaine franchie — la PR #86 est autorisée à fusionner

**Déclarée par Frédéric Bragance, le 09/10/2026, en session.** Mot pour mot :
« ok pour fusionner ».

## Ce qui est autorisé

La fusion de la PR #86 — `claude/paye-cockpit-production-20261009` à `3dde242`
— dans `production`. C'est l'acte final que le mandat du 09/10/2026 annonçait
et que `request-1.md` a transmis au Handoff faute de pouvoir le franchir seul.

Les quatorze preuves de `request-1.md` sont celles sur lesquelles repose cette
autorisation. Elles ont été revérifiées juste avant l'acte : `origin/production`
toujours à `b42e773`, tête de la PR toujours `3dde242`, état de fusion CLEAN,
non-régression verte deux fois, artefact vert, Cloudflare Pages vert.

## Ce qui ne l'est pas, et ne le devient pas

Cette décision ne porte que sur **NEXUS Paye**. Elle n'autorise, ni directement
ni par extension :

- aucune opération sur Supabase Production, aucune migration ;
- aucune lecture, création ou rotation de secret ;
- aucune modification de politique RLS, de permission ou d'isolation multisite ;
- aucun autre module, et en particulier aucun des travaux Verify/FDJ en cours ;
- aucune modification de `main`.

Elle n'est pas non plus une dispense : ni de CI, ni de contrôle de sécurité, ni
de protection des données. Elle ne se rejoue pas : une autre promotion
Production demandera une autre gate.

## Ce qui reste dû après l'acte

Le déploiement ne vaut qu'avec sa preuve. Sont dues, mesurées et non déclarées :
la fusion effective, le passage vert du workflow de `production`, et la page
réellement servie par `app.nexusconseil.net` portant le cockpit et
fonctionnant. Sans ces trois-là, aucune mise en Production ne sera annoncée
comme réussie.

Les deux points ouverts de `request-1.md` restent ouverts et connus : Safari
iOS n'est vérifié que statiquement, et LANG-003 n'existe pas sur `production`
— la garde tournera au retour du candidat sur le rail, plafond inchangé.
