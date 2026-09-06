# NEXUS Governance Core — version 1 (proposition)

Rédigé le 05/09/2026, au-dessus de `nexus-baseline-1` (`7ca2346`).
**Document d'architecture. Aucun code, aucun agent en service, aucune
modification Production.**

> L'IA construit. Les Guardians contrôlent. La CI prouve. L'Orchestrator
> coordonne. Frédéric décide aux gates sensibles.

Et le garde-fou qui prime sur tout le reste :

> **Si l'organisation des agents ne fait pas gagner du temps à Frédéric, elle
> est trop complexe.**

Ce document doit être lu comme une constitution, pas comme un plan de
développement. Il dit qui peut quoi, et ce que chacun doit prouver.

## 0. Ce que la campagne a appris, et qui justifie ce Core

Quatre faits, tous constatés pendant la recette, portent l'essentiel de la
justification. Sans eux, ce Core serait de la bureaucratie.

1. **Un contrat gardé seulement par la discipline finit par ne pas être
   respecté.** `cloture_source` existait depuis l'origine sans écrivain ;
   `inventaire_quart_employes.shift_id` avait une clé étrangère et six lignes
   à `NULL`. Rien ne les surveillait, personne ne l'a vu.
2. **Un contrat éprouvé sur des données que l'auteur façonne lui-même n'est
   pas éprouvé.** S-3 n'a jamais fonctionné depuis l'application : mes essais
   fournissaient `site_id`, que l'écran n'envoie jamais.
3. **Une absence de règle se cache mieux qu'une règle fausse.** Verify n'avait
   aucune détermination de quart ; le premier `<option>` faisait illusion.
4. **L'auteur ne voit pas ses propres erreurs.** `request-1` de la baseline
   affirmait un fait faux sur A15. C'est l'arbitrage externe qui l'a trouvé.

Le Governance Core existe pour ces quatre raisons. Chaque Guardian ci-dessous
répond à l'une d'elles ; aucun n'est là pour la symétrie.

## 1. Architecture

### NEXUS Orchestrator — coordination, aucune autorité

Achemine, détecte, réveille, journalise. **Il ne juge rien.** Il ne peut ni
approuver, ni bloquer, ni écrire dans le métier. Sa seule métrique de succès :
le nombre de fois où Frédéric n'a pas eu à dire « Lis Claude ».

### Les cinq Guardians

| Guardian | Répond au fait | Périmètre | Peut bloquer |
|---|---|---|---|
| **Architecture Guardian** | 1 | contrats, duplication de règles, dépendances implicites (l'ordre alphabétique des triggers en est l'archétype) | oui |
| **Security & Isolation Guardian** | 1 | RLS, isolation Test/Production, refs protégées, `site_id`, `SECURITY DEFINER`, secrets | **oui, sans appel** |
| **Business Rules Guardian** | 3 | règles métier réellement portées par le code, absences de règle, vocabulaires divergents | oui |
| **QA / Regression Guardian** | 2 | couverture, forme réelle des données, épreuves négatives, mutation | oui |
| **NEXUS Bible Guardian** | 4 | cohérence entre ce que NEXUS dit de lui-même et ce qu'il fait ; dettes qui disparaissent d'une fiche à l'autre | oui |

**Claude Builder** — exécutant. Diagnostique, propose, implémente, produit les
preuves. **Il n'est jamais l'approbateur final de son propre travail.**

Cinq Guardians, pas douze. Chacun tient parce qu'un défaut réel l'a rendu
nécessaire ; le jour où l'un d'eux ne trouve plus rien, il doit être retiré,
pas conservé par habitude.

## 2. Séparation des responsabilités

| | Proposer | Développer | Bloquer | Valider | Exiger des preuves | Autoriser Production |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Claude Builder | ✅ | ✅ | ❌ | ❌ | ❌ | **❌ jamais** |
| Architecture Guardian | ✅ | ❌ | ✅ | ❌ | ✅ | **❌ jamais** |
| Security & Isolation Guardian | ✅ | ❌ | ✅ | ❌ | ✅ | **❌ jamais** |
| Business Rules Guardian | ✅ | ❌ | ✅ | ❌ | ✅ | **❌ jamais** |
| QA / Regression Guardian | ✅ | ❌ | ✅ | ❌ | ✅ | **❌ jamais** |
| NEXUS Bible Guardian | ✅ | ❌ | ✅ | ❌ | ✅ | **❌ jamais** |
| ChatGPT (arbitre) | ✅ | ❌ | ✅ | ✅ | ✅ | **❌ jamais** |
| Orchestrator | ❌ | ❌ | ❌ | ❌ | ❌ | **❌ jamais** |
| **Frédéric** | ✅ | ✅ | ✅ | ✅ | ✅ | **✅ seul** |

