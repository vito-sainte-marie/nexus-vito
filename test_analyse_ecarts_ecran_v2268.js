// Test — v2.268-C2 (28/08/2026) : NEXUS-Analyse-Ecarts-v1.html, l'écran
// consolidé "Analyse des écarts" (cadrage de Frédéric). Vérifie les 3
// blocs de rendu extraits du vrai code (Article 11) : KPI (§5, jamais
// seulement le solde net), "À vérifier" (§6, lien profond exact vers la
// source), vue par employé (§11, écarts initiaux ≠ écarts finaux).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Analyse-Ecarts-v1.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const ecartsMoteurSrc = fs.readFileSync(path.join(DIR, 'nexus-ecarts-moteur.js'), 'utf8');

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function extraire(source, nomFonction) {
  const debut = source.indexOf(`function ${nomFonction}(`);
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
  let i = source.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (source[j] === '{') profondeur++;
    else if (source[j] === '}') profondeur--;
    j++;
  }
  return source.slice(debut, j);
}

function construireContexte() {
  const ctx = { console };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(ecartsMoteurSrc, ctx);

  const src = [
    extraire(script, 'fmtEuro'),
    extraire(script, 'fmtEuroAbs'),
    extraire(script, 'fmtDateCourt'),
    extraire(script, 'labelActivite'),
    extraire(script, 'labelStatut'),
    extraire(script, 'renderKpis'),
    extraire(script, 'renderListeAVerifier'),
    extraire(script, 'renderParEmploye'),
    'globalThis.__test = { renderKpis, renderListeAVerifier, renderParEmploye };',
  ].join('\n\n');

  const elements = {};
  function fabriquerElement(id) {
    return elements[id] || (elements[id] = { id, textContent: '', className: '', _html: '', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; } });
  }
  ctx.document = { getElementById: (id) => fabriquerElement(id) };
  ctx.NexusEcartsMoteur = ctx.NexusEcartsMoteur; // déjà posé par vm.runInContext ci-dessus
  vm.runInContext(src, ctx);
  return { ctx, elements };
}

// ------------------------------------------------------------
// 1) renderKpis — jamais seulement le solde net (§5, règle explicite du
// cadrage) : les 4 lectures doivent toutes être posées.
// ------------------------------------------------------------
{
  const { ctx, elements } = construireContexte();
  const lignes = [
    { ecartFinal: 12, statut: 'a_verifier' },
    { ecartFinal: 8, statut: 'regularise' },
    { ecartFinal: -5, statut: 'a_verifier' },
    { ecartFinal: -20, statut: 'cloture_non_explique' },
    { ecartFinal: 0, statut: null }, // ne doit jamais compter dans le volume
  ];
  ctx.__test.renderKpis(lignes);

  // Solde net = 12+8-5-20 = -5
  assert.strictEqual(elements.kpiSoldeNet.textContent, '-5,00 €');
  assert.strictEqual(elements.kpiSoldeNet.className, 'kpi-valeur neg');
  assert.strictEqual(elements.kpiPositifs.textContent, '20,00 €', 'total des excédents (12+8) : ' + elements.kpiPositifs.textContent);
  assert.strictEqual(elements.kpiPositifsNb.textContent, '2 écarts');
  assert.strictEqual(elements.kpiNegatifs.textContent, '25,00 €', 'total des manques en valeur absolue (5+20) : ' + elements.kpiNegatifs.textContent);
  assert.strictEqual(elements.kpiNegatifsNb.textContent, '2 écarts');
  assert.strictEqual(elements.kpiAInvestiguer.textContent, '2', 'seuls les statuts a_verifier comptent (2, pas plus) : ' + elements.kpiAInvestiguer.textContent);
  assert.strictEqual(elements.kpiVolume.textContent, '45,00 €', 'volume = somme des valeurs absolues (12+8+5+20) : ' + elements.kpiVolume.textContent);

  ok('renderKpis — 5 cartes KPI toutes posées correctement (solde net jamais seul, positifs/négatifs/à investiguer/volume tous distincts)');
}

