-- ---------------------------------------------------------------------------
-- BASCULER LA SOURCE DE PLANNING SANS POUVOIR OUBLIER LA TRACE
-- 19/09/2026
--
-- `20260919180000` a pose l'invariant : `station_config.planning_source` et
-- `planning_source_periodes` ne peuvent pas diverger. La garde est un
-- CONSTRAINT TRIGGER DEFERRABLE, verifie au COMMIT, ce qui rend l'ordre des
-- deux ecritures indifferent DANS UNE MEME TRANSACTION.
--
-- Or l'ecran n'a pas de transaction. Depuis PostgREST, l'update du reglage et
-- l'insert de la periode sont deux requetes HTTP, donc deux transactions : la
-- premiere des deux commite seule et la garde la refuse. Mesure sur Test le
-- 19/09/2026, dans une transaction annulee :
--
--     A. update station_config seul  -> REFUSE 23514
--        « le reglage dit google_sheets alors que l'historique rend nexus »
--     B. update + insert ensemble    -> ACCEPTE
--
-- Autrement dit : depuis `20260919180000`, le bouton « Enregistrer la source
-- officielle » de Parametres Station ne peut plus aboutir. La garde est bonne
-- — elle a refuse exactement ce qu'elle devait refuser, une bascule sans trace
-- — mais plus personne ne dispose du geste qu'elle exige. C'est ce que cette
-- migration rend : le geste complet, en une seule transaction.
--
-- LA CORRECTION DU JOUR MEME.
-- `planning_source_periodes` etait, avant cette migration, en ajout seul, et
-- sa cle `(site, date_effet)`
-- est unique. Un manager qui bascule puis se ravise dans la meme journee
-- heurterait donc un 23505 sans recours. L'ajout seul protege une chose
-- precise : les journees DEJA ECOULEES, que Paye a peut-etre deja lues. Une
-- ligne datee d'aujourd'hui n'en couvre aucune. On ouvre donc la mise a jour,
-- bornee a `date_effet >= jour de la station` : le present se corrige, le
-- passe reste intouchable. La borne vit dans la POLICY et non dans une
-- fonction, pour qu'elle tienne aussi contre un appel direct a la table.
--
-- Aucune fonction `security definer` ne porte la bascule, et c'est delibere :
-- elle est exactement aussi permise que ce que la RLS autorise deja a
-- l'appelant, comme `importer_planning_google`. Une fonction definer aurait
-- duplique les policies, et une duplication finit toujours par deriver.
--
-- CETTE MIGRATION NE BASCULE AUCUN SITE. Elle n'ecrit aucune ligne dans
-- `planning_source_periodes` et ne touche a aucun `planning_source`.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Lire le jour de SA station, sans pouvoir sonder celui des autres.
-- ---------------------------------------------------------------------------
-- `planning_jour_station` est fermee a `authenticated` a dessein
-- (20260919180000) : elle lit `sites` hors RLS, et l'ouvrir donnerait le
-- fuseau de n'importe quel site a qui en connait l'identifiant. Mais la
-- bascule a besoin du jour de la station, et l'ecran aussi pour annoncer a
-- partir de quand elle prend effet. D'ou ces deux ouvertures etroites, qui ne
-- repondent que sur le site de l'appelant.
--
-- Mesure : sans elles, la partie B de
-- `outils/epreuve-bascule-source-planning.sql` echoue des sa premiere ligne
-- sur « permission denied for function planning_jour_station ».

-- Celle-ci LEVE hors de son site : appelee explicitement, le refus doit parler.
create or replace function public.planning_jour_de_ma_station(p_site text)
  returns date
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $fn$
begin
  if auth.uid() is not null
     and p_site is distinct from (select public.current_employee_site_id()) then
    raise exception using errcode = '42501',
      message = 'Jour de station : seul le sien se consulte.',
      hint = 'Le fuseau horaire d''un site ne se demande pas par son identifiant.';
  end if;
  return public.planning_jour_station(p_site);
end;
$fn$;

comment on function public.planning_jour_de_ma_station(text) is
  'Jour ouvre dans le fuseau de la STATION, pour le site de l''appelant '
  'uniquement. Ouverture etroite de `planning_jour_station`, qui reste fermee '
  'a `authenticated`. Hors session authentifiee (service_role), aucun site '
  'n''etant le sien, tous sont lisibles.';

-- Celle-la ne leve JAMAIS : elle sert de borne a une policy, ou les `and` ne
-- s'evaluent pas dans un ordre garanti. Une exception y transformerait une
-- ligne simplement hors perimetre en panne.
create or replace function public.planning_bascule_modifiable(p_site text, p_date_effet date)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $fn$
  select p_site = (select public.current_employee_site_id())
     and p_date_effet >= public.planning_jour_station(p_site);
