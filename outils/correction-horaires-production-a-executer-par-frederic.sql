-- CORRECTION DES HORAIRES CANONIQUES — Vito Sainte-Marie Usine
-- Arbitrage de Frédéric Bragance, 09/09/2026.
--
-- À EXÉCUTER PAR FRÉDÉRIC SUR PRODUCTION. Claude ne l'a pas appliquée : une
-- écriture sur station_config de Production est une opération Production.
--
--   psql "$URL_PRODUCTION" -v ON_ERROR_STOP=1 -f outils/correction-horaires-production-a-executer-par-frederic.sql
--
-- ─── POURQUOI CE FICHIER EST AU DÉPÔT (16/09/2026) ────────────────────────
-- Il ne l'était pas. Il n'existait que sur quatre worktrees locaux, apporté
-- par le seul commit `dee04ba`, jamais fusionné. Une écriture Production en
-- attente qui ne vit que sur le poste d'une machine disparaît avec le
-- worktree qui la porte, sans que rien ne le signale. C'est la même dette que
-- celle des 21 migrations rapatriées le même jour, à une échelle plus petite
-- et avec un effet plus direct : ici, ce qui se perd est une DÉCISION.
--
-- ─── CE QUE ÇA CHANGE, ET POURQUOI ────────────────────────────────────────
--   quart1.fin_normal  12:45 -> 13:15   (chevauchement 5 min -> 35 min)
--   quart1.fin_etendu  13:45 -> 14:15   (chevauchement 5 min -> 35 min)
--   quart2.fin_normal  20:05 -> 20:10   (durée 7h25 -> 7h30)
--   quart2.fin_etendu  22:05 -> 22:10   (durée 8h25 -> 8h30)
--
-- Inchangés, déjà exacts : quart1.normal et quart1.etendu à 05:45,
-- quart2.normal à 12:40, quart2.etendu à 13:40, temps_habillage_min à 15.
--
-- Le bloc `renfort` est laissé TEL QUEL : il n'était pas dans le tableau
-- canonique, et le retirer ou le modifier sans arbitrage effacerait une
-- configuration peut-être encore en usage.
--
-- UN ARGUMENT QUI N'ÉTAIT ÉCRIT NULLE PART, et qui renforce l'arbitrage : la
-- configuration actuelle donne au quart 1 trente minutes de MOINS qu'au quart
-- 2 (05:45->12:45 = 7h00 contre 12:40->20:05 = 7h25 ; 8h00 contre 8h25 en
-- étendu). Après correction les deux quarts durent exactement 7h30 et 8h30.
-- La correction n'allonge pas le quart 1 : elle cesse de l'amputer.
--
-- ─── CE QUE ÇA NE CHANGE PAS ──────────────────────────────────────────────
-- L'ATTRIBUTION du quart. Le seuil de bascule quart1/quart2 lit les DÉBUTS
-- (`quart2.normal` / `quart2.etendu`), jamais les fins — voir
-- `seuilDepuisHoraires` dans nexus-station.js. Le défaut « le jeudi à 13 h,
-- l'employé était enregistré sur le quart 2 » a été corrigé dans le CODE, par
-- `JOURS_ETENDUS` / `cleHoraireDuJour`, et ce correctif est en Production.
-- Ce fichier porte le nom de ce commit-là mais traite un AUTRE sujet.
--
-- CE QUI CHANGE RÉELLEMENT, les deux seuls consommateurs de ces valeurs :
--   · nexus-carburant-moteur.js, `fenetreQuartLarge` — prend `fin_etendu` en
--     priorité. La fenêtre large du quart 1 s'allonge de 30 min, celle du
--     quart 2 de 5 min. Effet : quelques quarts de plus classés « chevauche »
--     plutôt que « dans » ou « avant » lors d'un diagnostic d'écart carburant.
--     C'est le sens prudent (Article 5, jamais une fausse certitude
--     d'isolation), mais c'est une perte de pouvoir d'isolation, pas un gain.
--     À attendre, donc : un peu plus de fenêtres « non isolables ».
--   · NEXUS-Inventaire-Manager-v1.html, `libelleEtatQuart` — prend
--     `fin_normal`. Le seuil « clôture en retard » recule de 30 min sur le
--     quart 1, de 5 min sur le quart 2. C'est l'effet VOULU : les managers du
--     quart 1 cessent de voir « en retard » une clôture qui ne l'est pas.
--
-- ─── POURQUOI CE SCRIPT A ÉTÉ DURCI ───────────────────────────────────────
-- Sa première version faisait l'`update` hors transaction, puis affichait un
-- `select` de contrôle portant les mentions « chevauchement attendu 35 min »
-- et « durées attendues 7h30 et 8h30 » en toutes lettres — sans rien calculer.
-- Ce contrôle ne pouvait pas échouer : il demandait à l'opérateur de faire
-- quatre soustractions de tête, juste après une écriture Production, c'est-à-
-- dire au moment où il est le moins disponible pour les faire. Et l'écriture
-- étant déjà validée, découvrir une erreur ne donnait aucun moyen de revenir.
-- Une garde qui ne peut pas mordre n'est pas une garde : c'est une phrase.
--
-- Ce que la version durcie ajoute, et RIEN D'AUTRE (les quatre valeurs
-- écrites sont identiques, l'arbitrage n'est pas retouché) :
--   1. une transaction — le contrôle passe AVANT le `commit`, et un contrôle
--      faux annule l'écriture au lieu de la commenter ;
--   2. un refus sur état de départ inattendu — sept jours ont passé depuis
--      l'arbitrage, il peut en passer sept autres ; si quelqu'un a modifié ces
--      horaires entre-temps, l'arbitrage du 09/09 ne porte plus sur l'état
--      trouvé, et ce script doit s'arrêter plutôt que d'écraser ;
--   3. l'idempotence — relancé sur une base déjà corrigée, il le dit et ne
--      fait rien, au lieu de réécrire à l'identique en silence ;
--   4. un refus si la ligne est absente — la première version acceptait sans
--      broncher un `UPDATE 0` (site renommé, supprimé, mal orthographié), et
--      son contrôle rendait alors zéro ligne, ce qui se lit comme un écran
--      vide et non comme un échec. La garde sur un `horaires` nul qui
--      l'accompagne est une ceinture, pas un sauvetage : la colonne est
--      déclarée NOT NULL, donc `jsonb_set(NULL, ...)` ne peut pas se produire
--      tant que cette contrainte tient. Elle est écrite pour le jour où elle
--      ne tiendrait plus, et elle est annoncée pour ce qu'elle est ;
--   5. `create_if_missing` mis à FALSE — un chemin absent doit être signalé,
--      jamais fabriqué ;
--   6. le contrôle des six durées, calculées, pas récitées ;
--   7. l'ancienne valeur intégrale affichée avant écriture, pour que le retour
--      arrière existe ailleurs que dans un commentaire.
--
-- ─── ÉPROUVÉ, PAS SEULEMENT ÉCRIT (16/09/2026) ────────────────────────────
-- Ce script ne peut pas être répété sur `nexus-test` : cette base ne contient
-- qu'un site, `nexus-station-test`, dont les `horaires` n'ont ni `etendu`, ni
-- `fin_etendu`, ni `renfort`. Le `where` n'y toucherait aucune ligne. Ses
-- gardes ont donc été éprouvées sur une COPIE temporaire de la structure
-- réelle de Production, en transaction annulée, dans les cinq cas : état
-- attendu, état déjà corrigé, état tiers, chemin absent, ligne absente.
-- `test_correction_horaires_20260916.js` vérifie hors ligne ce que le texte
-- de ce fichier promet. Aucun des deux ne remplace le fait de le lire.
--
-- ─── RETOUR ARRIÈRE ───────────────────────────────────────────────────────
-- Le script affiche l'`horaires` complet AVANT écriture (`NOTICE`). Copiez-le.
-- Pour revenir en arrière, les quatre valeurs d'origine suffisent :
--   update public.station_config
--      set horaires = jsonb_set(jsonb_set(jsonb_set(jsonb_set(horaires,
--            '{quart1,fin_normal}', '"12:45"', false),
--            '{quart1,fin_etendu}', '"13:45"', false),
--            '{quart2,fin_normal}', '"20:05"', false),
--            '{quart2,fin_etendu}', '"22:05"', false)
--    where site = 'vito-sainte-marie';
--
-- ─── DEUX CONSÉQUENCES À DÉCIDER, PAS À SUBIR ─────────────────────────────
-- · `site-fantome-test` porte AUJOURD'HUI exactement les mêmes quatre valeurs
--   que `vito-sainte-marie`. Ce script ne vise que `vito-sainte-marie` : après
--   son passage, le site qui sert aux essais cessera de refléter la station
--   réelle. Si c'est voulu, rien à faire. Si ça ne l'est pas, rejouez le même
--   script avec `site = 'site-fantome-test'` — mais c'est une décision.
-- · `simulations/scenarios-carburant.js` et `simulations/executer-ventilation.js`
--   figent les ANCIENNES valeurs en dur. Ces simulations sont une étape
--   bloquante de la CI, mais elles n'ouvrent aucune connexion : elles
--   resteraient vertes tout en simulant une station qui n'existe plus. Elles
--   doivent être mises à jour APRÈS l'application, dans le même mouvement.

