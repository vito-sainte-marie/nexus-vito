-- Scénarios : chaque bloc part de fixtures neuves et se termine par rollback.
-- Étiquettes en majuscules sans chiffre (lues par executer.sh).
-- Une validation par l'écran change valide_le_piste : dans une transaction
-- now() est figé, d'où clock_timestamp() pour la simuler.
\set ON_ERROR_STOP 0

-- Un résultat modifié après validation exige une nouvelle validation, que
-- la modification porte sur l'écart retenu ou sur l'écart calculé ; rien
-- d'autre n'est réécrit.
begin; \i fixtures.sql
do $$ declare v timestamptz; begin
  select valide_le_piste into v from public.audits_caisse where id = 'ad000000-0000-0000-0000-000000000001';
  update public.audits_caisse set ecart_piste_valide = -5 where id = 'ad000000-0000-0000-0000-000000000001';
  perform pg_temp.ok((select revalidation_requise_piste_le is not null and revalidation_requise_boutique_le is null
                        and valide_le_piste = v and ecart_piste_valide = -5
                        from public.audits_caisse where id = 'ad000000-0000-0000-0000-000000000001'), 'écart retenu modifié : drapeau posé, validation intacte');
  update public.audits_caisse set ecart_piste = -14 where id = 'ad000000-0000-0000-0000-000000000003';
  perform pg_temp.ok((select revalidation_requise_piste_le is not null from public.audits_caisse
                       where id = 'ad000000-0000-0000-0000-000000000003'), 'écart calculé modifié : drapeau posé');
  raise notice 'OK DRAPEAU';
end $$;
rollback;

-- Le chemin réel de Verify : upsert sur (site, date, quart), qui passe par
-- le déclencheur en INSERT puis en UPDATE, et renvoie toutes les colonnes,
-- y compris un drapeau vide.
begin; \i fixtures.sql
do $$ declare v timestamptz; begin
  select valide_le_piste into v from public.audits_caisse where id = 'ad000000-0000-0000-0000-000000000001';
  insert into public.audits_caisse as a (site, date, quart, ecart_piste, ecart_piste_valide, valide_le_piste, revalidation_requise_piste_le)
  select site, date, quart, -20, -20, valide_le_piste, null from public.audits_caisse where id = 'ad000000-0000-0000-0000-000000000001'
  on conflict (site, date, quart) do update set ecart_piste = excluded.ecart_piste, ecart_piste_valide = excluded.ecart_piste_valide,
    valide_le_piste = excluded.valide_le_piste, revalidation_requise_piste_le = excluded.revalidation_requise_piste_le;
  perform pg_temp.ok((select revalidation_requise_piste_le is null from public.audits_caisse
                       where id = 'ad000000-0000-0000-0000-000000000001'), 'upsert au même résultat : aucun drapeau');
  insert into public.audits_caisse as a (site, date, quart, ecart_piste, ecart_piste_valide, valide_le_piste, revalidation_requise_piste_le)
  select site, date, quart, -8, -8, valide_le_piste, null from public.audits_caisse where id = 'ad000000-0000-0000-0000-000000000001'
  on conflict (site, date, quart) do update set ecart_piste = excluded.ecart_piste, ecart_piste_valide = excluded.ecart_piste_valide,
    valide_le_piste = excluded.valide_le_piste, revalidation_requise_piste_le = excluded.revalidation_requise_piste_le;
  perform pg_temp.ok((select revalidation_requise_piste_le is not null and valide_le_piste = v and ecart_piste_valide = -8
                        from public.audits_caisse where id = 'ad000000-0000-0000-0000-000000000001'), 'upsert au résultat changé : drapeau posé malgré la valeur vide envoyée');
  raise notice 'OK UPSERT';
end $$;
rollback;

-- Une modification qui laisse le résultat au centime près n'exige rien.
begin; \i fixtures.sql
do $$ begin
  update public.audits_caisse set ecart_piste_valide = -20.001, ecart_piste = -19.996, employes_piste = employes_piste
   where id = 'ad000000-0000-0000-0000-000000000001';
  perform pg_temp.ok((select revalidation_requise_piste_le is null from public.audits_caisse
                       where id = 'ad000000-0000-0000-0000-000000000001'), 'même résultat au centime : aucun drapeau');
  raise notice 'OK SANSCHANGEMENT';
end $$;
rollback;

-- Une caisse jamais validée n'a rien à revalider.
begin; \i fixtures.sql
do $$ begin
  update public.audits_caisse set ecart_piste = -3 where id = 'ad000000-0000-0000-0000-000000000002';
  perform pg_temp.ok((select revalidation_requise_piste_le is null from public.audits_caisse
                       where id = 'ad000000-0000-0000-0000-000000000002'), 'non validée : aucun drapeau');
  raise notice 'OK NONVALIDE';
end $$;
rollback;

-- La nouvelle validation lève le drapeau ; un changement ultérieur le repose.
begin; \i fixtures.sql
do $$ begin
  update public.audits_caisse set ecart_piste_valide = -5 where id = 'ad000000-0000-0000-0000-000000000001';
  update public.audits_caisse set valide_le_piste = clock_timestamp() where id = 'ad000000-0000-0000-0000-000000000001';
  perform pg_temp.ok((select revalidation_requise_piste_le is null from public.audits_caisse
                       where id = 'ad000000-0000-0000-0000-000000000001'), 'revalidation : drapeau levé');
  update public.audits_caisse set ecart_piste_valide = -7 where id = 'ad000000-0000-0000-0000-000000000001';
  perform pg_temp.ok((select revalidation_requise_piste_le is not null from public.audits_caisse
                       where id = 'ad000000-0000-0000-0000-000000000001'), 'nouveau changement : drapeau reposé');
  raise notice 'OK REVALIDATION';