// ------------------------------------------------------------
// 2) renderListeAVerifier — seuls les statuts 'a_verifier' apparaissent,
// avec un lien profond EXACT (jamais une page générique).
// ------------------------------------------------------------
{
  const { ctx, elements } = construireContexte();
  const lignes = [
    { statut: 'a_verifier', activite: 'piste', ecartFinal: -9, date: '2026-08-27', quart: '2', employeeNom: 'Marc', deepLink: 'NEXUS-Verify-v1.html?ouvrir_date=2026-08-27&ouvrir_quart=2' },
    { statut: 'a_verifier', activite: 'fdj', ecartFinal: 15, date: '2026-08-26', quart: '1', employeeNom: null, deepLink: 'NEXUS-FDJ-Manager-v1.html?date=2026-08-26&quart=1' },
    { statut: 'regularise', activite: 'boutique', ecartFinal: 0, date: '2026-08-25', quart: '1', employeeNom: 'Angélique', deepLink: 'NEXUS-Verify-v1.html?ouvrir_date=2026-08-25&ouvrir_quart=1' },
  ];
  ctx.__test.renderListeAVerifier(lignes);
  const out = elements.listeAVerifier.innerHTML;

  assert.ok(out.includes('href="NEXUS-Verify-v1.html?ouvrir_date=2026-08-27&ouvrir_quart=2"'), 'lien profond exact vers le quart Verify concerné : ' + out);
  assert.ok(out.includes('href="NEXUS-FDJ-Manager-v1.html?date=2026-08-26&quart=1"'), 'lien profond exact vers le quart FDJ concerné : ' + out);
  assert.ok(!out.includes('Angélique') && !out.includes('2026-08-25'), 'la ligne régularisée (pas à vérifier) ne doit jamais apparaître dans cette liste : ' + out);
  assert.ok(out.includes('Marc'), 'employé affiché quand connu');
  assert.ok(out.includes('-9,00 €'), 'montant exact affiché : ' + out);

  // Liste vide -> message factuel, jamais un tableau cassé.
  const { ctx: ctx2, elements: el2 } = construireContexte();
  ctx2.__test.renderListeAVerifier([]);
  assert.ok(el2.listeAVerifier.innerHTML.includes('Aucun écart à vérifier'), 'message explicite quand rien à vérifier : ' + el2.listeAVerifier.innerHTML);

  ok('renderListeAVerifier — ne montre que les écarts réellement à vérifier, chaque ligne pointe vers sa source exacte (jamais une page générique)');
}

// ------------------------------------------------------------
// 3) renderParEmploye — écarts INITIAUX détectés distincts des écarts
// FINAUX retenus, jamais confondus (§11, citation exacte du cadrage).
// ------------------------------------------------------------
{
  const { ctx, elements } = construireContexte();
  // Un employé avec 3 écarts initiaux détectés, 2 régularisés (donc 1
  // seul écart final restant) -> ne doit jamais afficher "3 erreurs".
  const lignes = [
    { employeeId: 'e1', employeeNom: 'Angélique', ecartInitial: 12, ecartFinal: 0, statut: 'regularise' },
    { employeeId: 'e1', employeeNom: 'Angélique', ecartInitial: 5, ecartFinal: 0, statut: 'regularise' },
    { employeeId: 'e1', employeeNom: 'Angélique', ecartInitial: -8, ecartFinal: -8, statut: 'cloture_non_explique' },
  ];
  ctx.__test.renderParEmploye(lignes);
  const out = elements.listeParEmploye.innerHTML;
  assert.ok(out.includes('3 détectés'), 'écarts initiaux détectés : 3 (jamais confondu avec le nombre final retenu) : ' + out);
  assert.ok(out.includes('2 régularisés'), '2 régularisés : ' + out);
  assert.ok(out.includes('-8,00 €'), 'solde final retenu = seul l\'écart non régularisé (-8), jamais la somme des 3 initiaux : ' + out);

  ok('renderParEmploye — distingue explicitement écarts initiaux détectés (3) et solde final réellement retenu (-8,00 €), jamais confondus');
}

console.log(`\n${n} tests passés.`);
