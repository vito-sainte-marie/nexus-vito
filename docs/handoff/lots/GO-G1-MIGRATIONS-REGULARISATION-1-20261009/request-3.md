---
protocol: nexus-handoff/2
kind: request
lot_id: GO-G1-MIGRATIONS-REGULARISATION-1-20261009
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=e45ab43
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 128-fichiers
  - id: go-frederic
    classe: HUMAN
    valeur: go-G1-comme-prevu-dans-le-dossier-E-09-10-session
  - id: candidat
    classe: VERIFIED
    valeur: 61c5005-pointe-inchangee
  - id: preflight-10-27-39z
    classe: VERIFIED
    valeur: 298,derniere=20261006220000,md5-fdj=0418bed1d0316063def74ab81cfe71e1
  - id: production-registre
    classe: VERIFIED
    valeur: 304,derniere=20261008160000,six-versions-dans-l-ordre
  - id: controles-apres-10-38-29z
    classe: VERIFIED
    valeur: tables-3-rls-0-ligne,fdj-cash-controls-authenticated-select-seul,anon-sans-execute,162-audits-valides
  - id: advisors-10-38-41z
    classe: VERIFIED
    valeur: aucun-objet-du-lot-en-anon-ou-definer-view,sans-reference-anterieure
  - id: fusion-deploiement
    classe: VERIFIED
    valeur: aucun,production=e45ab43
---
# request-3 — G1 exécuté en Production : six migrations appliquées, contrôles §5 verts

## Objet

Rendre compte de l'exécution de G1 et demander la clôture du lot. Cette demande **remplace** la
question laissée ouverte par `request-2` (canal issue #28, 01:30Z) : ce canal n'avait aucune
connexion Supabase et s'est arrêté sans écriture, à raison. L'exécution a eu lieu ensuite depuis
la session connectée au connecteur Supabase, seul chemin d'écriture Production.

## Autorisation

- `decision-1` (ChatGPT, relais API) : G1 mûr sous sept conditions, `STOP_REQUIRED
  SUPABASE_PRODUCTION_MUTATION`, `OWNER_NEXT` Frédéric.
- GO de Frédéric, dans la session, le 09/10/2026 : « go G1. comme prevu dans le dossier E ».
  Portée : les six migrations de `61c50059f8d27efec05e289f779e8fe16909b23f`, rien d'autre. Il ne
  couvre ni G2 (PR, fusion, déploiement) ni aucun retour arrière.
- `61c5005` était toujours la pointe de `origin/verify-versement-regularisation-20261008` ;
  `origin/production` = `e45ab43`, inchangée (remesuré après l'exécution).

## Conditions de l'arbitre, une par une

1. **Six migrations seulement, dans l'ordre, une transaction chacune** : fichiers extraits par
   `git show 61c5005:<chemin>`, SHA-256 vérifiés. Chacune est passée par `execute_sql`, jamais
   `apply_migration` (qui réestampille la version). L'enveloppe était un bloc `DO` gardé :
   registre attendu exact, version absente, md5 du texte transmis. Puis `execute` du texte et
   insertion de la ligne du registre, le tout dans la même transaction.
2. **Préflight rejoué juste avant** à 10:27:39Z, en lecture seule : registre 298, dernière version
   20261006220000, aucune version `20261008%`, aucune table du lot, md5 `fdj_calculer_caisse`
   `0418bed1d0316063def74ab81cfe71e1`.
3. **Sauvegarde de `fdj_calculer_caisse` avant 160000** : prise à 10:22:57Z (md5 identique). La
   garde de 160000 revérifiait ce md5 dans sa propre transaction.
4. **Arrêt au premier écart** : aucun écart. Chaque relecture du registre a gagné exactement une
   ligne, avec la bonne version.

   | Version | Registre après | Heure (UTC) |
   |---|---|---|
   | 20261008120000 | 299 | 10:31:18 |
   | 20261008125000 | 300 | 10:32:45 |
   | 20261008130000 | 301 | 10:34:56 |
   | 20261008140000 | 302 | 10:35:37 |
   | 20261008150000 | 303 | 10:37:08 |
   | 20261008160000 | 304 | mesuré 10:38:29 |

5. **Contrôles après migration** (lecture seule, 10:38:29Z) :
   - registre **304**, dernière version 20261008160000, les six versions dans l'ordre, noms exacts ;
   - trois tables du lot présentes, RLS active, 0 ligne chacune ;
   - `fdj_cash_controls` : seul `authenticated:SELECT` subsiste ; `anon` n'a plus SELECT ;
     `authenticated` n'a plus INSERT, UPDATE, DELETE ni TRUNCATE ;
   - `regularisations_tiroirs` : `has_function_privilege` false pour `anon`, true pour
     `authenticated` ; `anon` n'exécute pas `fdj_calculer_caisse` ;
   - déclencheurs présents : `trg_audits_caisse_factures_differees`, `_regularisations`,
     `_revalidation` ; `trg_fdj_cash_controls_regularisations` ; immuabilité `ctc_`, `ertp_`,
     `evr_immuable` et leurs `_truncate` ;
   - données : 162 audits validés sur 162 ; régularisations non nulles 0 ; factures différées
     (boutique) non nulles 0 ; `factures_differees` différent de `[]` 0 ; revalidation posée 0 ;
     1 caisse FDJ non validée ; `versements_regularisation` FDJ non nuls 0.
   - Advisors de sécurité (10:38:41Z) : aucun objet du lot en `security_definer_view`,
     `anon_security_definer_function_executable` ni `rls_enabled_no_policy`. Les RPC du lot
     exécutables par `authenticated` le sont par conception (garde manager interne, identique à
     Test). Deux `function_search_path_mutable` concernent des fonctions antérieures au lot.
     **Limite** : aucune liste d'advisors n'avait été prise avant G1. « Rien de nouveau » est
     donc établi objet par objet, pas par différence exacte.
6. **Ni fusion ni déploiement** : `origin/production` est toujours `e45ab43`, aucune PR ouverte.
7. **Retour arrière** : aucun n'a été nécessaire ni tenté. La sauvegarde reste la source de celui
   de 160000, qui exigerait son propre GO.

## Ce qui reste hors de ce lot

G2 (PR `verify-versement-regularisation-20261008` → `production`, donc déploiement Pages), G3
(recette navigateur manager), G4-A1..A3, G5 debd3038 : chacun exige un GO distinct de Frédéric.
L'ancien code servi reste compatible avec le schéma neuf (dossier E §3).

## Retour attendu

Une décision `closes: true` qui constate l'exécution de G1 sur preuves mesurées, ou qui désigne
précisément la preuve manquante.
