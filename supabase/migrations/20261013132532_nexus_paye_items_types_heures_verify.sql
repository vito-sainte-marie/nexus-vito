-- Refonte coordonnée NEXUS Verify / NEXUS Paye — les heures reposent sur Verify.
--
-- Cette migration n'est appliquée nulle part par le présent lot : toute
-- opération sur Supabase Production reste une gate humaine. Elle est déposée
-- pour que le schéma soit reconstructible et relisible avant arbitrage.
--
-- Elle ouvre quatre choses, et rien de plus :
--   1. le renfort déclaré à la clôture Verify a enfin une colonne où vivre ;
--   2. l'horaire exceptionnel saisi par le manager garde sa valeur d'avant
--      autant que sa valeur d'après ;
--   3. une anomalie se marque examinée, corrigée ou justifiée — trois statuts
--      qui n'existaient pas, et sans lesquels « traiter » voulait dire
--      « exclure », donc retirer des heures en silence ;
--   4. l'écart Verify / planning et l'horaire exceptionnel deviennent des
--      type_item à part entière, au lieu d'emprunter celui d'une présence
--      exceptionnelle.
--
-- Aucune donnée n'est supprimée, aucune colonne n'est retirée, aucun statut
-- existant n'est invalidé : les enregistrements déjà écrits restent lisibles
-- et conformes après application.

-- 1. Le renfort déclaré pendant un service, à la clôture de caisse.
--    Même choix que employes_piste / employes_boutique : un jsonb
--    d'identifiants, sans clé étrangère — l'appartenance au site et l'état
--    actif sont vérifiés côté applicatif, à la sélection.
alter table public.audits_caisse
  add column if not exists employes_renfort jsonb;

comment on column public.audits_caisse.employes_renfort is
  'Renforts déclarés à la clôture de ce service (tableau d''employee_id). '
  'Source opérationnelle des heures de renfort : le planning ne les plafonne pas.';

-- 2. Le détail d'une saisie manager : horaires, pause, motif, valeur initiale.
alter table public.nexus_paye_items
  add column if not exists detail jsonb;

comment on column public.nexus_paye_items.detail is
  'Détail d''une saisie manager : debut, fin, pause_minutes, motif, auteur, '
  'heures_initiales. Conserve la valeur avant correction autant que la valeur après.';

-- 3. Les trois statuts de traitement d'une anomalie.
--    « exclu » restait le seul moyen de solder un écart ; or exclure un
--    élément retire ses heures. Marquer examinée une anomalie ne doit rien
--    retirer du tout.
alter table public.nexus_paye_items
  drop constraint if exists nexus_paye_items_statut_check;

alter table public.nexus_paye_items
  add constraint nexus_paye_items_statut_check
  check (statut = any (array[
    'a_verifier','valide','exclu',
    'examine','corrige','justifie'
  ]));

-- 4. Les deux type_item nouveaux, ajoutés à la contrainte existante.
--    La liste est réécrite en entier parce qu'une contrainte CHECK ne
--    s'étend pas : elle se remplace. Les quatorze valeurs antérieures sont
--    toutes reconduites, à l'identique. Ce bloc termine le fichier : le
--    garde-fou des types persistables lit la dernière contrainte déposée.
alter table public.nexus_paye_items
  drop constraint if exists nexus_paye_items_type_item_check;

alter table public.nexus_paye_items
  add constraint nexus_paye_items_type_item_check
  check (type_item = any (array[
    'presence_exceptionnelle','absence_a_verifier','absence_a_qualifier','absence_qualifiee',
    'conge_paye','arret_maladie','retard','retard_incoherent','heure_supplementaire',
    'jour_ferie','acompte','dette','ecart_caisse','autre',
    'ecart_verify_planning','horaire_exceptionnel'
  ]));
