-- ============================================================================
-- FDJ — Quart absent : reconstitution du stock de chaîne
-- Lot NEXUS-FDJ-STOCK-Q1-ABSENT-20261015 · decision-1 (ChatGPT) conditions 1-8
--
-- Règle métier (Frédéric) : quand un quart n'a pas été effectué mais que le
-- quart suivant a un comptage initial réel et confirmé, NEXUS reconstitue le
-- stock de chaîne du quart manquant à partir de ce comptage. Le stock initial
-- du quart suivant prime toujours sur le stock final du quart précédent.
--
-- Garanties :
--  * table dédiée, jamais de ligne fictive dans fdj_shifts / fdj_shift_counts,
--    ni caisse, ventes, réceptions, présences, clôtures ;
--  * ensemble des jeux attendus = jeux actifs du site, lu en base (aucun
--    nombre en dur) ;
--  * reconstitution seulement si ouverture_validee ET tous les stocks
--    initiaux attendus renseignés et non nuls (NULL ; 0 reste une valeur) ;
--  * un comptage réel du quart absent prime sans effacer la valeur
--    reconstituée : les deux provenances sont conservées, l'écart est signalé ;
--  * même isolation multisite que les autres tables fdj_* : colonne `site`
--    (la décision écrit « site_id » ; les tables FDJ de Production portent
--    `site`), lecture limitée au site de l'employé, aucune écriture directe.
-- ============================================================================

create table if not exists public.fdj_stock_chaine_reconstitue (
  id                       uuid primary key default gen_random_uuid(),
  site                     text not null check (length(btrim(site)) > 0),
  date_quart_absent        date not null,
  quart_absent             text not null check (quart_absent in ('1','2')),
  shift_source_id          uuid not null references public.fdj_shifts(id),
  game_id                  uuid not null references public.fdj_games(id),
  stock_initial_source     numeric not null check (stock_initial_source >= 0),
  valeur_reconstituee      numeric not null check (valeur_reconstituee >= 0),
  provenance               text not null default 'reconstitue_depuis_stock_initial_suivant'
                             check (provenance = 'reconstitue_depuis_stock_initial_suivant'),
  statut                   text not null default 'reconstitue'
                             check (statut in ('reconstitue','en_conflit')),
  -- Comptage réel éventuel du quart absent, conservé à côté (jamais écrasé).
  comptage_reel_valeur     numeric,
  comptage_reel_shift_id   uuid references public.fdj_shifts(id),
  ecart_comptage_reel      numeric,
  reconstitue_le           timestamptz not null default now(),
  reconstitue_par          uuid references public.employees(id),
  unique (site, date_quart_absent, quart_absent, game_id)
);

comment on table public.fdj_stock_chaine_reconstitue is
  'Stock de chaîne reconstitué d''un quart FDJ non effectué, depuis le stock initial confirmé du quart suivant. Valeurs reconstituées, jamais des comptages physiques : aucune ligne fdj_shifts/fdj_shift_counts n''est créée.';

alter table public.fdj_stock_chaine_reconstitue enable row level security;

drop policy if exists select_fdj_stock_chaine_reconstitue on public.fdj_stock_chaine_reconstitue;
create policy select_fdj_stock_chaine_reconstitue on public.fdj_stock_chaine_reconstitue
  for select using (site = (select public.current_employee_site_id()));

-- Aucune policy d'écriture : seule la commande security definer écrit.
revoke all on table public.fdj_stock_chaine_reconstitue from public, anon, authenticated;
grant select on table public.fdj_stock_chaine_reconstitue to authenticated;
grant all on table public.fdj_stock_chaine_reconstitue to service_role;

