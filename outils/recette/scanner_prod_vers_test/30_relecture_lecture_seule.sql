-- Relecture LECTURE SEULE d'un lot posé : recalcule le md5 de chaque jeu et le compare à celui du manifeste.
-- Variable psql : -v lot=<uuid du lot>. Sans psql, remplacer :'lot' par le uuid entre apostrophes.
-- md5 identique à la Production : md5(string_agg(texte, E'\n' order by ligne)) (même ordre que l'export).
begin transaction read only;
select j.jeu, j.n as n_manifeste, c.n as n_relu, j.md5_manifeste, c.md5 as md5_relu, (j.n = c.n and j.md5_manifeste = c.md5) as identique
from recette_scanner.jeux j
join (
  select v.jeu, count(*) n, md5(string_agg(v.texte, E'\n' order by v.ligne)) md5
    from recette_scanner.ventes v where v.lot_id = :'lot' group by 1
  union all
  select 'stock_brut_20261110', count(*), md5(string_agg(s.texte, E'\n' order by s.numero_ligne)) from recette_scanner.stock_brut s where s.lot_id = :'lot'
) c on c.jeu = j.jeu
where j.lot_id = :'lot'
order by j.jeu;
select registre, count(*) from recette_scanner.declarations where lot_id = :'lot' group by 1 order by 1;
rollback;
