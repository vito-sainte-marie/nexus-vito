-- Scénarios : chaque bloc part de fixtures neuves et se termine par rollback.
-- Étiquettes en majuscules sans chiffre (lues par executer.sh).
\set ON_ERROR_STOP 0

-- Versement intégral : le reste dû tombe à zéro, l'écart d'origine est intact.
begin; \i fixtures.sql
do $$ declare r jsonb; e jsonb; begin
  r := pg_temp.verser(20);
  perform pg_temp.ok((r->>'reste_du')::numeric = 0, 'reste dû nul après versement intégral : ' || r::text);
  e := pg_temp.etat();
  perform pg_temp.ok(e->>'statut' = 'regularise' and e->>'statut_regularisation' = 'SOLDE', 'statut régularisé : ' || e::text);
  perform pg_temp.ok((select ecart_piste_valide = -20 and ecart_piste = -20 from public.audits_caisse
                       where id = 'ad000000-0000-0000-0000-000000000001'), 'écart d''origine conservé');
  perform pg_temp.ok((select employee_id = 'a0000000-0000-0000-0000-000000000003' and auteur_id = 'a0000000-0000-0000-0000-000000000001'
                        and module_origine = 'verify' and date_ecart = pg_temp.j(-10)
                        from public.ecarts_versements_regularisation), 'responsable, auteur, origine et date d''écart portés');
  raise notice 'OK INTEGRAL';
end $$;
rollback;

-- Versement partiel puis complément ; tout centime au-delà est refusé.
begin; \i fixtures.sql
do $$ declare e jsonb; begin
  perform pg_temp.verser(8);
  e := pg_temp.etat();
  perform pg_temp.ok(e->>'statut' = 'partiellement_regularise' and e->>'statut_regularisation' = 'PARTIELLEMENT_REGULARISE'
                     and (e->>'reste_du')::numeric = 12, 'partiel : ' || e::text);
  raise notice 'OK PARTIEL';
  perform pg_temp.verser(12, 'coffre');
  e := pg_temp.etat();
  perform pg_temp.ok(e->>'statut' = 'regularise' and (e->>'versements')::numeric = 20, 'deux versements soldent : ' || e::text);
  -- Règle 1 : un écart soldé n'est plus éligible, et le dit.
  perform pg_temp.refus($q$ select pg_temp.verser(0.01) $q$, '[ECART_SOLDE]');
  raise notice 'OK MULTIPLE';
end $$;
rollback;

-- Plafond : un versement unique ne dépasse pas le déficit.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.refus($q$ select pg_temp.verser(20.01) $q$, '[PLAFOND_DEPASSE]');
  perform pg_temp.ok((select count(*) = 0 from public.ecarts_versements_regularisation), 'rien n''est écrit');
  perform pg_temp.refus($q$ select pg_temp.verser(0) $q$, 'Montant invalide');
  perform pg_temp.refus($q$ select pg_temp.verser(1.001) $q$, 'Montant invalide');
  raise notice 'OK PLAFOND';
end $$;
rollback;

-- Idempotence : rejouer la même clé ne crée rien ; la détourner est refusé.
begin; \i fixtures.sql
do $$ declare r1 jsonb; r2 jsonb; begin
  r1 := pg_temp.verser(5, k => '11111111-1111-1111-1111-111111111111');
  r2 := pg_temp.verser(5, k => '11111111-1111-1111-1111-111111111111');
  perform pg_temp.ok((r2->>'rejoue')::boolean and r2->>'versement_id' = r1->>'versement_id', 'rejeu : ' || r2::text);
  perform pg_temp.ok((select count(*) = 1 from public.ecarts_versements_regularisation), 'une seule ligne');
  perform pg_temp.refus($q$ select pg_temp.verser(6, k => '11111111-1111-1111-1111-111111111111') $q$, '[IDEMPOTENCE_CONFLIT]');
  raise notice 'OK IDEMPOTENCE';
end $$;
rollback;

