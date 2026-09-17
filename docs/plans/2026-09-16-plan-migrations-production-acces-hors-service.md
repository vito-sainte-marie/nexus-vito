# Plan des migrations Production — accès employé hors service à ses données personnelles

*16/09/2026 — branche `acces-hors-service-20260916`. Ce document n'autorise rien :
il dit exactement ce qu'il faudrait jouer, dans quel ordre, et ce qui casse si
l'ordre est inversé. Aucune migration Production n'est appliquée par ce lot.*

*Mis à jour le 16/09/2026 après l'intégration de la tête de `production` : le
lot « Cycle des services en phase pilote » (#60) y a été fusionné et déployé,
et ses trois migrations sont désormais estampillées en Production. La branche
en porte l'ascendance ; le §2 ci-dessous reste vrai — l'écart entre les deux
bases est toujours d'exactement une migration, et c'est toujours la même.*

---

## 1. Ce que la Production porte déjà — relevé du 16/09/2026

Le dossier de mission partait de l'idée que la projection employé
`20260914210000_mes_ecarts_caisse_projection_employe.sql` restait à appliquer en
Production. **C'est faux, et il vaut mieux le dire que le répéter.** Relevé sur
le projet `uzhjpqpctpvxytxpxoqz` :

| Élément | État Production |
|---|---|
| `supabase_migrations.schema_migrations` → `20260914210000` | **présente** (`mes_ecarts_caisse_projection_employe`) |
| `public.mes_ecarts_caisse()` | **existe**, `SECURITY DEFINER`, `search_path = ''`, sans paramètre |
| `EXECUTE` sur cette fonction | `authenticated`, `service_role` — **ni `anon`, ni `PUBLIC`** |
| Empreinte de la définition | `ec0bca57…`, 1 434 octets — la projection du 14/09, mot pour mot |
| `20260916210000` | **absente** |

Depuis ce relevé, la fusion de #60 a estampillé en Production les trois
migrations de son propre lot — `20260916193000`, `20260916194000` et
`20260916195000`. Elles ne touchent ni `mes_ecarts_caisse()` ni son ACL : elles
portent sur la prise de poste, la régularisation des fins inventées et la
source de clôture. Le tableau ci-dessus reste donc exact ligne pour ligne, et
`20260916210000` demeure la seule migration de ce lot à jouer.

Sur le projet de Test `udljdqxerrbbbajxubfn`, les deux versions sont estampillées
et la fonction vivante mesure 2 878 octets (empreinte `cc83561d…`) : c'est la
version masquante. L'écart entre les deux bases est donc **exactement une
migration**, et une seule.

## 2. La seule migration à jouer

```
supabase/migrations/20260916210000_mes_ecarts_caisse_masque_le_provisoire.sql
```

Additive, elle ne réécrit aucune migration déjà estampillée. Elle fait une chose :
tant que le contrôle n'est pas validé (`valide_le` nul pour le poste concerné), la
projection ne renvoie plus `ecart`, `ecart_valide`, `ecart_origine` ni
`cause_code` — ils sortent à `null`. La ligne, elle, **reste présente** : l'écran
doit pouvoir dire « Contrôle de votre caisse en cours. » et non faire disparaître
le poste.

Propriétés vérifiées sur Test, à revérifier après application en Production :

- `SECURITY DEFINER`, `search_path = ''`, aucun paramètre — l'identité consultée
  ne peut pas être choisie par l'appelant, elle vient de `auth.uid()` ;
- `revoke all … from public` **et** `revoke all … from anon` — sur Supabase le
  premier ne ferme pas le second, l'ACL d'`anon` est un grant nommé ;
- l'ACL finale est **écrite en toutes lettres**, jamais héritée. La propriété
  attendue, identique dans tous les environnements, est exactement :

  | Rôle | `EXECUTE` |
  |---|---|
  | `postgres` (propriétaire) | oui |
  | `authenticated` | **oui** — l'employé qui consulte ses propres écarts |
  | `service_role` | **oui** — rôle technique serveur |
  | `anon` | **non** |
  | `PUBLIC` | **non** |

  soit `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`.

  `service_role` **conserve** `EXECUTE`, et la migration le dit désormais par un
  `grant` explicite. Ce rôle contourne déjà la RLS et sa clé ne quitte jamais le
  serveur : la lui retirer casserait des chemins serveur sans rien refermer côté
  navigateur. Avant le 16/09 la migration restait muette sur ce rôle ; il gardait
  son droit sur Test et en Production **parce que la fonction y préexistait**
  (`create or replace` conserve l'ACL), et ne l'aurait pas eu sur une base neuve,
  où l'`alter default privileges` de Supabase sur `public` pose
  `{anon=X,authenticated=X,service_role=X}` avant que les `revoke` ne passent.
  L'ACL dépendait donc de l'histoire de la base et non de la migration ;
- `create or replace` : rejouable, et l'ACL est reposée explicitement à chaque
  passage plutôt que laissée à l'héritage.

## 3. L'ordre, et pourquoi il n'est pas réversible

**Le front doit être en ligne AVANT la migration.** L'inverse fabrique un chiffre.

- *Front neuf + base ancienne* — sans danger. Les gardes ajoutées à
  `nexus-progression.js` (un résultat inconnu vaut `null`, et chaque compteur
  l'exclut) ne se déclenchent jamais : rien n'est masqué, donc rien n'est `null`.
  Elles attendent.
- *Front ancien + base neuve* — **régression immédiate et silencieuse.**
  `Number(null)` vaut `0` et `estConforme(null)` répond `true`. Un contrôle en
  cours s'afficherait « 0,00 € », un cumul mensuel entièrement masqué
  s'annoncerait « +0,00 € », et des services dont personne n'a encore regardé le
  résultat seraient comptés « propres » : séries prolongées, taux de conformité
  gonflés, badges possibles. L'employé lirait un résultat parfait que personne
  n'a mesuré.

D'où la séquence :

1. **Fusionner la PR vers `production`** (GO distinct, non demandé ici) ;
2. **attendre que GitHub Pages serve le nouveau front** — la Production est servie
   brute, sans build : la fusion suffit, mais la propagation ne l'est pas ;
3. **vérifier** que `app.nexusconseil.net` sert bien le commit fusionné — le
   signal valide est le déploiement `github-pages` le plus récent et ses
   `statuses`, jamais `pages/builds/latest`, figé sur un ancien SHA ;
4. **alors seulement** appliquer `20260916210000` (GO Production distinct) ;
5. relever à nouveau les quatre propriétés du §2 sur la base de Production.

Un retour arrière de la migration seule est possible (rejouer la définition du
14/09), mais il rouvre les montants provisoires aux employés : c'est une décision
produit, pas une manœuvre technique.

## 4. Ce que ce lot ne fait pas

- **`20260911180600_pointage_exige_service_et_evenement.sql` reste suspendue** et
  hors de cette mission. Rien ici ne la débloque ni ne la remplace.
- **La source FDJ n'est pas masquée.** `ligneActiviteFdj` lit `fdj_cash_controls`
  en direct et y montre encore un montant avant validation. Cette table n'est pas
  servie par `mes_ecarts_caisse()` : la traiter demanderait sa propre projection
  et son propre arbitrage. Signalé, pas corrigé.
- **Aucun privilège n'est accordé ni retiré** en dehors de l'ACL de la fonction
  elle-même.

## 5. Contrôles à rejouer après application

Le script `outils/recette-acces-hors-service-20260916.js` produit un SQL
entièrement transactionnel terminé par `ROLLBACK` : décor, consultations,
tentatives d'accès et contrôles ne laissent rien derrière eux. Il a été tenu sur
Test (24 contrôles verts, deux mutations rouges). **Il n'est pas prévu pour être
joué sur la Production** : il fabrique un décor d'employés et d'audits. Sur
Production, se limiter aux relevés en lecture seule du §2 et à une consultation
réelle par un compte de l'équipe.

## 6. État de la branche au moment de la relecture

Relevé du 16/09/2026, après intégration de la tête de `production` :

| Mesure | Valeur | Comment elle est obtenue |
|---|---|---|
| Migrations dans `supabase/migrations` | **267** | `empreinte-artefact.js --arbre-source=.`, énumération réelle |
| Empreinte cumulée des migrations | `ce9156a9bd4dc33627475193dbe9a914ee3dac75af86a00ea841d1d9638d89d5` | idem — mesurée, pas déduite |
| Suite de non-régression | **202/209** | `node run-tests.js` |
| Échecs restants | **7**, exactement la liste `CONNUS` de la CI | aucun n'est imputable à ce lot ni à #60 |
| Simulations métier | **15/15** | `npm run simulations` |
| Épreuves d'infrastructure | **32/32**, **39/39**, **20/20** | les trois étapes bloquantes de la CI |

Le 267 n'est pas la somme « 263 + 3 + 1 » écrite dans
`test_empreinte_artefact_20260915.js` : cette addition explique le chiffre,
l'outil le mesure. Les deux coïncident, et c'est la coïncidence qui vaut
preuve — #60 et #61 sont deux branches sœurs issues du même point, leurs
quatre migrations sont disjointes, il n'y a rien à retrancher.

**Rien de tout cela n'autorise la fusion ni la migration.** La branche est à
niveau et éprouvée ; `20260916210000` reste non appliquée, et l'ordre du §3
— front d'abord, migration ensuite — reste la seule séquence sûre.
