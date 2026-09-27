# Classement des gates en attente, et état Git exact de #62/#65 — 22/09/2026

Ce dossier répond au point 2/3 du réveil de poursuite technique du 22/09/2026 (issue #28,
commentaire `5783784071`) : reprendre le classement des gates encore ouvertes après la clôture de
`NEXUS-CONTINUITE-TERRAIN-1-20260920` (`decision-13.md`), et établir l'état Git exact de #62 et
#65 par rapport à `production` et au rail `handoff-continuite-20260920`. Aucune décision n'est
demandée par ce dossier : conformément à `decision-1.md`/`decision-2.md` de ce lot, il s'agit de
travail déclaré, pas soumis.

Toutes les mesures Git ci-dessous ont été rejouées dans cette session, contre les refs déjà
présentes localement (`origin/production`, `origin/handoff-continuite-20260920`,
`origin/fdj-vague1-cycle-caisse-20260916`, `origin/reception-regularisation-20260919`) — aucun
`git fetch`/`git push`/`gh` n'a été nécessaire ni tenté au-delà de ces lectures. `gh pr view` a
été essayé et refuse une approbation qu'aucun humain ne peut donner dans ce run automatisé : le
statut CI/mergeable exact de #62/#65 n'est donc **pas** mesurable depuis ce canal ; ce dossier ne
cite que ce qui est déjà écrit dans `dossier-decision-pr-62.md`/`dossier-decision-pr-65.md`
(vérifié rouge sur `Cloudflare Pages` pour les deux SHA, §7/§8) sans le re-mesurer.

## 1. État Git exact

| | `production` | rail `handoff-continuite-20260920` |
|---|---|---|
| tip | `2bc7b39` | `fe795a4` (ce lot, behind=0) |
| ancêtre commun avec #62/#65 | `2bc7b39` lui-même (ancêtre direct) | `501c0c7` (bien plus ancien) |

- **#62** (`fdj-vague1-cycle-caisse-20260916`, tip `fe4e9a2`) : `production` (`2bc7b39`) en est un
  **ancêtre direct** — la branche est `production` + 31 commits (`309ca51` … `fe4e9a2`, Phases
  A/B/C du cycle de caisse FDJ). Lignée propre, aucune divergence, aucun rebase nécessaire.
  `fe4e9a2` reste la tête exacte de la branche : elle n'a pas bougé depuis `decision-13.md` du
  22/09/2026 — le NO GO temporaire qui y est attaché reste donc valide au sens de son propre §6
  (« si la tête de la branche bouge, l'autorisation tombe »).
- **#65** (`reception-regularisation-20260919`, tip `fe36a8e`) : même constat, `production` en
  ancêtre direct, + 3 commits (`fbf113b`, `ffb520b`, `fe36a8e`). Tête inchangée depuis
  `decision-13.md`.
- **Par rapport au rail** : `handoff-continuite-20260920` et `production` divergent à `501c0c7` —
  production porte 106 commits que le rail n'a pas (dont le rail de déploiement Pages Production,
  le correctif d'arrondi Carburants 35 000 L, les primitives pointage/service courant), et le rail
  porte 475 commits que production n'a pas (tout l'appareil Handoff, la Continuité terrain
  elle-même). Ce ne sont pas deux copies d'un même travail : ce sont deux lignées **délibérément
  séparées**, ce qui est la structure attendue du protocole (Production ne reçoit que par
  promotion explicite humaine, jamais par fusion du rail). #62 et #65 sont bâtis sur `production`,
  pas sur le rail : c'est cohérent avec le fait qu'ils visent une fusion Production directe, pas
  un passage par le rail.
- **Aucun geste de portage ou de transport n'a été effectué dans cette session** vers l'une ou
  l'autre de ces deux branches : ni checkout, ni cherry-pick, ni modification. Conforme au point 4
  du réveil — la sécurité d'isolation Test n'étant pas démontrée pour ces deux candidats, rien n'y
  a été poussé ni configuré.

## 2. Classement des gates — reprise de `decision-13.md`, mise à jour au 22/09/2026

