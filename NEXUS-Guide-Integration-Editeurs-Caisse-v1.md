# Guide d'intégration NEXUS — À l'usage des éditeurs de logiciels de caisse

**Destinataire : les équipes techniques d'un éditeur de logiciel de caisse (ex. Decenium) souhaitant connecter leur système à NEXUS**
**Statut : document de travail, à valider conjointement avant toute mise en œuvre**
**Version :** 1.1 — 31/07/2026

---

## 1. Objectif de ce document

NEXUS est un système d'exploitation pour le commerce de proximité. Pour fonctionner, il a besoin de lire — jamais d'écrire — les ventes réalisées en caisse : chiffre d'affaires, quantités, marge, variation de prix, évolution en volume, performance par employé, quart, heure et catégorie.

Ce document décrit :
- ce que NEXUS attend de votre API pour fonctionner correctement ;
- ce que nous vous recommandons pour que cette intégration ne compromette jamais l'intégrité ni la sécurité de votre logiciel ;
- ce que NEXUS s'engage à respecter de son côté.

**Un principe gouverne tout ce document : NEXUS est un lecteur, jamais un rédacteur.** Aucune recommandation ci-dessous ne devrait vous demander d'ouvrir un accès plus large que la lecture seule des ventes.

---

## 2. Le contrat minimal attendu

### 2.1 Un point d'entrée en lecture seule

NEXUS a besoin d'un endpoint capable de renvoyer les lignes de vente, filtrable par date de dernière modification :

```
GET /api/v1/sales?updated_since=2026-07-29T14:00:00Z&limit=500
```

- `updated_since` : ne renvoyer que les enregistrements modifiés après cette date (voir 2.3 — pourquoi `updated_at` et pas `created_at`).
- `limit` : nombre maximal d'enregistrements par réponse. 500 est une proposition de départ, ajustable selon ce que votre infrastructure supporte confortablement.

### 2.2 Champs obligatoires sur chaque enregistrement

| Champ | Rôle |
|---|---|
| `id` | Identifiant stable et unique de la ligne de vente dans votre système. Ne doit jamais être réutilisé pour un autre enregistrement. |
| `created_at` | Horodatage de création, immuable. |
| `updated_at` | Horodatage de dernière modification. Change à chaque fois que l'enregistrement est modifié (remboursement, annulation, correction). |
| `status` | État courant de la ligne (ex. `completed`, `refunded`, `voided`). |

À cela s'ajoutent les champs métier nécessaires au calcul (exemple complet en section 5) : identifiant de ticket, produit/code-barres, quantité, prix de vente unitaire HT et TTC, prix d'achat unitaire HT, méthode de valorisation du coût, devise, taux de TVA, remise, montant total, identifiant employé, identifiant de quart, horodatage de vente.

**Important — identifiant produit** : le rapprochement d'une ligne de vente avec un produit se fait via `product_id` (votre identifiant interne) et, en relais, `barcode`. **Le libellé produit (`label`) ne doit jamais servir de clé** — c'est un champ d'affichage, qui peut varier d'un export à l'autre (abréviation, casse, orthographe) sans que ce soit un changement de produit.

**Important — marge** : NEXUS calcule lui-même la marge à partir de vos prix de vente et d'achat — ne nous envoyez jamais une marge déjà calculée. Précisez-nous simplement quelle méthode de valorisation du coût vous utilisez (coût moyen pondéré ou dernier prix d'achat, champ `cost_method`), pour que le calcul de marge soit interprété correctement de notre côté.

### 2.3 Pourquoi `updated_at`, pas seulement `created_at`

Si NEXUS ne filtrait que sur `created_at`, un ticket modifié après coup (remboursement le lendemain, par exemple) ne remonterait jamais. C'est `updated_at` qui doit piloter la synchronisation différentielle — NEXUS ne redemande jamais l'intégralité de votre base, seulement ce qui a changé depuis son dernier passage.

### 2.4 Pagination — curseur plutôt que numéro de page

Avec un volume de transactions qui augmente en continu, une pagination par numéro de page peut sauter ou dupliquer des lignes si de nouvelles ventes s'insèrent pendant la pagination elle-même.

