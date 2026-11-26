-- Recette connexion lot 1 étape 1 (Test uniquement). Tout est annulé par l'exception finale.
do $t$
declare ex text; a text; b text; c text; em text; r text;
begin
  select e.nom into ex from public.employees e join auth.users u on u.id=e.id where e.compte_test and e.actif limit 1;
  a := public.nexus_identifiant_de_connexion(ex);
  select u.email into em from auth.users u join public.employees e on e.id=u.id where lower(btrim(e.nom))=lower(btrim(ex)) and (e.actif or e.compte_test);
  b := public.nexus_identifiant_de_connexion('Inconnu Zed');
  insert into public.employees (id, nom, actif, compte_test, username, site_id, role)
  select gen_random_uuid(), ex, true, true, 'dup-recette-tmp', e.site_id, e.role from public.employees e where lower(btrim(e.nom))=lower(btrim(ex)) limit 1;
  c := public.nexus_identifiant_de_connexion(ex);
  r := 'existant_correspond_email_auth=' || (a||'@vito-nexus.local' = em)::text
    || ' | formes_identiques=' || (length(a)=length(b) and a ~ '^[0-9a-f]{32}$' and b ~ '^[0-9a-f]{32}$')::text
    || ' | ambigu_est_leurre=' || (c <> a and c ~ '^[0-9a-f]{32}$' and not exists(select 1 from auth.users where email=c||'@vito-nexus.local'))::text
    || ' | ambigu_stable=' || (c = public.nexus_identifiant_de_connexion(upper(ex)))::text;
  raise exception 'RESULTAT %', r;  -- attendu : quatre valeurs true
end $t$;
