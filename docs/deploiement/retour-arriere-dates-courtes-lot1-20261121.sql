-- Retour arrière de 20261121120000_dates_courtes_lot1 (v4) : retire les 9 tables et les 32 fonctions du Lot 1 Dates courtes.
-- Tables : tournees, releves, corrections, retraits, demarques, correspondances, acces_caissier, certifications, demandes_correction.
-- Ne touche aucun objet existant (inventaire_*, station_config, droits en place). Les données saisies dans les tables du lot sont supprimées avec elles :
-- à n'exécuter qu'avec le GO du pilote, après export éventuel des lignes à conserver.
do $$
declare
  f record;
begin
  drop table if exists public.dates_courtes_demarques, public.dates_courtes_certifications, public.dates_courtes_demandes_correction,
    public.dates_courtes_acces_caissier, public.dates_courtes_retraits, public.dates_courtes_corrections, public.dates_courtes_releves,
    public.dates_courtes_correspondances, public.dates_courtes_tournees cascade;
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'dates\_courtes\_%'
  loop
    execute format('drop function if exists %s cascade', f.sig);
  end loop;
end $$;
