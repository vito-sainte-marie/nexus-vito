# Fiche données : absence justifiée ou injustifiée (Paye, #383)

- Table : `employee_indisponibilites`, colonne ajoutée `justifiee boolean`, nullable.
- Valeurs : `true` justifiée, `false` injustifiée, `null` non renseignée (absences déjà saisies).
- Écriture : le panneau Paye exige le choix avant d'enregistrer une absence. NEXUS ne tranche jamais à la place du manager.
- Droits : aucune nouvelle politique RLS, la colonne hérite de celles de la table.
- Migration : `supabase/migrations/20261125200000_paye_absence_justifiee.sql` (idempotente). Non appliquée : Test seulement après GO, Production sur GO distinct.
- Retour arrière : `alter table public.employee_indisponibilites drop column justifiee;`
- Empreinte md5 de la migration : 4cff13c661198d41e143bf61a4d7018b
- Compteur `MIGRATIONS_REELLES_NOMBRE` : 354 vers 355. L'empreinte d'artefact ne se mesure pas en local : la CI ou Guardian la mesure.
- Aucun calcul de paye modifié.

## Ordre d'application : la migration AVANT le code

La colonne `justifiee` n'existe qu'après la migration `20261125200000_paye_absence_justifiee.sql`. Tant qu'elle n'est pas appliquée, toute déclaration ou précision d'une absence justifiée/injustifiée échoue côté base (Postgres 42703). Le code le traduit en un message clair (« la migration doit être appliquée avant ») et ne modifie rien. Il ne faut donc jamais mettre le code en ligne avant la migration. Aucune application n'est faite sans GO distinct.

La précision après coup passe par `NexusPayeDonnees.preciserJustification` : elle trace la date et l'auteur dans `confirme_le` / `confirme_par`, faute de colonnes dédiées.
