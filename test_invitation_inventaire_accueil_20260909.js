#!/usr/bin/env node
// L'invitation à l'inventaire, sur l'accueil employé.
//
// Demande de Frédéric Bragance, 09/09/2026 : « soumettre au renfort sa
// participation à l'inventaire », « sur l'accueil employé après la prise de
// poste ».
//
// CE QUI EST ÉPROUVÉ EST LE COMPORTEMENT DE LA CARTE, pas le texte du fichier.
// On extrait la fonction réelle de NEXUS-App-v1.html, on lui donne un DOM et
// des couches de données simulés, et l'on regarde ce qu'elle affiche — ou ce
// qu'elle refuse d'afficher.
//
// LE PLUS IMPORTANT EST CE QU'ELLE NE MONTRE PAS. Une invitation fausse
// coûterait plus cher que pas d'invitation, à une équipe qui pense déjà que
// NEXUS ne fonctionne pas.

'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passes = 0;
const attentes = [];
function t(nom, fn) { attentes.push({ nom, fn }); }

const HTML = fs.readFileSync(path.join(__dirname, 'NEXUS-App-v1.html'), 'utf8');
const SCRIPT = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// Extraction par comptage d'accolades, comme les autres épreuves de ce module.
function extraire(nom, source) {
  const src = source || SCRIPT;
  const debut = src.indexOf(`async function ${nom}(`);
  assert.ok(debut !== -1, `${nom} introuvable`);
  let i = src.indexOf('{', debut), prof = 1, j = i + 1;
  while (prof > 0) { if (src[j] === '{') prof++; else if (src[j] === '}') prof--; j++; }
  return src.slice(debut, j);
}

function faireElement() {
  return { textContent: '', style: {}, innerHTML: '' };
}

// Monte la fonction réelle dans un bac à sable complet.
function monter({ proposition, quart, erreur, sansMoteur }) {
  const els = {
    participationInventaire: faireElement(),
    participationTexte: faireElement(),
    participationTag: faireElement(),
  };
  els.participationInventaire.style.display = 'none';
  const ctx = {
    console: { warn() {}, error() {} },
    Promise, Object, Array, String, Number, JSON,
    document: { getElementById: (id) => els[id] || null },
    nexusClient: {},
    NexusStation: {
      quartConfigureDuMoment: async () => { if (erreur) throw new Error('réseau'); return quart; },
      dateLocaleStation: () => '2026-09-09',
    },
    window: {},
  };
  if (!sansMoteur) {
    ctx.window.NexusInventaireMoteur = { propositionParticipationDuJour: () => proposition };
    ctx.window.NexusInventaireMissionRulesDonnees = {
      chargerMissionRules: async () => [],
      chargerRolesPresentsQuart: async () => ['caissier'],
      normaliserRoleCode: (r) => r,
    };
  }
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(extraire('afficherParticipationInventaire') + '\nglobalThis.__f = afficherParticipationInventaire;', ctx);
  return { appeler: (...a) => ctx.__f(...a), els };
}

const PROPOSITION = { role: 'renfort', mission: { nom: 'Contrôle produits sensibles' },
                      viaRepli: false, nombreEnAttente: 1, moment: 'pendant' };

t('une mission qui attend fait APPARAÎTRE la carte, avec son nom', async () => {
  const m = monter({ proposition: PROPOSITION, quart: { quart: '1' } });
  await m.appeler('vito-sainte-marie', 'renfort', 'America/Martinique');
  assert.strictEqual(m.els.participationInventaire.style.display, '');
  assert.strictEqual(m.els.participationTexte.textContent, 'Contrôle produits sensibles');
  assert.strictEqual(m.els.participationTag.textContent, 'L’inventaire vous attend');
});

t('venir EN SOUTIEN est dit comme tel, jamais confondu', async () => {
  // Remplacer un rôle absent n'est pas sa propre mission : l'employé a le
  // droit de le savoir avant d'accepter.
  const m = monter({ proposition: { ...PROPOSITION, viaRepli: true }, quart: { quart: '1' } });
  await m.appeler('vito-sainte-marie', 'renfort', 'America/Martinique');
  assert.ok(/^En soutien : /.test(m.els.participationTexte.textContent));
  assert.strictEqual(m.els.participationTag.textContent, 'L’équipe a besoin de vous');
});

t('le nombre qui attend derrière est dit, et s’accorde', async () => {
  const un = monter({ proposition: { ...PROPOSITION, nombreEnAttente: 2 }, quart: { quart: '1' } });
  await un.appeler('s', 'renfort', 'America/Martinique');
  assert.ok(/1 autre attend$/.test(un.els.participationTexte.textContent),
    un.els.participationTexte.textContent);
  const trois = monter({ proposition: { ...PROPOSITION, nombreEnAttente: 4 }, quart: { quart: '1' } });
  await trois.appeler('s', 'renfort', 'America/Martinique');
  assert.ok(/3 autres attendent$/.test(trois.els.participationTexte.textContent),
    trois.els.participationTexte.textContent);
});