\set ON_ERROR_STOP on

begin;

do $$
declare
  ATTENDU_AVANT jsonb := '{"quart1":{"fin_normal":"12:45","fin_etendu":"13:45"},
                           "quart2":{"fin_normal":"20:05","fin_etendu":"22:05"}}'::jsonb;
  CIBLE         jsonb := '{"quart1":{"fin_normal":"13:15","fin_etendu":"14:15"},
                           "quart2":{"fin_normal":"20:10","fin_etendu":"22:10"}}'::jsonb;
  h             jsonb;
  n_lignes      int;
  etat          jsonb;
  v_avant       jsonb;

  -- Les six durées à contrôler APRÈS écriture : libellé, chemin de début,
  -- chemin de fin, minutes attendues. Calculées, jamais récitées.
  REGLES text[][] := array[
    ['chevauchement quart1/quart2, dimanche à mercredi', 'quart1,fin_normal', 'quart2,normal',     '-35'],
    ['chevauchement quart1/quart2, jeudi à samedi',      'quart1,fin_etendu', 'quart2,etendu',     '-35'],
    ['durée du quart 2, dimanche à mercredi',            'quart2,normal',     'quart2,fin_normal', '450'],
    ['durée du quart 2, jeudi à samedi',                 'quart2,etendu',     'quart2,fin_etendu', '510'],
    ['durée du quart 1, dimanche à mercredi',            'quart1,normal',     'quart1,fin_normal', '450'],
    ['durée du quart 1, jeudi à samedi',                 'quart1,etendu',     'quart1,fin_etendu', '510']
  ];
  r int; a text; b text; ecart int; faux text := ''; n_faux int := 0;
