-- Mandat 33 — Horaires : un seul moteur, et un retard qui sait se taire.
-- Arbitrage de Frédéric Bragance, 19/09/2026 (option b1).
--
-- ----------------------------------------------------------------------------
-- CE QUI ÉTAIT FAUX, ET POURQUOI ÇA NE SE VOYAIT PAS
-- ----------------------------------------------------------------------------
-- Deux moteurs calculaient l'horaire théorique d'un quart, chacun de son côté :
--
--   * en base, `calculer_horaires_quart` ;
--   * au navigateur, `NexusStation.seuilDeBascule`, qui lisait
--     `station_config.horaires` en direct et réassemblait la règle.
--
-- Ils ne disaient PAS la même chose. Mesuré le 19/09/2026 sur la base Test, dont
-- `station_config.horaires` ne déclare que le régime « normal » :
--
--   jeudi 2026-09-17, quart 2
--     SQL : calculer_horaires_quart -> NULL        (et UNE ligne, pas zéro)
--     JS  : seuilDepuisHoraires     -> 13:00       (repli sur `normal`)
--
-- Même site, même jour, même configuration, deux vérités. Le JS repliait sur le
-- régime `normal` quand `etendu` manquait — ce qui est juste, un commerce à
-- horaire uniforme n'a qu'un régime à déclarer — là où le SQL rendait NULL.
--
-- Pire, le SQL rendait une LIGNE toute-NULL au lieu de zéro ligne. Les appelants
-- bouclent (`for v_horaire in select * from calculer_horaires_quart(...) loop`) :
-- une ligne NULL fait tourner la boucle, donc `generer_planning_mensuel`
-- insérait des `planning_shifts` à `heure_debut`/`heure_fin`/`duree_heures` NULL
-- et propageait ce NULL dans le cumul `tmp_planning_heures.heures`. Zéro ligne
-- ne fait pas tourner la boucle : le Planning s'abstient au lieu d'écrire un
-- fantôme.
--
-- Et là où la fin n'était pas déclarée, la fonction en INVENTAIT une :
-- `coalesce(fin_normal, v_debut + interval '7 hours')`, `+ 8 hours` pour le
-- régime étendu. Personne n'avait jamais déclaré ces durées. Elles coïncidaient
-- par hasard avec les durées réelles de Vito Sainte-Marie (05:45 -> 12:45, sept
-- heures), ce qui les a rendues invisibles pendant des mois. C'est la même
-- famille de défaut que la prise de poste qui inventait son heure de fin.
--
-- ----------------------------------------------------------------------------
-- LE CONTRAT, DÉSORMAIS
-- ----------------------------------------------------------------------------
--   * Paramètres Station = source canonique des horaires du site ;
--   * Planning           = affectation réelle de l'employé (journée/quart/site) ;
--   * Pointage           = heure réellement constatée ;
--   * retard             = rapprochement de ces trois sources ;
--   * `shifts.heure_debut` est INTERDIT comme horaire théorique — il vaut
--     `created_at` quand le service est ouvert d'un clic, et c'est lui qui
--     annonçait des retards de plusieurs heures à qui arrivait à l'heure.
--
-- Aucun fallback silencieux vers un horaire inventé. Quand la source manque, la
-- fonction ne rend rien, et le retard vaut NULL.
-- ----------------------------------------------------------------------------

-- ============================================================================
-- 1. `pointages.retard_min` devient nullable, et perd son DEFAULT
-- ============================================================================
-- Le `DEFAULT 0` doit tomber EN MÊME TEMPS que le `NOT NULL` : le laisser
-- signerait « à l'heure » sur toute insertion qui omet la colonne, ce qui est
-- exactement le faux que cette migration supprime. Deux verrous, deux `drop`.

alter table public.pointages
  alter column retard_min drop default,
  alter column retard_min drop not null;

comment on column public.pointages.retard_min is
  'Retard constaté, en minutes, par rapport à l''heure attendue du quart. '
  'SÉMANTIQUE (arbitrage du 19/09/2026) : 0 = retard CALCULÉ, employé à l''heure ; '
  '> 0 = retard CALCULÉ ; NULL = retard NON CALCULABLE (horaire théorique absent, '
  'ambigu ou sans objet — un départ ou une pause n''a pas d''heure attendue). '
  'NULL ne signifie JAMAIS « à l''heure » : les calculs de ponctualité doivent '
  'exclure ces lignes du numérateur ET du dénominateur, jamais les compter comme '
  'ponctuelles. Les lignes antérieures au 19/09/2026 gardent leur valeur : on ne '
  'réécrit pas l''historique, même quand il affirme un 0 qui n''a jamais été mesuré.';

