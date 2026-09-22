-- ---------------------------------------------------------------------------
-- UNE CORRECTION DE BASCULE NE REECRIT PAS LE PASSE QU'ELLE CORRIGE
-- Ecrite le 20/09/2026. HORS DU LOT GELE #64 : migration distincte et tracee.
--
-- CE QUI S'EST PASSE. `20260919220000` (M4) a ouvert la correction d'une
-- bascule du jour meme : le trigger de normalisation est passe de
-- `before insert` a `before insert or update`, et sa fonction a recu trois
-- protections propres a l'UPDATE — site et date d'effet figes,
-- `source_precedente` conservee, `change_le` rafraichi.
--
-- `20260919260000` (M6) a reecrit cette meme fonction pour y ajouter la garde
-- de la date d'effet future. Elle l'a reecrite a partir du texte de
-- `20260919180000` (M2), ANTERIEUR a M4 : deux des trois protections ont
-- disparu sans que rien ne le signale, le trigger restant
-- `before insert or update`. `20260919280000` (M7) n'y a pas touche.
--
-- LES DEUX REGRESSIONS, telles qu'elles se lisent aujourd'hui :
--
--   1. `source_precedente` finit par se designer elle-meme. Sur un UPDATE la
--      ligne est DEJA en table a sa date d'effet, et
--      `source_planning_applicable` retient « la plus grande date d'effet
--      inferieure ou egale » : elle trouve donc la ligne corrigee et rend SA
--      PROPRE source. Le manager passe a Google Sheets le matin, revient a
--      NEXUS l'apres-midi, et la trace inscrit « auparavant : google_sheets ».
--      La veille n'a pourtant pas change : elle disait `nexus`. Le temoin
--      d'audit accuse le geste qu'il devait servir.
--
--   2. `change_le` ne bouge plus. La colonne porte `default now()`, mais un
--      DEFAULT de colonne ne s'applique qu'a l'INSERT : depuis M6, une
--      correction laisse en place l'horodatage de la bascule initiale. Une
--      ligne modifiee se presente comme jamais touchee.
--
-- CE QUE CE FICHIER RETABLIT, ET RIEN D'AUTRE : ces deux invariants.
--
-- La TROISIEME protection de M4 — le refus `23514` de deplacer le site ou la
-- date d'effet — n'est volontairement pas reintroduite. La policy
-- `update_planning_source_periodes` la couvre deja pour `authenticated` : son
-- USING exige `planning_bascule_modifiable` sur l'ancienne ligne, son
-- WITH CHECK sur la nouvelle — donc date d'effet >= jour de la station des
-- deux cotes — pendant que la garde du futur de M6 la plafonne a ce meme jour.
-- La date d'effet ne peut donc valoir que le jour de la station, avant comme
-- apres, et le site est borne par `current_employee_site_id()`. Ajouter
-- aujourd'hui un refus que Production ne leve pas serait une garde neuve, pas
-- une reparation.
--
-- `basculer_source_planning` est corrigee dans le meme mouvement, et pour la
-- raison meme qui a motive M7 : elle annonce `source_precedente` AVANT que le
-- trigger ne l'inscrive, et M7 a rendu les deux identiques a dessein. Corriger
-- le trigger seul les ferait diverger de nouveau, dans l'autre sens.
--
-- AUCUNE migration du lot #64 n'est modifiee : les sept restent telles
-- qu'appliquees. Ce fichier ne change ni signature, ni droits, ni policy, ni
-- schema — deux corps de fonction, et rien de plus.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Le temoin d'une correction n'est pas celui d'une bascule neuve.
-- ---------------------------------------------------------------------------
-- Reprise mot pour mot des deux gardes de M6 — date d'effet future, motif
-- obligatoire pour le passe — auxquelles reviennent les deux protections que
-- M4 portait et que M6 avait perdues.

create or replace function public.planning_source_periodes_normalise()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $fn$
declare
  v_jour date;
