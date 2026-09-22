# État des preuves — #62 (FDJ) et #65 (Carburants)

Répond au point 4 de la mission du 22/09/2026. Ne reconstruit, ne fusionne ni ne promeut aucune
branche. Cross-référence `dossier-decision-pr-62.md` et `dossier-decision-pr-65.md` (lot
`NEXUS-CONTINUITE-TERRAIN-1-20260920`) plutôt que de les dupliquer — ces deux dossiers restent la
source de vérité pour les mesures qu'ils portent déjà.

## 1. Acquis (ne pas remesurer sans raison)

- SHA candidats relus depuis GitHub, pas repris de confiance : `fe4e9a2` (#62),
  `fe36a8e` (#65) (`dossier-decision-pr-62.md` §1, `dossier-decision-pr-65.md` §1).
- Les deux checks requis par le ruleset `production` sont verts sur les deux SHA
  (`non-regression`, `Construire et éprouver l'artefact`) ; `Cloudflare Pages` est rouge sur les
  deux, et rouge sur toutes les branches du dépôt depuis toujours — pas une régression propre à
  #62/#65.
- Applicabilité pure des migrations candidates contre le vrai schéma Test, en transaction
  `rollback` : verte pour les deux (`dossier-decision-pr-62.md` §8.1, `dossier-decision-pr-65.md`
  §8, mesure du 22/09/2026).
- **Cause structurelle, désormais complète à sept fichiers** (et non cinq) pour laquelle la
  recette navigateur et la preuve « SHA attendu = SHA servi » sont indisponibles sur ces deux
  candidats : `nexus-auth.js` pré-refonte (932 lignes, Production en dur) et absence de la chaîne
  de build complète — voir `portage-config-candidats-prepare-2.md` §1 pour les deux fichiers que
  l'étude initiale omettait (`outils/poser-build-id.js`, `_headers`).
- Verdict humain déjà rendu : **NO GO temporaire de fusion Production** pour #62 et #65, motivé
  par l'insuffisance du dossier de preuve Test profonde — pas par un défaut fonctionnel
  (`dossier-decision-pr-62.md` §7, Frédéric, 22/09/2026). Ce verdict n'est pas rouvert ici.
- Mécanisme de portage de la configuration Test : préparé et éprouvé (§2 ci-dessus,
  `outils/porter-config-candidat-test.sh`, 9/9), **non appliqué**.

## 2. Manquant — et pourquoi ce canal ne peut pas l'obtenir aujourd'hui

| Preuve manquante | Pourquoi elle reste hors de portée de CE canal |
|---|---|
| Observation Cloudflare de ce qui est réellement construit/servi aujourd'hui pour `fdj-vague1-cycle-caisse-20260916` / la branche #65 | Aucun identifiant Cloudflare, aucun accès réseau sortant dans ce canal (constant depuis l'ouverture de l'issue #28, cohérent avec `.github/workflows/claude.yml`) |
| Cause exacte du rouge `Cloudflare Pages` sur ces deux branches (échec de build faute de fichiers manquants ? intégration GitHub↔Cloudflare cassée indépendamment du contenu ? autre chose ?) | Même limite — nécessite le tableau de bord Cloudflare |
| Recette navigateur profonde, preuve « SHA attendu = SHA servi » | Structurellement indisponible tant que le portage §2 n'est pas appliqué **et** observé (pas seulement appliqué à l'aveugle) |
| Preuve de création réelle de la migration #65 (protocole : rejouer les 276 migrations `production` puis uniquement la 277e) | Nécessite un accès Supabase Test en écriture ; aucune variable `NEXUS_TEST_DB_URL*`/`SUPABASE_TEST_DB_URL*`/`NEXUS_TEST_*_PIN` n'est présente dans ce canal (vérifié par test de présence booléen, jamais par lecture de valeur) — hors mandat de ce lot (§2.2 de `request-1.md`, non repris ici) |

## 3. Prochain geste exécutable, dans l'ordre

1. **Humain avec accès Cloudflare** : observer ce qui est réellement construit/servi aujourd'hui
   pour `fdj-vague1-cycle-caisse-20260916` et la branche #65 (étude §4, point 2 de la mission —
   déjà couvert, non repris ici faute d'accès depuis ce canal).
2. **Humain avec accès Cloudflare + push sur la branche candidate** : `bash
   outils/porter-config-candidat-test.sh <checkout>`, revue du diff, commit, push — geste distinct
   par candidat, jamais automatique, jamais vers `main`/`production` (portage-config-candidats-prepare-2.md §4).
3. **Après portage effectif et déploiement observé Test** : rejouer la recette navigateur ciblée
   sur `urlTestDeBranche(nomDeBranche)` — mécanisme déjà prouvé (§preuve-consolidee), reste à
   appeler avec le vrai nom de branche depuis une session qui dispose du réseau et des secrets
   Test.
4. **Accès Supabase Test en écriture, séparément** : rejouer le protocole de #2.2 de `request-1.md`
   pour la migration de #65 (environnement jetable, 276 puis 277 migrations).

Rien de ce qui précède ne demande d'écriture Production, de fusion, ni de promotion. Aucune étape
de cette liste n'a été exécutée par ce lot au-delà de l'étape 2 partielle (préparation du script,
pas son application).

## 4. Ce que ce document ne fait pas

Il ne prétend aucune preuve Supabase/Cloudflare acquise qui ne le serait pas. Il ne rouvre pas le
NO GO temporaire déjà rendu. Il ne mélange pas la dette de dérive de schéma Test (§3 de
`request-1.md`, séquencée après §2.1) avec #62/#65.