-- Annulation : motif exigé, une seule fois, et le reste dû revient.
begin; \i fixtures.sql
do $$ declare id uuid; e jsonb; begin
  id := (pg_temp.verser(20)->>'versement_id')::uuid;
  perform pg_temp.refus(format('select public.annuler_versement_regularisation(%L, %L)', id, 'non'), '[JUSTIFICATION_REQUISE]');
  perform public.annuler_versement_regularisation(id, 'saisi sur le mauvais écart');
  e := pg_temp.etat();
  perform pg_temp.ok(e->>'statut' = 'non_regularise' and e->>'statut_regularisation' = 'OUVERT'
                     and (e->>'reste_du')::numeric = 20, 'reste dû rétabli : ' || e::text);
  perform pg_temp.refus(format('select public.annuler_versement_regularisation(%L, %L)', id, 'deuxième fois'), '[DEJA_ANNULE]');
  perform pg_temp.ok((select count(*) = 1 and bool_and(annule_par = 'a0000000-0000-0000-0000-000000000001')
                        from public.ecarts_versements_regularisation), 'la ligne reste, annulée et signée');
  raise notice 'OK ANNULATION';
end $$;
rollback;

-- Isolation : la station B n'agit ni ne lit sur la station A.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.verser(5);
  perform pg_temp.qui('b0000000-0000-0000-0000-000000000001');
  perform pg_temp.refus($q$ select pg_temp.verser(5) $q$, 'autre site');
  perform pg_temp.refus($q$ select pg_temp.etat() $q$, 'autre site');
  perform pg_temp.refus($q$ select * from public.ecarts_trop_percus('site-a') $q$, 'autre site');
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);
do $$ begin
  perform pg_temp.ok((select count(*) = 0 from public.ecarts_versements_regularisation), 'B ne lit pas les versements de A');
end $$;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
do $$ begin
  perform pg_temp.ok((select count(*) = 1 from public.ecarts_versements_regularisation), 'A lit son versement');
  raise notice 'OK SITES';
end $$;
rollback;

-- Droits : anon n'a rien ; authenticated lit seulement ; aides fermées.
begin; \i fixtures.sql
do $$ declare t text; f text; begin
  foreach t in array array['public.ecarts_versements_regularisation', 'public.ecarts_restitutions_trop_percu', 'public.caisse_transferts_coffre'] loop
    perform pg_temp.ok(not has_table_privilege('anon', t, 'select,insert,update,delete,truncate,references,trigger'), 'anon sur ' || t);
    perform pg_temp.ok(not has_table_privilege('authenticated', t, 'insert,update,delete,truncate,references,trigger'), 'authenticated écrit sur ' || t);
    perform pg_temp.ok(has_table_privilege('authenticated', t, 'select'), 'authenticated lit ' || t);
  end loop;
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like '\_ecarts\_regul\_%' loop
    perform pg_temp.ok(not has_function_privilege('anon', f, 'execute') and not has_function_privilege('authenticated', f, 'execute'), 'aide ouverte : ' || f);
  end loop;
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('enregistrer_versement_regularisation', 'annuler_versement_regularisation',
              'enregistrer_restitution_trop_percu', 'annuler_restitution_trop_percu', 'enregistrer_transfert_coffre',
              'annuler_transfert_coffre', 'ecart_regularisation_etat', 'ecarts_trop_percus') loop
    perform pg_temp.ok(not has_function_privilege('anon', f, 'execute'), 'anon exécute ' || f);
    perform pg_temp.ok(has_function_privilege('authenticated', f, 'execute'), 'authenticated n''exécute pas ' || f);
  end loop;
  raise notice 'OK DROITS';
end $$;
rollback;

