# Preuve Cloudflare humaine (#65) ; reclassement ; portage préparé, non exécuté depuis ce canal

Réponse au réveil du 23/09/2026 (issue #28, commentaire `5786467570`). Périmètre : #65 uniquement
(`reception-regularisation-20260919`, SHA `fe36a8e`). #62 n'est pas touché ici.

## 1. Preuve Cloudflare humaine — consignée telle que rapportée par Frédéric

Log Cloudflare Pages, candidat #65, SHA exact `fe36a8ebafb2a64dd1cc4f558424f3915749b4eb` :

- clone du SHA : OK ;
- commande Cloudflare : `bash outils/build.sh` ;
- échec exact : `bash: outils/build.sh: No such file or directory` ;
- code de sortie : 127 ;
- étape deploy : non exécutée.

Cette preuve n'a pas été re-mesurée depuis ce canal (aucun accès Cloudflare ici) : elle est
consignée comme observation humaine rapportée, pas comme mesure Claude.

## 2. Reclassement #65 — ce que cette observation change

`etude-isolation-test-candidats-web-1.md` §4 posait trois faits externes comme non mesurables
depuis ce canal. Le premier est désormais tranché :

| Fait §4 | Avant (22/09) | Après (23/09) |
|---|---|---|
| 1. cause exacte du rouge Cloudflare | hypothèse (deux causes indépendantes possibles) | **confirmée : échec de build, faute de `outils/build.sh`, avant tout déploiement** — exit 127, deploy jamais atteint |
| 2. scope Test des variables d'environnement Cloudflare au niveau du projet | non mesuré pour #65 | toujours non mesuré pour #65 spécifiquement (mesuré seulement pour le rail) |
| 3. un déploiement de #65 répondrait-il une fois §3.2 appliqué | non mesuré | toujours non mesuré — nécessite le portage puis une nouvelle observation |

Conséquence directe sur `classement-gates-etat-git-62-65-1.md` §2, ligne « Isolation Supabase Test
des candidats web » : **la condition posée par `decision-2.md`** (« le portage [...] reste différé
tant qu'un accès Cloudflare humain n'a pas observé ce qui y est réellement construit et servi »)
**est remplie pour #65** — Frédéric a observé, et ce qui est construit/servi aujourd'hui pour
`fe36a8e`, c'est : rien. Le build échoue avant la première ligne de `generer-config.js`. Aucune
page n'est servie, donc aucun risque qu'une page existante parle à Production aujourd'hui — ce que
`etude-isolation-test-candidats-web-1.md` §2 formulait déjà au conditionnel est confirmé au présent
pour la cause n°1 (absence de chaîne de build), pas requalifié en risque avéré côté n°2 (le
`nexus-auth.js` pré-refonte reste sur la branche, il n'a simplement jamais l'occasion de s'exécuter
tant que le build échoue).

Ceci ne prouve PAS l'isolation Supabase Test après portage (Frédéric le dit lui-même) : reclassé
ci-dessous comme geste suivant, pas comme acquis.

## 3. Le plus petit geste mécanique désormais autorisé — identifié précisément

Le mécanisme déjà préparé est celui de `etude-isolation-test-candidats-web-1.md` §3.2, sur la
branche que `decision-2.md` nomme déjà pour cet usage : **`rebuild/carburants-65-20260922`**
(existante, tip `fe36a8e` — identique au candidat #65, aucun commit ajouté) — **pas**
`reception-regularisation-20260919` elle-même, pour ne jamais modifier le contenu de la PR #65 en
cours de revue.

**Les 7 fichiers exacts**, vérifiés un par un par lecture directe (`git show
origin/rebuild/carburants-65-20260922:<chemin>`, comparé à `HEAD` = rail) :

| Fichier | État sur le candidat (`fe36a8e`) | Geste |
|---|---|---|
| `outils/build.sh` | absent | ajouter (copie identique du rail) |
| `outils/generer-config.js` | absent | ajouter (copie identique du rail) |
| `outils/poser-build-id.js` | présent, **version pré-refonte** (horodatage, pas empreinte de contenu ; pas de `CF_PAGES_COMMIT_SHA` ; pas de `nexus-config.js` dans `SANS_EPINGLE`) | remplacer par la version du rail |
| `nexus-auth.js` | présent, **version pré-refonte, 932 lignes** — `uzhjpqpctpvxytxpxoqz.supabase.co` (Production) en dur, ignore `window.NEXUS_CONFIG` | remplacer par la version du rail (305 lignes) |
| `nexus-page.js` | absent | ajouter (copie identique du rail) |
| `nexus-bandeau-environnement.js` | absent | ajouter (copie identique du rail) |
| `_headers` | absent | ajouter (copie identique du rail) |

Aucun autre fichier du candidat n'a besoin d'être touché : `generer-config.js` insère lui-même les
balises `nexus-config.js`/`nexus-page.js`/`nexus-bandeau-environnement.js` dans tout écran qui
inclut déjà `<script src="nexus-auth.js` (vérifié sur `NEXUS-Carburant-Reception-v1.html` du
candidat — la balise existante `nexus-auth.js?v=20260904-0104` matche la même regex, insertion
automatique au build, aucune édition manuelle des écrans requise). Aucune règle métier touchée :
les deux écrans propres à #65 (réception, pilotage) restent inchangés en dehors de cette balise
ajoutée au build.

Remplacer strictement ces 7 fichiers par leur version du rail : pas une réécriture, pas une
nouvelle configuration — exactement le remplacement mécanique déjà tranché par la refonte du
04/09/2026, appliqué ici à un candidat qui en était resté antérieur.

## 4. Ce qui confirme que le mécanisme lui-même reste sain (rejoué, pas supposé)

Rejoué sur ce commit du rail avant de conclure quoi que ce soit :

- `node test_config_environnement.js` → **17/17**, dont « un build « test » pointant la PRODUCTION
  est refusé » et « un build « production » ne pointant PAS la production est refusé » (exécution
  réelle de `generer-config.js`, pas une lecture de source) ;
- `node test_build_tracabilite_20260905.js` → **49/49**, dont « build.sh s'arrête à la première
  erreur » et « sans identifiant de génération, la primitive REFUSE de construire une URL » ;
- `node outils/handoff.js verifier` → conforme (32 lots, 15 avertissements préexistants, 11
  dérogations) ;
- `git status` propre après ces deux exécutions : aucun fichier généré (`nexus-config.js`,
  `nexus-build.js`) laissé derrière — les deux suites le vérifient elles-mêmes.

Aucune valeur Supabase réelle n'a été utilisée ou fabriquée pour ces preuves : les deux suites
n'exercent le générateur qu'avec des URL/clé factices (`https://exemple.supabase.co`,
`sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx`) ou en échec délibéré — jamais une valeur prétendant
représenter un déploiement réel de #65.

## 5. Ce que ce canal ne peut pas exécuter — confirmé par tentative réelle, pas supposé

Cinq tentatives réelles dans cette session, chacune refusée par le harnais avant toute exécution :
`git checkout origin/rebuild/carburants-65-20260922`, `git checkout -B
rebuild/carburants-65-20260922 origin/...`, `git worktree add ... origin/...`, `GIT_INDEX_FILE=...
git read-tree origin/...`, `git hash-object outils/build.sh`. Chacune : « nécessite une approbation
qu'aucun humain ne peut donner dans ce run automatisé ». Seules les opérations de lecture pure
(`git show <ref>:<chemin>`, `git cat-file -p`, `git rev-parse`, `git log`, `git diff`) fonctionnent
depuis ce canal ; toute opération qui écrirait un objet ou changerait de référence — même vers une
branche non protégée, même sans toucher au répertoire de travail — est bloquée. C'est le même
obstacle structurel documenté dans ce fil depuis le 06/09/2026 pour `config-par-environnement`,
confirmé ici pour la première fois sur une branche candidate ordinaire, pas seulement sur le rail.

**Aucun contournement tenté** (pas de sandbox désactivé, pas de push par refspec détourné, pas
d'écriture d'un fichier hors du répertoire de travail autorisé — également refusée). Seule
l'écriture sur `claude/issue-28-20260922-2357` (ce lot de travail) reste disponible depuis ce
canal ; y matérialiser les 7 fichiers ne représenterait rien, puisque ce lot de travail EST déjà le
rail (ces 7 fichiers y sont déjà corrects) — le geste utile est sur `rebuild/carburants-65-20260922`
spécifiquement, hors de portée d'écriture d'ici.

## 6. Commandes exactes pour exécuter ce geste depuis une session outillée

```
git fetch origin rebuild/carburants-65-20260922 handoff-continuite-20260920
git checkout -B rebuild/carburants-65-20260922 origin/rebuild/carburants-65-20260922
git checkout origin/handoff-continuite-20260920 -- \
  outils/build.sh outils/generer-config.js outils/poser-build-id.js \
  nexus-auth.js nexus-page.js nexus-bandeau-environnement.js _headers
git add outils/build.sh outils/generer-config.js outils/poser-build-id.js \
  nexus-auth.js nexus-page.js nexus-bandeau-environnement.js _headers
git commit -m "rebuild(65): porter la chaine de build/config du rail (7 fichiers, mecanique)"
git push origin rebuild/carburants-65-20260922
```

Après ce push, Cloudflare reconstruira l'alias dérivé du nom de branche via `aliasCloudflare()`
(déjà en place, `urlTestDeBranche()` du lot précédent) : **exactement**
`https://rebuild-carburants-65-202609.nexus-test-ddf.pages.dev/` (calculé et confirmé par
exécution réelle de `urlTestDeBranche('rebuild/carburants-65-20260922')` dans cette session, pas
deviné).

## 7. Ce qui reste bloqué après ce geste, sans exception

Conformément à `decision-2.md` : « aucune preuve Supabase Test/Production ne doit être fabriquée
pour combler l'absence d'accès de ce canal ». Restent donc `NOT_APPLICABLE` depuis ce canal, avant
et après le portage ci-dessus :

- lecture des variables d'environnement Cloudflare réellement scopées pour ce projet/cette
  branche (le fait n°2 du §2) ;
- observation de ce que le build ported sert réellement une fois déployé (le fait n°3) ;
- **la preuve exigée par ce réveil avant toute recette navigateur** : que le build candidat généré
  pointe uniquement vers Supabase Test — nécessite de lire `nexus-config.js` réellement servi (ou
  le bandeau d'environnement à l'écran) sur `https://rebuild-carburants-65-202609.nexus-test-ddf.pages.dev/`
  une fois le push ci-dessus effectué, ce que ce canal ne peut ni faire ni simuler ;
- toute recette navigateur profonde pour #65, qui reste donc non entamée.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production,
aucun secret créé/lu/exposé, aucun nouveau rôle/RLS, aucune nouvelle règle métier/UX, aucune
modification de la branche `reception-regularisation-20260919` (PR #65 elle-même intacte), aucun
fichier applicatif métier modifié par ce dossier (diff limité à `docs/handoff/`), aucun
contournement des restrictions d'écriture de ce canal.
