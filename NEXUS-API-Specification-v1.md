# NEXUS API — Spécification technique v3

**Programme NEXUS — Connecteur caisse en lecture seule + déclarations terrain**
**Statut : document de conception, aucune infrastructure encore déployée**
**Date de création :** 31/07/2026 · **Révision :** 31/07/2026 (v3 — synchronisation différentielle par curseur)

---

## 1. Pourquoi cette API

Le NEXUS Core Engine Specification (v1.5) documente, table par table et axe par axe, ce qui est réellement mesurable aujourd'hui et ce qui ne l'est pas. **Capability 006** (données de tickets de caisse) y est citée à trois reprises comme bloquante : panier moyen (Axe Performance), disponibilité produit (Axe Expérience client), vérification de la Mission « Produit d'appel panier ». Sans donnée ligne par ligne, ces axes restent à 0%.

**Principe hérité du reste du projet NEXUS (Article 5 — jamais un chiffre inventé)** : cette API ne doit jamais laisser une donnée partielle ou mal formée entrer silencieusement, et ne doit jamais faire perdre la donnée d'origine au profit d'un calcul NEXUS qui pourrait évoluer.

**Portée de ce document** : conception uniquement. Aucune Edge Function, aucune clé API, aucune table des trois couches n'a été créée à ce stade.

---

## 2. Deux mécaniques distinctes — pas une seule API

Ce document couvre deux flux de nature différente, à ne pas confondre :

| | Connecteur caisse (Decenium) | Déclarations terrain |
|---|---|---|
| **Sens** | NEXUS interroge Decenium (lecture seule) | Un outil ou une personne envoie une déclaration à NEXUS (écriture) |
| **Source** | Le logiciel de caisse | Un contrôle stock, une promotion déclarée, une exception de marge — des actes humains, pas des données de caisse |
| **Écriture vers Decenium** | **Jamais.** Aucune opération de NEXUS ne modifie quoi que ce soit côté Decenium. | Sans objet — ce flux n'a rien à voir avec Decenium |
| **Traité en section** | 3 | 4 |

---

## 3. Le connecteur caisse Decenium

### 3.1 Principe non négociable : lecture seule

NEXUS interroge l'API Decenium à l'aide d'une clé API que Decenium fournit. **NEXUS ne dispose d'aucun moyen d'écrire, modifier ou supprimer une donnée côté Decenium** — ni ticket, ni produit, ni session de caisse. Ce principe doit être visible et explicite dans toute documentation publique de l'API NEXUS, pas seulement dans ce document interne.

