---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-A6-ECRITURE-DIRECTE-20261011
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=c516322 production=6a59137
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 142-fichiers
  - id: pr99-tete
    classe: VERIFIED
    valeur: aa0a9d8316573b313612d80efa55782ce3501148
  - id: epreuve-rollback-test
    classe: VERIFIED
    valeur: 129-essais-0-ecart
  - id: registre-test
    classe: VERIFIED
    valeur: 317
  - id: registre-production
    classe: VERIFIED
    valeur: 306
---
## État mesuré (11/10/2026, avant le dépôt)

| Fait | Valeur | Comment |
|---|---|---|
| PR | [#99](https://github.com/vito-sainte-marie/nexus-vito/pull/99), OPEN vers `production`, MERGEABLE, **non fusionnée** | `gh pr view 99` |
| Tête | `aa0a9d8316573b313612d80efa55782ce3501148` (branche `fdj-a6-ecriture-directe-releves-reports-audit-20261011`, base `6a59137`) | `gh pr view` |
| CI de #99 | non-regression ×2 SUCCESS, Cloudflare Pages SUCCESS, Supabase Preview SKIPPED | `statusCheckRollup` |
| Migration | `supabase/migrations/20261011090000_fdj_a6_ecriture_directe_releves_reports_audit_fermee.sql` | — |
| Registre Test | **317**, dernière `20261010170000` (inchangé après l'épreuve) | psql Test |
| Registre Production | **306**, défaut A6 présent (grants mesurés en lecture seule à 02:58:48Z) | `execute_sql` en `begin read only` |
| PR #98 | non fusionnée (consigne de Frédéric) | — |

## Objet

Le correctif de sécurité **A6**, mandaté par Frédéric le 11/10. Un caissier peut écrire directement dans trois tables : `fdj_releves_cloture`, `fdj_reports` et `fdj_audit_log`. Il peut y faire un INSERT, un UPDATE, un DELETE ou un TRUNCATE. Production et Test sont tous deux concernés.

La PR #99 est prête. Je demande le **GO TEST** : appliquer `20261011090000` sur la base **Test seulement**. La sonde navigateur du vrai caissier pourra alors être rejouée sur la base corrigée.

## 1) Le défaut, mesuré par un vrai caissier

Session navigateur ouverte sur NEXUS Test avec **Employé Test A** (rôle caissier, site `nexus-station-test`). Les insertions de sonde ne portent que `site`. Elles franchissent donc les droits et la RLS, puis échouent sur une contrainte NOT NULL, et rien n'est écrit.

| Table | Résultat | Lecture |
|---|---|---|
| `fdj_releves_cloture` | `23502` | droit et RLS franchis : **A6 ouvert** |
| `fdj_reports` | `23502` | idem |
| `fdj_audit_log` | `23502` | idem |

`anon` et `authenticated` disposent de INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER et SELECT sur les trois tables. Aucune politique DELETE n'existe. TRUNCATE ne passe pas par la RLS.

## 2) Le correctif (#99)

**Quatre RPC** `SECURITY DEFINER`, avec `search_path=""` et EXECUTE accordé à `authenticated` et `service_role` seulement :
- `fdj_manager_journaliser` ;
- `fdj_journaliser_ouverture_validee` ;
- `fdj_manager_poser_releve_cloture` ;
- `fdj_manager_enregistrer_rapports`.

**Révocations** sur les trois tables :
- `insert`, `update`, `delete`, `truncate`, `references`, `trigger` et `maintain`, retirés à `public`, `anon` et `authenticated` ;
- `select`, retiré à `public` et `anon`.

**Écrans** :
- `NEXUS-FDJ-Manager-v1.html` : 13 écritures directes passent par les RPC ;
- `NEXUS-FDJ-v1.html` : 1 écriture directe passe par une RPC.

## 3) Résultats de sécurité

Épreuve sur Test dans une **transaction annulée** : la migration est chargée par `\i`, puis tout est annulé par `rollback`. Je l'ai rejouée moi-même sur `aa0a9d8` : **129 essais, 0 écart, rc=0**. Le registre Test reste à 317.

| Famille | Essais | Résultat |
|---|---|---|
| Défaut reproduit avant la migration (caissier) | 48 | INSERT, UPDATE, DELETE et TRUNCATE acceptés, y compris TRUNCATE |
| Droits après la migration | 6 | fermés |
| **Refus après la migration** (caissier, manager et `anon` × 4 verbes × 3 tables) | 48 | **`42501` dans tous les cas** |
| Refus des RPC | 13 | caissier `42501` ; `anon` `42501` ; action hors liste, autre entité ou version hors séquence `22023` ; version déjà prise `23505` ; type `correction_employe` `22023` |
| **Parcours légitimes** (P1 à P14 : ouverture, clôture, relevés, rapports, synchronisation des relevés courants, commandes caisse) | 14 | **tous OK** |

**Autres contrôles :**
- `test_fdj_a6_ecriture_directe_fermee_20261011.js` : 19 vérifications, 0 échec. Douze mutations contrôlées rougissent bien ce test.
- `run-tests` : 260/267, aucun nouveau rouge. Les 7 rouges sont préexistants (inventaire ×4, réception ×3), identiques au socle.
- Garde d'ordre de migration : rc=0.
- Empreinte : 32/32.

## 4) A5 : d'autres chemins contournent-ils A6 ?

Non, aucun chemin ne contourne la correction A6.

- `fdj_cash_controls` et `fdj_shift_counts` refusent l'écriture directe avec `42501` : lot du 10/10.
- L'appel direct d'une fonction de déclencheur rend `0A000`.

**Reste ouvert, hors A6 :** `fdj_alertes`, `fdj_corrections` et d'autres tables `fdj_*` restent écrivables directement. C'est le même motif de défaut, à traiter dans un lot suivant. Je ne l'élargis pas ici.

## 5) Régressions et risques

1. **Ordre de déploiement : le code d'abord, la migration aussitôt.** Les écrans actuels écrivent directement dans les trois tables. Appliquée seule, la migration les fait échouer en `42501` sur ces écritures (clôture, rapports, journal manager).
2. **Conséquence sur Test.** `nexus-test-ddf.pages.dev` sert la branche gelée `18ce051`, pas #99. Après application sur Test, les écritures FDJ de l'écran servi échoueront en `42501`, tant que #99 n'est pas servie sur Test. C'est voulu sur une base de recette : cela prouve la fermeture. Mais la recette FDJ navigateur de #98 sur l'écran servi (clôture manager) cessera de fonctionner sur ces trois chemins.
3. **Conflit textuel avec #98.** Les deux PR touchent `NEXUS-FDJ-Manager-v1.html` et la qualification d'ordre. Celle qui fusionnera en second devra être rebasée, avec recalcul de l'empreinte et de `blob_migration`.
4. **`anon` perd SELECT** sur les trois tables. Les écrans FDJ les lisent sous session authentifiée ; une lecture sans session éventuelle n'a pas été inventoriée écran par écran.
5. Les politiques RLS d'écriture deviennent **inertes**, puisque le droit sous-jacent est retiré. Elles sont conservées, sans effet.
6. Le **snapshot** d'un relevé reste calculé par le client. La RPC valide le rang, le type et le droit, pas le contenu. C'est une limite connue.
7. Les fonctions de déclencheur restent exécutables par PUBLIC. C'est préexistant et sans effet, puisqu'elles ne peuvent pas être appelées directement.

## Ce qui est demandé à l'arbitre

Un verdict sur **une seule chose** : le GO TEST pour appliquer `20261011090000` sur la base **Test** (`udljdqxerrbbbajxubfn`), selon le protocole déjà suivi pour #98 :

1. **Préflight en lecture seule.** Base Test, site `nexus-station-test` présent, registre 317, dernière estampille `20261010170000`, `20261011090000` absente, les quatre RPC absentes. Toute valeur différente arrête la procédure.
2. **Application** par psql vers Test, en une transaction : bloc `DO` gardé, texte du fichier au blob de `aa0a9d8`, ligne du registre. Attendu : 317 → 318.
3. **Constat.** Les quatre RPC sont présentes (`secdef`, `search_path=""`, EXECUTE). Les grants des trois tables sont fermés pour `anon` et `authenticated`.
4. **Sonde navigateur** d'Employé Test A rejouée. Attendu : `42501` sur les trois tables, au lieu de `23502`.
5. Rapport consigné dans la PR #99, puis `request-2`.

**Hors du ressort de ce verdict**, et réservés à Frédéric : la fusion de #99, le déploiement, l'application en Production, et toute action sur #98.

Si l'arbitre juge que le motif `SECURITE_RLS_SITE_ID` s'applique à une **fermeture** de droits sur Test, le verdict attendu est `STOP_REQUIRED: oui` avec ce motif, et Frédéric arbitre.

| Champ | Valeur attendue pour un GO |
|---|---|
| `DECISION` | `APPROVED` ou `APPROVED_WITH_CONDITIONS` |
| `CLOSES` | `false` |
| `STOP_REQUIRED` | `non` |
| `OWNER_NEXT` | `Claude` |
| `EXECUTANT_NEXT` | `session-claude-habilitee`. Le canal `github-actions-claude` n'a pas `SUPABASE_TEST_ECRITURE` : il donnerait `CANAL_INCAPABLE`. |
| `CAPACITE_REQUISE` | `SUPABASE_TEST_ECRITURE` |

## Guardians

- **Architecture** : aucun changement de schéma de table. Quatre fonctions et des révocations.
- **Security & Isolation** : fermeture stricte des droits. Aucun droit élargi, aucun site réel touché, aucun élargissement de `nexus_ci_recette`.
- **Business Rules** : les parcours FDJ légitimes sont prouvés par P1 à P14.
- **QA/Regression** : 129/129, 260/267 au socle. Le seul effet visible est le risque 2 (l'écran servi sur Test).
- **Production** : intacte (306). Aucune fusion, aucun déploiement.
