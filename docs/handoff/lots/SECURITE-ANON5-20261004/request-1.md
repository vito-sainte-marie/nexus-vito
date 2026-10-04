---
protocol: nexus-handoff/2
kind: request
lot_id: SECURITE-ANON5-20261004
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=30544c9
  - id: sha-candidat
    classe: VERIFIED
    valeur: 7b96872aef5f3de00949cdb56b0340721104a5ad (claude/securite-anon-5-fonctions-20261004, CI run 37213615391 success)
  - id: migration-sha256
    classe: VERIFIED
    valeur: 43489265936d14bcc06b4804d31f8e511505605d296c694bd39b70d8e74730b1
  - id: production-lecture-seule
    classe: VERIFIED
    valeur: 2026-10-04T15:37:56Z uzhjpqpctpvxytxpxoqz, 5 fonctions anon=X, registre 294, 20261004130000 absente
  - id: recette-test
    classe: VERIFIED
    valeur: udljdqxerrbbbajxubfn registre 306, C01-C15 conformes avant/après
  - id: suite
    classe: VERIFIED
    valeur: 292/301
---
# request-1 — Lot sécurité anon5 : fermer `anon` sur quatre des cinq fonctions hors FDJ

## 0. Mandat et périmètre

Mandat de Frédéric du 04/10/2026, base `handoff-continuite-20260920` : ouvrir
un lot sécurité séparé pour les 5 fonctions hors FDJ exécutables par `anon` en
Production. L'audit de la garde revoke (bb10c7c) les avait relevées.

Ce qui est autorisé : audit, préparation et recette sur nexus-test.
**Aucune migration, aucune fusion, aucun déploiement et aucune écriture de
données en Production.**

Le lot est indépendant de FDJ/Phase C. Il ne touche ni C4, ni les carnets FDJ,
ni le Point Zéro inventaire. Le lot FDJ-VAGUE1-REPRISE-20261003 n'est pas actif
(`DECISION_CONSOMMEE`, decision-7) : ouvrir ce lot ne lui retire rien.

## 1. Candidat

- Branche : `claude/securite-anon-5-fonctions-20261004`.
- SHA candidat : **`7b96872aef5f3de00949cdb56b0340721104a5ad`**. Un seul
  commit, posé sur e64df4f (tête du rail).
- Diff, 4 fichiers, +293/−1 :
  - `supabase/migrations/20261004130000_revoquer_anon_quatre_fonctions_hors_fdj.sql`
    (blob `276d2ef0`, sha256 `43489265936d14bcc06b4804d31f8e511505605d296c694bd39b70d8e74730b1`) :
    nouvelle migration, strictement additive (revoke/grant seulement) ;
  - `outils/garde-revoke-fonction-roles-nommes.js` : `DETTE_GELEE` passe de
    47 à 43, et les quatre signatures sortent de la dette ;
  - `test_securite_anon_quatre_fonctions_20261004.js` : 11 cas, dont 8
    mutations refusées par leur code ;
  - `docs/handoff/MANIFESTE-MIGRATIONS-PRODUCTION-COURANT.md` : addendum
    append-only, classe « Proposée incluse dans une future release
    Production (1 migration) ».
- Aucune migration historique n'est modifiée.
- CI Tests, run 37213615391 sur 7b96872 : **success**. Les 8 étapes
  réservées au rail sont `skipped`, comme sur tout candidat de branche :
  écriture Test, SQLDYN P0, recette navigateur.

## 2. Les cinq signatures exactes

1. `public._generate_inventory_review_core(text,date,date,text)`
2. `public.generate_inventory_review(text,date,date,text)`
3. `public.inventaire_enregistrer_transfert_localise(text,uuid,uuid,uuid,uuid,numeric,text,numeric,numeric,text)`
4. `public.stats_fondateur()`
5. `public.nexus_identifiant_de_connexion(text)` — **conservée telle quelle**.

## 3. Preuves Production, en lecture seule

Projet `uzhjpqpctpvxytxpxoqz`, `begin read only`, mesure à
**2026-10-04T15:37:56Z**.

Les cinq fonctions ont les mêmes caractéristiques :
- SECURITY DEFINER, propriétaire `postgres` ;
- ACL `{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` ;
- `anon` = `authenticated` = `service_role` = EXECUTE ; PUBLIC = aucun.

