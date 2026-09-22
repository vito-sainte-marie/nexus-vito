# Candidat P0-1/P0-3 reconstruit depuis Production — preuve canonique

Transport canonique de la preuve produite par Claude sur le commit `70dd1fc`, en réponse à `decision-6.md`.

Base mesurée : `origin/production = 6c3efccc0167ea6d0537245bc9dfaa1dad329509`.

Conclusion vérifiée : `dd4d0f3` n'est pas un prérequis de P0-1/P0-3. Les primitives `NexusStation.dateLocaleStation`, `NexusVerifyMoteur.statutValidationQuart`, le fuseau station et les colonnes de validation nécessaires sont déjà présents en Production.

Candidat minimal reconstruit depuis Production :
- `nexus-app-donnees.js` — `chargerStatutCarburantsHome(client, siteId, timezone)` et date métier via `NexusStation.dateLocaleStation` quand le fuseau est fourni ; repli UTC inchangé sinon.
- `nexus-conseiller-donnees.js` — `chargerControlesVerifyRestants(client, siteId, timezone)` ; sélection des champs de validation et comptage uniquement des quarts réellement `valide`/`ajuste` selon `NexusVerifyMoteur.statutValidationQuart`.
- `NEXUS-App-v1.html` — chargement de `nexus-verify-moteur.js` et passage de `FUSEAU_STATION` à `chargerControlesVerifyRestants`.

Aucune migration, RLS, rôle, `station_config.raccourcis`, P0-2, B1, #62/#65 ou Brief modifié.

Tests réellement exécutés par Claude sur baseline/candidat/mutation : 8/8. La baseline Production reproduit P0-1 (bascule UTC à 20h Martinique) et P0-3 (audit saisi non validé compté comme fait) ; le candidat corrige les deux ; la mutation réinjectant le comportement baseline refait échouer la frontière temporelle.

Limite résiduelle explicite : faute de checkout/worktree git autorisé dans le run Claude, la suite complète `run-tests.js` n'a pas encore été rejouée sur un véritable arbre Production + candidat. Cette preuve est obligatoire avant toute proposition de promotion Production.

Source de transport : commit Claude `70dd1fc`, fichier `candidat-p0-production-1.md`. Ce transport n'est pas une promotion Production et n'autorise aucune écriture Supabase.