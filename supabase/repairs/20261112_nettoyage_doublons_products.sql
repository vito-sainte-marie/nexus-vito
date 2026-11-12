-- NEXUS — nettoyage des doublons de `products`, site vito-sainte-marie.
-- Préparé le 12/11/2026 à la demande de Guardian (6821543606, modifiée par
-- 6821628271). NE PAS EXÉCUTER sans le GO écrit de Frédéric sur CE fichier.
--
-- Pourquoi : les imports mensuels du 12/11 recouvrent des blocs plus anciens,
-- ce qui compte deux fois le même chiffre (chargerTrajectoire additionne tous
-- les blocs par mois de début).
--
-- Blocs retirés (période exacte, nombre de lignes attendu) :
--   01/06 au 30/06  828  nouveau : juin est déjà dans le bloc 01/04 au 30/06
--   01/07 au 23/07  759  ancien, couvert par le mois de juillet
--   24/07 au 06/08  709  ancien, couvert par juillet et 01/08 au 23/08
--   07/08 au 23/08  730  ancien, couvert par 01/08 au 23/08
-- Bloc conservé : 01/04 au 30/06 (1 008 lignes), seule source d'avril et mai.
-- Le lot de mai (import_batches, 01/05 au 31/05, review_required) n'est pas
-- touché et ne doit jamais être publié.
--
-- Garde-fous, dans une seule transaction :
--   1. le nombre de lignes de chaque bloc doit être exactement l'attendu,
--      sinon rien n'est fait ;
--   2. aucune table liée (clé étrangère vers products) ne doit référencer une
--      ligne à supprimer, sinon rien n'est fait ;
--   3. les lignes supprimées sont copiées dans public.products_sauvegarde_20261112
--      (base de Production, fermée à anon et authenticated, jamais dans le
--      dépôt) avant la suppression ;
--   4. après suppression : les quatre blocs sont à zéro, le bloc conservé est
--      intact, et plus aucune période du site n'en recouvre une autre.
--
-- Ne touche ni import_batches, ni import_rows_raw, ni import_row_results, ni
-- campagnes_nexus_imports (qui ne référence que des périodes, pas de lignes
-- de products).
--
-- Retour arrière : réinsérer depuis public.products_sauvegarde_20261112
-- (colonnes de products, hors sauvegarde_le).

begin;

create temporary table _cibles_doublons (
  periode_debut date not null,
  periode_fin   date not null,
  attendu       integer not null
) on commit drop;
insert into _cibles_doublons values
  ('2026-06-01', '2026-06-30', 828),
  ('2026-07-01', '2026-07-23', 759),
  ('2026-07-24', '2026-08-06', 709),
  ('2026-08-07', '2026-08-23', 730);

do $$
declare
  v_site constant text := 'vito-sainte-marie';
  c record;
  v_nb integer;
  v_liees integer;
begin
  -- 1. Comptes exacts
  for c in select * from _cibles_doublons loop
    select count(*) into v_nb from public.products
      where site = v_site and periode_debut = c.periode_debut and periode_fin = c.periode_fin;
    if v_nb <> c.attendu then
      raise exception 'Refus : % au % compte % lignes, % attendues.', c.periode_debut, c.periode_fin, v_nb, c.attendu;
    end if;
  end loop;
  select count(*) into v_nb from public.products
    where site = v_site and periode_debut = date '2026-04-01' and periode_fin = date '2026-06-30';
  if v_nb <> 1008 then
    raise exception 'Refus : le bloc conservé 01/04 au 30/06 compte % lignes, 1008 attendues.', v_nb;
  end if;

  -- 2. Tables liées : toute clé étrangère vers products
  for c in
    select k.conrelid::regclass::text as table_liee, a.attname as colonne, array_length(k.conkey, 1) as nb_cols
    from pg_constraint k
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
    where k.contype = 'f' and k.confrelid = 'public.products'::regclass
  loop
    if c.nb_cols <> 1 then
      raise exception 'Refus : clé étrangère composite depuis % non prévue.', c.table_liee;
    end if;
    execute format(
      'select count(*) from %s t where t.%I in (
         select p.id from public.products p join _cibles_doublons x
           on x.periode_debut = p.periode_debut and x.periode_fin = p.periode_fin
         where p.site = %L)', c.table_liee, c.colonne, v_site)
      into v_liees;
    raise notice 'Table liée % (%) : % ligne(s) référencent les blocs à retirer.', c.table_liee, c.colonne, v_liees;
    if v_liees > 0 then
      raise exception 'Refus : % référence % ligne(s) à supprimer.', c.table_liee, v_liees;
    end if;
  end loop;

  -- 3. Sauvegarde dans la base, fermée aux rôles applicatifs
  create table public.products_sauvegarde_20261112 as
    select p.*, now() as sauvegarde_le
    from public.products p
    join _cibles_doublons x on x.periode_debut = p.periode_debut and x.periode_fin = p.periode_fin
    where p.site = v_site;
  get diagnostics v_nb = row_count;
  alter table public.products_sauvegarde_20261112 enable row level security;
  revoke all on public.products_sauvegarde_20261112 from public, anon, authenticated;
  if v_nb <> 3026 then
    raise exception 'Refus : la sauvegarde compte % lignes, 3026 attendues.', v_nb;
  end if;

  -- Suppression
  delete from public.products p
    using _cibles_doublons x
    where p.site = v_site and p.periode_debut = x.periode_debut and p.periode_fin = x.periode_fin;
  get diagnostics v_nb = row_count;
  if v_nb <> 3026 then
    raise exception 'Refus : % lignes supprimées, 3026 attendues.', v_nb;
  end if;

  -- 4. Contrôles après suppression
  select count(*) into v_nb from public.products p
    join _cibles_doublons x on x.periode_debut = p.periode_debut and x.periode_fin = p.periode_fin
    where p.site = v_site;
  if v_nb <> 0 then
    raise exception 'Refus : % lignes subsistent dans les blocs retirés.', v_nb;
  end if;
  select count(*) into v_nb from public.products
    where site = v_site and periode_debut = date '2026-04-01' and periode_fin = date '2026-06-30';
  if v_nb <> 1008 then
    raise exception 'Refus : le bloc conservé compte % lignes, 1008 attendues.', v_nb;
  end if;
  select count(*) into v_nb from (
    select distinct a.periode_debut, a.periode_fin
    from (select distinct periode_debut, periode_fin from public.products where site = v_site) a
    join (select distinct periode_debut, periode_fin from public.products where site = v_site) b
      on a.periode_debut <= b.periode_fin and b.periode_debut <= a.periode_fin
     and (a.periode_debut, a.periode_fin) <> (b.periode_debut, b.periode_fin)
  ) r;
  if v_nb <> 0 then
    raise exception 'Refus : % période(s) de products se recouvrent encore.', v_nb;
  end if;
end
$$;

commit;
