-- Recette C du mandat consolidé (08/10/2026), sur la base NEXUS Test réelle.
-- Chaque bloc part de fixtures neuves et se termine par rollback : rien ne
-- reste. Toutes les actions sont jouées en `authenticated` avec l'identité
-- d'un employé fictif, comme un écran ; seuls les constats « intacts » sont
-- relus en postgres après `reset role`.
-- Étiquettes en majuscules sans chiffre (lues par executer.sh).
\set ON_ERROR_STOP 0

-- §1 FDJ, chaîne complète : brouillon sans écart, V1, V2, validation par le
-- manager seul, puis « Signaler une erreur après validation ».
begin; \i fixtures.sql
set local role authenticated;
do $$ declare r jsonb; begin
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000004');
  perform public.fdj_enregistrer_brouillon_caisse('fd000000-0000-0000-0000-000000000001', '{}'::jsonb, 0, 50, 40, 0);
  r := public.fdj_ma_caisse('fd000000-0000-0000-0000-000000000001');
  perform pg_temp.ok(r->>'etape' = 'brouillon' and not (r->>'ecart_etabli')::boolean
                     and r->'ecart_provisoire' = 'null'::jsonb and r->'libelle_ecart' = 'null'::jsonb,
                     'brouillon : aucun écart montré : ' || r::text);
  perform pg_temp.ok(r->>'action_disponible' = 'Confirmer ma caisse et la transmettre au manager', 'action V1 : ' || r::text);
  raise notice 'OK BROUILLON';

  perform public.fdj_confirmer_caisse('fd000000-0000-0000-0000-000000000001', '{}'::jsonb, 0, 50, 40, 0);
  r := public.fdj_ma_caisse('fd000000-0000-0000-0000-000000000001');
  perform pg_temp.ok(r->>'etape' = 'en_attente_controle_manager' and (r->>'ecart_provisoire')::numeric = -10
                     and r->>'libelle_ecart' = 'Écart provisoire en moins : −10.00 €', 'V1 : ' || r::text);
  perform pg_temp.ok(r->>'action_disponible' = 'Corriger ma saisie' and (r->>'version')::int = 1, 'V1 action : ' || r::text);
  raise notice 'OK VUN';

  r := public.fdj_corriger_caisse_confirmee('fd000000-0000-0000-0000-000000000001', 'billet oublié', 'recompté',
                                            '{}'::jsonb, 0, 50, 50, 0);
  r := public.fdj_ma_caisse('fd000000-0000-0000-0000-000000000001');
  perform pg_temp.ok((r->>'version')::int = 2 and (r->>'ecart_provisoire')::numeric = 0
                     and r->>'libelle_ecart' like 'Aucun écart provisoire%', 'V2 : ' || r::text);
  perform pg_temp.ok((r->'confirmation_initiale'->>'ecart')::numeric = -10
                     and (r->'confirmation_initiale'->>'caisse_reelle')::numeric = 40, 'V1 conservée : ' || r::text);
  raise notice 'OK VDEUX';

  perform pg_temp.refus($q$ select public.fdj_valider_caisse('fd000000-0000-0000-0000-000000000001', 'conforme', null, null) $q$,
                        'Seul un manager');
  perform pg_temp.refus($q$ update public.fdj_cash_controls set valide_le = now(), valide_par = 'a0000000-0000-0000-0000-000000000004'
                            where shift_id = 'fd000000-0000-0000-0000-000000000001' $q$, 'permission denied');
  perform pg_temp.qui('b0000000-0000-0000-0000-000000000004');
  perform pg_temp.refus($q$ select public.fdj_ma_caisse('fd000000-0000-0000-0000-000000000001') $q$, 'pas sous votre responsabilité');
  perform pg_temp.ok((select count(*) = 0 from public.fdj_cash_controls), 'le caissier B ne lit rien de A');
  perform pg_temp.qui('b0000000-0000-0000-0000-000000000001');
  perform pg_temp.refus($q$ select public.fdj_valider_caisse('fd000000-0000-0000-0000-000000000001', 'conforme', null, null) $q$, 'autre site');
  raise notice 'OK SEULMANAGER';

  perform pg_temp.qui('a0000000-0000-0000-0000-000000000001');
  perform public.fdj_valider_caisse('fd000000-0000-0000-0000-000000000001', 'conforme', null, null);
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000004');
  r := public.fdj_ma_caisse('fd000000-0000-0000-0000-000000000001');
  perform pg_temp.ok(r->>'etape' = 'validee' and r->>'action_disponible' = 'Signaler une erreur après validation'
                     and r->'ecart_provisoire' = 'null'::jsonb and (r->>'ecart_retenu')::numeric = 0, 'validée : ' || r::text);
  r := public.fdj_corriger_caisse_confirmee('fd000000-0000-0000-0000-000000000001', 'après coup', null, '{}'::jsonb, 0, 50, 30, 0);
  perform pg_temp.ok(r->>'corrige' = 'false' and r->>'motif' = 'caisse_validee', 'correction refusée après validation : ' || r::text);
  raise notice 'OK VALIDEE';