-- Trop-perçu : l'audit d'origine est corrigé après versement ; restitution
-- signalée, plafonnée, distincte, jamais automatique.
begin; \i fixtures.sql
do $$ declare vid uuid; rid uuid; e jsonb; begin
  vid := (pg_temp.verser(20)->>'versement_id')::uuid;
  -- B5 : un résultat modifié exige une nouvelle validation (valide_le_piste renouvelé).
  update public.audits_caisse set ecart_piste_valide = -5, valide_le_piste = clock_timestamp() where id = 'ad000000-0000-0000-0000-000000000001';
  e := pg_temp.etat();
  perform pg_temp.ok(e->>'statut' = 'trop_percu' and (e->>'trop_percu')::numeric = 15, 'trop-perçu signalé : ' || e::text);
  perform pg_temp.ok((select count(*) = 1 and sum(trop_percu) = 15 from public.ecarts_trop_percus('site-a')), 'liste des trop-perçus');
  perform pg_temp.ok((select count(*) = 0 from public.ecarts_restitutions_trop_percu), 'aucune restitution automatique');
  perform pg_temp.refus($q$ select public.enregistrer_restitution_trop_percu('ad000000-0000-0000-0000-000000000001', 'piste', null,
    15.01, 'especes', 'audit corrigé le jour même', 'coffre', null, null, gen_random_uuid()) $q$, '[PLAFOND_DEPASSE]');
  perform pg_temp.refus($q$ select public.enregistrer_restitution_trop_percu('ad000000-0000-0000-0000-000000000001', 'piste', null,
    5, 'especes', 'non', 'coffre', null, null, gen_random_uuid()) $q$, '[JUSTIFICATION_REQUISE]');
  rid := (public.enregistrer_restitution_trop_percu('ad000000-0000-0000-0000-000000000001', 'piste', null,
    15, 'especes', 'audit corrigé le jour même', 'coffre', null, null, gen_random_uuid())->>'restitution_id')::uuid;
  e := pg_temp.etat();
  perform pg_temp.ok(e->>'statut' = 'regularise' and (e->>'trop_percu')::numeric = 0, 'après restitution : ' || e::text);
  perform pg_temp.ok((select employee_id = 'a0000000-0000-0000-0000-000000000003' and valide_par = 'a0000000-0000-0000-0000-000000000001'
                        from public.ecarts_restitutions_trop_percu), 'restitution au verseur, validée par le manager');
  perform pg_temp.refus(format('select public.annuler_versement_regularisation(%L, %L)', vid, 'versement contesté'), '[RESTITUTION_ACTIVE]');
  perform public.annuler_restitution_trop_percu(rid, 'restitution saisie par erreur');
  perform pg_temp.ok((pg_temp.etat()->>'trop_percu')::numeric = 15, 'annuler la restitution rétablit le trop-perçu');
  raise notice 'OK TROPPERCU';
end $$;
rollback;

-- Mode « autre » : justification obligatoire.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.refus($q$ select pg_temp.verser(5, mode => 'autre') $q$, '[JUSTIFICATION_REQUISE]');
  perform pg_temp.refus($q$ select pg_temp.verser(5, mode => 'autre', just => '  ab ') $q$, '[JUSTIFICATION_REQUISE]');
  perform pg_temp.refus($q$ select pg_temp.verser(5, mode => 'bitcoin') $q$, 'Mode d''encaissement inconnu');
  perform pg_temp.verser(5, mode => 'autre', just => 'ticket restaurant');
  perform pg_temp.verser(5, mode => 'carte_bancaire');
  perform pg_temp.verser(5, mode => 'cheque');
  perform pg_temp.verser(5, mode => 'virement', dest => 'coffre');
  perform pg_temp.ok((pg_temp.etat()->>'reste_du')::numeric = 0, 'cinq modes acceptés');
  raise notice 'OK MODES';
end $$;
rollback;

-- Écart sans responsable unique : aucune attribution financière.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.refus($q$ select pg_temp.verser(5, audit => 'ad000000-0000-0000-0000-000000000003') $q$, '[ECART_SANS_RESPONSABLE]');
  update public.fdj_shifts set employee_id = null where id = 'fd000000-0000-0000-0000-000000000001';
  perform pg_temp.refus($q$ select public.enregistrer_versement_regularisation(null, null, 'fc000000-0000-0000-0000-000000000001',
    5, 'especes', null, 'coffre', null, null, gen_random_uuid()) $q$, '[ECART_SANS_RESPONSABLE]');
  perform pg_temp.ok((public.ecart_regularisation_etat('ad000000-0000-0000-0000-000000000003', 'piste', null)->>'sans_responsable')::boolean,
    'état signale l''absence de responsable');
  raise notice 'OK RESPONSABLE';
