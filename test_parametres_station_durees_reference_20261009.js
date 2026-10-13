// Durées de référence par jour travaillé, écran Paramètres Station
// (cahier des charges du 09/10/2026, §2 et §3).
//
// Ce que cette épreuve garde, et pourquoi chacun de ces points a une raison
// d'être plutôt qu'une place dans une liste :
//
//   1. Les durées affichées en gris viennent de DUREES_REFERENCE_DEFAUT, la
//      constante du moteur. Le §2 exige des règles d'heures centralisées,
//      « sans duplication de règles contradictoires » : une table 7 h / 8 h
//      recopiée dans l'écran serait cette duplication, et elle dériverait.
//
//   2. Un champ vide n'écrit rien et laisse s'appliquer la table de
//      référence. C'est le contraire des horaires de quart, dont l'absence
//      bloque : ici la table de repli est écrite, mesurée et testée.
//
//   3. Une durée hors bornes est REFUSÉE à l'écran. Le moteur, lui, la
//      replierait en silence sur la table de référence : le manager croirait
//      avoir changé la durée d'un jour, et la paie se calculerait sur une
//      autre. Un refus visible vaut mieux qu'un repli muet.
//
//   4. L'enregistrement préserve les clés de `paye_config` qu'il ne connaît
//      pas. Jours fériés, seuil de retard incohérent et drapeau d'activation
//      vivent dans le même objet jsonb ; un upsert qui écrirait un objet neuf
//      les effacerait sans un mot.
//
// Les fonctions sont extraites du VRAI fichier par appariement d'accolades,
// selon l'idiome du dépôt : si l'écran change, l'épreuve suit ou casse.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Parametres-Station-v1.html'), 'utf8');
const script = html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/)[1];

let n = 0;
function ok(label) { n++; console.log('OK   ' + label); }
function verifier(label, condition) {
  assert.ok(condition, label);
  ok(label);
}

// ---------------------------------------------------------------- extraction

function corpsApres(source, marqueur) {
  const debut = source.indexOf(marqueur);
  assert.ok(debut !== -1, 'marqueur introuvable : ' + marqueur);
  let i = source.indexOf('{', debut + marqueur.length - 1);
  assert.ok(i !== -1, 'accolade ouvrante introuvable après ' + marqueur);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0 && j < source.length) {
    if (source[j] === '{') profondeur++;
    else if (source[j] === '}') profondeur--;
    j++;
  }
  assert.ok(profondeur === 0, 'accolades non appariées après ' + marqueur);
  return source.slice(i + 1, j - 1);
}

const SRC_REMPLIR = 'function remplirFormulaireDurees(payeConfig, horaires) {';
const corpsRemplir = corpsApres(script, SRC_REMPLIR);
const MARQUEUR_HANDLER = "document.getElementById('sauvegarderDurees').addEventListener('click', async () => {";
const corpsHandler = corpsApres(script, MARQUEUR_HANDLER);

verifier('les deux blocs de l’écran sont extraits du vrai fichier',
  corpsRemplir.length > 200 && corpsHandler.length > 600);

// -------------------------------------------------------------- faux terrain

const IDS = ['dr_0', 'dr_1', 'dr_2', 'dr_3', 'dr_4', 'dr_5', 'dr_6', 'dr_renfort',
             'noteDureeRenfortCalculee', 'sauvegarderDurees', 'savedNoteDurees'];

function faireDocument(valeurs) {
  const elements = {};
  IDS.forEach(id => {
    elements[id] = { value: '', placeholder: '', textContent: '', disabled: false, style: {} };
  });
  Object.keys(valeurs || {}).forEach(id => { elements[id].value = valeurs[id]; });
  return { elements, getElementById: id => elements[id] || null };
}

// Le moteur réel : c'est lui qui porte la table de référence et la règle de
// durée nette. L'épreuve ne réécrit ni l'une ni l'autre.
const ctxMoteur = { console };
ctxMoteur.window = ctxMoteur; ctxMoteur.globalThis = ctxMoteur;
vm.createContext(ctxMoteur);
vm.runInContext(fs.readFileSync(path.join(DIR, 'nexus-paye-moteur.js'), 'utf8'), ctxMoteur);
const MOTEUR = ctxMoteur.NexusPayeMoteur;

// 08:00 à 16:30 moins 30 min de pause = 8 h nettes, et non 7 h. Le choix
// n'est pas cosmétique : avec un horaire rendant 7 h, la valeur serait
// indistinguable du repli HEURES_RENFORT_DEFAUT, et une mutation coupant la
// transmission des horaires passerait inaperçue.
const HORAIRES = {
  quart1: { normal: '05:45' },
  renfort: { debut: '08:00', fin: '16:30', pause_debut: '12:00', pause_fin: '12:30' },
};

