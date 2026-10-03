// test_station_config_horaires_proprietaire_unique_20261003.js
//
// `station_config.horaires` n'a qu'UN écrivain : l'enregistrement des horaires
// de Paramètres Station (`horaires: config`).
//
// Jusqu'au 03/10/2026, quatorze autres upserts (prix, raccourcis, drapeaux,
// Sheets, réception…) joignaient des horaires qui ne leur appartenaient pas,
// pour satisfaire une contrainte NOT NULL. Deux défauts en découlaient :
//   — un écran de PRIX refusait d'enregistrer des prix faute d'horaires ;
//   — deux écrans relisaient la ligne puis réécrivaient un instantané
//     d'horaires, qui pouvait être périmé.
//
// `20261003120000_station_config_horaires_nullable.sql` a relâché la
// contrainte. Elle a été appliquée sur Test (292) puis en Production (280)
// AVANT que le code cesse de fournir la colonne ; l'ordre inverse cassait tous
// les upserts de la table (23502). `ON CONFLICT DO UPDATE` ne touche que les
// colonnes citées : une ligne existante garde ses horaires.
//
// Cette épreuve refuse :
//   1. qu'un autre upsert que le propriétaire cite `horaires` ;
//   2. que le propriétaire disparaisse (sinon le 1 serait vrai sur une base vide) ;
//   3. que les colmatages reviennent (`horairesObligatoires`,
//      `chargerHorairesPourUpsert`, la relecture d'horaires avant upsert).
//
// Le contrôle 1 porte sur l'INSTRUMENT partagé (outils/schema-station-config.js),
// pas sur un motif textuel local : c'est l'instrument qui voit les 15 appels.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const ECRAN_PROPRIETAIRE = 'NEXUS-Parametres-Station-v1.html';

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

const {
  appelsUpsertStationConfig,
  fichiersAvecUpsertStationConfig,
} = require('./outils/schema-station-config.js');

function porteursHoraires(racine) {
  const porteurs = [];
  let total = 0;
  for (const f of fichiersAvecUpsertStationConfig(racine)) {
    const src = fs.readFileSync(path.resolve(racine, f), "utf8");
    const rel = path.relative(racine, path.resolve(racine, f));
    for (const appel of appelsUpsertStationConfig(src)) {
      total++;
      if (appel.cles.includes('horaires')) porteurs.push({ fichier: rel, ligne: appel.ligne, cles: appel.cles });
    }
  }
  return { porteurs, total };
}

const { porteurs, total } = porteursHoraires(RACINE);

verifier('l’instrument voit des upserts station_config (sinon l’épreuve est vide)', () => {
  // 15 au 03/10/2026. Un plancher, pas une égalité : ajouter un réglage ne
  // doit pas rougir cette épreuve, en perdre la plupart doit la rougir.
  assert.ok(total >= 10, `seulement ${total} upsert(s) station_config trouvé(s)`);
});

verifier('un seul upsert station_config écrit horaires, et c’est l’enregistrement des horaires', () => {
  assert.strictEqual(porteurs.length, 1,
    'upserts qui joignent horaires : ' + JSON.stringify(porteurs));
  const p = porteurs[0];
  assert.strictEqual(p.fichier, ECRAN_PROPRIETAIRE);
  assert.deepStrictEqual(p.cles, ['site', 'horaires', 'updated_at'],
    'le propriétaire ne doit écrire que ses horaires : ' + JSON.stringify(p.cles));
});

verifier('le propriétaire écrit la saisie du formulaire, pas une valeur reprise', () => {
  const src = fs.readFileSync(path.join(RACINE, ECRAN_PROPRIETAIRE), 'utf8');
  assert.ok(/\{\s*site:\s*employee\.site_id,\s*horaires:\s*config,\s*updated_at:/.test(src),
    'l’enregistrement des horaires n’écrit plus `horaires: config`');
});

verifier('les colmatages NOT NULL ne reviennent pas', () => {
  const RETIRES = [
    /function\s+horairesObligatoires\s*\(/,
    /horairesObligatoires\s*\(\s*\)/,
    /\bhorairesUpsert\b/,
    /function\s+chargerHorairesPourUpsert\s*\(/,
    /await\s+chargerHorairesPourUpsert\s*\(/,
    // la relecture d'un instantané d'horaires juste avant un upsert
    /existant\s*&&\s*existant\.horaires/,
    /select\('horaires,/,
  ];
  for (const f of fichiersAvecUpsertStationConfig(RACINE)) {
    const src = fs.readFileSync(path.resolve(RACINE, f), "utf8");
    for (const motif of RETIRES) {
      assert.ok(!motif.test(src), `${f} contient de nouveau ${motif}`);
    }
  }
});

// Contre-témoin : l'épreuve doit rougir si un écran non propriétaire joint de
// nouveau horaires. Joué sur une copie jetable, jamais sur le dépôt.
verifier('contre-témoin : réintroduire horaires dans un upsert de prix est détecté', () => {
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'horaires-proprio-'));
  try {
    for (const f of fichiersAvecUpsertStationConfig(RACINE)) {
      const rel = path.relative(RACINE, path.resolve(RACINE, f));
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.copyFileSync(path.resolve(RACINE, f), path.join(dir, rel));
    }
    const cible = path.join(dir, 'NEXUS-App-v1.html');
    const src = fs.readFileSync(cible, 'utf8');
    const ancre = '{ site: siteId, prix_carburants, updated_at:';
    assert.strictEqual(src.split(ancre).length - 1, 1, 'ancre du contre-témoin non unique ou absente');
    fs.writeFileSync(cible, src.replace(ancre, '{ site: siteId, prix_carburants, horaires: h, updated_at:'));
    const muté = porteursHoraires(dir);
    assert.strictEqual(muté.porteurs.length, 2, 'la mutation n’a pas été vue : ' + JSON.stringify(muté.porteurs));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

console.log(`\n${passes} vérification(s) passée(s).`);