| Fonction | md5(prosrc) en Production, identique à Test |
|---|---|
| core | `0203e656de2ddf313835e8bdb0e85c9e` |
| generate_inventory_review | `645c309fc34d811c577124222bfefea8` |
| transfert | `0ca4e6e3c3c9af3907d18fed0dc6820a` |
| stats_fondateur | `be4ef4ef4802ccc4eee557be9abb1726` |
| nexus_identifiant | `8686ba2d6007fc718ff17060cd34ea70` |

- `run_scheduled_inventory_reviews()` : `{postgres=X/postgres}`. Elle est
  fermée à tous les autres rôles.
- Registre Production : **294** migrations, la dernière est
  `20261004120000`. `20261004130000` est **absente**. La Production est
  intacte.

## 4. Origine des ACL et appelants

| Fonction | Migration qui a établi l'ACL | Cause |
|---|---|---|
| core | 20260803021549:176 | `revoke … from public` seul |
| generate_inventory_review | 20260803020504:174-175, 20260803021549:71 | idem |
| transfert | 20260831102427:113-114, 20260831102512:104-105 | idem |
| stats_fondateur | baseline 20260101000000:1601-1604 | `GRANT ALL … TO anon` explicite |
| nexus_identifiant | 20260904175747:79-97 | grant `anon` explicite et voulu (login non énumérable) |

Supabase accorde EXECUTE à `anon` et `authenticated` par des grants nommés.
`revoke from public` ne les retire pas.

## 5. Matrice

| Signature | Fonction métier | Appelants | ACL Production actuelle | ACL cible | Exposition anon justifiée ? | Risque | Preuve Test |
|---|---|---|---|---|---|---|---|
| `_generate_inventory_review_core(text,date,date,text)` | Calcule les agrégats de revue d'inventaire d'un site, **sans aucun contrôle d'autorisation** | Aucun écran. Appelée par `generate_inventory_review`, `run_scheduled_inventory_reviews` (DEFINER, postgres) et le cron `nexus-inventaire-reviews` (postgres, toutes les 15 min) | postgres, anon, authenticated, service_role | postgres, **service_role** | **Non, accidentelle** (et l'accès `authenticated` aussi) | **Élevé** : lecture d'inventaire inter-site par n'importe qui, avec la seule clé publique | C01 anon REFUS 42501 ; C06 manager en direct REFUS ; C07 via la RPC OK ; C12 service_role OK ; C13 cron postgres OK |
| `generate_inventory_review(text,date,date,text)` | Revue d'inventaire. Refus hors manager ou gérant du site | `nexus-inventaire-manager-donnees.js:198`, `nexus-rapport-direction-donnees.js:89`, en session authentifiée | postgres, anon, authenticated, service_role | postgres, authenticated, service_role | **Non, accidentelle** | Faible : le corps refuse anon (`accès refusé`). Fermeture par défense en profondeur | C02 anon REFUS 42501 ; C07 manager, son site OK ; C08 autre site « accès refusé » inchangé |
| `inventaire_enregistrer_transfert_localise(text,uuid,uuid,uuid,uuid,numeric,text,numeric,numeric,text)` | Transfert de stock entre zones (écriture) | `nexus-inventaire-stock-transfert-v2.js:181`, derrière `getSession` | postgres, anon, authenticated, service_role | postgres, authenticated, service_role | **Non, accidentelle** | Faible à moyen : écriture. Le corps renvoie `AUTH_REQUISE` si `auth.uid()` est nul | C03 anon REFUS 42501 ; C09 manager `QUART_INVALIDE` inchangé ; C14 transfert réel OK (stock 10 → 7, annulé) ; C15 anon, même transfert, REFUS 42501 |
| `stats_fondateur()` | Statistiques des sites. Refus hors créateur | `NEXUS-Admin-Sites-v1.html:140`, derrière nexus-auth.js | postgres, anon, authenticated, service_role | postgres, authenticated, service_role | **Non, accidentelle** | Faible : le corps renvoie « Non autorisé » à anon | C04 anon REFUS 42501 ; C10 créateur OK (3 sites) ; C11 manager « Non autorisé » inchangé |
| `nexus_identifiant_de_connexion(text)` | Résout l'identifiant de connexion **avant** authentification | `NEXUS-Login-v1.html` | postgres, anon, authenticated, service_role | **inchangée** | **Oui, voulue** (20260904175747) | Accepté : conçu non énumérable | C05 anon OK, avant comme après |

## 6. Recette nexus-test (`udljdqxerrbbbajxubfn`)

