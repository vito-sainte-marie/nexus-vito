-- Recette étape 2b : contrôle de l'auteur dans la base. Test uniquement ; la transaction est annulée (RAISE final).
-- Attendu : A1 true, A2 false, A3 false, A4 false, A5 false, A6 false, A7 true, A8 true, A9 false,
-- L1 refuse, L2 refuse, L3 autorise, R1 refuse, R2 refuse, R3 refuse (hash bcrypt attendu), R4 autorise (code_temporaire_requis).
do $t$
declare
  mgr uuid := '28810f30-8182-4126-920f-051a4c7cb596'; crea uuid := '794c3e91-c9ec-48f8-b7be-f7b97c483d40';
  empA uuid := '868d0b92-bf65-4c99-be43-656911919afd'; empB uuid := '755a2dc5-3390-4a29-a865-847cbebc1133';
  pro uuid := '7d3b0a51-0000-4a00-9000-000000000001'; inactif uuid := 'e8bb55be-03d8-4fad-a0d4-1125cec5e82e';
  r text := ''; h text;
begin
  h := extensions.crypt('Zx9test', extensions.gen_salt('bf', 6));
  r := r || 'A1 ' || nexus_connexion.auteur_autorise(mgr, empB) || E'\n';
  r := r || 'A2 ' || nexus_connexion.auteur_autorise(empA, empB) || E'\n';
  r := r || 'A3 ' || nexus_connexion.auteur_autorise(mgr, mgr) || E'\n';
  r := r || 'A4 ' || nexus_connexion.auteur_autorise(inactif, empB) || E'\n';
  r := r || 'A5 ' || nexus_connexion.auteur_autorise(null, empB) || E'\n';
  update public.employees set role='manager' where id = pro;
  r := r || 'A6 ' || nexus_connexion.auteur_autorise(pro, empB) || E'\n';
  r := r || 'A7 ' || nexus_connexion.auteur_autorise(crea, empB) || E'\n';
  update public.employees set role='caissier' where id = crea;
  r := r || 'A8 ' || nexus_connexion.auteur_autorise(crea, empB) || E'\n';
  update public.sites set acces_createur_autorise = false where site_id = (select site_id from public.employees where id = empB);
  r := r || 'A9 ' || nexus_connexion.auteur_autorise(crea, empB) || E'\n';
  update public.sites set acces_createur_autorise = true where site_id = (select site_id from public.employees where id = empB);
  begin perform nexus_connexion.lever_verrou(empB, empA); r := r || E'L1 AUTORISE\n'; exception when insufficient_privilege then r := r || E'L1 refuse\n'; end;
  begin perform nexus_connexion.lever_verrou(empB, pro); r := r || E'L2 AUTORISE\n'; exception when insufficient_privilege then r := r || E'L2 refuse\n'; end;
  begin perform nexus_connexion.lever_verrou(empB, mgr); r := r || E'L3 autorise\n'; exception when others then r := r || E'L3 REFUSE\n'; end;
  begin perform nexus_connexion.reinitialiser_code(empB, h, 1, empA); r := r || E'R1 AUTORISE\n'; exception when insufficient_privilege then r := r || E'R1 refuse\n'; end;
  begin perform nexus_connexion.reinitialiser_code(empB, h, 1, pro); r := r || E'R2 AUTORISE\n'; exception when insufficient_privilege then r := r || E'R2 refuse\n'; end;
  begin perform nexus_connexion.reinitialiser_code(empB, 'pas-un-hash', 1, mgr); r := r || E'R3 ACCEPTE\n'; exception when others then r := r || 'R3 refuse: ' || sqlerrm || E'\n'; end;
  begin perform nexus_connexion.reinitialiser_code(empB, h, 1, mgr); r := r || E'R4 autorise\n'; exception when others then r := r || E'R4 REFUSE\n'; end;
  r := r || 'R4 etat ' || coalesce((select etat from nexus_connexion.compte where user_id = empB),'(aucune ligne)') || E'\n';
  raise exception E'RESULTAT\n%', r;
end $t$;
