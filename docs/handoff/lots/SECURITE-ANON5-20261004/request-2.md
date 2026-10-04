---
protocol: nexus-handoff/2
kind: request
lot_id: SECURITE-ANON5-20261004
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=30544c9
  - id: decision-consommee
    classe: VERIFIED
    valeur: decision-1 655158c consommée en 3883551
  - id: sha-candidat
    classe: VERIFIED
    valeur: origin/claude/securite-anon-5-fonctions-20261004=7b96872aef5f3de00949cdb56b0340721104a5ad au moment d'écrire
  - id: migration-sha256
    classe: VERIFIED
    valeur: 43489265936d14bcc06b4804d31f8e511505605d296c694bd39b70d8e74730b1 (blob git = fichier appliqué, cmp)
  - id: production-avant
    classe: VERIFIED
    valeur: 2026-10-04T15:50:30Z read only, 5 fonctions anon=X, registre 294, 20261004130000 absente
  - id: production-apres
    classe: VERIFIED
    valeur: 2026-10-04T15:51:09Z read only, ACL cibles, nexus_identifiant et run_scheduled inchangées, md5 inchangés, registre 295
  - id: controles-roles
    classe: VERIFIED
    valeur: 2026-10-04T15:51:32Z sous rollback, C01-C04 42501, C05 OK, C12 OK
---
# request-2 — Lot sécurité anon5 : geste 1 fait (migration Production), GO de fusion demandé

## 0. Autorisation consommée

- `decision-1.md` (655158c) : GO de Frédéric Bragance, rendu en session le
  04/10/2026, « GO migration Production anon5 au SHA 7b96872 ». Elle couvre le
  **geste 1 seulement**.
- La décision a été consommée sur le rail (3883551) avant toute écriture.

## 1. Contrôles avant écriture

- `origin/claude/securite-anon-5-fonctions-20261004` = `7b96872aef5f3de00949cdb56b0340721104a5ad`.
  Le SHA n'a pas bougé.
- `git show 7b96872:…/20261004130000_revoquer_anon_quatre_fonctions_hors_fdj.sql`
  a pour sha256 `43489265936d14bcc06b4804d31f8e511505605d296c694bd39b70d8e74730b1`.
  Ce blob est identique, octet pour octet (`cmp`), au fichier appliqué.
- Lecture seule AVANT, à **2026-10-04T15:50:30Z** : identique à la mesure du
  §3 de request-1.
  - Les 5 fonctions ont l'ACL `{postgres,anon,authenticated,service_role}=X`.
  - Les md5 de `prosrc` sont inchangés.
  - `run_scheduled_inventory_reviews` = `{postgres=X/postgres}`.
  - Registre : **294**, dernière migration `20261004120000`, `20261004130000`
    absente.

## 2. Application

- Projet `uzhjpqpctpvxytxpxoqz`, connecteur Supabase (`execute_sql`), rôle
  postgres, vers **15:50:50Z**.
- **Une seule transaction** : `begin;`, puis le fichier à l'octet près, puis
  `insert into supabase_migrations.schema_migrations(version, name) values ('20261004130000','revoquer_anon_quatre_fonctions_hors_fdj');`,
  puis `commit;`.
- Aucune erreur.
- `apply_migration` n'a pas été utilisé : il aurait estampillé l'heure
  courante.

## 3. Lecture seule APRÈS, à 2026-10-04T15:51:09Z

`has_function_privilege` est mesuré par rôle.

| Fonction | ACL | anon | authenticated | service_role | md5(prosrc) |
|---|---|---|---|---|---|
| `_generate_inventory_review_core(text,date,date,text)` | `{postgres=X/postgres,service_role=X/postgres}` | non | non | oui | `0203e656…` inchangé |
| `generate_inventory_review(text,date,date,text)` | `{postgres,authenticated,service_role}=X` | non | oui | oui | `645c309f…` inchangé |
| `inventaire_enregistrer_transfert_localise(…)` | `{postgres,authenticated,service_role}=X` | non | oui | oui | `0ca4e6e3…` inchangé |
| `stats_fondateur()` | `{postgres,authenticated,service_role}=X` | non | oui | oui | `be4ef4ef…` inchangé |
| `nexus_identifiant_de_connexion(text)` | **inchangée** `{postgres,anon,authenticated,service_role}=X` | oui | oui | oui | `8686ba2d…` inchangé |
| `run_scheduled_inventory_reviews()` | **inchangée** `{postgres=X/postgres}` | non | non | non | `45707923…` inchangé |

- Registre : **295**, dernière migration
  `20261004130000 revoquer_anon_quatre_fonctions_hors_fdj`.
- Les ACL finales sont identiques à celles de la recette nexus-test.

## 4. Contrôles par rôle en Production, sous `begin` … `rollback`, à 15:51:32Z

Méthode : `set local role` dans un sous-bloc, état capturé par SQLSTATE, puis
`rollback` de l'ensemble. Les identifiants utilisés sont inexistants.

| Cas | Rôle | Appel | Résultat |
|---|---|---|---|
| C01 | anon | `_generate_inventory_review_core` | **REFUS 42501** |
| C02 | anon | `generate_inventory_review` | **REFUS 42501** |
| C03 | anon | `inventaire_enregistrer_transfert_localise` | **REFUS 42501** |
| C04 | anon | `stats_fondateur` | **REFUS 42501** |
| C05 | anon | `nexus_identifiant_de_connexion` | **OK** (la connexion reste ouverte) |
| C12 | service_role | `_generate_inventory_review_core` | **OK** |

Les 6 cas sont conformes au §10 de request-1 et à la recette Test.

## 5. Limites

- Les appels légitimes en session `authenticated` (C07 à C11) n'ont pas été
  rejoués en Production. Le §10 ne les demandait pas.
- Ils restent prouvés sur Test, et l'ACL `authenticated` des trois RPC est
  constatée en Production (§3).
- Aucune recette navigateur connectée n'a été faite.

## 6. État et gestes restants — un GO séparé par geste, au SHA 7b96872 ; si le SHA bouge, le GO tombe

- Geste 1 : **fait**. La Production porte désormais la migration et son
  estampille.
- Geste 2 : **fusion** de `claude/securite-anon-5-fonctions-20261004`
  (7b96872) vers `production`, par PR. Le ruleset exige deux checks.
  - **Non fait.** GO explicite attendu.
  - Tant que la fusion n'est pas faite, `production` ne porte pas le fichier
    d'une migration déjà appliquée : c'est l'écart registre/dépôt habituel
    entre les gestes 1 et 2.
- Geste 3 : **déploiement**, non applicable au sens servi, car aucun fichier
  servi ne change. La gate Pages reste un geste à part si la fusion la
  déclenche.

**STOP. Aucune fusion ni aucun déploiement avant un GO explicite.**
