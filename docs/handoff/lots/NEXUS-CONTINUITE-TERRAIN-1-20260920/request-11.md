---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 11
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=a786408 production=2bc7b39
  - id: ecart-de-forme
    classe: DECLARED
    valeur: pr_67_merge_2bc7b39_au_lieu_du_fast_forward_vers_f5398a7
  - id: production-livree
    classe: VERIFIED
    valeur: origin_production_2bc7b39dd73a35d8031f850e202095370a1db85a
  - id: parent-identique
    classe: VERIFIED
    valeur: 6c3efcc
  - id: diff-identique
    classe: VERIFIED
    valeur: 3_fichiers_55_insertions_9_suppressions_memes_noms
  - id: arbre-identique
    classe: VERIFIED
    valeur: e880821f482ffe078fd20c784e433dd5861aa16a_egal_tree_declare_dans_request_9
  - id: candidat-absent-du-depot
    classe: DECLARED
    valeur: f5398a7_injoignable_donc_comparaison_d_arbre_indirecte
  - id: migrations-touchees
    classe: VERIFIED
    valeur: 0
  - id: pr-67-fusionnee
    classe: VERIFIED
    valeur: 2026-09-21T19_45_01Z_par_vito-sainte-marie
  - id: pages-gate-humaine
    classe: HUMAN
    valeur: deployment_6576718886_success_2026-09-21T22_35_48Z
  - id: contenu-servi
    classe: VERIFIED
    valeur: sha256_identique_5_fichiers_sur_5
  - id: suite
    classe: VERIFIED
    valeur: 216/223
  - id: anti-divergence
    classe: VERIFIED
    valeur: 3_sur_3
  - id: colonnes-audits-caisse
    classe: VERIFIED
    valeur: 7_sur_7_presentes_production_lecture_seule
  - id: sites-timezone
    classe: VERIFIED
    valeur: america_martinique_sur_les_deux_sites
  - id: effet-p0-3-mesure
    classe: VERIFIED
    valeur: 2_jours_sur_66_les_19_et_20_09_zero_avant_un_apres
  - id: effet-p0-1-non-observable
    classe: DECLARED
    valeur: fenetre_20h_minuit_locale_dates_coincidaient_a_23h02Z
  - id: request-10-transporte
    classe: VERIFIED
    valeur: blob_d1e4908_verbatim_depuis_claude_issue-28-20260921-1756
  - id: decision-9-consommee
    classe: VERIFIED
    valeur: commit_f87c379_enregistre_avant_le_depot_de_request_10
  - id: handoff-verifier
    classe: VERIFIED
    valeur: conforme_31_lots_10_avertissements_baseline_rail_avant_depot
---
# Post-flight P0-1/P0-3 — le geste a eu lieu, sa forme diffère de decision-9

## 1. Ce que je demande

Ratifier — ou refuser — l'équivalence entre le geste autorisé par `decision-9.md` et le
geste réellement effectué en Production.

`decision-9.md` est explicite : « Toute différence de SHA, parent, diff, ref Production ou
contenu => **STOP immédiat** et nouvelle demande. » Il y a une différence de SHA. Cette
demande est cette nouvelle demande. Je ne présente pas l'écart comme un détail de forme à
absoudre : je le nomme, je mesure ce qui est identique, et je dis ce que ma mesure ne peut
pas établir.

## 2. L'écart, nommé

- **Autorisé** : amener `production` sur `f5398a745d2ba831bb09d0e1e99427130912dbfa` « par
  fast-forward uniquement, sans merge commit, rebase, squash ni force-push ».
- **Réalisé** : PR #67 (`release/p0-continuite-20260921` → `production`), fusionnée par
  `vito-sainte-marie` le 2026-09-21T19:45:01Z. `origin/production` vaut désormais
  `2bc7b39dd73a35d8031f850e202095370a1db85a`, un commit de fusion, avec trois commits sous
  lui : `9ceb419`, `58c863d`, `d209164`.
- **Pourquoi la forme autorisée était inexécutable.** Deux raisons indépendantes, toutes
  deux antérieures au GO :
  1. `production` est protégée par un *ruleset* : aucun push direct, PR obligatoire. Un
     fast-forward par `git push` était refusé quel que soit son contenu.
  2. `f5398a7` n'était joignable par aucune ref — `request-9.md` §1 le disait déjà, et
     `request-10.md` §2 le remesure (`git cat-file -t` => `fatal: bad object`). L'objet
     n'existait dans aucun clone : il n'y avait rien à fast-forwarder.

  Je n'ai pas exécuté ce geste, et `request-10.md` documente ce refus au moment où il a été
  pris. Le geste a été posé côté humain, par la seule voie que le dépôt laisse ouverte.

## 3. Preuves d'équivalence — et leur limite

Mesuré ce soir dans un worktree dédié, sur `origin/production` re-fetché :

| propriété | autorisé (request-9 / decision-9) | livré (`2bc7b39`) |
|---|---|---|
| parent de départ | `6c3efcc` | `6c3efcc` |
| diff | 3 fichiers, 55 insertions, 9 suppressions | identique, mêmes noms |
| arbre | `tree_e880821` déclaré pour `f5398a7` | `e880821f482ffe078fd20c784e433dd5861aa16a` |
| migrations touchées | 0 | 0 |

**Ce que cette comparaison ne fait pas.** Elle est **indirecte**. `f5398a7` est absent du
dépôt : je ne compare pas l'arbre livré à l'objet autorisé, je le compare au SHA d'arbre que
`request-9.md` a *déclaré* pour cet objet. Si ce SHA d'arbre avait été mal relevé à
l'époque, ma preuve ne le détecterait pas. C'est la meilleure preuve disponible, pas une
preuve d'identité d'objet.

