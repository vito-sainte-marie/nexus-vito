// A3 / C3 — une capacité de cuve est une donnée du site, jamais une valeur
// devinée. Et le signal « configuration absente » ne doit plus pouvoir être
// jeté par un appelant : c'était le vrai défaut, plus encore que la valeur.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const APPLICATIF = fs.readdirSync(RACINE).filter(f => /^(NEXUS-.*\.html|nexus-.*\.js)$/.test(f));
const lire = f => fs.readFileSync(path.join(RACINE, f), 'utf8');
const sansCommentaires = t => t.split('\n').filter(l => !/^\s*(\/\/|\*|<!--)/.test(l)).join('\n');

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

verifier('la couche de données ne contient plus aucune capacité de cuve', () => {
  const src = sansCommentaires(lire('nexus-carburant-donnees.js'));
  assert.ok(!/CUVES_PAR_DEFAUT/.test(src), 'le repli doit avoir disparu');
  assert.ok(!/capacite:\s*\d/.test(src), 'aucune capacité chiffrée ne doit subsister');
  assert.ok(!/parDefaut/.test(src), '`parDefaut` était écrit et jamais lu : le remplacer, pas le garder');
});

verifier('le faux commentaire sur les « valeurs réelles » a disparu', () => {
  // Il affirmait un héritage de Vito Sainte-Marie alors qu'il reproduisait
  // les valeurs de site-fantome-test. Le corriger fait partie du lot.
  for (const f of APPLICATIF) {
    const src = lire(f);
    assert.ok(!/repli explicite\s*\n?\s*\/\/\s*sur les valeurs réelles connues de Vito Sainte-Marie/.test(src),
      f + ' : le commentaire trompeur subsiste');
  }
  const src = lire('nexus-carburant-donnees.js');
  assert.ok(/site-fantome-test/.test(src),
    'le commentaire doit dire d’où venaient réellement ces valeurs');
});

verifier('le contrat expose un état que l’appelant ne peut pas jeter', () => {
  const src = lire('nexus-carburant-donnees.js');
  assert.ok(/etat: 'configure'/.test(src) && /etat: 'absente'/.test(src) && /etat: 'erreur'/.test(src),
    'trois états explicites attendus');
  // La garantie structurelle : sans configuration, `config` vaut null. Un
  // appelant qui ignore `etat` perd la donnée en même temps que le signal —
  // il ne peut plus calculer sur une valeur empruntée sans s'en apercevoir.
  assert.ok(/return \{ config: null, etat: 'absente' \}/.test(src));
  assert.ok(/return \{ config: null, etat: 'erreur' \}/.test(src));
});

verifier('les usages DÉCISIONNELS bloquent sans cuves déclarées', () => {
  const pilotage = lire('NEXUS-Carburants-Pilotage-v1.html');
  assert.ok(/if \(!config\)[\s\S]{0,400}?cuvesConfig: null/.test(pilotage),
    'Carburants Performance doit refuser de calculer une autonomie');
  assert.ok(/if \(!ctx\.cuvesConfig\)[\s\S]{0,300}?Capacités de cuves non configurées/.test(pilotage),
    'et le dire à l’écran');

  const inventaire = lire('NEXUS-Inventaire-v1.html');
  assert.ok(/if \(!config\)[\s\S]{0,600}?Cuves non configurées/.test(inventaire),
    'le jaugeage ne doit pas proposer les réservoirs d’une autre station');
});

verifier('les usages DESCRIPTIFS dégradent visiblement sans bloquer', () => {
  for (const [f, marqueur] of [['nexus-brief-donnees.js', 'Brief carburants'],
                               ['NEXUS-Rapport-v1.html', 'Rapport carburants']]) {
    const src = lire(f);
    assert.ok(new RegExp("etat !== 'configure'").test(src), f + ' : l’état doit être lu');
    assert.ok(src.includes(marqueur), f + ' : l’absence doit être journalisée');
    assert.ok(!/return;[\s\S]{0,40}Capacités de cuves/.test(src), f + ' : ne doit pas bloquer l’écran');
  }
});

verifier('l’écran de configuration propose une ossature, pas des capacités', () => {
  const src = lire('NEXUS-Parametres-Station-v1.html');
  assert.ok(/const CUVES_MODELE = \{/.test(src), 'un modèle nommé, pas un repli');
  const modele = src.slice(src.indexOf('const CUVES_MODELE'), src.indexOf('const CUVES_MODELE') + 700);
  assert.ok(!/capacite:\s*\d/.test(modele),
    'les capacités du modèle doivent rester nulles — proposer un nombre le ferait accepter par inadvertance');
  assert.ok((modele.match(/capacite: null/g) || []).length >= 4, 'chaque réservoir proposé sans capacité');
  assert.ok(/const \{ config, etat \} = await NexusCarburantDonnees\.chargerCuvesConfig/.test(src),
    'l’écran de configuration doit lire l’état');
});

verifier('aucun appelant ne jette plus le signal de configuration absente', () => {
  // Le défaut d'origine : cinq appelants déstructuraient `{ config }` et
  // écartaient `parDefaut` à la ligne même où il arrivait.
  const coupables = [];
  for (const f of APPLICATIF) {
    const src = sansCommentaires(lire(f));
    const motif = /const \{ config \} = await (?:[\w.]+\.)?chargerCuvesConfig\(/g;
    let m;
    while ((m = motif.exec(src))) {
      // Inventaire est le seul cas légitime : il teste `!config` juste après,
      // donc l'absence lui est déjà fatale.
      const suite = src.slice(m.index, m.index + 300);
      if (!/if \(!config\)/.test(suite)) coupables.push(f);
    }
  }
  assert.deepStrictEqual(coupables, [],
    'Un appelant qui ne lit ni `etat` ni `!config` recommence le défaut :\n  ' + coupables.join('\n  '));
});

verifier('aucune capacité de production ne s’est glissée dans le code', () => {
  // Le repli ne doit pas être remplacé par les VRAIES valeurs de
  // Sainte-Marie : ce serait le même défaut avec de meilleurs chiffres.
  const REELLES = ['30276', '20020', '10036', '32092', '28761', '19019', '9534', '30471'];
  // nexus-carburant-commande-backtest.js porte limiteRemplissageSpL: 28761 et
  // limiteRemplissageGoL: 28553 — les vraies limites de Sainte-Marie, en dur.
  // Même module, même statut que son getHours() : AUCUN écran ne l'appelle,
  // seuls les tests le chargent. Défaut latent consigné avec l'autre, hors C3
  // pour ne pas élargir le périmètre — mais nommé ici, jamais exempté en
  // silence, et ce test échouera si le fichier cesse d'en contenir.
  const LATENT_CONSIGNE = 'nexus-carburant-commande-backtest.js';
  const trouvees = [];
  let latentTrouve = false;
  for (const f of APPLICATIF) {
    const src = sansCommentaires(lire(f));
    for (const v of REELLES) {
      if (!src.includes(v)) continue;
      if (f === LATENT_CONSIGNE) { latentTrouve = true; continue; }
      trouvees.push(`${f} : ${v}`);
    }
  }
  assert.ok(latentTrouve,
    `${LATENT_CONSIGNE} ne porte plus de capacité de production : retirez-le de LATENT_CONSIGNE.`);
  assert.deepStrictEqual(trouvees, [],
    'Les capacités réelles de production n’ont rien à faire dans le code :\n  ' + trouvees.join('\n  '));
});

console.log(`\n${passes} vérifications passées — les capacités viennent du site, ou rien n'est calculé.`);
