-- ---------------------------------------------------------------------------
-- La source precedente d'une bascule est celle de sa DATE D'EFFET.
-- ---------------------------------------------------------------------------
-- `basculer_source_planning` ecrivait une chose et en retournait une autre.
--
-- La colonne `planning_source_periodes.source_precedente` est calculee par
-- `trg_planning_source_periodes_normalise` avec
-- `source_planning_applicable(site, date_effet)` : la source qui faisait foi
-- A LA DATE D'EFFET. C'est la bonne definition — une bascule retroactive
-- remplace la source des journees a partir de cette date, pas celle
-- d'aujourd'hui.
--
-- Mais la fonction lisait `station_config.planning_source` — la source
-- d'AUJOURD'HUI — et la retournait sous le nom `source_precedente`. Pour une
-- bascule au jour courant les deux coincident, et le defaut restait invisible.
-- Pour une bascule retroactive elles divergent, et l'ecran annoncait au
-- manager une source precedente que la base venait de contredire dans sa
-- propre trace. Constate en recette le 19/09/2026 : une bascule au 12/09 d'un
-- site dont la source du jour etait `google_sheets` et celle du 12/09
-- `nexus` s'est confirmee sous le libelle « Google Sheets (auparavant Google
-- Sheets) » — un changement reel presente comme un geste sans effet — alors
-- que la ligne inscrite portait bien `source_precedente = 'nexus'`.
--
-- `inchangee` heritait du meme defaut : il comparait la source du jour avant
-- et apres, donc une bascule retroactive posee sous une bascule plus recente
-- etait dite « inchangee » alors qu'elle requalifiait des journees. Le drapeau
-- dit desormais ce que le manager veut savoir : ce geste change-t-il la source
-- d'au moins une journee.
--
-- La fonction ne change ni de signature, ni de droits, ni d'ecritures : elle
-- rend ce qu'elle inscrit.

create or replace function public.basculer_source_planning(
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
  v_config     text;
begin
  if p_source is null or p_source not in ('nexus', 'google_sheets') then
    raise exception using errcode = '22023',
      message = format('Source de planning inconnue : « %s ».', coalesce(p_source, 'null')),
      hint = 'Les seules sources declarables sont « nexus » et « google_sheets ».';
  end if;

  -- Lecture d'EXISTENCE : un site sans configuration de station ne declare pas
  -- de source. La valeur lue ne sert plus a nommer la source precedente.
  select c.planning_source into v_config
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

  -- La source REMPLACEE est celle de la date d'effet, pas celle du jour. Meme
  -- appel que le trigger de normalisation, avant la meme insertion : le
  -- retour et la trace ne peuvent plus diverger.
  v_precedente := public.source_planning_applicable(p_site, v_effet);

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
    -- « Inchangee » veut dire : ce geste ne requalifie AUCUNE journee. La
    -- comparaison porte donc sur la date d'effet, seul endroit ou la source
    -- change.
    'inchangee',         p_source is not distinct from v_precedente
  );
end;
$fn$;

comment on function public.basculer_source_planning(text, text, text, date) is
  'Declare la source officielle de planning d''un site ET en laisse la trace, '
  'dans la meme transaction : `station_config.planning_source` et une ligne '
  '`planning_source_periodes`. La date d''effet vaut par defaut le jour de la '
  'STATION ; `p_date_effet` permet de la faire remonter, jamais de l''avancer '
  '— le trigger de normalisation refuse le futur et exige un motif pour le '
  'passe. `source_precedente` est la source qui faisait foi A LA DATE '
  'D''EFFET, identique a celle que le trigger inscrit dans la trace, et '
  '`inchangee` dit que le geste ne requalifie aucune journee. Une bascule '
  'retroactive anterieure a une bascule deja enregistree ne touche pas le '
  'reglage du jour : le retour porte `source_du_jour`. '
  'Requalifier la source d''une journee NE PUBLIE RIEN : seules les '
  'affectations reellement importees et publiees sont consommables. '
  '`security invoker` : n''accorde aucun droit, la RLS tranche.';

revoke all on function public.basculer_source_planning(text, text, text, date) from public;
revoke all on function public.basculer_source_planning(text, text, text, date) from anon;
grant execute on function public.basculer_source_planning(text, text, text, date) to authenticated;
grant execute on function public.basculer_source_planning(text, text, text, date) to service_role;
