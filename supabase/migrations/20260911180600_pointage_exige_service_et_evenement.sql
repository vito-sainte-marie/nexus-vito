-- Un nouveau pointage porte son service. Aucun ne se cherche un service.
-- ============================================================================
-- LE REPLI QUI RESTAIT DANGEREUX. Le trigger de depart savait encore, faute de
-- `service_id`, fermer « le service en cours le plus recent ». C'est
-- exactement le mecanisme qui avait clos un service cree par une autre session
-- une seconde plus tot. Tant qu'un chemin d'approximation existe, il finit par
-- etre emprunte.
--
-- LA REGLE, garantie EN BASE et non par l'application :
--   * pointage historique deja present sans `service_id` : conserve tel quel,
--     ce trigger ne s'applique qu'aux INSERT ;
--   * nouveau pointage : `service_id` ET `client_event_id` obligatoires ;
--   * le service designe doit appartenir au MEME employe et au MEME site ;
--   * plus aucun service n'est recherche par approximation.
--
-- `service_id` reste NULLABLE au niveau de la colonne : c'est ce qui preserve
-- les douze exceptions historiques. La contrainte porte sur l'EVENEMENT
-- d'insertion, pas sur la forme de la table — une colonne NOT NULL aurait
-- exige d'inventer un service pour ces douze lignes.
--
-- ETAT MESURE LE 16/09/2026, AVANT DE RAPATRIER CE FICHIER AU DEPOT.
--
--   * Test (udljdqxerrbbbajxubfn) : migration inscrite, trigger
--     `nexus_pointage_exige_service` pose, et `nexus_cloturer_shift_au_depart`
--     n'a plus son repli — l'etat d'apres cette migration.
--   * Production (uzhjpqpctpvxytxpxoqz) : 20260911180000 a 180500 inscrites,
--     `20260911180600` ABSENTE, aucun trigger `nexus_pointage_exige_service`,
--     et la fonction de cloture porte ENCORE le repli « le service en cours le
--     plus recent ». Le defaut que ce fichier ferme est donc toujours ouvert
--     en Production.
--   * Depot : le fichier n'existait dans aucune ref fusionnee. Il vivait dans
--     `f682ed6`, sur une branche jamais rapatriee. Une migration appliquee sur
--     un environnement et absente du depot ne se relit nulle part.
--
-- ORDRE DE DEPLOIEMENT, NON REVERSIBLE : LE CODE D'ABORD, LE TRIGGER ENSUITE.
--
-- Le code servi en Production le 16/09/2026 (HEAD `faba562`, GitHub Pages sert
-- le depot brut) insere dans `public.pointages` SANS `service_id` ni
-- `client_event_id` — mesure faite sur `NEXUS-Pointage-v1.html` a cette
-- revision. Poser ce trigger sur cette Production-la refuserait TOUT pointage
-- avec 23502.
--
-- La panne ne se verrait pas le jour meme : `station_config.pointage_actif`
-- est a false pour `vito-sainte-marie` depuis le 03/09 et plus aucun pointage
-- n'est ecrit. Elle serait simplement ARMEE, et se declencherait le jour ou
-- quelqu'un rallume l'interrupteur, sans rapport visible avec le geste qui
-- l'aurait causee. C'est la pire forme de panne : differee et sans cause
-- apparente.
--
-- Le code qui envoie les deux colonnes est celui du lot 1 (branche
-- `lot1-pointage-service-courant`). Cette migration ne doit etre APPLIQUEE en
-- Production qu'apres que ce code y est SERVI — pas seulement fusionne.
--
-- `test_migration_apres_le_code_20260916.js` tient cet invariant du cote du
-- depot : tant que ce fichier est present, le chemin d'ecriture de pointage
-- doit envoyer les deux colonnes. La garde ne peut pas juger ce qui est
-- applique sur un serveur ; elle juge ce qui partirait ensemble.
-- ============================================================================

create or replace function public.nexus_pointage_exige_service()
returns trigger
language plpgsql
as $function$
declare
  v_emp uuid;
  v_site text;
begin
  if new.service_id is null then
    raise exception
      'Pointage refuse : service_id est obligatoire depuis le 11/09/2026. Aucun service ne doit etre recherche par approximation. Les pointages anterieurs conservent leur service_id nul et ne sont pas concernes.'
      using errcode = '23502';
  end if;

  if new.client_event_id is null then
    raise exception
      'Pointage refuse : client_event_id est obligatoire depuis le 11/09/2026. Sans identifiant idempotent, une reprise hors ligne peut creer un doublon.'
      using errcode = '23502';
  end if;

  select sh.employee_id, sh.site_id into v_emp, v_site
    from public.shifts sh where sh.id = new.service_id;

  if v_emp is null then
    raise exception 'Pointage refuse : le service % n''existe pas.', new.service_id
      using errcode = '23503';
  end if;

  if v_emp is distinct from new.employee_id or v_site is distinct from new.site then
    raise exception
      'Pointage refuse : le service % appartient a l''employe % sur le site %, pas a l''employe % sur le site %.',
      new.service_id, v_emp, v_site, new.employee_id, new.site
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

drop trigger if exists nexus_pointage_exige_service on public.pointages;
create trigger nexus_pointage_exige_service
  before insert on public.pointages
  for each row execute function public.nexus_pointage_exige_service();

-- Le trigger de depart perd son repli : il ne connait plus que SON service.
create or replace function public.nexus_cloturer_shift_au_depart()
returns trigger
language plpgsql
as $function$
declare
  v_shift_id uuid;
  v_debut    timestamptz;
  v_timezone text;
  v_fin      timestamptz;
  v_lignes   int;
begin
  select s.timezone into v_timezone from public.sites s where s.site_id = new.site;
  if v_timezone is null or btrim(v_timezone) = ''
     or not exists (select 1 from pg_timezone_names where name = v_timezone) then
    raise exception 'Cloture impossible : le commerce % ne declare aucun fuseau exploitable.', new.site;
  end if;
  v_fin := (new.date + new.heure) at time zone v_timezone;

  select sh.id, sh.heure_debut into v_shift_id, v_debut
    from public.shifts sh
   where sh.id          = new.service_id
     and sh.employee_id = new.employee_id
     and sh.site_id     = new.site
     and sh.statut      = 'en_cours';

  if v_shift_id is null then
    raise notice 'Depart sans service actif correspondant (employe %, service %) : aucune cloture inventee.',
      new.employee_id, new.service_id;
    return new;
  end if;

  if v_fin < v_debut then
    raise notice 'Depart a % anterieur au debut du service % (%) : aucune cloture appliquee.',
      v_fin, v_shift_id, v_debut;
    return new;
  end if;

  update public.shifts
     set statut = 'termine', heure_fin = v_fin,
         cloture_source = 'pointage_depart', cloture_le = now()
   where id = v_shift_id;

  get diagnostics v_lignes = row_count;
  if v_lignes <> 1 then
    raise exception 'Cloture du service % impossible : % ligne(s) modifiee(s) au lieu de 1.', v_shift_id, v_lignes;
  end if;
  return new;
end;
$function$;
