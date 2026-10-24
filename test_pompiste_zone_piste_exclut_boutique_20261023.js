// Épreuve — le comptage du pompiste ne contient que les produits de la zone « piste ».
// Lot CATEGORIES_FIL (23/10/2026). En Production, les huiles et le lave-glace sont
// rangés dans la zone « boutique » : ils n'apparaissent pas à l'écran du pompiste.
// Le filtre vit dans chargerProduitsZone (NEXUS-Inventaire-v1.html), pas dans la
// génération du plan, qui ne regarde pas la zone. Cette épreuve exerce ce filtre
// avec un faux client, puis vérifie que la mutation (filtre de zone retiré) la rougit.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Inventaire-v1.html'), 'utf8');
const debut = html.indexOf('async function chargerProduitsZone(zone) {');
const fin = html.indexOf('// Dernier stock connu', debut);
assert(debut > 0 && fin > debut, 'chargerProduitsZone introuvable dans NEXUS-Inventaire-v1.html');
const src = html.slice(debut, fin);

// Écailles = un produit de la catégorie Glaçons, pas une catégorie (précision de Frédéric, 23/10).
let PRODUITS = [
  { id: 'gaz', designation: 'Gaz 12,5KG', actif: true, zone: 'piste', categorie: 'Gaz' },
  { id: 'ecailles', designation: 'Écailles', actif: true, zone: 'piste', categorie: 'Glaçons' },
  { id: 'huile', designation: 'Huile moteur recette', actif: true, zone: 'boutique' },
  { id: 'laveglace', designation: 'Lave-glace recette', actif: true, zone: 'boutique' },
  { id: 'inactif', designation: 'Gaz retiré', actif: false, zone: 'piste' },
];

function fauxClient() {
  return {
    from(table) {
      const filtres = [];
      const b = {
        select() { return b; },
        eq(col, val) { filtres.push([col, val]); return b; },
        in() { return b; },
        order() { return b; },
        then(ok) {
          let rows = table === 'inventaire_zone_produit'
            ? PRODUITS.map(p => ({ id: p.id, designation: p.designation, actif: p.actif, inventaire_categories: p.categorie ? { nom: p.categorie } : null, inventaire_zones: { code: p.zone } }))
            : [];
          for (const [col, val] of filtres) {
            if (col === 'inventaire_zones.code') rows = rows.filter(r => r.inventaire_zones.code === val);
            else if (col === 'actif') rows = rows.filter(r => r.actif === val);
          }
          return Promise.resolve({ data: rows, error: null }).then(ok);
        },
      };
      return b;
    },
  };
}

// Les produits viennent du paramétrage du site : un autre site a son propre jeu (sans écailles).
const SITE_VITO = PRODUITS;
const SITE_SANS_ECAILLES = [
  { id: 's2gaz', designation: 'Gaz 6KG', actif: true, zone: 'piste', categorie: 'Gaz' },
  { id: 's2huile', designation: 'Huile 5W30', actif: true, zone: 'boutique', categorie: 'Huiles' },
];

async function produitsVisibles() {
  const ctx = { nexusClient: fauxClient(), produitsPlanIds: new Set(), quartActuel: null, console, Date };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const liste = await vm.runInContext('chargerProduitsZone', ctx)('piste');
  return liste.map(p => p.designation).sort();
}

(async () => {
  const vus = await produitsVisibles();
  assert.deepStrictEqual(vus, ['Gaz 12,5KG', 'Écailles'].sort(),
    'le pompiste ne doit compter que les produits actifs de la zone piste, vu : ' + vus.join(', '));
  assert(!vus.includes('Huile moteur recette') && !vus.includes('Lave-glace recette'),
    'un produit rangé en zone boutique ne doit jamais apparaître à l\'écran du pompiste');

  // Épreuve 1 : un produit désactivé n'apparaît pas (même sous la catégorie du fil).
  assert(!vus.includes('Gaz retiré'), 'un produit inactif ne doit pas être compté');
  // Épreuve 2 : un produit actif de la zone piste est compté, sous sa catégorie (Écailles sous Glaçons).
  PRODUITS = SITE_VITO;
  assert(vus.includes('Écailles'), 'Écailles, produit actif de la zone piste, doit être compté');
  const ctxE = { nexusClient: fauxClient(), produitsPlanIds: new Set(), quartActuel: null, console, Date };
  vm.createContext(ctxE); vm.runInContext(src, ctxE);
  const piste = await vm.runInContext('chargerProduitsZone', ctxE)('piste');
  assert.strictEqual(piste.find(p => p.designation === 'Écailles').inventaire_categories.nom, 'Glaçons', 'Écailles doit rester un produit de Glaçons');
  // Épreuve 3 : un autre site, sans écailles, ne se voit imposer aucun produit : seulement les siens.
  PRODUITS = SITE_SANS_ECAILLES;
  const autre = await produitsVisibles();
  PRODUITS = SITE_VITO;
  assert.deepStrictEqual(autre, ['Gaz 6KG'], 'un site sans écailles ne doit compter que ses produits de la zone piste, vu : ' + autre.join(', '));

  // Mutation : sans le filtre de zone, les produits de la boutique reviennent.
  const mute = src.replace(".eq('inventaire_zones.code', zone)", '');
  assert.notStrictEqual(mute, src, 'mutation non appliquée (filtre de zone introuvable)');
  const ctx = { nexusClient: fauxClient(), produitsPlanIds: new Set(), quartActuel: null, console, Date };
  vm.createContext(ctx); vm.runInContext(mute, ctx);
  const sans = (await vm.runInContext('chargerProduitsZone', ctx)('piste')).map(p => p.designation);
  assert(sans.includes('Huile moteur recette'), 'la mutation doit rougir l\'épreuve (huile revenue)');

  // Le script d'alignement Test : refus Production, borné aux deux identifiants, simulation par défaut.
  const sh = fs.readFileSync(path.join(__dirname, 'outils', 'alignement-zones-recette-huile-laveglace-20261023.sh'), 'utf8');
  assert(/PROD_REF="uzhjpqpctpvxytxpxoqz"/.test(sh) && /exit 3/.test(sh), 'le script doit refuser la Production');
  assert(sh.includes('7775b1bc-e061-4d44-84ea-1c02231f8588') && sh.includes('4ad5fc4b-482a-4c54-bd74-95ef8428cef0'), 'le script doit être borné par identifiants');
  assert(/FIN="rollback;"/.test(sh), 'le script doit simuler par défaut');

  console.log('OK — zone piste : huile et lave-glace de la boutique absents de l\'écran du pompiste ; mutation rougie.');
})().catch(e => { console.error(e.message); process.exit(1); });
