
\echo ''
\echo '############################################################'
\echo '#  SECTION 0 — JEU D ESSAI (role postgres, site de test)   #'
\echo '############################################################'

create temporary table ctx (cle text primary key, val text);
grant select, insert, update on ctx to authenticated;

create temporary table snap (etiquette text, n_shifts int, n_cash int, n_evt int, n_audit int, n_dem int);
grant select, insert on snap to authenticated;

-- Deux jeux FDJ pour le site de test : fdj_ecrire_saisies_caisse refuse un
-- game_id qui n appartient pas au site (invalid_parameter_value).
insert into public.fdj_games (id, site, nom, prix, ordre_affichage) values
  ('aaaaaaa1-0000-4000-8000-000000000001','nexus-station-test','JEU TEST 2 EUROS',2.00,1),
  ('aaaaaaa1-0000-4000-8000-000000000002','nexus-station-test','JEU TEST 5 EUROS',5.00,2);

-- Prises de poste. heure_debut choisies pour tomber toutes le 16/09 en heure
-- locale Martinique (UTC-4) : 12:00Z = 08:00 locale, 21:00Z = 17:00 locale.
insert into public.shifts
  (id, employee_id, site, site_id, role_prevu, role, quart, heure_debut, statut, confirmed_by)
values
  ('bbbbbbb1-0000-4000-8000-000000000001','868d0b92-bf65-4c99-be43-656911919afd',
   'nexus-station-test','nexus-station-test','caissiere','caissiere','matin','2026-09-16 12:00:00+00','en_cours','employe'),
  ('bbbbbbb1-0000-4000-8000-000000000005','28810f30-8182-4126-920f-051a4c7cb596',
   'nexus-station-test','nexus-station-test','manager','manager','matin','2026-09-16 12:05:00+00','en_cours','employe'),
  ('bbbbbbb1-0000-4000-8000-000000000003','755a2dc5-3390-4a29-a865-847cbebc1133',
   'nexus-station-test','nexus-station-test','caissiere','caissiere','matin','2026-09-16 13:00:00+00','en_cours','employe');

select 'jeu d essai' as etape,
       (select count(*) from public.fdj_games where site = 'nexus-station-test') as jeux,
       (select count(*) from public.shifts where site_id = 'nexus-station-test' and statut = 'en_cours') as prises_de_poste_actives,
       public.fdj_date_metier('nexus-station-test','2026-09-16 12:00:00+00') as date_metier_pdp_a1,
       public.fdj_numero_quart_depuis_prise_de_poste('matin') as quart_fdj_matin,
       public.fdj_numero_quart_depuis_prise_de_poste('soir') as quart_fdj_soir;

insert into snap values ('avant toute consultation',
  (select count(*) from public.fdj_shifts),
  (select count(*) from public.fdj_cash_controls),
  (select count(*) from public.fdj_caisse_evenements),
  (select count(*) from public.fdj_audit_log),
  (select count(*) from public.fdj_demandes_correction));

\echo ''
\echo '############################################################'
\echo '#  PREUVE 11 (a) — une simple consultation ne cree rien    #'
\echo '############################################################'

select set_config('request.jwt.claims','{"sub":"868d0b92-bf65-4c99-be43-656911919afd","role":"authenticated"}', true) is not null as identite_employe_a;
set local role authenticated;

-- L employe est authentifie, il ouvre son ecran FDJ : il consulte.
select 'P11 consultation employe' as preuve, count(*) as quarts_listes
from public.fdj_mes_quarts_fdj(30);

select 'P11 consultation employe' as preuve, count(*) as demandes_listees
from public.fdj_mes_demandes_correction();

reset role;

insert into snap values ('apres consultation employe',
  (select count(*) from public.fdj_shifts),
  (select count(*) from public.fdj_cash_controls),
  (select count(*) from public.fdj_caisse_evenements),
  (select count(*) from public.fdj_audit_log),
  (select count(*) from public.fdj_demandes_correction));

select 'P11' as preuve, s2.etiquette,
       s2.n_shifts - s1.n_shifts as delta_quarts,
       s2.n_cash   - s1.n_cash   as delta_caisses,
       s2.n_evt    - s1.n_evt    as delta_evenements,
       s2.n_audit  - s1.n_audit  as delta_audit,
       s2.n_dem    - s1.n_dem    as delta_demandes
from snap s1, snap s2
where s1.etiquette = 'avant toute consultation' and s2.etiquette = 'apres consultation employe';

