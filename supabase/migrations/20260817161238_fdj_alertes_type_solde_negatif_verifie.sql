-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260817161238 · fdj_alertes_type_solde_negatif_verifie
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Migration : fdj_alertes_type_solde_negatif_verifie (17/08/2026)
-- Demande de Frédéric : bouton "Vérifié ☑" sur le panneau "Mouvements FDJ à
-- vérifier" (soldes non-activés négatifs, NEXUS-FDJ-Manager-v1.html::
-- calculerSoldesNegatifs). Ce panneau n'était jusqu'ici jamais acquittable
-- (recalculé en direct depuis les mouvements bruts, jamais une ligne en
-- base) — voir commentaire historique du 09/08/2026 : "cette liste [...]
-- n'est jamais masquée tant que le solde reste négatif", volontairement
-- pour ne jamais cacher un problème réel.
--
-- Ce nouveau type ne remet PAS en cause ce principe : l'acquittement est
-- posé pour une valeur de solde précise (game_id + valeur_saisie = solde
-- constaté au moment du clic). Si le solde négatif évolue ensuite (nouvelle
-- activation, aggravation), la ligne réapparaît automatiquement car
-- l'acquittement ne correspond plus au solde constaté — jamais un silence
-- permanent sur un problème qui continue d'évoluer.
alter table fdj_alertes
  drop constraint if exists fdj_alertes_type_check;
alter table fdj_alertes
  add constraint fdj_alertes_type_check
    check (type in (
      'stock_initial_modifie', 'activation_sans_carnet_confie', 'chaine_interrompue',
      'continuite_stock_a_verifier', 'correction_caisse_demandee', 'solde_negatif_verifie'
    ));
