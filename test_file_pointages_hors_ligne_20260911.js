#!/usr/bin/env node
// Une tentative de pointage ne se perd pas parce que le réseau tombe.
//
// CE QUI MANQUAIT. Entre le clic et le serveur, une coupure faisait
// disparaître le pointage : un message « réessayez », et rien de conservé. À
// la station, cela veut dire une employée qui repointe trois fois, ou qui
// renonce — et un quart qui reste ouvert.
//
// CE QUE CETTE ÉPREUVE JUGE : les fonctions de file RÉELLEMENT embarquées
// dans NEXUS-Pointage-v1.html, extraites de son source et exécutées contre un
// faux localStorage et un faux client Supabase. Pas le texte du fichier.
//
// CE QU'ELLE NE JUGE PAS, et qu'il ne faut pas laisser croire : le
// comportement d'un vrai navigateur hors ligne. Ce qui est prouvé ici, c'est
// la file ; le reste demande une épreuve navigateur.

'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Le lanceur ATTEND les épreuves asynchrones. Une première version comptait
// un succès dès que la fonction rendait la main : les assertions posées dans
// un `.then` n'étaient jamais jugées. Un lanceur qui ne regarde pas ce qu'il
// lance est exactement le défaut que cette campagne poursuit.
let passes = 0;
const epreuves = [];
function t(nom, fn) { epreuves.push({ nom, fn }); }
async function lancerTout() {
  for (const { nom, fn } of epreuves) {
    try { await fn(); passes++; console.log(`  ✓ ${nom}`); }
    catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; }
  }
}

const RACINE = __dirname;
const POINTAGE = fs.readFileSync(path.join(RACINE, 'NEXUS-Pointage-v1.html'), 'utf8');

/** Monte la file du fichier réel dans un bac à sable contrôlé. */
function monterLaFile(options) {
  const o = options || {};
  const morceaux = ["const CLE_FILE_POINTAGES = 'nexus_pointages_en_attente';"];
  for (const nom of ['fileLire', 'fileEcrire', 'identifiantTentative', 'fileAjouter',
                     'fileRetirer', 'fileEntreeDuType', 'viderLaFile']) {
    const m = POINTAGE.match(new RegExp(`(?:async )?function ${nom}\\([\\s\\S]*?\\n  \\}`));
    assert.ok(m, `fonction ${nom} introuvable — l'épreuve ne juge plus rien`);
    morceaux.push(m[0]);
  }
  const stockage = { valeurs: {} };
  const localStorage = {
    getItem: k => (k in stockage.valeurs ? stockage.valeurs[k] : null),
    setItem: (k, v) => { stockage.valeurs[k] = String(v); },
    removeItem: k => { delete stockage.valeurs[k]; },
  };
  if (o.stockageInitial) stockage.valeurs['nexus_pointages_en_attente'] = o.stockageInitial;

  const journal = { inserts: [], selects: 0 };
  const nexusClient = {
    from() {
      return {
        select() {
          return { eq() { return this; }, limit: async () => {
            journal.selects++;
            return o.dejaEnBase ? { data: [{ id: 'x' }] } : { data: [] };
          } };
        },
        insert: async (ligne) => {
          journal.inserts.push(ligne);
          if (o.erreurInsert) return { error: { message: o.erreurInsert } };
          if (o.jetteReseau) throw new Error('Failed to fetch');
          return { error: null };
        },
      };
    },
  };
  const bac = new Function('localStorage', 'nexusClient', 'console', 'window', 'crypto',
    morceaux.join('\n') + '\nreturn { fileLire, fileEcrire, fileAjouter, fileRetirer, fileEntreeDuType, viderLaFile, identifiantTentative };')
    (localStorage, nexusClient, { error() {} }, { crypto: undefined }, undefined);
  return { ...bac, stockage, journal };
}

const LIGNE = (type) => ({ employee_id: 'emp-1', site: 'st-1', date: '2026-09-11', type, heure: '08:00:00' });

// ── La tentative est conservée avant tout envoi ───────────────────────────

t('une tentative est écrite sur l\'appareil, avec un identifiant idempotent', () => {
  const f = monterLaFile();
  const e = f.fileAjouter(LIGNE('arrivee'), {});
  assert.ok(e.id && e.id.length > 8, 'aucun identifiant idempotent');
  assert.ok(e.clic && !Number.isNaN(Date.parse(e.clic)), 'l\'heure du clic n\'est pas conservée');
  assert.strictEqual(f.fileLire().length, 1);
});

