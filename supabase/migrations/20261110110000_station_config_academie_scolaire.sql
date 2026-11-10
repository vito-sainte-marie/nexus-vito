-- Calendrier du site (Guardian 6769932054) : académie dont le site suit le calendrier scolaire.
-- null = non suivi (aucune vacance n'est alimentée). Liste fermée : les 36 académies du jeu de données
-- « Calendrier scolaire » de data.education.gouv.fr (champ location), lu le 10/11/2026.
-- Réglage de station : un gérant peut le modifier via la politique d'écriture existante de station_config.
-- Idempotente.

alter table public.station_config add column if not exists academie_scolaire text;

alter table public.station_config drop constraint if exists station_config_academie_scolaire_check;
alter table public.station_config add constraint station_config_academie_scolaire_check
  check (academie_scolaire is null or academie_scolaire in ('Aix-Marseille', 'Amiens', 'Besançon', 'Bordeaux', 'Caen', 'Clermont-Ferrand', 'Corse', 'Créteil', 'Dijon', 'Grenoble', 'Guadeloupe', 'Guyane', 'Lille', 'Limoges', 'Lyon', 'Martinique', 'Mayotte', 'Montpellier', 'Nancy-Metz', 'Nantes', 'Nice', 'Normandie', 'Nouvelle Calédonie', 'Orléans-Tours', 'Paris', 'Poitiers', 'Polynésie', 'Reims', 'Rennes', 'Rouen', 'Réunion', 'Saint Pierre et Miquelon', 'Strasbourg', 'Toulouse', 'Versailles', 'Wallis et Futuna'));

comment on column public.station_config.academie_scolaire is 'Académie dont le site suit le calendrier scolaire (liste fermée, jeu data.education.gouv.fr « Calendrier scolaire »). null = non suivi. Paramétrable depuis NEXUS-Parametres-Station-v1.html ; lue par le workflow mensuel des vacances.';

update public.station_config set academie_scolaire = 'Martinique'
 where site = 'vito-sainte-marie' and academie_scolaire is null;
