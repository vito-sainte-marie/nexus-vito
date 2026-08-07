# NEXUS — Moteur documentaire (OCR Local / Cloud)
### Note de conception — 07/08/2026

Portée : architecture d'un moteur d'OCR pour NEXUS (lecture de factures, justificatifs, documents scannés), capable de tourner en **Mode Local** (V1, sur l'iMac, coût zéro) puis en **Mode Cloud** (V2, hébergé) sans toucher au code métier de NEXUS.

---

## 1. Principe directeur

Le code métier de NEXUS (Supabase : tables, RPC, Edge Functions, écrans) ne doit **jamais savoir** où ni comment l'OCR est exécuté. Il dépose une demande de traitement dans une file d'attente et récupère un résultat plus tard, un peu comme il le fait déjà pour d'autres traitements asynchrones (ex. `google-sheets-sync`).

Le seul composant qui change entre V1 et V2 est le **worker documentaire** : un programme externe à NEXUS qui consomme la file, appelle un moteur OCR, et écrit le résultat. Ce worker tourne sur l'iMac en V1, sur Railway/Fly.io en V2 — c'est le même code, packagé en conteneur, seule sa localisation change.

Cette séparation (file d'attente + worker interchangeable) est ce qui garantit "sans modification du code métier" : le contrat entre NEXUS et le worker est une table Supabase, pas une adresse réseau.

## 2. Vue d'ensemble

```
┌─────────────┐      dépose        ┌────────────────────────┐
│  NEXUS App  │ ─────────────────▶ │ documents_ocr_file      │  (table Supabase,
│ (Import,    │                    │  status: en_attente     │   = le contrat,
│  Comptes    │ ◀───────────────── │  status: traite         │   ne change jamais)
│  Clients…)  │      lit résultat  │  status: erreur         │
└─────────────┘                    └───────────┬─────────────┘
                                                │ polling (toutes les 5-10s)
                                                ▼
                                    ┌───────────────────────┐
                                    │   Worker documentaire  │  ← seul composant qui change
                                    │  (Python, conteneurisé)│
                                    │  interface OCREngine   │
                                    └─────┬─────────────┬────┘
                                          │             │
                              ┌───────────▼───┐   ┌─────▼──────────┐
                              │ Adaptateur     │   │ Adaptateur      │
                              │ Local          │   │ Cloud (V2)      │
                              │ PaddleOCR +    │   │ ex. API OCR     │
                              │ OCRmyPDF       │   │ managée / même  │
                              │ (sur l'iMac)   │   │ moteur hébergé  │
                              └────────────────┘   └─────────────────┘
```

Le worker tourne toujours en dehors de la requête utilisateur : il **tire** son travail (polling), il ne le reçoit jamais en direct. Ça évite d'avoir besoin d'ouvrir un port sur l'iMac ou de gérer un webhook entrant — l'iMac initie toujours la connexion vers Supabase, jamais l'inverse.

## 3. Le contrat (ce qui ne change jamais)

Table `documents_ocr_file` :

| Colonne | Type | Rôle |
|---|---|---|
| `id` | uuid | identifiant de la demande |
| `site_id` | uuid | station concernée |
| `fichier_path` | text | chemin dans Supabase Storage (bucket `documents-a-traiter`) |
| `type_document` | text | `facture`, `justificatif`, `bon_livraison`… |
| `status` | text | `en_attente` → `en_cours` → `traite` \| `erreur` |
| `moteur_utilise` | text | rempli par le worker (`paddleocr`, `ocrmypdf`, `cloud-x`) — traçabilité, pas de config |
| `resultat_texte` | text | texte extrait |
| `resultat_json` | jsonb | champs structurés si extraction avancée (montant, date, fournisseur) |
| `erreur_message` | text | si `status = erreur` |
| `deposited_at` / `traite_at` | timestamptz | horodatage |

NEXUS écrit une ligne `en_attente` et upload le fichier dans le bucket. NEXUS lit ensuite `status`/`resultat_*` par polling léger ou par un `realtime` Supabase sur la table. Il n'appelle jamais le worker directement — c'est ce découplage qui permet de changer le worker (moteur, hébergeur) sans toucher un seul écran ou une seule Edge Function de NEXUS.

## 4. Le worker : une interface, deux adaptateurs

```python
# ocr_engine.py — le contrat interne au worker, pas au code métier NEXUS
class OCREngine(ABC):
    @abstractmethod
    def extraire(self, fichier: bytes, type_document: str) -> ResultatOCR:
        """Retourne texte brut + champs structurés si possible."""

    @abstractmethod
    def nom(self) -> str:
        """Identifiant du moteur, écrit dans moteur_utilise."""
```

**Adaptateur Local** (`LocalEngine`) :
- PDF texte natif ou scanné → **OCRmyPDF** (ajoute une couche texte, gère la rotation/deskew) ;
- images (photos de factures, JPEG/PNG) → **PaddleOCR** directement ;
- tourne en process local sur l'iMac, aucun appel réseau externe, donc **aucun coût d'hébergement ni d'API**.

**Adaptateur Cloud** (`CloudEngine`, V2) :
- même interface `OCREngine`, implémentation qui appelle soit le même PaddleOCR/OCRmyPDF packagés dans un conteneur hébergé, soit une API OCR tierce si on préfère déléguer ;
- déployé sur Railway ou Fly.io (au choix, cf. §6) — un `Dockerfile` unique suffit pour les deux.

Le choix de l'adaptateur se fait à une seule ligne, au démarrage du worker, via configuration — jamais en dur dans le code :

```python
# main.py (worker)
moteur = {
    "local": LocalEngine,
    "cloud": CloudEngine,
}[os.environ["NEXUS_OCR_MODE"]]()
```

## 5. Configuration (ce qui doit être réglable sans redéployer NEXUS)

Deux axes indépendants, tous deux pilotés par variables d'environnement **du worker** (jamais du code métier NEXUS) :

| Variable | Valeurs | Rôle |
|---|---|---|
| `NEXUS_OCR_MODE` | `local` \| `cloud` | quel adaptateur `OCREngine` charger |
| `NEXUS_OCR_ENGINE` | `paddleocr` \| `ocrmypdf` \| `auto` | quel moteur utiliser à l'intérieur de l'adaptateur (auto = OCRmyPDF pour PDF, PaddleOCR pour image) |
| `NEXUS_WORKER_HOST` | `imac` \| `railway` \| `flyio` | valeur informative, écrite dans les heartbeats (§7) pour affichage dans NEXUS |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | — | connexion à la file d'attente (identique en local et cloud) |

Basculer V1 → V2 revient à changer `NEXUS_OCR_MODE=cloud` et redéployer le worker ailleurs — zéro ligne touchée côté NEXUS.

## 6. V1 — Mode Local (priorité)

- Le worker Python tourne sur l'iMac, lancé au démarrage via un agent `launchd` (redémarre seul si crash ou reboot).
- Dépendances installées localement : `paddleocr`, `paddlepaddle`, `ocrmypdf` (+ `tesseract` comme moteur sous-jacent d'OCRmyPDF).
- Coût : nul — pas de facturation cloud, seul le courant de l'iMac.
- Limite assumée : **le traitement ne peut avoir lieu que si l'iMac est allumé et connecté** — voir §7 pour la gestion de ce cas, qui est justement la contrainte à l'origine de la demande d'alerte.

## 7. Détection "serveur éteint" + message sympa dans NEXUS

Le worker écrit un battement de cœur régulier dans une table dédiée :

Table `moteur_documentaire_etat` (une seule ligne, mise à jour en continu) :

| Colonne | Valeur exemple |
|---|---|
| `dernier_battement` | `2026-08-07 09:14:32+00` |
| `mode` | `local` |
| `hote` | `imac` |
| `moteur_actif` | `paddleocr` |
| `documents_en_attente` | `3` |

Le worker met à jour `dernier_battement` toutes les 30 secondes, qu'il ait ou non des documents à traiter. NEXUS (front) lit cette ligne et calcule l'ancienneté du battement :

- `< 2 min` → moteur considéré actif, rien à afficher ;
- `≥ 2 min` → bannière d'alerte, non bloquante, sur les écrans qui utilisent l'OCR (Import, Comptes Clients) et en secondaire sur l'accueil s'il y a des documents en attente.

Messages (ton léger, rotation possible) :

- *"😴 Ton moteur documentaire fait la sieste — allume l'iMac (ou relance le worker) pour que tes factures se scannent toutes seules."*
- *"📭 Personne à l'écoute côté OCR pour l'instant. Dès que l'iMac se réveille, les documents en attente partiront tout seuls."*
- *"⏸️ Le scan des documents est en pause — l'iMac semble endormi. Rien n'est perdu, tout repartira dès sa reconnexion."*

Sous la phrase, un détail factuel discret : `3 document(s) en attente depuis 09:12`. Le ton reste sympa mais l'info reste vraie et actionnable — jamais d'angoisse inutile, le message rappelle que rien n'est perdu (les demandes restent `en_attente` dans la file, elles seront traitées dès que le worker revient).

## 8. V2 — Mode Cloud (sans modification du code métier)

- Le worker (même code, même image Docker) est déployé sur Railway ou Fly.io — le choix de l'hébergeur est lui-même une variable de déploiement, pas une décision qui touche NEXUS.
- Seul change `NEXUS_OCR_MODE=cloud` et, si besoin, `NEXUS_OCR_ENGINE` si le moteur cloud diffère du local.
- NEXUS continue de déposer dans `documents_ocr_file` et de lire `resultat_*` exactement comme avant — aucune Edge Function, aucun écran, aucune table métier ne change.
- `moteur_documentaire_etat.hote` passe à `railway` ou `flyio` : le bandeau d'alerte du §7 s'applique alors à un serveur cloud qui ne devrait, sauf incident, jamais être "éteint" — la logique de heartbeat reste utile pour détecter une panne ou un déploiement en échec.

## 9. Migration V1 → V2

1. Construire l'image Docker du worker (déjà nécessaire pour la cohérence local/cloud, testable en local via Docker avant tout déploiement).
2. Déployer sur Railway/Fly.io en parallèle du worker local, avec `NEXUS_OCR_MODE=cloud`.
3. Basculer : couper le worker local, laisser le cloud seul répondre à la file — aucun risque de double traitement car le worker marque `en_cours` avant de traiter (verrou optimiste sur `status`).
4. Garder le worker local disponible en secours (relance manuelle) pendant une période de transition, si l'on veut un filet de sécurité gratuit en cas de coupure du service cloud.

## 10. Points d'attention

- **Confidentialité** : en mode local, les documents ne quittent jamais l'iMac pour l'OCR (seul le résultat texte remonte vers Supabase) — argument à garder si des documents sensibles (données bancaires sur factures) sont traités avant la V2.
- **Coût V2** : Railway/Fly.io facturent le temps d'exécution du conteneur — prévoir un point de vigilance budgétaire au moment du passage en cloud, absent en V1.
- **Un seul worker actif à la fois** recommandé pour éviter tout double traitement pendant la transition ; le verrou `status = en_cours` protège déjà contre ce cas si jamais deux workers tournent en même temps.

---

**Prochaine étape suggérée** : implémenter la table `documents_ocr_file` + `moteur_documentaire_etat` (migration Supabase), le worker minimal en mode `local` avec `LocalEngine`, et le bandeau d'alerte (§7) sur `NEXUS-Import-v1.html`, qui est l'écran le plus proche d'un besoin de lecture de documents aujourd'hui.