**Deux options, par ordre de préférence :**

1. **Votre API renvoie un curseur opaque** (`next_cursor` ou équivalent) dans chaque réponse, que NEXUS renvoie tel quel à l'appel suivant. C'est l'option la plus sûre — vous maîtrisez entièrement la logique de pagination de votre côté.
2. **À défaut**, NEXUS reconstruit un curseur à partir de `(updated_at, id)` du dernier enregistrement reçu, avec une requête équivalente à `updated_at > X OR (updated_at = X AND id > Y)` — nécessaire pour gérer le cas où plusieurs lignes partagent exactement le même `updated_at`.

**Réponse attendue :**
```json
{
  "data": [ /* jusqu'à `limit` enregistrements */ ],
  "has_more": true,
  "next_cursor": "opaque_token_ou_null"
}
```

---

## 3. Recommandations de sécurité — pour protéger votre système

Ces recommandations vous protègent, pas seulement NEXUS. Une intégration mal scopée est un risque pour vous en premier lieu.

### 3.1 Une clé strictement lecture seule

La clé que vous fournissez à NEXUS doit être configurée, **de votre côté**, pour ne permettre que la lecture des ventes — aucune permission de création, modification ou suppression, quel que soit l'endpoint. Ne comptez pas uniquement sur le fait que NEXUS n'appellera jamais vos endpoints d'écriture : si la clé elle-même ne le permet pas, un bug ou une compromission côté NEXUS ne peut techniquement rien altérer chez vous.

### 3.2 Un principal dédié, pas un compte humain

La clé doit être associée à un compte de service dédié à cette intégration (« NEXUS », par exemple), pas au compte d'un employé ou d'un administrateur. Cela vous permet de révoquer ou faire tourner cette clé sans impacter qui que ce soit d'autre.

### 3.3 Un périmètre limité aux ventes

La clé ne devrait donner accès qu'aux données de vente — pas aux paramètres système, aux comptes utilisateurs, aux informations bancaires ou, si votre logiciel est multi-établissement, aux données d'un autre commerce que celui ayant autorisé l'intégration.

### 3.4 Rotation et révocation à tout moment

- Vous devez pouvoir révoquer la clé instantanément, de votre propre initiative, sans dépendre d'une action de NEXUS.
- Une rotation de clé (ancienne clé désactivée, nouvelle activée) ne devrait jamais nécessiter une interruption de service — une fenêtre de chevauchement où les deux clés sont valides simultanément est recommandée.

### 3.5 Journalisation de votre côté

Nous vous recommandons de journaliser, chez vous, chaque appel effectué avec cette clé (horodatage, endpoint, volume de données renvoyé). C'est votre outil d'audit, indépendant de ce que NEXUS peut vous rapporter.

### 3.6 Limitation de débit — dans les deux sens

Vous êtes en droit d'imposer une limite de débit sur cette clé pour protéger votre infrastructure. NEXUS s'engage à la respecter (voir section 6). Une limite raisonnable à discuter ensemble : NEXUS n'a pas besoin d'interroger votre API plus d'une fois toutes les quelques minutes — ce n'est pas un usage temps réel critique.

### 3.7 Chiffrement en transit

Aucun appel ne doit transiter hors HTTPS/TLS. La clé ne doit jamais être transmise ou journalisée en clair.

### 3.8 Restriction par IP, si votre infrastructure le permet

Si vous supportez l'allowlisting d'IP sortantes, NEXUS peut vous fournir une plage d'IP fixes à autoriser en complément de l'authentification par clé — une couche de sécurité supplémentaire, pas un substitut à la clé elle-même.

---

## 4. Ce que NEXUS s'engage à respecter

- **Lecture seule, sans exception.** Aucun appel de NEXUS ne cherche à créer, modifier ou supprimer une donnée chez vous.
- **Aucune demande hors périmètre.** NEXUS ne demande que les champs nécessaires au calcul (section 2.2 et 5) — jamais de données hors ventes.
- **Respect de vos limites de débit.** Voir section 6.
- **Fréquence d'appel raisonnable**, à convenir ensemble plutôt qu'imposée unilatéralement.
- **Signalement, pas insistance.** Si une anomalie est détectée dans les données reçues (champ manquant, incohérence), NEXUS la rejette et la journalise de son côté — il ne réessaie pas en boucle sur un appel qui échoue de façon prévisible.

