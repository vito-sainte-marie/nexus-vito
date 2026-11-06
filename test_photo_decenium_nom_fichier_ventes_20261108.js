// La Photo Decenium garde le nom du fichier ventes (traçabilité, relevé Guardian du 05/11).
// quart_id_source reste facultatif par doctrine : non testé ici.
const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync(__dirname + '/NEXUS-Inventaire-Manager-v1.html', 'utf8');
assert.ok(/salesFilename: fichierVentes \? fichierVentes\.name : null/.test(html), 'le nom du fichier ventes est transmis');
assert.ok(!/salesFilename: null,/.test(html), 'plus de nom ventes codé en dur à null');
console.log('2 contrôles passent.');
