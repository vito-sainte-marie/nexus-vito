# Sécurité de la connexion — rapport phase A (avant le code)

Branche `claude/connexion-securite`, partie de `production` 15308601. Test uniquement (nexus-test). Rien en Production, aucun code modifié. Mesures faites sur Test avec des comptes fictifs (`manager-test`, `employe-test-a`) et un nom inexistant.

## 1. Chemin complet navigateur → Supabase Auth

1. `NEXUS-Login-v1.html` : le prénom et le code (`<input type="password" id="pin" maxlength="6" inputmode="numeric">`, l.73) sont saisis.
2. `tryLogin()` appelle `.rpc("nexus_identifiant_de_connexion", { p_prenom })` (≈ l.148), ouvert à `anon` (exception documentée, decision-1 humaine 799e0401).
3. La fonction renvoie `username` si **exactement un** employé correspond (`employees.nom`, casse et espaces ignorés, `actif` ou `compte_test`), sinon `NULL`.
4. `client.auth.signInWithPassword({ email: <username>@vito-nexus.local, password: <code> })` (≈ l.172). Le code **est** le mot de passe Supabase Auth.
5. Le message unique « Prénom ou code PIN incorrect. » (constante `REFUS`, l.118) couvre tous les échecs à l'écran.
6. Ensuite `nexus-auth.js` `nexusRequireAuth()` (≈ l.111) : garde de page côté client (session, ligne employé, `site_id`, prise de poste, pointage). La vraie protection des données est la RLS.

## 2. Le code court

