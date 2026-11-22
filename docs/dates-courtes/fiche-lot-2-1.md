# Fiche lot 2.1 : nom de tournée généré et renommage

Décision du pilote du 22/11/2026 à 16 h 56 (#160, 7085669921). Branche `claude/dates-courtes-lot2-1`, PR en brouillon. Rien appliqué sur Test ni en Production.

## Règles
1. Nom généré à la création par le serveur : `Contrôle DLC · <prénom> · <JJ/MM>`. Prénom = celui que NEXUS affiche déjà (`employees.nom`), jamais l'identifiant de connexion. Date dans le fuseau de la station (`sites.timezone`).
2. Aucune saisie obligatoire : « Nouvelle tournée » ouvre la tournée en un geste.
3. Action discrète « Renommer » : seul le libellé change.
4. Plusieurs tournées le même jour : noms identiques possibles, l'heure de début distingue.
5. Affichage : nom, puis `Commencée à 14 h 05 · <état>`, dans la liste et le bandeau.

## Serveur (migration 20261122180000, additive)
- `dates_courtes_creer_tournee` : nom nul ou vide, le serveur le construit.
- `dates_courtes_renommer_tournee(uuid, text, text)` : security definer, auteur ou direction du site, nom nettoyé de 1 à 60 caractères, refusé sur tournée certifiée, idempotent, aucun droit pour `anon`.
- `dates_courtes_nom_genere` et `dates_courtes_lire_tournees` (lecture avec repli pour les anciennes tournées sans nom, sans réécrire les lignes).
- Trace proposée : table `dates_courtes_renommages_tournee` (ancien nom, renommeur, instant), ajout seulement.

## Preuves
- Recette locale pglite : 56 contrôles, 0 ko.
- Retour arrière : `docs/deploiement/retour-arriere-dates-courtes-lot2-1-20261122.sql`.
- ORDRE-MIGRATION-CODE : entrée 20261122180000 dans `qualification-ordre-migration-code.json` (additive, compatible avant le code). Compteur des migrations 347 et empreinte mises à jour.

## Hors lot
Suivi du manager dans Produits (nom, auteur, date, heure, nombre de produits, état de certification, anomalies) : lot 3.
