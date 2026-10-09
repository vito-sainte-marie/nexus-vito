-- Scénarios : chaque bloc part de fixtures neuves et se termine par rollback.
-- Étiquettes en majuscules sans chiffre (lues par executer.sh).
\set ON_ERROR_STOP 0

-- Saisie : le serveur normalise le numéro, pose auteur et horodatage, écarte
-- les clés inconnues et recalcule la somme confirmée.
begin; \i fixtures.sql
do $$ declare a public.audits_caisse; l jsonb; begin
  perform pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne(' fac-test-001 ', 58)
    || '{"auteur_id":"b0000000-0000-0000-0000-000000000001","saisie_le":"2020-01-01","pirate":"x"}'::jsonb));
  a := pg_temp.audit(); l := a.factures_differees->0;
  perform pg_temp.ok(a.factures_differees_boutique = 58, 'somme confirmée : ' || a.factures_differees_boutique);
  perform pg_temp.ok(l->>'numero_facture' = 'FAC-TEST-001', 'numéro normalisé : ' || l::text);
  perform pg_temp.ok(l->>'auteur_id' = 'a0000000-0000-0000-0000-000000000001', 'auteur = l''acteur réel : ' || l::text);
  perform pg_temp.ok((l->>'saisie_le')::timestamptz > now() - interval '1 minute', 'horodatage serveur : ' || l::text);
  perform pg_temp.ok(not (l ? 'pirate') and not (l ? 'modifie_par'), 'clés inconnues écartées : ' || l::text);
  raise notice 'OK SAISIE';
end $$;
rollback;

-- À vérifier : une facture dont la présence dans la vente n'est pas
-- confirmée est conservée mais n'entre dans aucun calcul.
begin; \i fixtures.sql
do $$ declare a public.audits_caisse; begin
  perform pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('FAC-TEST-001', 58), pg_temp.ligne('FAC-TEST-002', 20, false)));
  a := pg_temp.audit();
  perform pg_temp.ok(a.factures_differees_boutique = 58, 'seule la ligne confirmée compte : ' || a.factures_differees_boutique);
  perform pg_temp.ok(jsonb_array_length(a.factures_differees) = 2
                     and (a.factures_differees->1->>'incluse_dans_ventes')::boolean = false, 'ligne à vérifier conservée');
  raise notice 'OK AVERIFIER';
end $$;
rollback;

-- Doublon dans le même quart, même à la casse près.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.refus($q$ select pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('FAC-TEST-001', 58), pg_temp.ligne('fac-test-001', 58))) $q$,
                        '[FACTURE_EN_DOUBLE]');
  raise notice 'OK DOUBLON';
end $$;
rollback;

-- Une facture n'est différée qu'une fois sur la station ; une autre station
-- peut porter le même numéro.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('FAC-TEST-001', 58)));
  perform pg_temp.refus($q$ select pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('fac-test-001', 58)), q => '1') $q$,
                        '[FACTURE_DEJA_SAISIE]');
  raise notice 'OK DEJASAISIE';
end $$;
rollback;

begin; \i fixtures.sql
do $$ begin
  perform pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('FAC-TEST-001', 58)));
  perform pg_temp.qui('b0000000-0000-0000-0000-000000000001');
  perform pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('FAC-TEST-001', 58)), s => 'site-b');
  perform pg_temp.ok((pg_temp.audit(s => 'site-b')).factures_differees_boutique = 58, 'autre station acceptée');
  raise notice 'OK SITES';
end $$;
rollback;

-- Réenregistrer le même quart (upsert de Verify) n'est pas un doublon.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('FAC-TEST-001', 58)));
  perform pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('FAC-TEST-001', 58)));
  perform pg_temp.ok(jsonb_array_length((pg_temp.audit()).factures_differees) = 1, 'une seule ligne');
  raise notice 'OK UPSERT';
end $$;
rollback;

