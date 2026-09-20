-- ---------------------------------------------------------------------------
-- Bascule de source de planning : la date d'effet devient un CHOIX, borne.
-- 19/09/2026 — arbitrage Frederic, point 2 du mandat post-parcours.
-- ---------------------------------------------------------------------------
--
-- Etat de depart. `basculer_source_planning` figeait la date d'effet au jour
-- metier de la station et n'exposait AUCUN parametre de date. Consequence
-- mesuree sur Test, transaction annulee : deux affectations `google_sheets`
-- publiees, l'une au 17/09 et l'autre au 19/09, avec une periode prenant
-- effet au 19/09 — UNE SEULE ressort de `v_planning_officiel`. L'ecran
-- annoncait pourtant « Mois publie — visible par l'equipe ». Publier n'est pas
-- rendre visible tant que la source applicable de la journee concernee dit
-- autre chose, et le manager n'avait aucun moyen de corriger cela depuis
-- NEXUS.
--
-- Ce que cette migration ajoute, et rien d'autre :
--
--   1. Une garde de base contre la date d'effet FUTURE. Elle manquait. La
--      doctrine de `20260919180000` dit qu'une bascule ne se programme pas en
--      avance, parce que `station_config.planning_source` ne porte pas de
--      date ; jusqu'ici seule la garde de coherence l'empechait, et seulement
--      par effet de bord — elle laisse passer le cas ou la source visee est
--      deja celle du jour. La regle est desormais dite la ou vit deja celle du
--      motif, dans le meme trigger, donc sur TOUS les chemins d'ecriture.
--
--   2. Un parametre `p_date_effet` a `basculer_source_planning`. Absent ou
--      null, le comportement est inchange : le jour metier de la station.
--
-- Ce qu'elle n'ajoute pas, volontairement :
--
--   * aucune publication de donnees historiques. Requalifier la SOURCE d'une
--     journee ne publie rien : `v_planning_officiel` ne rend que ce qui a ete
--     reellement importe puis publie. Une bascule retroactive sur un mois
--     jamais importe ne fait apparaitre aucune ligne.
--
--   * aucune reecriture d'une bascule passee. La policy
--     `update_planning_source_periodes` la refuse deja via
--     `planning_bascule_modifiable` — seules la bascule du jour et celles a
--     venir sont modifiables. La fonction constate ce refus AVANT de le
--     provoquer, pour qu'il se lise.

-- ---------------------------------------------------------------------------
-- 1. La date d'effet future n'existe pas.
-- ---------------------------------------------------------------------------
-- Reprise de `20260919180000` section 8, plus la garde du futur. La garde du
-- motif retroactif n'est pas modifiee : elle est recopiee mot pour mot avec
-- son trigger.

create or replace function public.planning_source_periodes_normalise()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $fn$
declare
  v_jour date;
begin
  new.source_precedente := public.source_planning_applicable(new.site, new.date_effet);

  if auth.uid() is not null then
    new.auteur_id := auth.uid();
  end if;

  v_jour := public.planning_jour_station(new.site);

  -- Une bascule ne se programme pas en avance : `station_config.planning_source`
  -- ne porte pas de date, donc le reglage dirait aujourd'hui ce que
  -- l'historique ne dira que plus tard. Les deux divergeraient jusqu'a la date
  -- annoncee, et la garde de coherence ne rattrape ce cas que lorsque la
  -- source change reellement.
  if new.date_effet > v_jour then
    raise exception
      using errcode = '23514',
            message = format(
              'Bascule datee du %s, posterieure au jour de la station (%s) : une source de planning ne se programme pas en avance.',
              new.date_effet, v_jour),
            hint = 'Declarez la bascule le jour ou elle prend effet. NEXUS ne garde pas de source « a venir » : le reglage de la station n''a pas de date.';
  end if;

  if new.date_effet < v_jour and (new.motif is null or btrim(new.motif) = '') then
    raise exception
      using errcode = '23514',
            message = format(
              'Bascule datee du %s, anterieure au jour de la station (%s) : un motif est obligatoire.',
              new.date_effet, v_jour),
            hint = 'Une bascule retroactive change la source qui fait foi sur des journees deja travaillees. Dites pourquoi.';
  end if;

  return new;
end;
$fn$;

comment on function public.planning_source_periodes_normalise() is
  'Normalise et borne une periode de source de planning : calcule '
  '`source_precedente`, impose `auteur_id`, REFUSE une date d''effet future '
  '(une source ne se programme pas en avance) et exige un motif pour une date '
  'd''effet passee (requalifier des journees deja travaillees se justifie).';

revoke all on function public.planning_source_periodes_normalise() from public;
revoke all on function public.planning_source_periodes_normalise() from anon;
revoke all on function public.planning_source_periodes_normalise() from authenticated;

-- ---------------------------------------------------------------------------
-- 2. La bascule accepte une date d'effet.
-- ---------------------------------------------------------------------------
-- `drop` puis `create`, jamais `create or replace` : ajouter un parametre cree
-- une SURCHARGE. Les deux signatures coexisteraient, et un appel PostgREST
-- nommant `p_site`, `p_source` et `p_motif` deviendrait ambigu — la quatrieme
-- ayant un defaut, les deux candidates correspondraient. Un seul nom, une
-- seule fonction.

drop function if exists public.basculer_source_planning(text, text, text);