---

## 5. Exemple complet d'un enregistrement attendu

```json
{
  "id": "sl_987654",
  "created_at": "2026-07-29T14:32:20-04:00",
  "updated_at": "2026-07-29T14:32:20-04:00",
  "status": "completed",
  "ticket_id": "tk_123456",
  "register_id": "caisse-01",
  "employee_id": "emp_045",
  "shift_id": "shift_20260729_01",
  "sold_at": "2026-07-29T14:32:18-04:00",
  "product_id": "prod_00871",
  "barcode": "3290000000000",
  "label": "Amigo Orange 50cl -8P",
  "category": "Boissons",
  "quantity": 2,
  "unit_sale_price_ht": 2.30,
  "unit_sale_price_ttc": 2.50,
  "unit_purchase_price_ht": 1.15,
  "cost_method": "cmp",
  "currency": "EUR",
  "vat_rate": 8.5,
  "discount_ttc": 0,
  "total_ttc": 5.00
}
```

`cost_method` indique comment vous calculez `unit_purchase_price_ht` : `"cmp"` pour un coût moyen pondéré, `"dernier_achat"` si vous utilisez simplement le dernier prix d'achat connu. Cette précision nous évite d'interpréter une marge de façon erronée.

Cet exemple est une cible de départ, pas un format figé — si votre système utilise des noms de champs différents, un mapping peut être convenu ensemble plutôt que de vous imposer une restructuration de votre API existante.

---

## 6. Gestion des erreurs et des limites de débit

| Code HTTP renvoyé par vous | Comportement de NEXUS |
|---|---|
| `429 Too Many Requests` (avec en-tête `Retry-After` si possible) | NEXUS attend le délai indiqué avant de réessayer — jamais de nouvelle tentative immédiate |
| `401` / `403` (clé invalide ou révoquée) | NEXUS arrête les appels et alerte son équipe technique — ne réessaie pas en boucle sur une clé qu'il sait invalide |
| `500` / erreur serveur de votre côté | NEXUS applique un délai croissant entre les tentatives (backoff exponentiel), pas de sollicitation répétée immédiate |
| `200` avec `has_more: false` | Fin de la synchronisation pour ce passage — NEXUS attend le prochain cycle avant de rappeler |

---

## 7. Checklist avant mise en production

- [ ] La clé fournie à NEXUS est strictement lecture seule, vérifiée de votre côté (pas seulement documentée)
- [ ] La clé est associée à un compte de service dédié, pas à un compte humain
- [ ] Le périmètre de la clé est limité aux données de vente
- [ ] Une procédure de révocation immédiate existe et a été testée
- [ ] Le format `updated_since` + `limit` (ou votre curseur opaque) a été validé sur un échantillon réel
- [ ] Les champs `id`, `created_at`, `updated_at`, `status` sont bien présents et fiables sur chaque enregistrement
- [ ] Le rapprochement produit repose bien sur `product_id`/`barcode`, jamais sur `label`
- [ ] La méthode de valorisation du coût (`cost_method`) a été précisée et confirmée
- [ ] Une limite de débit raisonnable a été convenue entre les deux équipes
- [ ] Un test de bout en bout a été réalisé sur un mois de données réelles avant bascule

---

## 8. Contact

Pour toute question technique sur cette intégration :
📧 contact@nexusconseil.net

---

## Historique des versions

| Version | Date | Changement |
|---|---|---|
| v1.0 | 31/07/2026 | Création initiale — document destiné aux éditeurs de logiciels de caisse, distinct de la spécification technique interne NEXUS (`NEXUS-API-Specification-v4.md`) |
| v1.1 | 31/07/2026 | Corrections issues de l'audit de conception API : identifiant produit exclusivement `product_id`/`barcode` (jamais `label`), champs de marge en HT avec `cost_method` et `currency`, checklist complétée |
