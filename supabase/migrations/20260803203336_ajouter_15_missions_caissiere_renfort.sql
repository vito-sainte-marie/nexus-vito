-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803203336 · ajouter_15_missions_caissiere_renfort
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


-- Demande de Frédéric (03/08/2026) : 15 nouvelles missions pour les rôles
-- caissière et renfort. Points fournis par Frédéric pour chacune ; famille,
-- priorité, durée estimée et preuve requise choisies par mes soins là où il
-- ne précisait pas (repris de conventions déjà en place ailleurs dans le
-- catalogue : facing/réassort → Commerce avec preuve photo, contrôles
-- dates/prix → Qualité, tâches liées au poste de caisse lui-même →
-- Management comme "Drop de caisse", petit nettoyage/rangement →
-- Exploitation). CHK-031 à CHK-045, suite numérique de CHK-030.
insert into mission_catalog (
  mission_id, titre, pourquoi, famille, role_required, site, priority,
  estimated_duration_min, proof_required, validation_type, points, checklist,
  actif, site_id, necessite_produit, ponctuelle, photo_par_action
) values

('CHK-031', 'Impression jackpots et grilles paris sportifs',
 'Le service jeux/paris sportifs doit être prêt et à jour pour les clients dès l''ouverture.',
 'Commerce', ARRAY['caissiere','renfort'], 'vito-sainte-marie', 'haute', 5, false, 'checklist', 10,
 '["Imprimer les grilles de paris sportifs du jour", "Imprimer les tickets/jackpots requis", "Vérifier que les grilles sont lisibles et complètes", "Disposer les grilles à l''emplacement prévu"]'::jsonb,
 true, 'vito-sainte-marie', false, false, false),

('CHK-032', 'Réassort confiseries et chewing-gums (rayon caisse)',
 'Un rayon caisse bien tenu pousse la vente d''impulsion et évite les produits abîmés en vitrine. Peut se faire à deux : les 7 points sont alors partagés entre les deux collègues, pas doublés.',
 'Commerce', ARRAY['caissiere','renfort'], 'vito-sainte-marie', 'normale', 10, true, 'photo', 7,
 '["Contrôler le rayon confiseries / chewing-gums", "Recharger selon l''implantation prévue", "Assurer un facing complet", "Retirer les produits abîmés ou périmés"]'::jsonb,
 true, 'vito-sainte-marie', false, false, false),

('CHK-033', 'Compléter les vitrines',
 'Une vitrine complète et bien présentée selon les priorités de vente maximise le taux de transformation.',
 'Commerce', ARRAY['caissiere','renfort'], 'vito-sainte-marie', 'normale', 10, true, 'photo', 7,
 '["Identifier les priorités de vente du jour", "Compléter les vitrines", "Assurer un facing propre"]'::jsonb,
 true, 'vito-sainte-marie', false, false, false),

('CHK-034', 'Contrôle des dates courtes',
 'Isoler les produits proches de la date limite évite la casse et protège le client.',
 'Qualité', ARRAY['caissiere','renfort'], 'vito-sainte-marie', 'haute', 8, true, 'photo', 10,
 '["Identifier les produits proches de la date limite", "Isoler les produits concernés", "Signaler la liste au manager"]'::jsonb,
 true, 'vito-sainte-marie', false, false, false),

('CHK-035', 'Réassort viennoiseries et point chaud',
 'Une offre point chaud complète et propre tout au long du service évite les ventes manquées.',
 'Commerce', ARRAY['caissiere','renfort'], 'vito-sainte-marie', 'normale', 8, true, 'photo', 5,
 '["Compléter l''offre viennoiserie / point chaud", "Maintenir une présentation propre", "Signaler les ruptures ou invendus au manager"]'::jsonb,
 true, 'vito-sainte-marie', false, false, false),

('CHK-036', 'Contrôle visuel des prix',
 'Un écart entre le prix affiché et le prix en caisse expose à un litige client.',
 'Qualité', ARRAY['caissiere','renfort'], 'vito-sainte-marie', 'normale', 8, false, 'checklist', 5,
 '["Choisir un rayon ou une sélection de produits", "Vérifier que l''affichage correspond au prix en caisse", "Signaler tout écart au manager"]'::jsonb,
 true, 'vito-sainte-marie', false, false, false),

('CHK-037', 'Réassort consommables de caisse',
 'Une caisse sans rouleau TPE ou sans sac en plein service bloque immédiatement l''encaissement.',
 'Management', ARRAY['caissiere','renfort'], 'vito-sainte-marie', 'normale', 5, false, 'checklist', 5,
 '["Contrôler les rouleaux TPE", "Contrôler les rouleaux de caisse", "Contrôler sacs, feuilles, stylos et fournitures", "Réapprovisionner ce qui manque"]'::jsonb,
 true, 'vito-sainte-marie', false, false, false),

