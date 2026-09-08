// LANG-004 — les deux agents portent-ils encore leur ancien nom devant l'utilisateur ?
//
// La Bible a scindé le « Conseiller NEXUS » unique en NEXUS Directeur
// d'Exploitation, qui parle au manager, et NEXUS Coach Terrain, qui parle aux
// employés. Le code a suivi le 08/09/2026 pour tout ce qui est AFFICHÉ.
//
// Les commentaires, eux, gardent l'ancien nom, et c'est délibéré : beaucoup
// datent une demande de Frédéric (« 01/08/2026, demande de Frédéric »). Les
// réécrire ferait dire à un texte d'août des mots qui n'existaient pas encore,
// exactement ce qui a été refusé pour les articles 12 et 13 de la Constitution.
//
// Cette garde suit donc l'état des LIGNES DE CODE, pas des commentaires. Elle
// est volontairement naïve : elle suit les commentaires de bloc ligne à ligne,
// sans chercher à interpréter les chaînes. La première version de l'outil de
// renommage, elle, traitait l'apostrophe comme un délimiteur de chaîne — dans
// du texte HTML français, elle perdait le fil et a réécrit trois commentaires
// historiques. Une garde qui doit être juste vaut mieux qu'une garde savante.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ANCIENS = /Conseiller NEXUS|Coach NEXUS|CONSEILLER NEXUS|COACH NEXUS/;
const CANONIQUES = { manager: 'NEXUS Directeur d’Exploitation', employe: 'NEXUS Coach Terrain' };

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

function fichiersProduit() {
  return fs.readdirSync(__dirname)
    .filter(f => /^(NEXUS-.*\.html|nexus-.*\.js|index\.html|presentation\.html)$/.test(f))
    .filter(f => !f.startsWith('test_'));
}

// Rend les lignes qui ne sont NI un commentaire de ligne, NI dans un bloc.
function lignesDeCode(source) {
  const out = [];
  let dansBloc = null; // '*/' ou '-->'
  source.split('\n').forEach((ligne, i) => {
    const t = ligne.trim();
    if (dansBloc) { if (ligne.includes(dansBloc)) dansBloc = null; return; }
    if (t.startsWith('//')) return;
    if (t.startsWith('/*') && !ligne.includes('*/')) { dansBloc = '*/'; return; }
    if (t.startsWith('<!--') && !ligne.includes('-->')) { dansBloc = '-->'; return; }
    if (t.startsWith('/*') || t.startsWith('<!--')) return;
    out.push([i + 1, ligne]);
  });
  return out;
}

t('aucun ancien nom d’agent ne subsiste dans une ligne de code', () => {
  const fautes = [];
  for (const f of fichiersProduit()) {
    for (const [no, ligne] of lignesDeCode(fs.readFileSync(path.join(__dirname, f), 'utf8'))) {
      if (ANCIENS.test(ligne)) fautes.push(`${f}:${no} ${ligne.trim().slice(0, 90)}`);
    }
  }
  assert.deepStrictEqual(fautes, [], 'anciens noms encore affichés :\n  ' + fautes.join('\n  '));
});

t('les deux noms canoniques sont RÉELLEMENT employés', () => {
  // Une garde qui n'exige qu'une absence passerait au vert si les deux agents
  // disparaissaient entièrement de l'interface.
  const tout = fichiersProduit().map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  for (const [role, nom] of Object.entries(CANONIQUES)) {
    assert.ok(tout.includes(nom), `le nom destiné au ${role} n’apparaît nulle part : ${nom}`);
  }
});

t('l’écran Missions distingue toujours les deux destinataires', () => {
  // C'est le seul écran vu par les DEUX rôles. Il choisissait déjà entre
  // « Coach NEXUS » et « Conseiller NEXUS » selon `estCoach` depuis juillet :
  // la correspondance entre agents n'a pas été inventée, elle a été suivie.
  const src = fs.readFileSync(path.join(__dirname, 'NEXUS-Missions-v1.html'), 'utf8');
  assert.ok(/estCoach \? 'NEXUS Coach Terrain' : 'NEXUS Directeur d’Exploitation'/.test(src),
    'le choix par rôle doit être conservé');
  assert.ok(/const estCoach = roleDuJour !== 'manager'/.test(src),
    'et rester fondé sur le rôle du jour, pas sur l’écran');
});

t('les commentaires historiques ne sont PAS réécrits', () => {
  // Trois d'entre eux l'ont été par erreur avant d'être rétablis. Cette épreuve
  // fige ce qui doit rester intact : un commentaire qui DATE une demande.
  const temoins = [
    ['NEXUS-Verify-v1.html', '<!-- Conseiller NEXUS — remarques post-audit (01/08/2026, demande de'],
    ['NEXUS-Import-v1.html', "// Conseiller NEXUS — messages d'ouverture par intention"],
    ['NEXUS-Missions-v1.html', '// "Coach NEXUS" côté employé, "Conseiller NEXUS" côté manager'],
  ];
  for (const [f, texte] of temoins) {
    assert.ok(fs.readFileSync(path.join(__dirname, f), 'utf8').includes(texte),
      `commentaire historique perdu dans ${f} : ${texte}`);
  }
});

t('l’apostrophe employée ne peut pas casser une chaîne JavaScript', () => {
  // `d'Exploitation` avec une apostrophe droite romprait toute chaîne délimitée
  // par des apostrophes, et le fichier ne se chargerait plus.
  assert.ok(CANONIQUES.manager.includes('’'), 'apostrophe typographique attendue');
  assert.ok(!CANONIQUES.manager.includes("'"), 'aucune apostrophe droite dans le nom');
  const tout = fichiersProduit().map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  assert.ok(!/Directeur d'Exploitation/.test(tout),
    'une apostrophe droite s’est glissée dans le nom : elle casse les chaînes');
});

console.log(`\n${n}/${n} vérifications passées — les agents portent leur nom devant l’utilisateur, l’histoire garde le sien.`);
