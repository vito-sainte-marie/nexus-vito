-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260828034731 · carburant_commandes_ajout_statuts_confirmee_reception_controlee
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 27/08/2026, refonte qualitative Carburants (point 22, demande de
-- Frédéric) : "Prévoir différents états : Brouillon → Commande préparée
-- → Commande confirmée fournisseur → Livraison attendue → Livraison
-- reçue → Réception contrôlée." Le cycle de vie réel (proposee/validee/
-- reportee/hors_nexus/livree) couvre déjà Brouillon+préparée (proposee),
-- Livraison attendue (validee) et Livraison reçue (livree). Il manque
-- deux étapes intermédiaires réelles :
--  - 'confirmee_fournisseur' : le manager a obtenu confirmation du
--    fournisseur (appel/accusé de réception de commande) après validation
--    interne, avant que la livraison n'arrive.
--  - 'reception_controlee' : la livraison reçue a été contrôlée (rapproché
--    avec le parcours qualité de réception existant, carburant_reception_visites)
--    — distinct de la simple réception physique, jamais confondu avec elle
--    (demande explicite de Frédéric : "une livraison ne doit entrer dans
--    les stocks qu'après réception réelle ou validation du flux source" —
--    déjà respecté par carburant_releves, ceci ajoute la traçabilité du
--    CONTRÔLE qualité sur la commande elle-même).
alter table public.carburant_commandes drop constraint carburant_commandes_statut_check;
alter table public.carburant_commandes add constraint carburant_commandes_statut_check
  check (statut = any (array['proposee'::text, 'validee'::text, 'confirmee_fournisseur'::text, 'modifiee'::text, 'reportee'::text, 'hors_nexus'::text, 'annulee'::text, 'livree'::text, 'reception_controlee'::text]));

-- Traçabilité des deux nouvelles transitions (mêmes conventions que
-- valide_par/valide_le déjà existants sur cette table).
alter table public.carburant_commandes add column if not exists confirmee_fournisseur_par uuid references employees(id);
alter table public.carburant_commandes add column if not exists confirmee_fournisseur_le timestamptz;
alter table public.carburant_commandes add column if not exists reference_fournisseur text;
alter table public.carburant_commandes add column if not exists reception_controlee_par uuid references employees(id);
alter table public.carburant_commandes add column if not exists reception_controlee_le timestamptz;
alter table public.carburant_commandes add column if not exists reception_controle_verdict text;
alter table public.carburant_commandes add constraint carburant_commandes_reception_controle_verdict_check
  check (reception_controle_verdict is null or reception_controle_verdict = any (array['conforme'::text, 'ecart_mineur'::text, 'anomalie'::text]));