-- Preuve structurelle : les fonctions de lecture sont declarees STABLE,
-- PostgreSQL leur interdit toute ecriture.
select 'P11 volatilite' as preuve, p.proname,
       case p.provolatile when 's' then 'stable (ecriture impossible)'
                          when 'i' then 'immutable' else 'VOLATILE' end as volatilite
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('fdj_ma_caisse','fdj_mes_quarts_fdj','fdj_mes_comptages_caisse',
                    'fdj_mes_corrections_caisse','fdj_mes_demandes_correction',
                    'fdj_chronologie_caisse','fdj_alertes_caisse')
order by p.proname;

\echo ''
\echo '############################################################'
\echo '#  PREUVE 10 — la prise de poste ouvre UN SEUL quart FDJ   #'
\echo '############################################################'

select set_config('request.jwt.claims','{"sub":"868d0b92-bf65-4c99-be43-656911919afd","role":"authenticated"}', true) is not null as identite_employe_a;
set local role authenticated;

select 'P10.1 ouverture naturelle' as preuve,
       r->>'ouvert' as ouvert, r->>'deja_ouvert' as deja_ouvert, r->>'motif' as motif,
       r->>'date' as date_metier, r->>'quart' as quart, r->>'employee_id' as responsable
from (select public.fdj_ouvrir_quart_depuis_prise_de_poste('bbbbbbb1-0000-4000-8000-000000000001') as r) t;

insert into ctx
select 'shift_a', f.id::text from public.fdj_shifts f
where f.prise_de_poste_id = 'bbbbbbb1-0000-4000-8000-000000000001';

select 'P10.2 meme evenement rejoue' as preuve,
       r->>'ouvert' as ouvert, r->>'deja_ouvert' as deja_ouvert, r->>'motif' as motif,
       (r->>'shift_id') = (select val from ctx where cle = 'shift_a') as meme_quart
from (select public.fdj_ouvrir_quart_depuis_prise_de_poste('bbbbbbb1-0000-4000-8000-000000000001') as r) t;

reset role;

-- Deuxieme prise de poste du MEME employe, meme date metier, meme quart.
insert into public.shifts
  (id, employee_id, site, site_id, role_prevu, role, quart, heure_debut, statut, confirmed_by)
values
  ('bbbbbbb1-0000-4000-8000-000000000002','868d0b92-bf65-4c99-be43-656911919afd',
   'nexus-station-test','nexus-station-test','caissiere','caissiere','matin','2026-09-16 16:00:00+00','en_cours','employe');

select set_config('request.jwt.claims','{"sub":"868d0b92-bf65-4c99-be43-656911919afd","role":"authenticated"}', true) is not null as identite_employe_a;
set local role authenticated;

select 'P10.3 nouvelle prise de poste, meme quart' as preuve,
       r->>'ouvert' as ouvert, r->>'deja_ouvert' as deja_ouvert, r->>'motif' as motif,
       (r->>'shift_id') = (select val from ctx where cle = 'shift_a') as meme_quart
from (select public.fdj_ouvrir_quart_depuis_prise_de_poste('bbbbbbb1-0000-4000-8000-000000000002') as r) t;

reset role;

select 'P10.4 unicite' as preuve, f.site, f.date, f.quart, count(*) as quarts_fdj
from public.fdj_shifts f
where f.site = 'nexus-station-test' and f.date = '2026-09-16' and f.quart = '1'
group by f.site, f.date, f.quart;

select 'P10.5 tracabilite' as preuve, f.employee_id = '868d0b92-bf65-4c99-be43-656911919afd' as responsable_est_a,
       f.prise_de_poste_id, f.ouverture_source, f.created_by = f.employee_id as auteur_technique_identique,
       f.statut, f.ouvert_le is not null as ouvert_le_renseigne
from public.fdj_shifts f where f.id = (select val from ctx where cle = 'shift_a')::uuid;

select 'P10.6 rien de fabrique' as preuve,
       (select count(*) from public.fdj_cash_controls c where c.shift_id = (select val from ctx where cle='shift_a')::uuid) as caisses_creees,
       (select count(*) from public.fdj_shift_counts c where c.shift_id = (select val from ctx where cle='shift_a')::uuid) as comptages_crees,
       (select count(*) from public.fdj_reports r where r.shift_id = (select val from ctx where cle='shift_a')::uuid) as rapports_crees,
       (select count(*) from public.fdj_releves_cloture r where r.shift_id = (select val from ctx where cle='shift_a')::uuid) as releves_crees;

