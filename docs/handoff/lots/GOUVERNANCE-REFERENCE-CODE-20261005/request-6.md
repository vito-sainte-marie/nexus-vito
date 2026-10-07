---
protocol: nexus-handoff/2
kind: request
lot_id: GOUVERNANCE-REFERENCE-CODE-20261005
seq: 6
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=e45ab43
  - id: production-mouvement-identifie
    classe: VERIFIED
    valeur: 13-commits-19-fichiers-c259476..e45ab43-PR78-82
  - id: production-mouvement-scope
    classe: VERIFIED
    valeur: client-en-compte-comptes-clients-bons-factures-ocr-une-migration-additive-20261006220000
  - id: production-mouvement-gouvernance-intacte
    classe: VERIFIED
    valeur: diff-stat-vide-sur-.github-workflows-docs-handoff-outils-handoff.js
  - id: production-ancestry
    classe: VERIFIED
    valeur: c259476-ancetre-de-e45ab43-merge-base-rail-production-inchange-501c0c7-aucun-rebase
  - id: divergence-d4-actualisee
    classe: DECLARED
    valeur: 677-rail-seul-203-production-seule-D4-hors-perimetre-inchange
  - id: arbitrage-humain-origine
    classe: HUMAN
    valeur: Frederic-mouvements-intentionnels-client-en-compte-resultats-satisfaisants-validation-differee-debut-mois-prochain
  - id: commentaire-source-non-disponible
    classe: DECLARED
    valeur: contenu-du-commentaire-6028170929-absent-du-contexte-de-cette-session-mesure-refaite-independamment
  - id: request5-conditions-inchangees
    classe: DECLARED
    valeur: voies-A-B-D1-D4-de-request-5-non-tranchees-par-ce-complement
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-ecriture-aucune-migration-aucun-merge-aucun-deploiement-par-cette-session
---
# request-6 — complément d'arbitrage humain sur l'origine des mouvements Production ; requalification de `request-5`

Fait suite à `request-5.md` (toujours `AWAITING_DECISION`, aucune décision-5 encore rendue) et au complément d'arbitrage humain donné par Frédéric dans l'issue #28 : les mouvements Production observés depuis le dépôt de request-5 sont intentionnels, pour le chantier « Client en compte » ; les résultats sont actuellement satisfaisants ; la validation métier définitive reste à confirmer début de mois prochain, lors de la prochaine campagne réelle de factures et de bons.

**Précision honnête avant tout** : cette session n'a pas dans son contexte le texte du commentaire qui a initialement qualifié ces mouvements (celui que le complément humain appelle à ne pas requalifier d'« inattendus » du seul fait de leur existence). Plutôt que de citer un contenu que je n'ai pas vu — ce qui fabriquerait un passé non vérifié, exactement ce que `PROTOCOL.md`/A18 interdit —, cette demande repart d'une **mesure fraîche et indépendante** du dépôt, au HEAD canonique courant du rail (`d97efbd`, identique à `origin/handoff-continuite-20260920`). Les conclusions ci-dessous sont vérifiées par ce dépôt lui-même, pas déduites du commentaire manquant.

## 1. Mouvement Production mesuré (06/10 → 07/10/2026)

| | Valeur |
|---|---|
| `origin/production` au dépôt de request-5 | `c259476fa51e46f3b30fdd93918f2f78b88aec04` (inchangé depuis le 05/10 17:51Z) |
| `origin/production` mesuré maintenant | `e45ab43ffb8383a6b277f7e95ace913308ab56bb` (06/10/2026 18:44:21 -0400) |
| Ascendance | `c259476` est un ancêtre direct de `e45ab43` (`git merge-base --is-ancestor` confirmé) — avance rapide pure, aucun rebase, aucun force-push |
| Merge-base rail ↔ production | `501c0c7` — **inchangé** par rapport à request-5 §1 |
| `origin/main` | `d6093b7` — **inchangé** par rapport à request-5 §1 |
| Commits ajoutés à production depuis `c259476` | **13**, via 5 merges (`#78` à `#82`) |
| Commits rail-seul / production-seule (recomptés) | 677 / 203 (étaient 676 / 190 à request-5 ; +1 rail = ce lot lui-même, +13 production = exactement les 13 commits ci-dessous — recoupement exact, aucun mouvement non comptabilisé) |

## 2. Identification exacte des commits/fichiers/migration

Les 13 commits, par PR fusionnée :

- **#78** `bons-comptes-clients-20261006` — `9261fe6` « Comptes clients : bons manquants confirmés, KPI « envoyées sans bons » »
- **#79** `watcher-bons-client-20261006` — `0ffcb28` « fix(watcher): insert/maybe_single compatibles supabase-py ≥ 2 »
- **#80** `bouton-voir-documents` — `4b8d82f` « Bouton « Voir » : ouvrir une facture ou un bon depuis les deux écrans », `36caa3e` (épreuve build.sh)
- **#81** `doublons-documents-sha` — `9c08bbe` « Boîte de réception : doublons OCR refusés, listés et supprimables »
- **#82** `invoices-methode-nom-decenium-20261006` — `9574d7c` (migration), `329be5d`/`9e45c37` (empreinte + qualification), merge `e45ab43`

