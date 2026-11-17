-- NEXUS Scanner T3 : BILAN DE FIN DE RECETTE sur Supabase Test (LECTURE SEULE), après le script 82 et le bannissement.
-- Données lues : site vito-sainte-marie et site-fantome-test (site de recette) seulement.
-- Valeurs attendues des lignes 1 et 2 : celles du contrôle 70 du jour (historique SM hors lignes de recette).
begin transaction read only;
with c(n, controle, attendu, obtenu) as (values
  (1,  'SM hors recette : journal inchangé (empreinte des colonnes T2)', 'vide',
       (select coalesce(md5(string_agg(concat_ws('|', id, site, article, code_barres, periode_debut, periode_fin, decision, prix_ttc_retenu, motif, seuil_id, moteur_version, photo::text, saisi_par, saisi_le, annule_le, annule_par, motif_annulation), ';' order by id)), 'vide')
          from tarif_decisions where site = 'vito-sainte-marie' and article not like 'RECETTE T3 %')),
  (2,  'SM hors recette : prix décidés inchangés (empreinte)', '1b75f1f3ca55c1282f87f47ca8822780',
       (select coalesce(md5(string_agg(concat_ws('|', id, site, article, code_barres, nature, prix_ttc, decide_le, motif, saisi_par, saisi_le, remplace_id, annule_le, annule_par, motif_annulation), ';' order by id)), 'vide')
          from tarif_prix_decides where site = 'vito-sainte-marie' and article not like 'RECETTE T3 %')),
  (3,  'lignes de journal de recette : SM / fantôme', '6/1',
       (select count(*) filter (where site = 'vito-sainte-marie') || '/' || count(*) filter (where site = 'site-fantome-test') from tarif_decisions where site in ('vito-sainte-marie','site-fantome-test') and article like 'RECETTE T3 %')),
  (4,  'lignes de journal de recette encore actives', '0',
       (select count(*)::text from tarif_decisions where site in ('vito-sainte-marie','site-fantome-test') and article like 'RECETTE T3 %' and annule_le is null)),
  (5,  'prix décidés de recette encore actifs', '0',
       (select count(*)::text from tarif_prix_decides where site in ('vito-sainte-marie','site-fantome-test') and article like 'RECETTE T3 %' and annule_le is null)),
  (6,  'chaque prix décidé de recette a exactement une ligne de journal', '0',
       (select count(*)::text from tarif_prix_decides p where p.site in ('vito-sainte-marie','site-fantome-test') and p.article like 'RECETTE T3 %'
          and (select count(*) from tarif_decisions d where d.prix_decide_id = p.id) <> 1)),
  (7,  'aucune ligne de recette sur un autre site', '0',
       (select count(*)::text from tarif_decisions where article like 'RECETTE T3 %' and site not in ('vito-sainte-marie','site-fantome-test'))),
  (8,  'comptes de recette T3 : désactivés / liés', '0/3',
       (select count(*) filter (where actif) || '/' || count(*) from employees where username like 'recette-t3-%')),
  (9,  'identités de recette T3 : bannies / conservées', '3/3',
       (select count(*) filter (where banned_until > now() + interval '50 years') || '/' || count(*) filter (where deleted_at is null) from auth.users where email like 'recette-t3-%'))
)
select n, controle, attendu, obtenu, case when obtenu is not distinct from attendu then 'OK' else 'ECART' end as verdict from c order by n;
rollback;
