# Recette Connexion sécurité (#381), Test, 26/11/2026

Comptes fictifs `RecetteNav…` uniquement, base Test. Aucun code, aucune donnée réelle.
Chaque cas existe en 4 combinaisons : `mobile`/`bureau` × `jour`/`nuit`. Aperçu : claude-connexion-securite.nexus-test-ddf.pages.dev

| Fichiers | Cas | Ce que montre l'image |
|---|---|---|
| `cas1_*.png` | 1. Connexion normale | Page de connexion, puis arrivée sur l'application |
| `cas2_*.png` | 2. Mauvais code | Message d'échec identique pour tout échec, sans indice sur le compte |
| `cas3_*.png` | 3. Échecs répétés | Attente puis verrouillage affichés ; les essais faits pendant l'attente ne comptent pas comme échecs |
| `cas4_*.png` | 4. Code temporaire | Écran « Choisissez votre code » après réinitialisation par un manager |
| `cas5_*.png` | 5. Connexion indisponible | Panne 503 simulée sur la première requête, relance automatique transparente : la connexion aboutit et la personne arrive dans l'application (aucun message d'erreur). Le bandeau « Prise de poste impossible » vient du paramétrage du site de recette, pas de la connexion |
| `brief_manager_*.png` | Carte du Brief (manager) | Carte « Connexion indisponible », libellé manager, sans bouton |
