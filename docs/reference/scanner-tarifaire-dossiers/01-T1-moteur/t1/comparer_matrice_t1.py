# Compare le moteur T1 à la matrice du 16/11/2026 (lecture seule). python3 -I comparer_matrice_t1.py
import json, os, collections, csv
from openpyxl import load_workbook
ICI = os.path.dirname(os.path.abspath(__file__))
r = json.load(open(os.path.join(ICI, 'resultats', 'resultats_sainte_marie_t1.json'), encoding='utf-8'))
eng = {l['article']: l for l in r['lignes']}
wb = load_workbook(os.path.join(ICI, '..', 'dossier', 'livrables', 'matrice-tarifaire-sainte-marie.xlsx'), data_only=True); ws = wb['Matrice']
hdr = [c.value for c in ws[1]]; mat = {}
for row in ws.iter_rows(min_row=2, values_only=True):
    d = dict(zip(hdr, row)); mat[d['Désignation']] = d
FIA = {'fiable': 'fiable', 'à confirmer': 'a_confirmer', 'insuffisante': 'insuffisante'}
ST = {'conforme': 'conforme', 'à surveiller': 'a_surveiller', 'à vérifier': 'a_verifier', 'proposition à valider': 'proposition_a_valider'}
rows = []
for a, m in mat.items():
    e = eng.get(a)
    if not e: rows.append([a, m['Rayon Decenium'], 'absente du moteur', '', '', '', '']); continue
    f0, f1 = FIA[m['Fiabilité']], e['fiabilite']['niveau']; s0, s1 = ST[m['Statut']], e['statut']
    if f0 != f1 or s0 != s1:
        rows.append([a, m['Rayon Decenium'], f0, f1, s0, s1, e['raisonStatut'] + ' | ' + '; '.join(e['fiabilite']['raisons'])])
with open(os.path.join(ICI, 'resultats', 'divergences_matrice_t1.csv'), 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.writer(fh, delimiter=';'); w.writerow(['Désignation', 'Rayon', 'Fiabilité matrice', 'Fiabilité T1', 'Statut matrice', 'Statut T1', 'Raison T1']); w.writerows(rows)
print(len(rows), 'références divergentes sur', len(mat))
print(collections.Counter((x[2], x[3]) for x in rows if x[2] != x[3]).most_common())
print(collections.Counter((x[4], x[5]) for x in rows if x[4] != x[5]).most_common())
