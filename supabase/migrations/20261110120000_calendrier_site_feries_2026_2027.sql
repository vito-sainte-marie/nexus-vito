-- Jours fériés 2026 et 2027 du site vito-sainte-marie (14 par an, type ferie). Source : calcul NexusCalendrierSite.feriesSite (Pâques grégorien).
-- Conditionnel : la base de Test n'a pas le site vito-sainte-marie (aucune ligne n'y est écrite).
-- Idempotent : on conflict (site, date, type) do nothing ; jamais d'écrasement ni de suppression.
do $$
begin
  if exists (select 1 from public.sites where site_id = 'vito-sainte-marie') then
    insert into public.inventaire_calendrier_site (site, date, type, libelle)
    values
      ('vito-sainte-marie', '2026-01-01', 'ferie', 'Jour de l''An'),
      ('vito-sainte-marie', '2026-04-03', 'ferie', 'Vendredi saint'),
      ('vito-sainte-marie', '2026-04-06', 'ferie', 'Lundi de Pâques'),
      ('vito-sainte-marie', '2026-05-01', 'ferie', 'Fête du Travail'),
      ('vito-sainte-marie', '2026-05-08', 'ferie', 'Victoire 1945'),
      ('vito-sainte-marie', '2026-05-14', 'ferie', 'Ascension'),
      ('vito-sainte-marie', '2026-05-22', 'ferie', 'Abolition de l''esclavage (Martinique)'),
      ('vito-sainte-marie', '2026-05-25', 'ferie', 'Lundi de Pentecôte'),
      ('vito-sainte-marie', '2026-07-14', 'ferie', 'Fête nationale'),
      ('vito-sainte-marie', '2026-07-21', 'ferie', 'Victor Schœlcher'),
      ('vito-sainte-marie', '2026-08-15', 'ferie', 'Assomption'),
      ('vito-sainte-marie', '2026-11-01', 'ferie', 'Toussaint'),
      ('vito-sainte-marie', '2026-11-11', 'ferie', 'Armistice 1918'),
      ('vito-sainte-marie', '2026-12-25', 'ferie', 'Noël'),
      ('vito-sainte-marie', '2027-01-01', 'ferie', 'Jour de l''An'),
      ('vito-sainte-marie', '2027-03-26', 'ferie', 'Vendredi saint'),
      ('vito-sainte-marie', '2027-03-29', 'ferie', 'Lundi de Pâques'),
      ('vito-sainte-marie', '2027-05-01', 'ferie', 'Fête du Travail'),
      ('vito-sainte-marie', '2027-05-06', 'ferie', 'Ascension'),
      ('vito-sainte-marie', '2027-05-08', 'ferie', 'Victoire 1945'),
      ('vito-sainte-marie', '2027-05-17', 'ferie', 'Lundi de Pentecôte'),
      ('vito-sainte-marie', '2027-05-22', 'ferie', 'Abolition de l''esclavage (Martinique)'),
      ('vito-sainte-marie', '2027-07-14', 'ferie', 'Fête nationale'),
      ('vito-sainte-marie', '2027-07-21', 'ferie', 'Victor Schœlcher'),
      ('vito-sainte-marie', '2027-08-15', 'ferie', 'Assomption'),
      ('vito-sainte-marie', '2027-11-01', 'ferie', 'Toussaint'),
      ('vito-sainte-marie', '2027-11-11', 'ferie', 'Armistice 1918'),
      ('vito-sainte-marie', '2027-12-25', 'ferie', 'Noël')
    on conflict (site, date, type) do nothing;
  end if;
end
$$;
