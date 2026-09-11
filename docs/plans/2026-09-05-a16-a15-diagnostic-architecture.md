# A16 et A15 — diagnostic d'architecture

**05/09/2026 · diagnostic uniquement · aucun SQL, aucune Edge Function, aucune RLS modifiée**

Deux lectures en production, strictement `select`. Aucune écriture nulle part.

---

# A16 — 17 tables avec RLS active et zéro politique

## Le diagnostic était faux, et la migration le dit

`20260731121603_nexus_api_auth_integrations_layer.sql`, ligne 11 :

> « Accès : uniquement via **service_role (Edge Functions)**. RLS **deny-all**
> pour anon/authenticated — défense en profondeur, l'isolation par site est
> appliquée dans le code de l'Edge Function à partir de la clé API validée,
> jamais par une policy basée sur une session employé. »

Et ligne 77 : « Aucune policy permissive : seul service_role accède à ces tables. »

**Ces 17 tables n'ont pas « oublié » leurs politiques. Elles n'en ont jamais dû
avoir.** L'absence de policy EST le contrôle d'accès.

Mieux : `20260731121835_fix_current_normalized_sales_security_invoker.sql`
— récupérée de la production le 04/09/2026 — a explicitement **révoqué** tous
les privilèges de ces tables et de la vue `current_normalized_sales` à
`anon, authenticated`, en réponse à un audit de sécurité Supabase. Le motif y
est écrit : « une vue sans security_invoker s'exécute avec les droits de son
créateur, ce qui peut contourner le RLS deny-all de normalized_sales. »

**A16 n'est donc pas un défaut. C'est l'architecture, correctement
implémentée, et durcie une fois déjà.**

## Les 17 tables et leur rôle

| Couche | Tables | Rôle |
|---|---|---|
| **RAW** | `raw_sales`, `raw_products`, `raw_stock_movements`, `raw_cash_sessions` | ce que le connecteur caisse envoie, conservé **tel quel**, insert-only |
| **NORMALIZED** | `normalized_sales`, `normalized_products`, `normalized_stock`, `normalized_cash_sessions` | harmonisé au format NEXUS, rapproché par identifiant externe ou code-barres, **jamais par libellé** |
| **ADVISOR** | `advisor_inputs`, `advisor_logs` | calculs dérivés candidats à devenir message, et traçabilité de ce que le moteur en a fait |
| **API** | `api_keys`, `api_logs` | clés hachées des connecteurs, journal d'audit des appels |
| **INTÉGRATION** | `integration_sources`, `integration_status`, `integration_errors`, `normalization_state`, `synchronization_history` | catalogue, état par établissement, rejets explicites, curseur de synchronisation |

Aucune n'est destinée au navigateur. `NEXUS-Admin-API-v1.html` le confirme :
il n'appelle **aucune** de ces tables, il passe par `fetch(FN_URL + path)` —
une Edge Function. C'est le bon motif.

## Le seul écart réel : un lecteur client survivant

`nexus-rapport-donnees.js:123` interroge la vue `current_normalized_sales`
depuis le navigateur :

```js
const { data: ventes, error: e1 } = await client
  .from('current_normalized_sales')
  .select('total_ttc, margin_amount_ht, unit_sale_price_ht, quantity, sold_at')
```

Cette vue porte `security_invoker=true` — donc elle s'exécute avec les droits
de l'employé, et `normalized_sales` refuse tout. **L'erreur console de Rapport
n'est pas une panne : c'est le refus qui fonctionne.**

Ce code appelle une ressource dont les privilèges ont été **révoqués le
31/07/2026**. Il n'a pas été mis à jour quand la fermeture a eu lieu.
**C'est un reliquat pré-Edge, pas une architecture encore valide.**

À son crédit : le code étiquette déjà ce chiffre `confiance: 'derive'` et
`couvertureIncertaine: true`, avec un commentaire disant que « cette table ne
capte qu'une fraction des ventes réelles ». Il savait déjà ne pas être une
source fiable.

## Ce qu'il ne faut surtout pas faire

Ajouter une policy `anon`/`authenticated` sur `normalized_sales` ferait
disparaître l'erreur **en annulant la décision de sécurité du 31/07** et en
exposant au navigateur une table dont l'isolation par site est assurée
ailleurs — dans l'Edge Function, à partir de la clé API. Ce serait un recul,
pas un correctif.

## Classification A16

