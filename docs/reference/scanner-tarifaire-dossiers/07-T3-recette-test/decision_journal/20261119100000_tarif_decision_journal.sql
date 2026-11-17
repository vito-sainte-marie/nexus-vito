-- NEXUS Scanner, T3 : enregistrement transactionnel d'une décision de prix et de sa ligne de journal (PROJET, NON EXÉCUTÉ).
-- Version 2 (contre-audit du 17/11/2026, 11 h 09) : règle du lien portée par le déclencheur d'insertion (plus de CHECK),
-- lien limité à un prix décidé actif, version de moteur présentée comme un contrôle de forme.
-- Dépend des quatre migrations T2 (20261118100000 à 100300). Cible : Test uniquement, après GO écrit. Production non concernée.
--
-- Arbitrage du 17/11/2026, condition 1 : fonction SECURITY INVOKER ; RLS, atomicité et isolation multisite prouvées
-- sur base jetable avant toute migration.
--
-- Principe : un seul appel enregistre, pour chaque ligne d'un lot, le prix décidé (tarif_prix_decides) et sa ligne de
-- journal (tarif_decisions), ou rien du tout. La fonction s'exécute avec les droits de la personne connectée : la RLS
-- T2 (dont compte_actif_obligatoire) s'applique à chaque insertion, aucune élévation de droits.
-- Le site n'est jamais un paramètre : il est lu dans la ligne employees de la personne connectée.
-- Aucune donnée existante n'est modifiée. Aucune écriture Decenium.

-- GARDE PROJET TEST : identique aux migrations T2.
do $garde$
declare v_sysid bigint := (select system_identifier from pg_control_system());
begin
  if v_sysid is distinct from 7678069749886157684 then
    raise exception 'garde_projet_test : identifiant système % : ce n est pas le projet Supabase Test udljdqxerrbbbajxubfn', v_sysid;
  end if;
  if (select count(*) from public.sites where site_id in ('site-fantome-test', 'nexus-station-test')) <> 2 then
    raise exception 'garde_projet_test : sites de recette absents';
  end if;
end $garde$;

do $$ begin
  if to_regclass('public.tarif_decisions') is null or to_regclass('public.v_tarif_prix_decides_actifs') is null
     or not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'compte_actif_obligatoire') then
    raise exception 'ordre_migrations : appliquer les quatre migrations T2 (20261118100000 à 100300) avant 20261119100000';
  end if;
end $$;

-- 1. Lien journal vers prix décidé, du même site. Une décision « refusee » ne crée pas de prix ; les autres en créent un.
alter table tarif_decisions add column if not exists prix_decide_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tarif_decisions_prix_meme_site_fk') then
    alter table tarif_decisions add constraint tarif_decisions_prix_meme_site_fk
      foreign key (prix_decide_id, site) references tarif_prix_decides (id, site);
  end if;
end $$;
-- Version 2 (contre-audit du 17/11/2026) : la règle « refus sans lien, sinon lien obligatoire » n'est PAS une contrainte CHECK.
-- Une CHECK, même NOT VALID, est contrôlée à chaque UPDATE : l'annulation d'une décision historique sans lien serait refusée.
-- La règle est portée par le déclencheur d'insertion ci-dessous ; les lignes historiques restent annulables.
alter table tarif_decisions drop constraint if exists tarif_decisions_lien_prix;
create unique index if not exists tarif_decisions_prix_decide_uq on tarif_decisions (prix_decide_id) where prix_decide_id is not null;
comment on column tarif_decisions.prix_decide_id is 'Prix décidé créé par cette décision (même site). Nul pour un refus. Lignes antérieures à cette migration : nul, conservées telles quelles (décision historique sans lien).';

-- 2. Règles du lien, contrôlées à l'INSERTION seulement (jamais à l'annulation), y compris hors fonction et pour service_role :
--    refus sans lien ; validée ou autre prix avec un lien vers un prix décidé ACTIF, de nature « changement »,
--    même site, même référence, même prix, même auteur. Lecture sous les droits de la personne (pas de SECURITY DEFINER).
create or replace function tarif_controle_decision_lien() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare v record;
begin
  if new.decision = 'refusee' then
    if new.prix_decide_id is not null then
      raise exception 'tarif_decision_lien_invalide : un refus ne crée pas de prix décidé' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.prix_decide_id is null then
    raise exception 'tarif_decision_lien_absent : une décision validée ou à un autre prix doit viser son prix décidé' using errcode = 'P0001';
  end if;
  select p.site, p.cle, p.prix_ttc, p.saisi_par, p.nature, p.annule_le,
         exists (select 1 from tarif_prix_decides c where c.remplace_id = p.id and c.annule_le is null) as remplace
    into v from tarif_prix_decides p where p.id = new.prix_decide_id;
  if v is null or v.site <> new.site or v.cle is distinct from tarif_cle_reference(new.code_barres, new.article)
     or v.prix_ttc is distinct from new.prix_ttc_retenu or v.saisi_par is distinct from new.saisi_par or v.nature <> 'changement'
     or v.annule_le is not null or v.remplace then
    raise exception 'tarif_decision_lien_invalide : le prix décidé lié n est pas celui de cette décision, ou n est plus actif' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists tarif_decisions_lien on tarif_decisions;