\echo ''
\echo '--- P10.7 : ce qui N OUVRE PAS de quart FDJ ---'

select set_config('request.jwt.claims','{"sub":"28810f30-8182-4126-920f-051a4c7cb596","role":"authenticated"}', true) is not null as identite_manager;
set local role authenticated;

select 'P10.7 prise de poste manageriale' as preuve,
       r->>'ouvert' as ouvert, r->>'motif' as motif, r->>'message' as message
from (select public.fdj_ouvrir_quart_depuis_prise_de_poste('bbbbbbb1-0000-4000-8000-000000000005') as r) t;

reset role;
select set_config('request.jwt.claims','{"sub":"755a2dc5-3390-4a29-a865-847cbebc1133","role":"authenticated"}', true) is not null as identite_employe_b;
set local role authenticated;

select 'P10.8 quart deja tenu par un autre' as preuve,
       r->>'ouvert' as ouvert, r->>'conflit' as conflit, r->>'motif' as motif,
       r->>'responsable_actuel_id' = '868d0b92-bf65-4c99-be43-656911919afd' as responsable_reste_a,
       r->>'message' as message
from (select public.fdj_ouvrir_quart_depuis_prise_de_poste('bbbbbbb1-0000-4000-8000-000000000003') as r) t;

do $$
declare v_msg text;
begin
  begin
    perform public.fdj_ouvrir_quart_depuis_prise_de_poste('bbbbbbb1-0000-4000-8000-000000000001');
    raise exception 'ECHEC DE LA PREUVE P10.9 : B a pu utiliser la prise de poste de A';
  exception when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P10.9 OK — refus attendu : %', v_msg;
  end;
end $$;

reset role;

select 'P10.10 aucun quart en trop' as preuve, count(*) as quarts_fdj_du_site
from public.fdj_shifts where site = 'nexus-station-test';

-- Un quart DIFFERENT (quart 2) reste ouvrable par B : la regle porte sur
-- (site, date, numero de quart), elle ne bloque pas le service suivant.
insert into public.shifts
  (id, employee_id, site, site_id, role_prevu, role, quart, heure_debut, statut, confirmed_by)
values
  ('bbbbbbb1-0000-4000-8000-000000000004','755a2dc5-3390-4a29-a865-847cbebc1133',
   'nexus-station-test','nexus-station-test','caissiere','caissiere','soir','2026-09-16 21:00:00+00','en_cours','employe');

select set_config('request.jwt.claims','{"sub":"755a2dc5-3390-4a29-a865-847cbebc1133","role":"authenticated"}', true) is not null as identite_employe_b;
set local role authenticated;

select 'P10.11 quart 2 ouvrable par B' as preuve,
       r->>'ouvert' as ouvert, r->>'motif' as motif, r->>'quart' as quart,
       r->>'employee_id' = '755a2dc5-3390-4a29-a865-847cbebc1133' as responsable_est_b
from (select public.fdj_ouvrir_quart_depuis_prise_de_poste('bbbbbbb1-0000-4000-8000-000000000004') as r) t;

reset role;

\echo ''
\echo '############################################################'
\echo '#  PREUVE 12 — l ecart provisoire apparait APRES la        #'
\echo '#               confirmation, jamais avant                 #'
\echo '############################################################'

select set_config('request.jwt.claims','{"sub":"868d0b92-bf65-4c99-be43-656911919afd","role":"authenticated"}', true) is not null as identite_employe_a;
set local role authenticated;

select 'P12.1 avant toute saisie' as preuve,
       r->>'etape' as etape, r->>'ecart_etabli' as ecart_etabli,
       r->'ecart_provisoire' as ecart_provisoire, r->'libelle_ecart' as libelle_ecart,
       r->>'message' as message
from (select public.fdj_ma_caisse((select val from ctx where cle='shift_a')::uuid) as r) t;

select 'P12.2 brouillon enregistre' as preuve,
       r->>'enregistre' as enregistre, r->>'statut' as statut, r->>'message' as message
from (select public.fdj_enregistrer_brouillon_caisse(
        (select val from ctx where cle='shift_a')::uuid,
        '[{"game_id":"aaaaaaa1-0000-4000-8000-000000000001","stock_initial":100,"appro":0,"stock_final":80},
          {"game_id":"aaaaaaa1-0000-4000-8000-000000000002","stock_initial":50,"appro":10,"stock_final":40}]'::jsonb,
        30, 200, 292, 0) as r) t;

