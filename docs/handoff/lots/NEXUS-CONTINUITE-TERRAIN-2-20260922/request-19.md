---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 19
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=4a49bf4 production=2bc7b39
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=4a49bf4-production=2bc7b39
  - id: head-canonique
    classe: VERIFIED
    valeur: 0b3c387-egal-origin-handoff-continuite-20260920
  - id: gh-bloque
    classe: VERIFIED
    valeur: gh-version-et-gh-auth-status-refuses-par-le-bac-a-sable
  - id: docker-bloque
    classe: VERIFIED
    valeur: docker-info-refuse-par-le-bac-a-sable
  - id: permissions-jeton
    classe: VERIFIED
    valeur: contents-write-issues-write-pull-requests-write-actions-read-id-token-write
  - id: ecart-preuve-migration-65
    classe: VERIFIED
    valeur: preuve-65-schema-jetable-16h19-vs-classement-gates-20h44-vs-decision-10-24-09
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# `#65` reste hors de `PRET_GATE_CREATEUR` — un écart de registre trouvé, signalé, pas tranché

Déposée au titre de **Q76** (arbitrage a posteriori pour outillage/registre — aucun choix métier,
aucun secret, aucune Production, aucun `main`). Répond au réveil de poursuite du 27/09/2026
(issue #28) qui demandait de conduire `#65` jusqu'à `PRET_GATE_CREATEUR`.

## Verdict de cette session : aucune gate supplémentaire fermée, aucun `BLOQUE_CAUSE_RACINE` nouveau

`#65` n'atteint pas `PRET_GATE_CREATEUR` dans cette session. Les gates encore ouvertes recensées
par `classement-gates-etat-git-62-65-1.md` §2 et confirmées par `decision-10.md` §2 restent
inchangées : isolation Supabase Test des candidats web, dérive de schéma Supabase Test, recette
navigateur authentifiée. Aucune n'a été rouverte, masquée ni contournée.

## 1. HEAD canonique et demande active — vérifiés

`HEAD` de ce checkout = `origin/handoff-continuite-20260920` (`0b3c387`), exactement. Registre
conforme avant écriture (`handoff.js verifier` : 32 lots, 15 avertissements, tous préexistants).
`STATE.json` : lot actif `NEXUS-CONTINUITE-TERRAIN-2-20260922`, `derniere_demande: request-18.md`
(`ATTENTE_DECISION`, sujet `issues: write` — sans rapport direct avec `#65`), `derniere_decision:
decision-10.md`. `request-17.md` reste également sans décision propre.

## 2. Ce qui a été re-vérifié dans cette session précise (pas répété sans fait nouveau)

Le réveil affirme que le transport/réveil et `issues: write` sont désormais opérationnels — c'est
cohérent avec `request-18.md` §7 et avec le fait que ce commentaire même porte la trace d'un
réveil transporté. Deux points **au-delà** de ce que `request-17.md`/`request-18.md` avaient déjà
mesuré ont été vérifiés fraîchement dans **cette** session, parce que le réveil demandait
explicitement d'emprunter toute voie d'exécution devenue atteignable :

- `gh --version` et `gh auth status` : refusés par le bac à sable de cet run précis (approbation
  requise, indisponible en exécution automatisée) — donc **aucune** commande `gh` n'a pu être
  tentée, ni en lecture ni en écriture, y compris pour simplement lire l'état d'un run CI.
- `docker info` : même refus. Un environnement Postgres jetable local (la même méthode que
  `preuve-65-schema-jetable.md`, §5) n'est donc **pas** reproductible depuis ce canal précis —
  c'est un fait nouveau par rapport aux sessions précédentes de ce lot, qui n'avaient pas testé
  cet angle depuis un run `issue_comment`. Conclusion inchangée sur le fond : cette voie reste hors
  de portée d'ici, mais la raison exacte (bac à sable, pas seulement absence de secret) est
  désormais établie plutôt que supposée.
- Permissions du jeton de ce job (`.github/workflows/claude.yml` sur `main`, lu directement) :
  `contents: write`, `issues: write`, `pull-requests: write`, `actions: read`, `id-token: write`.
  `actions: read` seul confirme, indépendamment du blocage `gh` ci-dessus, qu'un déclenchement
  `workflow_dispatch` de `tests.yml` ne serait de toute façon pas autorisé par le jeton lui-même.
  Cette session ne peut pousser que sur sa propre branche `claude/issue-28-*` (mécanisme du
  harnais), jamais directement sur `handoff-continuite-20260920` ni sur une branche candidate —
  cohérent avec la mesure API déjà faite par `request-17.md` (`push:false`).

**Conclusion sur la voie d'exécution demandée par `decision-10.md` §3.2** : toujours hors de
portée de ce canal précis, pour deux causes indépendantes et désormais confirmées (bac à sable +
portée du jeton), pas une seule supposée. Conformément à la décision, **STOP** sur ce point —
aucun nouveau mécanisme, aucune nouvelle garde, aucun contournement tenté.

## 3. Un écart trouvé dans le registre lui-même — signalé pour arbitrage, pas résolu ici

En relisant les preuves déjà déposées pour identifier tout travail déterministe restant (§3.1 de
`decision-10.md`), un écart de calendrier a été trouvé entre trois documents du même lot, sur le
même sujet — la preuve de création réelle de la migration `#65` :

| Document | Horodatage (commit) | Constat sur cette gate |
|---|---|---|
| `preuve-65-schema-jetable.md` | 22/09 16:19 (`90e33d8`) | **VERTE ET NON VIDE** — 276 migrations Production rejouées sur un conteneur Docker jetable local, puis la 277e (`#65`) seule : 13 objets créés, 0 détruit, garde de rôle éprouvée par 13 cas dont un contre-témoin. Conclusion du document lui-même : « Ceci lève le trou de preuve de `#65` ». |
| `classement-gates-etat-git-62-65-1.md` | 22/09 20:44 (`9fb1478`), soit 4h plus tard le même jour | Qualifie cette même gate de « **non entamée** dans ce lot […] l'environnement Supabase Test jetable, absent de ce canal », sans référencer `preuve-65-schema-jetable.md`. |
| `decision-10.md` | 24/09 (`ce27a56`) | Reprend le constat du document précédent : cette gate « **reste ouverte et inchangée** ». |

L'exigence arbitrée citée par `preuve-65-schema-jetable.md` lui-même autorise explicitement un
environnement jetable (« Cela peut être fait dans un environnement jetable ; aucune écriture
Production n'est nécessaire ») — elle ne semble donc pas exiger un projet Supabase Test hébergé.
Sous cette lecture, la preuve documentée le 22/09 à 16:19 paraît satisfaire l'exigence que les deux
documents plus récents considèrent encore manquante.

**Je ne tranche pas cet écart moi-même.** Trois lectures restent possibles, et je n'ai pas les
éléments pour choisir entre elles sans arbitrage :
1. la preuve du 22/09 16:19 est valable et cette gate est en réalité déjà close depuis cette date —
   `classement-gates...` et `decision-10.md` l'ont simplement manquée ;
2. la preuve a été jugée insuffisante pour une raison non écrite dans ces documents (portée,
   fraîcheur, provenance de l'environnement jetable, ou autre) et le rejet n'a pas été consigné ;
3. la preuve concerne une version antérieure de la migration `#65` qui aurait changé depuis —
   vérifié négativement autant que possible depuis ce canal : le sha256 cité
   (`1a02adca…8d6caf`) correspond au fichier extrait de `fe36a8e`, et `classement-gates...` §1
   confirme que la tête de `#65` (`fe36a8e`) n'a pas bougé depuis `decision-13.md` du lot précédent
   — cette troisième lecture paraît donc la moins probable, sans pouvoir être totalement exclue
   d'ici.

Je ne réouvre ni ne referme cette gate : je signale l'écart tel que trouvé, daté et sourcé, pour
que l'Orchestrateur/Frédéric le tranche avec le contexte qui manque à ce canal.

## 4. Ce que cette session ne fait pas

Aucun portage vers une branche candidate, aucune configuration Cloudflare, aucune requête Supabase
Test/Production, aucune tentative de contournement des blocages `gh`/`docker`/push, aucune
réouverture des verdicts `NO GO` déjà rendus pour `#62`/`#65`, aucune fabrication de preuve
d'exécution qui n'a pas eu lieu. Le lot successeur pour la dette de classification d'accès reste
non ouvert, conformément à `decision-10.md` §3.4 (`#65` n'a pas de verdict complet).

## 5. Geste minimal requis — inchangé sur le fond, reconfirmé

Les deux gestes déjà nommés par `request-17.md` §3 restent les seuls chemins connus, tous deux hors
de portée de ce canal :
1. **Isolation Test du candidat** : observation humaine du tableau de bord Cloudflare Pages sur
   `rebuild/carburants-65-20260922`, préalable posé par `decision-2.md` de ce lot.
2. **Déclenchement CI sur ce candidat isolé** par une session/un compte disposant de droits
   d'écriture réels sur ce dépôt (`actions: write` ou accès direct) — aucun nouveau secret à créer.

À ces deux gestes s'ajoute, nouveau dans cette session, la question de réconciliation du §3
ci-dessus, qui ne nécessite ni Cloudflare ni Supabase : relire les trois documents cités et
confirmer, infirmer ou compléter le constat.

## Interdits respectés

Aucun changement `main`/`production`, aucune migration ni écriture Supabase, aucune promotion
Production, aucun secret lu ou exposé, aucune nouvelle règle métier/UX/rôle/RLS/sécurité, aucune
baisse de gate, aucun nouveau mécanisme ni garde. `NEXUS_BASE_BRANCH=handoff-continuite-20260920`
reste le rail canonique.
