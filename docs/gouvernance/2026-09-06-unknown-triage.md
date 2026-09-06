# STATIC-GUARD-UNKNOWN-TRIAGE — les 27 questions ouvertes

Exécuté le 06/09/2026. **Phase de connaissance : aucune policy modifiée,
aucune correction.** Les seules écritures sont des lignes de preuve créées et
annulées dans la même transaction.

Résultat : **27 `UNKNOWN` → 3**, et les trois restants portent un constat de
sécurité qui revient au Handoff **sans correction**.

## 1. Ce que le tri a révélé : deux angles morts de la garde, pas 24 défauts

Les 24 `UNKNOWN` de type `ecriture_*` n'étaient pas des policies faibles. La
garde ne savait pas les lire.

### Quatrième forme de portée — une aide nommée

Vingt-deux policies contrôlent la portée par
`nexus_clients_ecriture_ok(site)` :

```sql
select current_employee_role() = any(array['manager','gerant'])
   and p_site = current_employee_site_id()
```

C'est **exactement** le contrôle attendu — rôle **et** site — mais donné un
nom. La garde ne cherchait que des motifs syntaxiques et n'y voyait qu'un
appel de fonction inconnu.

> Une aide bien nommée est plus lisible qu'une expression recopiée. Elle est
> aussi invisible à qui ne lit que la syntaxe. C'est le prix d'une garde
> statique, et il se paie en lui apprenant les noms.

### La clause `TO` — une frontière de confiance ignorée

`fdj_site_settings_write_service_role` est réservée à `service_role` :
`using (true)`, ce qui alarmait la garde. Mais `service_role` **n'est pas une
identité utilisateur** — cette clé ne transite jamais par le navigateur.

Conformément à la règle posée, ce n'est **pas** une absolution : le contrôle
est **déplacé** vers la couche qui détient la clé de service. Aujourd'hui,
`nexus-test` n'héberge aucune fonction Edge — donc **personne** n'emprunte ce
chemin. C'est la frontière, et elle est documentée ici plutôt que supposée.

## 2. Répartition finale

| Classe | Avant | Après |
|---|---:|---:|
| `SAFE` | 183 | **209** |
| `VULNERABLE` | 0 | **0** |
| `UNKNOWN` | 27 | **3** |
| `NOT_APPLICABLE` | 152 | 153 |
| Incohérences | 0 | 0 |

| Verdict | Policies | Détail |
|---|---:|---|
| `SAFE` — aide nommée `nexus_clients_ecriture_ok` | 22 | `billing_periods`, `clients`, `client_contacts`, `client_preferences`, `client_comptes_*`, `email_*`, `invoices`, `invoice_lines`, `delivery_records`, `document_matches`, `voucher_extractions`, `normalisation_alias`, `supporting_documents`, `inventaire_*` (6), `progression_site_settings` |
| `NOT_APPLICABLE` — `TO service_role` | 1 | `fdj_site_settings_write_service_role` |
| **Constat de sécurité — retour Handoff** | **3** | `sites.createur_update_sites`, `createur_delete_sites`, `createur_insert_sites` |

`invoices` mérite une mention : sa portée passe par une **jointure indirecte**
vers `clients.site` ou `billing_periods.site`. C'est le même motif de portée
indirecte qu'`inventaire_quart_employes`, et il est correctement contrôlé des
deux côtés.

## 3. Les trois branches créateur sur `sites`

| | |
|---|---|
| Table | `sites` |
| Policies | `createur_update_sites` · `createur_delete_sites` · `createur_insert_sites` |
| Acteur | créateur (`je_suis_createur()`), rôle `authenticated` |
| Mécanisme de portée | **aucun** |
| Frontière de confiance | protection **incidente** par la policy de lecture |

### Ce que les policies autorisent

```
createur_update_sites : using / with check = je_suis_createur()   -- aucun site
createur_delete_sites : using              = je_suis_createur()   -- aucun site
createur_insert_sites : with check         = je_suis_createur()   -- aucun site
```

Prises isolément, elles permettent à un créateur de **modifier ou supprimer
n'importe quelle ligne de `sites`** — y compris `acces_createur_autorise`,
c'est-à-dire le drapeau par lequel un commerce **refuse** l'accès du créateur.
Si cette écriture aboutissait, le créateur pourrait lever lui-même le refus
opposé par un commerce.

### Ce qui se passe réellement — éprouvé

```
fixture : site-ferme-createur, acces_createur_autorise = false
1. acces au site ferme, AVANT          : REFUSE [42501]
2. le createur leve lui-meme le refus  : 0 ligne(s) modifiee(s)
3. acces au site ferme, APRES          : REFUSE [42501]
4. CONTROLE employe ordinaire          : 0 ligne(s) modifiee(s)
```

**L'escalade ne se matérialise pas.** Mais ce n'est pas la policy d'écriture
qui l'empêche — c'est celle de **lecture** :

```sql
select_sites using (site_id = current_employee_site_id()
                    OR (je_suis_createur() AND acces_createur_autorise = true))
```

Un site fermé est **invisible** au créateur, donc son `UPDATE` ne trouve
aucune ligne à cibler.

> La protection est **réelle mais incidente** : elle tient à ce que l'écriture
> doive d'abord lire. Elle repose sur une policy dont ce n'est pas l'objet, et
> un élargissement futur de `select_sites` rouvrirait le chemin sans que
> personne ne fasse le lien.

C'est la même famille que les 17 vues `SECURITY DEFINER` du registre : *ne
fuitent pas par accident de configuration, pas par règle.*

### Verdicts proposés — non appliqués

| Policy | Verdict proposé | Raison |
|---|---|---|
| `createur_update_sites` | **VULNERABLE (latente)** | non exploitable aujourd'hui, protection incidente ; devrait porter sa propre condition de portée |
| `createur_delete_sites` | **VULNERABLE (latente)** | même incidence, et supprimer un commerce est plus destructeur que le modifier |
| `createur_insert_sites` | **DÉROGATION à autoriser** | créer un commerce est la capacité constitutive du créateur ; reste à confirmer par la gate |

**Aucune dérogation n'a été inscrite au registre** : une dérogation que je
m'accorderais moi-même serait exactement l'exclusion silencieuse que la
décision interdit. `autorise_par` doit nommer un humain.

## 4. Ce que ce tri ne prouve pas

- Les 209 `SAFE` le sont **par lecture d'expression**, non par comportement.
  Seule une poignée a été éprouvée sous identité réelle.
- La frontière `service_role` est documentée, **pas éprouvée** : aucune
  fonction Edge n'existe en Test pour l'emprunter.
- La garde lit les migrations, pas la base.