select 'P12.3 apres brouillon, toujours rien d etabli' as preuve,
       r->>'etape' as etape, r->>'ecart_etabli' as ecart_etabli,
       r->'ecart_provisoire' as ecart_provisoire, r->'libelle_ecart' as libelle_ecart,
       r->'aide_a_la_saisie'->>'total_attendu' as aide_total_attendu,
       r->'aide_a_la_saisie'->>'difference_de_comptage' as aide_difference,
       (r ? 'ecart') as cle_ecart_presente
from (select public.fdj_ma_caisse((select val from ctx where cle='shift_a')::uuid) as r) t;

select 'P12.4 confirmation' as preuve,
       r->>'confirme' as confirme, r->>'idempotent' as idempotent, r->>'version' as version,
       r->>'ecart_provisoire' as ecart_provisoire,
       r->>'en_attente_controle_manager' as en_attente, r->>'message' as message
from (select public.fdj_confirmer_caisse(
        (select val from ctx where cle='shift_a')::uuid,
        '[{"game_id":"aaaaaaa1-0000-4000-8000-000000000001","stock_initial":100,"appro":0,"stock_final":80},
          {"game_id":"aaaaaaa1-0000-4000-8000-000000000002","stock_initial":50,"appro":10,"stock_final":40}]'::jsonb,
        30, 200, 292, 0) as r) t;

select 'P12.5 apres confirmation' as preuve,
       r->>'etape' as etape, r->>'ecart_etabli' as ecart_etabli,
       r->>'ecart_provisoire' as ecart_provisoire, r->'ecart_retenu' as ecart_retenu,
       r->>'libelle_ecart' as libelle_ecart, r->>'message' as message,
       r->>'correction_possible' as correction_possible, r->>'signalement_possible' as signalement_possible,
       r->'confirmation_initiale'->>'caisse_reelle' as confirmation_initiale_reelle,
       r->'confirmation_initiale'->>'ecart' as confirmation_initiale_ecart
from (select public.fdj_ma_caisse((select val from ctx where cle='shift_a')::uuid) as r) t;

select 'P12.6 confirmation rejouee' as preuve,
       r->>'confirme' as confirme, r->>'idempotent' as idempotent, r->>'version' as version
from (select public.fdj_confirmer_caisse(
        (select val from ctx where cle='shift_a')::uuid,
        '[{"game_id":"aaaaaaa1-0000-4000-8000-000000000001","stock_initial":100,"appro":0,"stock_final":80},
          {"game_id":"aaaaaaa1-0000-4000-8000-000000000002","stock_initial":50,"appro":10,"stock_final":40}]'::jsonb,
        30, 200, 292, 0) as r) t;

reset role;

select 'P12.7 etat en base' as preuve, c.statut, c.version, c.nb_corrections,
       c.caisse_attendue, c.caisse_reelle, c.ecart,
       c.confirme_le is not null as confirme, c.valide_le is null as non_validee,
       c.saisi_par = '868d0b92-bf65-4c99-be43-656911919afd' as saisie_par_a
from public.fdj_cash_controls c where c.shift_id = (select val from ctx where cle='shift_a')::uuid;

\echo ''
\echo '############################################################'
\echo '#  PREUVE 13 — une correction AVANT validation est tracee  #'
\echo '############################################################'

select set_config('request.jwt.claims','{"sub":"868d0b92-bf65-4c99-be43-656911919afd","role":"authenticated"}', true) is not null as identite_employe_a;
set local role authenticated;

select 'P13.1 correction' as preuve,
       r->>'corrige' as corrige, r->>'version' as version, r->>'nb_corrections' as nb_corrections,
       r->>'ecart_avant' as ecart_avant, r->>'ecart_apres' as ecart_apres, r->>'message' as message
from (select public.fdj_corriger_caisse_confirmee(
        (select val from ctx where cle='shift_a')::uuid,
        'Erreur de comptage sur le jeu a 5 euros',
        'Stock final recompte',
        null, null, null, 310, 0) as r) t;

select 'P13.2 la premiere confirmation survit' as preuve,
       r->>'ecart_provisoire' as ecart_provisoire, r->>'libelle_ecart' as libelle_ecart,
       r->'confirmation_initiale'->>'caisse_reelle' as premiere_caisse_reelle,
       r->'confirmation_initiale'->>'ecart' as premier_ecart,
       r->>'version' as version, r->>'nb_corrections' as nb_corrections
from (select public.fdj_ma_caisse((select val from ctx where cle='shift_a')::uuid) as r) t;

