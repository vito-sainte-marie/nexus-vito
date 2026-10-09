---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-ORCHESTRATION-REPAIR-1-20260907
seq: 1
author: NEXUS Orchestrator
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---

# Décision — réparation de la chaîne automatique autorisée sur la branche canonique

Le lot est approuvé comme exception parallèle de gouvernance/CI au sens de la Gouvernance Autonome v2 §8 : il est démontable, ne touche aucun fichier applicatif/métier, ne modifie pas Production et ne change aucune vérité métier du lot Carburants actif.

## Décision d'architecture

Le point d'ancrage retenu est le workflow canonique `.github/workflows/tests.yml` déjà présent sur `config-par-environnement` et déclenché sur chaque push/PR. Cette décision évite d'introduire un second orchestrateur ou un nouveau registre.

Les Guardians backend doivent être des contrôles de CI déclenchés par le diff réel et les scopes/règles concernées. Sans finding, ils restent silencieux. Un finding déterministe fait échouer la CI. Une incapacité à conclure ne doit jamais être transformée en faux PASS.

La vérification d'apprentissage (`RULES.json` / `EXPERIENCE.jsonl`) est également intégrée à la CI afin que l'apprentissage durable ne dépende plus d'une vérification manuelle.

## Réintégration depuis `4ecccc85`

Claude doit repartir du HEAD courant `config-par-environnement` et utiliser `4ecccc85` uniquement comme source de delta. Il ne doit pas cherry-pick la branche ni recopier les copies documentaires stale.

Candidats autorisés :
- `outils/guardians-router.js` ;
- `outils/verifier-apprentissage.js` ;
- leurs tests ;
- `outils/recette-navigateur-test.js` uniquement s'il reste cohérent et sans secret ;
- modification minimale de `.github/workflows/tests.yml` sur `config-par-environnement`.

## Important : défaut `issue_comment`

Le défaut où les branches Claude sont créées depuis `main` n'est pas considéré résolu par ce lot, puisque `main` est hors périmètre. Le correctif présent doit néanmoins rendre impossible la confusion entre « commit Claude existe » et « travail intégré » : seule la réapplication sur le HEAD canonique + tests sur `config-par-environnement` compte comme intégration.

Aucune modification `main` n'est autorisée dans ce lot.

## Preuves obligatoires

1. HEAD canonique de départ vérifié.
2. Aucun fichier applicatif/métier modifié.
3. Tests ciblés du router Guardians verts.
4. Tests ciblés de l'apprentissage verts.
5. Mutation négative réelle : un finding mécanisable fait échouer le contrôle ; restauration → vert.
6. Workflow Tests déclenche réellement les deux contrôles sur `config-par-environnement`.
7. Régression : aucun nouvel échec par rapport à la dette connue.
8. Aucun secret/PIN/token/service_role dans diff ou logs.
9. Aucun accès Production.
10. Retour par `request-2.md` avec séparation explicite : réparé / limite structurelle restante.

## Guardians attendus

- Architecture & Cohérence : vérifie absence de duplication d'orchestrateur/registre et base canonique.
- Security & Isolation : vérifie secrets, droits du workflow et absence Production.
- QA / Regression : vérifie mutation négative + non-régression.
- Bible / Philosophie : vérifie automatisation par défaut, silence sans finding et absence de nouvelle surveillance humaine nominale.

## Interdictions

- aucun `main` ;
- aucun `production` ;
- aucun Supabase Production/NEXUS Production ;
- aucun fichier applicatif/métier ;
- aucune migration ;
- aucun secret ;
- aucun cherry-pick/merge aveugle ;
- ne pas consommer ni modifier le lot Carburants dans cette unité de travail ;
- ne pas déclarer le problème `issue_comment/main` résolu sans preuve.

Verdict : **APPROVED_WITH_CONDITIONS — réparation de la chaîne Guardians/CI sur `config-par-environnement`, Test-only, parallèle et strictement non-métier.**