**Ce que ça implique concrètement** :
- La clé API fournie par Decenium doit, idéalement, être une clé à portée **lecture seule** côté Decenium lui-même (à demander explicitement à Decenium — la garantie la plus solide n'est pas seulement « NEXUS n'appelle pas les endpoints d'écriture », c'est « la clé ne permet pas d'écrire, même par erreur de code »).
- La clé Decenium est stockée côté NEXUS de façon aussi protégée qu'un secret de production (jamais en clair dans un log, jamais commit dans un dépôt de code).
- **Le mécanisme exact de connexion (API REST classique, webhook, autre) dépend de ce que Decenium propose réellement** — à confirmer une fois la clé obtenue. Ce document suppose un modèle de synchronisation périodique (NEXUS interroge Decenium à intervalle régulier), le plus courant pour ce type d'intégration, à ajuster si Decenium propose un mécanisme différent (webhook temps réel, par exemple).

### 3.2 Synchronisation différentielle — jamais un téléchargement complet

**Principe** : NEXUS ne redemande jamais l'intégralité des ventes à chaque synchronisation. Il conserve la date de dernière synchronisation réussie et ne demande que ce qui a changé depuis.

**Contrat minimal attendu sur chaque enregistrement renvoyé par Decenium** :

| Champ | Rôle |
|---|---|
| `id` | Identifiant stable de la ligne côté Decenium — sert de clé pour rapprocher une mise à jour d'un enregistrement déjà reçu |
| `created_at` | Horodatage de création — ne change jamais après coup |
| `updated_at` | Horodatage de dernière modification — **c'est ce champ, pas `created_at`, qui pilote la synchronisation différentielle**, sinon un ticket modifié après coup (remboursement, annulation) ne remonterait jamais |
| `status` | État actuel de la ligne (`completed`, `refunded`, `voided`…) — permet de détecter qu'une ligne déjà reçue a changé d'état sans redemander toute la base |

**Requête type** :
```
GET /api/v1/sales?updated_since=2026-07-29T14:00:00Z&limit=500
```

**Table technique de suivi de synchronisation (proposition, non créée à ce stade)** :
```
sync_state
  id                     uuid, PK
  site                   text, NOT NULL
  source                 text, NOT NULL default 'decenium'
  domaine                text, NOT NULL default 'sales'
  dernier_curseur        text            -- voir ci-dessous : updated_at + id, ou curseur opaque si Decenium en fournit un
  derniere_sync_le       timestamptz
  derniere_sync_statut   text            -- 'succes' | 'echec_partiel' | 'echec'
  UNIQUE(site, source, domaine)
```

**Curseur composite plutôt qu'un simple `updated_since`** : si plusieurs lignes partagent exactement le même `updated_at`, un filtre `updated_since` seul risque soit de sauter des lignes (si le curseur avance au-delà de ce timestamp), soit de les redemander indéfiniment (s'il n'avance pas). Le curseur réellement stocké dans `dernier_curseur` doit donc être un couple `(updated_at, id)`, avec une requête équivalente à `updated_at > X OR (updated_at = X AND id > Y)` — à confirmer selon ce que l'API Decenium permet réellement d'exprimer. **Si Decenium fournit son propre curseur opaque (`next_cursor` ou équivalent) dans sa réponse, celui-ci doit être utilisé de préférence** — il est conçu par Decenium pour gérer ce cas correctement, plutôt que de reconstruire la logique côté NEXUS.

**Pagination par curseur, jamais par numéro de page** : avec un volume de transactions qui augmente en continu, une pagination par numéro de page (`page=2`, `page=3`…) peut sauter ou dupliquer des lignes si de nouvelles ventes s'insèrent pendant la pagination elle-même. Chaque page est donc récupérée avec `limit` + le dernier curseur connu, jamais avec un numéro de page.

**Robustesse en cas d'échec partiel** : le curseur n'avance qu'après écriture réussie de la page correspondante dans `raw_sale_lines` — jamais avant. Une synchronisation interrompue en cours de route reprend exactement là où elle s'est arrêtée à la prochaine tentative, sans redemander ce qui a déjà été écrit ni sauter ce qui ne l'a pas encore été.

**Idempotence** : un même appel rejoué (retry après timeout réseau, par exemple) ne doit pas créer de doublon. Contrainte d'unicité proposée sur `raw_sale_lines` : `UNIQUE(site, source, decenium_id, updated_at)`, avec `ON CONFLICT DO NOTHING` à l'insertion.

### 3.3 Les trois couches

Une modification du moteur NEXUS ne doit jamais détruire ou altérer la donnée d'origine reçue de Decenium. D'où une séparation stricte en trois couches :

**Couche 1 — Données brutes (`raw_sale_lines`)**
Ce que Decenium a renvoyé, conservé exactement tel quel, sans transformation. Insert-only : une ligne brute n'est jamais modifiée après réception, seulement archivée.

```
raw_sale_lines
  id              uuid, PK                -- identifiant interne NEXUS, pas celui de Decenium
  site            text, NOT NULL
  source          text, NOT NULL default 'decenium'
  decenium_id     text, NOT NULL          -- le champ `id` renvoyé par Decenium sur l'enregistrement
  decenium_updated_at  timestamptz, NOT NULL   -- le champ `updated_at` renvoyé par Decenium — pilote la synchro différentielle
  payload         jsonb, NOT NULL        -- la ligne telle que reçue, intacte
  recu_le         timestamptz, default now()
  normalise       boolean, default false -- passé à true une fois traité par la couche 2
  UNIQUE(site, source, decenium_id, decenium_updated_at)  -- idempotence : un retry ne duplique jamais
```

**Append-only, y compris pour une même ligne** : si Decenium renvoie plus tard le même `id` avec un `updated_at` et un `status` différents (ex : un ticket remboursé après coup), NEXUS insère une **nouvelle** ligne dans `raw_sale_lines` plutôt que d'écraser l'ancienne — l'historique complet des états d'une ligne reste consultable. C'est la couche 2 qui matérialise l'état courant (dernier `decenium_updated_at` par `decenium_id`), jamais la couche 1.

**Couche 2 — Données normalisées (`normalized_sales`, `normalized_products`, `normalized_cash_sessions`)**
NEXUS harmonise les noms de champs, les types et les identifiants Decenium vers un format interne stable. C'est cette couche, pas la couche 1, que consomme le reste de NEXUS — si Decenium change son format demain, ou si un autre logiciel de caisse est connecté un jour, seule la fonction de normalisation change, jamais le reste du moteur.

```
normalized_sales
  id                    uuid, PK
  raw_sale_line_id      uuid, FK -> raw_sale_lines.id   -- traçabilité vers la donnée brute
  site                  text, NOT NULL
  ticket_id             text, NOT NULL
  register_id           text
  employee_id           uuid, FK -> employees.id        -- résolu depuis l'employee_id Decenium
  shift_id              text
  sold_at               timestamptz, NOT NULL
  product_id            uuid, FK -> products.id          -- résolu depuis le code-barres/référence Decenium
  category               text
  quantity              numeric, NOT NULL
  unit_price_ttc         numeric
  unit_purchase_price    numeric
  vat_rate               numeric
  discount_ttc           numeric, default 0
  total_ttc              numeric, NOT NULL
  status                 text                            -- 'completed', 'refunded', 'voided'…
  normalise_le            timestamptz, default now()

normalized_products
  id              uuid, PK
  site            text, NOT NULL
  decenium_product_id  text, NOT NULL   -- identifiant côté Decenium
  product_id      uuid, FK -> products.id, NULL si non résolu
  barcode         text
  label           text
  category        text
  maj_le          timestamptz, default now()

normalized_cash_sessions
  id              uuid, PK
  site            text, NOT NULL
  register_id     text, NOT NULL
  shift_id        text, NOT NULL
  employee_id     uuid, FK -> employees.id
  ouverte_le      timestamptz
  fermee_le       timestamptz
  total_ttc       numeric
  nb_tickets      integer
```

**Couche 3 — Intelligence NEXUS (existant, pas à recréer)**
`advisor_messages`, `advisor_message_evidence`, `advisor_rules`, `journal_decisions`, `mission_assignments` existent déjà en production et continuent de fonctionner comme aujourd'hui. La couche 2 devient une nouvelle source d'entrée pour ces mécanismes, en plus des sources actuelles (imports Excel/CSV).

**Précision sur `advisor_candidates`** : cette table n'existe pas dans la base actuelle (vérifié — seules `advisor_messages`, `advisor_message_evidence`, `advisor_feedback`, `advisor_rules` existent). Si une étape intermédiaire « candidat avant promotion en message affiché » est souhaitée, c'est un objet à concevoir séparément, pas un existant à réutiliser. Proposé ici comme option ouverte, non tranchée.

### 3.4 Ce que la couche 2 permet de calculer

Une fois `normalized_sales` alimentée, ces calculs deviennent directs, sans table intermédiaire dédiée :

| Calcul | Provenance |
|---|---|
| Chiffre d'affaires | `sum(total_ttc)`, groupé par période/catégorie/produit |
| Quantités vendues | `sum(quantity)` |
| Marge | `sum((unit_price_ttc - unit_purchase_price) * quantity)` |
| Variation de prix | comparaison de `unit_price_ttc` d'un même `product_id` dans le temps |
| Évolution en volume | `sum(quantity)` par période, comparée période à période |
| Performance par employé | groupé par `employee_id` |
| Performance par quart | groupé par `shift_id` |
| Performance par heure | extrait de `sold_at` |
| Performance par catégorie | groupé par `category` |
| Panier moyen, nombre de tickets | `count(distinct ticket_id)`, `avg(total_ttc)` par ticket — **remplace la table `panier_moyen_quotidien` de la v1**, qui sort du scope de cette API (recalculable à la demande, plus besoin d'un envoi quotidien séparé) |

**Prudence explicite sur la performance par employé** : le Core Engine Spec (section 10) place l'objet Employé et toute donnée RH en statut *prototype*, explicitement non utilisable pour une vraie décision RH (prime, évaluation, sanction) tant que l'authentification employé n'est pas garantie par un vrai backend — aujourd'hui un PIN haché contournable côté navigateur. Un CA par employé calculé depuis de vraies lignes de caisse serait fiable en tant que donnée, mais hérite de la même réserve : exploitable pour du coaching ou une lecture d'équipe, pas encore comme fondement d'une décision RH individuelle.

### 3.5 Format d'une ligne de vente reçue

```json
{
  "sale_line_id": "sl_987654",
  "ticket_id": "tk_123456",
  "site_id": "vito-sainte-marie",
  "register_id": "caisse-01",
  "employee_id": "emp_045",
  "shift_id": "shift_20260729_01",
  "sold_at": "2026-07-29T14:32:18-04:00",
  "product_id": "prod_00871",
  "barcode": "3290000000000",
  "label": "Amigo Orange 50cl -8P",
  "category": "Boissons",
  "quantity": 2,
  "unit_price_ttc": 2.50,
  "unit_purchase_price": 1.15,
  "vat_rate": 8.5,
  "discount_ttc": 0,
  "total_ttc": 5.00,
  "status": "completed",
  "created_at": "2026-07-29T14:32:20-04:00",
  "updated_at": "2026-07-29T14:32:20-04:00"
}
```

Cette structure est stockée telle quelle dans `raw_sale_lines.payload`, puis mappée vers `normalized_sales` par la fonction de normalisation (résolution de `product_id`/`employee_id` Decenium vers les identifiants internes NEXUS via `barcode` et une table de correspondance employé).

**Requête de synchronisation correspondante** (voir 3.2) :
```
GET /api/v1/sales?updated_since=2026-07-29T14:00:00Z&limit=500
```
NEXUS répète cette requête en avançant le curseur `(updated_at, id)` jusqu'à recevoir un lot de moins de 500 lignes — signe qu'il n'y a plus rien de nouveau à ce round de synchronisation.

### 3.6 Coexistence avec l'export manuel

**L'export manuel actuel (menu Compta > Panier Moyen chez Decenium, saisie dans Nexus Import) reste valide et continue de fonctionner tant que la clé API Decenium n'est pas obtenue et le connecteur pas en service.** Le connecteur API ne remplace pas ce chemin du jour au lendemain — il vient s'y substituer progressivement une fois validé sur des données réelles. Aucune bascule brutale n'est prévue.

### 3.7 Étapes côté connecteur caisse

1. Obtenir de Decenium une clé API à portée lecture seule, et la documentation de son API — en particulier confirmer si `updated_since` + `limit` sont bien supportés tels quels, ou si Decenium expose son propre mécanisme de curseur (section 3.2).
2. Créer `raw_sale_lines`, `sync_state`, `normalized_sales`, `normalized_products`, `normalized_cash_sessions`.
3. Écrire la tâche de synchronisation différentielle (section 3.2) — la donnée brute atterrit dans la couche 1, jamais directement dans la couche 2, et le curseur n'avance qu'après écriture réussie.
4. Écrire la fonction de normalisation (couche 1 → couche 2), avec rejet explicite (pas de valeur par défaut inventée) si un champ obligatoire manque ou qu'une résolution d'identifiant échoue.
5. Valider sur un mois réel de données avant de brancher un quelconque calcul du moteur dessus.
6. Documenter le format réel de l'API Decenium une fois connu (peut différer de la section 3.5, qui est une cible de départ).

---

## 4. Déclarations terrain (écriture vers NEXUS)

Ces trois domaines n'ont aucun lien avec Decenium — ce sont des déclarations humaines (comptage physique, promotion décidée, exception assumée), qui restent en écriture (push) vers NEXUS, avec authentification par clé API NEXUS classique.

### 4.1 Authentification

- Une **clé API par site**, transmise via `Authorization: Bearer <clé>`.
- Chaque requête n'écrit que sur le site associé à la clé.
- Table technique proposée :
```
api_keys
  id              uuid, PK
  site            text, NOT NULL
  cle_hash        text, NOT NULL          -- jamais la clé en clair
  label           text
  scopes          text[]                  -- ex: {'controles_stock', 'campagnes'}
  actif           boolean, default true
  cree_le         timestamptz, default now()
  dernier_appel_le timestamptz
  revoque_le      timestamptz
```

### 4.2 `POST /v1/controles-stock`

Remplit `controles_stock`. Un enregistrement par article contrôlé.

```json
{
  "article": "HEINEKEN 25CL",
  "quantite_theorique": 48,
  "quantite_comptee": 44,
  "controle_le": "2026-07-30T18:15:00Z"
}
```

| Champ | Type | Obligatoire | Contrainte |
|---|---|---|---|
| `article` | texte | Oui | Doit exister dans `products` pour ce site |
| `quantite_theorique` | numérique | Oui | ≥ 0 |
| `quantite_comptee` | numérique | Oui | ≥ 0 |
| `controle_le` | timestamp | Non — défaut : instant de réception | Pas dans le futur |

`ecart` est calculé côté serveur, jamais fourni par l'appelant.

### 4.3 `POST /v1/campagnes`

```json
{
  "nom": "Promo été bières 2026",
  "date_debut": "2026-08-01",
  "date_fin": "2026-08-31",
  "type": "remise_prix",
  "produits_concernes": ["HEINEKEN 25CL", "DESPERADOS RED"],
  "nature": "prix_barre",
  "objectif": "volume",
  "objectif_libre": null
}
```

| Champ | Type | Obligatoire |
|---|---|---|
| `nom` | texte | Oui |
| `date_debut`, `date_fin` | date | Oui, `date_fin` ≥ `date_debut` |
| `type` | texte | Oui |
| `produits_concernes` | tableau de texte | Oui, non vide — chaque article doit exister dans `products` |
| `nature` | texte | Oui |
| `objectif` | texte | Oui |
| `objectif_libre` | texte | Non |

### 4.4 `POST /v1/campagnes/{campagne_id}/imports`

```json
{
  "phase": "avant",
  "periode_debut": "2026-07-01",
  "periode_fin": "2026-07-31"
}
```

| Champ | Type | Obligatoire | Contrainte |
|---|---|---|---|
| `phase` | texte | Oui | `avant` ou `pendant` |
| `periode_debut`, `periode_fin` | date | Oui | `periode_fin` ≥ `periode_debut` |

### 4.5 `POST /v1/marge-exceptions`

```json
{
  "article": "PACK LORRAINE 6X33CL",
  "categorie": "Bières",
  "raison": "Levier de prix dégressif par quantité — marge réduite assumée"
}
```

| Champ | Type | Obligatoire |
|---|---|---|
| `article` | texte | Oui — doit exister dans `products` pour ce site |
| `categorie` | texte | Non |
| `raison` | texte | Non, mais fortement recommandé |

---

## 5. Gestion des erreurs (déclarations terrain)

```json
{
  "erreur": "champ_invalide",
  "message": "quantite_comptee doit être un nombre positif ou nul.",
  "champ": "quantite_comptee"
}
```

| Code HTTP | Cas |
|---|---|
| `400` | Payload malformé, champ obligatoire manquant, contrainte violée |
| `401` | Clé API absente ou invalide |
| `403` | Clé valide mais sans le scope requis |
| `404` | Référence à une ressource inexistante |
| `409` | Conflit d'unicité non géré par upsert |
| `500` | Erreur serveur — journalisée, jamais silencieuse |

**Principe non négociable** : une requête partiellement valide n'est jamais enregistrée partiellement.

---

## 6. Sécurité — résumé

| | Connecteur caisse | Déclarations terrain |
|---|---|---|
| Sens | NEXUS lit Decenium | NEXUS reçoit une écriture |
| Écriture vers Decenium | Jamais, sous aucune forme | Sans objet |
| Clé utilisée | Clé Decenium (idéalement lecture seule côté Decenium) | Clé NEXUS par site |
| Donnée d'origine | Toujours conservée intacte (`raw_sale_lines`) | Non applicable (déclaration directe) |
| Suppression | Aucune opération de suppression, dans un sens comme dans l'autre | Aucune opération de suppression |

---

## 7. Étapes d'implémentation, par ordre de dépendance

1. Demander à Decenium une clé API à portée lecture seule + confirmation que `updated_since`/`limit` (ou un curseur équivalent) sont supportés côté Decenium.
2. Créer les tables des 3 couches (`raw_sale_lines`, `normalized_sales`, `normalized_products`, `normalized_cash_sessions`) et la table `sync_state`.
3. Écrire la synchronisation différentielle (curseur composite, avance uniquement après écriture réussie, idempotence par contrainte d'unicité) + la fonction de normalisation, avec rejet explicite en cas de champ manquant ou de résolution d'identifiant impossible.
4. Valider sur des données réelles avant de brancher un calcul du moteur dessus — en gardant l'export manuel actif en parallèle.
5. Créer `api_keys` et les Edge Functions pour les 3 domaines de déclarations terrain (contrôles stock, campagnes, exceptions de marge), indépendamment du connecteur caisse.
6. Documenter dans le Data Dictionary les tables concernées comme « alimentées via connecteur » une fois validées en production.
7. Ne présenter la page API publique comme « disponible » qu'une fois le connecteur caisse validé sur des données réelles — pas avant.

---

## Historique des versions

| Version | Date | Changement |
|---|---|---|
| v1 | 31/07/2026 | Création initiale — 4 domaines prioritaires en écriture (panier moyen, contrôles stock, campagnes, exceptions de marge), authentification par clé/site |
| v2 | 31/07/2026 | Refonte majeure : connecteur caisse Decenium en **lecture seule** (pull), architecture à 3 couches (brute/normalisée/intelligence), calculs CA/marge/volume/performance employé-quart-heure-catégorie depuis les lignes de vente, retrait de `panier_moyen_quotidien` du scope (remplacé par calcul à la demande sur `normalized_sales`), coexistence explicite avec l'export manuel tant que le connecteur n'est pas en service, séparation claire entre connecteur caisse (lecture) et déclarations terrain (écriture) |
| v3 | 31/07/2026 | Synchronisation différentielle : contrat `id`/`created_at`/`updated_at`/`status` sur chaque enregistrement, requête `updated_since` + `limit`, curseur composite `(updated_at, id)` plutôt qu'un numéro de page, table `sync_state`, `raw_sale_lines` en append-only avec contrainte d'unicité `(site, source, decenium_id, decenium_updated_at)` pour l'idempotence, avance du curseur uniquement après écriture réussie |