end $$;
rollback;

-- Écart non validé, ou excédent : rien à régulariser.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.refus($q$ select pg_temp.verser(5, audit => 'ad000000-0000-0000-0000-000000000002') $q$, '[ECART_NON_CLOTURE]');
  perform pg_temp.refus($q$ select pg_temp.verser(5, audit => 'ad000000-0000-0000-0000-000000000004') $q$, '[ECART_SANS_DEFICIT]');
  raise notice 'OK ORIGINE';
end $$;
rollback;

-- Quart récepteur : ni futur, ni antérieur à l'écart, ni déjà validé.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.refus($q$ select pg_temp.verser(5, d => pg_temp.j(2)) $q$, '[QUART_RECEPTEUR_FUTUR]');
  perform pg_temp.refus($q$ select pg_temp.verser(5, d => pg_temp.j(-11)) $q$, '[QUART_RECEPTEUR_ANTERIEUR]');
  perform pg_temp.refus($q$ select pg_temp.verser(5, d => pg_temp.j(-2)) $q$, '[QUART_RECEPTEUR_CLOTURE]');
  perform pg_temp.refus($q$ select pg_temp.verser(5, dest => 'tiroir_fdj', d => pg_temp.j(-3)) $q$, '[QUART_RECEPTEUR_CLOTURE]');
  perform pg_temp.refus($q$ select pg_temp.verser(5, q => null) $q$, 'Un tiroir se désigne');
  perform pg_temp.verser(5, d => pg_temp.j(-2), q => '2');
  perform pg_temp.verser(5, d => pg_temp.j(0));
  raise notice 'OK RECEPTEUR';
end $$;
rollback;

-- FDJ reçu dans un tiroir Verify : compté une fois, rattaché à son origine FDJ.
begin; \i fixtures.sql
do $$ declare r jsonb; begin
  r := public.enregistrer_versement_regularisation(null, null, 'fc000000-0000-0000-0000-000000000001',
    15, 'especes', null, 'tiroir_verify_boutique', pg_temp.j(-1), '2', gen_random_uuid());
  perform pg_temp.ok((r->>'reste_du')::numeric = 0, 'FDJ soldé : ' || r::text);
  perform pg_temp.ok((select module_origine = 'fdj' and employee_id = 'a0000000-0000-0000-0000-000000000004'
                        and audit_id is null and caisse_origine is null and destination = 'tiroir_verify_boutique'
                        from public.ecarts_versements_regularisation), 'origine FDJ, tiroir Verify');
  perform pg_temp.ok((select ecart = -15 and resultat_controle = 'a_regulariser' from public.fdj_cash_controls
                       where id = 'fc000000-0000-0000-0000-000000000001'), 'contrôle FDJ intact');
  perform pg_temp.ok((public.ecart_regularisation_etat('ad000000-0000-0000-0000-000000000001', 'piste', null)->>'versements')::numeric = 0,
    'rien ne déborde sur un écart Verify');
  raise notice 'OK FDJVERIFY';
end $$;
rollback;

-- Immuabilité : pas de réécriture, pas de suppression, pas de vidage.
begin; \i fixtures.sql
do $$ declare id uuid; begin
  id := (pg_temp.verser(5)->>'versement_id')::uuid;
  perform pg_temp.refus(format('update public.ecarts_versements_regularisation set montant = 4 where id = %L', id), '[IMMUABLE]');
  perform pg_temp.refus(format('delete from public.ecarts_versements_regularisation where id = %L', id), '[IMMUABLE]');
  perform pg_temp.refus('truncate public.ecarts_versements_regularisation cascade', '[IMMUABLE]');
  perform pg_temp.refus(format('update public.ecarts_versements_regularisation set annule_le = now(), annule_par = %L, motif_annulation = %L, montant = 1 where id = %L',
    'a0000000-0000-0000-0000-000000000001', 'annulation déguisée', id), '[IMMUABLE]');
  perform pg_temp.refus('truncate public.caisse_transferts_coffre', '[IMMUABLE]');
  perform pg_temp.refus('truncate public.ecarts_restitutions_trop_percu', '[IMMUABLE]');
  raise notice 'OK IMMUABLE';
