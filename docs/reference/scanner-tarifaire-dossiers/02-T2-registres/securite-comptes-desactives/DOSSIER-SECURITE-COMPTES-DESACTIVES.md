# Dossier de sécurité séparé : accès des comptes désactivés dans NEXUS (hors T2)

Ouvert le 16/11/2026. Constat seulement : aucune correction préparée ni appliquée, fonctions d'aide partagées inchangées.
Sources : catalogue du projet Test, lu en lecture seule ; branche production du dépôt. Production non lue.

## Constat

- `current_employee_role()`, `current_employee_site_id()` et `je_suis_createur()` ne lisent pas `employees.actif`.
- Dans Test, 379 politiques RLS sur 152 tables s'appuient sur ces fonctions, dont 214 donnent un droit d'écriture.
- Aucun contrôle indépendant : aucune politique, aucun déclencheur, aucun hook d'authentification, aucune fonction Edge ne lit `actif`.
  `nexusRequireAuth()` ne le lit pas non plus.
- `nexus_identifiant_de_connexion` filtre `actif`, mais seulement pour retrouver l'identifiant depuis le prénom à l'écran de connexion,
  et laisse passer un compte de test désactivé. Une session ouverte ou un jeton de rafraîchissement ne sont pas coupés.
  Durée des jetons d'accès en Test : 3 600 s (`app.settings.jwt_exp`).

Conséquence : désactiver un employé dans `employees` ne lui retire aucun droit tant que son identité d'authentification existe.

## Ce qui est déjà traité

Les seuls registres tarifaires T2 sont protégés par la migration isolée `20261118100300` (politique restrictive par registre).

## Options à arbitrer (non préparées)

1. Procédure de désactivation : supprimer ou bannir l'identité dans Authentication en même temps que `actif = false`. Aucun changement de schéma,
   mais dépend d'un geste manuel.
2. Politique restrictive « compte actif » sur chaque table concernée, comme pour T2. Retire des droits sans en ajouter, mais touche 152 tables.
3. Filtrer `actif` dans les trois fonctions d'aide. Le plus court, mais change le comportement de tout NEXUS d'un coup, y compris les comptes de test.

Chaque option demande une vérification préalable sur Production, sur GO, et une recette propre.