begin
  -- Sur un INSERT, l'historique seul dit ce qui precedait, et la ligne n'y est
  -- pas encore : `source_planning_applicable` repond juste. Sur un UPDATE elle
  -- y est, et se repondrait a elle-meme. La seule reponse fiable a « que
  -- disait-on avant cette bascule » est alors celle qui a ete calculee le jour
  -- ou elle a ete posee : on la conserve, tant que la bascule ne change ni de
  -- site ni de date d'effet — et elle ne le peut pas, cf. en-tete.
  if tg_op = 'UPDATE'
     and new.site is not distinct from old.site
     and new.date_effet is not distinct from old.date_effet then
    new.source_precedente := old.source_precedente;
  else
    new.source_precedente := public.source_planning_applicable(new.site, new.date_effet);
  end if;

  if auth.uid() is not null then
    new.auteur_id := auth.uid();
  end if;

  -- `change_le` date la derniere modification EFFECTIVE. Un UPDATE qui
  -- n'emporte aucun changement — une re-bascule vers la source deja en place,
  -- avec le meme motif, telle que l'ecrit `on conflict do update` — n'en est
  -- pas une : l'horodater ferait etat d'une correction qui n'a pas eu lieu. La
  -- comparaison porte sur la ligne entiere, `change_le` exclu, pour qu'une
  -- colonne ajoutee plus tard y entre d'office.
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'change_le') is distinct from (to_jsonb(old) - 'change_le') then
      new.change_le := now();
    end if;
  else
    new.change_le := now();
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
  '`source_precedente` a l''insert et la CONSERVE a la correction (la ligne '
  'corrigee se designerait elle-meme), impose `auteur_id`, rafraichit '
  '`change_le` a toute modification effective, REFUSE une date d''effet future '
  '(une source ne se programme pas en avance) et exige un motif pour une date '
  'd''effet passee (requalifier des journees deja travaillees se justifie).';

revoke all on function public.planning_source_periodes_normalise() from public;
revoke all on function public.planning_source_periodes_normalise() from anon;
revoke all on function public.planning_source_periodes_normalise() from authenticated;

-- ---------------------------------------------------------------------------
-- 2. La fonction annonce ce que le trigger inscrit.
-- ---------------------------------------------------------------------------
-- `create or replace` : la signature ne change pas, donc pas de surcharge a
-- craindre, et les droits poses par M6 puis M7 sont preserves tels quels.
-- Seuls deux calculs bougent, cf. en-tete.

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
  v_effective  text;
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

  -- Deux questions distinctes, que rien ne separait tant qu'aucune bascule
  -- n'existait a cette date :
  --   * ce qui fait foi a la date d'effet JUSTE AVANT ce geste. C'est ce que
  --     le geste change, donc ce que `inchangee` doit comparer.
  --   * ce qui faisait foi avant LA BASCULE elle-meme. C'est la trace
  --     d'audit, et une correction du jour meme ne la reecrit pas.
  -- Sur une premiere bascule les deux coincident, et rien ne bouge. Sur une
  -- correction la ligne est deja la : la premiere vaut sa source courante, la
  -- seconde reste celle qu'elle porte depuis l'origine. Meme regle que le
  -- trigger de normalisation, avant la meme insertion : le retour et la trace
  -- ne peuvent pas diverger.
  v_effective := public.source_planning_applicable(p_site, v_effet);

  select p.source_precedente into v_precedente
    from public.planning_source_periodes p
   where p.site = p_site and p.date_effet = v_effet;
  if not found then
    v_precedente := v_effective;
  end if;

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
    'inchangee',         p_source is not distinct from v_effective
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
  'D''EFFET AVANT LA BASCULE, identique a celle que le trigger inscrit dans '
  'la trace : une correction du jour meme la conserve au lieu de la '
  'recalculer sur elle-meme. '
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