select 'P13.3 historique rendu a l employe' as preuve, *
from public.fdj_mes_corrections_caisse((select val from ctx where cle='shift_a')::uuid);

reset role;

select 'P13.4 journal (lecture postgres : ferme a authenticated)' as preuve,
       e.evenement, e.auteur_role,
       e.auteur_id = '868d0b92-bf65-4c99-be43-656911919afd' as auteur_est_a,
       e.employe_responsable_id = '868d0b92-bf65-4c99-be43-656911919afd' as responsable_est_a,
       e.version_apres, e.statut_avant, e.statut_apres, e.motif
from public.fdj_caisse_evenements e
where e.shift_id = (select val from ctx where cle='shift_a')::uuid
order by e.survenu_le, e.id;

select 'P13.5 contrainte version = nb_corrections + 1' as preuve,
       c.version, c.nb_corrections, c.version = c.nb_corrections + 1 as coherent,
       c.caisse_reelle_origine, c.ecart_origine, c.caisse_reelle, c.ecart,
       c.derniere_correction_le is not null as correction_datee
from public.fdj_cash_controls c where c.shift_id = (select val from ctx where cle='shift_a')::uuid;

\echo ''
\echo '############################################################'
\echo '#  PREUVE 15 — seul le manager valide                      #'
\echo '############################################################'

select set_config('request.jwt.claims','{"sub":"868d0b92-bf65-4c99-be43-656911919afd","role":"authenticated"}', true) is not null as identite_employe_a;
set local role authenticated;

do $$
declare v_shift uuid := (select val from ctx where cle='shift_a')::uuid; v_msg text;
begin
  begin
    perform public.fdj_valider_caisse(v_shift, 'conforme');
    raise exception 'ECHEC DE LA PREUVE P15.1 : l employe a pu valider sa propre caisse';
  exception when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P15.1 OK — l employe ne valide pas sa caisse : %', v_msg;
  end;
  begin
    perform public.fdj_ouvrir_controle_caisse(v_shift);
    raise exception 'ECHEC DE LA PREUVE P15.2 : l employe a pu ouvrir le controle';
  exception when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P15.2 OK — l employe n ouvre pas le controle : %', v_msg;
  end;
end $$;

reset role;
select set_config('request.jwt.claims','{"sub":"755a2dc5-3390-4a29-a865-847cbebc1133","role":"authenticated"}', true) is not null as identite_employe_b;
set local role authenticated;

do $$
declare v_shift uuid := (select val from ctx where cle='shift_a')::uuid; v_msg text;
begin
  begin
    perform public.fdj_valider_caisse(v_shift, 'conforme');
    raise exception 'ECHEC DE LA PREUVE P15.3 : un collegue a pu valider';
  exception when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P15.3 OK — un collegue ne valide pas : %', v_msg;
  end;
  begin
    perform public.fdj_corriger_caisse_confirmee(v_shift, 'tentative de correction par un collegue');
    raise exception 'ECHEC DE LA PREUVE P15.4 : un collegue a pu corriger la caisse d un autre';
  exception when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P15.4 OK — un collegue ne corrige pas : %', v_msg;
  end;
  begin
    perform public.fdj_ma_caisse(v_shift);
    raise exception 'ECHEC DE LA PREUVE P15.5 : un collegue a pu lire la caisse d un autre';
  exception when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P15.5 OK — un collegue ne lit pas la caisse d un autre : %', v_msg;
  end;
end $$;

reset role;
select set_config('request.jwt.claims','{"sub":"28810f30-8182-4126-920f-051a4c7cb596","role":"authenticated"}', true) is not null as identite_manager;
set local role authenticated;

select 'P15.6 ouverture du controle par le manager' as preuve,
       r->>'controle_ouvert' as controle_ouvert, r->>'idempotent' as idempotent,
       r->>'ecart' as ecart, r->>'libelle_ecart' as libelle_ecart_manager
from (select public.fdj_ouvrir_controle_caisse((select val from ctx where cle='shift_a')::uuid) as r) t;

select 'P15.7 validation par le manager' as preuve,
       r->>'valide' as valide, r->>'idempotent' as idempotent,
       r->>'resultat_controle' as resultat, r->>'statut' as statut
from (select public.fdj_valider_caisse((select val from ctx where cle='shift_a')::uuid, 'conforme') as r) t;

select 'P15.8 validation rejouee' as preuve,
       r->>'valide' as valide, r->>'idempotent' as idempotent
