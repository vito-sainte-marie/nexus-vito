#!/usr/bin/env python3
"""Mesure de référence de la boucle Handoff NEXUS, en lecture seule, depuis l'API GitHub.
Rejouable : python3 mesurer-boucle.py <debut ISO> <fin ISO>. Sortie : mesures.json + tours.csv + arrets-humains.csv.
Définitions stables (V2) :
- TOUR DISPATCHÉ : run du workflow claude.yml déclenché par repository_dispatch dans la fenêtre.
- Classement d'un tour, par les commits du rail dont le nom d auteur est claude[bot] (le compte GitHub est github-actions[bot]), entre le début du run et sa fin + 5 min :
  chaque commit n'est attribué qu'à un seul run : le dernier run démarré avant lui, s'il se termine moins de 5 min avant.
  ECHEC (run failure/cancelled), SAUTE (skipped), AUCUN_COMMIT, REGISTRE_SEUL (seuls des fichiers docs/handoff/ changés
  et aucune request-N.md ajoutée : c'est le « tour vide » de la garde de claude.yml), COMPLET (travail hors
  docs/handoff/ ou nouvelle request-N.md).
- ARRÊT HUMAIN : commentaire « Réponse de l'arbitre » sur #28 dont le contrat porte DECISION: BLOCKED ou OWNER_NEXT: Frédéric.
"""
import json, subprocess, sys, csv, re, os
from datetime import datetime, timedelta
R = "vito-sainte-marie/nexus-vito"; RAIL = "handoff-continuite-20260920"
debut, fin = sys.argv[1], sys.argv[2]
sortie = sys.argv[3] if len(sys.argv) > 3 else "."  # dossier d'écriture des résultats (défaut : dossier courant)
os.makedirs(sortie, exist_ok=True)
def api(path, cle=None):
    pages, page = [], 1
    while True:
        sep = "&" if "?" in path else "?"
        out = json.loads(subprocess.run(["gh", "api", f"{path}{sep}page={page}"], capture_output=True, text=True, check=True).stdout)
        items = out[cle] if cle else out
        pages.append(items)
        if len(items) < 100: return pages
        page += 1
def dt(s): return datetime.fromisoformat(s.replace("Z", "+00:00"))
# 1. Tours dispatchés
pages = api(f"repos/{R}/actions/runs?per_page=100&event=repository_dispatch&created={debut[:10]}..{fin[:10]}", "workflow_runs")
runs = [r for p in pages for r in p if r["path"].endswith("claude.yml") and debut <= r["created_at"] <= fin]
commits = [c for p in api(f"repos/{R}/commits?sha={RAIL}&since={debut}&until={(dt(fin)+timedelta(hours=1)).isoformat()}&per_page=100") for c in p]
runs = sorted(runs, key=lambda r: r["created_at"])
bot = [c for c in commits if c["commit"]["author"]["name"] == "claude[bot]"]
attribution = {}
for c in bot:
    t = dt(c["commit"]["committer"]["date"])
    cand = [r for r in runs if dt(r["run_started_at"] or r["created_at"]) <= t <= dt(r["updated_at"]) + timedelta(minutes=5)]
    if cand: attribution.setdefault(cand[-1]["id"], []).append(c)
tours = []
for r in runs:
    d0, d1 = dt(r["run_started_at"] or r["created_at"]), dt(r["updated_at"]) + timedelta(minutes=5)
    if r["conclusion"] in ("failure", "cancelled", "startup_failure", "timed_out"): cl, cs = "ECHEC", []
    elif r["conclusion"] == "skipped": cl, cs = "SAUTE", []
    else:
        cs = attribution.get(r["id"], [])
        fichiers = []
        for c in cs:
            fichiers += [(f["status"], f["filename"]) for f in json.loads(subprocess.run(["gh","api",f"repos/{R}/commits/{c['sha']}"],capture_output=True,text=True,check=True).stdout).get("files", [])]
        travail = [f for s, f in fichiers if not f.startswith("docs/handoff/")]
        demande = [f for s, f in fichiers if s == "added" and re.match(r"docs/handoff/lots/[^/]+/request-\d+\.md$", f)]
        cl = "AUCUN_COMMIT" if not cs else ("COMPLET" if travail or demande else "REGISTRE_SEUL")
    tours.append({"run": r["id"], "debut": r["created_at"], "conclusion": r["conclusion"], "classe": cl, "commits": " ".join(c["sha"][:8] for c in cs)})
# 2. Arrêts humains
com = [c for p in api(f"repos/{R}/issues/28/comments?per_page=100&since={debut}") for c in p if debut <= c["created_at"] <= fin]
arb = [c for c in com if c["body"].startswith("Réponse de l'arbitre")]
hum = [c for c in arb if re.search(r"DECISION:\s*`?BLOCKED", c["body"]) or re.search(r"OWNER_NEXT:\s*`?Fr[ée]d[ée]ric", c["body"])]
with open(os.path.join(sortie, "tours.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(tours[0].keys()) if tours else ["run"]); w.writeheader(); w.writerows(tours)
with open(os.path.join(sortie, "arrets-humains.csv"), "w", newline="") as f:
    w = csv.writer(f); w.writerow(["commentaire", "date", "url"]); [w.writerow([c["id"], c["created_at"], c["html_url"]]) for c in hum]
from collections import Counter
res = {"fenetre": [debut, fin], "tours_dispatches": len(tours), "classes": Counter(t["classe"] for t in tours),
       "reponses_arbitre": len(arb), "arrets_humains": len(hum)}
json.dump(res, open(os.path.join(sortie, "mesures.json"), "w"), ensure_ascii=False, indent=1); print(json.dumps(res, ensure_ascii=False))
