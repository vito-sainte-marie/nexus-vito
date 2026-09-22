-- ---------------------------------------------------------------------------
-- IMPORT D'UN PLANNING GOOGLE SHEETS — L'ECRITURE, ET RIEN D'AUTRE
-- 19/09/2026
--
-- La lecture du classeur, le decoupage de la grille et le rapprochement des
-- prenoms se font AILLEURS et une seule fois : la fonction Edge
-- `google-sheets-sync` (source=planning) lit, `nexus-planning-sheets-moteur.js`
-- analyse. Cette fonction-ci ne lit rien et ne devine rien : elle recoit un lot
-- deja controle par le manager et l'ecrit.
--
-- Elle existe pour UNE raison : les heures de debut et de fin d'un quart ne
-- sont pas dans le Sheet. Elles appartiennent a Parametres Station et sont
-- calculees par le moteur unique `calculer_horaires_quart`. Les refaire en
-- JavaScript dans l'ecran d'import aurait cree une deuxieme regle d'horaires,
-- qui aurait derive de la premiere le jour ou l'une des deux aurait change.
--
-- CE QUE LE SHEET DIT / CE QUE NEXUS DIT :
--   - `duree_heures` vient du SHEET (7, 8) : c'est la donnee que le manager
--     saisit et que la paie compte.
--   - `heure_debut` / `heure_fin` viennent de PARAMETRES STATION : c'est
--     l'horaire theorique, celui auquel un retard se mesure.
--   Les deux peuvent diverger (le Sheet dit 7 la ou l'horaire dit 8) : ce
--   n'est pas une erreur a corriger en silence, c'est un ecart a montrer. On
--   n'ecrase donc ni l'un ni l'autre.
--
-- Quand la station ne declare pas d'horaire pour ce quart, `heure_debut` reste
-- NULL. C'est voulu (arbitrage du 18/09/2026) : NEXUS ne doit jamais confondre
-- « zero minute de retard » avec « retard impossible a calculer faute de
-- source fiable ». La fonction rend le nombre de lignes concernees pour que
-- l'ecran le DISE au manager au lieu de le taire.
-- ---------------------------------------------------------------------------

create or replace function public.importer_planning_google(
  p_site text,
  p_debut date,
  p_fin date,               -- borne EXCLUSIVE
  p_lot jsonb,
  p_import_id uuid,
  p_par uuid default null::uuid
)
  returns table(lignes_ecrites integer, lignes_remplacees integer, horaires_absents integer)
  language plpgsql
  set search_path to 'public'
as $fn$
declare
  v_source text;
  v_ligne jsonb;
  v_emp uuid;
  v_date date;
  v_quart text;
  v_heures numeric;
  v_statut text;
  v_ref text;
  v_transfert text;
  v_debut_h time;
  v_fin_h time;
  v_ecrites int := 0;
  v_remplacees int := 0;
  v_sans_horaire int := 0;
  v_refs text[] := array[]::text[];
begin
  if p_import_id is null then
    raise exception using errcode = '22004',
      message = 'Import de planning : aucun identifiant de lot.',
      hint = 'Un import doit pouvoir etre compte, relu et annule en bloc : `import_id` est obligatoire.';
  end if;

  if p_lot is null or jsonb_typeof(p_lot) <> 'array' or jsonb_array_length(p_lot) = 0 then
    raise exception using errcode = '22004',
      message = 'Import de planning : lot vide, rien a ecrire.',
      hint = 'Un import vide effacerait le mois sans rien mettre a la place. Il est refuse.';
  end if;

  if p_debut is null or p_fin is null or p_fin <= p_debut then
    raise exception using errcode = '22004',
      message = 'Import de planning : periode absente ou inversee.';
  end if;

  -- La source officielle du site fait foi. Importer un Google Sheets dans un
  -- site dont la source declaree est NEXUS ferait cohabiter deux plannings
  -- concurrents dans les memes journees, ce que toute cette refonte cherche a
  -- empecher. La bascule s'assume dans Parametres Station, pas par effet de
  -- bord d'un import.
  select c.planning_source into v_source
    from public.station_config c where c.site = p_site;
  if coalesce(v_source, 'nexus') <> 'google_sheets' then
    raise exception using errcode = '23514',
      message = format('Import de planning refuse : la source officielle de « %s » est « %s ».', p_site, coalesce(v_source, 'nexus')),
      hint = 'Declarez Google Sheets comme source officielle du site dans Parametres Station avant d''importer.';
  end if;

  -- Un import REMPLACE la periode importee, il ne s'y ajoute pas : une
  -- personne retiree du Sheet doit disparaitre du planning, sans quoi NEXUS
  -- continuerait d'annoncer un service que plus personne n'assure. Seules les
  -- lignes de MEME provenance sont touchees : la generation NEXUS d'un autre
  -- mois, ou d'un autre site, n'est jamais effacee par un import.
  with efface as (
    delete from public.planning_shifts
     where site_id = p_site
       and source = 'google_sheets'
       and date >= p_debut and date < p_fin
    returning 1
  )
  select count(*)::int into v_remplacees from efface;

  -- Un import ecrit un BROUILLON (`publie = false`), jamais un planning en
  -- vigueur. Le mandat du 19/09/2026 demande « import en brouillon ->
  -- previsualisation -> validation et publication explicite par le manager » :
  -- la publication reste donc le geste deja existant de l'ecran Planning, le
  -- meme que pour un planning genere par NEXUS. Il n'y a pas deux facons de
  -- publier selon la provenance.
  for v_ligne in select * from jsonb_array_elements(p_lot) loop
    v_emp := nullif(v_ligne ->> 'employee_id', '')::uuid;
    v_date := nullif(v_ligne ->> 'date', '')::date;
    v_quart := nullif(v_ligne ->> 'quart', '');
    v_heures := nullif(v_ligne ->> 'duree_heures', '')::numeric;
    v_statut := coalesce(nullif(v_ligne ->> 'statut', ''), 'travail_normal');
    v_ref := nullif(v_ligne ->> 'source_ref', '');
    v_transfert := nullif(v_ligne ->> 'site_transfert', '');

    if v_emp is null or v_date is null or v_quart is null or v_ref is null then
      raise exception using errcode = '22004',
        message = format('Import de planning : ligne incomplete (%s).', v_ligne::text),
        hint = 'Chaque ligne doit nommer l''employe, la date, le quart et la case d''origine (`source_ref`).';
    end if;

    if v_date < p_debut or v_date >= p_fin then
      raise exception using errcode = '22004',
        message = format('Import de planning : la ligne du %s sort de la periode importee (%s a %s exclus).', v_date, p_debut, p_fin),
        hint = 'Un import ne doit ecrire que ce que sa periode couvre, sinon il laisse derriere lui des jours que rien ne remplace.';
    end if;

    if v_ref = any(v_refs) then
      raise exception using errcode = '23505',
        message = format('Import de planning : la case « %s » apparait deux fois dans le lot.', v_ref);
    end if;
    v_refs := v_refs || v_ref;

    -- L'employe doit appartenir a CE site. Sans ce controle, un onglet mal
    -- choisi ecrirait le planning d'une autre station.
    if not exists (select 1 from public.employees e where e.id = v_emp and e.site_id = p_site) then
      raise exception using errcode = '23503',
        message = format('Import de planning : l''employe de la case « %s » n''appartient pas au site « %s ».', v_ref, p_site),
        hint = 'Corrigez l''alias dans Parametres Station, ou l''en-tete de la colonne dans le classeur.';
    end if;

    v_debut_h := null; v_fin_h := null;
    select ch.heure_debut, ch.heure_fin into v_debut_h, v_fin_h
      from public.calculer_horaires_quart(p_site, v_quart, v_date) ch;
    if v_debut_h is null then v_sans_horaire := v_sans_horaire + 1; end if;

    insert into public.planning_shifts (
      site_id, employee_id, date, quart, statut, duree_heures,
      heure_debut, heure_fin, site_transfert,
      publie, genere_par, source, import_id, source_ref
    ) values (
      p_site, v_emp, v_date, v_quart, v_statut, v_heures,
      v_debut_h, v_fin_h, v_transfert,
      false, p_par, 'google_sheets', p_import_id, v_ref
    );
    v_ecrites := v_ecrites + 1;
  end loop;

  return query select v_ecrites, v_remplacees, v_sans_horaire;
end;
$fn$;

comment on function public.importer_planning_google(text, date, date, jsonb, uuid, uuid) is
  'Ecrit un lot de planning importe depuis Google Sheets, deja controle par le '
  'manager. Ne lit pas le classeur et ne devine rien : les heures viennent du '
  'Sheet, les horaires theoriques de `calculer_horaires_quart`, et une ligne '
  'sans horaire declare reste NULL plutot que fausse. Remplace la periode pour '
  'la seule provenance `google_sheets`.';

revoke all on function public.importer_planning_google(text, date, date, jsonb, uuid, uuid) from public;
grant execute on function public.importer_planning_google(text, date, date, jsonb, uuid, uuid) to authenticated;