end $$;
reset role;
do $$ begin
  perform pg_temp.ok((select valide_par = 'a0000000-0000-0000-0000-000000000001' and caisse_reelle = 50 and version = 2
                        from public.fdj_cash_controls where shift_id = 'fd000000-0000-0000-0000-000000000001'),
                     'validée par le manager, V2 intacte');
end $$;
rollback;

-- §2 Versement partiel : 8 puis 12 sur un écart de −20 €.
begin; \i fixtures.sql
set local role authenticated;
do $$ declare e jsonb; begin
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000001');
  e := pg_temp.etat();
  perform pg_temp.ok(e->>'statut_regularisation' = 'OUVERT' and (e->>'reste_du')::numeric = 20, 'ouvert : ' || e::text);
  perform pg_temp.verser(8);
  e := pg_temp.etat();
  perform pg_temp.ok(e->>'statut_regularisation' = 'PARTIELLEMENT_REGULARISE' and (e->>'reste_du')::numeric = 12, 'partiel : ' || e::text);
  perform pg_temp.verser(12, mode => 'carte_bancaire');
  e := pg_temp.etat();
  perform pg_temp.ok(e->>'statut_regularisation' = 'SOLDE' and (e->>'reste_du')::numeric = 0, 'soldé : ' || e::text);
  perform pg_temp.refus('select pg_temp.verser(1)', '[ECART_SOLDE]');
  perform pg_temp.ok((select ecart_piste_valide = -20 from public.audits_caisse where id = 'ad000000-0000-0000-0000-000000000001'),
                     'écart d''origine conservé');
  raise notice 'OK PARTIEL';
end $$;
rollback;

-- §2 Trop-perçu : l'écart est corrigé (−20 → −5) puis revalidé après un
-- versement de 20 ; rien n'est restitué tout seul ; restitution manager au
-- payeur réel ; un tiers non autorisé est refusé.
begin; \i fixtures.sql
set local role authenticated;
do $$ declare e jsonb; begin
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000001');
  perform pg_temp.verser(20);
  update public.audits_caisse set ecart_piste_valide = -5, ecart_piste = -5 where id = 'ad000000-0000-0000-0000-000000000001';
  update public.audits_caisse set valide_le_piste = clock_timestamp() where id = 'ad000000-0000-0000-0000-000000000001';
  e := pg_temp.etat();
  perform pg_temp.ok(e->>'statut' = 'trop_percu' and (e->>'trop_percu')::numeric = 15, 'trop-perçu : ' || e::text);
  perform pg_temp.ok((select count(*) = 0 from public.ecarts_restitutions_trop_percu), 'aucune restitution automatique');
  perform pg_temp.refus($q$ select public.enregistrer_restitution_trop_percu('ad000000-0000-0000-0000-000000000001', 'piste', null,
    15, 'especes', 'écart corrigé', 'coffre', null, null, gen_random_uuid(), p_beneficiaire_tiers => 'Conjoint') $q$,
    '[AUTORISATION_TIERS_REQUISE]');
  perform public.enregistrer_restitution_trop_percu('ad000000-0000-0000-0000-000000000001', 'piste', null,
    15, 'especes', 'écart corrigé après revalidation', 'coffre', null, null, gen_random_uuid());
  perform pg_temp.ok((select employee_id = 'a0000000-0000-0000-0000-000000000003' and valide_par = 'a0000000-0000-0000-0000-000000000001'
                        from public.ecarts_restitutions_trop_percu), 'restitué au payeur, validé par le manager');
  perform pg_temp.ok((pg_temp.etat()->>'trop_percu')::numeric = 0, 'trop-perçu soldé');
  raise notice 'OK TROPPERCU';
