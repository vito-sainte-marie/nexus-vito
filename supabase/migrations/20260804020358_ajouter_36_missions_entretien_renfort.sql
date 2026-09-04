-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260804020358 · ajouter_36_missions_entretien_renfort
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 33 missions d'entretien renfort (10/7/5/2) + 3 occurrences de "Ronde
-- propreté et consommables" (03/08/2026, demande détaillée de Frédéric).
-- Occurrences distinctes (matinée/après-midi/avant la fermeture) plutôt
-- qu'une seule mission "répétable" : le système ne connaît qu'une seule
-- validation par mission et par jour (voir dejaValidee dans
-- NEXUS-Missions-v1.html) — 3 mission_id distincts est le moyen le plus
-- simple et le plus honnête d'obtenir 3 occurrences réellement
-- indépendantes, sans construire un nouveau mécanisme de suivi
-- d'occurrences. La 3e ("avant la fermeture") est nommée pour être
-- automatiquement reconnue comme prioritaire en fin de service par
-- estMissionDeCloture() (déjà basé sur le mot-clé "fermeture").
with nouvelles_missions(mission_id, titre, pourquoi, famille, priority, estimated_duration_min, proof_required, points, checklist, photo_par_action, disponibilite) as (
  values
  -- 10 points — entretien complet
  ('CHK-099', 'Nettoyage approfondi de la boutique', 'Un sol propre en profondeur limite les risques de glissade et donne une première impression de sérieux.', 'Exploitation', 'haute', 30, true, 10,
    '["Aspirateur ou balayage complet","Lavage à la serpillière","Traitement des zones sales ou collantes","Déplacement puis remise en place du petit mobilier","Contrôle final de la propreté et de la sécurité du sol"]'::jsonb,
    true, 'disponible'),
  ('CHK-100', 'Entretien complet de l''espace café', 'L''espace café est très visible et très fréquenté — son entretien complet évite qu''il ne se dégrade au fil du service.', 'Exploitation', 'haute', 25, true, 10,
    '["Nettoyer la machine à café","Nettoyer le bac d''égouttage","Nettoyer les buses et surfaces accessibles","Nettoyer le meuble et le plan de travail","Vider et nettoyer la poubelle","Nettoyer le sol autour de la machine","Ranger les consommables"]'::jsonb,
    true, 'disponible'),
  ('CHK-101', 'Remise en état complète des sanitaires', 'Des sanitaires propres et bien approvisionnés sont un point de contrôle client sensible.', 'Exploitation', 'haute', 20, true, 10,
    '["Nettoyer la cuvette et l''abattant","Nettoyer le lavabo et la robinetterie","Nettoyer le miroir","Nettoyer le sol","Nettoyer les poignées et points de contact","Vider et nettoyer la poubelle","Vérifier les odeurs et la ventilation","Réapprovisionner les consommables"]'::jsonb,
    true, 'disponible'),
  ('CHK-102', 'Nettoyage approfondi des vitrines froides', 'Des vitrines froides propres à l''intérieur comme à l''extérieur sont une exigence d''hygiène, pas seulement de présentation.', 'Qualité', 'haute', 20, true, 10,
    '["Nettoyer les vitres","Nettoyer les poignées","Nettoyer les clayettes accessibles","Nettoyer les joints","Retirer les emballages ou salissures","Ranger les produits en fin d''intervention"]'::jsonb,
    true, 'disponible'),

  -- 7 points — entretien prioritaire
  ('CHK-103', 'Nettoyer et réapprovisionner la machine à café', 'Une machine à café mal approvisionnée bloque un point de vente très fréquenté.', 'Exploitation', 'haute', 15, true, 7,
    '["Contrôler et compléter le café, le chocolat, le lait, le sucre","Contrôler et compléter les gobelets, couvercles, spatules ou agitateurs et serviettes","Nettoyer la machine et son environnement immédiat"]'::jsonb,
    false, 'disponible'),
  ('CHK-104', 'Nettoyage des vitres d''entrée', 'Des vitres d''entrée propres sont la première chose qu''un client voit en arrivant.', 'Qualité', 'haute', 12, true, 7,
    '["Nettoyer les portes vitrées","Nettoyer les vitres principales","Nettoyer les poignées et traces de doigts","Nettoyer le bas des vitres et les encadrements visibles"]'::jsonb,
    false, 'disponible'),
  ('CHK-105', 'Nettoyage des vitrines et présentoirs', 'Une vitrine propre et bien présentée soutient les ventes sans qu''il soit nécessaire de tout réorganiser.', 'Commerce', 'haute', 15, true, 7,
    '["Nettoyer les surfaces visibles sans désorganiser les produits","Refaire le facing"]'::jsonb,
    false, 'disponible'),
  ('CHK-106', 'Nettoyage complet des WC', 'Un contrôle en cours de journée évite que les sanitaires ne se dégradent entre deux remises en état complètes.', 'Exploitation', 'haute', 12, true, 7,
    '["Contrôler et remettre en état les sanitaires en cours de journée"]'::jsonb,
    false, 'disponible'),
  ('CHK-107', 'Nettoyage ciblé du sol', 'Certaines zones (entrée, caisse, réserve) se salissent plus vite que d''autres et méritent une intervention ciblée.', 'Exploitation', 'normale', 10, true, 7,
    '["Identifier la zone à traiter (entrée, caisse, espace café, rayon, réserve, zone point chaud)","Nettoyer le sol de cette zone"]'::jsonb,
    false, 'disponible'),
  ('CHK-108', 'Contrôle complet des consommables', 'Un consommable manquant découvert trop tard bloque un poste jusqu''au réassort.', 'Exploitation', 'normale', 10, false, 7,
    '["Vérifier les niveaux de l''ensemble des consommables","Réapprovisionner ce qui peut l''être","Signaler les besoins de commande"]'::jsonb,
    false, 'disponible'),

  -- 5 points — entretien régulier
  ('CHK-109', 'Nettoyer la machine à café', 'Un entretien courant évite l''accumulation de saleté sur un équipement très utilisé.', 'Exploitation', 'normale', 8, true, 5,
    '["Nettoyer la façade, le bac, le plan de travail et les zones de contact"]'::jsonb, false, 'disponible'),
  ('CHK-110', 'Réapprovisionner les consommables café', 'L''espace café doit rester opérationnel en continu.', 'Exploitation', 'normale', 6, false, 5,
    '["Compléter les produits nécessaires au fonctionnement de l''espace café"]'::jsonb, false, 'disponible'),
  ('CHK-111', 'Nettoyer les vitrines froides', 'Un entretien courant des portes et poignées limite les traces visibles par les clients.', 'Qualité', 'normale', 8, true, 5,
    '["Nettoyer les portes, poignées et surfaces visibles"]'::jsonb, false, 'disponible'),
  ('CHK-112', 'Nettoyer les vitres et miroirs', 'Les traces sur les vitres et miroirs se voient immédiatement.', 'Qualité', 'normale', 8, true, 5,
    '["Traiter les traces visibles dans la boutique et les sanitaires"]'::jsonb, false, 'disponible'),
  ('CHK-113', 'Balayer la boutique', 'Un sol dégagé des poussières et déchets visibles évite l''effet négligé.', 'Exploitation', 'normale', 6, true, 5,
    '["Retirer poussières, papiers et déchets visibles"]'::jsonb, false, 'disponible'),
  ('CHK-114', 'Passer l''aspirateur', 'Certaines zones nécessitent une aspiration précise que le balayage seul ne couvre pas.', 'Exploitation', 'normale', 8, true, 5,
    '["Aspirer les zones nécessitant une aspiration précise"]'::jsonb, false, 'disponible'),
  ('CHK-115', 'Passer la serpillière', 'Un sol lavé doit rester sécurisé jusqu''à son séchage complet.', 'Exploitation', 'normale', 8, true, 5,
    '["Laver la zone définie","Sécuriser le passage jusqu''au séchage"]'::jsonb, false, 'disponible'),
  ('CHK-116', 'Nettoyer les sanitaires', 'Un contrôle régulier évite que les écarts de propreté ne s''accumulent entre deux remises en état complètes.', 'Exploitation', 'normale', 8, true, 5,
    '["Effectuer le contrôle régulier des sanitaires","Corriger les écarts de propreté constatés"]'::jsonb, false, 'disponible'),
  ('CHK-117', 'Vider et nettoyer les poubelles', 'Une poubelle pleine ou sale se remarque immédiatement et dégage des odeurs.', 'Exploitation', 'normale', 5, true, 5,
    '["Changer les sacs","Nettoyer les contenants si nécessaire"]'::jsonb, false, 'disponible'),
  ('CHK-118', 'Nettoyer l''espace caisse', 'L''espace caisse est vu par chaque client — son entretien ne doit jamais gêner la caissière.', 'Exploitation', 'normale', 6, false, 5,
    '["Nettoyer le comptoir, les surfaces, les présentoirs et les équipements sans gêner la caissière"]'::jsonb, false, 'disponible'),
  ('CHK-119', 'Ranger le matériel d''entretien', 'Un matériel d''entretien mal rangé s''use plus vite et devient difficile à retrouver.', 'Exploitation', 'normale', 5, false, 5,
    '["Nettoyer, sécher et remettre chaque outil à son emplacement"]'::jsonb, false, 'disponible'),

  -- 2 points — interventions rapides
  ('CHK-120', 'Essuyer une salissure immédiatement', 'Une salissure laissée quelques minutes de plus se transforme vite en tache difficile à enlever.', 'Exploitation', 'basse', 2, false, 2,
    '["Essuyer une salissure immédiatement"]'::jsonb, false, 'disponible'),
  ('CHK-121', 'Réapprovisionner le sucre', 'Un sucrier vide bloque un geste simple pour le client.', 'Exploitation', 'basse', 2, false, 2,
    '["Réapprovisionner le sucre"]'::jsonb, false, 'disponible'),
  ('CHK-122', 'Compléter les gobelets', 'Des gobelets manquants arrêtent net le service au point café.', 'Exploitation', 'basse', 2, false, 2,
    '["Compléter les gobelets"]'::jsonb, false, 'disponible'),
  ('CHK-123', 'Ajouter des serviettes', 'Des serviettes disponibles évitent les petits désagréments pour le client.', 'Exploitation', 'basse', 2, false, 2,
    '["Ajouter des serviettes"]'::jsonb, false, 'disponible'),
  ('CHK-124', 'Remettre du savon dans les sanitaires', 'L''absence de savon est immédiatement remarquée par les clients.', 'Exploitation', 'basse', 2, false, 2,
    '["Remettre du savon dans les sanitaires"]'::jsonb, false, 'disponible'),
  ('CHK-125', 'Remplacer un rouleau de papier toilette', 'Un rouleau vide est l''un des signalements les plus fréquents en sanitaires.', 'Exploitation', 'basse', 2, false, 2,
    '["Remplacer un rouleau de papier toilette"]'::jsonb, false, 'disponible'),
  ('CHK-126', 'Nettoyer une poignée de porte', 'Les poignées sont parmi les surfaces les plus touchées de la journée.', 'Qualité', 'basse', 2, false, 2,
    '["Nettoyer une poignée de porte"]'::jsonb, false, 'disponible'),
  ('CHK-127', 'Retirer une trace sur une vitre', 'Une trace isolée se corrige en quelques secondes, autant le faire tout de suite.', 'Qualité', 'basse', 2, false, 2,
    '["Retirer une trace sur une vitre"]'::jsonb, false, 'disponible'),
  ('CHK-128', 'Vider une petite poubelle pleine', 'Une petite poubelle pleine déborde vite si elle n''est pas vidée à temps.', 'Exploitation', 'basse', 2, false, 2,
    '["Vider une petite poubelle pleine"]'::jsonb, false, 'disponible'),
  ('CHK-129', 'Signaler une fuite ou une anomalie sur la machine à café', 'Une fuite non signalée peut immobiliser la machine plus longtemps que nécessaire.', 'Sécurité', 'basse', 2, false, 2,
    '["Signaler une fuite ou une anomalie sur la machine à café"]'::jsonb, false, 'disponible'),
  ('CHK-130', 'Installer un panneau « sol mouillé »', 'Un sol mouillé sans signalisation est un risque de chute immédiat.', 'Sécurité', 'basse', 2, false, 2,
    '["Installer un panneau « sol mouillé »"]'::jsonb, false, 'disponible'),
  ('CHK-131', 'Retirer un carton ou un obstacle dans une zone de circulation', 'Un obstacle dans une zone de passage est un risque de chute ou de blessure.', 'Sécurité', 'basse', 2, false, 2,
    '["Retirer un carton ou un obstacle dans une zone de circulation"]'::jsonb, false, 'disponible'),

  -- Ronde propreté et consommables — 3 occurrences distinctes (7 points chacune)
  ('CHK-132', 'Ronde propreté et consommables (matinée)', 'Une ronde régulière repère les écarts avant qu''un client ne les remarque.', 'Qualité', 'haute', 15, true, 7,
    '["Contrôler l''entrée, la boutique, l''espace café, les vitrines, les sanitaires et les zones de circulation","Nettoyer les écarts visibles","Compléter les consommables","Signaler toute anomalie nécessitant une intervention complémentaire"]'::jsonb,
    false, 'disponible'),
  ('CHK-133', 'Ronde propreté et consommables (après-midi)', 'Une ronde régulière repère les écarts avant qu''un client ne les remarque.', 'Qualité', 'haute', 15, true, 7,
    '["Contrôler l''entrée, la boutique, l''espace café, les vitrines, les sanitaires et les zones de circulation","Nettoyer les écarts visibles","Compléter les consommables","Signaler toute anomalie nécessitant une intervention complémentaire"]'::jsonb,
    false, 'disponible'),
  ('CHK-134', 'Ronde propreté et consommables (avant la fermeture)', 'Une dernière ronde avant la fermeture garantit que la station est transmise dans un état correct au prochain quart.', 'Qualité', 'haute', 15, true, 7,
    '["Contrôler l''entrée, la boutique, l''espace café, les vitrines, les sanitaires et les zones de circulation","Nettoyer les écarts visibles","Compléter les consommables","Signaler toute anomalie nécessitant une intervention complémentaire"]'::jsonb,
    false, 'disponible')
)
insert into mission_catalog (mission_id, titre, pourquoi, famille, role_required, priority, estimated_duration_min, proof_required, points, checklist, photo_par_action, disponibilite, site_id, actif, ponctuelle)
select mission_id, titre, pourquoi, famille, array['renfort'], priority, estimated_duration_min, proof_required, points, checklist, photo_par_action, disponibilite, 'vito-sainte-marie', true, false
from nouvelles_missions
union all
select mission_id || '-fantome-test', titre, pourquoi, famille, array['renfort'], priority, estimated_duration_min, proof_required, points, checklist, photo_par_action, disponibilite, 'site-fantome-test', true, false
from nouvelles_missions;
