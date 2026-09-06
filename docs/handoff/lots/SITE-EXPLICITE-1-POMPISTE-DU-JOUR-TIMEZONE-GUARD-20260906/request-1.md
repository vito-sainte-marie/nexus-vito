---
protocol: nexus-handoff/2
kind: request
lot_id: SITE-EXPLICITE-1-POMPISTE-DU-JOUR-TIMEZONE-GUARD-20260906
seq: 1
author: NEXUS-Orchestrator
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=c434201 production=501c0c7
  - id: q61-helper
    classe: VERIFIED
    valeur: 8/8 cas comportementaux conformes sur Supabase Test udljdqxerrbbbajxubfn avec rollback
  - id: q62-service-actif
    classe: VERIFIED
    valeur: service clos=false et statut en_cours obligatoire
  - id: q63-registre
    classe: VERIFIED
    valeur: CONFORME=>SAFE NON_EPROUVEE=>UNKNOWN DEFAILLANTE=>VULNERABLE avec mutation vert-rouge-vert
  - id: policies-dependantes
    classe: VERIFIED
    valeur: 7 predicates RLS x 3 scenarios = 21/21 conformes avec rollback
  - id: integration-canonique
    classe: VERIFIED
    valeur: correctif integre sur config-par-environnement commit 89ad9fd47a9bac4250c6f6d8fd0cc2b4562fd86f
  - id: handoff-ci
    classe: VERIFIED
    valeur: workflow Tests run 34033416502 vert sur commit ece1fb49058adb1b47114350b95897bbccc95212
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune operation main production Supabase Production ou NEXUS Production
---

# Retour de preuve — Pompiste du jour / fuseau station / garde sémantique

## Objet

Fermer le lot correctif autorisé par la décision du lot `SITE-EXPLICITE-1-NAMED-HELPERS-BEHAVIOR-PROOF-20260906` : corriger la frontière de journée de `est_pompiste_du_jour`, limiter le droit au service actif, et faire dépendre la garde statique de l'état comportemental de ses aides.

## Réalisation

Le correctif préparé par Claude dans `93852f8c83dbc8f593316ce8328aca47d9890bf4` a été transféré sélectivement sur la lignée canonique `config-par-environnement`. Le PR #29 divergent n'a jamais été fusionné.

Le helper Test utilise désormais `sites.timezone`, refuse un fuseau absent/vide/inconnu, exige `sh.statut='en_cours'`, conserve la portée explicite par site et compare la date du service à la journée locale du site.

Le registre des aides est désormais une dépendance sémantique de `garde-portee-site` : seule une aide `CONFORME` peut contribuer à `SAFE`; `NON_EPROUVEE` donne `UNKNOWN`; `DEFAILLANTE` fait rétrograder en `VULNERABLE`.

## Preuves Supabase Test

Projet exclusivement utilisé : `nexus-test` (`udljdqxerrbbbajxubfn`). Fixtures uniques, transactions annulées explicitement.

Helper `est_pompiste_du_jour` — 8/8 :
- service actif du jour station → true ;
- service de la veille à 20:30 Martinique, ancien cas frontière UTC → false ;
- service clos → false ;
- service commencé la veille et chevauchant minuit → false selon le contrat courant ;
- site temporaire `Pacific/Kiritimati`, jour local courant → true ;
- aucun service → false ;
- site inconnu → false ;
- autre site → false.

Les sept policies carburant dépendantes ont ensuite été évaluées sur trois scénarios : pompiste actif courant=true, service de veille=false, service clos=false. Résultat : 21/21 predicates conformes.

Limite explicitement conservée : cette preuve 21/21 porte sur les predicates installés des policies RLS, et non sur 21 mutations de tables destinées à produire chacune SQLSTATE `42501`.

## CI et Handoff

Le premier passage CI a révélé un défaut indépendant du correctif : les preuves historiques `refs-protegees` étaient traitées comme une obligation de figer éternellement `main` et `production`. Le validateur a été corrigé pour accepter uniquement un avancement fast-forward : l'empreinte historique doit rester ancêtre de la ref protégée actuelle ; SHA inconnu, divergence ou réécriture échouent fermé.

Le workflow `Tests` run `34033416502` est vert : non-régression, comparaison aux 9 échecs connus, Handoff v2, tests mutationnels du validateur, garde ADR-0001 et simulations métier passent.

## État des refs protégées

`main` = `c434201567f8d75a5894de776838160b73a5dbb4`.
`production` = `501c0c744c3327dd5693a2bddc45d064045ca474`.
Aucune des deux n'a été modifiée par ce lot de clôture.

## Action attendue

Arbitrer la clôture de `SITE-EXPLICITE-1-POMPISTE-DU-JOUR-TIMEZONE-GUARD-20260906`. Aucune activation de classe D et aucune promotion Production ne sont demandées.