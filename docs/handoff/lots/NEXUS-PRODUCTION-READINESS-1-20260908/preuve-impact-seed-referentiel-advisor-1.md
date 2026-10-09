# Impact chiffré — `20260905161500_seed_referentiel_advisor`

**10/09/2026.** Dernier impact DML resté `INCONNU` du lot
(`decision-2.md` §5). Mesuré en **lecture seule** sur Production
(`uzhjpqpctpvxytxpxoqz`). Aucune écriture, aucune migration appliquée.

---

## Résultat

| Table | codes | COMPLÉTÉES | ÉCRASÉES | IDENTIQUES |
|---|---|---|---|---|
| `nexus_language_templates` | 6 | **0** | **0** | **6** |
| `advisor_rules` | 31 | **0** | **0** | **31** |

**La migration ne changerait aucune valeur.** Les 37 lignes que son
`on conflict (code) do update` viserait portent déjà exactement le contenu
qu'elle écrirait.

Contrôles convergents relevés en passant : Production porte 31 règles dont
**25 activées**, et la migration en déclare **25 activées** également. Le
commentaire de la migration annonçait « six règles volontairement désactivées
en production » — l'écart observé est exactement de six.

### La seule modification réelle : `updated_at`

`on conflict do update` s'exécute même quand les valeurs sont identiques :
PostgreSQL ne détecte pas les mises à jour sans effet. Les deux blocs `do update
set` incluent `updated_at`. **37 lignes seraient donc réécrites avec le même
contenu et un nouvel `updated_at`.**

C'est le chiffrage honnête : zéro création, zéro changement de sens, 37
horodatages rafraîchis.

---

## Méthode, et pourquoi celle-là

Le comparateur préparé par le lot
(`comparaison-seed-referentiel-advisor.sql`) porte les valeurs de la migration
recopiées à l'identique, et son en-tête avertit : « aucune n'a été retapée de
mémoire ; toute divergence future entre ce fichier et la migration invaliderait
la mesure ».

L'exécuter par le canal de Claude aurait exigé d'en retranscrire environ quinze
mille caractères dans un appel. **Une seule divergence de transcription aurait
produit un faux « ÉCRASÉE » sans que rien ne le signale.** La mesure a donc été
faite autrement, sans jamais retranscrire une valeur métier :

1. **Côté Production** — une requête calcule, par ligne, l'empreinte `md5` des
   colonnes que le `do update` écraserait. Seules 37 empreintes courtes
   transitent.
2. **Côté migration** — un analyseur lit le fichier de migration lui-même,
   découpe ses lignes `VALUES`, et calcule la même empreinte.
3. Les deux ensembles sont comparés localement.

Normalisation identique des deux côtés : séparateur `chr(31)`, chaque valeur
nulle remplacée par la marque `∅` — sans elle, `concat_ws` saute les nuls et
deux lignes différentes rendraient la même empreinte. Pour les modèles, le
champ `jsonb variables_schema` est réduit des deux côtés à sa liste d'éléments
texte **triée**, pour qu'une différence de rendu jsonb ne passe pas pour une
divergence de contenu.

### L'analyseur a été validé avant d'être cru

- Nombre de lignes lues : **6** et **31** — exactement ce que la migration
  déclare.
- Nombre de colonnes par ligne : **11** et **15** — exactement les listes de
  l'`INSERT`.
- **Un défaut trouvé et corrigé avant conclusion** : l'analyseur ne
  reconnaissait `null` qu'en minuscules, alors que la migration écrit `NULL`.
  Les valeurs nulles seraient devenues la chaîne « NULL », égale à rien, et
  auraient fabriqué de faux écrasements.

---

## Ce que cette mesure NE couvre PAS

- **La colonne `id` n'est pas comparée**, volontairement : `on conflict (code)
  do update` ne la touche pas. Un identifiant divergent entre migration et
  Production serait sans effet.
- **La mesure est datée.** Elle vaut pour l'état de Production du 10/09/2026.
  Toute modification manuelle du référentiel Advisor entre-temps la périme.
- Aucune conclusion n'est tirée sur les autres migrations DML du lot, qui ont
  leurs propres mesures.
