-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260809130521 · seed_fdj_jeux_et_emplacements
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


-- ============================================================
-- Seed initial (09/08/2026) : les 29 jeux de grattage réellement vendus à
-- Vito Sainte-Marie Usine, dans l'ordre exact de la feuille CONTROLE CAISSE
-- / FEUILLE LOTO A IMPRIMER (rangement terrain par palier de prix) — et les
-- deux emplacements réellement utilisés aujourd'hui (Bureau + Caisse),
-- modifiables ensuite depuis Paramètres FDJ sans toucher au code.
-- ============================================================
insert into public.fdj_games (site, nom, prix, ordre_affichage) values
  ('vito-sainte-marie', 'BANCO 1€', 1, 10),
  ('vito-sainte-marie', 'GOAL 1€', 1, 20),
  ('vito-sainte-marie', 'FETICHE 2€', 2, 30),
  ('vito-sainte-marie', 'ASTRO 2€', 2, 40),
  ('vito-sainte-marie', 'BLACK JACK 2€', 2, 50),
  ('vito-sainte-marie', 'SOLITAIRE 2€', 2, 60),
  ('vito-sainte-marie', 'X10 2€', 2, 70),
  ('vito-sainte-marie', 'COLOR MIX 2€', 2, 80),
  ('vito-sainte-marie', 'PERLE RARE 2€', 2, 90),
  ('vito-sainte-marie', 'TAROT DIVINATION 2€', 2, 100),
  ('vito-sainte-marie', 'PHARAONIS 3€', 3, 110),
  ('vito-sainte-marie', 'MYTHIC JUNGLE 3€', 3, 120),
  ('vito-sainte-marie', 'MAXI GOAL 3€', 3, 130),
  ('vito-sainte-marie', 'MT CROISES 3€', 3, 140),
  ('vito-sainte-marie', 'VEGAS 3€', 3, 150),
  ('vito-sainte-marie', 'CASH POCKET 3€', 3, 160),
  ('vito-sainte-marie', 'JACKPOT 5€', 5, 170),
  ('vito-sainte-marie', 'CASH 5€', 5, 180),
  ('vito-sainte-marie', 'TICKET OR 5€', 5, 190),
  ('vito-sainte-marie', 'MAXI MOTS CROISES 5€', 5, 200),
  ('vito-sainte-marie', 'X20 5€', 5, 210),
  ('vito-sainte-marie', 'SUPER 10 OU 200 5€', 5, 220),
  ('vito-sainte-marie', 'MAXI BLACKJACK 5€', 5, 230),
  ('vito-sainte-marie', 'EMERAUDE VS RUBIS 5€', 5, 240),
  ('vito-sainte-marie', 'CHIFFRE D''OR 5€', 5, 250),
  ('vito-sainte-marie', 'MILLIONNAIRE 10€', 10, 260),
  ('vito-sainte-marie', 'MEGA MOTS CROISES 10€', 10, 270),
  ('vito-sainte-marie', 'MEGA GOAL 10€', 10, 280),
  ('vito-sainte-marie', 'MISSION PATRIMOINE 15€', 15, 290);

insert into public.fdj_locations (site, nom, type, ordre_affichage) values
  ('vito-sainte-marie', 'Bureau', 'bureau', 10),
  ('vito-sainte-marie', 'Caisse', 'caisse', 20);
