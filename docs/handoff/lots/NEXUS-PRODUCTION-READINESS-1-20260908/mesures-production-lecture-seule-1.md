# Mesures Production en lecture seule

Candidate figée : `ba1eed0e833c354f556128dc0ee4b0619725ed1a`.
Mesure effectuée le 2026-09-09 vers 02:30 UTC via le connecteur Supabase déjà autorisé, sans création de rôle, secret ou capacité supplémentaire et sans aucune écriture Production.
Projet lu : `uzhjpqpctpvxytxpxoqz`.

## Résultats

| Mesure | Valeur | Interprétation |
|---|---:|---|
| Sites Production | 2 | Les 2 sites obtiennent un fuseau résoluble par la migration 4 ; aucun site ne resterait sans fuseau selon les règles actuelles de la migration. |
| `shifts.site_id` divergent de `shifts.site` | 17 | 17 lignes seront corrigées par la migration 3. |
| `mission_catalog.site` divergent de `mission_catalog.site_id` | 89 | 89 lignes seront corrigées par la migration 3. |
| Services correspondant exactement au CTE `a_reprendre` de la migration 6 | 13 | 13 lignes seront passées à `clos_sans_pointage`, `heure_fin` restant NULL, avec `cloture_source = systeme_legacy`. |
| Services actuellement `en_cours` | 16 | La Production est actuellement active. Ce constat interdit de considérer cet instant comme une fenêtre de déploiement sûre. |

## Méthode

La mesure de reprise des services reproduit la condition SQL de `20260905170000_reprise_et_unicite_shifts_en_cours.sql`, avec le fuseau qu'aurait chaque site après `20260905131500_fuseau_horaire_par_site.sql`. La colonne `sites.timezone` n'existe pas encore en Production, ce qui est cohérent avec le fait que cette migration n'a pas encore été appliquée.

Aucune donnée personnelle n'est recopiée dans ce fichier : seuls des agrégats sont enregistrés.

## Limite restante

L'impact exact de `20260905161500_seed_referentiel_advisor.sql` doit encore être comparé champ par champ aux valeurs Production pour distinguer les lignes simplement complétées des lignes réellement écrasées. Ce point reste `INCONNU` tant que cette comparaison n'est pas faite.