| Gate | État au 22/09 (`decision-13.md`) | État aujourd'hui | Preuve manquante restante |
|---|---|---|---|
| **B1 — accès remplaçant manager** | ouverte, sans geste humain depuis le 20/09 | **fermée** — `decision-1.md`+`decision-2.md` de ce lot, `closes: false` sur le lot mais le point lui-même est tranché | aucune |
| **Isolation Supabase Test des candidats web** (préalable #62/#65) | ouverte, nommée par Frédéric le 22/09 | **étude + outillage minimal déposés** (`etude-isolation-test-candidats-web-1.md`, `urlTestDeBranche()`), **portage non fait** — différé pour observation Cloudflare humaine | accès Cloudflare (tableau de bord) pour observer ce qui est réellement construit/servi sur les branches candidates avant tout portage |
| **Preuve de création réelle de la migration #65** | ouverte | **non entamée** dans ce lot — la mesure déjà au dossier (§8, no-op sur Test dérivé) documente pourquoi la preuve manque, mais le protocole exact demandé (rejouer les 276 migrations `production` puis la seule 277e) n'a pas été exécuté | environnement Supabase Test jetable, absent de ce canal |
| **Dérive de schéma Supabase Test** (287 vs 276, 11 versions hors Git) | ouverte, séquencée après l'isolation | **non entamée**, toujours séquencée après le point précédent | accès Supabase Test |
| **GO Production #62** | NO GO temporaire (dossier §7) | **inchangé** — aucune nouvelle preuve ne justifie de rouvrir ce verdict | recette navigateur profonde + preuve SHA servi, bloquées par la gate d'isolation ci-dessus |
| **GO Production #65** | NO GO temporaire (dossier §7) | **inchangé**, même motif | idem + preuve de création réelle de la migration |

## 3. Pour chaque candidat — preuves Git/CI disponibles, preuves Test manquantes, gestes mécaniques possibles

### #62 (`fdj-vague1-cycle-caisse-20260916`, `fe4e9a2`)

- **Disponible maintenant (Git/CI)** : ancêtre direct de `production`, 31 commits, tête stable
  depuis le 22/09 ; applicabilité SQL des 12 migrations déjà mesurée hors de ce canal (54
  colonnes créées, 36 fonctions créées, 0 objet détruit, `dossier-decision-pr-62.md` §8.1) ;
  check GitHub `Cloudflare Pages` déjà mesuré rouge sur `fe4e9a2` (`request-2.md`).
- **Manquant, Cloudflare/Supabase Test** : preuve « SHA attendu = SHA servi », recette navigateur
  profonde (PostgreSQL Test réel, semis, journal Live, Playwright) — **structurellement
  impossible** tant que `nexus-auth.js` de cette branche code Supabase Production en dur et que
  `urlTestDuRail()` ne sait adresser qu'un rail déclaré, jamais une branche de PR arbitraire.
- **Geste mécanique possible sans Production** : porter les 4 fichiers de la chaîne de build
  (`nexus-auth.js` refonte, `outils/build.sh`, `outils/generer-config.js`,
  `nexus-bandeau-environnement.js`) sur cette branche, puis adresser son alias Cloudflare avec
  `urlTestDeBranche('fdj-vague1-cycle-caisse-20260916')` — **délibérément pas fait ici** : la
  décision de ce lot (`decision-2.md`) le conditionne à une observation Cloudflare humaine
  préalable, pour ne pas écrire sur une page qui pourrait encore parler à Production.

### #65 (`reception-regularisation-20260919`, `fe36a8e`)

- **Disponible maintenant (Git/CI)** : ancêtre direct de `production`, 3 commits, tête stable
  depuis le 22/09 ; essai à blanc de la migration déjà mesuré (`exit 0`, 9 NOTICE, 0 objet créé/
  détruit sur le schéma Test dérivé — `dossier-decision-pr-65.md` §8) ; check `Cloudflare Pages`
  déjà mesuré rouge sur `fe36a8e`.
- **Manquant, Cloudflare/Supabase Test** : même paire de causes que #62 (même `nexus-auth.js`,
  même limite de `urlTestDuRail()`) ; en plus, le protocole de preuve de création réelle exigé par
  Frédéric (276 migrations `production` puis la 277e seule, sur un schéma qui n'a jamais dérivé)
  n'a pas été exécuté — la mesure existante prouve seulement que la migration ne casse rien sur un
  schéma déjà en avance, pas qu'elle crée quoi que ce soit.
- **Geste mécanique possible sans Production** : identique à #62 pour l'isolation Test (même
  portage, même conditionnement à l'observation Cloudflare) ; pour la preuve de migration, geste
  mécanique possible en environnement Supabase jetable (aucune écriture Production) mais qui
  requiert un accès que ce canal n'a pas.

## 4. Ce que ce dossier ne fait pas

Aucun portage vers les branches candidates, aucune configuration Cloudflare, aucune requête
Supabase Test/Production, aucune réouverture des verdicts NO GO temporaire déjà rendus. Aucune
nouvelle règle métier. Conforme au point 4 du réveil (« ne pas porter/configurer vers une branche
candidate si cela pourrait réactiver un déploiement parlant à Production sans preuve
d'isolation »).

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production,
aucun secret créé/lu/exposé, aucun nouveau rôle/RLS, aucune nouvelle règle métier/UX, aucun
contournement des protections.

## 5. Mise à jour du 27/09/2026 — ajoutée par append, rien ci-dessus n'est réécrit

Réponse au réveil du 27/09/2026 (issue #28) : `decision-11.md` (lot
`NEXUS-CONTINUITE-TERRAIN-2-20260922`) ferme la ligne « Preuve de création réelle de la migration
`#65` » de la table §2 ci-dessus, sur la base de `preuve-65-schema-jetable.md` (22/09/2026). Ce
n'est **pas** un GO de fusion ni de Production ; les deux constats de son §4 (`revoke ... from
public` toujours inefficace sur `anon`/`authenticated`, horodatage `20260919103000` antérieur à
neuf migrations déjà en Production) restent ouverts, portés au futur dossier de gate Production.

**Fait git nouveau, non encore incorporé au tableau ci-dessus** : `rebuild/carburants-65-20260922`
(la branche que `preuve-cloudflare-humaine-65-portage-1.md` §3 nommait pour le portage
mécanique, tip `fe36a8e` le 23/09) a **avancé de cinq commits** depuis, jusqu'à `20af9f6`,
tous mesurés sur les refs déjà présentes localement — aucun `git fetch`/push n'a été nécessaire :

| Commit | Date | Contenu |
|---|---|---|
| `290a217` | 22/09 | porte les 7 fichiers de la chaîne de build (exactement ceux listés par `preuve-cloudflare-humaine-65-portage-1.md` §3) |
| `664af98` | 23/09 | aligne la garde de build du candidat |
| `a31b2e4` | 24/09 | restaure `nexus-auth.js` prouvé sur la candidate (cause racine `290a217`, cf. `decision-9.md`) |
| `1ba8b88` | 24/09 | réaligne les deux harnais `NEXUS_CONFIG` (transporté et mesuré par `request-16.md`, CI acceptée par `decision-10.md`) |
| `20af9f6` | 24/09 | **nouveau, jamais cité par un `request-N.md`/`decision-N.md` de ce lot** — ajoute `.github/workflows/recette-candidat-65.yml` |

Le workflow `20af9f6` est lu ici, pas exécuté ni déclenché depuis ce canal : il se déclenche sur
push vers `rebuild/carburants-65-20260922` et sur `workflow_dispatch` ; il vérifie d'abord
(fail-closed) que la preview Cloudflare sert exactement `github.sha` (`nexus-build.js`) et que
`nexus-config.js` annonce `environnement: "test"` et le projet Supabase Test
`udljdqxerrbbbajxubfn` — avec refus explicite si la référence Production
(`uzhjpqpctpvxytxpxoqz`) apparaît — puis lance `node outils/recette-navigateur-test.js` avec les
trois secrets Test déjà provisionnés (Manager, Créateur, Employé A). La version de ce script
présente sur la candidate (vintage 09/09/2026, relue en entier) lit bien `NEXUS_COMMIT_ATTENDU`
que le workflow lui passe — cohérent, pas un décalage.

**Reclassement de la table §2** :

| Gate | État au 24/09 (`request-17.md`) | État constaté le 27/09 (lecture git seule) |
|---|---|---|
| Isolation Supabase Test des candidats web | portage non fait | **portage mécanique fait** (`290a217`…`1ba8b88`) ; isolation *prouvée en exécution* reste à confirmer par un run réel |
| Preuve de création réelle de la migration `#65` | ouverte | **fermée par `decision-11.md`** (§ ci-dessus) |
| Recette navigateur authentifiée | hors de portée du canal | mécanisme **écrit et cohérent**, secrets réels déjà câblés (`20af9f6`) ; **résultat d'exécution non mesurable depuis ce canal** — ni `gh api`, ni `gh auth status`, ni `git fetch`/`push` ne s'exécutent ici sans une approbation qu'aucun humain ne peut donner dans ce run automatisé (revérifié le 27/09, même constat que `request-17.md`) |
| GO Production `#65` | NO GO temporaire | **inchangé** — cette mise à jour ne le requalifie pas |

**Geste minimal exact pour clore les deux gates restantes** : depuis une session ou un accès
disposant de `gh`/l'interface GitHub (droits sur ce dépôt), lire l'historique des runs du
workflow « Preuve Test #65 » sur `rebuild/carburants-65-20260922` à `20af9f6`. S'il n'a jamais
tourné ou a échoué, le déclencher par `workflow_dispatch` (aucun nouveau secret, aucune nouvelle
permission) et rapporter le verdict exact (SHA servi, `environnement`, projet Supabase observé,
résultat de la recette) dans un prochain `request-N.md`. Aucun geste de ce type n'a été tenté
depuis ce canal.

Rien d'autre n'est changé par cet append : aucun portage, aucune configuration Cloudflare, aucune
requête Supabase, aucune réouverture d'un verdict NO GO déjà rendu.