('CHK-038', 'Nettoyage et organisation de la caisse',
 'Un poste de caisse propre et rangé, c''est aussi l''image professionnelle du commerce vue par chaque client.',
 'Management', ARRAY['caissiere','renfort'], 'vito-sainte-marie', 'normale', 10, false, 'checklist', 7,
 '["Nettoyer le poste de caisse", "Ranger les documents", "Vérifier les consommables", "Maintenir un environnement professionnel"]'::jsonb,
 true, 'vito-sainte-marie', false, false, false),

('CHK-039', 'Signaler une rupture',
 'Une rupture réelle non signalée devient une vente perdue jusqu''au prochain inventaire.',
 'Commerce', ARRAY['caissiere','renfort'], 'vito-sainte-marie', 'basse', 2, false, 'checklist', 2,
 '["Confirmer que la rupture est réelle (pas un simple réassort à faire)", "Transmettre la référence concernée au manager"]'::jsonb,
 true, 'vito-sainte-marie', true, false, false),

('CHK-040', 'Nettoyer un petit espace',
 'Présentoir de caisse, terminal de paiement, comptoir ou zone client — un geste rapide, toujours utile.',
 'Exploitation', ARRAY['caissiere','renfort'], 'vito-sainte-marie', 'basse', 5, false, 'checklist', 2,
 '["Choisir un espace : présentoir de caisse, terminal de paiement, comptoir ou zone client", "Nettoyer l''espace choisi"]'::jsonb,
 true, 'vito-sainte-marie', false, false, false),

('CHK-041', 'Facing Caresses Antillaises 1L',
 'Un facing complet sur ce format met en avant le produit et facilite le réassort visuel.',
 'Commerce', ARRAY['caissiere','renfort'], 'vito-sainte-marie', 'normale', 6, true, 'photo', 5,
 '["Contrôler le rayon Caresses Antillaises 1L", "Assurer un facing complet", "Retirer les produits abîmés"]'::jsonb,
 true, 'vito-sainte-marie', false, false, false),

('CHK-042', 'Facing Fruitybons',
 'Un facing complet sur ce produit met en avant l''offre et facilite le réassort visuel.',
 'Commerce', ARRAY['caissiere','renfort'], 'vito-sainte-marie', 'normale', 6, true, 'photo', 5,
 '["Contrôler le rayon Fruitybons", "Assurer un facing complet", "Retirer les produits abîmés"]'::jsonb,
 true, 'vito-sainte-marie', false, false, false),

('CHK-043', 'Facing Yop''s',
 'Un rayon Yop''s bien facé reste attractif toute la journée.',
 'Commerce', ARRAY['caissiere','renfort'], 'vito-sainte-marie', 'basse', 4, false, 'checklist', 2,
 '["Contrôler le rayon Yop''s", "Assurer un facing complet"]'::jsonb,
 true, 'vito-sainte-marie', false, false, false),

('CHK-044', 'Facing Caresse 50cl',
 'Un facing complet sur ce format met en avant le produit et facilite le réassort visuel.',
 'Commerce', ARRAY['caissiere','renfort'], 'vito-sainte-marie', 'haute', 8, true, 'photo', 10,
 '["Contrôler le rayon Caresse 50cl", "Assurer un facing complet", "Retirer les produits abîmés ou périmés"]'::jsonb,
 true, 'vito-sainte-marie', false, false, false),

('CHK-045', 'Remplissage rayon chips et facing',
 'Un rayon chips complet et bien facé évite les ventes manquées sur un produit à forte rotation.',
 'Commerce', ARRAY['caissiere','renfort'], 'vito-sainte-marie', 'normale', 8, true, 'photo', 5,
 '["Réapprovisionner le rayon chips", "Assurer un facing complet", "Retirer les produits abîmés ou périmés"]'::jsonb,
 true, 'vito-sainte-marie', false, false, false);

-- Clone sur le site fantôme isolé (même logique que les migrations
-- précédentes : mission_id suffixé, jamais de collision de clé primaire).
insert into mission_catalog (
  mission_id, titre, pourquoi, famille, role_required, site, priority,
  estimated_duration_min, proof_required, validation_type, points, checklist,
  actif, site_id, necessite_produit, ponctuelle, photo_par_action
)
select
  mission_id || '-fantome-test', titre, pourquoi, famille, role_required,
  'site-fantome-test', priority, estimated_duration_min, proof_required,
  validation_type, points, checklist, actif, 'site-fantome-test',
  necessite_produit, ponctuelle, photo_par_action
from mission_catalog
where mission_id in ('CHK-031','CHK-032','CHK-033','CHK-034','CHK-035','CHK-036','CHK-037','CHK-038','CHK-039','CHK-040','CHK-041','CHK-042','CHK-043','CHK-044','CHK-045');