begin
  -- 1. La ligne existe-t-elle, et porte-t-elle des horaires ? Le second test
  --    ne peut pas se déclencher tant que `horaires` est NOT NULL — il garde
  --    le jour où la contrainte sauterait, où `jsonb_set(NULL, ...)` rendrait
  --    NULL et effacerait la configuration au lieu de la corriger.
  select horaires into h from public.station_config where site = 'vito-sainte-marie';
  if not found then
    raise exception E'Aucune ligne station_config pour « vito-sainte-marie ».\n  Le site a été renommé ou supprimé : l''arbitrage du 09/09/2026 ne sait plus quoi corriger.';
  end if;
  if h is null then
    raise exception E'station_config.horaires est NULL pour « vito-sainte-marie ».\n  Écrire ici effacerait la configuration au lieu de la corriger. Restaurez d''abord une configuration complète.';
  end if;

  -- 2. Les huit chemins lus ou écrits existent-ils tous ? `create_if_missing`
  --    est mis à false plus bas ; un chemin absent doit s'annoncer ici, avec
  --    son nom, plutôt que de faire échouer l'écriture sans dire lequel.
  foreach a in array array['quart1,normal','quart1,etendu','quart1,fin_normal','quart1,fin_etendu',
                           'quart2,normal','quart2,etendu','quart2,fin_normal','quart2,fin_etendu'] loop
    if h #> string_to_array(a, ',') is null then
      raise exception E'Chemin absent de station_config.horaires : {%}.\n  La configuration n''a pas la forme que l''arbitrage du 09/09/2026 supposait. Rien n''a été écrit.', a;
    end if;
  end loop;

  -- 3. L'état de départ est-il celui que l'arbitrage a examiné ? Trois cas
  --    seulement, et le troisième s'arrête.
  etat := jsonb_build_object(
    'quart1', jsonb_build_object('fin_normal', h#>'{quart1,fin_normal}', 'fin_etendu', h#>'{quart1,fin_etendu}'),
    'quart2', jsonb_build_object('fin_normal', h#>'{quart2,fin_normal}', 'fin_etendu', h#>'{quart2,fin_etendu}'));

  if etat = CIBLE then
    raise notice E'DÉJÀ CORRIGÉ — les quatre valeurs sont celles de l''arbitrage du 09/09/2026. Rien à écrire.';
    return;
  end if;

  if etat <> ATTENDU_AVANT then
    raise exception E'État de départ inattendu. L''arbitrage du 09/09/2026 portait sur :\n    %\n  La base porte aujourd''hui :\n    %\n\n  Quelqu''un a modifié ces horaires depuis. Écraser reviendrait à annuler une décision plus récente que celle-ci, sans savoir laquelle. Rien n''a été écrit : arbitrez, puis mettez ce fichier à jour.',
      jsonb_pretty(ATTENDU_AVANT), jsonb_pretty(etat);
  end if;

  raise notice E'AVANT ÉCRITURE — configuration complète, à conserver pour un éventuel retour arrière :\n%', jsonb_pretty(h);
  v_avant := h;

  -- 4. L'écriture. `create_if_missing` = false aux quatre appels : à ce stade
  --    les chemins sont vérifiés présents, et fabriquer une clé plutôt que de
  --    signaler son absence est exactement ce qu'on ne veut pas.
  update public.station_config
     set horaires = jsonb_set(jsonb_set(jsonb_set(jsonb_set(
           horaires,
           '{quart1,fin_normal}', '"13:15"', false),
           '{quart1,fin_etendu}', '"14:15"', false),
           '{quart2,fin_normal}', '"20:10"', false),
           '{quart2,fin_etendu}', '"22:10"', false)
   where site = 'vito-sainte-marie';

  get diagnostics n_lignes = row_count;
  if n_lignes <> 1 then
    raise exception E'% ligne(s) modifiée(s), une seule était attendue. Annulé.', n_lignes;
  end if;

  -- 5. LE CONTRÔLE, calculé, dans la transaction, avant le `commit`. C'est
  --    tout l'objet du durcissement : ici, un écart annule l'écriture.
  select horaires into h from public.station_config where site = 'vito-sainte-marie';
  for r in 1 .. array_length(REGLES, 1) loop
    a := h #>> string_to_array(REGLES[r][2], ',');
    b := h #>> string_to_array(REGLES[r][3], ',');
    ecart := (extract(epoch from (b::time - a::time)) / 60)::int;
    if ecart <> REGLES[r][4]::int then
      n_faux := n_faux + 1;
      faux := faux || format(E'\n    · %s : %s -> %s = %s min, %s attendues',
                             REGLES[r][1], a, b, ecart, REGLES[r][4]);
    end if;
  end loop;

  if n_faux > 0 then
    raise exception E'% règle(s) d''horaire fausse(s) APRÈS écriture :%\n\n  L''écriture est annulée. La configuration reste :\n%',
      n_faux, faux, jsonb_pretty(v_avant);
  end if;

  raise notice E'VERT — les quatre valeurs sont écrites et les six durées tombent juste (deux chevauchements de 35 min, quarts de 7h30 et 8h30). Le `commit` qui suit les valide.';
end $$;

-- Relecture lisible, à joindre au journal d'exploitation.
select site,
       horaires#>>'{quart1,normal}'     as q1_debut_dim_mer,
       horaires#>>'{quart1,fin_normal}' as q1_fin_dim_mer,
       horaires#>>'{quart1,etendu}'     as q1_debut_jeu_sam,
       horaires#>>'{quart1,fin_etendu}' as q1_fin_jeu_sam,
       horaires#>>'{quart2,normal}'     as q2_debut_dim_mer,
       horaires#>>'{quart2,fin_normal}' as q2_fin_dim_mer,
       horaires#>>'{quart2,etendu}'     as q2_debut_jeu_sam,
       horaires#>>'{quart2,fin_etendu}' as q2_fin_jeu_sam
  from public.station_config
 where site = 'vito-sainte-marie';

commit;
