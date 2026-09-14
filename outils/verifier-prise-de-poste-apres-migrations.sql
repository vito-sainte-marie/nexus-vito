-- APRÈS LES MIGRATIONS : un employé qui a laissé son quart ouvert peut-il
-- encore prendre son poste ?
--
-- POURQUOI CETTE ÉPREUVE EXISTE, ET POURQUOI ELLE PASSE AVANT LES AUTRES.
-- Frédéric Bragance, 09/09/2026 : « les employés utilisent NEXUS au
-- compte-gouttes […] il ouvre un quart, commence la journée, parfois il ne fait
-- rien — ni inventaire, ni missions — et ne referme même pas le quart, car pour
-- eux NEXUS ne fonctionne pas correctement. »
--
-- Le quart laissé ouvert n'est donc pas un accident : c'est le comportement
-- ORDINAIRE de l'équipe. Or cette release installe
-- `shifts_un_seul_service_en_cours`, un index unique qui interdit à un employé
-- d'avoir deux services ouverts. Sans filet, l'employé qui a oublié de fermer
-- hier se verrait refuser sa prise de poste aujourd'hui — et l'écran lui dirait
-- « Un problème est survenu, réessayez », indéfiniment. La release confirmerait
-- exactement ce que l'équipe croit déjà.
--
-- LE FILET EXISTE : `nexus_shifts_avant_insertion`, déclencheur BEFORE INSERT
-- posé par 20260905213000_prise_de_poste_contrat_unique.sql, clôt le service
-- précédent en `prise_de_poste_suivante`. Mais l'index arrive en 6e position de
-- la promotion et le filet en 10e. Entre les deux, quatre migrations. Une
-- release interrompue là laisserait l'équipe dehors.
--
-- Cette épreuve ne lit donc aucun code : elle REJOUE le geste. Elle ouvre un
-- service, en ouvre un second pour le même employé, et vérifie que le second
-- passe et que le premier s'est fermé tout seul.
--
-- RÉSERVÉE AU MODE PREPROD_REHEARSAL. Elle écrit dans `shifts` : la lancer en
-- recette normale salirait le jeu de recette.

do $$
declare
  v_mode      text;
  v_employe   uuid;
  v_site      text;
  v_premier   uuid;
  v_second    uuid;
  v_statut    text;
  v_source    text;
  v_ouverts   int;
begin
  select mode into v_mode from public.nexus_environnement_mode;
  if v_mode is distinct from 'PREPROD_REHEARSAL' then
    raise exception 'REFUS : épreuve réservée au mode PREPROD_REHEARSAL (mode lu : %).',
      coalesce(v_mode, 'NON LU');
  end if;

  select id, site_id into v_employe, v_site
    from public.employees
   where site_id = 'nexus-station-test' and compte_test = true
   order by id limit 1;
  if v_employe is null then
    raise exception 'Aucun compte de recette : l''épreuve ne peut pas rejouer une prise de poste. '
      'Ne pas conclure — ni « ça marche », ni « ça casse ».';
  end if;

  -- Le service d'hier, laissé ouvert. C'est le cas réel décrit par Frédéric.
  insert into public.shifts (employee_id, site, site_id, role, heure_debut, statut)
  values (v_employe, v_site, v_site, 'caissiere', now() - interval '1 day', 'en_cours')
  returning id into v_premier;

  -- La prise de poste du lendemain. C'est ELLE qui doit passer.
  begin
    insert into public.shifts (employee_id, site, site_id, role, heure_debut, statut)
    values (v_employe, v_site, v_site, 'caissiere', now(), 'en_cours')
    returning id into v_second;
  exception when others then
    raise exception 'PARCOURS EMPLOYÉ CASSÉ — un employé ayant laissé son service ouvert NE PEUT PLUS prendre son poste. '
      'Erreur : %. C''est le comportement ordinaire de l''équipe : cette release la mettrait dehors.', sqlerrm;
  end;

  select statut, cloture_source into v_statut, v_source
    from public.shifts where id = v_premier;
  if v_statut = 'en_cours' then
    raise exception 'Le service de la veille est resté OUVERT alors qu''un nouveau a été pris : '
      'le filet de clôture automatique n''a pas joué, et l''index d''unicité aurait dû refuser.';
  end if;
  if v_source is distinct from 'prise_de_poste_suivante' then
    raise exception 'Le service de la veille a été clos par « % » au lieu de « prise_de_poste_suivante ». '
      'Ce n''est pas le mécanisme attendu : le résultat est peut-être bon par accident.',
      coalesce(v_source, 'NULL');
  end if;

  select count(*) into v_ouverts from public.shifts
   where employee_id = v_employe and statut = 'en_cours';
  if v_ouverts <> 1 then
    raise exception 'L''employé a % service(s) ouvert(s) au lieu d''un seul.', v_ouverts;
  end if;

  raise notice 'PARCOURS EMPLOYÉ INTACT : le service de la veille s''est fermé seul (%), la prise de poste du jour est passée.', v_source;
end
$$;
