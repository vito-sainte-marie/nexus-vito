// S-5 — un quart-employé d'inventaire est rattaché au service réellement actif.
//
// `inventaire_quart_employes.shift_id` existait depuis l'origine, avec sa clé
// étrangère, et n'a jamais été écrit : 6 lignes, toutes NULL. Personne ne le
// lisait non plus — c'est exactement ce qui a permis à l'oubli de durer, comme
// pour `cloture_source` avant S-1. Ce test empêche la colonne de redevenir
// morte, et empêche une ligne d'être créée sans rattachement.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const lire = f => fs.readFileSync(path.join(RACINE, f), 'utf8');
const sansCommentaires = t => t.split('\n').filter(l => !/^\s*(\/\/|\*|<!--)/.test(l)).join('\n');

function corpsDe(code, nom) {
  const i = code.indexOf('async function ' + nom);
  assert.ok(i !== -1, nom + ' introuvable');
  const j = code.indexOf('async function ', i + 10);
  return code.slice(i, j === -1 ? code.length : j);
}

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

verifier('il n’existe toujours qu’un seul chemin de création applicatif', () => {
  const fichiers = fs.readdirSync(RACINE).filter(f => /^(NEXUS-.*\.html|nexus-.*\.js)$/.test(f));
  const createurs = [];
  for (const f of fichiers) {
    const code = sansCommentaires(lire(f));
    // La fenêtre s'arrête au `.from(` SUIVANT : sans cette borne, l'update du
    // Manager captait l'insert d'`inventaire_audit_log` quatre lignes plus bas
    // et faisait accuser un fichier qui ne crée rien.
    const cible = ".from('inventaire_quart_employes')";
    let i = code.indexOf(cible);
    while (i !== -1) {
      const suivant = code.indexOf('.from(', i + cible.length);
      const fin = suivant === -1 ? code.length : suivant;
      if (code.slice(i, fin).includes('.insert(')) createurs.push(f);
      i = code.indexOf(cible, i + cible.length);
    }
  }
  assert.strictEqual(createurs.length, 1,
    'un second créateur de quart-employé est apparu : ' + createurs.join(', ') +
    ' — le rattachement S-5 ne serait plus garanti sur ce chemin');
  assert.strictEqual(createurs[0], 'NEXUS-Inventaire-v1.html');
});

verifier('la création écrit le service courant', () => {
  const corps = corpsDe(sansCommentaires(lire('NEXUS-Inventaire-v1.html')), 'obtenirOuCreerQuartEmploye');
  assert.ok(/\.insert\(\{[\s\S]{0,400}?shift_id: serviceCourantId/.test(corps),
    'l’insert doit porter shift_id: serviceCourantId');
});

verifier('sans service courant, aucune ligne n’est créée', () => {
  const corps = corpsDe(sansCommentaires(lire('NEXUS-Inventaire-v1.html')), 'obtenirOuCreerQuartEmploye');
  const garde = corps.indexOf('if (!serviceCourantId)');
  const insert = corps.indexOf('.insert(');
  assert.ok(garde !== -1, 'le garde fail-closed doit exister');
  assert.ok(garde < insert, 'le garde doit précéder l’insert, pas le suivre');
  assert.ok(/if \(!serviceCourantId\)[\s\S]{0,300}?return null;/.test(corps),
    'sans service, la fonction doit renoncer et rendre null');
});

verifier('l’identifiant vient de la primitive unique, sans seconde requête', () => {
  const code = sansCommentaires(lire('NEXUS-Inventaire-v1.html'));
  const corps = corpsDe(code, 'chargerRoleDuJour');
  assert.ok(/nexusServiceCourant\(employeeCourant\)/.test(corps),
    'le rôle et l’identifiant viennent de la même lecture');
  assert.ok(/serviceId: r\.service\.id/.test(corps),
    'l’identifiant doit voyager avec le rôle');
  // Aucune lecture de `shifts` propre à cet écran : le service courant a une
  // seule définition, celle de nexus-auth.js.
  assert.ok(!/\.from\('shifts'\)/.test(code),
    'l’écran Inventaire ne doit pas relire shifts lui-même');
});

verifier('le mode test reste synthétique et sans rattachement réel', () => {
  const corps = corpsDe(sansCommentaires(lire('NEXUS-Inventaire-v1.html')), 'obtenirOuCreerQuartEmploye');
  const court = corps.slice(0, corps.indexOf('const { data: existant'));
  assert.ok(/modeTestInventaireActif\(\)/.test(court), 'le court-circuit de test doit rester en tête');
  assert.ok(!/shift_id/.test(court), 'l’objet synthétique ne doit pas porter de shift_id réel');
});

verifier('la base garde l’invariant, à l’insertion comme à la mise à jour', () => {
  const sql = lire(path.join('supabase', 'migrations',
    '20260905200000_rattachement_shift_du_quart_employe.sql'));
  assert.ok(/before insert or update of shift_id, employee_id, quart_id/i.test(sql),
    'le garde doit couvrir aussi les modifications, pas seulement les créations');
  assert.ok(/v_shift_employee <> new\.employee_id/.test(sql),
    'la concordance employé doit être vérifiée — la clé étrangère ne la vérifie pas');
  assert.ok(/v_site_du_quart <> v_shift_site/.test(sql),
    'la concordance site doit être vérifiée');
  assert.ok(/if new\.shift_id is null then\s*return new;/i.test(sql),
    'shift_id NULL doit rester accepté : les lignes d’avant S-5 sont de l’historique');
  assert.ok(/security invoker/i.test(sql),
    'aucune élévation de privilèges pour un simple contrôle de cohérence');
  assert.ok(!/update .*inventaire_quart_employes.*set/i.test(sql),
    'aucune reprise rétroactive des lignes historiques');
});

console.log(`\n${passes} vérifications passées — un comptage d’inventaire sait à quel service il appartient.`);
