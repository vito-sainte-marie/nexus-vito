-- Déjà appliquée en Production (version 20261110140000) : ce fichier consigne le texte exact
-- lu dans supabase_migrations.schema_migrations. Ne pas rejouer sur Production.
-- Sans effet si la clé existe déjà ou si le site est absent (ex. Test).
update public.station_config set carburant_commande_config = carburant_commande_config || '{"jours_commande_iso":[1,2,3,4,5]}'::jsonb where site='vito-sainte-marie' and not (carburant_commande_config ? 'jours_commande_iso');
