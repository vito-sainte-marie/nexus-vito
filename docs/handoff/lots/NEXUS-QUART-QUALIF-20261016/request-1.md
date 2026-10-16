---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-QUART-QUALIF-20261016
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=55285d8b production=c775e128
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 151-fichiers
  - id: sha-candidat
    classe: VERIFIED
    valeur: a06c2c15ae27a13681ad5a2c1cb3ffed6b11540b sur lot-changement-de-quart-20261016 (PR 131)
  - id: blob-migration
    classe: VERIFIED
    valeur: d7ac18acd2cb8b82d606f52e6c35ac71346df4e2
  - id: md5-declencheur-production
    classe: VERIFIED
    valeur: 1888968bc2138557fab6d10601a1715f
  - id: ci-pr131
    classe: VERIFIED
    valeur: artefact vert, non-regression vert, Cloudflare vert sur a06c2c15
  - id: epreuves
    classe: VERIFIED
    valeur: Node 25 OK mutation-testee; SQL 24/24 sous rollback sur Test
---
# Demande de verdict — qualification de la migration `20261016090000` (changement de quart atomique)

Auteur : Claude. Arbitre attendu : ChatGPT ou Frédéric. Claude ne s'arbitre pas.

**Qualification soumise au verdict Handoff. Cette qualification documentaire ne constitue aucune autorisation de migration, de fusion ou de déploiement en Production.**

## Objet

Soumettre au verdict la qualification `atomique_ou_procedure_speciale` de la migration `supabase/migrations/20261016090000_changement_de_quart_atomique.sql` dans `docs/deploiement/qualification-ordre-migration-code.json`, avec sa procédure de promotion `docs/deploiement/promotion-changement-de-quart-production-20261016.md`. La garde `outils/garde-ordre-migration-code.js` n'est ni modifiée ni affaiblie.

## Où est le dossier

- PR #131 (base `production`), branche `lot-changement-de-quart-20261016`, commit **a06c2c15ae27a13681ad5a2c1cb3ffed6b11540b** (commits du lot : 98d9c74a, a552d550, a06c2c15). Rien n'est fusionné.
- Blob de la migration : `d7ac18acd2cb8b82d606f52e6c35ac71346df4e2` (un blob différent fait tomber la qualification).
- Mesure Production du 16/10/2026, lecture seule : `nexus_changer_de_quart` absente ; `nexus_shifts_avant_insertion` en définition P-1, md5 `1888968bc2138557fab6d10601a1715f` ; un seul trigger BEFORE INSERT sur `shifts` ; 313 migrations enregistrées.

## Pourquoi cet état

La garde additive a refusé la fiche (`CIBLE_DEJA_DEPENDANTE`) : la migration remplace `nexus_shifts_avant_insertion`, déjà nommée par le code de la cible. Faux positif : la fonction préexiste et l'ancien code (INSERT direct) traverse le déclencheur sans variable de transaction, donc avec le comportement P-1 (épreuve SQL cas 9). Le risque réel est un remplacement de fonction de déclencheur à ordre strict (migration, contrôles, puis code), d'où une procédure spéciale plutôt que « additive pure ».

## Preuves

- CI de la PR #131 sur a06c2c15 : « Construire et éprouver l'artefact » vert, non-regression vert, Cloudflare vert. PR toujours BLOCKED par la protection de `production`.
- Épreuve Node `test_changement_de_quart_20261016.js` : 25 OK, mutation-testée.
- Épreuve SQL sous rollback sur Test : 24/24. Migration appliquée sur Test seulement.
- Recette navigateur humaine sur Test : à faire, aucun identifiant saisi par Claude.

## Limites assumées

Les quarts clos par `employe` après promotion ne sont pas rouverts par un retour arrière (procédure §5). La qualification périme si le blob change.

## Question posée

1. La qualification `atomique_ou_procedure_speciale` avec cette procédure est-elle acceptée comme état de la fiche, sans modifier la garde ?
2. Conditions éventuelles avant qu'un GO de migration Production puisse être demandé à Frédéric (recette Test humaine, etc.).

## Ce que ce verdict ne donne pas

Aucune migration Production, aucune fusion de la PR #131, aucun déploiement. Ces trois gestes exigent un GO distinct de Frédéric.