t('RIEN à proposer : la carte reste masquée', async () => {
  // « 0 mission en attente » ajouterait du bruit à un outil qu'on reproche
  // déjà d'en faire trop.
  const m = monter({ proposition: null, quart: { quart: '1' } });
  await m.appeler('vito-sainte-marie', 'renfort', 'America/Martinique');
  assert.strictEqual(m.els.participationInventaire.style.display, 'none');
});

t('quart INDÉTERMINÉ : la carte se tait, elle ne devine pas la session', async () => {
  const m = monter({ proposition: PROPOSITION, quart: { indetermine: 'configuration' } });
  await m.appeler('vito-sainte-marie', 'renfort', 'America/Martinique');
  assert.strictEqual(m.els.participationInventaire.style.display, 'none');
});

t('une PANNE de lecture masque la carte au lieu d’inventer', async () => {
  const m = monter({ proposition: PROPOSITION, quart: { quart: '1' }, erreur: true });
  await m.appeler('vito-sainte-marie', 'renfort', 'America/Martinique');
  assert.strictEqual(m.els.participationInventaire.style.display, 'none');
});

t('sans moteur chargé, la carte se tait — jamais d’exception à l’accueil', async () => {
  const m = monter({ proposition: PROPOSITION, quart: { quart: '1' }, sansMoteur: true });
  await m.appeler('vito-sainte-marie', 'renfort', 'America/Martinique');
  assert.strictEqual(m.els.participationInventaire.style.display, 'none');
});

t('sans rôle du jour, aucune invitation', async () => {
  const m = monter({ proposition: PROPOSITION, quart: { quart: '1' } });
  await m.appeler('vito-sainte-marie', null, 'America/Martinique');
  assert.strictEqual(m.els.participationInventaire.style.display, 'none');
});

t('MUTATION : sans le refus explicite, on sort par une ERREUR au lieu du calme', async () => {
  // Le try/catch absorbe la mutation : sans `if (!p) return`, l'accès à
  // `p.mission` lève, l'erreur est attrapée, et la carte reste masquée. Le
  // résultat visible est IDENTIQUE — c'est le CHEMIN qui diffère, et c'est lui
  // qu'il faut mesurer. Sortir proprement ne journalise rien ; sortir par une
  // exception journalise un avertissement. Un accueil qui se tait en écrivant
  // « lecture impossible » dans la console n'est pas un accueil sain, et le
  // jour où le catch disparaîtra, la page cassera.
  const construire = (source, proposition) => {
    const els = { participationInventaire: faireElement(), participationTexte: faireElement(),
                  participationTag: faireElement() };
    els.participationInventaire.style.display = 'none';
    const avertissements = [];
    const ctx = { console: { warn: (...a) => avertissements.push(a), error() {} },
      Promise, Object, Array, String, Number, JSON,
      document: { getElementById: (id) => els[id] || null }, nexusClient: {},
      NexusStation: { quartConfigureDuMoment: async () => ({ quart: '1' }),
                      dateLocaleStation: () => '2026-09-09' },
      window: { NexusInventaireMoteur: { propositionParticipationDuJour: () => proposition },
                NexusInventaireMissionRulesDonnees: { chargerMissionRules: async () => [],
                  chargerRolesPresentsQuart: async () => [], normaliserRoleCode: r => r } } };
    ctx.globalThis = ctx; vm.createContext(ctx);
    vm.runInContext(extraire('afficherParticipationInventaire', source)
      + '\nglobalThis.__f = afficherParticipationInventaire;', ctx);
    return { appeler: () => ctx.__f('s', 'renfort', 'America/Martinique'), els, avertissements };
  };

  const sain = construire(SCRIPT, null);
  await sain.appeler();
  assert.strictEqual(sain.avertissements.length, 0,
    'le chemin normal ne doit RIEN journaliser : ne rien avoir à proposer est banal');

  const mute = SCRIPT.replace('      if (!p) return;', '');
  assert.notStrictEqual(mute, SCRIPT, 'la mutation n’a rien changé : elle ne prouve rien');
  const casse = construire(mute, null);
  await casse.appeler();
  assert.strictEqual(casse.els.participationInventaire.style.display, 'none',
    'même mutée, la carte ne doit jamais s’afficher vide');
  assert.ok(casse.avertissements.length > 0,
    'le code muté devait sortir par le catch ; l’épreuve ne distingue donc pas les deux chemins');
});

(async () => {
  for (const { nom, fn } of attentes) {
    try { await fn(); passes++; console.log(`  ✓ ${nom}`); }
    catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; }
  }
  console.log(`\n${passes}/${attentes.length} vérifications passées — elle se tait plutôt que de se tromper.`);
})();