create function public.basculer_source_planning(
  p_site       text,
  p_source     text,
  p_motif      text default null,
  p_date_effet date default null
) returns jsonb
  language plpgsql
  set search_path to 'public'
as $fn$
declare
  v_jour       date;
  v_effet      date;
  v_precedente text;
  v_du_jour    text;
  v_motif      text;
  v_lignes     integer;
  v_existe     boolean;
begin
  if p_source is null or p_source not in ('nexus', 'google_sheets') then
    raise exception using errcode = '22023',
      message = format('Source de planning inconnue : « %s ».', coalesce(p_source, 'null')),
      hint = 'Les seules sources declarables sont « nexus » et « google_sheets ».';
  end if;

  select c.planning_source into v_precedente
    from public.station_config c where c.site = p_site;
  if not found then
    raise exception using errcode = 'P0002',
      message = format('Aucune configuration de station pour « %s ».', p_site),
      hint = 'Enregistrez les horaires de la station avant de declarer sa source de planning.';
  end if;

  v_jour  := public.planning_jour_de_ma_station(p_site);
  -- Le defaut reste le jour metier de la STATION. Cet ecran n'a pas de jour
  -- fiable a lui : le navigateur du manager peut etre a l'autre bout du monde.
  v_effet := coalesce(p_date_effet, v_jour);
  v_motif := nullif(btrim(coalesce(p_motif, '')), '');

  -- Le futur est refuse par le trigger de normalisation, et son message est
  -- meilleur que ce que dirait cet appel. On ne redit pas la regle ici : une
  -- seule autorite la porte, et c'est celle qui couvre aussi les ecritures
  -- directes.

  -- Une bascule passee ne se reecrit pas : la policy UPDATE la protege deja,
  -- mais `on conflict do update` ferait remonter un « 42501 » nu, sans dire
  -- lequel des deux gestes a ete refuse ni pourquoi.
  if v_effet < v_jour then
    select true into v_existe
      from public.planning_source_periodes p
     where p.site = p_site and p.date_effet = v_effet;
    if v_existe then
      raise exception using errcode = '42501',
        message = format('Une bascule est deja enregistree au %s pour « %s » : une trace passee ne se reecrit pas.', v_effet, p_site),
        hint = 'Choisissez une autre date d''effet. L''historique des bascules est un temoin, pas un brouillon.';
    end if;
  end if;

  -- `station_config.planning_source` dit la source d'AUJOURD'HUI, et rien
  -- d'autre : il ne porte pas de date. Une bascule retroactive posee AVANT une
  -- bascule deja enregistree ne change donc pas le reglage de la station —
  -- c'est la plus recente des periodes qui fait foi aujourd'hui. Ecrire
  -- `p_source` sans regarder ferait diverger le reglage de l'historique, et
  -- `trg_planning_source_coherence` annulerait la transaction en fin de course
  -- avec un message qui n'expliquerait pas d'ou vient la contradiction.
  select coalesce(
           (select p.source from public.planning_source_periodes p
             where p.site = p_site
               and p.date_effet <= v_jour
               and p.date_effet >  v_effet
             order by p.date_effet desc limit 1),
           p_source)
    into v_du_jour;

  update public.station_config
     set planning_source = v_du_jour,
         updated_at      = now()
   where site = p_site;
  get diagnostics v_lignes = row_count;
  -- La RLS peut laisser lire une configuration et refuser de l'ecrire. Un
  -- update sans ligne touchee n'est donc pas « rien a faire » : c'est un refus
  -- silencieux, et il doit parler.
  if v_lignes = 0 then
    raise exception using errcode = '42501',
      message = format('Source de planning de « %s » : ecriture refusee.', p_site),
      hint = 'Seuls le manager et le gerant du site declarent sa source de planning.';
  end if;

  insert into public.planning_source_periodes (site, source, date_effet, motif)
  values (p_site, p_source, v_effet, v_motif)
  on conflict (site, date_effet) do update
     set source = excluded.source,
         motif  = excluded.motif;

  return jsonb_build_object(
    'site',              p_site,
    'source',            p_source,
    'source_precedente', v_precedente,
    'source_du_jour',    v_du_jour,
    'date_effet',        v_effet,
    'jour_station',      v_jour,
    'retroactif',        v_effet < v_jour,
    'motif',             v_motif,
    'inchangee',         v_precedente is not distinct from v_du_jour
  );
end;
$fn$;

comment on function public.basculer_source_planning(text, text, text, date) is
  'Declare la source officielle de planning d''un site ET en laisse la trace, '
  'dans la meme transaction : `station_config.planning_source` et une ligne '
  '`planning_source_periodes`. La date d''effet vaut par defaut le jour de la '
  'STATION ; `p_date_effet` permet de la faire remonter, jamais de l''avancer '
  '— le trigger de normalisation refuse le futur et exige un motif pour le '
  'passe. Une bascule retroactive anterieure a une bascule deja enregistree ne '
  'touche pas le reglage du jour : le retour porte `source_du_jour`. '
  'Requalifier la source d''une journee NE PUBLIE RIEN : seules les '
  'affectations reellement importees et publiees sont consommables. '
  '`security invoker` : n''accorde aucun droit, la RLS tranche.';

revoke all on function public.basculer_source_planning(text, text, text, date) from public;
revoke all on function public.basculer_source_planning(text, text, text, date) from anon;
grant execute on function public.basculer_source_planning(text, text, text, date) to authenticated;
grant execute on function public.basculer_source_planning(text, text, text, date) to service_role;