function remplir(payeConfig, horaires, valeursSaisies) {
  const doc = faireDocument(valeursSaisies);
  const ctx = {
    console, document: doc, window: { NexusPayeMoteur: MOTEUR },
    Number, String, Array, Object, Math,
    payeConfig: payeConfig, horaires: horaires,
  };
  vm.createContext(ctx);
  vm.runInContext('(function () {' + corpsRemplir + '})();', ctx);
  return doc;
}

function enregistrer(options) {
  const o = options || {};
  const doc = faireDocument(o.saisie || {});
  const alertes = [];
  const upserts = [];
  const ctx = {
    console, document: doc, Number, String, Array, Object, Math, JSON,
    setTimeout: (fn) => fn(),
    alert: (m) => alertes.push(m),
    employee: { site_id: 'vito-sainte-marie' },
    horairesObligatoires: () => (o.horairesManquants ? null : HORAIRES),
    remplirFormulaireDurees: () => {},
    PAYE_CONFIG_ACTUEL: o.payeConfigActuel === undefined ? null : o.payeConfigActuel,
    CONFIG_HORAIRES_ACTUEL: HORAIRES,
    nexusClient: {
      from: () => ({
        upsert: async (ligne, opts) => {
          upserts.push({ ligne, opts });
          return { error: o.erreurUpsert || null };
        },
      }),
    },
  };
  vm.createContext(ctx);
  const promesse = vm.runInContext('(async function () {' + corpsHandler + '})();', ctx);
  return promesse.then(() => ({ doc, alertes, upserts, ctx }));
}

// ------------------------------------------------- 1. ce que l'écran affiche

const vierge = remplir(null, HORAIRES);
verifier('sans configuration, aucun champ n’est pré-rempli',
  IDS.slice(0, 8).every(id => vierge.elements[id].value === ''));
verifier('le gris des champs est la table du moteur, pas une table recopiée',
  [0, 1, 2, 3, 4, 5, 6].every(j =>
    vierge.elements['dr_' + j].placeholder === String(MOTEUR.DUREES_REFERENCE_DEFAUT[j])));
verifier('et cette table est bien celle du cahier des charges, dimanche en tête',
  [0, 1, 2, 3, 4, 5, 6].map(j => vierge.elements['dr_' + j].placeholder).join(',')
  === '7,7,7,7,8,8,8');

const avecDurees = remplir({ durees_reference: [7, 7, 7, 7, 8, 8, 9], heures_renfort: 6 }, HORAIRES);
verifier('une durée enregistrée se relit dans son champ',
  avecDurees.elements.dr_6.value === '9' && avecDurees.elements.dr_4.value === '8');
verifier('une durée de renfort enregistrée se relit aussi',
  avecDurees.elements.dr_renfort.value === '6');
verifier('et l’écran dit qu’elle a priorité sur l’horaire de renfort',
  /6 h/.test(avecDurees.elements.noteDureeRenfortCalculee.textContent)
  && /priorité/.test(avecDurees.elements.noteDureeRenfortCalculee.textContent));

const sansRenfort = remplir({ durees_reference: null, heures_renfort: 0 }, HORAIRES);
verifier('sans durée de renfort saisie, l’écran annonce celle déduite de l’horaire',
  /8 h/.test(sansRenfort.elements.noteDureeRenfortCalculee.textContent));
verifier('cette durée déduite n’est pas le repli du moteur, elle vient de l’horaire',
  MOTEUR.reglesHeures({}, HORAIRES).heuresRenfort === 8
  && MOTEUR.HEURES_RENFORT_DEFAUT !== 8);

// -------------------------------------------- 2. ce que l'enregistrement fait

const JOURS_PLEINS = { dr_0: '7', dr_1: '7', dr_2: '7', dr_3: '7', dr_4: '8', dr_5: '8', dr_6: '8' };