end $$;
rollback;

-- §3 Transfert au coffre : versement de 15 en espèces dans le tiroir piste
-- de J−1 Q1, transfert de 10 ; le tiroir garde un net de 5, sans recompter.
begin; \i fixtures.sql
set local role authenticated;
do $$ declare vid uuid; r jsonb; begin
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000001');
  vid := (pg_temp.verser(15)->>'versement_id')::uuid;
  perform public.enregistrer_transfert_coffre('tiroir_verify_piste', pg_temp.j(-1), '1', 10, vid, 'dépôt au coffre', gen_random_uuid());
  perform pg_temp.refus(format($q$ select public.enregistrer_transfert_coffre('tiroir_verify_piste', %L, '1', 5.01, %L, 'second dépôt', gen_random_uuid()) $q$,
    pg_temp.j(-1), vid), '[PLAFOND_DEPASSE]');
  r := public.regularisations_tiroirs('site-a', pg_temp.j(-1), '1');
  perform pg_temp.ok((r->'tiroir_verify_piste'->>'net')::numeric = 5 and (r->'tiroir_verify_piste'->>'entrees')::numeric = 15
                     and (r->'tiroir_verify_piste'->>'sorties')::numeric = 10, 'tiroir piste : ' || r::text);
  perform pg_temp.ok((r->'tiroir_verify_piste'->'par_mode'->'especes'->>'net')::numeric = 5, 'ventilé par mode : ' || r::text);
  perform pg_temp.ok((pg_temp.etat()->>'versements')::numeric = 15, 'le transfert ne recompte pas le versement');
  raise notice 'OK COFFRE';
end $$;
rollback;

-- §9 Tentatives non autorisées : pompiste et caissier, par appel direct.
begin; \i fixtures.sql
set local role authenticated;
do $$ declare n int; begin
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000003');
  perform pg_temp.refus('select pg_temp.verser(5)', 'Seul un manager');
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000004');
  perform pg_temp.refus('select pg_temp.verser(5)', 'Seul un manager');
  perform pg_temp.refus(format($q$ select public.enregistrer_transfert_coffre('tiroir_verify_piste', %L, '1', 1, null, 'essai', gen_random_uuid()) $q$,
    pg_temp.j(-1)), 'Seul un manager');
  -- Sous RLS, l'écriture directe n'échoue pas : elle ne voit aucune ligne.
  with u as (update public.audits_caisse set ecart_piste_valide = 0 where id = 'ad000000-0000-0000-0000-000000000001' returning 1)
  select count(*) into n from u;
  perform pg_temp.ok(n = 0, 'UPDATE direct du caissier : ' || n || ' ligne(s)');
  raise notice 'OK NONAUTORISE';
end $$;
reset role;
do $$ begin
  perform pg_temp.ok((select count(*) = 0 from public.ecarts_versements_regularisation), 'aucun refus n''a écrit');
  perform pg_temp.ok((select ecart_piste_valide = -20 from public.audits_caisse where id = 'ad000000-0000-0000-0000-000000000001'), 'audit intact');
end $$;
rollback;

