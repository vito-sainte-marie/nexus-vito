---
protocol: nexus-handoff/2
kind: decision
lot_id: SITE-EXPLICITE-1-POMPISTE-DU-JOUR-TIMEZONE-GUARD-20260906
seq: 1
author: ChatGPT
branch: config-par-environnement
decision: APPROVED
closes: true
in_reply_to: request-1.md
---

# Décision — clôture Pompiste du jour / fuseau station / garde sémantique

## Verdict

**APPROVED — le lot correctif est terminé et suffisamment éprouvé en Test pour être clos.**

## Q61 — fuseau station

Satisfaite. `est_pompiste_du_jour` dérive la journée métier de `sites.timezone`, sans constante de site, et échoue fermé si le fuseau est absent, vide ou inconnu. Les cas de frontière UTC et d'autre fuseau sont éprouvés.

## Q62 — service actif

Satisfaite. Le helper exige `sh.statut='en_cours'`. Un service clos ne conserve plus silencieusement un droit d'écriture opérationnel.

## Q63 — garde et registre des aides

Satisfaite. L'état comportemental d'une aide influence désormais la classification : `CONFORME` peut contribuer à `SAFE`, `NON_EPROUVEE` donne `UNKNOWN`, `DEFAILLANTE` bloque `SAFE` et conduit à `VULNERABLE`. La mutation vert → rouge → vert est couverte par les tests.

## Preuves acceptées

- helper : **8/8** cas comportementaux conformes sur Supabase Test, fixtures rollback ;
- sept policies dépendantes : **21/21** évaluations de predicates conformes sur trois scénarios ;
- CI canonique : workflow `Tests` run `34033416502` **SUCCESS** ;
- Handoff v2 et ses tests mutationnels : **SUCCESS** ;
- garde ADR-0001 : **SUCCESS** ;
- aucune nouvelle régression : seuls les neuf échecs fonctionnels historiques autorisés par la CI subsistent.

La portée de la preuve RLS reste correctement qualifiée : 21/21 concerne les predicates installés, pas 21 opérations DML produisant chacune un refus SQLSTATE `42501`. Cette limite n'empêche pas la clôture de ce lot, dont le contrat était de corriger et prouver le helper et son câblage sémantique.

## Correction du validateur Handoff

La preuve `refs-protegees` est désormais interprétée comme une empreinte historique : elle reste valide uniquement si le commit enregistré demeure ancêtre de la ref protégée courante. Un SHA inexistant, une divergence ou une réécriture échouent fermé. Cela conserve l'append-only sans prétendre interdire tout avancement légitime de `main` ou `production`.

## Gates qui restent fermées

- aucune activation générale de classe D ;
- aucune promotion Production ;
- aucune migration ou modification Supabase Production ;
- aucun changement `main`/`production` autorisé par cette décision.

Le prochain travail peut reprendre depuis le Handoff canonique sans dette ouverte sur ce lot.