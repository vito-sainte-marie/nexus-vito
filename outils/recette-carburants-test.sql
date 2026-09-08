-- Scénario de recette Carburants — station Test (`nexus-station-test`).
--
-- Reconstruit le 08/09/2026 (lot CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION).
-- La version du 07/09 n'avait JAMAIS pu s'exécuter : la base Test était
-- injoignable depuis le runner, puis la RLS refusait le rôle CI. Le jour où
-- elle a enfin tourné, elle a produit un scénario qui n'exerçait pas CARB-004
-- et recommandait 24 000 L de SP95 dans une cuve dont la limite est 23 750 L.
--
-- POURQUOI ELLE SE TROMPAIT. Son balayage avait été mené avec les cuves de
-- vito-sainte-marie (SP95 limite 28 761 L, GO 28 553 L), celles du test
-- unitaire CARB-004 — et non avec celles de la station Test, bien plus
-- petites : SP95 23 750 L, GO 14 250 + 7 600 = 21 850 L. Un scénario calculé
-- pour une station puis semé dans une autre. Personne ne pouvait s'en
-- apercevoir tant que le fichier ne s'exécutait pas.
--
-- CE QUE CE SCÉNARIO REPRODUIT — le cas CARB-004, mesuré cette fois contre la
-- configuration RÉELLE de la station Test :
--
--   sp95 : presque vide à la livraison, donc plafonné par sa capacité
--          physique                                            -> 23 000 L
--   go   : confortable, arrondi au millier INFÉRIEUR (12 950 -> 12 000),
--          puis restitué par la récupération du reliquat        -> 13 000 L
--   total                                                       -> 36 000 L
--   reliquat récupéré 1 000 L, crédité au go ; sp95 REFUSÉ avec un motif
--   nommant la capacité — c'est cette phase que CARB-004 a corrigée.
--
-- COMMENT CES VALEURS ONT ÉTÉ CHOISIES. Banc hors ligne passant par la vraie
-- chaîne (moteur -> données-core -> P0), avec la configuration de cuves lue
-- dans `station_config` de la station Test : 900 combinaisons évaluées, 370
-- reproduisent la signature complète. La bande utile a été mesurée, pas
-- devinée : le stock SP95 projeté à la livraison doit tomber entre 1 et
-- 750 L. À 850 L la signature disparaît (22 000 + 13 000, aucun reliquat) ;
-- au-dessous de 0 on entre dans le cas dégénéré ci-dessous. La valeur retenue
-- est 400 L — le MILIEU de la bande, 300 L de marge de chaque côté, plutôt
-- qu'un bord où la moindre dérive de prévision casserait la recette.
--
-- POURQUOI LE SCÉNARIO EST RELATIF À LA DATE. La version précédente ancrait
-- tout au 07/09 en dur. Même juste, elle se serait périmée : la fenêtre de
-- vente avant livraison dépend du jour de la semaine. Mesurée sur le banc :
-- 1 jour du lundi au jeudi, 3 le vendredi et le samedi, 2 le dimanche
-- (livraisons du lundi au vendredi, cutoff 11:00). Le jaugeage est donc
-- calculé à partir de cette fenêtre, pour que le stock projeté tombe toujours
-- au milieu de la bande utile quel que soit le jour où la recette passe.
--
-- LE CAS DÉGÉNÉRÉ, ÉVITÉ ICI ET SIGNALÉ AILLEURS. `capaciteDisponibleLivraison`
-- vaut `limite_remplissage - stockPrevuLivraison` et n'est bornée que par le
-- BAS. Quand le stock projeté est négatif — station à sec avant le camion —
-- la capacité calculée dépasse la limite physique de la cuve et le moteur peut
-- recommander plus qu'elle ne peut recevoir. C'est la dette CARB-006, arbitrée
-- dans `docs/nexus/CONFRONTATION-LOGIQUE-COMMANDE-CARBURANT-20260908.md`. Ce
-- scénario garde les deux stocks projetés POSITIFS et ne s'appuie pas dessus.
--
-- IDEMPOTENT. Vérifié par la CI, qui exécute ce fichier DEUX FOIS à chaque
-- passage : une promesse d'en-tête que rien n'exerce n'est pas une garantie.
--
-- NON DESTRUCTEUR. Seules les trois colonnes de litrage sont mises à jour sur
-- les ventes : la ligne appartenant à la recette NEXUS Verify conserve ses
-- montants et son statut. Aucune ligne n'est supprimée.
--
-- BASE DE RECETTE UNIQUEMENT. Ce fichier ne doit jamais être exécuté sur
-- Production.

-- Repères de date, dans le fuseau de la STATION (pas celui du serveur).
-- Réécrits en CTE dans chaque instruction plutôt que dans une table
-- temporaire : celle-ci aurait supposé un privilège `TEMP` que le rôle CI de
-- recette n'a pas forcément, et aurait introduit de l'état de session pour
-- une valeur qui se recalcule en une ligne.
--
--   fenêtre de vente avant livraison, mesurée sur le banc :
--     lundi..jeudi -> 1 jour   vendredi, samedi -> 3 jours   dimanche -> 2

