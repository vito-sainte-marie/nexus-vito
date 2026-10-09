# Plan — une seule colonne de rattachement au site

Lot séparé, applicatif. Le correctif A2 du 04/09 rend la double colonne
**inoffensive** ; il ne la supprime pas.

## Où on en est

`shifts` et `mission_catalog` portent chacune `site` ET `site_id`, `text`,
`NOT NULL`. Depuis la migration `20260904193000` :

- une contrainte `site = site_id` interdit qu'une ligne porte deux sites ;
- un déclencheur renseigne les deux depuis le site du compte authentifié et
  refuse toute valeur divergente venue du client ;
- la RLS d'insertion de `shifts` vérifie le site ;
- le défaut `'vito-sainte-marie'` a disparu des quatre colonnes.

L'anomalie ne peut donc plus se produire. Mais la duplication demeure, et avec
elle la question « laquelle des deux fait foi ? », qui a déjà coûté une
anomalie bloquante.

## Ce que le dépôt dit de chaque colonne

| | `shifts` | `mission_catalog` |
|---|---|---|
| Politiques RLS | `site_id` (3/3) | `site_id` (4/4) |
| Lectures applicatives | aucune des deux — tout passe par `employee_id` | `site_id` (6 écrans) |
| Écritures applicatives | `site` seul (Prise de poste) | `site_id` seul (Scanner) ; les deux (Tempo) |
| Vues et fonctions de la base | aucune | aucune |

`site_id` est donc la source de vérité de fait : la sécurité ne connaît que
lui, les lectures aussi. `site` n'est lu par personne — ni par la base, ni par
l'application.

## Déroulé proposé

1. **Faire écrire `site_id` à l'écran de Prise de poste**, seul écrit de
   `shifts` de toute l'application (`NEXUS-Prise-De-Poste-v1.html:291`). Une
   ligne à changer. Le déclencheur rend l'opération sans risque : pendant la
   transition, écrire l'une ou l'autre donne le même résultat.
2. **Faire écrire `site_id` au Scanner** — c'est déjà le cas — et vérifier que
   Tempo n'écrit plus que `site_id`.
3. **Passer `site` en colonne générée** : `alter table … alter column site
   drop not null`, puis recréation en `generated always as (site_id) stored`.
   Toute écriture de `site` devient alors impossible, ce qui révèle le code
   oublié au lieu de le laisser diverger. Étape de sécurité avant suppression.
4. **Laisser passer un cycle complet de recette** avec la colonne générée.
5. **Supprimer `site`**, une table par migration, et retirer le déclencheur
   devenu sans objet — la contrainte disparaît avec la colonne.

## Ce qu'il ne faut pas faire

- Supprimer `site` avant l'étape 1 : l'écran de Prise de poste échouerait, et
  plus aucun employé ne pourrait prendre son service.
- Traiter ce lot en même temps que le retrait des 58 défauts
  (`docs/plans/2026-09-04-defauts-site-production.md`). Ce sont deux
  mouvements distincts : ici on supprime une colonne en trop, là on supprime
  une valeur par défaut dangereuse.
- Considérer que la contrainte suffit et refermer le sujet. Elle empêche
  l'incohérence ; elle n'empêche pas le prochain développeur de se demander
  laquelle des deux colonnes remplir.
