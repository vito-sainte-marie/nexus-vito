---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-VAGUE1-REPRISE-20261003
seq: 4
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=2f27e5c
  - id: candidat
    classe: VERIFIED
    valeur: 4c63621 rebuild/fdj-62-20260922 (9ffee7e+2)
  - id: migrations-test
    classe: VERIFIED
    valeur: 304->305 20261004120000, anon=f authenticated=f service_role=t
  - id: garde-mutation
    classe: VERIFIED
    valeur: etalonnage=mesure Test 03/10; 3 mutations rouges; suite 234/241 (7 connus)
  - id: recette-serveur
    classe: VERIFIED
    valeur: psql begin..rollback Test 2026-10-04T04:08Z, ancienne porte 42501, rollback verifie
  - id: empreinte
    classe: VERIFIED
    valeur: 290 f28f26b1 recoupee depuis blobs HEAD
---
# Demande — résultats de l'option A (`decision-3.md`) : l'ancienne porte est fermée sur le candidat et sur Test

## 1. Candidat `rebuild/fdj-62-20260922` — `9ffee7e` → `4c63621`

Deux commits poussés, en avance rapide, sans force :

- `e0147c9` — la migration et l'épreuve :
  - `supabase/migrations/20261004120000_fdj_fermer_ancienne_correction_caisse_employe.sql`, additive. Elle fait `revoke all` sur `fdj_corriger_caisse_employe(uuid,numeric,text,text)` pour `public`, `anon` et `authenticated`, puis `grant execute` à `service_role`. Aucune fonction n'est supprimée.
  - `test_fdj_ancienne_correction_fermee_20261004.js`, à la racine, exécuté par `run-tests.js`.
- `4c63621` — la mise à jour des constantes d'empreinte de `.github/deploiement/test_empreinte_artefact_20260915.js` : **289 → 290**, empreinte `d234cb72…` → `f28f26b1…`. Elle est mesurée par `empreinte-artefact.js --arbre-source=.`, recoupée à l'identique depuis les blobs de HEAD, et accompagnée d'une entrée datée au journal arithmétique.

**Écart à la lettre de la décision.** `decision-3` parle d'« un commit ». J'en ai fait deux : les constantes sont restées séparées, comme pour les lots précédents. Les deux sont poussés. Les réunir exigerait un force, que je n'ai pas fait. Si un commit unique est requis, c'est à l'arbitre de le dire.

## 2. L'épreuve mord

C'est un rejeu statique des droits EXECUTE à travers les 290 migrations, dans l'ordre, sur le modèle Supabase. Création = PUBLIC + `anon` + `authenticated` + `service_role` ; grant et revoke agissent par rôle nommé. Toute mention que le modèle ne sait pas interpréter fait échouer l'épreuve.

| Contrôle | Résultat |
|---|---|
| Étalonnage : rejeu sans la nouvelle migration | `anon` = `authenticated` = ouverts, **identique à la mesure Test du 03/10** |
| Dépôt réel | fermée aux deux rôles |
| Mutation « ré-accorder à `authenticated` » | rouge |
| Mutation « revoke from public seulement » (le défaut d'origine) | rouge, `anon` et `authenticated` |
| Mutation « grant dynamique » (`execute format`) | refusée comme intraduisible, jamais ignorée |
| Témoin hors harnais : contenu de la migration vidé (nom gardé) | rouge, « encore exécutable » |

Suite complète : **234/241**. Les 7 échecs sont les 7 rouges connus (inventaire et réception), à l'identique ; avant, c'était 233/240. L'épreuve d'empreinte passe à 32/32, et `test_garde_ordre_migration_code_20260930.js` est vert.

## 3. nexus-test — 304 → 305

- Seule cette migration a été appliquée, en une transaction, avec `ON_ERROR_STOP`. L'estampille `20261004120000` / `fdj_fermer_ancienne_correction_caisse_employe` est posée comme les 12 précédentes (version et nom). Sortie 0.
- `has_function_privilege` après application : `anon` = f, `authenticated` = f, `service_role` = t, `nexus_ci_recette` = f. `proacl` = `{postgres=X/postgres,service_role=X/postgres}`.
- Aucune autre écriture Test. Rien sur Production. `nexus_ci_recette` n'a pas été touché.

## 4. Recette serveur rejouée — `begin … rollback`, Test, 04/10 vers 04:08 UTC

C'est le même script que pour `request-3`, avec deux ajustements, puisque l'ancienne fonction est maintenant refusée :
- Cas 2 : la correction en attente passe par la nouvelle porte, `fdj_corriger_caisse_confirmee`. L'ancienne est d'abord tentée, dans un savepoint.
- Cas 4 : l'appel à l'ancienne fonction après validation est isolé dans un savepoint. L'état est lu ensuite.

| Cas | Mesuré |
|---|---|
| Ancienne porte, caisse en attente (Employé Test A) | `permission denied for function fdj_corriger_caisse_employe` (42501) |
| Nouvelle porte, caisse en attente | acceptée, version 2, toujours en attente du contrôle |
| **Ancienne porte, après validation** | **`permission denied`** ; ensuite : `fdj_ma_caisse` = `validee`, `statut` = `valide_avec_ecart`, `valide_par` intact, `motif_ecart_texte` = motif du manager **intact**, `caisse_reelle` = 125 inchangée |
| Nouvelle porte, après validation | refus métier `caisse_validee`, signalement accepté |
| Cas 1, 3, chaîne manager, transfert, carnets | identiques à `request-3` |

Après le rollback : 0 jeu `RECETTE%`, 0 `fdj_shifts` sur le site de test.

À signaler, sans incidence : la dernière lecture de contrôle du script (`fdj_audit_log … order by created_at`) échoue, parce que cette colonne n'existe pas. C'est un défaut du script de recette, pas de la base. Il intervient avant le rollback, qui reste vérifié.

## 5. Ce qui reste ouvert

- **`request-3` §5 (Phase C)** : le titulaire lirait encore `motif_ecart_texte` par l'API REST. La recette le remesure aujourd'hui (« E lit table directe » rend la valeur témoin), dans l'état d'avant la Phase C qui est documenté. Ce point n'a pas été touché et attend son arbitrage avant toute application de la Phase C.
- **Contrôle réseau de l'écran, connecté** : il exige toujours que Frédéric se connecte lui-même sur l'alias du candidat, en tant qu'Employé Test A puis Manager Test.
- **Production — non mesurée.** `fdj_corriger_caisse_employe` y existe depuis la migration du 01/09, avec le même `grant execute … to authenticated`. Il est **probable** que le même défaut y soit ouvert dès aujourd'hui, indépendamment de la Vague 1. Je ne l'ai pas lu. Une lecture `begin read only` des droits serait un geste AUTO, mais elle sort de l'objet de `decision-3`. Je la propose plutôt que de la faire.

## 6. Options

- **A (recommandée).** Mesurer en lecture seule sur Production les droits EXECUTE de `fdj_corriger_caisse_employe` (`has_function_privilege` pour `anon` et `authenticated`). Aucune écriture. Selon le résultat, une demande séparée sur la fermeture côté Production, qui relève de la fusion et du déploiement du candidat, chacun avec son GO.
- **B.** Arbitrer d'abord `request-3` §5 (Phase C), puis préparer le dossier de fusion du candidat `4c63621`.
- **C.** Clore la question de l'ancienne porte telle quelle : candidat et Test fermés, Production traitée à la fusion du candidat.
