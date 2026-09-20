-- L'HORODATAGE DE `planning_shifts` APPARTIENT A LA BASE  — 19/09/2026
--
-- CE QUI EXISTAIT. `planning_shifts.genere_le` porte `default now()`. Sa
-- voisine `modifie_le` n'a NI default NI trigger, et la table ne portait
-- aucun trigger non interne. L'horodatage de modification etait donc pose par
-- les deux ecritures de publication de `NEXUS-Planning-v1.html`, sous la forme
-- `modifie_le: new Date().toISOString()` : l'horloge du NAVIGATEUR du manager.
--
-- POURQUOI CE N'EST PAS UN DETAIL. `modifie_le` est la seule trace de QUAND un
-- mois est devenu visible par l'equipe. Elle sert a departager deux versions
-- d'un meme mois, et a repondre « depuis quand ce planning faisait-il foi ? »
-- quand un retard ou une paye est conteste. Une horloge de poste peut avancer,
-- retarder, ou etre reglee a la main : la reponse dependait alors de la machine
-- depuis laquelle on avait clique. Un poste en retard de deux minutes suffit a
-- ecrire une modification ANTERIEURE a la precedente, sans rien signaler.
--
-- CE QUE `now()` REGLE, ET CE QU'IL NE TOUCHE PAS. `now()` rend un
-- `timestamptz`, c'est-a-dire un INSTANT, pas une heure locale : il ne rouvre
-- pas la question du fuseau de la station, qui porte sur la DATE ouvree et
-- reste tranchee par `planning_jour_station`. Une seule autorite pour l'heure
-- persistante, une seule pour le jour ouvre — aucune troisieme source.
--
-- CE QUE LE TRIGGER IMPOSE, et pourquoi il ecrase au lieu de completer :
--
--   · A l'UPDATE, `modifie_le := now()`. La valeur envoyee par le client est
--     IGNOREE, pas completee. Un `coalesce` laisserait l'autorite au
--     navigateur des lors qu'il envoie quelque chose — c'est exactement ce que
--     cette migration retire. Retirer la ligne du code de l'ecran ne suffit
--     pas : n'importe quel appel PostgREST direct la reposerait.
--
--   · A l'UPDATE, `genere_le := old.genere_le`. La date de GENERATION ne se
--     reecrit pas : elle date la naissance de la ligne, pas sa derniere
--     retouche.
--
--   · A l'INSERT, `genere_le := now()` et `modifie_le := null`. Une ligne qui
--     vient de naitre n'a pas ete modifiee ; lui donner un horodatage de
--     modification effacerait la distinction entre « jamais retouche depuis
--     l'import » et « republie depuis ».
--
-- PORTEE. Aucune des ecritures existantes ne pose `genere_le` ni `modifie_le` :
-- les huit `insert into planning_shifts` des migrations `20260919180000` et
-- `20260919200000` s'en remettent deja au default. Ce trigger ne change donc
-- le comportement d'aucun chemin d'ecriture connu, sauf celui qu'il vise.
--
-- CE QUI RESTE VOLONTAIREMENT AU CLIENT. `modifie_par` continue d'etre fourni
-- par l'ecran. Le mandat porte sur l'horodatage ; imposer `auth.uid()` ici
-- ecraserait l'auteur par NULL pour tout appel execute hors session
-- authentifiee (service_role, `security definer`). A arbitrer separement.

create or replace function public.planning_shifts_horodatage_serveur()
  returns trigger
  language plpgsql
  set search_path to 'public'
as $fn$
begin
  if tg_op = 'INSERT' then
    new.genere_le  := now();
    new.modifie_le := null;
    return new;
  end if;

  new.genere_le  := old.genere_le;
  new.modifie_le := now();
  return new;
end;
$fn$;

comment on function public.planning_shifts_horodatage_serveur() is
  'Trigger de `planning_shifts` : l''horodatage persistant vient de la base et '
  'non de l''horloge du navigateur. `modifie_le` est impose a `now()` a chaque '
  'update et laisse null a l''insert ; `genere_le` est fige apres la creation.';

drop trigger if exists trg_planning_shifts_horodatage_serveur on public.planning_shifts;
create trigger trg_planning_shifts_horodatage_serveur
  before insert or update on public.planning_shifts
  for each row execute function public.planning_shifts_horodatage_serveur();

-- Privileges. PostgreSQL accorde `execute` a PUBLIC sur toute fonction
-- nouvellement creee, et Supabase double cela de `grant` nommes pour `anon` et
-- `authenticated` : un `revoke ... from public` seul ne fermerait rien. Une
-- fonction trigger n'a besoin d'aucun de ces droits pour etre declenchee.
revoke all on function public.planning_shifts_horodatage_serveur() from public;
revoke all on function public.planning_shifts_horodatage_serveur() from anon;
revoke all on function public.planning_shifts_horodatage_serveur() from authenticated;
