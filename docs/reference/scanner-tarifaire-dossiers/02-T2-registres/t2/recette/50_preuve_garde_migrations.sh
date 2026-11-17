# Inclus par executer_recette_locale.sh. 140 à 149 : chacune des quatre migrations D'ORIGINE est refusée sur une base
# non autorisée (identifiant système différent de celui de Test), sans créer ni modifier aucun objet.
EMPREINTE="select md5(string_agg(x, '|' order by x)) from (
  select 'class:' || c.oid::regclass::text || ':' || c.relkind::text || ':' || coalesce(c.relacl::text, '') || ':' || c.relrowsecurity::text || c.relforcerowsecurity::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'auth')
  union all select 'proc:' || p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || coalesce(p.proacl::text, '') || ':' || p.prosecdef::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'auth')
  union all select 'pol:' || polrelid::regclass::text || ':' || polname || ':' || polpermissive::text || ':' || coalesce(pg_get_expr(polqual, polrelid), '') || ':' || coalesce(pg_get_expr(polwithcheck, polrelid), '') from pg_policy
  union all select 'trg:' || tgrelid::regclass::text || ':' || tgname from pg_trigger where not tgisinternal
  union all select 'con:' || conrelid::regclass::text || ':' || conname from pg_constraint where connamespace = 'public'::regnamespace
  union all select 'nsp:' || nspname from pg_namespace
  union all select 'data:' || (select count(*) from sites) || ':' || (select count(*) from employees) || ':' || (select count(*) from produits_appel)) e(x)"
garde_refuse() {   # $1 base, $2 numéro, $3 fichier d'origine, $4 libellé
  local avant apres
  avant=$(run "$PA -d $1 -tAc \"$EMPREINTE\"")
  if run "$PP -d $1 -f $S2/origine/$3" >/dev/null 2>"$DATA/gm.err"; then ko "$2 $3 acceptée sur une base non autorisée ($4)"; return; fi
  apres=$(run "$PA -d $1 -tAc \"$EMPREINTE\"")
  if grep -q 'garde_projet_test : identifiant système' "$DATA/gm.err" && [ "$avant" = "$apres" ]; then
    ok "$2 garde : $3 refusée sur base non autorisée ($4), catalogue et données identiques (empreinte ${apres:0:12})"
  else ko "$2 $3 : refus $(grep -m1 -o 'ERROR:.*' "$DATA/gm.err"), empreinte avant ${avant:0:12} après ${apres:0:12}"; fi
}
# Base A : socle Test seul, aucune migration T2.
run "createdb -h /tmp -p $PORT -U supabase_admin non_autorisee_a"
socle_et_migrations non_autorisee_a " " >/dev/null
n=140; for f in $MIGS; do garde_refuse non_autorisee_a $n "$f" "socle seul"; n=$((n+1)); done
# Base B : trois migrations déjà en place (copies adaptées), puis rejeu des quatre fichiers d'origine.
run "createdb -h /tmp -p $PORT -U supabase_admin non_autorisee_b"
socle_et_migrations non_autorisee_b "$MIGS0" >/dev/null
run "$PA -d non_autorisee_b -c \"select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',false);\"" >/dev/null
n=145; for f in $MIGS; do garde_refuse non_autorisee_b $n "$f" "trois migrations déjà en place"; n=$((n+1)); done
# Contrôle de la garde elle-même : sa première instruction exécutable est bien la garde, dans chaque migration.
for f in $MIGS; do
  premiere=$(grep -m1 -v -E '^\s*(--|$)' "$S2/origine/$f")
  [ "$premiere" = 'do $garde$' ] && ok "149 $f : la garde est la première instruction" || ko "149 $f : première instruction « $premiere »"
done