end $$;
rollback;

-- Transfert tiroir → coffre : tracé, plafonné au versement, bloque son annulation.
begin; \i fixtures.sql
do $$ declare vid uuid; tid uuid; begin
  vid := (pg_temp.verser(20)->>'versement_id')::uuid;
  tid := (public.enregistrer_transfert_coffre('tiroir_verify_piste', pg_temp.j(-1), '1', 15, vid, 'dépôt au coffre en fin de quart', gen_random_uuid())->>'transfert_id')::uuid;
  perform pg_temp.refus(format($q$ select public.enregistrer_transfert_coffre('tiroir_verify_piste', %L, '1', 5.01, %L, 'second dépôt au coffre', gen_random_uuid()) $q$,
    pg_temp.j(-1), vid), '[PLAFOND_DEPASSE]');
  perform pg_temp.refus(format($q$ select public.enregistrer_transfert_coffre('tiroir_verify_boutique', %L, '1', 1, %L, 'mauvais tiroir', gen_random_uuid()) $q$,
    pg_temp.j(-1), vid), 'tiroir qui a reçu');
  perform pg_temp.refus(format('select public.annuler_versement_regularisation(%L, %L)', vid, 'versement contesté'), '[TRANSFERT_ACTIF]');
  perform pg_temp.ok((pg_temp.etat()->>'versements')::numeric = 20, 'le transfert ne recompte pas le versement');
  perform public.annuler_transfert_coffre(tid, 'transfert saisi en double');
  perform public.annuler_versement_regularisation(vid, 'versement contesté');
  perform public.enregistrer_transfert_coffre('tiroir_fdj', pg_temp.j(-1), '1', 50, null, 'excédent de caisse déposé', gen_random_uuid());
  perform pg_temp.refus(format($q$ select public.enregistrer_transfert_coffre('tiroir_fdj', %L, '1', 1, null, 'quart déjà validé', gen_random_uuid()) $q$,
    pg_temp.j(-3)), '[QUART_RECEPTEUR_CLOTURE]');
  raise notice 'OK TRANSFERT';
end $$;
rollback;

-- Seuls un manager ou un gérant actifs du site agissent.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000003');
  perform pg_temp.refus($q$ select pg_temp.verser(5) $q$, 'Seul un manager');
  perform pg_temp.refus($q$ select pg_temp.etat() $q$, 'Seul un manager');
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000005');
  perform pg_temp.refus($q$ select pg_temp.verser(5) $q$, 'inactif');
  perform pg_temp.qui(null);
  perform pg_temp.refus($q$ select pg_temp.verser(5) $q$, 'Aucune session');
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000002');
  perform pg_temp.verser(5);
  perform pg_temp.ok((select count(*) = 1 from public.ecarts_versements_regularisation), 'gérant accepté');
  raise notice 'OK ROLES';
end $$;
rollback;

-- Règle 1 : un contrôle FDJ renvoyé « à revoir » porte un résultat mais
-- aucune validation ; il n'est pas éligible et son tiroir reste ouvert.
begin; \i fixtures.sql
do $$ declare e jsonb; begin
  perform pg_temp.refus($q$ select public.enregistrer_versement_regularisation(null, null, 'fc000000-0000-0000-0000-000000000003',
    5, 'especes', null, 'coffre', null, null, gen_random_uuid()) $q$, '[ECART_NON_CLOTURE]');
  e := public.ecart_regularisation_etat(null, null, 'fc000000-0000-0000-0000-000000000003');
  perform pg_temp.ok(not (e->>'cloture')::boolean, 'à revoir n''est pas clôturé : ' || e::text);
  perform pg_temp.verser(1, dest => 'tiroir_fdj', d => pg_temp.j(-5));
  raise notice 'OK NONVALIDE';
end $$;
rollback;

