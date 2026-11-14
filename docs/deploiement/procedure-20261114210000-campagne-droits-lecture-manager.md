# Procédure — migration 20261114210000 (droits de lecture des tables de promotion)

Fichier : `supabase/migrations/20261114210000_campagne_droits_lecture_manager.sql`.
Origine : correction C1 de Guardian (commentaire 6883112254 sur #160).

## Effet

- Remplace `lecture_meme_site` (filtre sur le site seul) par `lecture_manager_meme_site` (même site et rôle `manager` ou `gerant`) sur les tables de promotion. Le créateur garde `createur_lit_si_autorise`.
- Ajoute aux écritures le contrôle d'appartenance : `campagne_id` (ou `batch_id`, ou `livraison_id`) doit appartenir au site de la ligne.
- Élargit `campagne_stock_depart_source_check` à `inventaire`, `saisie_initiale`, `releve_theorique_decenium`, `comptage`.
- Les tables absentes de l'environnement sont ignorées (`to_regclass`).

## État

- **Test** (`udljdqxerrbbbajxubfn`) : appliquée le 14/11/2026. Preuve par rôle dans une transaction annulée : le caissier et le pompiste lisent 0 ligne et ne peuvent rien écrire (42501) ; le manager lit et écrit sur son site ; une campagne d'un autre site est refusée (42501) ; la source `releve_theorique_decenium` passe pour le manager, une source inconnue est refusée (23514).
- **Production** (`uzhjpqpctpvxytxpxoqz`) : **non appliquée.** Aucun geste sans GO de Frédéric.

## AVANT (lecture seule, catalogue)

```sql
select tablename, policyname from pg_policies
where schemaname = 'public' and policyname in ('lecture_meme_site', 'lecture_manager_meme_site')
  and (tablename like 'campagne\_%' or tablename = 'fournisseurs_conditions')
order by 1, 2;
```

Attendu avant application : `lecture_meme_site` présente. Après : `lecture_manager_meme_site`.

## Application

Geste de Frédéric sous la garde, après GO explicite. Claude n'écrit pas en Production.

## Ordre vis-à-vis du code

- Les pages qui lisent ces tables sont des pages de manager : la restriction ne les prive de rien.
- Le code de #310 qui écrit `source = 'releve_theorique_decenium'` exige l'élargissement du `check` : cette migration passe **avant** lui.
- Retour arrière : recréer `lecture_meme_site` (`site = current_employee_site_id()`) sur chaque table. Il rouvre la lecture au caissier, à ne faire qu'en connaissance de cause.
