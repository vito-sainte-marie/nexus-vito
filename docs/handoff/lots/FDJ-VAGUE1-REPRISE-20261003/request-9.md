---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-VAGUE1-REPRISE-20261003
seq: 9
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=a4be2f1
  - id: recette-phase-c-test
    classe: VERIFIED
    valeur: 2026-10-04T11:58:57Z udljdqxerrbbbajxubfn a4be2f1, 8 contrôles + 13 mutations PASSE, ROLLBACK
  - id: preuve-sha256
    classe: VERIFIED
    valeur: 717d6a86c595d3eeb147fed5066c3d542f610641c6b44f8346276a62f070e978
  - id: c4-production
    classe: VERIFIED
    valeur: 0 caisse confirmée sur 113
  - id: phase-c-production
    classe: VERIFIED
    valeur: non appliquée (triggers garde absents, politiques d'écriture présentes)
---
# request-9 — Phase C FDJ : dossier préparé, aucune écriture Production

## 0. Pourquoi cette demande est dans ce lot

request-8 (clôture du dossier FDJ-62) n'a pas encore reçu de décision. Je ne
pouvais pas ouvrir un lot neuf : `handoff.js` refuse deux lots en attente à la
fois (`PLUSIEURS_LOTS_ACTIFS`). La Phase C appartient d'ailleurs à la même
Vague 1. **request-9 ne retire pas request-8** : une seule décision peut couvrir
les deux, ou bien deux décisions successives.

Mandat : « GO option 1 » de Frédéric, le 04/10. Il couvre trois gestes :
rejouer la recette sur nexus-test, proposer une correction du libellé C5,
déposer ce dossier. **Appliquer la Phase C en Production n'est pas autorisé.
Un cycle de test C4 en Production ne l'est pas non plus.**

## 1. Recette rejouée sur nexus-test — 2026-10-04T11:58:57Z

- Script : `supabase/phase-c/recette-test.sh` sur `origin/production` =
  `a4be2f143422b7d96d997ea1b658787c15d9c1bf`, worktree propre.
- Cible : `udljdqxerrbbbajxubfn`. Le refus de la ref Production est câblé dans
  le script.
- Fichiers joués (les blobs n'ont pas changé depuis le 17/09) :
  - corps `1cdde4aa` (sha256 `4deefefd4e2a2467e60d71060303537ffd7ca8bc48862147192d553380984764`) ;
  - mutations `dc42b24f` (sha256 `7c55c75107bd35fab6cc7e84646246938045c54c0ba2bf6cbaf604e7141d835e`) ;
  - script `02e6ec5a`.
- Phase A **déjà présente** sur Test : le corps a été joué sur le schéma en
  place, sans recharger les 12 migrations.
- Résultats :
  - « Phase C — les huit contrôles passent. » (contrôle 7.h inclus : les 10
    commandes de remplacement existent) ;
  - M1 à M13 et leurs contre-épreuves (M2 bis, M4 bis, M8 bis, M11 bis) :
    toutes « PASSE » ;
  - démontage complet : 0 fixture restante, journal re-scellé ;
  - le serveur rend `ROLLBACK` en dernière instruction ; psql sort en 0.
- Preuve engendrée, copiée sans modification dans ce lot :
  `preuve-recette-phase-c-20261004T115857Z.md`, sha256
  `717d6a86c595d3eeb147fed5066c3d542f610641c6b44f8346276a62f070e978`. Elle
  n'est **pas** commitée sur `production` : rien n'y est écrit.
- Absence d'effet durable : la preuve déclare elle-même ne pas pouvoir
  l'établir (§9.3). Je l'ai vérifiée **après coup**, en lecture seule sur Test :
  - triggers de garde : 0 ;
  - politiques INSERT/UPDATE de `fdj_cash_controls` : 2, toujours là ;
  - `insert_fdj_stock_movements` : présente ;
  - fixture `aaaaaaaa-…` dans `auth.users` : 0.

  Test est donc dans l'état d'avant la Phase C.

## 2. Conditions C1–C7 mesurées le 04/10 (Production en lecture seule et fichiers servis)

| | Mesure | Verdict |
|---|---|---|
| C1 | Phase A 12/12 en Production, aucune des 10 commandes 7.h manquante, registre 294 | ✅ |
| C2 | `NEXUS-FDJ-v1.html` servi : aucun `.from()` sur cash_controls/reports/releves_cloture/corrections ; il reste 2 lectures de `fdj_stock_movements` et aucune insertion | ✅ |
| C3 | Prise-De-Poste servie appelle `fdj_ouvrir_quart_depuis_prise_de_poste` (2 occurrences) | ✅ |
| C4 | **0 caisse confirmée sur 113 en Production** : aucune n'a parcouru brouillon → confirmation → correction → validation par les commandes | ❌ |
| C5 | Le fond est tenu, mais le libellé est périmé (§3) | ✅ sur le fond |
| C6 | Écran Manager servi : les 7 commandes sont présentes ; les `update fdj_shifts` restants ne touchent que `releve_cloture_statut`, `needs_replay`, `version` et `a_revoir`, jamais `employee_id` | ✅ |
| C7 | Aucune insertion directe dans les mouvements ; `fdj_activer_carnet` / `fdj_enregistrer_mouvement_stock` sont appelés, le second **depuis l'écran Manager** | ✅ sur le fond |

État de la Phase C en Production : **non appliquée, ni même partiellement**.
- Les politiques d'écriture sont toujours là.
- Les triggers de garde sont absents.
- Le fichier n'est pas estampillé (et ne doit pas l'être : c'est un `psql -f`
  hors `schema_migrations`).

## 3. Proposition — libellé de C5 (et note C7)

Libellé actuel : le HTML servi `NEXUS-Progression-v1.html` appelle
`fdj_ma_progression_caisse()`, sans `fdj_cash_controls(*)` ni
`.from('fdj_shifts')`.

Ce que le code servi fait aujourd'hui :
- l'appel a migré dans `nexus-caisse-source.js` servi, ligne 146 :
  `.rpc('fdj_ma_progression_caisse')` ;
- le même fichier, ligne 134, garde un chemin **manager**
  `.from('fdj_shifts').select(SELECT_FDJ_SHIFTS_BRUT)`, que la Phase C ne
  ferme pas au manager ;
- le HTML ne cite plus `fdj_cash_controls(*)` qu'en commentaire.

Pris à la lettre, le libellé actuel ne trouve pas l'appel dans le HTML et
déclare C5 « non tenue ». C'est un faux rouge. Il ne voit pas non plus le
`.from('fdj_shifts')`, qui n'est pas dans le HTML, et c'est un faux vert : le
critère regarde le mauvais fichier.

**Libellé proposé :**

> C5 — Pour l'employé, Ma Progression servie ne lit ses quarts FDJ que par
> `fdj_ma_progression_caisse()`. L'appel est aujourd'hui porté par
> `nexus-caisse-source.js`. Aucun fichier servi chargé par
> `NEXUS-Progression-v1.html` n'emploie `fdj_cash_controls(*)` hors
> commentaire. Une lecture `.from('fdj_shifts')` n'est admise que sur le chemin
> manager, aujourd'hui `nexus-caisse-source.js`.

**Note C7 proposée :**

> `fdj_enregistrer_mouvement_stock` est appelé depuis l'écran Manager, pas
> seulement depuis le flux carnets.

**Où l'inscrire — recommandation : pas dans le fichier SQL.** Le libellé vit
dans l'en-tête de `20260916230000_fdj_rls_definitives_phase_c.sql`. Le
modifier, même en commentaire, déplace son blob (`1cdde4aa`), et la recette du
§1 ne désignerait plus le fichier qu'on appliquerait. Je propose que la
décision **retienne ce libellé dans son corps** et que le fichier reste
inchangé. Une autre voie existe : une PR qui modifie l'en-tête, puis une
nouvelle recette.

## 4. Ce qui reste à arbitrer

1. **Accepter la recette du §1 et C1, C2, C3, C5, C6, C7.**
2. **Adopter le libellé C5 et la note C7 du §3**, et choisir où les inscrire
   (corps de la décision, recommandé ; ou PR suivie d'une nouvelle recette).
3. **C4 n'est pas tenue.** La tenir exige une écriture en Production. Je ne
   tranche pas ; voici les voies que je vois :
   - (a) un cycle de test sur une caisse de test en Production : GO par geste
     de Frédéric, avec une désignation explicite du site et du quart, et une
     procédure de nettoyage. Aucune n'est préparée à ce stade ;
   - (b) attendre qu'une vraie caisse parcoure le cycle. Les 0/113 laissent
     penser que le cycle confirmé n'est pas encore utilisé sur le terrain,
     donc l'attente n'a pas de borne ;
   - (c) toute autre voie que l'arbitre désigne.

   Tant que C4 n'est pas tenue, la Phase C ne s'applique pas en Production, et
   ce dossier ne demande pas qu'elle le soit.

Aucune écriture Production, aucune fusion, aucun déploiement, aucune migration
n'a été faite pour ce dossier.
