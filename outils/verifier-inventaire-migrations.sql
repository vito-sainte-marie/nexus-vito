-- NEXUS — le dépôt doit pouvoir reconstruire le schéma de la base
-- (16/09/2026, lot 4).
--
-- CE QUI A MORDU, ET POURQUOI CET OUTIL EXISTE
-- --------------------------------------------
-- Le 16/09/2026, 22 migrations étaient inscrites dans
-- `supabase_migrations.schema_migrations` de Production alors qu'AUCUN fichier
-- ne les portait dans le dépôt : elles avaient été appliquées via le tableau
-- de bord ou l'API. Conséquence : partir du dépôt seul ne reconstruisait pas le
-- schéma réel. Rien ne le signalait, parce que rien ne comparait jamais les
-- deux inventaires — la suite de non-régression n'ouvre aucune connexion, et
-- l'empreinte d'artefact ne mesure que le dossier, jamais la base.
--
-- Cet outil est la comparaison manquante. Il tient dans une commande :
--
--   psql "$URL" -v ON_ERROR_STOP=1 -f outils/verifier-inventaire-migrations.sql
--
-- Il ne lit pas le disque du serveur : `\copy ... from program` s'exécute côté
-- CLIENT. Il faut donc le lancer depuis la racine du dépôt, sinon le `ls`
-- retourne vide et l'outil le dit plutôt que de conclure à tort.
--
-- Transaction close par ROLLBACK : cet outil n'écrit rien, n'applique rien et
-- ne régularise rien. Constater une absence n'autorise pas à la combler.
--
-- ÉPROUVÉ LE 16/09/2026, pas seulement écrit. Le bloc `do $$` a été exécuté
-- verbatim contre `nexus-test` et ses 273 versions réellement appliquées :
--   · chemin nominal, chaque version ayant son fichier      → aucun échec ;
--   · deux versions privées de fichier, une seule déclarée
--     en absence assumée                                    → EXACTEMENT une
--     signalée, nommée — l'exclusion ne masque donc pas la voisine ;
--   · la commande du `\copy`, lancée seule depuis la racine → 261 noms, et
--     0 depuis ailleurs, ce qui arme bien la garde « dossier non lu ».
-- La cohérence hors ligne du dossier et l'honnêteté de la liste d'absences
-- sont éprouvées séparément par `test_inventaire_migrations_20260916.js`
-- (campagne de mutation : sept mutations, sept mordues).

begin;

create temporary table nexus_fichiers_depot (nom text) on commit drop;

\copy nexus_fichiers_depot (nom) from program 'ls -1 supabase/migrations/*.sql 2>/dev/null | xargs -n1 basename'

do $$
declare
  -- Absences CONNUES et ASSUMÉES : migration appliquée en base dont le fichier
  -- manque volontairement au dépôt. Toute entrée ici doit porter son motif.
  -- La liste est délibérément stricte dans les DEUX sens : le test hors ligne
  -- `test_inventaire_migrations_20260916.js` échoue si l'une de ces versions
  -- retrouve un fichier sans être retirée d'ici. Une dette se retire, elle ne
  -- se périme pas toute seule.
  --
  --   20260914224313 — hotfix RLS `audits_caisse` appliqué hors bande le
  --   14/09/2026 pour refermer une lecture ouverte au site entier. Sa
  --   régularisation est une opération distincte, explicitement mise hors du
  --   périmètre du lot 4.
  ABSENCES_ASSUMEES text[] := array['20260914224313'];

  n_depot   int;
  n_base    int;
  manquants text := '';
  attente   text := '';
  n_manque  int := 0;
  n_attente int := 0;
  r record;
begin
  select count(*) into n_depot from nexus_fichiers_depot;
  if n_depot = 0 then
    raise exception
      'Aucun fichier lu dans supabase/migrations : lancez cet outil depuis la racine du dépôt. (Sans cette garde, un dossier illisible se lirait comme une base sans dette.)';
  end if;

  select count(*) into n_base from supabase_migrations.schema_migrations;

  -- 1. Appliqué en base, aucun fichier au dépôt. C'est LA dette : le dépôt ne
  --    peut pas reconstruire le schéma.
  for r in
    select m.version
      from supabase_migrations.schema_migrations m
     where not exists (
             select 1 from nexus_fichiers_depot f
              where f.nom like m.version || '\_%'
           )
       and not (m.version = any (ABSENCES_ASSUMEES))
     order by m.version
  loop
    n_manque := n_manque + 1;
    manquants := manquants || E'\n    · ' || r.version;
  end loop;

  -- 2. Fichier au dépôt, non appliqué. Ce n'est PAS une anomalie en soi : une
  --    migration peut légitimement attendre son déploiement. On la liste pour
  --    que l'écart soit chiffré, jamais pour la faire échouer.
  for r in
    select f.nom
      from nexus_fichiers_depot f
     where not exists (
             select 1 from supabase_migrations.schema_migrations m
              where f.nom like m.version || '\_%'
           )
     order by f.nom
  loop
    n_attente := n_attente + 1;
    attente := attente || E'\n    · ' || r.nom;
  end loop;

  raise notice ' ';
  raise notice 'Inventaire des migrations';
  raise notice '  dépôt : % fichiers', n_depot;
  raise notice '  base  : % versions appliquées', n_base;
  raise notice '  absences assumées : % (déclarées dans cet outil)', array_length(ABSENCES_ASSUMEES, 1);

  if n_attente > 0 then
    raise notice ' ';
    raise notice '  % fichier(s) au dépôt, pas encore appliqué(s) — informatif :%', n_attente, attente;
  end if;

  if n_manque > 0 then
    raise exception E'% migration(s) appliquée(s) en base sans aucun fichier au dépôt :%\n\n  Le dépôt ne peut pas reconstruire ce schéma. Récupérez les fichiers, ou déclarez l''absence et son motif dans ABSENCES_ASSUMEES.', n_manque, manquants;
  end if;

  raise notice ' ';
  raise notice 'VERT — toute version appliquée a son fichier au dépôt, hors absences assumées.';
end $$;

rollback;
