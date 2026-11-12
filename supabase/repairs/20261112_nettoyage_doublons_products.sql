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
--   0. le job pg_cron « nexus-simulateur-caisse » est arrêté en premier (il
--      doit exister, sinon rien n'est fait). Il tirait au hasard une ligne de
--      products toutes les 15 minutes et liait des ventes simulées à tous les
--      blocs ; l'arrêter fige les comptes. La fonction nexus_simulate_cash_sale
--      et les ventes simulées déjà créées sont conservées (aucune suppression
--      dans normalized_sales, raw_sales ni les tables de synchronisation) ;
--   1. le nombre de lignes de chaque bloc doit être exactement l'attendu,
--      sinon rien n'est fait ;
--   2. aucune table liée (clé étrangère vers products) ne doit référencer une
--      ligne à supprimer, sinon rien n'est fait. Seule exception, validée par
--      Frédéric le 12/11 : normalized_sales.product_id (ventes simulées) ;
--   2 bis. ces ventes sont d'abord sauvegardées (id, product_id d'origine) dans
--      public.normalized_sales_sauvegarde_20261112, puis rattachées à la ligne
--      équivalente d'un bloc conservé (même site, même code_barres ; à défaut
--      de code, même article ; période la plus recouvrante). Sans équivalent,
--      product_id passe à NULL. Le nombre de ventes n'est pas fixé d'avance :
--      il est journalisé, et plus aucune ne doit rester liée aux blocs retirés ;
--   3. les lignes supprimées sont copiées dans public.products_sauvegarde_20261112
--      (base de Production, fermée à anon et authenticated, jamais dans le
--      dépôt) avant la suppression ;
--   4. après suppression : les quatre blocs sont à zéro, le bloc conservé est
--      intact, et plus aucune période du site n'en recouvre une autre.
--
-- Relancer le simulateur si besoin (après le nettoyage) :
--   select cron.schedule('nexus-simulateur-caisse', '*/15 * * * *',
--     $cmd$select public.nexus_simulate_cash_sale('vito-sainte-marie');$cmd$);
--
-- Ne touche ni import_batches, ni import_rows_raw, ni import_row_results, ni
-- campagnes_nexus_imports (qui ne référence que des périodes, pas de lignes
-- de products).
--
-- Retour arrière : réinsérer depuis public.products_sauvegarde_20261112
-- (colonnes de products, hors sauvegarde_le), puis remettre product_id d'origine
-- dans normalized_sales depuis public.normalized_sales_sauvegarde_20261112.

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
  v_ventes integer;
  v_rattachees integer;
  v_orphelines integer;
begin
  -- 0. Arrêt du simulateur de caisse (premier geste, même transaction)
  if not exists (select 1 from cron.job where jobname = 'nexus-simulateur-caisse') then
    raise exception 'Refus : le job nexus-simulateur-caisse n''existe pas.';
  end if;
  perform cron.unschedule('nexus-simulateur-caisse');
  raise notice 'Job nexus-simulateur-caisse arrêté.';

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
    select k.conrelid::regclass::text as table_liee, a.attname as colonne, array_length(k.conkey, 1) as nb_cols,
           (k.conrelid = 'public.normalized_sales'::regclass and a.attname = 'product_id') as est_ventes
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
    if v_liees > 0 and not c.est_ventes then
      raise exception 'Refus : % référence % ligne(s) à supprimer.', c.table_liee, v_liees;
    end if;
  end loop;

  -- 2 bis. Ventes simulées : sauvegarde, puis rattachement au bloc conservé
  create table public.normalized_sales_sauvegarde_20261112 as
    select s.id, s.product_id, now() as sauvegarde_le
    from public.normalized_sales s
    where s.site = v_site
      and s.product_id in (
        select p.id from public.products p join _cibles_doublons x
          on x.periode_debut = p.periode_debut and x.periode_fin = p.periode_fin
        where p.site = v_site);
  get diagnostics v_ventes = row_count;
  alter table public.normalized_sales_sauvegarde_20261112 enable row level security;
  revoke all on public.normalized_sales_sauvegarde_20261112 from public, anon, authenticated;

  create temporary table _rattachement on commit drop as
    select distinct on (p.id) p.id as ancien_id, q.id as nouveau_id
    from public.products p
    join _cibles_doublons x on x.periode_debut = p.periode_debut and x.periode_fin = p.periode_fin
    join public.products q
      on q.site = p.site
     and q.periode_debut <= p.periode_fin and q.periode_fin >= p.periode_debut
     and ((p.code_barres is not null and q.code_barres = p.code_barres)
       or (p.code_barres is null and q.code_barres is null and q.article = p.article))
     and not exists (select 1 from _cibles_doublons y
                     where y.periode_debut = q.periode_debut and y.periode_fin = q.periode_fin)
    where p.site = v_site
    order by p.id,
             (least(p.periode_fin, q.periode_fin) - greatest(p.periode_debut, q.periode_debut)) desc,
             q.periode_fin desc, q.id;

  update public.normalized_sales s
    set product_id = r.nouveau_id
    from _rattachement r
    where s.site = v_site and s.product_id = r.ancien_id;
  get diagnostics v_rattachees = row_count;

  update public.normalized_sales s
    set product_id = null
    where s.site = v_site
      and s.product_id in (
        select p.id from public.products p join _cibles_doublons x
          on x.periode_debut = p.periode_debut and x.periode_fin = p.periode_fin
        where p.site = v_site);
  get diagnostics v_orphelines = row_count;

  raise notice 'Ventes simulées : % sauvegardées, % rattachées, % mises à NULL (sans équivalent).',
    v_ventes, v_rattachees, v_orphelines;
  if v_rattachees + v_orphelines <> v_ventes then
    raise exception 'Refus : % ventes sauvegardées mais % traitées.', v_ventes, v_rattachees + v_orphelines;
  end if;

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
