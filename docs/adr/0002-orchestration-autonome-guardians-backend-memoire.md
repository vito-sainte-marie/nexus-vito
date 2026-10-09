# ADR-0002 — Orchestration autonome, Guardians backend et memoire progressive

Statut : **ACCEPTEE**
Date : 2026-09-06
Decision humaine : Frederic Bragance

## Contexte

Le protocole Handoff v2 a fortement augmente la securite et la tracabilite, mais l'experience terrain du 6 septembre 2026 a montre une derive : trop de reveils Claude, trop d'arbitrages intermediaires, preuves navigateur repoussees et branches Claude parfois basees sur un `main` obsolete. La gouvernance devenait elle-meme une source de latence.

Frederic demande explicitement :
- Claude code ; Orchestrator ne le remplace pas ;
- Claude et Orchestrator resolvent seuls tout ce que la doctrine permet ;
- Guardians silencieux en backend, non interroges manuellement ;
- Frederic n'intervient que pour une vraie decision de fondateur ou la gate Production ;
- NEXUS Test doit permettre une boucle code/test/correction autonome ;
- l'experience acquise doit reduire les cycles futurs.

## Decision

1. Claude devient autonome a l'interieur d'un lot Test autorise pour diagnostiquer, coder, tester, corriger et retester.
2. Orchestrator devient arbitre autonome pour tout ce qui est determinable depuis les sources canoniques ; il ne code pas l'application a la place de Claude.
3. Les cinq Guardians deviennent des controles backend declenches par scope/evenement. Silence en absence de finding ; prescription directe lorsqu'une correction est deterministe ; escalation seulement pour ambiguite reelle.
4. La gate Production humaine explicite de Frederic reste obligatoire.
5. La memoire operationnelle est materialisee dans GitHub sous forme de regles compactes (`RULES.json`), experience append-only (`EXPERIENCE.jsonl`) et sources durables (Bible/gouvernance/ADR). Le Handoff reste temporaire.
6. Un probleme resolu deux fois doit faire l'objet d'une tentative de promotion en regle, check automatique ou runbook avant une troisieme analyse identique.
7. Les lots gouvernance/CI demontables peuvent avancer en parallele d'un lot produit s'ils sont strictement disjoints.

## Invariants conserves

- `main`, `production`, Supabase Production et NEXUS Production ne sont jamais modifies automatiquement par Orchestrator.
- Toute promotion Production exige le GO explicite de Frederic.
- `service_role` reste serveur/Connector de confiance uniquement, jamais depot/navigateur/logs.
- Isolation entreprise/site et fail closed restent prioritaires sur la vitesse.
- Une verite metier garde un proprietaire logique unique.

## Consequences

Positives : moins de reveils, moins d'interruptions, recette Test plus rapide, apprentissage durable, baisse du cout token et du temps de Frederic.

Risque : une autonomie Test mal delimitee pourrait elargir le perimetre. Mitigation : preflight branche, scopes de regles, Guardians backend, diff et gate Production.

## Incarnation attendue

- `docs/gouvernance/2026-09-06-governance-autonome-v2.md`
- `docs/learning/RULES.json`
- `docs/learning/EXPERIENCE.jsonl`
- controle CI de base canonique Claude ;
- controles Guardians backend dans `outils/` / `.github/` sans dependance applicative ;
- tests d'integrite de la gouvernance et de sa demontabilite.

Cette ADR n'autorise aucune promotion Production.