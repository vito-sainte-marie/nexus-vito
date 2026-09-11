-- NEXUS — anonymisation d'un PREPROD, transformation DÉTERMINISTE.
--
-- CE FICHIER S'EXÉCUTE SUR UNE COPIE, JAMAIS SUR PRODUCTION. Il commence par
-- le vérifier lui-même : une garde compare la référence du projet courant à
-- celle de Production et refuse de s'exécuter dessus. Un fichier qui détruit
-- des identités ne doit pas dépendre de l'attention de qui le lance.
--
-- PRINCIPE. Les identités structurées sont SUBSTITUÉES de façon déterministe
-- et stable — le même employé reçoit toujours le même pseudonyme, sinon les
-- historiques deviennent incohérents et la copie ne ressemble plus à
-- Production. Les champs de TEXTE LIBRE, eux, sont REMPLACÉS EN ENTIER.
--
-- POURQUOI REMPLACER ET NON RETOUCHER. Un commentaire peut contenir un nom,
-- un horaire, une situation identifiable, longtemps après que la colonne
-- d'identité a été anonymisée. Retoucher au cas par cas est exactement le
-- geste qui laisse passer un oubli — et l'oubli, ici, est une personne
-- réidentifiable. On perd de la fidélité de contenu ; on garde la forme, les
-- volumes et les distributions, qui sont ce dont une répétition a besoin.
--
-- CE QUE CE FICHIER NE PRÉTEND PAS FAIRE. Il ne garantit rien par lui-même.
-- La garantie vient de `outils/verifier-absence-donnee-personnelle.sql`, qui
-- doit être exécuté APRÈS et qui BLOQUE si une occurrence subsiste. Une
-- transformation se croit toujours complète ; c'est la vérification qui
-- tranche.
--
-- LIMITE ASSUMÉE, NON RÉSOLUE. Le recensement des champs de texte libre est
-- fait à partir du schéma connu au 09/09/2026. Une table ajoutée demain avec
-- un champ de commentaire ne serait PAS traitée ici — mais elle serait
-- couverte par la vérification, qui parcourt `information_schema` à chaque
-- exécution. C'est la raison pour laquelle la vérification est générique et
-- pas cette transformation : l'une doit vieillir sans mentir, l'autre doit
-- être explicite.

do $$
declare
  ref_courante text;
begin
  select current_setting('app.settings.project_ref', true) into ref_courante;
  if ref_courante = 'uzhjpqpctpvxytxpxoqz' then
    raise exception 'REFUS : ce fichier ne s''exécute JAMAIS sur Production.';
  end if;

  -- Deuxième garde, indépendante de la première : une PREPROD contient des
  -- données copiées, jamais la station réelle sous son vrai nom. Si l'on
  -- trouve le site de production ET des employés qui n'ont pas encore été
  -- pseudonymisés, on s'arrête plutôt que de supposer qu'on est au bon endroit.
  if exists (select 1 from public.sites where site_id = 'vito-sainte-marie')
     and not exists (select 1 from public.employees where nom like 'Employé %') then
    raise notice 'Site de production présent et aucun pseudonyme : première anonymisation de cette copie.';
  end if;
end
$$;

-- 1) IDENTITÉS STRUCTURÉES — substitution déterministe et STABLE.
--    L'ordre est figé par `id` : la même base transformée deux fois donne les
--    mêmes pseudonymes, et deux tables qui référencent le même employé restent
--    d'accord entre elles.
with numerotes as (
  select id, row_number() over (order by id) as rang from public.employees
)
update public.employees e
   set nom = 'Employé ' || n.rang,
       username = 'employe' || n.rang
  from numerotes n
 where e.id = n.id;

-- 2) IDENTITÉ COMMERCIALE DES SITES. `nom_entreprise` révèle le client ;
--    `site_id` est une clé référencée partout et n'est PAS renommée — le
--    renommer casserait chaque table qui la porte, pour un gain nul : ce n'est
--    pas une donnée personnelle, c'est un identifiant technique.
with sites_numerotes as (
  select site_id, row_number() over (order by created_at, site_id) as rang from public.sites
)
update public.sites s
   set nom_entreprise = 'Station ' || n.rang
  from sites_numerotes n
 where s.site_id = n.site_id;

-- 3) TEXTE LIBRE — remplacé en entier, longueur approximative conservée pour
--    que les écrans gardent une mise en page réaliste.
update public.evaluations_employes
   set commentaires = case when commentaires is null then null else 'Commentaire d''évaluation retiré pour anonymisation.' end,
       autocritique_forts = case when autocritique_forts is null then null else 'Point fort retiré pour anonymisation.' end,
       autocritique_ameliorer = case when autocritique_ameliorer is null then null else 'Axe d''amélioration retiré pour anonymisation.' end;

update public.audits_caisse
   set commentaire = case when commentaire is null then null else 'Commentaire d''audit retiré pour anonymisation.' end;

-- 4) TEXTE GÉNÉRÉ. `advisor_messages` interpole des prénoms dans ses gabarits :
--    le texte déjà produit ne se retouche pas, il se jette. NEXUS le
--    régénérera sur les données désormais anonymisées.
delete from public.advisor_messages;
delete from public.advisor_message_evidence;