-- ----------------------------------------------------------------------------
-- Commande : reconstituer le quart qui précède un quart donné (le « source »).
-- Retourne toujours un jsonb { reconstitue, motif, ... } ; ne lève que pour
-- les refus d'accès (via fdj_quart_du_manager).
-- ----------------------------------------------------------------------------
create or replace function public.fdj_reconstituer_quart_absent(p_shift_source_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source   public.fdj_shifts;
  v_date     date;
  v_quart    text;
  v_absent   public.fdj_shifts;
  v_attendus int;
  v_renseign int;
  v_jeu      record;
  v_existant public.fdj_stock_chaine_reconstitue;
  v_reel     numeric;
  v_n_cree   int := 0;
  v_n_conf   int := 0;
  v_n_maj    int := 0;
begin
  v_source := public.fdj_quart_du_manager(p_shift_source_id);

  -- Quart précédent : Q2 -> Q1 du même jour ; Q1 -> Q2 de la veille.
  if v_source.quart = '2' then
    v_date := v_source.date;  v_quart := '1';
  else
    v_date := v_source.date - 1;  v_quart := '2';
  end if;

  select * into v_absent
    from public.fdj_shifts s
   where s.site = v_source.site and s.date = v_date and s.quart = v_quart;

  -- Condition 5 : l'ouverture du quart suivant doit être confirmée.
  if not coalesce(v_source.ouverture_validee, false) then
    return jsonb_build_object('reconstitue', false, 'motif', 'ouverture_non_confirmee',
      'date', v_date, 'quart', v_quart);
  end if;

  -- Condition 4 : ensemble attendu = jeux actifs du site (rien en dur).
  select count(*) into v_attendus
    from public.fdj_games g where g.site = v_source.site and g.actif;

  select count(*) into v_renseign
    from public.fdj_games g
    join public.fdj_shift_counts c on c.game_id = g.id and c.shift_id = v_source.id
   where g.site = v_source.site and g.actif and c.stock_initial is not null;

  if v_attendus = 0 or v_renseign < v_attendus then
    return jsonb_build_object('reconstitue', false, 'motif', 'comptage_initial_incomplet',
      'attendus', v_attendus, 'renseignes', v_renseign, 'date', v_date, 'quart', v_quart);
  end if;

  for v_jeu in
    select g.id as game_id, c.stock_initial
      from public.fdj_games g
      join public.fdj_shift_counts c on c.game_id = g.id and c.shift_id = v_source.id
     where g.site = v_source.site and g.actif
     order by g.ordre_affichage, g.nom
  loop
    -- Comptage réel du quart absent pour ce jeu, s'il existe (condition 6).
    v_reel := null;
    if v_absent.id is not null then
      select c.stock_final into v_reel
        from public.fdj_shift_counts c
       where c.shift_id = v_absent.id and c.game_id = v_jeu.game_id;
    end if;

    select * into v_existant
      from public.fdj_stock_chaine_reconstitue r
     where r.site = v_source.site and r.date_quart_absent = v_date
       and r.quart_absent = v_quart and r.game_id = v_jeu.game_id;

    if not found then
      insert into public.fdj_stock_chaine_reconstitue (
        site, date_quart_absent, quart_absent, shift_source_id, game_id,
        stock_initial_source, valeur_reconstituee, statut,
        comptage_reel_valeur, comptage_reel_shift_id, ecart_comptage_reel,
        reconstitue_par
      ) values (
        v_source.site, v_date, v_quart, v_source.id, v_jeu.game_id,
        v_jeu.stock_initial, v_jeu.stock_initial,
        case when v_reel is not null and v_reel <> v_jeu.stock_initial then 'en_conflit' else 'reconstitue' end,
        v_reel, case when v_reel is not null then v_absent.id end,
        case when v_reel is not null then v_reel - v_jeu.stock_initial end,
        (select auth.uid())
      );
      v_n_cree := v_n_cree + 1;
      if v_reel is not null and v_reel <> v_jeu.stock_initial then v_n_conf := v_n_conf + 1; end if;
      insert into public.fdj_audit_log (site, shift_id, entite_type, entite_id, action,
        ancienne_valeur, nouvelle_valeur, acteur_id, motif, metadata)
      select v_source.site, v_source.id, 'stock_chaine_reconstitue', r.id, 'reconstitution_quart_absent',
             null, jsonb_build_object('valeur_reconstituee', r.valeur_reconstituee,
                                      'comptage_reel', r.comptage_reel_valeur, 'statut', r.statut),
             (select auth.uid()), 'Quart non effectué : stock de chaîne reconstitué depuis le stock initial du quart suivant',
             jsonb_build_object('date_quart_absent', v_date, 'quart_absent', v_quart,
                                'shift_source_id', v_source.id, 'game_id', v_jeu.game_id)
        from public.fdj_stock_chaine_reconstitue r
       where r.site = v_source.site and r.date_quart_absent = v_date
         and r.quart_absent = v_quart and r.game_id = v_jeu.game_id;
    elsif v_existant.valeur_reconstituee is distinct from v_jeu.stock_initial
       or v_existant.comptage_reel_valeur is distinct from v_reel then
      -- Source corrigée ou comptage réel apparu depuis : on met à jour la
      -- reconstitution, la trace d'audit garde l'ancienne valeur.
      update public.fdj_stock_chaine_reconstitue r set
        shift_source_id = v_source.id,
        stock_initial_source = v_jeu.stock_initial,
        valeur_reconstituee = v_jeu.stock_initial,
        comptage_reel_valeur = v_reel,
        comptage_reel_shift_id = case when v_reel is not null then v_absent.id end,
        ecart_comptage_reel = case when v_reel is not null then v_reel - v_jeu.stock_initial end,
        statut = case when v_reel is not null and v_reel <> v_jeu.stock_initial then 'en_conflit' else 'reconstitue' end
       where r.id = v_existant.id;
      v_n_maj := v_n_maj + 1;
      if v_reel is not null and v_reel <> v_jeu.stock_initial then v_n_conf := v_n_conf + 1; end if;
      insert into public.fdj_audit_log (site, shift_id, entite_type, entite_id, action,
        ancienne_valeur, nouvelle_valeur, acteur_id, motif, metadata)
      values (v_source.site, v_source.id, 'stock_chaine_reconstitue', v_existant.id, 'reconstitution_quart_absent_mise_a_jour',
              jsonb_build_object('valeur_reconstituee', v_existant.valeur_reconstituee,
                                 'comptage_reel', v_existant.comptage_reel_valeur, 'statut', v_existant.statut),
              jsonb_build_object('valeur_reconstituee', v_jeu.stock_initial, 'comptage_reel', v_reel),
              (select auth.uid()), 'Reconstitution réévaluée',
              jsonb_build_object('date_quart_absent', v_date, 'quart_absent', v_quart, 'game_id', v_jeu.game_id));
    elsif v_existant.statut = 'en_conflit' then
      v_n_conf := v_n_conf + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'reconstitue', true, 'motif', 'ok',
    'date', v_date, 'quart', v_quart,
    'quart_effectue', v_absent.id is not null,
    'attendus', v_attendus, 'crees', v_n_cree, 'mis_a_jour', v_n_maj, 'en_conflit', v_n_conf);
end;
$$;

comment on function public.fdj_reconstituer_quart_absent(uuid) is
  'Reconstitue le stock de chaîne du quart qui précède le quart donné, si son ouverture est confirmée et que tous les stocks initiaux des jeux actifs sont renseignés. N''écrit que dans fdj_stock_chaine_reconstitue + fdj_audit_log.';

revoke all on function public.fdj_reconstituer_quart_absent(uuid) from public, anon;
grant execute on function public.fdj_reconstituer_quart_absent(uuid) to authenticated, service_role;
