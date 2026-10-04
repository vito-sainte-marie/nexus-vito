# Rectification — version du SQL Phase C recettée (append-only)

Document ajouté le 04/10/2026. Il ne modifie pas `decision-7.md` et ne vaut
ni décision ni GO. Il corrige une désignation de fait, pas un arbitrage.

## 1. Ce que dit decision-7, et ce qui est vrai

`decision-7.md`, ligne 37 : « Le fichier SQL Phase C reste inchangé afin de
préserver le blob déjà recetté. »

C'est inexact au moment où la décision est consommée (2026-10-04T12:40:47Z).
La PR #74 avait déjà modifié l'en-tête du fichier (libellé C5, note C7, aucun
changement exécutable). Elle a été fusionnée en `30544c9` et déployée.

| | Avant #74 | Après #74 (état servi) |
|---|---|---|
| Blob de `supabase/phase-c/20260916230000_fdj_rls_definitives_phase_c.sql` | `1cdde4aa` | `b88dffd28a355573163331da17e7125a45eee82f` |
| sha256 du contenu | `4deefefd…0984764` | `c634333574fa617ffbc9df42bfce8c0a84f3dafd46497d94c0fae7f88484ea16` |
| Recette Test | 2026-10-04T11:58:57Z (request-9 §1) | **2026-10-04T12:12:44Z** |

La recette citée par request-9 (11:58:57Z) porte donc sur un blob qui n'est plus
celui du dépôt. **La version recettée qui fait foi est celle de 12:12:44Z.**

## 2. La recette de 12:12Z

- **Commit testé** : `91cf0032c790a4723a913e625deb23fb0fa84828`, branche
  `claude/phase-c-libelle-c5-20261004`, worktree propre au lancement. Ce commit
  est le dernier à toucher le fichier sur `origin/production` ; il en est
  ancêtre via `30544c9`.
- **Blob recetté** : `b88dffd28a355573163331da17e7125a45eee82f`, sha256
  `c634333574fa…484ea16`. C'est l'octet servi aujourd'hui : le sha256 du
  fichier sur `origin/production` a été re-mesuré le 04/10 et il est identique.
- **Mutations** : blob `dc42b24f`. **Script** : blob `02e6ec5a`. Ni l'un ni
  l'autre n'a changé.
- **Cible** : nexus-test `udljdqxerrbbbajxubfn`. Production n'est jamais visée ;
  le refus est câblé dans le script.
- **Résultat** :
  - « Phase C — les huit contrôles passent. » ;
  - M1 à M13 et les contre-épreuves M2 bis, M4 bis, M8 bis, M11 bis : toutes
    « PASSE » ;
  - dernière instruction rendue : `ROLLBACK`.
- **Preuve** : engendrée par le script, commitée sans retouche en `5e755687`
  (2026-10-04T12:13:13Z, avant la création de #74), présente sur
  `origin/production` :
  `supabase/phase-c/preuves/20261004T121244Z_recette-phase-c_udljdqxerrbbbajxubfn.md`,
  blob `282459f3`, sha256
  `a35fef3c4d3b002e7a063dc2c74acdd1b4c1cde9f4d0ce121b43f1933c5ba19b`.
  Le rail ne porte pas `supabase/phase-c/`. Une copie octet pour octet est
  donc déposée à côté de ce document : `preuve-recette-phase-c-20261004T121244Z.md`,
  même sha256.
- **Run ID** : **aucun run CI**. La recette Phase C s'exécute en local par
  `recette-test.sh` et n'a pas d'identifiant GitHub Actions. Son identité tient
  dans l'horodatage engendré (`2026-10-04T12:12:44Z`), le commit testé et le
  sha256 de la preuve. Le seul run lié est le **déploiement** de `30544c9`
  (run `37201658192`, « Déploiement Production (GitHub Pages) », success à
  12:18:37Z). Il publie le dépôt et ne joue aucun SQL.

L'horodatage de 12:12:00Z qui figure dans le journal de session est celui d'un
événement interne sans rapport. C'est le lancement de 12:12:43Z (preuve
12:12:44Z) qui fait foi.

## 3. Ce qui manque encore

- **Absence d'effet durable sur Test après 12:12Z** : `PREUVE_MANQUANTE`. Pour
  11:58Z, request-9 §1 l'a vérifiée après coup en lecture seule. Pour 12:12Z,
  la preuve se déclare incapable de l'établir, et aucune lecture postérieure
  n'est consignée.

## 4. Portée

- C4 reste non tenue. La voie (b) de decision-7 est inchangée : attendre un
  vrai cycle de caisse en Production, sans caisse fabriquée.
- Aucun GO Phase C n'est demandé ni impliqué. L'application exigera un GO neuf,
  sur le blob `b88dffd` ou sur celui qui sera servi à ce moment-là, après une
  nouvelle recette s'il a changé.
- Aucune écriture, migration, fusion ni déploiement Production pour ce document.
