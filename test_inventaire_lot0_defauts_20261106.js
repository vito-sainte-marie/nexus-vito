// Contrôle inventaire, lot 0 (06/11/2026) : quatre défauts du Manager.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Inventaire-Manager-v1.html'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20261106100000_cloture_incomplete_perimetre_piste.sql'), 'utf8');

function extraire(nom, async_) {
  const debut = html.indexOf((async_ ? 'async function ' : 'function ') + nom + '(');
  assert.ok(debut >= 0, nom + ' introuvable');
  let i = html.indexOf('{', debut), n = 0;
  for (; i < html.length; i++) { if (html[i] === '{') n++; else if (html[i] === '}' && --n === 0) break; }
  return html.slice(debut, i + 1);
}
let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

const contexte = (fuseau) => new Function('FUSEAU_STATION_IM', 'quartSelectionne', 'NexusStation', 'JAUGEAGE_NOM', 'DECISIONS', 'resoudreAlerteSansRecharger', 'chargerEtAfficherTout', 'alert', 'QUART_VERS_CLE_HORAIRE',
  extraire('libelleStatutQuart') + extraire('libelleEtatQuart') + extraire('construireSynthese') +
  "const TYPES_ALERTE_HORS_TOUT_VALIDER = ['cloture_incomplete', 'demarque_ventes'];" +
  extraire('alertesValidablesEnBloc') + extraire('validerToutesAlertes', true) +
  'return { libelleEtatQuart, construireSynthese, validerToutesAlertes, alertesValidablesEnBloc };');

verifier('défaut 3 : un quart clôturé ou passé n\'est jamais « pas encore commencé »', () => {
  const resolues = [];
  const c = contexte()('America/Martinique', 'matin', { minutesLocalesStation: () => 7 * 60, minutesDepuisMinuit: () => 13 * 60 + 15 }, 'Jaugeage Carburant',
    [{ value: 'validee' }], async (id) => { resolues.push(id); return true; }, async () => {}, () => {}, { matin: 'quart1' });
  const hier = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const horaires = { quart1: { fin_normal: '13:15' } };
  const incomplet = c.libelleEtatQuart({ statut: 'cloture', date: hier, cloture_le: null }, { phase: 'clotures', manquants: 2 }, horaires);
  assert.ok(/Quart clôturé · comptage de clôture incomplet \(2 manquants\)/.test(incomplet.texte), incomplet.texte);
  assert.ok(!/pas encore commencé/.test(incomplet.texte));
  const complet = c.libelleEtatQuart({ statut: 'cloture', date: hier }, { phase: 'clotures', manquants: 0 }, horaires);
  assert.ok(/comptage de clôture complet/.test(complet.texte), complet.texte);
  const passeOuvert = c.libelleEtatQuart({ statut: 'ouvert', date: hier }, { phase: 'clotures', manquants: 3 }, horaires);
  assert.ok(!/pas encore commencé/.test(passeOuvert.texte), passeOuvert.texte);
});

verifier('défaut 4 : « Tout valider » ne touche ni cloture_incomplete ni demarque_ventes', async () => {
  const resolues = [];
  const c = contexte()('America/Martinique', 'matin', {}, 'Jaugeage Carburant', [{ value: 'validee' }],
    async (id) => { resolues.push(id); return true; }, async () => {}, () => {}, {});
  const alertes = [{ id: 'a', type_alerte: 'ecart_stock' }, { id: 'b', type_alerte: 'cloture_incomplete' }, { id: 'c', type_alerte: 'demarque_ventes' }];
  assert.deepStrictEqual(c.alertesValidablesEnBloc(alertes).map(a => a.id), ['a']);
  c.validerToutesAlertes(alertes).then(() => assert.deepStrictEqual(resolues, ['a']));
});

verifier('défaut 2 : la référence des attendus est la zone piste, pour la page', () => {
  const c = contexte()('America/Martinique', 'matin', {}, 'Jaugeage Carburant', [], null, null, () => {}, {});
  const produits = [
    { id: 1, designation: 'Gaz', inventaire_categories: { nom: 'Gaz' }, inventaire_zones: { code: 'piste' } },
    { id: 2, designation: 'Glaçons', inventaire_categories: { nom: 'Glaçons' }, inventaire_zones: { code: 'piste' } },
    { id: 3, designation: 'Chips', inventaire_categories: { nom: 'Épicerie' }, inventaire_zones: { code: 'boutique' } },
  ];
  const s = c.construireSynthese(produits, { ouverts: new Set(), clotures: new Set([1]) }, false, { statut: 'ouvert' }, []);
  assert.strictEqual(s.total, 2);
  assert.strictEqual(s.comptes, 1);
  assert.strictEqual(s.manquants, 1);
});

verifier('défaut 1 : la carte affiche « Non comptés : n sur N obligatoires »', () => {
  assert.ok(html.includes("Non comptés : <b>${fmtNum(a.valeur_constatee)}</b>"), 'libellé');
  assert.ok(html.includes('sur <b>${fmtNum(a.valeur_attendue)}</b> obligatoires'), 'obligatoires');
  assert.ok(!html.includes("'Produits requis'") && !html.includes("'Produits comptés'"), 'ancien libellé inversé retiré');
});

verifier('retouches Guardian : bouton masqué sans alerte validable, mention du périmètre antérieur', () => {
  assert.ok(html.includes("${alertesValidablesEnBloc(alertesOuvertes).length > 0 ? '<button class=\"btn-tout-valider\""), 'bouton');
  assert.ok(html.includes('périmètre antérieur, tous produits'), 'mention');
});

verifier('migration : même périmètre piste côté serveur, valeur_attendue enregistrée, droits fermés', () => {
  assert.ok((migration.match(/z\.code = 'piste'/g) || []).length === 2);
  assert.ok(/valeur_constatee, valeur_attendue\)\s+values \(r\.site, q\.id, 'cloture_incomplete', 'attention', v_non_comptes, v_attendus\)/.test(migration));
  assert.ok(/revoke execute on function public\.run_scheduled_inventory_reviews\(\) from public, anon, authenticated/.test(migration));
  assert.ok(!/\bgrant\b/i.test(migration.replace(/--.*$/gm, '')));
});
console.log(`${passes}/6 vérifications passent.`);