t('l\'heure du clic est distincte de l\'heure de réception', () => {
  const f = monterLaFile();
  const e = f.fileAjouter(LIGNE('arrivee'), {});
  // `clic` est posé par la file ; `heure` vient du pointage lui-même. Deux
  // champs, deux sens : l'un est le geste, l'autre sera la réception.
  assert.notStrictEqual(e.clic, e.ligne.heure);
  assert.strictEqual(e.ligne.heure, '08:00:00');
});

t('DOUBLE CLIC : deux ajouts du même type ne font qu\'une entrée', () => {
  const f = monterLaFile();
  const a = f.fileAjouter(LIGNE('arrivee'), {});
  const b = f.fileAjouter(LIGNE('arrivee'), {});
  assert.strictEqual(f.fileLire().length, 1, 'le double clic a créé deux tentatives');
  assert.strictEqual(a.id, b.id, 'le second clic a régénéré un identifiant');
});

t('arrivée PUIS départ hors ligne : deux entrées distinctes, aucune perdue', () => {
  const f = monterLaFile();
  f.fileAjouter(LIGNE('arrivee'), {});
  f.fileAjouter(LIGNE('depart'), {});
  assert.strictEqual(f.fileLire().length, 2);
  assert.ok(f.fileEntreeDuType('arrivee') && f.fileEntreeDuType('depart'));
});

// ── La reprise ────────────────────────────────────────────────────────────

t('RETOUR DU RÉSEAU : la file part, une seule fois', async () => {
  const f = monterLaFile();
  f.fileAjouter(LIGNE('arrivee'), {});
  f.fileAjouter(LIGNE('depart'), {});
  return f.viderLaFile({ id: 'emp-1' }).then(bilan => {
    assert.strictEqual(bilan.envoyees, 2);
    assert.strictEqual(bilan.restantes, 0);
    assert.strictEqual(f.journal.inserts.length, 2, 'la reprise a envoyé autre chose que les deux entrées');
  });
});

t('REPRISES RÉPÉTÉES : rejouer une file vide n\'envoie rien', async () => {
  const f = monterLaFile();
  f.fileAjouter(LIGNE('arrivee'), {});
  return f.viderLaFile({ id: 'emp-1' })
    .then(() => f.viderLaFile({ id: 'emp-1' }))
    .then(b2 => {
      assert.strictEqual(b2.envoyees, 0);
      assert.strictEqual(f.journal.inserts.length, 1, 'la seconde reprise a dupliqué le pointage');
    });
});

t('IDEMPOTENCE : si le serveur a déjà la ligne, on n\'insère pas deux fois', async () => {
  const f = monterLaFile({ dejaEnBase: true });
  f.fileAjouter(LIGNE('arrivee'), {});
  return f.viderLaFile({ id: 'emp-1' }).then(bilan => {
    assert.strictEqual(bilan.envoyees, 1, 'l\'entrée n\'a pas été retirée alors qu\'elle est en base');
    assert.strictEqual(f.journal.inserts.length, 0, 'un doublon a été inséré');
  });
});

// ── On ne perd jamais une tentative ───────────────────────────────────────

t('une erreur serveur CONSERVE la tentative', async () => {
  const f = monterLaFile({ erreurInsert: 'refus' });
  f.fileAjouter(LIGNE('arrivee'), {});
  return f.viderLaFile({ id: 'emp-1' }).then(bilan => {
    assert.strictEqual(bilan.envoyees, 0);
    assert.strictEqual(bilan.restantes, 1, 'la tentative a été perdue sur une erreur serveur');
  });
});

t('SESSION EXPIRÉE ou réseau coupé : la tentative RESTE, elle n\'est pas supprimée', async () => {
  // Le cas que l\'Orchestrator a nommé : ne jamais supprimer une tentative
  // qu\'on n\'a pas su remettre. Elle attend la reconnexion.
  const f = monterLaFile({ jetteReseau: true });
  f.fileAjouter(LIGNE('depart'), {});
  return f.viderLaFile({ id: 'emp-1' }).then(bilan => {
    assert.strictEqual(bilan.restantes, 1, 'une coupure a fait disparaître la tentative');
    assert.ok(f.fileEntreeDuType('depart'), 'le départ n\'est plus consultable localement');
  });
});