$fn$;

comment on function public.planning_bascule_modifiable(text, date) is
  'Vrai si cette bascule est celle du jour de la station de l''appelant, ou '
  'une bascule a venir. Faux partout ailleurs, sans jamais lever : borne de la '
  'policy `update_planning_source_periodes`.';

revoke all on function public.planning_jour_de_ma_station(text) from public;
revoke all on function public.planning_jour_de_ma_station(text) from anon;
grant execute on function public.planning_jour_de_ma_station(text) to authenticated;
grant execute on function public.planning_jour_de_ma_station(text) to service_role;

revoke all on function public.planning_bascule_modifiable(text, date) from public;
revoke all on function public.planning_bascule_modifiable(text, date) from anon;
grant execute on function public.planning_bascule_modifiable(text, date) to authenticated;
grant execute on function public.planning_bascule_modifiable(text, date) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Corriger la bascule du jour, jamais celle d'hier.
-- ---------------------------------------------------------------------------
drop policy if exists update_planning_source_periodes on public.planning_source_periodes;
create policy update_planning_source_periodes on public.planning_source_periodes
  for update to authenticated
  using (
    site = (select public.current_employee_site_id())
    and (select public.current_employee_role()) in ('manager', 'gerant')
    and public.planning_bascule_modifiable(site, date_effet)
  )
  with check (
    site = (select public.current_employee_site_id())
    and (select public.current_employee_role()) in ('manager', 'gerant')
    and public.planning_bascule_modifiable(site, date_effet)
  );

comment on policy update_planning_source_periodes on public.planning_source_periodes is
  'Une bascule du jour meme (ou datee du futur) se corrige ; une bascule deja '
  'ecoulee ne se reecrit pas. La borne est evaluee dans le fuseau de la '
  'STATION et non dans celui de l''appareil.';

-- `20260919180000` n'accordait que `select, insert` a `authenticated`. Mesure
-- sur Test le 19/09/2026 : la table lui rendait
-- `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE`. En cause,
-- l'`alter default privileges` de Supabase, qui accorde tout sur chaque table
-- nouvellement creee dans `public` : un `grant` ne restreint rien, il ajoute,
-- et les `revoke` de ce depot visaient `public` et `anon`, pas `authenticated`.
--
-- DELETE etait sans effet — aucune policy DELETE n'existe, donc zero ligne
-- supprimee — mais TRUNCATE ne passe pas par la RLS DU TOUT : un manager
-- authentifie pouvait vider l'historique des bascules de tous les sites. Une
-- table dont la raison d'etre est que le passe ne se reecrit pas ne peut pas
-- reposer sur l'absence d'une policy.
--
-- Le defaut est general au schema (171 tables sur 172 rendent TRUNCATE a
-- `authenticated`) et n'est pas traite ici : ce lot referme la table qu'il
-- introduit, et la dette est rapportee telle quelle.
revoke all on table public.planning_source_periodes from authenticated;
grant select, insert, update on table public.planning_source_periodes to authenticated;

-- Le commentaire pose par `20260919180000` annoncait une table « en AJOUT
-- SEUL : aucune policy de mise a jour ni de suppression n'existe pour
-- `authenticated` ». Ce n'est plus exact : une correction du jour meme est
-- desormais possible. La raison d'etre, elle, n'a pas bouge — ce qui est
-- ecoule ne se reecrit pas — et le commentaire doit le dire sans mentir sur
-- les moyens.
comment on table public.planning_source_periodes is
  'Historique des bascules de source de planning, par site. Une ligne = '
  '« a partir de cette date d''effet, la source qui fait foi pour ce site est '
  'celle-ci ». C''est le registre que lit `source_planning_applicable`, et '
  'donc `v_planning_officiel`. Le passe n''y est pas reecrit : `authenticated` '
  'n''a ni DELETE ni TRUNCATE, et la policy `update_planning_source_periodes` '
  'ne laisse corriger qu''une bascule du jour meme ou datee du futur, sans '
  'jamais en changer ni le site ni la date d''effet.';

-- ---------------------------------------------------------------------------
-- 3. Le temoin d'une correction n'est pas celui d'une bascule neuve.
-- ---------------------------------------------------------------------------
-- `source_precedente` repond a « qu'est-ce qui faisait foi la VEILLE ». Sur un
-- insert, l'historique le dit. Sur une correction, il ne le dit plus : la
-- ligne corrigee est deja en table a cette date, et
-- `source_planning_applicable` la trouverait ELLE-MEME. Le manager qui revient
-- a NEXUS le jour ou il etait passe a Google Sheets verrait donc s'inscrire
-- « precedente : google_sheets » — la source qu'il vient d'annuler, presentee
-- comme celle de la veille. La veille n'a pas change : on conserve le temoin.
--
-- Le site et la date d'effet sont figes. Corriger une bascule, c'est changer
-- ce vers quoi elle va, pas la deplacer ailleurs ou la redater : redater une
-- ligne vers le futur puis la ramener contournerait la borne de la policy.
create or replace function public.planning_source_periodes_normalise()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $fn$
declare
  v_jour date;
