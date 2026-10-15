# Sources et limites

## Rail Handoff (lu au SHA par git)

- `docs/handoff/STATE.json` : registre des lots, `lot_actif`.
- `docs/handoff/lots/<LOT>/request-N.md`, `decision-N.md` : frontmatter (`status`, `decision`, `closes`, `in_reply_to`, `author`, `branch`) et bloc `NEXT_ACTION_CONTRACT`.
- `docs/handoff/CAPACITES-CANAL.json` : canaux (`github-actions-claude`, `session-claude-habilitee`, `arbitre-chatgpt`, `frederic`) et capacités.
- `docs/handoff/CANAUX.json` : canaux de transport, dont l'issue #28.
- `docs/handoff/BRANCHES-CLASSEES.json` : branches déjà classées (`outils/garde-branches-en-rade.js`).
- `docs/handoff/AUTORITES-DE-BRANCHE.json`, `ARBITRAGES-ACQUIS.json`.
- `docs/learning/EXPERIENCE.jsonl`, `RULES.json`, `INCIDENTS.jsonl`.

Récupérer un historique suffisant : un clone peu profond date à tort les fichiers les plus anciens (`git fetch --depth=3000` couvre le rail depuis juillet 2026).

## Instantané GitHub (JSON passé à `--github`)

```json
{
  "pulls_ouvertes": [{"number": 123, "title": "…", "head": "p1-executants-fermes", "base": "handoff-continuite-20260920", "body": "…"}],
  "branches_fusionnees": ["têtes des PR fusionnées"],
  "branches_integrees": ["branches dont compare(base...branche) rend behind ou identical, pour base ∈ rail, production, main"],
  "branches": ["toutes les branches distantes"]
}
```

Par le proxy de session, paginer les PR avec `page=N` (le `--paginate` de gh passe par des chemins numériques refusés).

## Supabase (session habilitée seulement)

Lecture seule : registre des migrations Test et Production (`comparerMigrations`), objets attendus, RLS. Jamais d'écriture, jamais de données métier.

## Outils voisins à réutiliser plutôt que doubler

- `audit-coherence-depot-supabase` : écarts dépôt/base, branches mortes, migrations.
- `nexus-incidents` : tout incident détecté pendant l'audit.
- `outils/garde-branches-en-rade.js`, `outils/verifier-apprentissage.js`, `outils/watchdog-stagnation.js`.

## Limites connues (14/10/2026)

- Les décisions antérieures au 08/10/2026 n'ont pas de contrat : leur suite se lit dans le texte, pas dans un champ.
- Une branche sans PR peut avoir été intégrée par copie de son diff : `compare` la donne alors « divergente ». Vérifier par le contenu avant de la dire orpheline.
- Le canal `github-actions-claude` ne lit ni Supabase ni le détail des runs.