-- Historique des ventes : 28 jours pleins, deux quarts par jour, valeurs
-- DISTINCTES entre Q1 et Q2 (des quarts identiques déclencheraient la
-- suspicion de duplication de `chargerHistoriqueVentesQualifie`).
-- Consommation : sp95 1 400 L/j (770 + 630), go 900 L/j (477 + 423).
-- La fenêtre de 28 jours recouvre entièrement l'ancien scénario du 07/09,
-- dont les valeurs sont ainsi remplacées plutôt que laissées à dériver.
with reperes as (
  select (now() at time zone 'America/Martinique')::date as aujourdhui
)
insert into audits_caisse (site, date, quart, litrage_sp95, litrage_gazole, litrage_gnr)
select 'nexus-station-test', g.jour::date, q.quart, q.sp95, q.go, null
from reperes r
cross join generate_series(r.aujourdhui - 28, r.aujourdhui - 1, interval '1 day') g(jour)
cross join (values ('1', 770, 477), ('2', 630, 423)) as q(quart, sp95, go)
on conflict (site, date, quart) do update
  set litrage_sp95 = excluded.litrage_sp95,
      litrage_gazole = excluded.litrage_gazole,
      litrage_gnr = excluded.litrage_gnr;

-- Quart 1 du jour, déjà vendu au moment où la recette regarde l'écran.
with reperes as (
  select (now() at time zone 'America/Martinique')::date as aujourdhui
)
insert into audits_caisse (site, date, quart, litrage_sp95, litrage_gazole, litrage_gnr)
select 'nexus-station-test', r.aujourdhui, '1', 770, 477, null
from reperes r
on conflict (site, date, quart) do update
  set litrage_sp95 = excluded.litrage_sp95,
      litrage_gazole = excluded.litrage_gazole,
      litrage_gnr = excluded.litrage_gnr;

-- Jaugeage d'ouverture du jour de recette.
--   sp95 = 1 400 x fenêtre + 400  -> stock projeté à la livraison = 400 L,
--          milieu de la bande utile mesurée (1 à 750 L).
--   go   = 900 x fenêtre + 4 500  -> stock projeté = 4 500 L, soit 5 jours,
--          confortable : le go s'arrondit donc vers le BAS, condition sans
--          laquelle la récupération du reliquat ne serait jamais exercée.
-- Le GNR reste NULL : la cuve D est déclarée inactive dans station_config, et
-- un relevé sur un carburant inactif serait une donnée qui n'existe pas.
with maintenant as (
  select (now() at time zone 'America/Martinique') as t
), reperes as (
  select
    t::date as aujourdhui,
    -- Fenêtre de vente avant livraison. Elle dépend de DEUX choses, et le
    -- 08/09/2026 le semis n'en modélisait qu'une.
    --
    -- Le jour de la semaine, et le CUTOFF de 11 h : avant, la commande part
    -- aujourd'hui et la livraison est au prochain jour ouvrable ; après, tout
    -- glisse d'un cran. La recette est passée à 9 h puis a cassé à 13 h 25 —
    -- le stock projeté tombait de +400 à −1000 et la recommandation redevenait
    -- physiquement impossible.
    --
    -- Le jeudi après 11 h saute à QUATRE jours : commande vendredi, livraison
    -- lundi. Ces valeurs sont MESURÉES au banc
    -- (`outils/repetition-recette-carburants.js`, 14 cas), jamais déduites.
    case
      when extract(isodow from t) between 1 and 3 then (case when extract(hour from t) >= 11 then 2 else 1 end)
      when extract(isodow from t) = 4            then (case when extract(hour from t) >= 11 then 4 else 1 end)
      when extract(isodow from t) = 5            then (case when extract(hour from t) >= 11 then 4 else 3 end)
      when extract(isodow from t) = 6            then 3
      else 2
    end::int as fenetre
  from maintenant
)
insert into carburant_releves
  (site, date, stock_reel_sp95, stock_reel_go_cuve1, stock_reel_go_cuve2, stock_reel_gnr, origine, mesure_le, controle_statut)
select 'nexus-station-test', r.aujourdhui,
       1400 * r.fenetre + 400,
       900 * r.fenetre + 3100,
       1400,
       null, 'manager',
       (r.aujourdhui + time '05:30') at time zone 'America/Martinique',
       'en_attente'
from reperes r
on conflict (site, date) do update
  set stock_reel_sp95 = excluded.stock_reel_sp95,
      stock_reel_go_cuve1 = excluded.stock_reel_go_cuve1,
      stock_reel_go_cuve2 = excluded.stock_reel_go_cuve2,
      stock_reel_gnr = excluded.stock_reel_gnr,
      origine = excluded.origine,
      mesure_le = excluded.mesure_le,
      controle_statut = excluded.controle_statut;