-- ============================================================================
-- 2. `calculer_horaires_quart` : le moteur unique
-- ============================================================================
-- Signature inchangée, donc les privilèges existants (anon, authenticated,
-- service_role) et le propriétaire sont conservés par le REPLACE. Cette
-- migration n'accorde, ne retire et ne modifie AUCUN privilège.
--
-- `set search_path to 'public'` est reconduit tel quel : la migration
-- 20260728135643 l'a figé, le perdre rouvrirait la porte qu'elle a fermée.
--
-- Trois changements de comportement, tous dans le sens du refus :
--
--   a) REPLI DE RÉGIME, aligné mot pour mot sur `JOURS_ETENDUS` du client.
--      Jeudi, vendredi, samedi -> `etendu` ; dimanche à mercredi -> `normal`.
--      Si le régime `etendu` n'est pas déclaré, le site bascule EN BLOC sur
--      `normal` — début ET fin. Replier champ par champ produirait un créneau
--      bâtard (début étendu, fin normale) que personne n'a jamais déclaré.
--      Ce repli n'invente rien : il applique un horaire écrit par la station.
--
--   b) PLUS AUCUNE FIN INVENTÉE. `+ interval '7 hours'` et `+ interval
--      '8 hours'` disparaissent. Une fin non déclarée reste non déclarée.
--
--   c) ZÉRO LIGNE, jamais une ligne NULL. La fonction n'émet sa ligne que si le
--      début ET la fin sont connus — c'est son contrat, elle rend un créneau
--      et sa durée, et le Planning a besoin des deux. Conséquence assumée :
--      un site qui déclarerait un début sans fin ne fournit plus d'heure
--      attendue, donc `retard_min` y vaut NULL. Se taire est toujours vrai ;
--      inventer ne l'est jamais. Aucune configuration connue n'est dans ce cas
--      (Test et Production déclarent toutes leurs fins), c'est une ceinture.

create or replace function public.calculer_horaires_quart(p_site text, p_quart text, p_date date)
  returns table(heure_debut time without time zone, heure_fin time without time zone, duree_heures numeric)
  language plpgsql
  set search_path to 'public'
  as $$
declare
  v_horaires jsonb;
  v_dow int := extract(dow from p_date); -- 0 = dimanche ... 6 = samedi
  v_regime text;
  v_debut time;
  v_fin time;
  v_pause_debut time;
  v_pause_fin time;
  v_pause interval;
begin
  select sc.horaires into v_horaires from station_config sc where sc.site = p_site;
  if v_horaires is null then
    return; -- site inconnu ou sans horaires : rien à dire.
  end if;

  if p_quart in ('quart1', 'quart2') then
    -- Jeudi (4), vendredi (5), samedi (6) : régime étendu. Ces trois jours sont
    -- ceux de `NexusStation.JOURS_ETENDUS`, et l'écran Paramètres Station les
    -- étiquette « Jeudi à Samedi » en toutes lettres.
    v_regime := case when v_dow in (4, 5, 6) then 'etendu' else 'normal' end;
    v_debut := nullif(v_horaires -> p_quart ->> v_regime, '')::time;

    -- Commerce à régime uniforme : `etendu` n'est pas déclaré, tout le couple
    -- bascule sur `normal`. Pas de repli en sens inverse : un site qui déclare
    -- `etendu` sans `normal` est une configuration incomplète, pas un régime
    -- uniforme, et NEXUS ne devine pas laquelle des deux il a sous les yeux.
    if v_debut is null and v_regime = 'etendu' then
      v_regime := 'normal';
      v_debut := nullif(v_horaires -> p_quart ->> 'normal', '')::time;
    end if;

    v_fin := nullif(v_horaires -> p_quart ->> ('fin_' || v_regime), '')::time;

    if v_debut is null or v_fin is null then
      return; -- horaire non déclaré : zéro ligne, aucune fin fabriquée.
    end if;

    return query select v_debut, v_fin, (extract(epoch from (v_fin - v_debut)) / 3600.0)::numeric;

  elsif p_quart = 'renfort' then
    -- Le renfort n'a pas de régime : un seul couple début/fin, quel que soit le
    -- jour. S'il manque, le renfort n'a pas d'horaire théorique et le retard
    -- de celui qui le tient vaut NULL.
    v_debut := nullif(v_horaires -> 'renfort' ->> 'debut', '')::time;
    v_fin := nullif(v_horaires -> 'renfort' ->> 'fin', '')::time;
    if v_debut is null or v_fin is null then
      return;
    end if;

    -- Pause déclarée par ses DEUX bornes, ou pas de pause. Une borne seule ne
    -- décrit aucune durée : la déduire reviendrait à inventer.
    v_pause_debut := nullif(v_horaires -> 'renfort' ->> 'pause_debut', '')::time;
    v_pause_fin := nullif(v_horaires -> 'renfort' ->> 'pause_fin', '')::time;
    v_pause := case
                 when v_pause_debut is not null and v_pause_fin is not null
                   then (v_pause_fin - v_pause_debut)
                 else interval '0'
               end;

    return query select v_debut, v_fin,
      (extract(epoch from ((v_fin - v_debut) - v_pause)) / 3600.0)::numeric;
  end if;

  return; -- quart inconnu ('non_defini', 'conge', 'repos'…) : aucun horaire.
end;
$$;

comment on function public.calculer_horaires_quart(text, text, date) is
  'Moteur UNIQUE de l''horaire théorique d''un quart, à partir des Paramètres '
  'Station du site. Rend ZÉRO ligne quand l''horaire n''est pas déclaré — jamais '
  'une ligne NULL, jamais une fin fabriquée. Le client passe par cette fonction '
  '(RPC) : il ne réassemble plus la règle de son côté. Le temps d''habillage '
  'n''est PAS soustrait de `heure_debut` : `heures_ouverture_publique` montre '
  'qu''il y est déjà compris, puisqu''elle décale l''ouverture au public de '
  '`temps_habillage_min` APRÈS ce début (05:45 + 15 = 06:00).';