## 4. Ce qui est effectivement servi

- Déploiement Pages `6576718886` : `waiting` 19:45:20Z → `queued` 22:35:14Z → `in_progress`
  22:35:16Z → **`success` 22:35:48Z**. La gate humaine d'environnement a donc retenu la mise
  en ligne environ 2 h 50 après la fusion — fusionner ne déploie pas, une fois de plus.
- Contenu servi contre contenu du dépôt, SHA-256 : **identique** pour `NEXUS-App-v1.html`,
  `nexus-app-donnees.js`, `nexus-conseiller-donnees.js`, `index.html` et
  `nexus-verify-moteur.js`.
- Les 20 scripts référencés par `NEXUS-App-v1.html` existent sur `production` (hors l'URL
  CDN attendue). En particulier `nexus-verify-moteur.js`, que ce lot rend nouvellement
  nécessaire, est présent et identique : pas de dépendance manquante, donc pas la panne
  totale que ce dépôt a déjà connue quand un candidat exigeait un fichier absent.

## 5. Épreuves rejouées sur l'arbre livré

- Suite complète sur `2bc7b39` : **216/223**, avec exactement les 7 rouges de la liste de
  `request-9.md` §5 — aucun nouveau.
- Épreuve ciblée `test_app_donnees_carburants_anti_divergence_v2224.js` : **3/3**.

## 6. Le risque résiduel de request-9 §8 est fermé

`request-9.md` §8 laissait ouvert : « La vérification en direct des colonnes `ecart_piste` /
`ecart_boutique` / `valide_le_*` contre Production réelle […] reste à faire par une session
avec accès Supabase. » Fait, en lecture seule, sur Production :

- `public.audits_caisse` porte les 7 colonnes lues par le correctif : `date` (date, NOT
  NULL), `quart` (text, NOT NULL), `site` (text, NOT NULL), `ecart_piste` (numeric),
  `ecart_boutique` (numeric), `valide_le_piste` (timestamptz), `valide_le_boutique`
  (timestamptz).
- `public.sites.timezone` vaut `America/Martinique` pour `vito-sainte-marie` comme pour
  `site-fantome-test` : P0-1 a de quoi opérer, il ne retombe pas sur son repli.

## 7. Effet mesuré sur les données réelles

- **P0-3** (compter les validations Verify réelles) : sur 66 jours (2026-07-18 → 2026-09-21),
  le correctif change le compte affiché en Accueil manager **2 jours** — 2026-09-19 et
  2026-09-20, chacun `0` avant correctif contre `1` après. La seule ligne du jour (quart 1,
  deux composantes validées) ne discrimine pas : ancien et nouveau rendent `1`.
- **P0-1** (dater au fuseau station) : la fenêtre de divergence est 20:00 → minuit local. À
  23:02Z la date locale et la date UTC coïncidaient (2026-09-21) : **l'effet n'était pas
  observable à cet instant**. Sa preuve reste les 8 contrôles unitaires de `request-9.md` §4,
  pas l'horloge de ce soir.

## 8. Réserves que je laisse au registre

- `NexusVerifyMoteur.statutValidationQuart` ne peut jamais rendre `'ajuste'` depuis ce site
  d'appel : `chargerControlesVerifyRestants` ne sélectionne pas
  `premiere_validation_le_*` / `valide_par_*`. Sans effet sur le compte — `'valide'` et
  `'ajuste'` sont tous deux acceptés — mais piège si ce statut devait un jour être *affiché*
  depuis ce site d'appel.
- La CI ne prouve toujours pas le Handoff sur ce rail. L'étape « Immuabilité des migrations
  déjà en production » casse et **saute les 45 étapes suivantes**, dont toutes les épreuves
  Handoff. Le verdict réel se prend avec `NEXUS_BASE_BRANCH=handoff-continuite-20260920` :
  **263/274**, deux rouges préexistants. Le rouge que ce dépôt va afficher après ce commit
  est cet artefact-là, pas une régression du lot.

## 9. Gestes de registre posés avec cette demande

- `decision-9.md` est marquée **consommée** (commit `f87c379`). Son horodatage est celui de
  l'enregistrement, pas celui de la lecture — la décision a été lue et suivie vers 18:02,
  quand `request-10.md` a été écrit en réponse. Cet enregistrement devait précéder le dépôt
  de `request-10`/`request-11` : une fois une demande plus récente sur le rail, `handoff.js
  consommer` refuse définitivement (« une décision périmée ne se consomme pas »), et le
  registre aurait porté pour toujours une décision suivie mais jamais consommée.
- `request-10.md` est **transporté verbatim** depuis `origin/claude/issue-28-20260921-1756`
  (blob `d1e4908`, inchangé au bit près). Il n'est pas amendé : c'est une entrée de journal
  vraie à son horodatage, écrite avant la fusion. Le post-flight est une séquence nouvelle,
  celle-ci.

## 10. Ce que je ne fais pas

Aucune écriture Production n'est demandée ici, et aucune n'a été faite par moi.
`outils/correction-horaires-production-a-executer-par-frederic.sql` reste non appliqué. Les
dettes ouvertes relevées par ailleurs — `TRUNCATE` accordé à `anon`/`authenticated` sur 144
tables sur 161, rôle du jour non contrôlé côté RLS — ne sont pas dans ce lot et n'ont pas été
touchées.
