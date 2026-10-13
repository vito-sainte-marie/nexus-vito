-- Scénarios des versements groupés : chaque bloc part de fixtures neuves et se termine par rollback.
-- Étiquettes en majuscules sans chiffre (lues par executer.sh).
\set ON_ERROR_STOP 0

-- Cas A (Angélique) : 8 € exacts pour deux manques de 4 € ; le tiroir reçoit 8 €, pas 16.
begin; \i fixtures.sql
do $$ declare r jsonb; begin
  r := pg_temp.groupe(8, jsonb_build_array(pg_temp.fa('11', 4), pg_temp.fa('12', 4)));
  perform pg_temp.ok((r->>'surplus')::numeric = 0 and (r->>'affectations')::int = 2, 'exact : ' || r::text);
  perform pg_temp.ok(pg_temp.reste('11') = 0 and pg_temp.reste('12') = 0, 'les deux écarts sont soldés');
  perform pg_temp.ok(pg_temp.tiroir() = 8, 'tiroir = 8 : ' || pg_temp.tiroir());
  raise notice 'OK EXACT';
end $$;
rollback;

-- Le tiroir compte l'argent du groupe une fois, y compris avec surplus (10 reçus, 8 affectés).
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.groupe(10, jsonb_build_array(pg_temp.fa('11', 4), pg_temp.fa('12', 4)), true);
  perform pg_temp.ok(pg_temp.tiroir() = 10, 'tiroir = 10 (ni 8 ni 18) : ' || pg_temp.tiroir());
  raise notice 'OK TIROIRG';
end $$;
rollback;

-- Cas B : versement partiel (5 € sur 4 + 4) ; le plus ancien est soldé, le suivant partiel.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.groupe(5, jsonb_build_array(pg_temp.fa('11', 4), pg_temp.fa('12', 1)));
  perform pg_temp.ok(pg_temp.reste('11') = 0 and pg_temp.reste('12') = 3, 'partiel : ' || pg_temp.reste('12'));
  raise notice 'OK PARTIELG';
end $$;
rollback;

-- Cas C : aucun ordre imposé ; on peut régulariser le plus récent seul, puis un ancien.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.groupe(3, jsonb_build_array(pg_temp.fa('13', 3)));
  perform pg_temp.ok(pg_temp.reste('13') = 0 and pg_temp.reste('11') = 4, 'le récent seul');
  perform pg_temp.groupe(4, jsonb_build_array(pg_temp.fa('11', 4)));
  perform pg_temp.ok(pg_temp.reste('11') = 0 and pg_temp.reste('12') = 4, 'puis un ancien');
  raise notice 'OK SANSORDRE';
end $$;
rollback;

-- Cas D : 10 reçus, 8 affectés : le surplus exige une confirmation explicite, puis reste suivi.
begin; \i fixtures.sql
do $$ declare r jsonb; begin
  perform pg_temp.refus($q$ select pg_temp.groupe(10, jsonb_build_array(pg_temp.fa('11', 4), pg_temp.fa('12', 4))) $q$, '[SURPLUS_NON_CONFIRME]');
  perform pg_temp.ok((select count(*) = 0 from public.versements_regularisation_groupes), 'rien n''est écrit sans confirmation');
  r := pg_temp.groupe(10, jsonb_build_array(pg_temp.fa('11', 4), pg_temp.fa('12', 4)), true);
  perform pg_temp.ok((r->>'surplus')::numeric = 2, 'surplus 2 : ' || r::text);
  perform pg_temp.ok((select surplus = 2 and affecte = 8 from public.versements_groupes('site-a')), 'le surplus est lisible');
  raise notice 'OK SURPLUS';
end $$;
rollback;

-- Le surplus s'impute ensuite à de nouveaux écarts, jamais au-delà.
begin; \i fixtures.sql
do $$ declare g uuid; begin
  g := (pg_temp.groupe(10, jsonb_build_array(pg_temp.fa('11', 4), pg_temp.fa('12', 4)), true)->>'groupe_id')::uuid;
  perform pg_temp.refus(format($q$ select public.affecter_surplus_groupe(%L, jsonb_build_array(%L::jsonb), gen_random_uuid()) $q$,
    g, pg_temp.fa('13', 3)), 'Il ne reste que');
  perform public.affecter_surplus_groupe(g, jsonb_build_array(pg_temp.fa('13', 2)), gen_random_uuid());
  perform pg_temp.ok(pg_temp.reste('13') = 1, 'imputation de 2 sur 3');
  perform pg_temp.ok((select surplus = 0 from public.versements_groupes('site-a')), 'surplus consommé');
  perform pg_temp.ok(pg_temp.tiroir() = 10, 'le tiroir ne bouge pas à l''imputation');
  raise notice 'OK IMPUTATION';
