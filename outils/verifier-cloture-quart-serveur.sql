-- Épreuves de la clôture serveur du quart d'inventaire
-- (migration 20261103190000, lot INVENTAIRE-CAISSE-RENFORT-20261102, request-15).
-- À exécuter sur nexus-test UNIQUEMENT, jamais en Production.
-- Hors suite de tests : run-tests.js n'accède à aucun réseau.
--
-- Rien n'est conservé : tout le scénario s'exécute dans un bloc DO qui se
-- termine par une exception portant le rapport, donc par un rollback complet.
-- Le « succès » de ce fichier est donc une ERREUR dont le message commence par
-- « RAPPORT » et dont le détail liste chaque épreuve (ok / ECHEC).
-- Site d'essai : site-fantome-test (fuseau America/Martinique). Les dates sont
-- relatives à aujourd'hui (T), jamais figées : T-2/T-1 sont échues, T+1 et au-delà
-- ne le sont pas (la fonction n'a pas de borne haute de date).

do $epreuves$
declare
  v_site constant text := 'site-fantome-test';
  v_tz constant text := 'America/Martinique';
  t date := (now() at time zone 'America/Martinique')::date;
  e1 uuid := '7d3b0a51-0000-4a00-9000-000000000001';
  e2 uuid := gen_random_uuid();
  e3 uuid := gen_random_uuid();
  q record; v_id uuid; v_plan uuid; v_n int; v_md5_avant text; v_md5_apres text;
  v_divergente uuid; v_rapport jsonb;
  qa uuid; qb uuid; qc uuid; qd uuid; qe uuid; qf uuid; qg uuid; qh uuid; qi uuid;
  sh_a1 uuid; sh_a2 uuid; sh_b1 uuid; sh_b2 uuid; sh_d uuid; sh_e1 uuid; sh_e2 uuid;
  v_depart1 timestamptz; v_depart2 timestamptz;
  v_produits uuid[];
begin
  create temp table _r (nom text, ok boolean, detail text) on commit drop;

  insert into employees (id, username, nom, role, site_id) values
    (e2, 'epreuve-cloture-e2', 'Épreuve E2', 'pompiste', v_site),
    (e3, 'epreuve-cloture-e3', 'Épreuve E3', 'pompiste', v_site);

  select array_agg(id) into v_produits from (select id from inventaire_zone_produit order by id limit 4) z;

  -- Photographie des lignes employé existantes : la fonction n'en corrige aucune.
  select md5(coalesce(string_agg(x::text, '|' order by x.id), '')) into v_md5_avant
    from inventaire_quart_employes x where x.quart_id not in (select id from inventaire_quarts where site = v_site);

  -- ── Fixtures ──────────────────────────────────────────────────────────
  -- A (T+1 matin) : deux employés du quart, les deux ont validé -> clôture anticipée.
  insert into inventaire_quarts (site, date, quart, statut, ouvert_le) values (v_site, t+1, 'matin', 'ouvert', now()) returning id into qa;
  insert into shifts (employee_id, site, site_id, role, quart, statut, cloture_source, cloture_le) values (e1, v_site, v_site, 'caissiere', 'matin', 'test', 'test', now()) returning id into sh_a1;
  insert into shifts (employee_id, site, site_id, role, quart, statut, cloture_source, cloture_le) values (e2, v_site, v_site, 'pompiste', 'matin', 'test', 'test', now()) returning id into sh_a2;
  v_depart1 := now() - interval '3 hours'; v_depart2 := now() - interval '90 minutes';
  insert into inventaire_quart_employes (quart_id, employee_id, shift_id, heure_depart, a_valide_cloture) values
    (qa, e1, sh_a1, v_depart1, true), (qa, e2, sh_a2, v_depart2, true);

  -- B (T+1 soir) : deux employés, un seul a validé -> reste ouvert.
  insert into inventaire_quarts (site, date, quart, statut, ouvert_le) values (v_site, t+1, 'soir', 'ouvert', now()) returning id into qb;
  insert into shifts (employee_id, site, site_id, role, quart, statut, cloture_source, cloture_le) values (e1, v_site, v_site, 'caissiere', 'soir', 'test', 'test', now()) returning id into sh_b1;
  insert into shifts (employee_id, site, site_id, role, quart, statut, cloture_source, cloture_le) values (e2, v_site, v_site, 'pompiste', 'soir', 'test', 'test', now()) returning id into sh_b2;
  insert into inventaire_quart_employes (quart_id, employee_id, shift_id, heure_depart, a_valide_cloture) values
    (qb, e1, sh_b1, now(), true), (qb, e2, sh_b2, null, false);

  -- C (T+2 matin) : population vide -> aucune clôture anticipée.
  insert into inventaire_quarts (site, date, quart, statut, ouvert_le) values (v_site, t+2, 'matin', 'ouvert', now()) returning id into qc;

  -- D (T+3 matin) : une seule ligne, rattachée à un shift de l'AUTRE quart (soir) et validée
  --     -> population 0 : la ligne divergente ne déclenche rien et n'est pas déplacée.
  insert into inventaire_quarts (site, date, quart, statut, ouvert_le) values (v_site, t+3, 'matin', 'ouvert', now()) returning id into qd;
  insert into shifts (employee_id, site, site_id, role, quart, statut, cloture_source, cloture_le) values (e3, v_site, v_site, 'pompiste', 'soir', 'test', 'test', now()) returning id into sh_d;
  insert into inventaire_quart_employes (quart_id, employee_id, shift_id, heure_depart, a_valide_cloture) values (qd, e3, sh_d, now(), true) returning id into v_divergente;

  -- E (T+4 matin) : une ligne du quart validée + une ligne divergente non validée
  --     -> clôture anticipée sur la seule population (1), 1 ligne divergente consignée.
  insert into inventaire_quarts (site, date, quart, statut, ouvert_le) values (v_site, t+4, 'matin', 'cloture_en_cours', now()) returning id into qe;
  insert into shifts (employee_id, site, site_id, role, quart, statut, cloture_source, cloture_le) values (e1, v_site, v_site, 'caissiere', 'matin', 'test', 'test', now()) returning id into sh_e1;
  insert into shifts (employee_id, site, site_id, role, quart, statut, cloture_source, cloture_le) values (e3, v_site, v_site, 'pompiste', 'soir', 'test', 'test', now()) returning id into sh_e2;
  insert into inventaire_quart_employes (quart_id, employee_id, shift_id, heure_depart, a_valide_cloture) values
    (qe, e1, sh_e1, now() - interval '1 hour', true), (qe, e3, sh_e2, null, false);

  -- F (T-1 matin) : échu, personne n'a validé -> repli à 13:00 + 30 min exactement.
  --     Plan : 2 obligatoires non comptés, 1 obligatoire fait, 1 non obligatoire non compté.
  insert into inventaire_quarts (site, date, quart, statut, ouvert_le) values (v_site, t-1, 'matin', 'ouvert', now() - interval '1 day') returning id into qf;
  insert into inventaire_plans_comptage (site, date, quart, statut, socle_cible, surprises_cible) values (v_site, t-1, 'matin', 'genere', 0, 0) returning id into v_plan;
  insert into inventaire_plan_items (plan_id, site, produit_id, raison_selection, obligatoire, ordre, statut) values
    (v_plan, v_site, v_produits[1], 'critique', true, 1, 'a_faire'),
    (v_plan, v_site, v_produits[2], 'critique', true, 2, 'a_faire'),
    (v_plan, v_site, v_produits[3], 'critique', true, 3, 'fait'),
    (v_plan, v_site, v_produits[4], 'surprise', false, 4, 'a_faire');

  -- G (T-1 soir) : échu, pas de plan -> repli à 20:00 + 30 min, aucune alerte d'incomplétude.
  insert into inventaire_quarts (site, date, quart, statut, ouvert_le) values (v_site, t-1, 'soir', 'ouvert', now() - interval '1 day') returning id into qg;

  -- H (T-2 matin) : déjà clos, cloture_le arbitraire -> intact, aucun audit.
  insert into inventaire_quarts (site, date, quart, statut, ouvert_le, cloture_le) values (v_site, t-2, 'matin', 'cloture', now() - interval '2 days', '2000-01-01 00:00:00+00') returning id into qh;

  -- I (T-2 soir) : échu mais en 'ouverture_en_cours' -> garde de statut : pas de clôture,
  --     seulement l'alerte de retard, une seule même après deux passages.
  insert into inventaire_quarts (site, date, quart, statut, ouvert_le) values (v_site, t-2, 'soir', 'ouverture_en_cours', now() - interval '2 days') returning id into qi;

  -- ── Deux passages de la fonction (l'unicité des alertes se juge au second) ──
  perform public.run_scheduled_inventory_reviews();
  perform public.run_scheduled_inventory_reviews();

  -- ── Verdicts ──────────────────────────────────────────────────────────
  select * into q from inventaire_quarts where id = qa;
  insert into _r values ('A anticipée : statut cloture', q.statut = 'cloture', q.statut);
  insert into _r values ('A anticipée : cloture_le = dernier heure_depart', q.cloture_le = v_depart2, q.cloture_le::text);
  insert into _r select 'A anticipée : audit mode=anticipee, population=2, validees=2',
    exists(select 1 from inventaire_audit_log where quart_id = qa and action = 'cloture_serveur'
           and metadata->>'mode' = 'anticipee' and (metadata->>'population')::int = 2 and (metadata->>'validees')::int = 2), null;
  select count(*) into v_n from inventaire_audit_log where quart_id = qa and action = 'cloture_serveur';
  insert into _r values ('A anticipée : un seul audit après deux passages', v_n = 1, v_n::text);

  select * into q from inventaire_quarts where id = qb;
  insert into _r values ('B partielle : reste ouvert', q.statut = 'ouvert' and q.cloture_le is null, q.statut);

  select * into q from inventaire_quarts where id = qc;
  insert into _r values ('C population vide : reste ouvert', q.statut = 'ouvert' and q.cloture_le is null, q.statut);

  select * into q from inventaire_quarts where id = qd;
  insert into _r values ('D ligne seulement divergente : reste ouvert', q.statut = 'ouvert' and q.cloture_le is null, q.statut);
  insert into _r select 'D la ligne divergente n''est pas déplacée', exists(select 1 from inventaire_quart_employes where id = v_divergente and quart_id = qd and shift_id = sh_d and a_valide_cloture), null;

  select * into q from inventaire_quarts where id = qe;
  insert into _r values ('E mixte : clôturé sur la seule population', q.statut = 'cloture', q.statut);
  insert into _r select 'E audit : population=1, validees=1, lignes_divergentes=1',
    exists(select 1 from inventaire_audit_log where quart_id = qe and action = 'cloture_serveur'
           and (metadata->>'population')::int = 1 and (metadata->>'validees')::int = 1 and (metadata->>'lignes_divergentes')::int = 1), null;
  insert into _r select 'E la ligne divergente garde son rattachement et son flag',
    exists(select 1 from inventaire_quart_employes where quart_id = qe and employee_id = e3 and shift_id = sh_e2 and not a_valide_cloture), null;

  select * into q from inventaire_quarts where id = qf;
  insert into _r values ('F repli : statut cloture', q.statut = 'cloture', q.statut);
  insert into _r values ('F repli : cloture_le = fin planifiée + 30 min exactement',
    q.cloture_le = ((t-1) + time '13:30') at time zone v_tz, q.cloture_le::text);
  insert into _r select 'F audit mode=repli, produits_non_comptes=2',
    exists(select 1 from inventaire_audit_log where quart_id = qf and action = 'cloture_serveur'
           and metadata->>'mode' = 'repli' and (metadata->>'produits_non_comptes')::int = 2), null;
  select count(*), max(valeur_constatee)::int into v_n, v_id from inventaire_alertes where quart_id = qf and type_alerte = 'cloture_incomplete';
  insert into _r values ('F alerte cloture_incomplete unique, valeur 2', v_n = 1 and v_id::text is not null and exists(select 1 from inventaire_alertes where quart_id = qf and type_alerte = 'cloture_incomplete' and valeur_constatee = 2), v_n::text);
  select count(*) into v_n from inventaire_alertes where quart_id = qf and type_alerte = 'cloture_en_retard';
  insert into _r values ('F pas d''alerte de retard : le quart est clos', v_n = 0, v_n::text);

  select * into q from inventaire_quarts where id = qg;
  insert into _r values ('G repli sans plan : cloture_le = 20:30 exactement', q.statut = 'cloture' and q.cloture_le = ((t-1) + time '20:30') at time zone v_tz, q.cloture_le::text);
  select count(*) into v_n from inventaire_alertes where quart_id = qg and type_alerte = 'cloture_incomplete';
  insert into _r values ('G aucune alerte cloture_incomplete sans produit obligatoire', v_n = 0, v_n::text);

  select * into q from inventaire_quarts where id = qh;
  insert into _r values ('H déjà clos : cloture_le intact', q.statut = 'cloture' and q.cloture_le = '2000-01-01 00:00:00+00', q.cloture_le::text);
  select count(*) into v_n from inventaire_audit_log where quart_id = qh;
  insert into _r values ('H déjà clos : aucun audit', v_n = 0, v_n::text);

  select * into q from inventaire_quarts where id = qi;
  insert into _r values ('I garde de statut : ouverture_en_cours non clos', q.statut = 'ouverture_en_cours' and q.cloture_le is null, q.statut);
  select count(*) into v_n from inventaire_alertes where quart_id = qi and type_alerte = 'cloture_en_retard';
  insert into _r values ('I alerte cloture_en_retard unique après deux passages', v_n = 1, v_n::text);

  select md5(coalesce(string_agg(x::text, '|' order by x.id), '')) into v_md5_apres
    from inventaire_quart_employes x where x.quart_id not in (select id from inventaire_quarts where site = v_site);
  insert into _r values ('Aucune ligne employé hors fixtures n''est modifiée', v_md5_avant = v_md5_apres, null);

  select jsonb_build_object(
           'total', count(*), 'echecs', count(*) filter (where not ok),
           'epreuves', jsonb_agg(jsonb_build_object('nom', nom, 'ok', ok, 'detail', detail) order by nom))
    into v_rapport from _r;
  raise exception 'RAPPORT (rollback volontaire) : %', v_rapport;
end;
$epreuves$;

-- Droit d'exécution : la fonction ferme des quarts sur tous les sites, elle ne
-- doit être exécutable ni par anon ni par authenticated (seul le cron, postgres).
do $droits$
begin
  if has_function_privilege('authenticated', 'public.run_scheduled_inventory_reviews()', 'EXECUTE')
     or has_function_privilege('anon', 'public.run_scheduled_inventory_reviews()', 'EXECUTE') then
    raise exception 'ECHEC : anon ou authenticated peut exécuter run_scheduled_inventory_reviews()';
  end if;
  raise notice 'ok : fonction fermée à anon et authenticated';
end
$droits$;
