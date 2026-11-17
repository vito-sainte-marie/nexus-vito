# Preuve ciblée : accès des comptes désactivés aux registres T2

16/11/2026. Lecture seule du projet Test et de la branche production du dépôt. Aucune migration, aucun compte créé.

## 1. Constat : aucun contrôle indépendant

| Point vérifié (Test, catalogue) | Résultat |
| --- | --- |
| `current_employee_role()`, `current_employee_site_id()` | `select role / site_id from employees where id = auth.uid()` : `actif` n'est pas lu. |
| Politiques RLS citant `actif` (tous schémas) | Aucune. Aucune politique RESTRICTIVE. |
| Déclencheurs sur `employees` | Aucun. |
| Hook d'authentification, fonction de bannissement | Aucun. |
| Fonctions Edge du projet Test | Aucune. |
| `nexus_identifiant_de_connexion(p_prenom)` | Filtre `actif = true or compte_test = true` : bloque seulement la traduction prénom vers identifiant à l'écran de connexion. Ne ferme ni une session ouverte, ni un jeton de rafraîchissement, ni une connexion directe par adresse. Laisse passer un compte de test désactivé. |
| `nexusRequireAuth()` (nexus-auth.js, production) | Lit `id, username, nom, role, est_createur, site_id` : `actif` n'est pas lu. Contrôle côté navigateur de toute façon. |
| Données Test | 8 employés, 0 désactivé, 0 gérant : le cas n'a jamais été exercé. |

## 2. Démonstration sur base jetable (socle calqué sur Test)

Sans correction (migrations v2 seules) : les 11 accès testés passent pour un gérant, un manager, un créateur et un compte de test
désactivés (lecture, vue des exceptions, création, décision de prix, annulation, candidature, déclaration de saisie). Contrôle 100.

## 3. Correction isolée : `20261118100300_tarif_registres_comptes_desactives.sql`

- Une politique RESTRICTIVE `compte_actif_obligatoire` par registre : combinée en ET avec les politiques existantes, elle ne peut que retirer un accès.
- La personne lit sa propre ligne `employees` sous la politique existante `select_employees` : aucune fonction nouvelle, aucun SECURITY DEFINER, aucun GRANT.
- `v_tarif_exceptions_effectives` : la branche `produits_appel` (table NEXUS lisible par tout employé du site, actif ou non) n'est reprise que pour un compte actif.
- Fonctions d'aide partagées, autres tables NEXUS et Production : non modifiées.

Après correction : 12 accès sur 12 bloqués ; un gérant actif lit et écrit ; un gérant réactivé retrouve l'accès sans autre geste. Contrôles 1D1 à 1R1.
Ordre à respecter : 100300 après 100200. Rejouer 100200 seul rétablirait l'ancienne vue des exceptions ; rejouer 100300 ensuite la referme.

## 4. Hors périmètre, signalé

Le même défaut touche toutes les tables NEXUS qui s'appuient sur `current_employee_role()` ou `current_employee_site_id()`, en Test comme,
selon toute vraisemblance, en Production (non vérifié : lecture Production non faite). Le traiter demande une décision distincte, car la correction
naturelle (filtrer `actif` dans les fonctions d'aide) change le comportement de tout NEXUS, y compris pour les comptes de test.

## 5. Comptes gérants de recette (dossier `comptes_recette/`, non exécuté)

- Identités : `recette-t2-gerant-sm@vito-nexus.local` (vito-sainte-marie de Test), `recette-t2-gerant-fantome@vito-nexus.local` (site-fantome-test, isolation).
  Création dans Authentication par vous, mot de passe hors dépôt. Vérifié dans Test : aucune collision de nom ni d'identifiant, aucune identité existante.
- `40_..._creation.sql` : rôle gerant, `compte_test`, non créateur, aucun autre droit. Gardes : sites propres à Test présents, identités créées, nom non ambigu.
- `41_..._desactivation.sql` : `actif = false` (bloque les registres T2 grâce à 100300), puis bannissement de l'identité dans Authentication (geste réservé), lignes conservées pour la traçabilité.
- Exercés sur base jetable : contrôles 120 à 125.

## 6. Version 4 : conditions du contre-audit

1. Garde explicite du projet Test (`comptes_recette/00_garde_projet_test.sql`, recopiée en tête des scripts 40, 41, 50 et des données de recette).
   Elle compare l'identifiant système du cluster PostgreSQL (`pg_control_system()`, lisible par postgres) à celui du projet Test
   udljdqxerrbbbajxubfn, 7678069749886157684, relu le 16/11/2026. Fixé à la création du cluster, il diffère d'un projet Supabase à l'autre.
   Les sites de recette restent une seconde vérification. Toute autre base est refusée avant la moindre écriture (contrôles 128, 128b, 125).
   Si Test était un jour restauré ou recréé, la garde refuserait : il faudrait relire la valeur et la mettre à jour.
   Non fait : comparaison avec l'identifiant de Production (lecture Production non autorisée).
2. Identités compatibles avec Authentication (Test, lecture seule) : les 4 identités existantes suivent toutes le format retenu
   (adresse = identifiant + @vito-nexus.local, identifiant avec tirets, fournisseur e-mail, e-mail confirmé). C'est ce qu'attend l'écran de connexion.
   Création par Authentication > Add user avec « Auto Confirm User ». Après les essais : suppression de l'identité, qui coupe sessions et jetons.
3. Ordre des migrations imposé : 100300 refuse de passer avant 100000, 100100 et 100200 ; 100200 refuse de repasser après 100300 (contrôles 126, 127).
4. Preuve d'accès pour Test (`comptes_recette/50_preuve_acces_test.sql`) : gérant actif de vito-sainte-marie, gérant actif de site-fantome-test,
   manager et gérant désactivé éphémères, plus anon. 16 cas. Le script se termine toujours par une erreur volontaire qui annule tout et porte le résultat.
   Sur base jetable : 16 cas conformes, aucune écriture conservée, et la preuve échoue bien si la politique restrictive est retirée (contrôles 129 à 131).
5. Défaut transversal : dossier de sécurité séparé, `securite-comptes-desactives/DOSSIER-SECURITE-COMPTES-DESACTIVES.md`. Fonctions d'aide inchangées.

## 7. Version 5 : garde dans les quatre migrations

- Chaque migration commence par la garde du projet Test (identifiant système du cluster 7678069749886157684, puis sites de recette),
  avant toute instruction qui modifie la base. Contrôle 149 : c'est la première instruction exécutable des quatre fichiers.
- Base non autorisée A (socle Test seul) : les quatre migrations d'origine sont refusées par la garde ; empreinte du catalogue
  (tables, vues, fonctions, droits, politiques, déclencheurs, contraintes, schémas) et des données identique avant et après. Contrôles 140 à 143.
- Base non autorisée B (trois migrations déjà en place) : même refus, rien n'est recréé ni modifié. Contrôles 145 à 148.
- Socle local de Test, avec l'identifiant de la base jetable substitué dans des copies : les quatre migrations passent dans l'ordre prévu,
  et les 138 contrôles précédents restent verts. Total : 150 OK, 0 échec.
- Conséquence pour l'exécution en Test : appliquer les fichiers tels quels. Sur toute autre base, Production comprise, ils s'arrêtent à la garde.
