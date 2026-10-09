---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-GOVERNANCE-CORE-1-20260905
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=501c0c7 production=501c0c7
  - id: baseline-gelee
    classe: VERIFIED
    valeur: tag annote nexus-baseline-1 sur 7ca2346, pousse
  - id: decision-baseline-consommee
    classe: VERIFIED
    valeur: 9d64bae APPROVED closes=true
  - id: aucun-fichier-applicatif
    classe: VERIFIED
    valeur: ce lot n ajoute que docs/gouvernance/
  - id: aucun-agent-en-service
    classe: DECLARED
    valeur: constitution seule, aucun code d Orchestrator ni ADR
  - id: suite
    classe: VERIFIED
    valeur: 186/195
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucun merge, aucun deploiement, aucune migration
---

# NEXUS Governance Core — version 1

## Résumé

Lot **strictement documentaire et architectural**. Aucun développement métier,
aucun agent en service, aucune modification Production, aucun code
d'Orchestrator.

Baseline gelée consommée : `nexus-baseline-1` sur `7ca2346`, tag annoté créé
et poussé.

Proposition complète : `docs/gouvernance/2026-09-05-governance-core-1.md`.

## Le principe qui gouverne tout le reste

> L'IA construit. Les Guardians contrôlent. La CI prouve. L'Orchestrator
> coordonne. Frédéric décide aux gates sensibles.

Et le garde-fou qui prime :

> **Si l'organisation des agents ne fait pas gagner du temps à Frédéric, elle
> est trop complexe.**

J'ai construit toute la proposition contre ce garde-fou plutôt qu'autour du
catalogue Ruflo. Concrètement : **cinq Guardians, pas douze**, chacun justifié
par un défaut réellement constaté pendant la campagne. Les mécanismes de Ruflo
qui n'avaient pas de défaut à couvrir n'ont pas été repris.

## 1. Quatre faits, cinq Guardians

Le Core ne se justifie pas par principe mais par ce que la recette a montré :

1. **Un contrat gardé seulement par la discipline finit par ne pas être
   respecté** — `cloture_source` sans écrivain, `shift_id` avec sa clé
   étrangère et six lignes à `NULL`.
2. **Un contrat éprouvé sur des données que l'auteur façonne n'est pas
   éprouvé** — S-3 n'a jamais fonctionné depuis l'application, mes essais
   fournissaient `site_id`.
3. **Une absence de règle se cache mieux qu'une règle fausse** — Verify n'avait
   aucune détermination de quart.
4. **L'auteur ne voit pas ses propres erreurs** — `request-1` de la baseline
   affirmait un fait faux sur A15 ; l'arbitrage l'a trouvé, pas moi.

| Guardian | Fait couvert |
|---|---|
| Architecture | 1 — contrats non gardés, duplication, dépendances implicites |
| Security & Isolation | 1 — RLS, isolation, `site_id`, refs protégées |
| Business Rules | 3 — règles absentes, vocabulaires divergents |
| QA / Regression | 2 — forme réelle des données, épreuves négatives |
| NEXUS Bible | 4 — cohérence entre ce que NEXUS dit et ce qu'il fait |

**Claude Builder** exécute et n'approuve jamais son propre travail.
**L'Orchestrator coordonne et n'a aucune autorité.**

Le jour où un Guardian ne trouve plus rien, il doit être **retiré**, pas
conservé par habitude.

## 2. Séparation des responsabilités

Matrice complète dans le document. Quatre règles absolues :

1. aucun agent ne valide son propre travail ;
2. **aucun agent, jamais, n'autorise la Production** — une seule case dans
   tout le tableau, et elle est humaine ;
3. un blocage de sécurité ne se contourne pas par consensus : le Security
   Guardian bloque seul, seul Frédéric lève ;
4. l'Orchestrator n'a aucun pouvoir — un coordinateur qui décide devient un
   point de défaillance unique.

## 3. Contrat anti-dérive

Six champs obligatoires par lot : `objectif_metier`, `gain_attendu`,
`contrats_touches`, `guardians_requis`, `preuves_exigees`,
`definition_de_termine`. **Sans eux le lot est irrecevable**, pas « mal formé ».

Le plus important est `gain_attendu`, et le plus facile à remplir de travers :
« améliorer la qualité du code » n'est pas un gain ; « le manager ne corrige
plus le quart à la main à chaque audit » en est un.

## 4. ADR

`docs/adr/NNNN-titre.md`, append-only, états `PROPOSÉE → ACCEPTÉE →
REMPLACÉE PAR / REFUSÉE`. Une ADR acceptée n'est jamais réécrite : elle est
remplacée — même règle que le registre Handoff, pour la même raison.

**Contrôle de conformité en CI** : chaque ADR acceptée doit nommer au moins un
test ou une migration qui l'incarne. Une ADR sans incarnation est une
intention, pas une décision.

Les huit premières sont des constats déjà faits, pas des idées neuves.

## 5. Horizon et détection de dérive

> La nuit NEXUS travaille, le matin NEXUS explique, la journée NEXUS
> accompagne, Frédéric manage.

Chaque lot déclare le segment servi, ou déclare n'en servir aucun — réponse
valable pour une dette technique.

