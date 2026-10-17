begin;
create temp table res(n text, r text);
grant all on res to authenticated;
select id as pomp from employees where role='pompiste' and site_id='nexus-station-test' \gset
select id as autre from employees where site_id='site-fantome-test' limit 1 \gset
select id as mgr from employees where role='manager' and site_id='nexus-station-test' limit 1 \gset
insert into carburant_index_releves(site,date,moment,auteur) values('nexus-station-test','2099-01-01','fin_q2',:'pomp') returning id as parent \gset
select set_config('test.parent', :'parent', true);
grant select on res to authenticated;
set local role authenticated;
-- A : employé d'un AUTRE site, parent d'un site non autorisé, id connu
select set_config('request.jwt.claims', json_build_object('sub',:'autre','role','authenticated')::text, true);
do $$ declare n int; begin
  select count(*) into n from carburant_index_releves where id = current_setting('test.parent')::uuid;
  insert into res values('A0 autre site voit le parent ?', n::text||' ligne(s)');
  begin
    insert into carburant_index_valeurs(releve_id,pompe,produit,valeur_sept_chiffres,valeur_decenium,troncature_sans_perte)
    values(current_setting('test.parent')::uuid,1,'GO','0000001','000001',true);
    insert into res values('A écriture intersite sous parent non autorisé','ACCEPTE');
  exception when others then insert into res values('A écriture intersite sous parent non autorisé','REFUSE: '||sqlerrm); end;
end $$;
-- E : pompiste du site, site forgé dans la valeur
select set_config('request.jwt.claims', json_build_object('sub',:'pomp','role','authenticated')::text, true);
do $$ begin
  begin
    insert into carburant_index_valeurs(releve_id,pompe,produit,valeur_sept_chiffres,valeur_decenium,troncature_sans_perte,site)
    values(current_setting('test.parent')::uuid,1,'GO','0000002','000002',true,'site-fantome-test');
    insert into res values('E site forgé par le pompiste','ACCEPTE (voir site stocké ci-dessous)');
  exception when others then insert into res values('E site forgé par le pompiste','REFUSE: '||sqlerrm); end;
end $$;
-- F : légitime, contrôle positif
do $$ begin
  begin
    insert into carburant_index_valeurs(releve_id,pompe,produit,valeur_sept_chiffres,valeur_decenium,troncature_sans_perte)
    values(current_setting('test.parent')::uuid,1,'SP','0000003','000003',true);
    insert into res values('F contrôle positif : pompiste du jour, son parent','ACCEPTE');
  exception when others then insert into res values('F contrôle positif : pompiste du jour, son parent','REFUSE: '||sqlerrm); end;
end $$;
reset role;
select * from res;
select 'site stocké', valeur_sept_chiffres, site from carburant_index_valeurs where releve_id=:'parent' order by 2;
rollback;