**Application** : `--single-transaction`. Registre 305 → **306**, estampille
`20261004130000 revoquer_anon_quatre_fonctions_hors_fdj`. Fin de recette
vers 15:32:31Z.

**Méthode** : la même batterie a été jouée avant et après. Les rôles sont
simulés par `set local role` et `request.jwt.claims`, avec de vrais employés
de Test. C14 et C15 utilisent des fixtures de stock créées dans une
transaction annulée ; le résidu mesuré est 0.

| Cas | Avant | Après |
|---|---|---|
| C01 anon → core | EXECUTE OK | **REFUS 42501** |
| C02 à C04 anon → les 3 RPC | atteintes, refusées par le corps | **REFUS 42501** |
| C05 anon → nexus_identifiant | OK | OK |
| C06 manager → core en direct | OK | **REFUS** |
| C07 manager → generate, son site | OK | OK |
| C08 manager → generate, autre site | accès refusé | accès refusé |
| C09 manager → transfert, uuid aléatoires | QUART_INVALIDE | QUART_INVALIDE |
| C10 créateur → stats_fondateur | OK, 3 sites | OK, 3 sites |
| C11 manager → stats_fondateur | Non autorisé | Non autorisé |
| C12 service_role → core | OK | OK |
| C13 postgres → run_scheduled | OK | OK |
| C14 manager → transfert réel | — | OK, stock 10 → 7 |
| C15 anon → même transfert | — | **REFUS 42501** |

**ACL finale sur Test** :
- core : `service_role` seul, en plus de postgres ;
- les 3 RPC : `authenticated` et `service_role` ;
- nexus_identifiant : inchangée.

**Suite locale** : `NEXUS_REF_EST_LE_RAIL=1 node run-tests.js` donne
**292/301**. « Aucune régression : seuls les 9 échecs connus subsistent. »

## 7. Absence de régression causale

- Chaque appel légitime donne le même résultat avant et après : C05, C07 à
  C13. Les seuls résultats qui changent sont les refus attendus : C01 à C04,
  C06 et C15.
- Le seul accès retiré à un appelant `authenticated` est l'appel direct à
  core (C06). Aucun écran ne le fait (git grep, épreuve A11). Les appelants
  légitimes passent par des fonctions DEFINER propriété de postgres, qui ne
  sont pas affectées (C07, C13).
- La garde revoke est conforme : dette mesurée 43 = gelée 43.

## 8. Limites déclarées

- **Pas de recette navigateur connectée.** Les parcours d'écran sont prouvés
  au niveau RPC, avec le rôle et les claims d'une vraie session, mais non
  rejoués dans le navigateur.
- **Divergence propre à Test, hors périmètre.** Sur Test,
  `run_scheduled_inventory_reviews()` est ouverte à anon, authenticated et
  service_role (md5 `bb5fa665…`). En Production, elle est fermée
  (`{postgres=X}`, md5 `45707923…`). Le lot ne la touche pas : la Production
  n'a rien à corriger, et corriger Test sortirait du mandat.

## 9. Verdict

**4 expositions accidentelles corrigées, 1 voulue conservée.** La plus grave
est core, une lecture d'inventaire inter-site accessible avec la clé
publique. La recette Test est verte, avant et après.

## 10. Gestes demandés — un GO séparé par geste, au SHA 7b96872 ; si le SHA bouge, le GO tombe

1. **Migration Production** : appliquer
   `20261004130000_revoquer_anon_quatre_fonctions_hors_fdj.sql` à l'octet
   près (sha256 `43489265…b1`) sur `uzhjpqpctpvxytxpxoqz`, en une seule
   transaction.
   - Lecture seule AVANT : la mesure du §3.
   - Lecture seule APRÈS : ACL cibles, registre 294 → 295.
   - Contrôles par rôle : C01 à C05 et C12, joués sous `begin` … `rollback`.
2. **Fusion** de la branche vers `production` par PR. Le ruleset exige deux
   checks.
3. **Déploiement** : non applicable au sens servi. Aucun fichier servi ne
   change (migration, outil, épreuve, doc). La gate Pages reste un geste à
   part si la fusion la déclenche.

Ordre proposé : 1 puis 2. La migration ne dépend d'aucun code, et le code ne
dépend pas de la migration, sauf la garde, qui ne lit que le dépôt.

**STOP. Rien n'est fait en Production avant un GO explicite.**
