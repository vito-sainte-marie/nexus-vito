---
protocol: nexus-handoff/2
kind: request
lot_id: CONTINUITE-ROLES-B1-PREUVE-TERRAIN-20260922
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: LEAN
preuves:
  - id: connexion-audrey-confirmee
    classe: DECLARED
    valeur: frederic_22092026_audrey_se_connecte_normalement_avec_son_compte
  - id: recherche-b1-anterieure-roles
    classe: VERIFIED
    valeur: aucune_trace_canonique_trouvee_git_grep_branche_handoff_continuite_20260920_complete_1720_commits
  - id: aucune-modification-role-rls
    classe: NOT_APPLICABLE
    valeur: non_demandee_non_effectuee
  - id: aucune-operation-supabase
    classe: NOT_APPLICABLE
    valeur: aucune_tentative_aucun_acces
---
# Preuve terrain Créateur — accès Audrey (B1), rôles remplaçantes

## 1. Ce que ce dépôt matérialise

Le réveil NEXUS Orchestrator du 22/09/2026 (issue #28) transmet une preuve terrain confirmée
par Frédéric : **Audrey se connecte normalement à NEXUS ce jour avec son compte**, et
transmet des clarifications de rôle associées :

- Audrey = manager remplaçante opérationnelle prioritaire, accès NEXUS fonctionnel (preuve
  terrain de ce jour) ;
- Lydie = manager remplaçante légitime, droits existants conservés (aucun changement) ;
- Yannick = gérante, droits gérante/manager conservés, adoption active de NEXUS non requise
  à ce stade ;
- Angélique = aucun rôle manager ; rôle préférentiel renfort, polyvalence opérationnelle
  caissière/pompiste/renfort ;
- le rôle préférentiel, le rôle opérationnel du quart et l'autorité manager/gérant restent
  des notions distinctes, non confondues par ce constat.

Aucune modification de rôle/RLS n'est demandée par ce dépôt. Aucune opération Supabase
Production n'a été tentée ni n'est nécessaire pour établir ce fait terrain : la preuve
transmise est une déclaration de Frédéric (`DECLARED`), pas une mesure technique exécutée
par cette session.

## 2. Recherche d'une décision B1 antérieure — résultat honnête

Le réveil indique que cette preuve « complète la décision B1 précédente » et demande de
« considérer B1 fermé si aucune preuve canonique existante ne contredit ce constat ».

Recherche effectuée avant ce dépôt, sur `origin/handoff-continuite-20260920` (rail canonique
courant, `NEXUS_BASE_BRANCH` déclaré par ce réveil) :
- `git grep` sur l'intégralité de la branche pour `Audrey`, `Lydie`, `Angélique`,
  `remplaçante`/`remplacante`, `gérante`, `rôle préférentiel` → **aucune occurrence** dans
  `docs/handoff/`, `docs/gouvernance/`, `docs/nexus/` ou ailleurs, hors fixtures de test sans
  rapport (`Audrey`/`Lydie` apparaissent comme noms d'employés d'exemple dans des migrations
  et tests de paye/écarts, sans lien avec ce sujet de rôles).
- `git log --oneline` sur les 1720 commits de la branche pour `B1` → seules les occurrences
  historiques du lot `B1-REJEU-NAVIGATEUR-20260905` (rejeu navigateur d'un bloqueur technique
  de service, sujet sans rapport) et `A3 / B1 — plus aucune identité client ne retombe sur
  Sainte-Marie` (isolation multi-site, sujet distinct).
- Aucun lot `docs/handoff/lots/` sur cette branche ne porte de nom évoquant ce sujet de rôles.

**Conclusion honnête** : aucune trace canonique d'une « décision B1 » sur ce sujet précis
(rôles manager remplaçante/gérante/renfort) n'existe dans ce dépôt Git. Conformément à
`docs/handoff/PROTOCOL.md` (« Fabriquer après coup des request-n.md et decision-n.md qui
n'ont jamais existé serait inventer un passé plausible »), ce dépôt ne prétend pas retrouver
une décision antérieure inexistante ici : il **établit pour la première fois la trace
canonique de ce sujet dans ce dépôt**, en reprenant fidèlement le contenu déjà tranché par
l'Orchestrator/Frédéric dans le réveil GitHub du 22/09/2026 (issue #28). Si une décision B1
antérieure existe réellement ailleurs (canal ChatGPT/Orchestrator non versionné dans ce
dépôt), elle n'est pas contredite par ce dépôt — elle est simplement absente d'ici jusqu'à ce
jour.

## 3. Ce que je demande

Que ce dépôt serve de support à la décision déjà rendue dans le réveil du 22/09/2026 (issue
#28, commentaire de vito-sainte-marie sous mandat NEXUS Orchestrator), afin de matérialiser
canoniquement : la preuve terrain Audrey, les clarifications de rôle Lydie/Yannick/Angélique,
et la fermeture de B1 en l'absence de toute preuve canonique contraire (confirmée en §2).

Aucun changement `main`/`production`, aucune opération Supabase Production, aucune
modification de rôle/RLS.
