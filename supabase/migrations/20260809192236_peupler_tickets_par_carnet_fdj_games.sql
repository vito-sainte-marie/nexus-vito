-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260809192236 · peupler_tickets_par_carnet_fdj_games
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

update public.fdj_games set tickets_par_carnet = 150 where site='vito-sainte-marie' and nom in ('BANCO 1€','GOAL 1€','ASTRO 2€','BLACK JACK 2€','SOLITAIRE 2€');
update public.fdj_games set tickets_par_carnet = 75  where site='vito-sainte-marie' and nom in ('TAROT DIVINATION 2€','X10 2€','FETICHE 2€');
update public.fdj_games set tickets_par_carnet = 100 where site='vito-sainte-marie' and nom in ('CASH POCKET 3€','MT CROISES 3€');
update public.fdj_games set tickets_par_carnet = 50  where site='vito-sainte-marie' and nom in ('MAXI GOAL 3€','MYTHIC JUNGLE 3€','VEGAS 3€','PHARAONIS 3€');
update public.fdj_games set tickets_par_carnet = 60  where site='vito-sainte-marie' and nom in ('EMERAUDE VS RUBIS 5€','X20 5€','CASH 5€','CHIFFRE D''OR 5€','SUPER 10 OU 200 5€','JACKPOT 5€','MAXI BLACKJACK 5€','MAXI MOTS CROISES 5€','TICKET OR 5€');
update public.fdj_games set tickets_par_carnet = 30  where site='vito-sainte-marie' and nom in ('MILLIONNAIRE 10€','MEGA GOAL 10€','MEGA MOTS CROISES 10€');
