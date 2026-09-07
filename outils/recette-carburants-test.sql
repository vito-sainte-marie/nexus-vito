-- Scénario de recette Carburants — station Test (`nexus-station-test`).
-- Déposé le 07/09/2026, lot CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION-20260906.
--
-- POURQUOI CE FICHIER. `decision-3.md` exigeait une preuve navigateur du cas
-- CARB-004 sur NEXUS Test. La session du 07/09 a découvert que la base Test ne
-- contenait AUCUNE donnée carburant : 0 relevé de jaugeage, 0 quart avec
-- litrage, 0 commande. L'écran répondait donc « données insuffisantes pour une
-- recommandation aujourd'hui » — le moteur refusant, correctement, d'inventer.
-- Sans ce jeu de données, aucune recette Carburants n'est possible sur Test.
--
-- CE QUE LE SCÉNARIO REPRODUIT. Le cas CARB-004 : l'optimiseur atteint
-- réellement le maximum camion (36 000 L), l'arrondi au millier INFÉRIEUR
-- appliqué carburant par carburant en perd 1 000, et la phase de récupération
-- du reliquat les restitue — tout en refusant explicitement, avec motif, le
-- carburant qui n'a plus la capacité de recevoir un compartiment de plus.
--
--   sp95 : en sécurité, plafonné par sa capacité physique  -> 23 000 L
--   go   : à anticiper, arrondi vers le bas puis récupéré  -> 13 000 L
--   total                                                  -> 36 000 L
--
-- COMMENT CES VALEURS ONT ÉTÉ CHOISIES. Elles n'ont pas été devinées ni
-- ajustées jusqu'à ce que l'écran affiche le bon chiffre. Un banc hors ligne a
-- balayé les jaugeages et consommations plausibles EN PASSANT PAR LE VRAI
-- MOTEUR (moteur -> données-core -> P0, la chaîne exacte de l'écran), puis a
-- écarté toute combinaison physiquement incohérente — voir la limite connue
-- ci-dessous. Les valeurs retenues ont ensuite été vérifiées dans les deux
-- sens AVANT toute écriture : 36 000 L avec le correctif Q65, 35 000 L sans.
--
-- LIMITE CONNUE, VOLONTAIREMENT NON EXPLOITÉE. `capaciteDisponibleLivraison`
-- vaut `limite_remplissage - stockPrevuLivraison`. Quand le stock projeté à la
-- livraison est NÉGATIF (station à sec avant l'arrivée du camion), cette
-- capacité dépasse la limite physique de la cuve et le moteur recommande plus
-- que la cuve ne peut contenir — 914 combinaisons du balayage tombaient dans ce
-- cas. C'est un comportement pré-existant, étranger à CARB-004 ; il est signalé
-- comme dette et ce scénario ne s'appuie PAS dessus : les deux stocks projetés
-- y sont positifs et chaque volume tient sous la limite de sa cuve.
--
-- IDEMPOTENT ET NON DESTRUCTEUR. `on conflict` ne met à jour que les trois
-- colonnes de litrage : la ligne du 05/09 quart 2, qui appartient à la recette
-- NEXUS Verify (vente_piste 100, statut conforme), conserve ses montants et son
-- statut. Aucune ligne n'est supprimée.
--
-- BASE DE RECETTE UNIQUEMENT. Ce fichier ne doit jamais être exécuté sur
-- Production.

insert into audits_caisse (site, date, quart, litrage_sp95, litrage_gazole, litrage_gnr)
values
  ('nexus-station-test', '2026-08-24', '1', 726, 431, NULL),
  ('nexus-station-test', '2026-08-24', '2', 786, 397, NULL),
  ('nexus-station-test', '2026-08-25', '1', 699, 449, NULL),
  ('nexus-station-test', '2026-08-25', '2', 757, 415, NULL),
  ('nexus-station-test', '2026-08-26', '1', 672, 468, NULL),
  ('nexus-station-test', '2026-08-26', '2', 728, 432, NULL),
  ('nexus-station-test', '2026-08-27', '1', 645, 487, NULL),
  ('nexus-station-test', '2026-08-27', '2', 699, 449, NULL),
  ('nexus-station-test', '2026-08-28', '1', 618, 505, NULL),
  ('nexus-station-test', '2026-08-28', '2', 670, 467, NULL),
  ('nexus-station-test', '2026-08-29', '1', 726, 431, NULL),
  ('nexus-station-test', '2026-08-29', '2', 786, 397, NULL),
  ('nexus-station-test', '2026-08-30', '1', 699, 449, NULL),
  ('nexus-station-test', '2026-08-30', '2', 757, 415, NULL),
  ('nexus-station-test', '2026-08-31', '1', 672, 468, NULL),
  ('nexus-station-test', '2026-08-31', '2', 728, 432, NULL),
  ('nexus-station-test', '2026-09-01', '1', 645, 487, NULL),
  ('nexus-station-test', '2026-09-01', '2', 699, 449, NULL),
  ('nexus-station-test', '2026-09-02', '1', 618, 505, NULL),
  ('nexus-station-test', '2026-09-02', '2', 670, 467, NULL),
  ('nexus-station-test', '2026-09-03', '1', 726, 431, NULL),
  ('nexus-station-test', '2026-09-03', '2', 786, 397, NULL),
  ('nexus-station-test', '2026-09-04', '1', 699, 449, NULL),
  ('nexus-station-test', '2026-09-04', '2', 757, 415, NULL),
  ('nexus-station-test', '2026-09-05', '1', 672, 468, NULL),
  ('nexus-station-test', '2026-09-05', '2', 728, 432, NULL),
  ('nexus-station-test', '2026-09-06', '1', 645, 487, NULL),
  ('nexus-station-test', '2026-09-06', '2', 699, 449, NULL),
  ('nexus-station-test', '2026-09-07', '1', 672, 468, NULL)
on conflict (site, date, quart) do update
  set litrage_sp95 = excluded.litrage_sp95,
      litrage_gazole = excluded.litrage_gazole,
      litrage_gnr = excluded.litrage_gnr;

-- Jaugeage d'ouverture du jour de recette. Le GNR reste NULL : la cuve D est
-- déclarée inactive dans station_config, et un relevé sur un carburant inactif
-- serait une donnée qui n'existe pas dans la vraie vie.
insert into carburant_releves
  (site, date, stock_reel_sp95, stock_reel_go_cuve1, stock_reel_go_cuve2, stock_reel_gnr, origine, mesure_le, controle_statut)
values
  ('nexus-station-test', '2026-09-07', 3000, 3000, 800, NULL, 'manager', '2026-09-07T13:30:00Z', 'en_attente');