Quatre règles absolues :

1. **Aucun agent ne valide son propre travail.**
2. **Aucun agent, jamais, n'autorise la Production.** Une seule case dans tout
   ce tableau, et elle est humaine.
3. **Un blocage de sécurité ne se contourne pas par consensus.** Le Security
   Guardian bloque seul ; seul Frédéric peut lever.
4. **L'Orchestrator n'a aucun pouvoir.** Un coordinateur qui peut décider
   devient un point de défaillance unique.

## 3. Contrat anti-dérive

Tout lot futur porte ces six champs, dans son enveloppe. **Sans eux, le lot
n'est pas recevable** — pas « mal formé » : irrecevable.

| Champ | Ce qu'il empêche |
|---|---|
| `objectif_metier` | travailler sur ce qui est intéressant plutôt que sur ce qui sert |
| `gain_attendu` | temps · CA · marge · pertes évitées · autonomie · fiabilité — **au moins un, nommé** |
| `contrats_touches` | découvrir après coup qu'on a modifié un invariant |
| `guardians_requis` | faire relire par ceux qui ne trouveront rien |
| `preuves_exigees` | négocier les preuves après l'échec |
| `definition_de_termine` | l'élasticité du « c'est fini » |

Le champ `gain_attendu` est le plus important, et le plus facile à remplir de
travers. « Améliorer la qualité du code » n'est pas un gain. « Le manager ne
corrige plus le quart à la main à chaque audit » en est un.

## 4. ADR — décisions d'architecture

`docs/adr/NNNN-titre.md`, numérotation stricte, **append-only**.

États : `PROPOSÉE` → `ACCEPTÉE` → `REMPLACÉE PAR ADR-NNNN` ou `REFUSÉE`.
Une ADR acceptée n'est jamais réécrite : elle est remplacée. C'est la même
règle que le registre Handoff, pour la même raison — un historique qui se
corrige en silence ne prouve plus rien.

Chaque ADR porte ses liens : migrations, tests, lots Handoff, commits.
**Contrôle de conformité** : la CI vérifie que chaque ADR acceptée nomme au
moins un test ou une migration qui l'incarne. Une ADR sans incarnation est
une intention, pas une décision.

Les huit premières ADR à écrire sont des constats déjà faits, pas des idées
neuves — `site_id` source unique, un seul trigger `BEFORE INSERT` par table,
la règle du quart en un exemplaire, fail-closed sur configuration absente,
`VERIFIED`/`DECLARED`/`HUMAN`, deny-all intentionnel, refs protégées
indérogeables, append-only des registres.

## 5. Horizon NEXUS — objectifs longue durée

La promesse, rappelée à chaque checkpoint :

> **La nuit NEXUS travaille, le matin NEXUS explique, la journée NEXUS
> accompagne, Frédéric manage.**

`docs/gouvernance/HORIZON.md`, persistant. Chaque lot déclare à quel segment
de la promesse il contribue — *travaille*, *explique*, *accompagne*, *libère
Frédéric* — ou déclare explicitement qu'il ne contribue à aucun, ce qui est
une réponse valable pour une dette technique.

**Détection de dérive** — trois signaux mécaniques, pas une impression :

1. trois lots consécutifs sans contribution à un segment ;
2. un lot dont le `gain_attendu` ne se rattache à aucun segment ;
3. **le temps de Frédéric augmente au lieu de diminuer** — le signal qui prime
   sur les deux autres.

**Checkpoints** : à chaque gel de baseline, et à chaque dixième lot.

## 6. Isolation des travaux d'agents

- Un agent ne modifie jamais le travail d'un autre. Il **signale**.
- Branche ou worktree dédié dès que deux agents écrivent en parallèle.
  Tant qu'un seul écrit, une branche unique suffit : l'isolation est un
  remède, pas une décoration.
- Intégration seulement après contrôle des Guardians requis et CI verte.
- Un Guardian ne corrige pas ce qu'il contrôle. Trouver et réparer, c'est
  redevenir juge et partie — le défaut n° 4.

## 7. Démontabilité — condition de recevabilité