from (select public.fdj_valider_caisse((select val from ctx where cle='shift_a')::uuid, 'conforme') as r) t;

reset role;

select 'P15.9 etat en base' as preuve, c.statut, c.resultat_controle,
       c.valide_par = '28810f30-8182-4126-920f-051a4c7cb596' as valide_par_le_manager,
       c.controle_par = '28810f30-8182-4126-920f-051a4c7cb596' as controle_par_le_manager,
       c.valide_le is not null as validee,
       c.saisi_par = '868d0b92-bf65-4c99-be43-656911919afd' as saisie_toujours_imputee_a_a
from public.fdj_cash_controls c where c.shift_id = (select val from ctx where cle='shift_a')::uuid;

\echo ''
\echo '############################################################'
\echo '#  PREUVE 14 — apres validation, la correction est refusee #'
\echo '############################################################'

create temporary table fige as
select version, nb_corrections, caisse_reelle, ecart, statut, resultat_controle,
       valide_par, valide_le, caisse_reelle_origine, ecart_origine
from public.fdj_cash_controls where shift_id = (select val from ctx where cle='shift_a')::uuid;

select set_config('request.jwt.claims','{"sub":"868d0b92-bf65-4c99-be43-656911919afd","role":"authenticated"}', true) is not null as identite_employe_a;
set local role authenticated;

select 'P14.1 correction refusee' as preuve,
       r->>'corrige' as corrige, r->>'motif' as motif, r->>'message' as message
from (select public.fdj_corriger_caisse_confirmee(
        (select val from ctx where cle='shift_a')::uuid,
        'Je veux changer ma caisse apres validation', null,
        null, null, null, 999, null) as r) t;

select 'P14.2 brouillon refuse lui aussi' as preuve,
       r->>'enregistre' as enregistre, r->>'motif' as motif
from (select public.fdj_enregistrer_brouillon_caisse(
        (select val from ctx where cle='shift_a')::uuid, null, null, null, 999, 0) as r) t;

select 'P14.3 le seul recours : signaler' as preuve,
       r->>'signale' as signale, r->>'idempotent' as idempotent, r->>'message' as message
from (select public.fdj_signaler_erreur_apres_validation(
        (select val from ctx where cle='shift_a')::uuid,
        'Je pense avoir inverse deux stocks finaux, merci de verifier.') as r) t;

select 'P14.4 signalement rejoue' as preuve,
       r->>'signale' as signale, r->>'idempotent' as idempotent
from (select public.fdj_signaler_erreur_apres_validation(
        (select val from ctx where cle='shift_a')::uuid,
        'Je pense avoir inverse deux stocks finaux, merci de verifier.') as r) t;

do $$
declare v_shift uuid := (select val from ctx where cle='shift_a')::uuid; v_msg text;
begin
  begin
    perform public.fdj_signaler_erreur_apres_validation(v_shift, 'trop');
    raise exception 'ECHEC DE LA PREUVE P14.5 : un message vide a ete accepte';
  exception when invalid_parameter_value then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P14.5 OK — message trop court refuse : %', v_msg;
  end;
  begin
    perform public.fdj_rouvrir_caisse(v_shift, 'je rouvre moi-meme ma caisse');
    raise exception 'ECHEC DE LA PREUVE P14.6 : l employe a pu rouvrir sa caisse';
  exception when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P14.6 OK — l employe ne rouvre pas : %', v_msg;
  end;
end $$;

reset role;

select 'P14.7 aucune valeur validee n a bouge' as preuve,
       count(*) filter (where a.version is distinct from b.version
                          or a.nb_corrections is distinct from b.nb_corrections
                          or a.caisse_reelle is distinct from b.caisse_reelle
                          or a.ecart is distinct from b.ecart
                          or a.statut is distinct from b.statut
                          or a.resultat_controle is distinct from b.resultat_controle
                          or a.valide_par is distinct from b.valide_par
                          or a.valide_le is distinct from b.valide_le
                          or a.caisse_reelle_origine is distinct from b.caisse_reelle_origine
                          or a.ecart_origine is distinct from b.ecart_origine) as colonnes_modifiees
from fige a, public.fdj_cash_controls b
where b.shift_id = (select val from ctx where cle='shift_a')::uuid;

select 'P14.8 demande enregistree' as preuve, d.statut, d.message,
       d.demandeur_id = '868d0b92-bf65-4c99-be43-656911919afd' as demandeur_est_a, count(*) over () as nb_demandes
