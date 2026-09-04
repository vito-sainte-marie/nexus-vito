-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260802150818 · nexus_inventaire_v1_seed_zone_produit
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Peuplement de inventaire_zone_produit (02/08/2026) à partir du fichier de
-- rattachement validé par Frédéric (feuille papier ↔ catalogue products).
-- Décisions actées par Frédéric dans le fichier renvoyé :
--  - Jus de Canne Local 50cl : retiré (doublon non confirmé de Fruitybon Local).
--  - Gamme CBD Sixty8 (5 réf.) : retirée, absente du catalogue actuel.
--  - Maxi Pain Choco - 90P : ajouté en plus de Pain Chocolat - 68P.
--  - FCE Antilles Spécial : édition tournante, pas un code-barres fixe → article
--    interne "FCE Antilles Spécial (édition du moment)".
--  - Sélection Lavazza : ce n'est pas un stock compté mais un relevé de
--    compteur (machine à café) → article interne, même logique que le
--    jaugeage carburant.
-- cartouche_campingaz et sodastream restent en zone boutique (caissières),
-- comme confirmé par Frédéric, malgré leur catégorie "Gaz".

with src(designation, code_barres, source, categorie_nom, zone_code, sensible, unite) as (
  values
  -- Jaugeage Carburant (interne, piste)
  ('SS Plomb 30 000', null, 'interne', 'Jaugeage Carburant', 'piste', false, 'litres'),
  ('Gazole 20 000', null, 'interne', 'Jaugeage Carburant', 'piste', false, 'litres'),
  ('Gazole 10 000', null, 'interne', 'Jaugeage Carburant', 'piste', false, 'litres'),
  ('GNR 30000', null, 'interne', 'Jaugeage Carburant', 'piste', false, 'litres'),

  -- Gaz
  ('Cartouche Campingaz', '3138520182009', 'catalogue', 'Gaz', 'boutique', false, 'unité'),
  ('Gaz 12,5KG', '555', 'catalogue', 'Gaz', 'piste', false, 'unité'),
  ('Gaz 39KG', null, 'catalogue', 'Gaz', 'piste', false, 'unité'),
  ('Gaz 3KG', null, 'catalogue', 'Gaz', 'piste', false, 'unité'),
  ('Sodastream', '7290002793311', 'catalogue', 'Gaz', 'boutique', false, 'unité'),

  -- Glaçons
  ('Glaçons Vito (1)', null, 'catalogue', 'Glaçons', 'piste', false, 'unité'),

  -- Journaux
  ('FCE Antille Semaine 1,80€', '3760001850369', 'catalogue', 'Journaux', 'boutique', false, 'unité'),
  ('Week End By FA 2€', '3760001850505', 'catalogue', 'Journaux', 'boutique', false, 'unité'),
  ('FCE Antille Week-end 2,80€', '34005', 'catalogue', 'Journaux', 'boutique', false, 'unité'),
  ('FCE Antilles Spécial (édition du moment)', null, 'interne', 'Journaux', 'boutique', false, 'unité'),
  ('Courses Paris Turf', '3760001850314', 'catalogue', 'Journaux', 'boutique', false, 'unité'),
  ('Timbres', null, 'catalogue', 'Journaux', 'boutique', false, 'unité'),
  ('Transcash Solo', '3760137830600', 'catalogue', 'Journaux', 'boutique', false, 'unité'),
  ('Transcash Duo', '3760137830433', 'catalogue', 'Journaux', 'boutique', false, 'unité'),
  ('PCS Gold', '200013962679', 'catalogue', 'Journaux', 'boutique', false, 'unité'),
  ('PCS Black', '200005404111', 'catalogue', 'Journaux', 'boutique', false, 'unité'),
  ('Carte SIM N-GO Digicel', '8959620012553586896', 'catalogue', 'Journaux', 'boutique', false, 'unité'),

  -- Pains / Sandwichs
  ('Sandwich Autres 4,80€', '100', 'catalogue', 'Pains / Sandwichs', 'boutique', false, 'unité'),
  ('Baguette', null, 'catalogue', 'Pains / Sandwichs', 'boutique', false, 'unité'),
  ('Paninis', null, 'catalogue', 'Pains / Sandwichs', 'boutique', false, 'unité'),
  ('Baguette Délices Prod', null, 'catalogue', 'Pains / Sandwichs', 'boutique', false, 'unité'),

  -- Viennoiserie
  ('Pain Choco', null, 'catalogue', 'Viennoiserie', 'boutique', false, 'unité'),
  ('Maxi Pain Choco', null, 'catalogue', 'Viennoiserie', 'boutique', false, 'unité'),
  ('Croissant', null, 'catalogue', 'Viennoiserie', 'boutique', false, 'unité'),
  ('Pomme Cannelle', null, 'catalogue', 'Viennoiserie', 'boutique', false, 'unité'),
  ('Chausson Pomme', null, 'catalogue', 'Viennoiserie', 'boutique', false, 'unité'),
  ('Pain aux Raisins', null, 'catalogue', 'Viennoiserie', 'boutique', false, 'unité'),
  ('Quiche Lorraine', null, 'catalogue', 'Viennoiserie', 'boutique', false, 'unité'),
  ('Carré Pomme', null, 'catalogue', 'Viennoiserie', 'boutique', false, 'unité'),
  ('Feuilleté', null, 'catalogue', 'Viennoiserie', 'boutique', false, 'unité'),
  ('Pâtes vrac SDD', null, 'catalogue', 'Viennoiserie', 'boutique', false, 'unité'),
  ('Biscuits salés SDD', null, 'catalogue', 'Viennoiserie', 'boutique', false, 'unité'),

  -- Cigarettes (sensible)
  ('News R20', '30024854', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('News R25', '30023024', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('News R30', '3258170105811', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Marlboro Gold', '3258170602006', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Marlboro Rouge', '7460836501899', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Peter Rouge', '87217469', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Brooklyn R20', '30022225', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Brooklyn Bleue 20', '30024878', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Maryland R20', '54502420', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Benson', '50219209', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Dunhill KS', '59039297', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Maya', '54501508', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Camel Shift', '033100081811', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Camel Filtre 20', '40329055', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Signature Convertible', '87355468', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Philip Morris King', '87248548', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Winfield 25', '59038245', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Elixyr 100''s', '54500655', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Pool Rouge', '8710151540301', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Cannarettes Haschill', '4235522001327', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Brooklyn R25', '30023055', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Maryland R30', '5400827009418', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Maryland R25', '54500518', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Maryland Bleue 25', '54501270', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('Maryland R40', '5400827026057', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('King Fresh 25', '3800162429209', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('King 100s Fresh', '3800162443977', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('King Red 25', '3800162443885', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),
  ('King 100s Red', '3800162416940', 'catalogue', 'Cigarettes', 'boutique', true, 'paquet'),

  -- Boissons chaudes / Bières
  ('Bière Heineken 25CL', '712000900205', 'catalogue', 'Boissons chaudes / Bières', 'boutique', false, 'unité'),
  ('Bière Heineken 33 CL', '8712000022105', 'catalogue', 'Boissons chaudes / Bières', 'boutique', false, 'unité'),
  ('Bière Heineken 50 CL', '8712000900045', 'catalogue', 'Boissons chaudes / Bières', 'boutique', false, 'unité'),
  ('Bière Heineken 65cl', '8712000010249', 'catalogue', 'Boissons chaudes / Bières', 'boutique', false, 'unité'),
  ('Porter 39 25 CL', '3324070001253', 'catalogue', 'Boissons chaudes / Bières', 'boutique', false, 'unité'),
  ('Desperados 33CL', '3119783007483', 'catalogue', 'Boissons chaudes / Bières', 'boutique', false, 'unité'),
  ('Desperados 50 CL', '223119780266401', 'catalogue', 'Boissons chaudes / Bières', 'boutique', false, 'unité'),
  ('Despe Red 33 CL', '3119780246243', 'catalogue', 'Boissons chaudes / Bières', 'boutique', false, 'unité'),
  ('Despe Red 50CL', '3119780248186', 'catalogue', 'Boissons chaudes / Bières', 'boutique', false, 'unité'),
  ('Bière Lorraine 50 CL', '3330901111008', 'catalogue', 'Boissons chaudes / Bières', 'boutique', false, 'unité'),
  ('Bière Royal 50 CL', '5741000001394', 'catalogue', 'Boissons chaudes / Bières', 'boutique', false, 'unité'),
  ('Bière Buzz Extra Strong', '13762571303408', 'catalogue', 'Boissons chaudes / Bières', 'boutique', false, 'unité'),
  ('Bière 8/6 Blonde 50 CL', '8714800004114', 'catalogue', 'Boissons chaudes / Bières', 'boutique', false, 'unité'),
  ('Jus Fruitybon 50CL', '3760012260140', 'catalogue', 'Boissons chaudes / Bières', 'boutique', false, 'unité'),
  ('Fruitybon Canne 50CL', '3760012260515', 'catalogue', 'Boissons chaudes / Bières', 'boutique', false, 'unité'),
  ('Eau de Coco 50CL', '884394000538', 'catalogue', 'Boissons chaudes / Bières', 'boutique', false, 'unité'),
  ('Coca Cola 50 CL', '229208400004', 'catalogue', 'Boissons chaudes / Bières', 'boutique', false, 'unité'),
  ('St Jude 1,5L', '3760104810116', 'catalogue', 'Boissons chaudes / Bières', 'boutique', false, 'unité'),
  ('Compteur machine à café Lavazza (relevé début/fin)', null, 'interne', 'Boissons chaudes / Bières', 'boutique', false, 'unité compteur'),

  -- Huiles
  ('Helix HX7 10w40 1L', '5011987068964', 'catalogue', 'Huiles', 'piste', false, 'unité'),
  ('Helix HX7 10w40 2L D', '5011987249776', 'catalogue', 'Huiles', 'piste', false, 'unité'),
  ('Helix HX7 10w40 2L E', '5011987074736', 'catalogue', 'Huiles', 'piste', false, 'unité'),
  ('Helix 10w40 5l', '5011987069053', 'catalogue', 'Huiles', 'piste', false, 'unité'),
  ('Helix HX 5 15w40 1L', '5011987236707', 'catalogue', 'Huiles', 'piste', false, 'unité'),
  ('Helix HX 5 15w40 2LD', '5011987237599', 'catalogue', 'Huiles', 'piste', false, 'unité'),
  ('Helix HX 5 15w40 2L E', '5011987237308', 'catalogue', 'Huiles', 'piste', false, 'unité'),
  ('Helix 15w40 5L', '5011987140905', 'catalogue', 'Huiles', 'piste', false, 'unité'),
  ('Helix Ultra 5W40 1L', '5011987035775', 'catalogue', 'Huiles', 'piste', false, 'unité'),
  ('Helix ultra 5w40 5L', '5011987064379', 'catalogue', 'Huiles', 'piste', false, 'unité'),
  ('Helix Ultra ECT 5w30 5L', '5011987117976', 'catalogue', 'Huiles', 'piste', false, 'unité'),
  ('Helix Ultra ECT 5w30 1L', '5011987005600', 'catalogue', 'Huiles', 'piste', false, 'unité'),
  ('Spirax S2 80w-90 1L', '5011987080867', 'catalogue', 'Huiles', 'piste', false, 'unité'),
  ('Spirax S2 ATF 1L (D.A)', '5011987010437', 'catalogue', 'Huiles', 'piste', false, 'unité'),
  ('Advance 4T Ultra 10W40 1 L', '5011987022829', 'catalogue', 'Huiles', 'piste', false, 'unité'),
  ('Advance VSX 2t 1L', '5011987067691', 'catalogue', 'Huiles', 'piste', false, 'unité'),

  -- Lave-glace & Liquide de refroidissement
  ('Lave Glace Bleu 2L', '3273680132157', 'catalogue', 'Lave-glace & Liquide de refroidissement', 'piste', false, 'unité'),
  ('Lave Glace Bleu 5L', '3273480155189', 'catalogue', 'Lave-glace & Liquide de refroidissement', 'piste', false, 'unité'),
  ('Lave Glace Floral 2L', '3273680132775', 'catalogue', 'Lave-glace & Liquide de refroidissement', 'piste', false, 'unité'),
  ('Lave Glace Floral 5L', '3273680135165', 'catalogue', 'Lave-glace & Liquide de refroidissement', 'piste', false, 'unité'),
  ('Liquide Refr Bleu 2L', '3273680132249', 'catalogue', 'Lave-glace & Liquide de refroidissement', 'piste', false, 'unité'),
  ('Liquide Refr Bleu 5L', '3273680132218', 'catalogue', 'Lave-glace & Liquide de refroidissement', 'piste', false, 'unité'),
  ('Liquide Refr Jaune 5L', '3273680132850', 'catalogue', 'Lave-glace & Liquide de refroidissement', 'piste', false, 'unité'),
  ('Liquide Refr Rose 5L', '3273680132843', 'catalogue', 'Lave-glace & Liquide de refroidissement', 'piste', false, 'unité'),
  ('AD BLUE 10L', '7041068131193', 'catalogue', 'Lave-glace & Liquide de refroidissement', 'piste', false, 'unité'),

  -- CBD (sensible)
  ('CBD Amnesia 5G', '3008048700309', 'catalogue', 'CBD', 'boutique', true, 'unité'),
  ('CBD Buyaka Gelato 5G', '3008048702501', 'catalogue', 'CBD', 'boutique', true, 'unité'),
  ('CBD Devil 5G', '3008048700347', 'catalogue', 'CBD', 'boutique', true, 'unité'),
  ('CBD AK47 2G', '100097200016', 'catalogue', 'CBD', 'boutique', true, 'unité'),
  ('CBD Amnesia 2G', '0745178642675', 'catalogue', 'CBD', 'boutique', true, 'unité'),
  ('CBD Gelato 2G', '100097200011', 'catalogue', 'CBD', 'boutique', true, 'unité'),
  ('CBD Super Skunk 2G', '100097200014', 'catalogue', 'CBD', 'boutique', true, 'unité'),
  ('CBD White Widow 2G', '100097200015', 'catalogue', 'CBD', 'boutique', true, 'unité'),
  ('CBD Purple Haze 2G', '100097200012', 'catalogue', 'CBD', 'boutique', true, 'unité'),
  ('CBD Orange Buds 2G', '100097200013', 'catalogue', 'CBD', 'boutique', true, 'unité')
)
insert into inventaire_zone_produit (designation, code_barres, source, categorie_id, zone_id, sensible, unite, ordre_affichage)
select
  src.designation, src.code_barres, src.source,
  cat.id, zon.id, src.sensible, src.unite,
  row_number() over ()
from src
join inventaire_categories cat on cat.nom = src.categorie_nom and cat.site = 'vito-sainte-marie'
join inventaire_zones zon on zon.code = src.zone_code and zon.site = 'vito-sainte-marie';
