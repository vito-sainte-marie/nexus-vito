# Plan — retirer les 58 valeurs par défaut `site = 'vito-sainte-marie'`

Lot séparé. **Ne pas fondre dans un correctif de sécurité.** Rien de ce qui
suit n'est à exécuter avant que l'inventaire ci-dessous ait été relu ligne à
ligne par un humain.

## Le constat

58 colonnes `site` / `site_id`, réparties sur 56 tables, portent en base
`DEFAULT 'vito-sainte-marie'::text` — l'identifiant du site de production.
Tout `INSERT` qui omet la colonne y atterrit.

Aujourd'hui, rien ne se produit : la RLS refuse l'écriture (vérifié par
tentative réelle le 04/09 — l'insertion sans colonne `site` est *rejetée*,
elle n'est pas silencieusement déviée). Le danger n'est donc pas actuel, il
est conditionnel : le jour où une politique est assouplie, élargie à un
créateur, ou remplacée par une garde applicative, le défaut reprend la main
sans que rien ne le signale. Une donnée d'un commerce atterrit chez un autre,
et l'erreur ne se voit qu'après coup.

## Inventaire — état au 04/09/2026

    node outils/inventorier-ecritures-site.mjs

141 écritures applicatives repérées sur 45 de ces tables. 126 nomment
explicitement le site. **15 ne le nomment pas dans leur voisinage immédiat** :

| Fichier | Table | Opération |
|---|---|---|
| `NEXUS-Assignations-v1.html:255` | `mission_assignments` | insert |
| `NEXUS-Debug-v1.html:198` | `pointages` | insert |
| `NEXUS-FDJ-Manager-v1.html:5467` | `fdj_alertes` | insert |
| `NEXUS-FDJ-Manager-v1.html:5184` | `fdj_shift_counts` | upsert |
| `NEXUS-FDJ-Manager-v1.html:3075` | `fdj_stock_movements` | insert |
| `NEXUS-FDJ-Manager-v1.html:3248` | `fdj_stock_movements` | insert |
| `NEXUS-FDJ-Manager-v1.html:3541` | `fdj_stock_movements` | insert |
| `NEXUS-Inventaire-Manager-v1.html:1700` | `inventaire_rapprochements` | insert |
| `NEXUS-Inventaire-v1.html:630` | `inventaire_comptages` | upsert |
| `NEXUS-Inventaire-v1.html:782` | `inventaire_mouvements` | upsert |
| `NEXUS-Missions-v1.html:1252` | `mission_completions` | insert |
| `NEXUS-Planning-v1.html:354` | `employee_contraintes` | upsert |
| `nexus-coach-fdj-donnees.js:317` | `coach_daily_recommendations` | insert |
| `nexus-inventaire-transferts-internes.js:195` | `inventaire_mouvements` | insert |
| `nexus-paye-donnees.js:162` | `employee_indisponibilites` | insert |

Cette liste est une **heuristique** : le site peut être porté par un objet
construit plus haut, ou par un `spread`. Elle dit où regarder, pas ce qui est
cassé. Les 126 autres ne sont pas non plus une garantie — elles ne sont
qu'hors de portée du soupçon immédiat.

## Déroulé proposé

1. **Relire les 15**, une par une, et classer : site déjà transmis autrement,
   ou réellement absent. Corriger le code des secondes — le site doit être
   écrit explicitement, jamais laissé au défaut. C'est du code, pas de la
   base : aucun risque de perte de données.
2. **Rejouer l'inventaire** jusqu'à ce qu'il ne signale plus rien.
3. **Poser le piège avant de retirer le filet** : un test de non-régression
   qui échoue dès qu'une ligne métier apparaît sur le site sentinelle. Le
   cadrage le prévoit ; il n'existe pas encore. Sans lui, l'étape 4 se fait à
   l'aveugle.
4. **Retirer les défauts, table par table**, `alter column … drop default`.
   Par lots thématiques (FDJ, inventaire, planning, paye), un lot par
   migration, chacun passé en recette avec le scénario métier correspondant.
   Une migration unique de 58 colonnes ne serait ni relisible ni réversible
   utilement.
5. **Vérifier après chaque lot** que les écrans concernés écrivent toujours,
   et que le site sentinelle reste vide.

## Ce qu'il ne faut pas faire

- Retirer les 58 défauts en une migration. Un `NOT NULL` sans défaut
  transforme chaque oubli en erreur d'exécution : c'est le but, mais il faut
  que les oublis aient été corrigés **avant**, pas découverts en production.
- Remplacer le défaut par un autre site « neutre ». Un défaut reste un défaut :
  il fait écrire quelque part au lieu de refuser d'écrire.
- Traiter ce lot en même temps que le retrait du site sentinelle. Le
  sentinelle est le seul témoin ; il part en dernier.