Trois signaux mécaniques : trois lots sans contribution · un `gain_attendu`
hors promesse · **le temps de Frédéric augmente** — ce dernier prime sur les
deux autres.

## 6. Isolation des agents

Un agent **signale**, il ne corrige pas le travail d'un autre. Worktree dédié
seulement si deux agents écrivent en parallèle — tant qu'un seul écrit, une
branche suffit : l'isolation est un remède, pas une décoration. Et un Guardian
ne répare pas ce qu'il contrôle, sous peine de redevenir juge et partie.

## 7. Démontabilité

**Le Core doit pouvoir être retiré sans que NEXUS cesse de fonctionner en
station.** Il vit entièrement dans `docs/`, `outils/`, `.github/`.

Épreuve associée, à écrire au premier lot d'implémentation : un test vérifiant
qu'aucun fichier applicatif n'importe quoi que ce soit de la gouvernance. Une
gouvernance dont on ne peut plus se passer est devenue une dépendance.

## 8. Pilotage

**Maintenant** (un seul lot) · **Ensuite** (trois au plus) · **Plus tard** ·
**Dette** (les 34 entrées, jamais purgées sans arbitrage). La limite d'un seul
lot « Maintenant » est le mécanisme qui empêche le tableau de devenir une
liste de souhaits.

## 9. Priorités initiales

Ordre du danger réel, aucun sujet neuf : defaults de site (58 colonnes) ·
insertions sans `site_id` · branche créateur non éprouvée · vues
`SECURITY DEFINER` · Edge Functions absentes · login · NexusStock ·
couverture multi-site.

**Les trois premiers partagent une racine** — le site est déduit au lieu
d'être exigé — et devraient être un seul chantier, pas trois.

## 10. Orchestrator

Aujourd'hui Frédéric est le facteur, **deux fois par lot**. Cible :

```
Claude → Handoff GitHub → Orchestrator détecte → ChatGPT arbitre
       → Decision GitHub → Orchestrator réveille Claude
```

États déjà nommés en v2 : `event detected`, `session resumed`,
`session unavailable`.

**Limite écrite avant d'être découverte** : rien ne réveille une session
éteinte. `session unavailable` est un état normal, la relance humaine reste le
secours, et cette capacité ne doit pas être simulée avant d'exister.

Première étape concrète : le **gabarit de décision pré-rempli** (Q24) —
quatre dérogations d'enveloppe en quatre dépôts, c'est précisément le genre de
friction qui coûte du temps à Frédéric.

## Preuves

- Décision `APPROVED / closes: true` consommée, commit `9d64bae`.
- **Tag annoté `nexus-baseline-1` créé sur `7ca2346` et poussé** ; son message
  précise qu'il ne vaut ni merge, ni promotion, ni autorisation Production.
- `main` et `production` : `501c0c7`, inchangées — preuve calculée par
  l'outillage, non déclarée.
- **Aucun fichier applicatif touché** : ce lot n'ajoute que
  `docs/gouvernance/`.
- Aucun agent créé, aucun code d'Orchestrator, aucune ADR encore écrite.

## Risques / anomalies

1. **Le principal risque de ce Core, c'est lui-même.** Cinq Guardians, six
   champs obligatoires, des ADR et un Horizon : si tout cela ne fait pas
   gagner de temps, la règle dit d'en retirer. Le mécanisme de retrait —
   démontabilité, suppression d'un Guardian stérile — est donc dans le
   document, pas laissé à la bonne volonté.
2. **Rien n'est encore prouvé.** Ce lot est une constitution ; aucun Guardian
   n'a trouvé quoi que ce soit, aucune ADR n'existe. La valeur reste à
   démontrer par l'usage.
3. **Le contrat anti-dérive alourdit chaque lot.** Six champs, c'est un coût
   réel à chaque tour. Il est assumé pour les lots structurels ; pour un
   lot trivial, il pourrait dépasser le bénéfice — voir Q30.

## Questions pour arbitrage

**Q28 — Cinq Guardians, est-ce le bon nombre ?** Recommandation :
**oui, et pas un de plus**. Chacun couvre un défaut constaté. Ajouter un
Guardian « performance » ou « documentation » sans défaut avéré violerait le
garde-fou dès la constitution.

**Q29 — Par quoi commencer ?** Recommandation : **le chantier « le site est
déduit au lieu d'être exigé »** — defaults de site, insertions sans `site_id`,
branche créateur. Trois priorités, une racine, et le risque le plus concret du
registre. Les ADR et l'Orchestrator viennent après : une constitution se
prouve par un premier lot réel, pas par son propre outillage.

**Q30 — Le contrat anti-dérive s'applique-t-il à tous les lots ?**
Recommandation : **oui, sans exception de taille**. Un lot « trivial » qui ne
sait pas dire quel gain il apporte est précisément celui qu'il ne fallait pas
faire. Mais les six champs doivent tenir en six lignes, pas en six
paragraphes — la lourdeur viendrait de la rédaction, pas de l'exigence.

## Action attendue de ChatGPT

Arbitrer Q28, Q29 et Q30 pour le `LOT_ID` **NEXUS-GOVERNANCE-CORE-1-20260905**,
et valider ou amender la constitution. **Aucun merge, aucun déploiement
Production, aucune implémentation d'agent ne sont demandés par cette demande.**
