select 'LEDGER|' || :'scenario' || '|' || json_build_object(
  'reference', json_build_object('creeLe', (select created_at from public.fdj_stock_references where id = '00000000-0000-0000-0000-0000000000d1'),
     'lignes', (select json_object_agg(game_id, json_build_object('bureau', bureau_reel, 'caisse', caisse_reel))
                  from public.fdj_stock_reference_lignes where reference_id = '00000000-0000-0000-0000-0000000000d1')),
  'mouvements', coalesce((select json_agg(json_build_object('game_id', game_id, 'type_mouvement', type_mouvement,
       'quantite', quantite, 'location_source_id', location_source_id, 'location_destination_id', location_destination_id,
       'created_at', created_at, 'effective_at', effective_at, 'source', source, 'employee_id', employee_id,
       'created_by', created_by, 'shift_id', shift_id)) from public.fdj_stock_movements where site = 'site-reco'), '[]'::json)
)::text;
