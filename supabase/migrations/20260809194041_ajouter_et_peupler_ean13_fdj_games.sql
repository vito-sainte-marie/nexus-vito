-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260809194041 · ajouter_et_peupler_ean13_fdj_games
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 09/08/2026, demande de Frédéric : "récupère la planche EAN13" — code-barres
-- EAN13 de chaque jeu de grattage, lus visuellement sur
-- "PlancheEAN13.offreintégralepdf" (Offre intégrale, juillet 2026), pour que
-- NEXUS puisse un jour identifier un jeu par scan (cf. fdj_games.scanner_active
-- et fdj_stock_movements.methode_identification='scan', déjà prévus).
-- Certains jeux ont 2 éditions actives (classique + édition limitée /
-- nouveauté) avec 2 EAN13 différents sur la planche : on garde ici le code
-- de l'édition "classique" / historique comme référence principale.
alter table public.fdj_games add column if not exists ean13 text;
comment on column public.fdj_games.ean13 is 'Code-barres EAN13 du jeu (planche FDJ officielle). Certains jeux ont une 2e édition avec un EAN13 différent (non stocké ici) — voir historique de conversation du 09/08/2026 pour le détail.';

update public.fdj_games set ean13 = '3614690008870' where site='vito-sainte-marie' and nom='BANCO 1€';
update public.fdj_games set ean13 = '3614690008498' where site='vito-sainte-marie' and nom='GOAL 1€';

update public.fdj_games set ean13 = '3614690008474' where site='vito-sainte-marie' and nom='ASTRO 2€';
update public.fdj_games set ean13 = '3614690006470' where site='vito-sainte-marie' and nom='BLACK JACK 2€';
update public.fdj_games set ean13 = '3614690007996' where site='vito-sainte-marie' and nom='FETICHE 2€';
update public.fdj_games set ean13 = '3614690008665' where site='vito-sainte-marie' and nom='SOLITAIRE 2€';
update public.fdj_games set ean13 = '3614690008696' where site='vito-sainte-marie' and nom='TAROT DIVINATION 2€';
update public.fdj_games set ean13 = '3614690001499' where site='vito-sainte-marie' and nom='X10 2€';
update public.fdj_games set ean13 = '3614690008757' where site='vito-sainte-marie' and nom='PERLE RARE 2€';

update public.fdj_games set ean13 = '3614690008597' where site='vito-sainte-marie' and nom='CASH POCKET 3€';
update public.fdj_games set ean13 = '3614690006531' where site='vito-sainte-marie' and nom='MAXI GOAL 3€';
update public.fdj_games set ean13 = '3614690006753' where site='vito-sainte-marie' and nom='MT CROISES 3€';
update public.fdj_games set ean13 = '3614690008672' where site='vito-sainte-marie' and nom='MYTHIC JUNGLE 3€';
update public.fdj_games set ean13 = '3614690001215' where site='vito-sainte-marie' and nom='PHARAONIS 3€';
update public.fdj_games set ean13 = '3614690006333' where site='vito-sainte-marie' and nom='VEGAS 3€';

update public.fdj_games set ean13 = '3614690001406' where site='vito-sainte-marie' and nom='CASH 5€';
update public.fdj_games set ean13 = '3614690008566' where site='vito-sainte-marie' and nom='CHIFFRE D''OR 5€';
update public.fdj_games set ean13 = '3614690008702' where site='vito-sainte-marie' and nom='EMERAUDE VS RUBIS 5€';
update public.fdj_games set ean13 = '3614690006593' where site='vito-sainte-marie' and nom='JACKPOT 5€';
update public.fdj_games set ean13 = '3614690007057' where site='vito-sainte-marie' and nom='MAXI BLACKJACK 5€';
update public.fdj_games set ean13 = '3614690006739' where site='vito-sainte-marie' and nom='MAXI MOTS CROISES 5€';
update public.fdj_games set ean13 = '3614690006685' where site='vito-sainte-marie' and nom='SUPER 10 OU 200 5€';
update public.fdj_games set ean13 = '3614690008085' where site='vito-sainte-marie' and nom='TICKET OR 5€';
update public.fdj_games set ean13 = '3614690001482' where site='vito-sainte-marie' and nom='X20 5€';

update public.fdj_games set ean13 = '3614690006999' where site='vito-sainte-marie' and nom='MEGA GOAL 10€';
update public.fdj_games set ean13 = '3614690006746' where site='vito-sainte-marie' and nom='MEGA MOTS CROISES 10€';
update public.fdj_games set ean13 = '3614690006715' where site='vito-sainte-marie' and nom='MILLIONNAIRE 10€';
