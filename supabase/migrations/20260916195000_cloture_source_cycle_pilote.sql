-- =====================================================================
-- P-3 · Le journal de clôture apprend à dire « personne ne l'a fermé »
--       (16/09/2026 — cycle de vie des services en phase pilote)
--
-- CE QUI MANQUE. `shifts_cloture_source_check` n'autorise que six valeurs :
-- employe, pointage_depart, manager, prise_de_poste_suivante,
-- systeme_legacy, test. Aucune ne décrit ce que NEXUS s'apprête à faire —
-- refermer seul un service qu'un jour précédent a laissé ouvert.
--
-- POURQUOI PAS UNE VALEUR EXISTANTE. « employe » serait faux : l'employé
-- n'a rien clôturé, il a rouvert l'application. « manager » serait faux
-- pour la même raison, et ferait porter à un humain une décision qu'aucun
-- humain n'a prise. « systeme_legacy » désigne la reprise d'historique du
-- 04/09, pas le fonctionnement courant. Écrire l'une des trois rendrait le
-- journal MENTEUR — et un motif faux survit à sa propre péremption.
--
-- Ce qui est en jeu n'est pas cosmétique : ce champ est la seule trace qui
-- permettra, demain, de distinguer « l'équipe pointe » de « NEXUS a fermé
-- à sa place ». Il décide de ce que la phase pilote pourra conclure.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS. Elle n'écrit aucune ligne, ne
-- clôture rien, et ne retire aucune valeur : les six anciennes restent
-- valides à l'identique. Une contrainte CHECK élargie ne peut invalider
-- aucune donnée existante.
-- =====================================================================

begin;

do $p3$
declare
  v_hors_liste int;
  v_def text;
  v_attendu text := 'CHECK (((cloture_source IS NULL) OR (cloture_source = ANY (ARRAY[''employe''::text, ''pointage_depart''::text, ''manager''::text, ''prise_de_poste_suivante''::text, ''systeme_legacy''::text, ''test''::text, ''cycle_pilote''::text]))))';
begin
  -- Garde d'entrée. Si une source hors liste existait déjà, la contrainte
  -- aurait été contournée quelque part : l'élargir masquerait la dérive au
  -- lieu de la révéler.
  select count(*) into v_hors_liste from public.shifts
   where cloture_source is not null
     and cloture_source not in ('employe','pointage_depart','manager','prise_de_poste_suivante','systeme_legacy','test');
  if v_hors_liste > 0 then
    raise exception 'P-3 interrompu : % service(s) portent une source de clôture hors de la liste actuelle. Cette dérive doit être examinée avant d elargir la contrainte.', v_hors_liste;
  end if;

  execute 'alter table public.shifts drop constraint if exists shifts_cloture_source_check';
  execute 'alter table public.shifts add constraint shifts_cloture_source_check check ('
       || 'cloture_source is null or cloture_source = any (array['
       || '''employe'',''pointage_depart'',''manager'',''prise_de_poste_suivante'',''systeme_legacy'',''test'',''cycle_pilote''])'
       || ')';

  -- Garde de sortie. Une contrainte EST son texte : on compare ce que
  -- Postgres a retenu, pas ce qu on croit avoir demandé. Un ordre différent
  -- ou une valeur perdue au passage ferait échouer ici.
  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conrelid = 'public.shifts'::regclass and conname = 'shifts_cloture_source_check';
  if v_def is null then
    raise exception 'P-3 interrompu : shifts_cloture_source_check absente apres recreation.';
  end if;
  if v_def <> v_attendu then
    raise exception 'P-3 interrompu : contrainte inattendue. Obtenu : %', v_def;
  end if;

  raise notice 'P-3 : cycle_pilote autorise comme source de cloture, six valeurs anterieures conservees.';
end;
$p3$;

comment on constraint shifts_cloture_source_check on public.shifts is
  'P-3 (16/09/2026) — sept sources de clôture. « cycle_pilote » désigne une clôture décidée par NEXUS lui-même, sans qu''aucun humain ne l''ait demandée ni qu''aucun départ n''ait été pointé : le service appartenait à un jour précédent. Elle s''accompagne toujours de heure_fin NULL — NEXUS referme, il n''invente pas la fin.';

commit;
