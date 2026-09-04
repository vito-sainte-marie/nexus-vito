-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260804013823 · remplacer_missions_renfort_par_35_missions_dediees
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 1) Retirer 'renfort' de toutes les missions partagées (03/08/2026, demande
--    de Frédéric : liste complète et dédiée pour le renfort, qui remplace
--    l'ancien rattachement générique à des missions caissière/pompiste/etc.)
update mission_catalog
set role_required = array_remove(role_required, 'renfort')
where site_id in ('vito-sainte-marie', 'site-fantome-test')
  and 'renfort' = any(role_required);

-- 2) Désactiver les 5 anciennes missions génériques "Renfort — ..." : elles
--    sont remplacées par les 35 missions détaillées ci-dessous et
--    deviendraient orphelines (role_required vide) après l'étape 1.
update mission_catalog
set actif = false
where site_id in ('vito-sainte-marie', 'site-fantome-test')
  and (mission_id like 'CHK-026%' or mission_id like 'CHK-027%' or mission_id like 'CHK-028%' or mission_id like 'CHK-029%' or mission_id like 'CHK-030%');

-- 3) Les 35 nouvelles missions renfort (barème 10/7/5/2, demande détaillée de
--    Frédéric du 03/08/2026). Clonées automatiquement sur le site fantôme de
--    test (suffixe -fantome-test), comme pour toutes les évolutions du
--    catalogue depuis la mise en place du compte fantôme isolé.
with nouvelles_missions(mission_id, titre, pourquoi, famille, priority, estimated_duration_min, proof_required, points, checklist, photo_par_action, disponibilite) as (
  values
  -- 10 points — missions majeures
  ('CHK-064', 'Réception complète d''une livraison', 'Une réception bien contrôlée évite les écarts de stock et les litiges avec le fournisseur.', 'Exploitation', 'haute', 30, true, 10,
    '["Contrôler les quantités livrées par rapport au bon de commande","Signaler les écarts constatés","Vérifier l''état des marchandises (casse, DLC, conditionnement)","Organiser le rangement des produits reçus","Transmettre un compte rendu exploitable au manager"]'::jsonb,
    true, 'conditionnelle'),
  ('CHK-065', 'Fluidification d''une période d''affluence', 'Une affluence mal gérée dégrade l''expérience client et ralentit tout le service.', 'Management', 'haute', 20, false, 10,
    '["Identifier la zone saturée","Soutenir le poste concerné","Orienter les clients","Contribuer au retour à un fonctionnement normal"]'::jsonb,
    false, 'conditionnelle'),
  ('CHK-066', 'Inventaire tournant validé avec le manager', 'Un inventaire tournant régulier permet de détecter les écarts avant qu''ils ne s''accumulent.', 'Qualité', 'haute', 25, true, 10,
    '["Compter la catégorie définie par le manager","Relever les anomalies constatées","Vérifier les références sensibles","Transmettre un résultat complet au manager"]'::jsonb,
    false, 'disponible'),
  ('CHK-067', 'Mise en sécurité d''une situation à risque', 'Une situation à risque non maîtrisée peut mettre en danger clients et collègues.', 'Sécurité', 'critique', 10, true, 10,
    '["Identifier la situation dangereuse","Sécuriser la zone concernée","Appliquer la procédure prévue"]'::jsonb,
    false, 'conditionnelle'),
  ('CHK-068', 'Réorganisation complète d''un rayon prioritaire', 'Un rayon bien tenu soutient les ventes et l''image du magasin.', 'Commerce', 'haute', 25, true, 10,
    '["Réassort du rayon","Facing des produits","Contrôle des prix","Contrôle des dates","Contrôle de la propreté","Signalement des ruptures"]'::jsonb,
    true, 'disponible'),
  ('CHK-069', 'Préparation opérationnelle avant un temps fort', 'Anticiper un temps fort évite d''être pris de court une fois qu''il démarre.', 'Exploitation', 'haute', 20, true, 10,
    '["Identifier le temps fort à venir (livraison, affluence, campagne)","Préparer les zones sensibles concernées","Vérifier que tout est prêt avant le début"]'::jsonb,
    false, 'conditionnelle'),

  -- 7 points — prioritaires
  ('CHK-070', 'Réassort complet des vitrines froides', 'Des vitrines froides bien remplies limitent les ruptures sur les boissons les plus demandées.', 'Commerce', 'haute', 12, true, 7,
    '["Compléter les boissons prioritaires","Respecter l''implantation prévue","Signaler les ruptures constatées"]'::jsonb,
    false, 'disponible'),
  ('CHK-071', 'Réassort et facing d''un rayon', 'Un rayon fourni et bien présenté encourage l''achat et limite les ruptures visibles.', 'Commerce', 'haute', 12, true, 7,
    '["Réassort du rayon (confiserie, boissons, épicerie, hygiène, automobile ou autre catégorie définie)","Facing des produits"]'::jsonb,
    false, 'disponible'),
  ('CHK-072', 'Contrôle d''une rupture signalée', 'Une rupture signalée doit être vérifiée avant d''être confirmée au manager.', 'Commerce', 'haute', 8, false, 7,
    '["Vérifier le stock réel en rayon","Rechercher en réserve","Confirmer ou infirmer la rupture au manager"]'::jsonb,
    false, 'conditionnelle'),
  ('CHK-073', 'Soutien immédiat à la caisse', 'Un coup de main ponctuel en caisse évite qu''une file d''attente ne se forme.', 'Management', 'haute', 10, false, 7,
    '["Aider à orienter les clients","Préparer les articles si besoin","Récupérer un produit manquant","Fluidifier la file sans se substituer à la responsabilité de la caissière"]'::jsonb,
    false, 'conditionnelle'),
  ('CHK-074', 'Soutien immédiat à la piste', 'Un soutien ponctuel sur la piste sécurise les déplacements et fluidifie la distribution.', 'Sécurité', 'haute', 10, false, 7,
    '["Orienter les véhicules et les clients","Soutenir le pompiste","Sécuriser les déplacements"]'::jsonb,
    false, 'conditionnelle'),
  ('CHK-075', 'Contrôle des zones clients', 'Des zones clients propres, accessibles et sûres renforcent la confiance dans la station.', 'Qualité', 'haute', 10, true, 7,
    '["Vérifier la circulation","Vérifier la propreté","Vérifier l''accessibilité","Vérifier l''affichage","Vérifier la sécurité"]'::jsonb,
    false, 'disponible'),
  ('CHK-076', 'Mise en place d''une campagne commerciale', 'Une campagne bien installée maximise sa visibilité et son impact sur les ventes.', 'Commerce', 'haute', 20, true, 7,
    '["Installer les produits de la campagne","Installer les supports","Vérifier les prix affichés","Prendre une photo preuve de l''installation"]'::jsonb,
    false, 'conditionnelle'),
  ('CHK-077', 'Contrôle ciblé des produits sensibles', 'Les produits à forte valeur ou réglementés nécessitent une vigilance particulière.', 'Sécurité', 'haute', 10, false, 7,
    '["Vérifier les stocks des produits sensibles (cigarettes, CBD, gaz, huiles, cartes, alcool)","Signaler toute anomalie constatée"]'::jsonb,
    false, 'disponible'),
  ('CHK-078', 'Vérification réception fournisseur', 'Comparer la livraison, le document et le rangement évite les écarts non détectés.', 'Exploitation', 'haute', 10, false, 7,
    '["Comparer la livraison au document fournisseur","Vérifier le rangement après réception"]'::jsonb,
    false, 'conditionnelle'),

  -- 5 points — régulières
  ('CHK-079', 'Compléter un rayon en tension', 'Un rayon en tension doit être réapprovisionné rapidement pour éviter la rupture.', 'Commerce', 'normale', 8, true, 5,
    '["Réapprovisionner rapidement la sélection de références prioritaires"]'::jsonb,
    false, 'disponible'),
  ('CHK-080', 'Réaliser le facing d''une zone', 'Un facing soigné rend les produits plus visibles et donne une meilleure image du rayon.', 'Commerce', 'normale', 8, true, 5,
    '["Avancer les produits","Aligner les produits","Rendre les produits visibles"]'::jsonb,
    false, 'disponible'),
  ('CHK-081', 'Contrôler les dates d''un rayon', 'Repérer les dates courtes évite de vendre un produit expiré et limite la perte.', 'Qualité', 'normale', 8, false, 5,
    '["Identifier les dates courtes","Isoler les produits concernés","Transmettre l''information au manager"]'::jsonb,
    false, 'disponible'),
  ('CHK-082', 'Ranger une livraison en réserve', 'Un rangement respectant la rotation évite les pertes et facilite les réassorts futurs.', 'Exploitation', 'normale', 10, true, 5,
    '["Classer les marchandises en respectant les emplacements prévus","Respecter la rotation des stocks (FIFO)"]'::jsonb,
    false, 'disponible'),
  ('CHK-083', 'Accompagner un client', 'Un client bien orienté repart satisfait et gagne du temps.', 'Qualité', 'normale', 5, false, 5,
    '["Aider le client à trouver un produit, un service ou le bon interlocuteur"]'::jsonb,
    false, 'disponible'),
  ('CHK-084', 'Vérifier la propreté d''une zone', 'Une zone propre, quelle qu''elle soit, renvoie une image de sérieux à chaque client.', 'Exploitation', 'normale', 8, true, 5,
    '["Vérifier la propreté de la zone concernée (entrée, boutique, sanitaires, piste, réserve ou espace café)"]'::jsonb,
    false, 'disponible'),
  ('CHK-085', 'Réapprovisionner les consommables', 'Des consommables toujours disponibles évitent les blocages en caisse ou au point chaud.', 'Exploitation', 'normale', 6, false, 5,
    '["Réapprovisionner les sacs, rouleaux, serviettes, gobelets, couvercles, sucre ou autres consommables opérationnels"]'::jsonb,
    false, 'disponible'),
  ('CHK-086', 'Contrôler l''affichage des prix', 'Un prix affiché incohérent avec le produit ou la promotion peut créer un litige en caisse.', 'Qualité', 'normale', 6, false, 5,
    '["Vérifier la cohérence entre le produit, l''étiquette et la promotion en cours"]'::jsonb,
    false, 'disponible'),
  ('CHK-087', 'Aider à la préparation du point chaud', 'Le point chaud a besoin d''un appui régulier pour rester approvisionné et propre.', 'Commerce', 'normale', 8, true, 5,
    '["Aider à la préparation selon la mission attribuée","Mise en vitrine, réassort ou nettoyage selon le besoin"]'::jsonb,
    false, 'disponible'),
  ('CHK-088', 'Soutenir une clôture de quart', 'Une clôture bien préparée en amont facilite la transmission au quart suivant.', 'Management', 'normale', 10, false, 5,
    '["Aider au rangement","Aider à la transmission","Effectuer les contrôles non liés directement à la manipulation de la caisse"]'::jsonb,
    false, 'disponible'),

  -- 2 points — actions rapides
  ('CHK-089', 'Signaler une rupture réelle', 'Une rupture réelle signalée tout de suite évite une vente perdue.', 'Commerce', 'basse', 2, false, 2,
    '["Signaler une rupture réelle"]'::jsonb, false, 'disponible'),
  ('CHK-090', 'Retirer un produit abîmé', 'Un produit abîmé laissé en rayon nuit à l''image et à la sécurité alimentaire.', 'Qualité', 'basse', 2, false, 2,
    '["Retirer un produit abîmé"]'::jsonb, false, 'disponible'),
  ('CHK-091', 'Orienter un client vers le bon service', 'Bien orienter un client lui fait gagner du temps.', 'Qualité', 'basse', 2, false, 2,
    '["Orienter un client vers le bon service"]'::jsonb, false, 'disponible'),
  ('CHK-092', 'Remettre un affichage ou un prix en place', 'Un affichage remis en place tout de suite évite toute confusion en caisse.', 'Qualité', 'basse', 2, false, 2,
    '["Remettre un affichage ou un prix en place"]'::jsonb, false, 'disponible'),
  ('CHK-093', 'Réapprovisionner un consommable', 'Un consommable manquant peut bloquer un poste en quelques minutes.', 'Exploitation', 'basse', 2, false, 2,
    '["Réapprovisionner un consommable"]'::jsonb, false, 'disponible'),
  ('CHK-094', 'Nettoyer une petite zone ciblée', 'Une petite zone négligée se voit vite pour un client.', 'Exploitation', 'basse', 3, false, 2,
    '["Nettoyer une petite zone ciblée"]'::jsonb, false, 'disponible'),
  ('CHK-095', 'Signaler un risque de sécurité', 'Un risque signalé tout de suite peut être traité avant de devenir un incident.', 'Sécurité', 'basse', 2, false, 2,
    '["Signaler un risque de sécurité"]'::jsonb, false, 'disponible'),
  ('CHK-096', 'Ranger un carton ou un matériel gênant', 'Un carton qui traîne gêne la circulation et peut être dangereux.', 'Exploitation', 'basse', 2, false, 2,
    '["Ranger un carton ou un matériel gênant"]'::jsonb, false, 'disponible'),
  ('CHK-097', 'Vérifier une référence demandée par le manager', 'Une référence vérifiée rapidement fait gagner du temps au manager.', 'Management', 'basse', 2, false, 2,
    '["Vérifier une référence demandée par le manager"]'::jsonb, false, 'disponible'),
  ('CHK-098', 'Aider ponctuellement un collègue', 'Un coup de main ponctuel à un collègue maintient la fluidité du service.', 'Management', 'basse', 3, false, 2,
    '["Aider ponctuellement un collègue"]'::jsonb, false, 'disponible')
)
insert into mission_catalog (mission_id, titre, pourquoi, famille, role_required, priority, estimated_duration_min, proof_required, points, checklist, photo_par_action, disponibilite, site_id, actif, ponctuelle)
select mission_id, titre, pourquoi, famille, array['renfort'], priority, estimated_duration_min, proof_required, points, checklist, photo_par_action, disponibilite, 'vito-sainte-marie', true, false
from nouvelles_missions
union all
select mission_id || '-fantome-test', titre, pourquoi, famille, array['renfort'], priority, estimated_duration_min, proof_required, points, checklist, photo_par_action, disponibilite, 'site-fantome-test', true, false
from nouvelles_missions;