-- §9 Autre station : le manager B n'agit ni ne lit sur la station A.
begin; \i fixtures.sql
set local role authenticated;
do $$ begin
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000001');
  perform pg_temp.verser(5);
  perform pg_temp.qui('b0000000-0000-0000-0000-000000000001');
  perform pg_temp.refus('select pg_temp.verser(5)', 'autre site');
  perform pg_temp.refus($q$ select public.ecart_regularisation_etat('ad000000-0000-0000-0000-000000000001', 'piste', null) $q$, 'autre site');
  perform pg_temp.ok((select count(*) = 0 from public.audits_caisse where site = 'site-a'), 'B ne lit aucun audit de A');
  perform pg_temp.ok((select count(*) = 0 from public.ecarts_versements_regularisation), 'B ne lit aucun versement de A');
  perform pg_temp.refus($q$ select * from public.ecarts_trop_percus('site-a') $q$, 'autre site');
  raise notice 'OK AUTRESITE';
end $$;
rollback;

-- 07/10 Q2 (§5, §6) : piste validée à −5 €, corrigée à 0 € par l'upsert de
-- Verify sans motif ; nouvelle validation exigée, puis levée ; la boutique
-- non validée n'est pas touchée.
begin; \i fixtures.sql
insert into public.audits_caisse (site, date, quart, employes_piste, ecart_piste, ecart_piste_valide, valide_le_piste, ecart_boutique)
values ('site-a', pg_temp.j(-1), '2', '["a0000000-0000-0000-0000-000000000003"]', -5, -5, now(), 3);
set local role authenticated;
do $$ declare a public.audits_caisse; v timestamptz; begin
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000001');
  v := (pg_temp.audit(pg_temp.j(-1), '2')).valide_le_piste;
  insert into public.audits_caisse (site, date, quart, ecart_piste, ecart_piste_valide, cause_code_piste, valide_le_piste)
  values ('site-a', pg_temp.j(-1), '2', 0, 0, null, v)
  on conflict (site, date, quart) do update set ecart_piste = excluded.ecart_piste, ecart_piste_valide = excluded.ecart_piste_valide,
    cause_code_piste = excluded.cause_code_piste, valide_le_piste = excluded.valide_le_piste;
  a := pg_temp.audit(pg_temp.j(-1), '2');
  perform pg_temp.ok(a.revalidation_requise_piste_le is not null and a.revalidation_requise_boutique_le is null, 'drapeau piste seul');
  perform pg_temp.ok(not (public.ecart_regularisation_etat(a.id, 'piste', null)->>'cloture')::boolean, 'non clôturé tant que non revalidé');
  update public.audits_caisse set valide_le_piste = clock_timestamp() where id = a.id;
  a := pg_temp.audit(pg_temp.j(-1), '2');
  perform pg_temp.ok(a.revalidation_requise_piste_le is null and a.ecart_piste_valide = 0 and a.cause_code_piste is null,
                     'revalidé à 0 € sans motif artificiel');
  perform pg_temp.ok(a.valide_le_boutique is null and a.ecart_boutique = 3 and a.cause_code_boutique is null, 'boutique intacte');
  raise notice 'OK QDEUXSEPT';
end $$;
rollback;

-- 06/10 Q2 (§4) : facture de 58 € confirmée dans la vente, plus une ligne
-- « à vérifier » ; seule la première réduit l'attendu boutique.
begin; \i fixtures.sql
set local role authenticated;
do $$ declare a public.audits_caisse; begin
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000001');
  perform pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('FAC-TEST-58', 58), pg_temp.ligne('FAC-TEST-AV', 20, false)));
  a := pg_temp.audit(pg_temp.j(-2), '2');
  perform pg_temp.ok(a.factures_differees_boutique = 58, 'seule la facture confirmée compte : ' || a.factures_differees_boutique);
  perform pg_temp.ok(jsonb_array_length(a.factures_differees) = 2
                     and a.factures_differees->0->>'auteur_id' = 'a0000000-0000-0000-0000-000000000001', 'auteur réel, ligne conservée');
  perform pg_temp.refus($q$ select pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('FAC-TEST-58', 58), pg_temp.ligne('fac-test-58', 58))) $q$,
                        '[FACTURE_EN_DOUBLE]');
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000003');
  perform pg_temp.refus($q$ select pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('FAC-TEST-59', 59)), d => pg_temp.j(-3)) $q$, 'row-level security');
  raise notice 'OK QDEUXSIX';
end $$;
rollback;
