---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 18
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: workflow-preuve-candidate-logique
    classe: VERIFIED
    valeur: commit-20af9f6-contents-read-seul-fail-closed-verifie-par-lecture
  - id: isolation-preview-test-execution
    classe: DECLARED
    valeur: cloudflare-deploy-et-run-CI-rapportes-par-canal-outille-non-reverifiable-ici
  - id: ancetre-candidate-production
    classe: VERIFIED
    valeur: merge-base-egal-2bc7b39-ahead-8-behind-0
  - id: login-absent-du-diff-65
    classe: VERIFIED
    valeur: git-diff-stat-production-candidate-ne-cite-pas-NEXUS-Login-v1-html
  - id: login-candidate-requete-anonyme-employees-public
    classe: VERIFIED
    valeur: ilike-nom-prenom-message-exact-prenom-non-reconnu
  - id: migration-login-non-enumerable-sequencage
    classe: VERIFIED
    valeur: 20260904175747-en-tete-ordre-de-promotion-incompatible-avec-code-production
  - id: rail-porte-deja-le-correctif-login
    classe: VERIFIED
    valeur: NEXUS-Login-v1-html-du-rail-appelle-rpc-nexus-identifiant-de-connexion
  - id: employees-table-contenu-test
    classe: DECLARED
    valeur: comptes-manager-createur-employe-a-b-rapportes-par-canal-outille
  - id: migration-65-absente-de-test
    classe: DECLARED
    valeur: coherent-avec-classement-gates-etat-git-62-65-1-md-gate-deja-ouverte
  - id: attribution-ci-non-rouverte
    classe: VERIFIED
    valeur: 20af9f6-ajoute-uniquement-un-fichier-workflow-aucun-fichier-applicatif-ou-test
  - id: aucune-correction-appliquee
    classe: VERIFIED
    valeur: git-status-propre-aucun-fichier-modifie-dans-cette-session
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# `#65` — l'échec de login authentifié est un drift Test/Production préexistant, pas une régression du candidat ; attribution CI non rouverte

## 1. Ce qui a été vérifié matériellement dans cette session (Git seul, aucun réseau/secret)

- **Commit `20af9f6`** existe bien sur `origin/rebuild/carburants-65-20260922` (déjà présent dans ce
  clone, aucun `git fetch` requis) et n'ajoute **qu'un seul fichier**,
  `.github/workflows/recette-candidat-65.yml` — `permissions: contents: read`, aucun `deploy`,
  aucune migration. Sa logique correspond exactement à la description : il attend que
  `nexus-build.js` de la preview annonce le SHA du push, vérifie ensuite que `nexus-config.js`
  annonce `environnement: "test"`, cible `https://udljdqxerrbbbajxubfn.supabase.co`, et **refuse**
  (`exit 1`) si la référence Production `uzhjpqpctpvxytxpxoqz` apparaît. La logique de la gate
  d'isolation est donc réelle et fail-closed — son **exécution réelle** (Cloudflare a-t-il servi ce
  SHA, le job a-t-il passé) reste une valeur *déclarée* par le canal outillé : ce canal-ci n'a ni
  réseau ni `gh` fonctionnel pour la rejouer (confirmé par `request-17.md`, inchangé).
