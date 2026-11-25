# Recette 2f : atomicité Auth/base (Test uniquement)

Prérequis : variable `RECETTE_PANNES=1` posée par le gérant sur Test. Supprimer la ligne de `nexus_connexion.panne_injectee` après chaque cas (`panne_pour` ne la consomme pas).
Cible : un compte fictif de Test. Session gérant : mot de passe Auth temporaire sur Manager Test, hash d'origine restauré et comparé ensuite (annoncé sur #160).

Cas, avec `POST /functions/v1/connexion` `{"action":"reinitialiser_code","cible":"<uuid>"}` et jeton gérant :
1. Gérant autorisé : 200 + code temporaire ; connexion avec ce code : `changer_code:true` ; `changer_code` ; l'ancien code temporaire est refusé.
2. Panne `auth` : 401, état et ancien code inchangés.
3. Panne `base` : 401, mot de passe Auth restauré, ancien code valide.
4. Pannes `base` + `compensation` : 401, `comptes_incoherents()` liste le compte (chemin, étape), ancien code refusé, version en base inchangée.
5. Réparation : pannes supprimées, réinitialisation par le gérant, connexion avec le code temporaire, `changer_code` ; `comptes_incoherents()` = 0 ligne, `panne_injectee` = 0 ligne.
6. Appelant non autorisé : sans jeton ou jeton invalide : 403. Caissier (JWT réel) : 403, Auth non touché, `auteur_refuse` au journal.
