-- =====================================================================
-- S-3 · La prise de poste suivante clôture le service précédent
--       (05/09/2026 — bloqueur production « cycle de vie des shifts »)
--
-- S-1 a posé l'index `shifts_un_seul_service_en_cours`. Depuis, une
-- nouvelle prise de poste ÉCHOUE tant que l'ancien service reste ouvert :
-- la barrière fonctionne, mais elle bloque le parcours. S-3 rétablit le
-- parcours en implémentant enfin la clôture que le modèle nommait déjà —
-- `cloture_source = 'prise_de_poste_suivante'` existe dans la contrainte
-- shifts_cloture_source_check depuis l'origine, sans aucun écrivain.
--
-- BEFORE INSERT, ET NON AFTER — L'INDEX L'IMPOSE
--
-- L'index unique est évalué au moment de l'insertion. Avec un trigger
-- AFTER, l'insert échouerait AVANT que la clôture n'ait lieu : la prise de
-- poste serait purement impossible. Avec BEFORE, l'ancien service passe à
-- 'termine', sort de l'index partiel, et la nouvelle ligne entre.
-- Ce n'est pas un choix de style : AFTER ne peut pas fonctionner.
--
-- L'HEURE DE FIN
--
-- `new.heure_debut`, et rien d'autre. Ce n'est pas l'instant où l'employé
-- a cessé son activité précédente — nous l'ignorons, et S-1 a posé la
-- règle : on n'invente pas une heure de fin. C'est le fait vérifiable
-- qu'à cet instant un nouveau service a commencé, donc que l'ancien ne
-- peut plus être actif.
--
-- Contrairement à S-2, aucune construction de fuseau n'est nécessaire :
-- heure_debut est déjà un timestamptz porté par la ligne. Le piège C1/C2
-- — un couple date + time local laissé à l'interprétation de la session —
-- ne se présente pas ici.
--
-- SECURITY INVOKER, comme S-2 : update_shifts autorise déjà un employé à
-- modifier son propre service. Le trigger conserve exactement les droits
-- de l'appelant et ne crée aucun privilège.
-- =====================================================================

begin;

create or replace function public.nexus_cloturer_shift_precedent()
returns trigger language plpgsql as $fn$
declare
  v_ancien record;
  v_lignes int;
begin
  if new.statut is distinct from 'en_cours' then
    return new;  -- une insertion d'historique ne clôture rien
  end if;

  -- Le service actif : CET employé, CE site. `for update` sérialise deux
  -- prises de poste concurrentes ; sans lui, les deux feraient le travail
  -- avant que l'index ne les départage, avec un message moins clair.
  --
  -- `id <> new.id` est une ceinture : sur un véritable INSERT la ligne
  -- n'existe pas encore, mais le trigger ne doit jamais pouvoir se
  -- clôturer lui-même si son usage venait à changer.
  select sh.id, sh.heure_debut into v_ancien
    from public.shifts sh
   where sh.employee_id = new.employee_id
     and sh.site_id     = new.site_id
     and sh.statut      = 'en_cours'
     and sh.id         <> new.id
   order by sh.heure_debut desc
   limit 1
   for update;

  if v_ancien.id is null then
    return new;  -- première prise de poste : rien à clôturer, rien à signaler
  end if;

  -- CONTRÔLE CHRONOLOGIQUE — ce qui définit « suivante ».
  --
  -- Sans lui, un import ou une insertion rétroactive produirait ceci : un
  -- service actif commencé à 14:00, puis l'insertion historique d'un
  -- service de 09:00, et le trigger fermerait celui de 14:00 À 09:00 —
  -- une heure de fin antérieure à son heure de début.
  --
  -- Refus, jamais arbitrage : ni ignorer la clôture (l'index produirait
  -- une erreur incompréhensible), ni clôturer quand même (une durée
  -- négative). Le cas d'égalité est traité comme antérieur : deux
  -- services commençant au même instant ne se succèdent pas.
  if new.heure_debut <= v_ancien.heure_debut then
    raise exception
      'Prise de poste refusée : le service % est actif depuis %, postérieur ou égal à la nouvelle prise (%). Une insertion antérieure à un service actif n''est pas une prise de poste suivante.',
      v_ancien.id, v_ancien.heure_debut, new.heure_debut;
  end if;

  update public.shifts
     set statut         = 'termine',
         heure_fin      = new.heure_debut,
         cloture_source = 'prise_de_poste_suivante',
         cloture_le     = now()
   where id = v_ancien.id;

  get diagnostics v_lignes = row_count;

  -- Un UPDATE refusé par RLS n'affecte aucune ligne SANS lever
  -- d'exception. Sans ce contrôle on obtiendrait le symétrique du défaut
  -- de S-2 : un nouveau service ouvert, l'ancien resté actif, puis un
  -- échec d'index illisible.
  if v_lignes <> 1 then
    raise exception
      'Clôture du service précédent % impossible : % ligne(s) modifiée(s) au lieu de 1. La prise de poste est annulée pour ne pas laisser deux services ouverts.',
      v_ancien.id, v_lignes;
  end if;

  return new;
end;
$fn$;

comment on function public.nexus_cloturer_shift_precedent() is
  'S-3 (05/09/2026) — une nouvelle prise de poste clôture le service actif précédent du même employé sur le même site, dans la même transaction. heure_fin = heure_debut de la nouvelle prise : le seul instant défendable, celui où l''ancien service ne peut plus être actif. Refuse toute insertion antérieure ou égale au service actif — ce ne serait pas une prise de poste suivante. BEFORE INSERT car l''index shifts_un_seul_service_en_cours est évalué à l''insertion : en AFTER, la prise de poste serait impossible.';

drop trigger if exists nexus_cloturer_shift_precedent on public.shifts;
create trigger nexus_cloturer_shift_precedent
  before insert on public.shifts
  for each row
  execute function public.nexus_cloturer_shift_precedent();

commit;