-- Auteur : réenregistrer sans changement ne change ni l'auteur ni rien ;
-- une modification par un autre manager est tracée sans effacer l'auteur.
begin; \i fixtures.sql
do $$ declare l jsonb; s0 text; begin
  perform pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('FAC-TEST-001', 58)));
  s0 := (pg_temp.audit()).factures_differees->0->>'saisie_le';
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000002');
  perform pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('FAC-TEST-001', 58)));
  l := (pg_temp.audit()).factures_differees->0;
  perform pg_temp.ok(l->>'auteur_id' = 'a0000000-0000-0000-0000-000000000001' and l->>'saisie_le' = s0
                     and not (l ? 'modifie_par'), 'réenregistrement neutre : ' || l::text);
  raise notice 'OK AUTEUR';
end $$;
rollback;

begin; \i fixtures.sql
do $$ declare l jsonb; begin
  perform pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('FAC-TEST-001', 58)));
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000002');
  perform pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('FAC-TEST-001', 48)));
  l := (pg_temp.audit()).factures_differees->0;
  perform pg_temp.ok(l->>'auteur_id' = 'a0000000-0000-0000-0000-000000000001'
                     and l->>'modifie_par' = 'a0000000-0000-0000-0000-000000000002'
                     and (pg_temp.audit()).factures_differees_boutique = 48, 'modification tracée : ' || l::text);
  raise notice 'OK MODIFICATION';
end $$;
rollback;

-- Champs obligatoires et montant au centime.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.refus($q$ select pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('F1', 0))) $q$, '[FACTURE_MONTANT_INVALIDE]');
  perform pg_temp.refus($q$ select pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('F1', -5))) $q$, '[FACTURE_MONTANT_INVALIDE]');
  perform pg_temp.refus($q$ select pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('F1', 1.001))) $q$, '[FACTURE_MONTANT_INVALIDE]');
  perform pg_temp.refus($q$ select pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('F1', 1) || '{"montant":"abc"}')) $q$, '[FACTURE_MONTANT_INVALIDE]');
  perform pg_temp.refus($q$ select pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('F1', 1) - 'montant')) $q$, '[FACTURE_MONTANT_INVALIDE]');
  perform pg_temp.refus($q$ select pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('F1', 1, client => '  '))) $q$, '[FACTURE_CLIENT_REQUIS]');
  perform pg_temp.refus($q$ select pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne(' ', 1))) $q$, '[FACTURE_NUMERO_REQUIS]');
  perform pg_temp.refus($q$ select pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('F1', 1) - 'incluse_dans_ventes')) $q$, '[FACTURE_PRESENCE_NON_DITE]');
  perform pg_temp.refus($q$ select pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('F1', 1) || '{"incluse_dans_ventes":"oui"}')) $q$, '[FACTURE_PRESENCE_NON_DITE]');
  raise notice 'OK CHAMPS';
end $$;
rollback;

-- Plafond : les factures confirmées ne dépassent pas la vente boutique ; une
-- facture à vérifier n'y compte pas.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.refus($q$ select pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('F1', 58)), vente => 50) $q$, '[FACTURES_SUPERIEURES_VENTES]');
  perform pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('F1', 58, false)), vente => 50);
  perform pg_temp.ok((pg_temp.audit()).factures_differees_boutique = 0, 'à vérifier hors plafond');
  raise notice 'OK PLAFOND';
end $$;
rollback;

-- La somme n'est jamais crue de l'écran : un forçage direct est recalculé.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.enregistrer(jsonb_build_array(pg_temp.ligne('F1', 58)));
  update public.audits_caisse set factures_differees_boutique = 999 where id = (pg_temp.audit()).id;
  perform pg_temp.ok((pg_temp.audit()).factures_differees_boutique = 58, 'forçage recalculé');
  insert into public.audits_caisse (site, date, quart, vente_boutique, factures_differees_boutique)
    values ('site-a', pg_temp.j(-3), '1', 100, 40);
  perform pg_temp.ok((pg_temp.audit(pg_temp.j(-3), '1')).factures_differees_boutique = 0, 'somme sans facture remise à zéro');
  raise notice 'OK FORCAGE';
end $$;
rollback;

-- Forme : une liste de lignes, rien d'autre.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.refus($q$ select pg_temp.enregistrer('{"numero_facture":"F1"}') $q$, '[FACTURES_FORMAT]');
  perform pg_temp.refus($q$ select pg_temp.enregistrer('[1]') $q$, '[FACTURES_FORMAT]');
  raise notice 'OK FORMAT';
end $$;
rollback;