return enregistrer({
  saisie: Object.assign({}, JOURS_PLEINS, { dr_renfort: '7' }),
  payeConfigActuel: { actif: true, jours_feries: ['2026-08-15'], retard_max_coherent_min: 180 },
}).then(async (r) => {
  verifier('un enregistrement complet part en base', r.upserts.length === 1 && r.alertes.length === 0);
  const ligne = r.upserts[0].ligne;
  verifier('les sept durées sont écrites dans l’ordre du moteur, dimanche en tête',
    JSON.stringify(ligne.paye_config.durees_reference) === JSON.stringify([7, 7, 7, 7, 8, 8, 8]));
  verifier('la durée de renfort saisie est écrite', ligne.paye_config.heures_renfort === 7);
  verifier('les réglages de paye que cet écran ne montre pas survivent',
    ligne.paye_config.actif === true
    && ligne.paye_config.retard_max_coherent_min === 180
    && JSON.stringify(ligne.paye_config.jours_feries) === JSON.stringify(['2026-08-15']));
  // Depuis 20261003120000 la colonne est nullable : l'enregistrement des durées ne joint PAS `horaires`
  // (ON CONFLICT DO UPDATE ne touche que les colonnes citées, une ligne existante garde les siens).
  verifier('les horaires ne voyagent pas avec : un seul écrivain, l’enregistrement des horaires',
    !('horaires' in ligne) && r.upserts[0].opts.onConflict === 'site');
  verifier('et l’écran confirme visiblement l’enregistrement',
    r.doc.elements.savedNoteDurees.style.display === 'none'
    && r.doc.elements.sauvegarderDurees.disabled === false);

  // Un jour vide ne vaut pas zéro heure : il vaut « applique la référence ».
  const partiel = await enregistrer({
    saisie: Object.assign({}, JOURS_PLEINS, { dr_4: '', dr_renfort: '' }),
  });
  verifier('un jour laissé vide est écrit comme absent, pas comme zéro',
    partiel.upserts[0].ligne.paye_config.durees_reference[4] === null);
  verifier('et le moteur relit ce jour sur la table de référence',
    MOTEUR.reglesHeures(partiel.upserts[0].ligne.paye_config, null).durees[4]
    === MOTEUR.DUREES_REFERENCE_DEFAUT[4]);
  verifier('un renfort laissé vide se déduit de l’horaire, il ne tombe pas à zéro',
    partiel.upserts[0].ligne.paye_config.heures_renfort === 0
    && MOTEUR.reglesHeures(partiel.upserts[0].ligne.paye_config, HORAIRES).heuresRenfort === 8);

  const toutVide = await enregistrer({ saisie: {} });
  verifier('tous les champs vides effacent le réglage au lieu d’écrire sept nuls',
    toutVide.upserts[0].ligne.paye_config.durees_reference === null);

  // ------------------------------------------------ 3. ce que l'écran refuse

  const horsBornes = await enregistrer({ saisie: Object.assign({}, JOURS_PLEINS, { dr_4: '25' }) });
  verifier('une durée hors bornes est refusée, et rien ne part en base',
    horsBornes.upserts.length === 0 && horsBornes.alertes.length === 1);
  verifier('le refus nomme le jour concerné et la valeur rejetée',
    /Jeudi/.test(horsBornes.alertes[0]) && /25/.test(horsBornes.alertes[0]));
  verifier('et il dit ce qu’un champ vide signifie, pour que le manager sache quoi faire',
    /vide/.test(horsBornes.alertes[0]));

  const illisible = await enregistrer({ saisie: Object.assign({}, JOURS_PLEINS, { dr_2: 'sept' }) });
  verifier('une durée illisible est refusée de la même façon',
    illisible.upserts.length === 0 && /Mardi/.test(illisible.alertes[0]));

  const zero = await enregistrer({ saisie: Object.assign({}, JOURS_PLEINS, { dr_1: '0' }) });
  verifier('zéro heure est refusé : le moteur le replierait en silence sur 7 h',
    zero.upserts.length === 0 && /Lundi/.test(zero.alertes[0]));

  const renfortFaux = await enregistrer({ saisie: Object.assign({}, JOURS_PLEINS, { dr_renfort: '30' }) });
  verifier('une durée de renfort hors bornes est refusée elle aussi',
    renfortFaux.upserts.length === 0 && /Renfort/.test(renfortFaux.alertes[0]));

  const sansHoraires = await enregistrer({
    saisie: Object.assign({}, JOURS_PLEINS, { dr_renfort: '7' }), horairesManquants: true,
  });
  verifier('sans horaires de quart déclarés, les durées s’enregistrent quand même, sans les inventer',
    sansHoraires.upserts.length === 1 && !('horaires' in sansHoraires.upserts[0].ligne));

  const enPanne = await enregistrer({
    saisie: Object.assign({}, JOURS_PLEINS, { dr_renfort: '7' }),
    erreurUpsert: { message: 'réseau' },
  });
  verifier('un échec d’enregistrement est dit, et le bouton redevient cliquable',
    enPanne.alertes.length === 1 && enPanne.doc.elements.sauvegarderDurees.disabled === false);
  verifier('et aucune confirmation mensongère ne s’affiche',
    enPanne.doc.elements.savedNoteDurees.style.display === undefined
    || enPanne.doc.elements.savedNoteDurees.style.display !== 'block');

  // ------------------------------------- 4. le moteur est bien chargé par l'écran
  verifier('l’écran charge le moteur de paye, sinon le gris des champs serait vide',
    /<script src="nexus-paye-moteur\.js/.test(html));
  verifier('et il lit paye_config, sinon il n’aurait rien à relire',
    /select\('paye_config,horaires'\)/.test(html));

  console.log('\n' + n + ' vérifications passées.');
});