-- Règle 5 : la chronologie se juge au quart près ; le même quart est permis ;
-- un quart antérieur exige une correction de datation documentée, conservée.
begin; \i fixtures.sql
do $$ declare r jsonb; begin
  perform pg_temp.refus($q$ select pg_temp.verser(1, audit => 'ad000000-0000-0000-0000-000000000007', dest => 'tiroir_verify_boutique',
    d => pg_temp.j(-6), q => '1') $q$, '[QUART_RECEPTEUR_ANTERIEUR]');
  perform pg_temp.verser(1, audit => 'ad000000-0000-0000-0000-000000000007', dest => 'tiroir_verify_boutique', d => pg_temp.j(-6), q => '2');
  perform pg_temp.refus($q$ select public.enregistrer_versement_regularisation('ad000000-0000-0000-0000-000000000007', 'piste', null,
    1, 'especes', null, 'tiroir_verify_boutique', pg_temp.j(-7), '2', gen_random_uuid(), p_correction_datation => 'ab') $q$,
    '[QUART_RECEPTEUR_ANTERIEUR]');
  r := public.enregistrer_versement_regularisation('ad000000-0000-0000-0000-000000000007', 'piste', null,
    1, 'especes', null, 'tiroir_verify_boutique', pg_temp.j(-7), '2', gen_random_uuid(),
    p_correction_datation => 'versement remis la veille, saisi après l''audit');
  perform pg_temp.ok((select correction_datation is not null from public.ecarts_versements_regularisation
                       where id = (r->>'versement_id')::uuid), 'correction de datation conservée');
  perform pg_temp.ok((select count(*) = 1 from public.ecarts_versements_regularisation where correction_datation is null),
    'le même quart n''exige aucune correction');
  raise notice 'OK CHRONOLOGIE';
end $$;
rollback;

-- Règle 2 : la restitution va au payeur réel ; un tiers exige d'être nommé et
-- autorisé, et la chronologie s'applique aussi au tiroir d'où sort l'argent.
begin; \i fixtures.sql
do $$ declare rid uuid; begin
  perform pg_temp.verser(20);
  -- B5 : un résultat modifié exige une nouvelle validation (valide_le_piste renouvelé).
  update public.audits_caisse set ecart_piste_valide = -5, valide_le_piste = clock_timestamp() where id = 'ad000000-0000-0000-0000-000000000001';
  perform pg_temp.refus($q$ select public.enregistrer_restitution_trop_percu('ad000000-0000-0000-0000-000000000001', 'piste', null,
    5, 'especes', 'audit corrigé', 'coffre', null, null, gen_random_uuid(), p_beneficiaire_tiers => 'Conjoint du payeur') $q$,
    '[AUTORISATION_TIERS_REQUISE]');
  perform pg_temp.refus($q$ select public.enregistrer_restitution_trop_percu('ad000000-0000-0000-0000-000000000001', 'piste', null,
    5, 'especes', 'audit corrigé', 'coffre', null, null, gen_random_uuid(), p_autorisation_tiers => 'procuration écrite') $q$,
    '[TIERS_NON_DESIGNE]');
  perform pg_temp.refus(format($q$ select public.enregistrer_restitution_trop_percu('ad000000-0000-0000-0000-000000000001', 'piste', null,
    5, 'especes', 'audit corrigé', 'tiroir_verify_boutique', %L, '1', gen_random_uuid()) $q$, pg_temp.j(-11)), '[QUART_RECEPTEUR_ANTERIEUR]');
  perform pg_temp.ok((select count(*) = 0 from public.ecarts_restitutions_trop_percu), 'aucun refus n''écrit');
  rid := (public.enregistrer_restitution_trop_percu('ad000000-0000-0000-0000-000000000001', 'piste', null,
    5, 'especes', 'audit corrigé', 'coffre', null, null, gen_random_uuid(),
    p_beneficiaire_tiers => 'Conjoint du payeur', p_autorisation_tiers => 'procuration écrite du payeur')->>'restitution_id')::uuid;
  perform pg_temp.ok((select employee_id = 'a0000000-0000-0000-0000-000000000003' and beneficiaire_tiers = 'Conjoint du payeur'
                        and autorisation_tiers is not null from public.ecarts_restitutions_trop_percu where id = rid),
    'payeur réel conservé, tiers et autorisation tracés');
  raise notice 'OK TIERS';
end $$;
rollback;