begin
  if tg_op = 'UPDATE' then
    if new.site is distinct from old.site or new.date_effet is distinct from old.date_effet then
      raise exception
        using errcode = '23514',
              message = 'Correction de bascule : le site et la date d''effet ne se modifient pas.',
              hint = 'Corriger une bascule change la source vers laquelle elle va. Pour une autre date, enregistrez une nouvelle bascule.';
    end if;
    new.source_precedente := old.source_precedente;
  else
    new.source_precedente := public.source_planning_applicable(new.site, new.date_effet);
  end if;

  if auth.uid() is not null then
    new.auteur_id := auth.uid();
  end if;
  new.change_le := now();

  v_jour := public.planning_jour_station(new.site);
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
  'Trigger de `planning_source_periodes` : calcule `source_precedente` a '
  'l''insert et la CONSERVE a la correction, impose `auteur_id` a '
  'l''utilisateur authentifie, fige site et date d''effet en correction, et '
  'exige un motif pour une date d''effet anterieure au jour de la station.';

drop trigger if exists trg_planning_source_periodes_normalise on public.planning_source_periodes;
create trigger trg_planning_source_periodes_normalise
  before insert or update on public.planning_source_periodes
  for each row execute function public.planning_source_periodes_normalise();

-- ---------------------------------------------------------------------------
-- 4. Le geste complet, en une transaction.
-- ---------------------------------------------------------------------------
-- `security invoker` (le defaut) : la fonction n'accorde rien. Un employe qui
-- n'a pas le droit d'ecrire `station_config` ou d'inserer une periode se
-- heurte aux memes policies que s'il l'avait tente a la main. Elle ne fait
-- qu'une chose que l'ecran ne peut pas faire : tenir les deux ecritures dans
-- la meme transaction, donc sous la meme verification differee.
--
-- La date d'effet est le JOUR DE LA STATION, et rien d'autre. Elle n'est pas
-- un parametre : `20260919180000` a pose qu'une bascule ne se programme pas en
-- avance du cote du reglage, parce que `planning_source` ne porte pas de date.
-- Laisser l'ecran proposer une date rouvrirait exactement ce que cette regle
-- ferme.
create or replace function public.basculer_source_planning(
  p_site   text,
  p_source text,
  p_motif  text default null
) returns jsonb
  language plpgsql
  set search_path to 'public'
as $fn$
declare
  v_jour       date;
  v_precedente text;
  v_lignes     integer;
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

  v_jour := public.planning_jour_de_ma_station(p_site);

  update public.station_config
     set planning_source = p_source,
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
  values (p_site, p_source, v_jour, nullif(btrim(coalesce(p_motif, '')), ''))
  on conflict (site, date_effet) do update
     set source = excluded.source,
         motif  = excluded.motif;

  return jsonb_build_object(
    'site',              p_site,
    'source',            p_source,
    'source_precedente', v_precedente,
    'date_effet',        v_jour,
    'inchangee',         v_precedente is not distinct from p_source
  );
end;
$fn$;

comment on function public.basculer_source_planning(text, text, text) is
  'Declare la source officielle de planning d''un site ET en laisse la trace, '
  'dans la meme transaction : `station_config.planning_source` et une ligne '
  '`planning_source_periodes` datee du jour de la STATION. Les deux ecritures '
  'separees que ferait un ecran seraient refusees par '
  '`trg_planning_source_coherence`. `security invoker` : n''accorde aucun '
  'droit, la RLS tranche.';

revoke all on function public.basculer_source_planning(text, text, text) from public;
revoke all on function public.basculer_source_planning(text, text, text) from anon;
grant execute on function public.basculer_source_planning(text, text, text) to authenticated;
grant execute on function public.basculer_source_planning(text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Dette du lot precedent : `revoke from public` ne ferme pas `anon`.
-- ---------------------------------------------------------------------------
-- `20260919200000` revoque `importer_planning_google` de `public` seulement.
-- Supabase accorde `execute` a `anon` par un grant NOMME, qu'un revoke sur
-- PUBLIC ne touche pas : la fonction restait appelable sans session. La RLS
-- l'aurait arretee — `anon` ne lit aucune `station_config` — mais une garde ne
-- se repose pas sur la suivante.
revoke all on function public.importer_planning_google(text, date, date, jsonb, uuid, uuid) from anon;