t('RECHARGEMENT et RÉOUVERTURE : la file survit au stockage', () => {
  const premier = monterLaFile();
  premier.fileAjouter(LIGNE('arrivee'), {});
  const brut = premier.stockage.valeurs['nexus_pointages_en_attente'];
  assert.ok(brut, 'rien n\'a été écrit dans le stockage');
  // Nouvelle page, même appareil : on repart du stockage, pas de la mémoire.
  const second = monterLaFile({ stockageInitial: brut });
  assert.strictEqual(second.fileLire().length, 1, 'la file n\'a pas survécu au rechargement');
  assert.ok(second.fileEntreeDuType('arrivee'));
});

t('un stockage illisible ne fait pas tomber l\'écran', () => {
  const f = monterLaFile({ stockageInitial: '{ceci n\'est pas du JSON' });
  assert.deepStrictEqual(f.fileLire(), [], 'un stockage corrompu propage son erreur');
});

// ── Ce que l'écran promet, et ce qu'il ne promet pas ──────────────────────

t('l\'écran annonce « envoi en attente », jamais « reçu »', () => {
  assert.ok(/envoi en attente/.test(POINTAGE), 'aucun état d\'attente visible');
  assert.ok(/sur ce téléphone/.test(POINTAGE),
    'l\'écran ne dit pas où le pointage se trouve réellement');
  const bloc = POINTAGE.match(/if \(error\) \{[\s\S]{0,700}?\n    \}/);
  assert.ok(bloc && !/réessayez/.test(bloc[0]),
    'l\'écran demande encore de réessayer alors que la tentative est conservée');
});

t('un type en attente n\'est ni repointable ni présenté comme fait', () => {
  assert.ok(/const enAttente = fileEntreeDuType\(type\);/.test(POINTAGE));
  assert.ok(/const bloque = !!enAttente \|\| !pointageDisponible\(type, dejaFait\);/.test(POINTAGE),
    'un pointage en attente reste cliquable');
});

t('la reprise est branchée au retour du réseau, une seule fois', () => {
  assert.ok(/window\.addEventListener\('online'/.test(POINTAGE), 'aucune reprise automatique');
  assert.ok(/if \(ecouteurReseauPose\) return;/.test(POINTAGE),
    'un écouteur par rendu enverrait autant de fois qu\'il y a eu de rendus');
});

t('l\'identifiant idempotent a la FORME d\'un uuid', () => {
  // `client_event_id` est une colonne uuid : une chaîne libre y serait
  // refusée, et la file resterait pleine sans que personne comprenne.
  const f = monterLaFile();
  for (let i = 0; i < 40; i++) {
    const id = f.identifiantTentative();
    assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id),
      `identifiant non conforme : ${id}`);
  }
});

t('le pointage porte son service et son identifiant jusqu\'en base', () => {
  assert.ok(/service_id: \(serviceDuJour && serviceDuJour\.id\) \|\| null,/.test(POINTAGE),
    'le pointage ne porte pas son service');
  assert.ok(/client_event_id: evenementClient,/.test(POINTAGE),
    'l\'identifiant idempotent ne voyage pas jusqu\'en base');
  const iId = POINTAGE.indexOf('const evenementClient = identifiantTentative();');
  const iLigne = POINTAGE.indexOf('const ligne = {');
  assert.ok(iId > -1 && iId < iLigne,
    'l\'identifiant est généré après la ligne : il ne protège plus la première tentative');
});

t('la file ne forge pas un second identifiant', () => {
  const f = monterLaFile();
  const ligne = { ...LIGNE('arrivee'), client_event_id: '11111111-1111-4111-8111-111111111111' };
  const e = f.fileAjouter(ligne, {});
  assert.strictEqual(e.id, ligne.client_event_id,
    'la file a régénéré un identifiant : celui envoyé en base et celui de la file divergent');
});

lancerTout().then(() => {
  console.log(`\n${passes}/17 vérifications passées — une tentative de pointage ne se perd plus, et rien n'est présenté comme reçu avant de l'être.`);
});