**Le Governance Core doit pouvoir être retiré entièrement sans que NEXUS cesse
de fonctionner en station.**

Concrètement : tout ce Core vit dans `docs/`, `outils/` et `.github/`. Aucun
écran, aucune migration, aucun contrat métier n'en dépend. Supprimer ces
répertoires doit laisser une application qui démarre, s'authentifie, ouvre un
service et compte un inventaire.

**Épreuve associée, à écrire dans le premier lot d'implémentation** : un test
qui vérifie qu'aucun fichier applicatif n'importe quoi que ce soit de la
gouvernance. Une gouvernance dont on ne peut plus se passer a cessé d'être une
gouvernance : elle est devenue une dépendance.

## 8. Tableau de pilotage

Quatre colonnes, pas cinq. **Maintenant** (un seul lot à la fois) ·
**Ensuite** (au plus trois) · **Plus tard** · **Dette** (les 34 entrées du
registre de baseline, jamais purgées sans arbitrage).

La limite d'un seul lot « Maintenant » est le mécanisme, pas une intention :
c'est elle qui empêche le tableau de devenir une liste de souhaits.

## 9. Priorités initiales des Guardians

Aucun sujet neuf : ce sont les risques déjà connus, pris dans l'ordre du
danger réel.

| # | Sujet | Guardian | Pourquoi maintenant |
|---|---|---|---|
| 1 | **Defaults de site** — 58 colonnes à `'vito-sainte-marie'` | Security | La RLS intercepte aujourd'hui ; le défaut reprendrait la main si une politique était assouplie. Bombe amorcée. |
| 2 | **Insertions sans `site_id`** | Security + Architecture | Même racine que 1 : le code s'appuie sur le défaut au lieu de le nommer. |
| 3 | **Branche créateur non éprouvée** | Security + QA | Seul profil traversant les sites par conception, **aucun test ne la parcourt**. |
| 4 | **Vues `SECURITY DEFINER`** (17) | Security | Ne fuitent pas *par accident de configuration*, pas par règle. |
| 5 | **Edge Functions absentes de Test** | Architecture | Quatre fonctionnalités hors recette ; le contrôle n° 6 passe sans rien prouver. |
| 6 | **Finalisation du login** | Security + Architecture | Porte d'entrée non industrialisée. |
| 7 | **NexusStock** | Architecture | Périmètre entier jamais éprouvé. |
| 8 | **Couverture multi-site** | QA | Un seul site peuplé ; l'isolation n'est prouvée qu'entre deux caissiers du même site. |

Les trois premiers partagent une racine — le site est déduit au lieu d'être
exigé — et devraient être traités comme un chantier, pas trois.

## 10. Rôle futur de l'Orchestrator

Aujourd'hui, la boucle est : Claude écrit → **Frédéric dit « Lis Claude »** →
ChatGPT arbitre → **Frédéric dit « Lis la décision »** → Claude reprend.
Frédéric est le facteur, deux fois par lot.

Cible :

```
Claude → Handoff GitHub → Orchestrator détecte → ChatGPT arbitre
       → Decision GitHub → Orchestrator réveille Claude
```

Trois états, déjà nommés dans le protocole v2 : `event detected`,
`session resumed`, `session unavailable`.

**La limite, écrite avant d'être découverte à l'usage** : rien ne réveille une
session éteinte. Tant qu'aucun runner externe n'existe, `session unavailable`
est un état normal et la relance humaine reste le secours. **Ne pas simuler
cette capacité avant qu'elle existe** — le protocole v2 le dit déjà, et ce
Core ne l'assouplit pas.

Première étape concrète, avant tout Orchestrator : le **gabarit de décision
pré-rempli** (Q24, arbitré pour un lot distinct). Quatre dérogations
d'enveloppe en quatre dépôts montrent que le contrat n'est pas assez
découvrable — et c'est exactement le genre de friction qui fait perdre du
temps à Frédéric.

## 11. Ce que ce Core n'est pas

Ce n'est pas une autorisation de production, pas un plan de développement, pas
un engagement de calendrier. C'est une constitution : elle dit qui peut quoi,
et ce que chacun doit prouver.

Elle sera **trop complexe** le jour où elle coûtera plus de temps à Frédéric
qu'elle ne lui en fait gagner. Ce jour-là, la bonne décision sera d'en retirer
une partie — et le principe de démontabilité est là pour que ce soit possible.
