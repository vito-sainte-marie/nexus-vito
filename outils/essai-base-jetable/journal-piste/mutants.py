#!/usr/bin/env python3
"""Fabrique les mutants de la migration candidate Journal Piste.

Chaque mutant affaiblit UNE protection. La preuve doit le tuer : un mutant qui
survit désigne une protection que la preuve ne surveille pas.

Le mutant est joué dans la même transaction que la preuve : le « commit » final
de la migration est retiré et le « rollback » final de la preuve annule tout.
Un mutant identique à l'original n'est jamais joué : il est déclaré « non
appliqué », pour qu'un remplacement muet ne passe pas pour un mutant tué.

Usage : mutants.py <migration.sql> <dossier_sortie> [migration-request-2.sql]
Écrit <dossier>/<nom>.sql et <dossier>/liste.tsv (nom, description).
"""
import re
import sys
from pathlib import Path

source = Path(sys.argv[1]).read_text()
dest = Path(sys.argv[2])
dest.mkdir(parents=True, exist_ok=True)

COMMIT_FINAL = re.compile(r"\ncommit;\s*$")
assert COMMIT_FINAL.search(source), "la migration doit finir par commit;"


def sans_commit(texte):
    return COMMIT_FINAL.sub("\n-- commit retiré : la preuve annule tout\n", texte)


mutants = [("temoin", "migration intacte (le banc doit rendre la même chose que la preuve seule)", source)]

# 1. Chaque REVOKE retiré, un par un.
revokes = list(re.finditer(r"^revoke [^;]*;", source, re.M | re.S))
for k, m in enumerate(revokes, 1):
    texte = source[: m.start()] + "-- MUTANT : revoke retiré\n" + source[m.end():]
    resume = " ".join(m.group(0).split())[:110]
    mutants.append((f"revoke-{k:02d}", f"retire : {resume}", texte))

# 2. Helpers d'identité rendus usurpables (retour à la faiblesse F-1).
texte = source
for helper in ("piste_site_appelant", "piste_role_appelant"):
    motif = re.compile(
        r"(create or replace function public\." + helper + r"\(\).*?)set search_path to pg_catalog, public, pg_temp(.*?)public\.employees",
        re.S,
    )
    texte, n = motif.subn(r"\1set search_path to public\2employees", texte, count=1)
    assert n == 1, helper
mutants.append(("helpers-usurpables", "helpers : search_path=public et employees non qualifié (F-1)", texte))

# 3. pg_temp remis en tête sur toutes les fonctions du lot (F-2).
texte = source.replace("set search_path to pg_catalog, public, pg_temp", "set search_path to public")
mutants.append(("search-path-public", "toutes les fonctions : search_path=public (F-2)", texte))

# 4. Lecture élargie en écriture sur les trois tables.
texte = source.replace("grant select on public.carburant_index_config,", "grant all on public.carburant_index_config,", 1)
mutants.append(("tables-grant-all", "grant all au lieu de grant select à authenticated sur les trois tables", texte))

# 5. Fonction interne ouverte aux clients.
texte = COMMIT_FINAL.sub(
    "\ngrant execute on function public.piste_evaluer_site(text, date) to authenticated;\ncommit;\n", source
)
mutants.append(("interne-ouverte", "grant execute sur piste_evaluer_site(text,date) à authenticated", texte))

# 6. Politique de lecture des alertes ouverte à tous.
texte, n = re.subn(
    r"(create policy select_carburant_index_alertes on public\.carburant_index_alertes\s+for select to authenticated using )\(\(select public\.piste_manager_du_site\(site\)\)\)",
    r"\1(true)",
    source,
)
mutants.append(("rls-alertes-true", "politique de lecture des alertes : using (true)", texte if n == 1 else source))

# 7. Témoin historique : la migration de request-2, jouée telle quelle.
if len(sys.argv) > 3:
    r2 = Path(sys.argv[3]).read_text()
    assert COMMIT_FINAL.search(r2), "request-2 doit finir par commit;"
    mutants.append(("request-2", "migration de request-2 entière (avant les corrections F-1 à F-3)", r2))

with open(dest / "liste.tsv", "w") as liste:
    for nom, description, texte in mutants:
        applique = nom == "temoin" or texte != source
        (dest / f"{nom}.sql").write_text(sans_commit(texte))
        liste.write(f"{nom}\t{'oui' if applique else 'NON'}\t{description}\n")
print(f"{len(mutants)} mutants, dont {len(revokes)} revoke")