end $$;
rollback;

-- Cas E : versements successifs sur le même écart, jusqu'au solde puis refus.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.groupe(1, jsonb_build_array(pg_temp.fa('11', 1)));
  perform pg_temp.groupe(2, jsonb_build_array(pg_temp.fa('11', 2)));
  perform pg_temp.groupe(1, jsonb_build_array(pg_temp.fa('11', 1)));
  perform pg_temp.ok(pg_temp.reste('11') = 0 and pg_temp.tiroir() = 4, 'trois versements : ' || pg_temp.tiroir());
  perform pg_temp.refus($q$ select pg_temp.groupe(1, jsonb_build_array(pg_temp.fa('11', 1))) $q$, '[ECART_SOLDE]');
  raise notice 'OK PLAFONDG';
end $$;
rollback;

-- Affectation supérieure au reste dû : refusée avant toute écriture.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.refus($q$ select pg_temp.groupe(5, jsonb_build_array(pg_temp.fa('11', 4.01)), true) $q$, 'dépasse le reste dû');
  raise notice 'OK PLAFONDR';
end $$;
rollback;

-- Affectations supérieures au versement : la RPC refuse (message RPC), la base aussi (message trigger).
begin; \i fixtures.sql
do $$ declare g uuid; begin
  perform pg_temp.refus($q$ select pg_temp.groupe(5, jsonb_build_array(pg_temp.fa('11', 4), pg_temp.fa('12', 4))) $q$, 'dépassent le versement reçu');
  raise notice 'OK SUPERIEUR';
  g := (pg_temp.groupe(5, jsonb_build_array(pg_temp.fa('11', 4)), true)->>'groupe_id')::uuid;
  perform pg_temp.refus(format($q$ insert into public.ecarts_versements_regularisation (site, employee_id, module_origine, fdj_cash_control_id,
      date_ecart, quart_ecart, montant, mode_encaissement, destination, recepteur_date, recepteur_quart, auteur_id, idempotency_key, groupe_id)
    values ('site-a', 'a0000000-0000-0000-0000-000000000007', 'fdj', 'fc000000-0000-0000-0000-000000000012', %L, '1', 1.01,
      'especes', 'tiroir_fdj', %L, '1', 'a0000000-0000-0000-0000-000000000001', gen_random_uuid(), %L) $q$,
    pg_temp.j(-8), pg_temp.j(-1), g), 'dépasseraient');
  raise notice 'OK SUPERTRIGGER';
end $$;
rollback;

-- Un même écart ne figure qu'une fois (sinon il serait payé deux fois).
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.refus($q$ select pg_temp.groupe(8, jsonb_build_array(pg_temp.fa('11', 4), pg_temp.fa('11', 4))) $q$, '[AFFECTATION_DOUBLON]');
  perform pg_temp.ok((select count(*) = 0 from public.ecarts_versements_regularisation), 'rien n''est écrit');
  raise notice 'OK DOUBLON';
end $$;
rollback;

-- Domaine et salarié : Verify ≠ FDJ, et l'écart d'un autre ne se règle pas avec l'argent de celui-ci.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.refus($q$ select pg_temp.groupe(10, jsonb_build_array(pg_temp.fa('11', 4), pg_temp.va('1', 6)), true) $q$, 'Un versement Verify ne régularise pas');
  raise notice 'OK DOMAINEG';
  perform pg_temp.refus($q$ select pg_temp.groupe(4, jsonb_build_array(pg_temp.fa('11', 4)), emp => 'a0000000-0000-0000-0000-000000000004') $q$, 'pas celui du salarié');
  raise notice 'OK SALARIEG';
end $$;
rollback;

-- Groupe Verify : deux audits du même pompiste, reçus au tiroir piste.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.groupe(20, jsonb_build_array(pg_temp.va('1', 12), pg_temp.va('7', 8)), dest => 'tiroir_verify_piste',
    emp => 'a0000000-0000-0000-0000-000000000003', dom => 'verify');
  perform pg_temp.ok(pg_temp.tiroir('tiroir_verify_piste') = 20, 'tiroir piste = 20 : ' || pg_temp.tiroir('tiroir_verify_piste'));
  raise notice 'OK VERIFYG';