- **`rebuild/carburants-65-20260922` est un descendant direct de `production`** : `git merge-base
  origin/production origin/rebuild/carburants-65-20260922` = `2bc7b39` = la tête exacte de
  `origin/production`. Exactement 8 commits d'écart, 0 en retard :
  `fbf113b, ffb520b, fe36a8e` (le lot #65 lui-même) puis `290a217, 664af98, a31b2e4, 1ba8b88, 20af9f6`
  (portage isolation + harnais + cette preuve).
- **`NEXUS-Login-v1.html` n'apparaît dans aucun de ces 8 commits** : `git diff --stat origin/production
  origin/rebuild/carburants-65-20260922` ne le cite pas. Confirmé.
- **Le candidat interroge bien `employees_public` en anonyme** (précision par rapport au réveil :
  c'est la vue `employees_public`, pas la table `employees` directement) :
  `.from("employees_public").select("username").ilike("nom", prenom).maybeSingle()`, et affiche
  très exactement *« Prénom non reconnu. Vérifiez l'orthographe ou contactez le manager. »* quand
  `employee` est faux — le message rapporté par le réveil est donc la sortie exacte de ce chemin de
  code, pas une approximation.
- **`supabase/migrations/20260904175747_login_non_enumerable.sql`** (déjà committée, versionnée,
  lisible sans aucun accès réseau) révoque explicitement `select` sur `employees_public` pour `anon`
  et bascule la vue en `security_invoker = true`, en même temps qu'elle crée la fonction
  `nexus_identifiant_de_connexion(p_prenom)` comme unique remplaçant non énumérable. Son propre
  en-tête dit, mot pour mot : *« ORDRE DE PROMOTION — INCOMPATIBLE AVEC LE CODE ACTUELLEMENT EN
  PRODUCTION. L'écran de connexion servi par GitHub Pages interroge encore la vue en anonyme :
  appliquer cette migration à la production AVANT d'y promouvoir le nouveau NEXUS-Login-v1.html
  rendrait la connexion impossible. »* Ce n'est donc pas une découverte : c'est un écart **déjà
  documenté et volontairement séquencé** au moment même où la migration a été écrite (04/09/2026),
  bien avant l'ouverture de `#65`.
- **Le rail `handoff-continuite-20260920` porte déjà le correctif** : son propre
  `NEXUS-Login-v1.html` (HEAD de ce checkout) appelle `client.rpc("nexus_identifiant_de_connexion",
  { p_prenom })`, jamais la vue en anonyme. C'est cohérent avec le fait que le rail a eu 475 commits
  pour intégrer ce correctif pendant que `#65` restait bâti sur `production`, qui ne l'a jamais reçu.
- **Aucune trace antérieure de ce point dans ce lot** : aucun des documents déjà déposés
  (`classement-gates-etat-git-62-65-1.md`, `etude-isolation-test-candidats-web-1.md`,
  `preuve-restauration-minimale-65-20260924.md`, `request-1.md` à `request-17.md`) ne mentionne
  `login`/`prénom`. C'est un fait réellement nouveau apporté par cette exécution du canal outillé,
  pas une redite.

## 2. Ce qui reste déclaré, non re-vérifiable depuis ce canal

Le déploiement Cloudflare réel du SHA `20af9f6`, le résultat effectif du job CI (gates 1 à 3
passées, échec à 30 s sur la recette authentifiée), et le contenu de `public.employees` sur
`nexus-test` (Manager/Créateur/Employé A/B présents et actifs) sont des faits mesurés par le canal
GitHub outillé, avec accès réseau/Supabase/Cloudflare que ce canal n'a pas (confirmé de nouveau :
aucun secret Test dans l'environnement, `gh`/`curl` hors approbation). Ils sont retenus tels quels,
classés `DECLARED`, cohérents avec tout ce qui est vérifiable ici.

## 3. Classification — attribution CI non rouverte, gates mises à jour

- **Attribution CI des 12 échecs (`decision-10.md`)** : **non rouverte**. `20af9f6` n'ajoute qu'un
  fichier de workflow CI, ne touche ni fichier applicatif ni fichier de test ; `1ba8b88` reste
  l'unique commit sur lequel portait l'attribution close par `decision-10.md` §1. Rien dans cette
  session n'y revient.
- **Gate « isolation Supabase Test des candidats web »** (`classement-gates-etat-git-62-65-1.md`
  §2, notée « portage non fait, différé pour observation Cloudflare humaine ») : **portage effectué**
  et **logique de preuve fail-closed réellement commitée** (§1 ci-dessus). L'exécution/le résultat
  restent `DECLARED` faute d'accès depuis ce canal, mais le geste que `request-17.md` §3.1 attendait
  d'« une session/un compte disposant de droits d'écriture » a eu lieu. Cette gate n'est donc plus
  « non entamée » — elle passe à *portée, résultat déclaré non re-vérifié depuis ce canal*.
- **Gate « recette navigateur authentifiée »** : tentée réellement pour la première fois de tout ce
  lot (les sessions précédentes ne pouvaient que constater l'absence de voie d'accès). Le résultat
  — échec sur le login — n'est **pas** une régression `#65` : c'est un drift Test/Production
  préexistant et documenté depuis le 04/09/2026 (§1), qui toucherait de façon identique n'importe
  quel candidat bâti sur `production` non touché par le correctif Login (`#62` y compris, même
  chaîne de build, même base). La gate reste donc **ouverte**, mais sa cause est reclassée : ce
  n'est plus « aucune voie d'accès », c'est « le login échoue structurellement pour tout candidat
  Production non corrigé, tant que `nexus-test` porte la fermeture anonyme et que le candidat ne
  porte pas le correctif ».
- **Gate « preuve de création réelle de la migration `#65` »** : inchangée, toujours ouverte
  (confirmé par le fait #7 du réveil : `nexus-test` ne porte pas encore
  `20260919103000_carburant_reception_regularisation_releve_manuscrit.sql`).
- **Gate « dérive de schéma Supabase Test »** : inchangée, toujours séquencée après les précédentes.

## 4. Pourquoi aucune correction n'est appliquée à `#65` dans cette session

Conformément à la consigne explicite : **aucun fichier n'a été modifié**. Importer le
`NEXUS-Login-v1.html` du rail sur le candidat masquerait le drift au lieu de le documenter, et
constituerait une modification applicative hors du périmètre de `#65` (le lot porte sur la
régularisation de réception carburant, pas sur l'authentification). `git status` reste propre dans
cette session.

## 5. Plus petit chemin conforme pour juger `#65` — trois options, aucune tranchée ici

Toutes les voies identifiées touchent soit une action Production, soit un coût/accès nouveau, soit
la sémantique d'une gate de sécurité déjà nommée — chacune est un motif d'arrêt explicite au sens
de la consigne :

1. **Baseline Production-équivalente isolée et jetable** : rejouer les 276 migrations `production`
   puis, seule, la migration `#65`, sur un projet Supabase jetable qui n'a jamais reçu
   `login_non_enumerable`. C'est exactement le protocole déjà nommé par
   `classement-gates-etat-git-62-65-1.md` §2/§3 pour la gate de preuve de migration — il résoudrait
   *aussi* le login, puisque cette baseline se comporterait comme `production` aujourd'hui.
   Bloqué, inchangé : nécessite un projet Supabase supplémentaire (coût/accès), hors de portée de
   tout canal utilisé jusqu'ici.
2. **Authentification directe dans le harnais de recette**, en contournant la recherche anonyme de
   prénom pour appeler `signInWithPassword` avec l'identifiant technique déjà public dans ce fil
   (motif `<username>@vito-nexus.local`) : ne toucherait ni fichier applicatif, ni RLS, ni secret
   nouveau — mais redéfinirait ce qu'une « recette navigateur authentifiée » est censée prouver
   (elle ne validerait plus l'écran de connexion réel, seulement les écrans qui le suivent). Une
   gate de sécurité déjà nommée par plusieurs décisions de ce lot ne se réinterprète pas
   silencieusement — proposé ici, non implémenté.
3. **Traiter le correctif Login comme son propre lot**, séquencé indépendamment de `#65`, pour
   décider quand/si le promouvoir en Production (le rail le porte déjà) — question de priorité et
   de sécurité (fuite d'énumération de prénoms, connue et documentée depuis le 04/09/2026, encore
   ouverte en Production aujourd'hui) qui dépasse le périmètre de ce lot.

## STOP

Aucune de ces trois options n'est un geste déterministe sans nouvelle décision : la 1 est une
action/coût hors périmètre Test gratuit, la 2 touche la définition d'une gate de sécurité déjà
arbitrée, la 3 est une question de priorité produit/sécurité distincte de `#65`. Conformément à la
consigne du réveil, cette session s'arrête ici plutôt que de choisir seule.

## Ce que cette session ne fait pas

Aucune correction de `NEXUS-Login-v1.html` sur le candidat ni ailleurs. Aucun portage/copie depuis
le rail. Aucune réouverture de l'attribution CI. Aucun accès Cloudflare/Supabase/`gh` tenté au-delà
des lectures Git déjà présentes dans ce clone. Aucune préparation de dossier de gate Production —
les gates `#65` restent non toutes closes.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production, aucun
secret lu/exposé, aucune nouvelle règle métier/UX/rôle/RLS/sécurité, aucune baisse de gate.
`NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste le rail canonique.
