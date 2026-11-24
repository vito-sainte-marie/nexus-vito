# RLS lot 3 — procédure Production (4 vues en `security_invoker`)

Migration : `supabase/migrations/20261125180000_rls_lot3_vues_security_invoker.sql`. Elle ne crée, ne supprime et ne modifie aucun objet de données : quatre `alter view … set (security_invoker = true)`. Elle est déjà appliquée en Production par Guardian, sur GO du gérant (24/11/2026, estampille de registre 20261124221428). Cette procédure sert à la rejouer en lecture seule et à revenir en arrière.

## 1. Mesure à refaire (lecture seule, catalogue)

```sql
begin read only;
select c.relname, c.reloptions, left(md5(pg_get_viewdef(c.oid)), 8) as md5_def
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
  and c.relname in ('v_caisse_ecart_a_traiter','nexus_stock_etat_v2','nexus_stock_etat_v3','view_inventaire_dernier_controle_produit')
order by 1;
select count(*) filter (where not coalesce(c.reloptions @> array['security_invoker=true'], false)) as sans_invoker, count(*) as total
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v';
rollback;
```

Attendu : `security_invoker=true` sur les 4 vues, `md5_def` inchangés, `sans_invoker` = 0.

## 2. Valeurs mesurées par Guardian en Production

| Vue | md5 de la définition | Avant | Après |
|---|---|---|---|
| v_caisse_ecart_a_traiter | b97e780f | reloptions vides | security_invoker=true |
| nexus_stock_etat_v2 | 558fb9d4 | reloptions vides | security_invoker=true |
| nexus_stock_etat_v3 | 0ab34cb2 | reloptions vides | security_invoker=true |
| view_inventaire_dernier_controle_produit | e8abb6ab | reloptions vides | security_invoker=true |

Vues du schéma `public` sans `security_invoker` après application : 0 sur 38. Les définitions n'ont pas changé. Trace : #160, compte rendu de Guardian 7145988356.

## 3. Retour arrière (une ligne par vue, aucune donnée à restaurer)

```sql
alter view public.v_caisse_ecart_a_traiter set (security_invoker = false);
alter view public.nexus_stock_etat_v2 set (security_invoker = false);
alter view public.nexus_stock_etat_v3 set (security_invoker = false);
alter view public.view_inventaire_dernier_controle_produit set (security_invoker = false);
```

Effet du retour arrière : les vues relisent avec les droits de leur propriétaire, donc sans RLS. La fuite des écarts de caisse sur toutes les stations revient. À ne jouer que sur décision du gérant.

## 4. Ordre vis-à-vis du code

Aucun. Aucun écran n'appelle une nouvelle fonction. Les deux lecteurs applicatifs (Conseiller et Brief pour les écarts de caisse, plan d'inventaire pour le dernier contrôle) lisent déjà par station. La migration peut précéder ou suivre le code.
