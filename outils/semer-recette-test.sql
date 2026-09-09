-- NEXUS — semis DÉTERMINISTE de la ligne de recette de nexus-test.
--
-- POURQUOI CE FICHIER EXISTE. `outils/capturer-baseline-recette-test.sql`
-- suppose qu'une ligne de recette existe encore au moment de la capture. Le
-- 09/09/2026, une reconstruction interrompue en cours de route a laissé
-- nexus-test sans `station_config`, sans `employees` et sans le site
-- `nexus-station-test` : il n'y avait plus rien À capturer, et le script de
-- répétition ne pouvait donc plus être relancé — sa capture serait revenue
-- vide, et le réensemencement n'aurait rien réensemencé.
--
-- Ce fichier est la SORTIE DE SECOURS : il reconstruit la ligne de recette à
-- partir de sources qui ont survécu, sans jamais rien inventer.
--   · la configuration de station vient de `docs/recettes/config-station-test.json`,
--     l'instantané VERSIONNÉ du dépôt — le même que la CI compare chaque jour
--     pour détecter une dérive ;
--   · les quatre comptes viennent de `auth.users`, que la reconstruction ne
--     touche jamais. Leurs UUID sont lus, jamais fabriqués : c'est ce qui
--     satisfait `employees_id_fkey` sans aucune API d'administration, sans
--     service_role, et sans créer le moindre compte.
--
-- CE QU'IL NE FAIT PAS. Il ne crée aucun compte Auth, ne rotationne aucun
-- secret, ne touche jamais Production, et n'invente aucune donnée métier :
-- ni pointage, ni mission, ni relevé. Un environnement de recette se resème,
-- il ne se reconstitue pas de mémoire.
--
-- Idempotent : `on conflict ... do update`. Rejouable sans effet de bord.

-- 1) Le site de recette. `on conflict do nothing` : s'il existe déjà avec des
--    réglages ajustés à la main, on ne les écrase pas.
insert into public.sites (site_id, nom_entreprise, acces_createur_autorise)
values ('nexus-station-test', 'NEXUS Station Test', true)
on conflict (site_id) do nothing;

-- 2) Les quatre comptes de recette, reliés à auth.users PAR L'ADRESSE.
--    `nexus_identifiant_de_connexion` résout sur `employees.nom` : les deux
--    noms utilisés par la recette navigateur (« Manager Test », « Créateur
--    Test ») sont ceux déclarés dans .github/workflows/tests.yml, pas des
--    inventions. Un compte auth absent ne produit AUCUNE ligne : la jointure
--    ne trouve rien, et le semis reste silencieux plutôt que de fabriquer un
--    employé sans identité.
insert into public.employees (id, username, nom, role, site_id, compte_test, est_createur, actif)
select u.id,
       split_part(u.email, '@', 1),
       m.nom,
       m.role,
       'nexus-station-test',
       true,
       m.createur,
       true
from auth.users u
join (values
        ('manager-test@vito-nexus.local',    'Manager Test',   'manager',  false),
        ('test-createur@vito-nexus.local',   'Créateur Test',  'manager',  true),
        ('employe-test-a@vito-nexus.local',  'Employé Test A', 'caissier', false),
        ('employe-test-b@vito-nexus.local',  'Employé Test B', 'pompiste', false)
     ) as m(email, nom, role, createur) on m.email = u.email
on conflict (id) do update
  set nom = excluded.nom,
      role = excluded.role,
      site_id = excluded.site_id,
      compte_test = excluded.compte_test,
      est_createur = excluded.est_createur,
      actif = excluded.actif;

-- 3) La configuration de station. Les valeurs sont celles de l'instantané
--    versionné du 08/09/2026 : capacités et limites de remplissage réelles de
--    la station de recette, fenêtre de commande, cutoff à 11:00, fuseau
--    America/Martinique. Les recopier ici plutôt que de les relire au hasard
--    garantit que le semis et la comparaison de dérive parlent de la MÊME
--    station — c'est précisément l'écart qui avait fait chercher, le
--    07/09/2026, un défaut imaginaire dans le moteur carburant.
insert into public.station_config (site, fuseau_horaire, cuves_carburants, carburant_commande_config)
values (
  'nexus-station-test',
  'America/Martinique',
  '{"go": {"actif": true, "label": "Gasoil (GO)", "cuves": [
       {"id": "cuve1", "label": "Cuve B", "capacite": 15000, "limite_remplissage": 14250},
       {"id": "cuve2", "label": "Cuve C", "capacite": 8000,  "limite_remplissage": 7600}]},
    "gnr": {"actif": false, "label": "Gasoil non routier (GNR)", "cuves": [
       {"id": "unique", "label": "Cuve D", "capacite": 10000, "limite_remplissage": 9500}]},
    "sp95": {"actif": true, "label": "Sans plomb (SP95)", "cuves": [
       {"id": "unique", "label": "Cuve A", "capacite": 25000, "limite_remplissage": 23750}]}}'::jsonb,
  '{"cutoff_heure": "11:00",
    "jours_commande_iso": [1, 2, 3, 4, 5],
    "jours_livraison_iso": [1, 2, 3, 4, 5],
    "maximum_camion_litres": 36000,
    "minimum_camion_litres": 3000,
    "stock_securite_jours_normal": 2,
    "stock_securite_jours_fin_mois": 1,
    "compartiments_disponibles_litres": [2000, 5000, 7000]}'::jsonb
)
on conflict (site) do update
  set fuseau_horaire = excluded.fuseau_horaire,
      cuves_carburants = excluded.cuves_carburants,
      carburant_commande_config = excluded.carburant_commande_config;