end $$;
rollback;

-- L'écran ne pose ni n'efface le drapeau, ni à l'insertion ni à la mise à jour.
begin; \i fixtures.sql
do $$ begin
  insert into public.audits_caisse (site, date, quart, revalidation_requise_piste_le, revalidation_requise_boutique_le)
  values ('site-a', pg_temp.j(-4), '2', now(), now());
  perform pg_temp.ok((select revalidation_requise_piste_le is null and revalidation_requise_boutique_le is null
                        from public.audits_caisse where site = 'site-a' and date = pg_temp.j(-4) and quart = '2'), 'insertion : drapeaux ignorés');
  update public.audits_caisse set revalidation_requise_piste_le = now() where id = 'ad000000-0000-0000-0000-000000000004';
  perform pg_temp.ok((select revalidation_requise_piste_le is null from public.audits_caisse
                       where id = 'ad000000-0000-0000-0000-000000000004'), 'mise à jour : pose ignorée');
  update public.audits_caisse set ecart_piste_valide = -5 where id = 'ad000000-0000-0000-0000-000000000001';
  update public.audits_caisse set revalidation_requise_piste_le = null where id = 'ad000000-0000-0000-0000-000000000001';
  perform pg_temp.ok((select revalidation_requise_piste_le is not null from public.audits_caisse
                       where id = 'ad000000-0000-0000-0000-000000000001'), 'mise à jour : effacement ignoré');
  raise notice 'OK ECRAN';
end $$;
rollback;

-- Piste et boutique sont indépendantes (§5).
begin; \i fixtures.sql
do $$ begin
  update public.audits_caisse set ecart_boutique = 4, ecart_boutique_valide = 4, valide_le_boutique = now()
   where id = 'ad000000-0000-0000-0000-000000000004';
  update public.audits_caisse set ecart_boutique = 6 where id = 'ad000000-0000-0000-0000-000000000004';
  perform pg_temp.ok((select revalidation_requise_boutique_le is not null and revalidation_requise_piste_le is null
                        from public.audits_caisse where id = 'ad000000-0000-0000-0000-000000000004'), 'seule la boutique est à revalider');
  raise notice 'OK INDEPENDANCE';
end $$;
rollback;

-- L'état distingue « à valider de nouveau » et n'annonce plus de clôture.
begin; \i fixtures.sql
do $$ declare e jsonb; begin
  e := pg_temp.etat();
  perform pg_temp.ok((e->>'cloture')::boolean and not (e->>'revalidation_requise')::boolean, 'avant : ' || e::text);
  update public.audits_caisse set ecart_piste_valide = -5 where id = 'ad000000-0000-0000-0000-000000000001';
  e := pg_temp.etat();
  perform pg_temp.ok(not (e->>'cloture')::boolean and (e->>'revalidation_requise')::boolean, 'après : ' || e::text);
  raise notice 'OK ETAT';
end $$;
rollback;

-- Aucun versement sur une caisse à valider de nouveau ; accepté après.
begin; \i fixtures.sql
do $$ begin
  update public.audits_caisse set ecart_piste_valide = -5 where id = 'ad000000-0000-0000-0000-000000000001';
  perform pg_temp.refus('select pg_temp.verser(5)', '[ECART_A_REVALIDER]');
  perform pg_temp.ok((select count(*) = 0 from public.ecarts_versements_regularisation), 'le refus n''écrit rien');
  update public.audits_caisse set valide_le_piste = clock_timestamp() where id = 'ad000000-0000-0000-0000-000000000001';
  perform pg_temp.verser(5);
  perform pg_temp.ok((pg_temp.etat()->>'statut_regularisation') = 'SOLDE', 'versement accepté après revalidation');
  raise notice 'OK VERSEMENT';
end $$;
rollback;

-- Le trop-perçu né d'une correction non revalidée ne se restitue pas.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.verser(20);
  update public.audits_caisse set ecart_piste_valide = -5 where id = 'ad000000-0000-0000-0000-000000000001';
  perform pg_temp.refus($q$ select public.enregistrer_restitution_trop_percu('ad000000-0000-0000-0000-000000000001', 'piste', null,
    15, 'especes', 'audit corrigé', 'coffre', null, null, gen_random_uuid()) $q$, '[ECART_A_REVALIDER]');
  update public.audits_caisse set valide_le_piste = clock_timestamp() where id = 'ad000000-0000-0000-0000-000000000001';
  perform public.enregistrer_restitution_trop_percu('ad000000-0000-0000-0000-000000000001', 'piste', null,
    15, 'especes', 'audit corrigé', 'coffre', null, null, gen_random_uuid());
  perform pg_temp.ok((select count(*) = 1 from public.ecarts_restitutions_trop_percu), 'restitution acceptée après revalidation');
  raise notice 'OK RESTITUTION';
end $$;
rollback;

-- FDJ n'est pas concerné : la validation y est prononcée par version.
begin; \i fixtures.sql
do $$ declare e jsonb; begin
  e := public.ecart_regularisation_etat(null, null, 'fc000000-0000-0000-0000-000000000001');
  perform pg_temp.ok((e->>'cloture')::boolean and not (e->>'revalidation_requise')::boolean, 'FDJ : ' || e::text);
  perform public.enregistrer_versement_regularisation(null, null, 'fc000000-0000-0000-0000-000000000001', 5, 'especes', null,
    'coffre', null, null, gen_random_uuid());
  raise notice 'OK FDJ';
end $$;
rollback;