from public.fdj_demandes_correction d
where d.shift_id = (select val from ctx where cle='shift_a')::uuid;

\echo ''
\echo '############################################################'
\echo '#  PREUVE 16 — auteur de saisie et employe operationnel    #'
\echo '#               restent deux notions distinctes            #'
\echo '############################################################'

select 'P16.1 journal : auteur <> responsable' as preuve,
       e.evenement, e.auteur_role,
       case e.auteur_id when '868d0b92-bf65-4c99-be43-656911919afd' then 'employe A'
                        when '28810f30-8182-4126-920f-051a4c7cb596' then 'manager' else 'autre' end as auteur,
       case e.employe_responsable_id when '868d0b92-bf65-4c99-be43-656911919afd' then 'employe A'
                        when '28810f30-8182-4126-920f-051a4c7cb596' then 'manager' else 'autre' end as responsable_operationnel,
       e.auteur_id is distinct from e.employe_responsable_id as deux_personnes_distinctes
from public.fdj_caisse_evenements e
where e.shift_id = (select val from ctx where cle='shift_a')::uuid
order by e.survenu_le, e.id;

select 'P16.2 caisse : saisi_par <> valide_par' as preuve,
       c.saisi_par = '868d0b92-bf65-4c99-be43-656911919afd' as saisie_par_a,
       c.valide_par = '28810f30-8182-4126-920f-051a4c7cb596' as validee_par_le_manager,
       c.controle_par = '28810f30-8182-4126-920f-051a4c7cb596' as controlee_par_le_manager,
       c.saisi_par is distinct from c.valide_par as colonnes_distinctes
from public.fdj_cash_controls c where c.shift_id = (select val from ctx where cle='shift_a')::uuid;

select 'P16.3 quart : created_by <> employee_id possible' as preuve,
       f.employee_id = '868d0b92-bf65-4c99-be43-656911919afd' as responsable_est_a,
       f.created_by = '868d0b92-bf65-4c99-be43-656911919afd' as cree_par_a,
       f.ouverture_source
from public.fdj_shifts f where f.id = (select val from ctx where cle='shift_a')::uuid;

select set_config('request.jwt.claims','{"sub":"28810f30-8182-4126-920f-051a4c7cb596","role":"authenticated"}', true) is not null as identite_manager;
set local role authenticated;

select 'P16.4 transfert explicite' as preuve,
       r->>'transfere' as transfere,
       r->>'responsable_precedent_id' = '868d0b92-bf65-4c99-be43-656911919afd' as precedent_est_a,
       r->>'responsable_id' = '755a2dc5-3390-4a29-a865-847cbebc1133' as nouveau_est_b
from (select public.fdj_transferer_responsabilite_quart(
        (select val from ctx where cle='shift_a')::uuid,
        '755a2dc5-3390-4a29-a865-847cbebc1133',
        'Reprise du quart : l employe A a quitte le site avant la fin du service.') as r) t;

reset role;

select 'P16.5 apres transfert' as preuve,
       f.employee_id = '755a2dc5-3390-4a29-a865-847cbebc1133' as responsable_est_b,
       f.responsable_precedent_id = '868d0b92-bf65-4c99-be43-656911919afd' as precedent_est_a,
       f.responsable_transfere_par = '28810f30-8182-4126-920f-051a4c7cb596' as transfere_par_le_manager,
       f.responsable_transfere_le is not null as horodate,
       f.motif_transfert,
       f.created_by = '868d0b92-bf65-4c99-be43-656911919afd' as auteur_de_creation_inchange
from public.fdj_shifts f where f.id = (select val from ctx where cle='shift_a')::uuid;

select 'P16.6 journal du transfert' as preuve, a.action, a.motif,
       a.acteur_id = '28810f30-8182-4126-920f-051a4c7cb596' as acteur_est_le_manager
from public.fdj_audit_log a
where a.shift_id = (select val from ctx where cle='shift_a')::uuid
  and a.action = 'fdj_quart_responsabilite_transferee';

\echo ''
\echo '############################################################'
\echo '#  PREUVE 11 (b) — la consultation du manager ne cree rien #'
\echo '############################################################'

insert into snap values ('avant consultation manager',
  (select count(*) from public.fdj_shifts),
  (select count(*) from public.fdj_cash_controls),
  (select count(*) from public.fdj_caisse_evenements),
  (select count(*) from public.fdj_audit_log),
  (select count(*) from public.fdj_demandes_correction));

