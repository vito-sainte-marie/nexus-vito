# Compare le passage T1 v2 au passage v1 (même données, lecture seule). python3 -I comparer_v1_v2_t1.py
import json, os, csv, collections
ICI = os.path.dirname(os.path.abspath(__file__))
v1 = {l['article']: l for l in json.load(open(os.path.join(ICI, 'resultats', 'v1', 'resultats_sainte_marie_t1.json'), encoding='utf-8'))['lignes']}
v2 = {l['article']: l for l in json.load(open(os.path.join(ICI, 'resultats', 'resultats_sainte_marie_t1.json'), encoding='utf-8'))['lignes']}
assert set(v1) == set(v2), 'mêmes références'
def gain(l, k):
    s = l['simulation'].get(k); return s['gain'] if s else None
rows = []
for a in sorted(v1):
    x, y = v1[a], v2[a]
    a6x = any(z['code'] == 'A6' for z in x['alertes']); a6y = any(z['code'] == 'A6' for z in y['alertes'])
    ch = []
    if x['statut'] != y['statut']: ch.append('statut')
    if x['fiabilite']['niveau'] != y['fiabilite']['niveau']: ch.append('fiabilité')
    if x['conformite']['etat'] != y['conformite']['etat']: ch.append('conformité')
    if gain(x, 'minimum') != gain(y, 'minimum'): ch.append('simulation minimum')
    if a6x != a6y: ch.append('A6')
    if ch: rows.append([a, y['famille'], x['statut'], y['statut'], gain(x, 'minimum'), gain(y, 'minimum'), gain(y, 'repereMinimum'), 'oui' if a6x else 'non', 'oui' if a6y else 'non', ', '.join(ch), y['raisonStatut']])
with open(os.path.join(ICI, 'resultats', 'divergences_v1_v2_t1.csv'), 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.writer(fh, delimiter=';')
    w.writerow(['Désignation', 'Famille', 'Statut v1', 'Statut v2', 'Gain minimum v1', 'Gain minimum v2 (décisionnel)', 'Repère indicatif v2 (non décisionnel)', 'A6 v1', 'A6 v2', 'Changements', 'Raison v2'])
    w.writerows(rows)
print(len(rows), 'références modifiées sur', len(v1))
print(collections.Counter((r[2], r[3]) for r in rows if r[2] != r[3]).most_common())
print(collections.Counter(r[1] for r in rows).most_common())
print([r[0] for r in rows if 'A6' in r[9]], [r[0] for r in rows if 'conformité' in r[9]])
