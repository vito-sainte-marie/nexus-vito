-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803170938 · creer_site_fantome_test_isole
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Site fantôme de test (03/08/2026, demande de Frédéric) : "je me suis
-- inscrit en tant qu'employé pour me connecter et voir les corrections à
-- faire... aucune de mes actions ne doit corrompre le fonctionnement avec
-- les autres employés... c'est un compte fantôme juste pour tester."
--
-- Plutôt qu'une règle de code fragile ("si c'est CET employé, ne pas
-- écrire vraiment"), l'isolation vient de la donnée elle-même : ce compte
-- reçoit son PROPRE site_id, distinct de 'vito-sainte-marie'. RLS
-- (current_employee_site_id()) et tous les filtres .eq('site', ...) déjà
-- en place dans NEXUS (Verify, Inventaire, Progression...) l'empêchent
-- alors STRUCTURELLEMENT de jamais lire ou écrire une ligne du vrai site —
-- pas de corruption possible, sans avoir à toucher au code existant.
-- Toutes ses actions restent réelles et enregistrées (il verra donc les
-- vrais résultats, écarts, badges, etc.), mais dans un espace totalement
-- étanche.

insert into sites (site_id, nom_entreprise, logo_url, couleur_accent, acces_createur_autorise, forfait)
select 'site-fantome-test', 'Site Test (fantôme)', logo_url, couleur_accent, acces_createur_autorise, forfait
from sites where site_id = 'vito-sainte-marie';

insert into station_config (site, horaires, prix_carburants, manager_pointage_requis, parametres_inventaire)
select 'site-fantome-test', horaires, prix_carburants, manager_pointage_requis, parametres_inventaire
from station_config where site = 'vito-sainte-marie';

insert into inventaire_zones (id, site, code, nom)
select gen_random_uuid(), 'site-fantome-test', code, nom
from inventaire_zones where site = 'vito-sainte-marie';

insert into inventaire_categories (id, site, nom, ordre_affichage)
select gen_random_uuid(), 'site-fantome-test', nom, ordre_affichage
from inventaire_categories where site = 'vito-sainte-marie';

insert into inventaire_zone_produit (id, site, designation, code_barres, source, categorie_id, zone_id, unite, sensible, ordre_affichage, actif)
select gen_random_uuid(), 'site-fantome-test', zp.designation, zp.code_barres, zp.source,
  catf.id, zonf.id, zp.unite, zp.sensible, zp.ordre_affichage, zp.actif
from inventaire_zone_produit zp
join inventaire_categories cat on cat.id = zp.categorie_id and cat.site = 'vito-sainte-marie'
join inventaire_categories catf on catf.nom = cat.nom and catf.site = 'site-fantome-test'
join inventaire_zones zon on zon.id = zp.zone_id and zon.site = 'vito-sainte-marie'
join inventaire_zones zonf on zonf.code = zon.code and zonf.site = 'site-fantome-test'
where zp.site = 'vito-sainte-marie';

-- Bascule le compte fantôme existant ("employe", pompiste, actuellement
-- inactif) vers ce site isolé, et le réactive.
update employees set site_id = 'site-fantome-test', actif = true
where id = '32ef8323-9209-4d75-8eac-1e9fc7c47ead';