select set_config('request.jwt.claims','{"sub":"794c3e91-c9ec-48f8-b7be-f7b97c483d40","role":"authenticated"}', true) is not null as identite_second_manager;
set local role authenticated;

select 'P11 chronologie (consultation manager)' as preuve, count(*) as lignes
from public.fdj_chronologie_caisse((select val from ctx where cle='shift_a')::uuid);

select 'P11 alertes (consultation manager)' as preuve,
       r->'indicateurs'->>'corrigee_apres_confirmation' as corrigee_apres_confirmation,
       r->'indicateurs'->>'corrections_successives'     as corrections_successives,
       r->'indicateurs'->>'variation_importante'        as variation_importante,
       r->'indicateurs'->>'variation_maximale_euros'    as variation_maximale_euros,
       r->'indicateurs'->>'signalements_apres_validation' as signalements_apres_validation,
       r->>'avertissement' as avertissement
from (select public.fdj_alertes_caisse((select val from ctx where cle='shift_a')::uuid) as r) t;

reset role;

insert into snap values ('apres consultation manager',
  (select count(*) from public.fdj_shifts),
  (select count(*) from public.fdj_cash_controls),
  (select count(*) from public.fdj_caisse_evenements),
  (select count(*) from public.fdj_audit_log),
  (select count(*) from public.fdj_demandes_correction));

select 'P11b' as preuve,
       s2.n_shifts - s1.n_shifts as delta_quarts,
       s2.n_cash   - s1.n_cash   as delta_caisses,
       s2.n_evt    - s1.n_evt    as delta_evenements,
       s2.n_audit  - s1.n_audit  as delta_audit,
       s2.n_dem    - s1.n_dem    as delta_demandes
from snap s1, snap s2
where s1.etiquette = 'avant consultation manager' and s2.etiquette = 'apres consultation manager';

\echo ''
\echo '============================================================'
\echo '=  FIN DES PREUVES — ANNULATION DE LA TRANSACTION          ='
\echo '============================================================'

select 'BILAN — quarts FDJ du site de test' as bilan, f.quart, f.date, f.statut,
       f.ouverture_source,
       case f.employee_id when '868d0b92-bf65-4c99-be43-656911919afd' then 'employe A'
                          when '755a2dc5-3390-4a29-a865-847cbebc1133' then 'employe B'
                          when '28810f30-8182-4126-920f-051a4c7cb596' then 'manager' else 'autre' end as responsable
from public.fdj_shifts f where f.site = 'nexus-station-test' order by f.quart, f.date;

select 'BILAN — journal des evenements' as bilan, e.evenement, e.auteur_role,
       e.version_avant, e.version_apres, e.ecart_avant, e.ecart_apres, e.motif
from public.fdj_caisse_evenements e
where e.shift_id = (select val from ctx where cle='shift_a')::uuid
order by e.survenu_le, e.id;

select 'BILAN — journal d audit' as bilan, a.action, count(*) as n
from public.fdj_audit_log a group by a.action order by a.action;

rollback;

\echo ''
\echo '############################################################'
\echo '#  APRES ROLLBACK — la base de Test est revenue a son etat  #'
\echo '#  initial : aucune donnee de recette ne subsiste.          #'
\echo '############################################################'

select 'POST-ROLLBACK' as controle,
       (select count(*) from public.fdj_shifts)                                        as fdj_shifts_attendu_0,
       (select count(*) from public.fdj_cash_controls)                                 as fdj_cash_controls_attendu_0,
       to_regclass('public.fdj_caisse_evenements') is null                             as journal_caisse_disparu,
       to_regclass('public.fdj_demandes_correction') is null                           as demandes_correction_disparues,
       (select count(*) from public.fdj_audit_log)                                     as fdj_audit_log_attendu_0,
       (select count(*) from public.fdj_games where site = 'nexus-station-test')        as fdj_games_test_attendu_0,
       (select count(*) from public.shifts)                                            as shifts_attendu_47;

select 'POST-ROLLBACK — les fonctions de la Vague 1 n existent plus sur Test' as controle,
       count(*) as fonctions_fdj_vague1_attendu_0
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('fdj_ouvrir_quart_depuis_prise_de_poste','fdj_confirmer_caisse',
                    'fdj_corriger_caisse_confirmee','fdj_valider_caisse','fdj_ma_caisse');

\echo ''
\echo '============================================================'
\echo '=  RECETTE TERMINEE — TRANSACTION ANNULEE                   ='
\echo '=  Aucune migration appliquee, aucune donnee conservee.     ='
\echo '============================================================'