19 fichiers touchés au total (`git diff --stat c259476..e45ab43`) : `NEXUS-Comptes-Clients-v1.html`, `NEXUS-Boite-Reception-v1.html`, `nexus-identification-client.js`, `nexus-doublons-documents.js`, `nexus-voir-document.js`, `nexus-envoyer-facture-index.ts`, `nexus-ocr-worker/dossier_watcher.py`, 5 fichiers `test_*_20261006.js`, `docs/deploiement/qualification-ordre-migration-code.json`, `.github/deploiement/test_empreinte_artefact_20260915.js`, et le dossier `outils/epreuve-invoices-nom-decenium-20261006/` (5 fichiers de preuve de migration : `avant.sql`/`apres.sql`/`derive.sql`/`echafaudage-storage.sql`/`executer.sh`), plus **une seule migration** : `supabase/migrations/20261006220000_invoices_methode_identification_nom_decenium.sql`.

**La migration** élargit le `CHECK` de `invoices.methode_identification` (7 valeurs → 8, ajout de `'nom_decenium'`) pour que le watcher du dossier surveillé cesse d'échouer (23514) sur deux comptes clients Decenium qui partagent un e-mail. Elle est documentée en tête de fichier : aucune donnée, aucun privilège, aucune fonction/vue/policy/trigger touché ; garde explicite qui refuse de s'appliquer si la contrainte constatée diverge de la définition attendue ; rollback documenté. Le registre `docs/deploiement/qualification-ordre-migration-code.json` porte une qualification **mesurée en lecture seule contre la vraie Production avant fusion** (`claude`, 2026-10-06T22:25:33Z, cible `uzhjpqpctpvxytxpxoqz`, `begin read only … rollback`) : `etat: additive_compatible_avant_code`, registre 297 migrations, contrainte constatée identique à celle que la garde exige. C'est une preuve `VERIFIED` déjà déposée dans l'historique de `production` lui-même, pas une déclaration non vérifiable.

**Conclusion sur l'identification** : les 13 commits correspondent exactement au chantier « Client en compte » (comptes clients, bons, factures, identification client, boîte de réception OCR) ou à ses dépendances explicitement justifiables (fiabilité du watcher qui alimente ce pipeline, bouton de visualisation partagé facture/bon, détection de doublons dans la même boîte de réception). Aucun fichier ne sort de ce périmètre.

## 3. Invariants, preuves et périmètre de `GOUVERNANCE-REFERENCE-CODE-20261005` — intacts

`git diff --stat c259476..e45ab43 -- .github/workflows docs/handoff outils/handoff.js` est **vide** : aucun de ces 13 commits ne touche un workflow, le registre Handoff ou son outillage. Rien dans ce mouvement n'altère les conditions 1 à 6 de `decision-4.md`, ni les preuves déjà déposées dans `request-1.md` à `request-5.md`, ni la qualification de dette D1-D4 de `request-5` §4 (toujours ouverte, inchangée, voir §4 ci-dessous). Le mouvement Production est donc, par construction, **hors du périmètre applicatif que ce lot n'a jamais eu vocation à toucher** — ce lot n'a jamais rien écrit sur `production` ni ne l'a jamais proposé.

**Aucune anomalie trouvée.** Aucun fichier du mouvement ne sort du scope « Client en compte + dépendances directes » décrit au §2.

## 4. Ce que ce complément ne change pas dans `request-5`

Les questions posées à l'arbitre par `request-5` §5 (voie A ou B pour D1/D3, qualification de D2, sortie formelle de D4 du périmètre) restent **entièrement ouvertes et inchangées** — ce complément ne les tranche pas et ne prétend pas le faire. Ce `request-6` s'ajoute à `request-5`, il ne le remplace pas (append-only) : la demande active devient `request-6.md`, mais le contenu de `request-5` reste la matière à arbitrer sur D1-D4.

## 5. Validation métier différée — contrôle distinct, pas un blocage du rail de gouvernance

Conformément au complément humain : « résultats actuellement satisfaisants » ne vaut pas validation définitive du chantier « Client en compte ». La validation réelle (campagne de factures et de bons de début de mois prochain) reste un **contrôle métier différé, suivi séparément**. Les périmètres étant indépendants (§3 : aucun invariant/preuve/fichier de ce lot de gouvernance n'est concerné par le mouvement Production), cette session ne fait pas de cette validation différée une condition de clôture ou un blocage de `GOUVERNANCE-REFERENCE-CODE-20261005`.

## 6. Qualification du STOP

Le mouvement Production entre `c259476` et `e45ab43` est **expliqué, borné au chantier « Client en compte » et à ses dépendances justifiables, et sans effet sur les invariants de ce lot**. Sur la base de cette mesure et de l'arbitrage d'autorité humaine de Frédéric, cette session considère la condition 6 de `decision-4.md` (« mouvement inattendu de Production ») comme **non déclenchée** par ce mouvement précis — à l'arbitre de confirmer ou d'infirmer cette lecture.

## 7. Ce que cette demande n'autorise pas

Aucune fusion Production, aucune migration Production, aucune écriture Supabase Production, aucun déploiement, aucune promotion applicative. Aucune mesure de `production` au-delà de la lecture Git déjà citée (aucun accès réseau/identifiants Supabase disponible dans cette session). Aucun traitement des 20 migrations rail-only (D4, toujours hors périmètre). Tout nouveau rouge CI inexpliqué, toute divergence d'autorité, toute contamination applicative du rail ou tout mouvement Production réellement inexpliqué impose un STOP et un retour à l'arbitrage (condition 6 de decision-4, inchangée).