end $$;
rollback;

-- Écart non validé : pas de régularisation.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.refus($q$ select pg_temp.groupe(2, jsonb_build_array(pg_temp.fa('14', 2))) $q$, '[ECART_NON_CLOTURE]');
  raise notice 'OK NONVALIDEG';
end $$;
rollback;

-- Quart récepteur : futur et déjà validé refusés.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.refus($q$ select pg_temp.groupe(4, jsonb_build_array(pg_temp.fa('11', 4)), d => pg_temp.j(2)) $q$, '[QUART_RECEPTEUR_FUTUR]');
  raise notice 'OK FUTURG';
  perform pg_temp.refus($q$ select pg_temp.groupe(4, jsonb_build_array(pg_temp.fa('11', 4)), d => pg_temp.j(-3)) $q$, '[QUART_RECEPTEUR_CLOTURE]');
  raise notice 'OK CLOTUREG';
end $$;
rollback;

-- Double clic : même clé, rien de plus ; clé détournée refusée.
begin; \i fixtures.sql
do $$ declare r1 jsonb; r2 jsonb; cle uuid := '22222222-2222-2222-2222-222222222222'; begin
  r1 := pg_temp.groupe(4, jsonb_build_array(pg_temp.fa('11', 4)), k => cle);
  r2 := pg_temp.groupe(4, jsonb_build_array(pg_temp.fa('11', 4)), k => cle);
  perform pg_temp.ok((r2->>'rejoue')::boolean and r2->>'groupe_id' = r1->>'groupe_id', 'rejeu : ' || r2::text);
  perform pg_temp.ok((select count(*) = 1 from public.versements_regularisation_groupes)
                     and (select count(*) = 1 from public.ecarts_versements_regularisation), 'une seule écriture');
  perform pg_temp.refus($q$ select pg_temp.groupe(5, jsonb_build_array(pg_temp.fa('11', 4)), true, k => '22222222-2222-2222-2222-222222222222') $q$, '[IDEMPOTENCE_CONFLIT]');
  raise notice 'OK REJEUG';
end $$;
rollback;

-- Annulation du groupe : motif exigé, une fois, les écarts se rouvrent, le tiroir se vide.
begin; \i fixtures.sql
do $$ declare g uuid; begin
  g := (pg_temp.groupe(8, jsonb_build_array(pg_temp.fa('11', 4), pg_temp.fa('12', 4)))->>'groupe_id')::uuid;
  perform pg_temp.refus(format('select public.annuler_versement_groupe(%L, %L)', g, 'non'), '[JUSTIFICATION_REQUISE]');
  perform public.annuler_versement_groupe(g, 'saisi à la mauvaise personne');
  perform pg_temp.ok(pg_temp.reste('11') = 4 and pg_temp.reste('12') = 4, 'écarts rouverts');
  perform pg_temp.ok(pg_temp.tiroir() = 0, 'tiroir vidé : ' || pg_temp.tiroir());
  perform pg_temp.refus(format('select public.annuler_versement_groupe(%L, %L)', g, 'deuxième fois'), '[DEJA_ANNULE]');
  perform pg_temp.ok((select count(*) = 2 and bool_and(annule_par is not null) from public.ecarts_versements_regularisation), 'lignes conservées, signées');
  raise notice 'OK ANNULG';
end $$;
rollback;

-- Une affectation ne s'annule pas seule, ni ne s'envoie seule au coffre.
begin; \i fixtures.sql
do $$ declare g uuid; a uuid; begin
  g := (pg_temp.groupe(8, jsonb_build_array(pg_temp.fa('11', 4), pg_temp.fa('12', 4)))->>'groupe_id')::uuid;
  select id into a from public.ecarts_versements_regularisation where groupe_id = g limit 1;
  perform pg_temp.refus(format('select public.annuler_versement_regularisation(%L, %L)', a, 'annulation isolée'), '[GROUPE_ACTIF]');
  perform pg_temp.refus(format($q$ select public.enregistrer_transfert_coffre('tiroir_fdj', %L, '1', 1, %L, 'transfert isolé', gen_random_uuid()) $q$,
    pg_temp.j(-1), a), '[GROUPE_ACTIF]');
  raise notice 'OK GROUPEACTIF';
end $$;
rollback;