create trigger tarif_decisions_lien before insert on tarif_decisions for each row execute function tarif_controle_decision_lien();
revoke all on function tarif_controle_decision_lien() from public, anon, authenticated, service_role;

-- 3. La fonction transactionnelle. Un appel = une transaction : toute erreur annule le lot entier.
--    Entrée : tableau JSON de 1 à 200 décisions. Champs admis par ligne, et aucun autre (le site est refusé) :
--    article, code_barres, decision ('validee' | 'refusee' | 'autre_prix'), prix_ttc_retenu, motif, seuil_id,
--    periode_debut, periode_fin, moteur_version (doit venir du moteur T2), photo.
create or replace function tarif_enregistrer_decisions(p_lignes jsonb)
returns table (o_decision_id uuid, o_prix_decide_id uuid, o_cle text)
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_emp record;
  l jsonb;
  v_cle text;
  v_cles text[] := '{}';
  v_remplace uuid;
  v_pd uuid;
  v_dec uuid;
begin
  if v_uid is null then
    raise exception 'tarif_decision_session_absente : aucune personne connectée' using errcode = 'P0001';
  end if;
  -- Vérification explicite du compte (arbitrage, condition 3) : on ne déduit rien d'une lecture vide.
  select e.actif, e.role, e.site_id, e.est_createur into v_emp from employees e where e.id = v_uid;
  if not found then
    raise exception 'tarif_decision_compte_illisible : fiche employé introuvable' using errcode = 'P0001';
  end if;
  if not v_emp.actif then
    raise exception 'tarif_decision_compte_inactif : compte désactivé' using errcode = 'P0001';
  end if;
  if v_emp.est_createur then
    raise exception 'tarif_decision_createur_lecture_seule : le créateur ne décide pas' using errcode = 'P0001';
  end if;
  if v_emp.role is distinct from 'gerant' then
    raise exception 'tarif_decision_reservee_gerant : seul le gérant décide d un prix' using errcode = 'P0001';
  end if;
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) not between 1 and 200 then
    raise exception 'tarif_decision_lot_invalide : de 1 à 200 décisions par appel' using errcode = 'P0001';
  end if;

  for l in select value from jsonb_array_elements(p_lignes) loop
    if jsonb_typeof(l) <> 'object' or exists (select 1 from jsonb_object_keys(l) k where k not in
         ('article','code_barres','decision','prix_ttc_retenu','motif','seuil_id','periode_debut','periode_fin','moteur_version','photo')) then
      raise exception 'tarif_decision_champ_inconnu : champ non admis (le site n est jamais transmis)' using errcode = 'P0001';
    end if;
    -- Contrôle de forme seulement : la base vérifie que la version DÉCLARÉE est une version T2, pas que la photo vient
    -- réellement du moteur T2 (la photo est calculée dans le navigateur ; la base ne peut pas en prouver l'origine).
    if coalesce(l->>'moteur_version', '') !~ '^politique-tarifaire-t2(-[a-z0-9.]+)?$' then
      raise exception 'tarif_decision_version_moteur_refusee : version de moteur déclarée absente ou hors T2' using errcode = 'P0001';
    end if;
    v_cle := tarif_cle_reference(l->>'code_barres', l->>'article');
    if v_cle is null then
      raise exception 'tarif_decision_reference_absente : code-barres ou libellé obligatoire' using errcode = 'P0001';
    end if;
    if v_cle = any (v_cles) then
      raise exception 'tarif_decision_doublon_lot : la référence % figure deux fois dans le lot', v_cle using errcode = 'P0001';
    end if;
    v_cles := v_cles || v_cle;

    v_pd := null;
    v_remplace := null;
    if l->>'decision' in ('validee', 'autre_prix') then
      -- Version active éventuelle du même site et de la même clé, lue sous RLS ; le déclencheur T2 sérialise et contrôle.
      select p.id into v_remplace from v_tarif_prix_decides_actifs p where p.site = v_emp.site_id and p.cle = v_cle;
      insert into tarif_prix_decides (site, article, code_barres, nature, prix_ttc, motif, remplace_id)
      values (v_emp.site_id, l->>'article', l->>'code_barres', 'changement', (l->>'prix_ttc_retenu')::numeric, l->>'motif', v_remplace)
      returning id into v_pd;
    end if;

    insert into tarif_decisions (site, article, code_barres, periode_debut, periode_fin, decision, prix_ttc_retenu, motif,
                                 seuil_id, moteur_version, photo, prix_decide_id)
    values (v_emp.site_id, l->>'article', l->>'code_barres', (l->>'periode_debut')::date, (l->>'periode_fin')::date, l->>'decision',
            (l->>'prix_ttc_retenu')::numeric, l->>'motif', (l->>'seuil_id')::uuid, l->>'moteur_version', l->'photo', v_pd)
    returning id into v_dec;

    o_decision_id := v_dec; o_prix_decide_id := v_pd; o_cle := v_cle;
    return next;
  end loop;
end $$;
revoke all on function tarif_enregistrer_decisions(jsonb) from public, anon, authenticated, service_role;
grant execute on function tarif_enregistrer_decisions(jsonb) to authenticated;
comment on function tarif_enregistrer_decisions(jsonb) is
  'T3 : enregistre ensemble prix décidé et journal, par lot, tout ou rien. SECURITY INVOKER : RLS T2 appliquée. Gérant actif, non créateur, site du compte.';
