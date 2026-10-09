# Mesure Production en lecture seule : référentiel Advisor

Candidate de référence : `ba1eed0e833c354f556128dc0ee4b0619725ed1a`.

Cette mesure a été exécutée après fixation de la candidate, sur Supabase Production, exclusivement par des requêtes `SELECT`. Aucun rôle, secret, jeton ou accès supplémentaire n'a été créé. Aucune donnée Production n'a été écrite.

## Résultat

Comparaison des valeurs actuellement présentes en Production avec les champs que la migration `20260905161500_seed_referentiel_advisor.sql` modifierait par `ON CONFLICT (code) DO UPDATE` :

| Table | Complétées | Écrasées | Identiques | Total versionné |
|---|---:|---:|---:|---:|
| `nexus_language_templates` | 0 | 0 | 6 | 6 |
| `advisor_rules` | 0 | 0 | 31 | 31 |

Verdict mesuré : la migration du référentiel Advisor est, sur l'état Production observé lors de cette mesure, un **no-op matériel sur les données existantes**. Aucun code versionné n'est absent et aucun champ que l'upsert modifierait ne diverge.

Cette preuve est temporelle. Elle doit être revalidée avant la gate finale si la candidate change ou si les lignes concernées peuvent avoir évolué depuis cette mesure.

## Portée

Cette mesure ferme uniquement l'inconnu relatif à l'impact actuel de la migration Advisor. Elle ne constitue ni une autorisation Production, ni une preuve PREPROD, ni une validation de la fenêtre de déploiement.