-- Transfert au coffre depuis le groupe : plafonné au versement ; bloque l'annulation ; compté en sortie.
begin; \i fixtures.sql
do $$ declare g uuid; begin
  g := (pg_temp.groupe(10, jsonb_build_array(pg_temp.fa('11', 4), pg_temp.fa('12', 4)), true)->>'groupe_id')::uuid;
  perform public.enregistrer_transfert_coffre_groupe(g, 6, 'dépôt au coffre en fin de quart', gen_random_uuid());
  perform pg_temp.refus(format($q$ select public.enregistrer_transfert_coffre_groupe(%L, 4.01, 'second dépôt au coffre', gen_random_uuid()) $q$, g), '[PLAFOND_DEPASSE]');
  perform pg_temp.ok(pg_temp.tiroir() = 4, 'tiroir 10 − 6 = 4 : ' || pg_temp.tiroir());
  perform pg_temp.refus(format('select public.annuler_versement_groupe(%L, %L)', g, 'versement contesté'), '[TRANSFERT_ACTIF]');
  raise notice 'OK TRANSFERTG';
end $$;
rollback;

-- Les écarts ouverts d'un salarié, du plus ancien au plus récent, sans le soldé ni le non validé.
begin; \i fixtures.sql
do $$ declare l numeric[]; begin
  perform pg_temp.groupe(4, jsonb_build_array(pg_temp.fa('11', 4)));
  select array_agg(solde order by date_ecart) into l from public.ecarts_ouverts_employe('a0000000-0000-0000-0000-000000000007', 'fdj');
  perform pg_temp.ok(l = array[4, 3]::numeric[], 'ouverts : ' || coalesce(l::text, 'vide'));
  raise notice 'OK OUVERTSG';
end $$;
rollback;

-- Isolation des sites : un manager d'un autre site ne lit ni n'écrit.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.groupe(4, jsonb_build_array(pg_temp.fa('11', 4)));
  perform pg_temp.qui('b0000000-0000-0000-0000-000000000001');
  perform pg_temp.refus($q$ select pg_temp.groupe(4, jsonb_build_array(pg_temp.fa('12', 4))) $q$, '');
  perform pg_temp.ok((select count(*) = 0 from public.ecarts_ouverts_employe('a0000000-0000-0000-0000-000000000007', 'fdj')), 'B ne voit pas les écarts de A');
  perform pg_temp.ok((select count(*) = 0 from public.versements_groupes('site-b')), 'B ne voit pas les groupes de A');
  perform pg_temp.ok((select count(*) = 1 from public.versements_regularisation_groupes), 'A garde son groupe');
  raise notice 'OK SITEG';
end $$;
rollback;

-- Droits : aucune RPC ouverte à anon/public, aides internes fermées, table non écrivable.
begin; \i fixtures.sql
do $$ declare f text; begin
  foreach f in array array[
    'public.enregistrer_versement_groupe(uuid, text, numeric, text, text, text, date, text, jsonb, boolean, uuid, text)',
    'public.affecter_surplus_groupe(uuid, jsonb, uuid)', 'public.annuler_versement_groupe(uuid, text)',
    'public.enregistrer_transfert_coffre_groupe(uuid, numeric, text, uuid)', 'public.ecarts_ouverts_employe(uuid, text)',
    'public.versements_groupes(text, uuid)'] loop
    if has_function_privilege('anon', f, 'execute') then raise exception 'ÉCHEC : % exécutable par anon', f; end if;
    if not has_function_privilege('authenticated', f, 'execute') then raise exception 'ÉCHEC : % fermé à authenticated', f; end if;
  end loop;
  foreach f in array array['public._groupe_valider_affectations(text, uuid, text, jsonb)',
    'public._groupe_inserer_affectations(uuid, jsonb, uuid, text)', 'public._evr_groupe_controle()'] loop
    if has_function_privilege('authenticated', f, 'execute') or has_function_privilege('anon', f, 'execute') then
      raise exception 'ÉCHEC : aide interne % ouverte', f;
    end if;
  end loop;
  if has_table_privilege('anon', 'public.versements_regularisation_groupes', 'select')
     or has_table_privilege('authenticated', 'public.versements_regularisation_groupes', 'insert')
     or has_table_privilege('authenticated', 'public.versements_regularisation_groupes', 'update')
     or has_table_privilege('authenticated', 'public.versements_regularisation_groupes', 'delete') then
    raise exception 'ÉCHEC : table des groupes trop ouverte';
  end if;
  raise notice 'OK DROITSG';
end $$;
rollback;
