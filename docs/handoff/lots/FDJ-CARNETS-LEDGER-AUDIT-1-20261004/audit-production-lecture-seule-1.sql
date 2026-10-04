-- NEXUS FDJ — audit carnets/mouvements, lecture seule stricte (issue #28,
-- 04/10/2026). Trois requêtes SELECT, à exécuter par l'Orchestrator (ce
-- canal GitHub Issue n'a aucun identifiant ni accès réseau Supabase
-- Production, confirmé une nouvelle fois dans ce lot). Aucune écriture,
-- aucune réparation : seulement mesurer, pour que la suite se décide sur
-- des faits et pas une hypothèse.
--
-- Mesurent toutes les deux une EXPOSITION HISTORIQUE, pas un risque courant :
-- le bug de réconciliation (A) est corrigé dans ce lot (moteur, testé,
-- mutation confirmée) et le gap d'idempotence (B) est fermé dans ce même
-- lot (les 6 écritures manager hors quart appellent désormais
-- fdj_enregistrer_mouvement_stock, migration 20260916221000, avec un jeton
-- stable). Les deux résultats mesurent donc l'héritage AVANT ce lot, pas une
-- vulnérabilité qui resterait ouverte une fois le code déployé.

-- ============================================================================
-- A. Le bug corrigé dans ce lot a-t-il déjà écrit en Production ?
--    Tout mouvement 'correction' est un candidat : avant ce lot, aucun
--    autre type de 'correction' n'existe dans le code qui écrit vraiment
--    (voir request-1.md §3). Un résultat vide signifie que la fonctionnalité
--    « annuler une activation reconstituée » n'a jamais été utilisée en
--    Production — la correction du moteur reste alors préventive, pas
--    réparatrice.
-- ============================================================================
select site, game_id, methode_identification, count(*) as nb_mouvements,
       sum(quantite) as somme_quantite, min(created_at) as premier, max(created_at) as dernier
from public.fdj_stock_movements
where type_mouvement = 'correction'
group by site, game_id, methode_identification
order by site, game_id;

-- ============================================================================
-- B. Candidats de double-écriture par rejeu réseau, sur les six gestes
--    manager qui n'envoyaient AVANT ce lot aucune idempotency_key
--    (réception, réapprovisionnement, retrait caisse, blocage, retour
--    depuis bloqué, rapprochement — voir request-1.md §4). Deux lignes
--    strictement identiques (site, jeu, type, quantité, mêmes
--    emplacements) à moins de 10 secondes d'écart, sans clé, sont un signal
--    fort de double-tap ou de retry réseau ayant doublé un mouvement — pas
--    une certitude (deux réceptions identiques et rapprochées restent
--    possibles en usage normal), mais une liste à relire une par une, pas
--    une absence de preuve.
-- ============================================================================
select a.id as mouvement_1, b.id as mouvement_2, a.site, a.game_id, a.type_mouvement,
       a.quantite, a.created_at as cree_1, b.created_at as cree_2,
       (b.created_at - a.created_at) as ecart
from public.fdj_stock_movements a
join public.fdj_stock_movements b
  on a.site = b.site
 and a.game_id = b.game_id
 and a.type_mouvement = b.type_mouvement
 and a.quantite = b.quantite
 and coalesce(a.location_source_id::text, '') = coalesce(b.location_source_id::text, '')
 and coalesce(a.location_destination_id::text, '') = coalesce(b.location_destination_id::text, '')
 and a.id < b.id
 and a.idempotency_key is null
 and b.idempotency_key is null
 and b.created_at - a.created_at < interval '10 seconds'
where a.type_mouvement in ('reception', 'transfert', 'retour', 'blocage')
order by a.site, a.created_at;

-- ============================================================================
-- C. Export chronologique brut de chaque jeu ayant au moins un mouvement
--    'correction' — à rejouer tel quel contre NexusFdjMoteur.soldesCarnetsAvecReference
--    (nexus-fdj-moteur.js, corrigé dans ce lot) pour mesurer l'écart EXACT,
--    avant/après correctif, sur les données réelles plutôt que sur un
--    scénario synthétique. Lecture seule : cette requête ne modifie rien,
--    elle fournit la matière à un calcul fait en dehors de la base.
-- ============================================================================
select site, game_id, type_mouvement, methode_identification, quantite,
       location_source_id, location_destination_id, shift_id, created_at
from public.fdj_stock_movements
where game_id in (
  select distinct game_id from public.fdj_stock_movements where type_mouvement = 'correction'
)
order by site, game_id, created_at;
