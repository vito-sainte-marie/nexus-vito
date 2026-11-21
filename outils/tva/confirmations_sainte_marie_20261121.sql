-- Confirmations de TVA des 62 références « TVA à vérifier » (cause S7) de Sainte-Marie.
-- Décisions du pilote du 21/11/2026 : Rizla regular, Rizla Slim et papier Gizeh à 8,5 % ; BUZZ Vodka canette à 8,5 % ;
-- Fine Leaf et toutes les autres références à 0 %. Soit 4 références à 8,5 % et 58 à 0 %.
-- Rien à corriger dans Decenium : on ajoute des confirmations, aucune autre donnée n'est touchée.
--
-- Données des 62 lignes : outils/tva/confirmations_sainte_marie_20261121.json (le test du dépôt vérifie qu'elles sont identiques).
-- Épreuve de ce même corps sur Test (fixtures, site d'essai) : outils/tva/epreuve_confirmations_20261121.sql.
--
-- Le corps est une fonction temporaire (pg_temp, disparaît avec la session) appelée par UN select final.
-- Deux modes, réglés par le premier argument de l'appel (RAPPORT par défaut, sans effet) :
--   RAPPORT   : ne touche à rien. Se termine par une exception « RAPPORT_TVA ... » qui porte le rapport :
--               lignes à insérer, lignes qui en remplacent une autre, lignes déjà conformes, cibles absentes de products.
--   APPLIQUER : insère en une seule instruction (l'appel de la fonction), puis relit le résultat.
--               Refuse (annulation complète) si une cible est absente de products du site.
--
-- Règles :
--   * confirme_par = le compte créateur du site, trouvé par requête (employees : site_id, est_createur, actif, compte_test = faux).
--     Aucun identifiant en dur. Le script échoue s'il n'y en a pas exactement un.
--   * Une confirmation active existe déjà pour la même cible : même taux, rien n'est inséré ; taux différent,
--     une nouvelle ligne est insérée avec remplace_id vers l'ancienne. Aucune ligne existante n'est modifiée ni supprimée.
--   * Idempotent : un second APPLIQUER n'insère aucune ligne.
--   * Active = non annulée et non remplacée par une ligne non annulée (même règle que actives() de nexus-produits-mesure.js).
--   * Cible : code-barres si présent, sinon libellé d'article normalisé (minuscules, espaces réduits).
--
-- Exécution : par Guardian, sur Test (épreuve), puis en Production après un GO distinct du pilote. Le script s'exécute en rôle
-- privilégié (la RLS ne s'applique pas) : c'est pourquoi confirme_par est renseigné explicitement.

-- DEBUT_FONCTION_PARTAGEE (texte identique dans outils/tva/epreuve_confirmations_20261121.sql, vérifié par le test du dépôt)
create or replace function pg_temp.tva_confirmations(p_mode text, p_site text, p_compte_test boolean, p_donnees jsonb, p_attendu int)
returns text
language plpgsql
as $corps$
declare
  v_pilote uuid;
  v_nb_pilote int;
  v_total int;
  v_inserer int;
  v_remplacer int;
  v_conformes int;
  v_introuvables int;
  v_inseres int := 0;
  v_actives_ok int;
  v_detail text;
begin
  if p_mode not in ('RAPPORT', 'APPLIQUER') then
    raise exception 'MODE_INCONNU : % (attendu RAPPORT ou APPLIQUER)', p_mode;
  end if;

  select count(*), (array_agg(e.id))[1] into v_nb_pilote, v_pilote
    from employees e
   where e.site_id = p_site and e.est_createur and e.actif and e.compte_test = p_compte_test;
  if v_nb_pilote <> 1 then
    raise exception 'CONFIRME_PAR_INTROUVABLE_OU_AMBIGU : % compte(s) créateur sur %, attendu exactement 1', v_nb_pilote, p_site;
  end if;

  drop table if exists pg_temp.tva_plan;
  create temp table tva_plan on commit drop as
  select d.article, nullif(trim(d.code_barres), '') as code_barres, d.taux, d.commentaire,
         a.id as actif_id, a.taux_confirme as actif_taux,
         exists (
           select 1 from products p
            where p.site = p_site
              and ( (nullif(trim(d.code_barres), '') is not null and trim(p.code_barres) = trim(d.code_barres))
                 or (nullif(trim(d.code_barres), '') is null
                     and lower(regexp_replace(trim(p.article), '\s+', ' ', 'g')) = lower(regexp_replace(trim(d.article), '\s+', ' ', 'g'))) )
         ) as dans_catalogue
    from jsonb_to_recordset(p_donnees) as d(article text, code_barres text, taux numeric, commentaire text)
    left join lateral (
      select c.id, c.taux_confirme
        from produits_tva_confirmations c
       where c.site = p_site
         and c.annule_le is null
         and not exists (select 1 from produits_tva_confirmations r where r.remplace_id = c.id and r.annule_le is null)
         and ( (nullif(trim(d.code_barres), '') is not null and trim(c.code_barres) = trim(d.code_barres))
            or (nullif(trim(d.code_barres), '') is null and nullif(trim(c.code_barres), '') is null
                and lower(regexp_replace(trim(c.article), '\s+', ' ', 'g')) = lower(regexp_replace(trim(d.article), '\s+', ' ', 'g'))) )
       order by c.confirme_le desc
       limit 1
    ) a on true;

  select count(*),
         count(*) filter (where actif_id is null),
         count(*) filter (where actif_id is not null and actif_taux <> taux),
         count(*) filter (where actif_id is not null and actif_taux = taux),
         count(*) filter (where not dans_catalogue)
    into v_total, v_inserer, v_remplacer, v_conformes, v_introuvables
    from tva_plan;

  select coalesce(string_agg(article || ' (' || actif_taux || ' -> ' || taux || ')', ' ; ' order by article), 'aucun')
    into v_detail from tva_plan where actif_id is not null and actif_taux <> taux;

  if p_mode = 'RAPPORT' then
    raise exception 'RAPPORT_TVA : cibles=%, a_inserer=%, a_remplacer=%, deja_conformes=%, cibles_absentes_de_products=% ; remplacements : %',
      v_total, v_inserer, v_remplacer, v_conformes, v_introuvables, v_detail;
  end if;

  -- APPLIQUER
  if v_total <> p_attendu then
    raise exception 'DONNEES_INATTENDUES : % cibles, attendu %', v_total, p_attendu;
  end if;
  if v_introuvables > 0 then
    raise exception 'CIBLES_ABSENTES_DE_PRODUCTS : % cible(s) hors du catalogue du site, rien n''est inséré (lancer RAPPORT)', v_introuvables;
  end if;

  insert into produits_tva_confirmations (site, article, code_barres, taux_confirme, commentaire, confirme_par, remplace_id)
  select p_site, p.article, p.code_barres, p.taux, p.commentaire, v_pilote, p.actif_id
    from tva_plan p
   where p.actif_id is null or p.actif_taux <> p.taux;
  get diagnostics v_inseres = row_count;

  -- Relecture : chaque cible a une confirmation active au taux décidé.
  select count(*) into v_actives_ok
    from tva_plan p
   where exists (
     select 1 from produits_tva_confirmations c
      where c.site = p_site and c.annule_le is null and c.taux_confirme = p.taux
        and not exists (select 1 from produits_tva_confirmations r where r.remplace_id = c.id and r.annule_le is null)
        and ( (p.code_barres is not null and trim(c.code_barres) = p.code_barres)
           or (p.code_barres is null and nullif(trim(c.code_barres), '') is null
               and lower(regexp_replace(trim(c.article), '\s+', ' ', 'g')) = lower(regexp_replace(trim(p.article), '\s+', ' ', 'g'))) ));
  if v_actives_ok <> v_total then
    raise exception 'RELECTURE_ECART : % cible(s) sur % ont une confirmation active au taux décidé, rien n''est validé', v_actives_ok, v_total;
  end if;

  return format('APPLIQUER_TVA : inseres=%s (dont remplacements=%s), deja_conformes=%s, relecture=%s/%s', v_inseres, v_remplacer, v_conformes, v_actives_ok, v_total);
end
$corps$;
-- FIN_FONCTION_PARTAGEE

-- Appel : RAPPORT par défaut. Pour appliquer, remplacer 'RAPPORT' par 'APPLIQUER' (second GO du pilote).
-- Arguments : mode, site, compte_test du créateur (faux en Production), données, nombre de cibles attendu.
select pg_temp.tva_confirmations('RAPPORT', 'vito-sainte-marie', false, $json$[
  {"article":"AD Blue 10L","code_barres":"7041068131193","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29277 du 10/11, RUBIS LUBRIFIANTS, 7 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Baguette - 24P","code_barres":"","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29216 du 31/10, pains et compagnie, 17 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Baguette BEURRE delices prod","code_barres":"","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29255 du 31/10, CAPRICORNE DISTRIBUTION, 4 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Biscuits Salés Delices Prod","code_barres":"","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-28993 du 21/09, CAPRICORNE DISTRIBUTION, 6 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Brosse a dent Medium x 2","code_barres":"3560071409630","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : aucun achat depuis mi-mai ; aligné : hygiène, même famille à 0 %"},
  {"article":"BUZZ VODKA CAN extra strong 10% Plus 250ml -24P","code_barres":"762571305006","taux":8.5,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : aucun achat depuis mi-mai ; aligné : alcool, bière BUZZ ANT CLAU à 8,5 %"},
  {"article":"CHIPS BRETS BEURRE SALE 125g - 10P","code_barres":"3497917002789","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-28916 du 08/09, Somes, 1 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"CHIPS BRETS FROMAGE DU JURA 125g - 10P","code_barres":"3497917000907","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-28916 du 08/09, Somes, 1 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"CHIPS BRETS MIEL & MOUTARDE 125g - 10P","code_barres":"3497917003151","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-28916 du 08/09, Somes, 1 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"CHIPS BRETS SAVEUR AIOLI 165g - 10P","code_barres":"3497917000914","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : aucun achat depuis mi-mai ; aligné : trois autres Brets à 0 %"},
  {"article":"Chips lays  25g Nature - 24P","code_barres":"3168930000877","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29270 du 13/11, DISTRI EXPRESS, 5 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Chips Lays BBQ 130g -10P","code_barres":"3168930180715","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29174 du 21/10, DISTRI EXPRESS, 6 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Chips lays bbq 27.5grs - 24P","code_barres":"3168930005858","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29174 du 21/10, DISTRI EXPRESS, 2 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Chips LAYS BBQ 45g - 20 P","code_barres":"3168930000105","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29270 du 13/11, DISTRI EXPRESS, 5 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Chips lays bbq 75g - 15P","code_barres":"3168930000679","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29174 du 21/10, DISTRI EXPRESS, 4 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Chips Lays Nat 130g- 10P","code_barres":"3168930003359","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29270 du 13/11, DISTRI EXPRESS, 6 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Chips Lays nat 45g -20P","code_barres":"3168930000020","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29174 du 21/10, DISTRI EXPRESS, 3 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Chips Lays Nature 75gr - 15P","code_barres":"3168930000662","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29270 du 13/11, DISTRI EXPRESS, 6 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Chouchou Caraibe","code_barres":"3760231730004","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29031 du 25/09, M. ti chouchou caraibes, 2 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Essuie tout DouDou x 2 - 20P","code_barres":"3273680312023","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-28530 du 30/06, Prochimie, 1 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Farine de Manioc - 20P","code_barres":"3329999100131","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-28818 du 20/08, RAGALD FARINE MANIOC, 1 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Ferodo Dot 4 Liquide de frein 500ml -24P","code_barres":"406042648920","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-28953 du 15/09, RUBIS LUBRIFIANTS, 1 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Feuille de Tabac FINE LEAF 15g - 15P","code_barres":"315001040900","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29205 du 28/10, TCS the caribbean supplier, 11 bon(s), TVA 0,00 %, écart 0,00 ; produit du tabac (pilote 21/11)"},
  {"article":"Figolu 192g -28P","code_barres":"7622201133337","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-28983 du 16/09, DISTRI EXPRESS, 1 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Fromage vache qui rit - 48P","code_barres":"3073780972291","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-28689 du 29/07, ANT CLAU, 1 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Fuchs Titan Garden HCT 1L -12P","code_barres":"3349918886328","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29319 du 18/11, Maxicar, 2 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Graisse gadus hd2 400gr -12P","code_barres":"5011987052024","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-28953 du 15/09, RUBIS LUBRIFIANTS, 1 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Granola Cookies Choco 184g -10P","code_barres":"3017760756198","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29270 du 13/11, DISTRI EXPRESS, 3 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Haricots roses Lafleur 500g -24P","code_barres":"1470844110002","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29143 du 19/10, SDGM, 1 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Lait 1/2ecreme 1l -6P","code_barres":"3155250003701","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29088 du 05/10, Prevoteau, 6 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Lait Concentré non sucre PT gourm -24P","code_barres":"3503362224321","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : aucun achat depuis mi-mai ; aligné : lait à 0 %"},
  {"article":"Lentilles Blondes Celimene 454","code_barres":"09492255229","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29090 du 02/10, SDGM, 1 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"MACARONS DELICES PROD","code_barres":"","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-28918 du 10/09, CAPRICORNE DISTRIBUTION, 4 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"mouchoir unité vet / soavex","code_barres":"8013824822064","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29311 du 17/11, Sogedis, 2 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"oeillets carres pr tete manuelle x 2","code_barres":"3418318533597","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29138 du 16/10, MEGADUSTRIES, 1 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"OEILLETS KRAMP RONDS","code_barres":"8716106319657","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : aucun achat depuis mi-mai ; aligné : œillets carrés à 0 %"},
  {"article":"Papier à rouler gizeh - 20P","code_barres":"42214465","taux":8.5,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : aucun achat depuis mi-mai ; aligné : accessoire tabac, Gizeh filtres FCDDM à 8,5 %"},
  {"article":"Papier Toillette x 4 rouleaux standard - 10P","code_barres":"8013824834043","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29159 du 20/10, Sogedis, 2 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Preservatif Erectus Fraise P24","code_barres":"3760099470098","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : aucun achat depuis mi-mai ; aligné : préservatif XXL KYLIANE à 0 %"},
  {"article":"Preservatif Erectus Long Love granue / 3 - 24P","code_barres":"3760099470111","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : aucun achat depuis mi-mai ; aligné : préservatif XXL KYLIANE à 0 %"},
  {"article":"Preservatif erectus long love xxl P24","code_barres":"3760099470142","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29067 du 01/10, KYLIANE IMPORT, 1 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Pringles bbq 175g -19P","code_barres":"5053990101528","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-28923 du 10/09, Sodimar, 3 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Pringles bbq 40g -12P","code_barres":"5053990107278","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29222 du 03/11, Sodimar, 4 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Pringles hot & spicy 40g - 12P","code_barres":"5053990107292","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29320 du 18/11, Sodimar, 3 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Pringles Hot Spicy 160g -19P","code_barres":"5053990175949","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29320 du 18/11, Sodimar, 2 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Pringles Origl 175g - 19P","code_barres":"5053990101573","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29167 du 22/10, Sodimar, 4 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Pringles Origl 40g - 12P","code_barres":"5053990107339","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29320 du 18/11, Sodimar, 7 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Pringles SCO 175g - 19P","code_barres":"5053990101597","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-28852 du 27/08, Sodimar, 2 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Pringles SCO 40g - 12 P","code_barres":"5053990107384","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29320 du 18/11, Sodimar, 9 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Rasoir bic 1 lame x5","code_barres":"3086125705010","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : aucun achat depuis mi-mai ; aligné : rasoir twin Sogedis à 0 %"},
  {"article":"Rasoir bic x 5 - twin lady - 20P","code_barres":"3086126608969","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-28806 du 11/08, Sogedis, 1 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Riz Blanc Thai Dr Roots 1KG- 20P","code_barres":"8858741290202","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-28535 du 30/06, DE NEGRI, 1 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Rizla regular 25P","code_barres":"54012707","taux":8.5,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-28675 du 27/07, ROGER ALBERT, 2 bon(s), TVA 8,50 %, écart 0,00 ; accessoire tabac (pilote 21/11)"},
  {"article":"Rizla Slim - 50P","code_barres":"5010891012063","taux":8.5,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29304 du 16/11, ROGER ALBERT, 2 bon(s), TVA 8,50 %, écart 0,00 ; accessoire tabac (pilote 21/11)"},
  {"article":"Sandwich Autres 4.80","code_barres":"100","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29217 du 31/10, pain d or, 4 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Sardines Founty Huile Vegetal 125g 50P","code_barres":"6111242420038","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29155 du 20/10, DE NEGRI, 1 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Sardines piment Founty 125g - 50P","code_barres":"6111242420021","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29106 du 08/10, DE NEGRI, 2 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Sardines tomato Founty 125g  - 50P","code_barres":"6111242420205","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29009 du 22/09, DE NEGRI, 1 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"Sel sachet fin salina 1kg - 20P","code_barres":"3183280011687","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29143 du 19/10, SDGM, 2 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"SERVIET ULTRA MIN NORM X 16","code_barres":"3270190191063","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : aucun achat depuis mi-mai ; aligné : hygiène, même famille à 0 %"},
  {"article":"Thon Pecheur de France 1/6","code_barres":"3139323003799","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-29007 du 22/09, POMAL 2019, 1 bon(s), TVA 0,00 %, écart 0,00"},
  {"article":"VICO CLASSIQUE 135G - 20P","code_barres":"3336971209164","taux":0,"commentaire":"Décision du pilote du 21/11/2026, facture fournisseur Decenium : BLF-2026-28919 du 08/09, POMAL 2019, 2 bon(s), TVA 0,00 %, écart 0,00"}
]$json$::jsonb, 62);

-- Relecture en lecture seule, utile après APPLIQUER : confirmations actives portant la décision du 21/11/2026, par taux.
-- Attendu : 4 à 8,5 et 58 à 0.
select c.taux_confirme, count(*) as nb
  from produits_tva_confirmations c
 where c.site = 'vito-sainte-marie'
   and c.annule_le is null
   and c.commentaire like 'Décision du pilote du 21/11/2026%'
   and not exists (select 1 from produits_tva_confirmations r where r.remplace_id = c.id and r.annule_le is null)
 group by c.taux_confirme
 order by c.taux_confirme;