| | |
|---|---|
| 17 tables deny-all | **dette acceptée** — c'est le design, il fonctionne |
| Edge Functions absentes de `nexus-test` (`admin-api`, `api-v1`, `google-sheets-sync` existent au dépôt) | **fonction non testable faute de backend** |
| `nexus-rapport-donnees.js:123` | **à corriger avant recette finale** — retirer l'appel, ou l'entourer d'un état « source indisponible » explicite |

---

# A15 — le référentiel Advisor absent

## Ce n'est pas un problème d'accès

`advisor_rules` et `nexus_language_templates` ont **4 politiques chacune** et
sont lisibles par le client. Ce sont des tables de **référentiel applicatif**,
pas de la couche serveur. Rien à voir avec A16.

Elles sont simplement **vides dans `nexus-test`** :

| Table | `nexus-test` | production |
|---|---|---|
| `advisor_rules` | **0** | 31 |
| `nexus_language_templates` | **0** | 6 |
| `advisor_messages` | 0 | 13 |

## Pourquoi elles sont vides : la cause est structurelle

Ces tables viennent de `20260101000000_baseline_pre_existing_schema.sql`, dont
l'en-tête dit :

> « Extrait fidèlement d'un dump réel (`supabase db dump --linked --schema
> public`) »

Un dump de schéma capture la **structure**, jamais les **données**. Et aucune
migration du dépôt ne contient d'`insert` dans ces deux tables.

**Le référentiel Advisor n'est versionné nulle part.** Il n'existe que dans la
base de production, saisi à la main ou via le tableau de bord. Toute base
reconstruite à partir des migrations naît sans lui — `nexus-test` n'est pas
une exception, c'est la démonstration.

## La chaîne de l'échec, du template manquant à la contrainte

```
generer_message_controle_tenue_absent(p_site)
 ├─ select body_template from nexus_language_templates  →  NULL (table vide)
 ├─ select count(*) from v_qualite_controle_absent      →  3 employés
 ├─ v_count = 3 ≠ 0  →  pas de sortie anticipée
 ├─ v_body := replace(replace(NULL, …), …)              →  NULL
 └─ insert into advisor_messages (message_text = NULL)  →  23502
```

La fonction sort proprement quand il **n'y a rien à signaler** (`v_count = 0`).
Elle n'a pas de sortie pour « il y a quelque chose à signaler mais je n'ai pas
les mots pour le dire ». Le référentiel manquant se transforme en violation de
contrainte trois instructions plus loin.

Les deux autres générateurs ne remontent rien **par chance** : leurs vues sont
vides, ils sortent avant l'insertion. **L'anomalie est latente sur les trois.**

## Classification A15

| | |
|---|---|
| Référentiel absent de `nexus-test` | **fonction non testable faute de données de référence** |
| Référentiel non versionné | **à corriger avant recette finale** — pas le contenu, mais le fait qu'aucune base ne puisse être reconstruite complète |
| Centre Intelligence | **dégradé acceptable** — l'écran se charge, affiche ses autres sections, et journalise une vraie erreur technique. Le module Advisor lui-même est **non éprouvé**. |

---

# Synthèse

## Architecture attendue

Connecteur caisse → `raw_*` (insert-only) → Edge Function → `normalized_*` →
`advisor_inputs` → moteur → `advisor_messages` lus par le client.
**Le navigateur entre dans le circuit à la toute fin**, sur des tables qui ont
des politiques. Tout l'amont est service_role.

## Architecture réellement présente dans `nexus-test`

Le schéma complet, les RLS correctes, **aucune Edge Function**, **aucun
référentiel Advisor**, et **un appel client vers l'amont** qui aurait dû
disparaître le 31/07/2026.

## Écarts

| # | Écart | Classification |
|---|---|---|
| 1 | `nexus-rapport-donnees.js:123` interroge une vue révoquée | **à corriger avant recette finale** |
| 2 | Trois Edge Functions au dépôt, zéro déployée | **non testable faute de backend** |
| 3 | Référentiel Advisor non versionné | **à corriger avant recette finale** (le versionnement, pas les données) |
| 4 | 17 tables deny-all | **dette acceptée — c'est le design** |
| 5 | `generer_message_*` sans sortie pour « référentiel absent » | **dette acceptée**, à revoir avec le module Advisor |

**Aucune modification n'a été faite. `main` et `production` restent à `501c0c7`.**