- Vérifié par Supabase Auth, stocké en bcrypt (`$2a$`, 60 caractères, 12 comptes sur 12), jamais en clair.
- Longueur : le champ accepte au plus 6 caractères, pavé numérique. La longueur réelle des codes n'est **pas mesurable** (bcrypt) et aucune longueur minimale n'est lisible côté base ni dans le dépôt (pas de `supabase/config.toml`). À lire dans la console Auth (lecture seule) ou à demander à Guardian.
- Création, modification, réinitialisation : **aucun chemin dans le dépôt ni dans le schéma `public`** (pas de fonction, pas d'écran). Les codes sont donc posés hors application (console Supabase ou script), par le propriétaire du projet. Il n'existe aucune réinitialisation sûre par un manager ou le gérant aujourd'hui.

## 3. Énumération

| Appel | Existant | Inconnu | Ambigu (≥ 2) |
|---|---|---|---|
| RPC `nexus_identifiant_de_connexion` | 200, `"manager-test"` | 200, `null` | 200, `null` (lu dans la fonction, aucun cas sur Test : 0 doublon) |
| `signInWithPassword` (mauvais code) | 400 `invalid_credentials` | 400 `invalid_credentials` | — |

- Temps de réponse mesurés (3 appels par cas) : existant 0,24–0,57 s, inconnu 0,24–0,39 s. Pas de différence exploitable.
- **Mais** la RPC elle-même distingue « existe » de « n'existe pas » et **expose l'identifiant interne** (`username`) à n'importe quel visiteur anonyme, sans limite. L'interface masque la différence, pas le réseau.
- Conséquence : la liste des prénoms valides se parcourt sans aucune limite, et chaque prénom trouvé donne l'identifiant interne.

## 4. Protections existantes

| Protection | État mesuré |
|---|---|
| Limite de débit Auth | 429 `over_request_rate_limit` au 36e essai de connexion en rafale depuis une IP (limite par **IP**, non par compte ; valeur par défaut Supabase ≈ 30 essais / 5 min, non lue dans la console) |
| Limite sur la RPC | aucune (12 appels sans refus ; ce n'est pas une route Auth) |
| Verrouillage par compte | aucun |
| Délai progressif | aucun |
| Journal des refus | aucun : `auth.audit_log_entries` vide sur Test, rien dans `employees` |
| Captcha | aucun dans le code ; réglage console non lu |
| Protection des mots de passe divulgués | **désactivée** (alerte `auth_leaked_password_protection`). Elle compare à HaveIBeenPwned : pour un code numérique de 4 à 6 chiffres elle ne refuserait au mieux que les codes les plus courants (0000, 123456). Utile mais marginale ; ne remplace pas une limite par compte. |

Non vérifiables sans la console ou l'API de gestion (non disponibles ici) : longueur minimale du mot de passe, captcha, valeurs exactes des limites. Je les inscris « non mesuré », à confirmer par Guardian.

## 5. Calcul du risque (chiffres)

Limite mesurée : environ 30 essais / 5 min / IP, soit **360 essais par heure et par IP**. Aucune limite par compte.

| Code | Combinaisons | Une IP : balayage complet | Une IP : moyenne |
|---|---|---|---|
| 4 chiffres | 10 000 | 28 h | 14 h |
| 6 chiffres | 1 000 000 | 116 jours | 58 jours |

- Avec 10 adresses (ou un réseau mobile, ou un VPN) : 4 chiffres en ~1,4 h, 6 chiffres en ~12 jours. L'IP est le seul frein et elle se change.
- Un prénom se trouve sans limite (point 3). Les prénoms d'une équipe de station sont devinables.
- Risque réel : un code de 4 chiffres sur un compte à droits de gestion est trouvable en moins d'une journée par une personne motivée. Un code de 6 chiffres tient quelques semaines contre un attaquant patient. Les codes les plus courants (0000, 1234, 000000, 123456) tombent en quelques minutes.
- Gravité : l'accès donne la lecture et l'écriture dans le périmètre RLS de l'employé (manager : sa station).

## 6. Solutions comparées

Contraintes : démarrage de quart non ralenti sur téléphone ; aucun identifiant interne exposé ; rien qui révèle qu'un prénom existe ; pas de verrouillage durable sans déblocage par une personne autorisée ; aucun code en clair ; réinitialisation sûre par manager ou gérant.

### Option A — verrouillage par compte, côté base, derrière une RPC unique

Une fonction `nexus_connexion_preparer(p_prenom)` remplace l'appel actuel. Elle ne renvoie plus l'identifiant : elle renvoie un jeton opaque ou une valeur identique dans tous les cas (existant, inconnu, ambigu). Elle compte les échecs par compte dans une table dédiée (non lisible par les rôles applicatifs), applique un délai croissant (1 s, 5 s, 30 s, 5 min…) puis un verrouillage temporaire, et journalise les refus. L'identifiant sert côté serveur seulement. Le déblocage et la réinitialisation du code passent par une fonction réservée au manager ou au gérant de la station (ou au créateur), qui pose un code temporaire à changer à la première connexion.
- Coût employé : zéro en usage normal, un essai de plus par oubli. Un compte verrouillé demande un manager (déblocage automatique après le délai).
- Ferme : énumération par la RPC, devinette de code sur un compte (quelle que soit l'IP), réinitialisation sans procédure.
- Reste ouvert : déni de service ciblé (quelqu'un verrouille un collègue, atténué par le déverrouillage automatique court et la réinitialisation par le manager) ; la limite par IP de Supabase reste un réglage console.
- Contrainte technique à trancher : `signInWithPassword` est appelé par le navigateur directement ; sans passer par une Edge Function, le compte d'échecs ne peut pas être alimenté par Auth. Il faut soit une Edge Function de connexion (un aller-retour de plus, ≈ 0,3 s mesuré), soit un hook Auth (réglage Production).

### Option B — code plus long et réglages Auth seulement

Allonger le code à 6 chiffres minimum (imposer à la création), activer la protection des mots de passe divulgués, un captcha, et abaisser les limites par IP.
- Coût employé : un code plus long à retenir et saisir (un chiffre ou deux de plus) ; un captcha ralentit chaque début de quart sur téléphone (contraire à la contrainte).
- Ferme : les codes triviaux, une partie du balayage par IP.
- Reste ouvert : énumération des prénoms, identifiant interne exposé, aucun verrouillage par compte, aucune réinitialisation sûre, aucun journal. Presque rien de la liste des contraintes.

### Option C (variante légère de A) — sans Edge Function

Garder `signInWithPassword` direct, mais supprimer l'oracle : la RPC renvoie un identifiant **dérivé et opaque** pour tout prénom (même inexistant, qui échouera dans Auth) ; limite par compte approchée par un journal des essais côté base alimenté par la RPC préparatoire (compte les tentatives de connexion annoncées, non les échecs réels).
- Coût employé : nul. Ferme l'énumération et l'identifiant interne ; ne ferme pas la devinette de code par appel direct à Auth.

**Recommandation : option A** (avec l'Edge Function de connexion), car B et C laissent la devinette du code ouverte pour un attaquant qui contourne l'écran. Découpage proposé : étape 1 supprimer l'oracle et l'identifiant exposé (réversible, sans changer l'écran), étape 2 compteur, délai, verrouillage, journal, étape 3 déblocage et réinitialisation par manager/gérant, avec l'écran de connexion inchangé pour l'employé (aucune fiche de conception nécessaire tant qu'il ne change pas ; un écran de gestion des accès en demanderait une).

## 7. Ce qui est un réglage de Production (hors lot, GO distinct du gérant, appliqué par Guardian)

- Limites de débit Auth (connexions par IP et par heure).
- Captcha (si retenu, à arbitrer : contraire à la contrainte de rapidité).
- Protection des mots de passe divulgués.
- Longueur minimale du mot de passe.
- Hook Auth éventuel (si l'option A passe par un hook plutôt que par une Edge Function).
- Déploiement de l'Edge Function de connexion.

## Recette prévue en phase B (sur Test, comptes fictifs seulement)

Essais répétés sur un compte ; compte inexistant ; prénom ambigu (deux comptes fictifs de même prénom) ; deux navigateurs ou sessions en parallèle ; changement d'IP (non simulable depuis une seule machine : je le dirai, la limite par IP se vérifie par la rafale) ; verrouillage puis déblocage par un manager ; réinitialisation du code.

## Anomalies repérées, hors lot, non traitées

- Aucun chemin de création ou de réinitialisation de code dans l'application : à classer.
- Les cinq comptes `Recette…` inactifs ont un compte Auth et restent connectables si leur code est connu (`compte_test`).
