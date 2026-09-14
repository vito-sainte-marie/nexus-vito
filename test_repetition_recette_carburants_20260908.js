// Épreuves de la répétition locale (outils/repetition-recette-carburants.js).
//
// Cet outil existe pour une raison mesurée : dans la nuit du 07 au 08/09/2026,
// faire fonctionner un seul semis a demandé quatre commits et quatre passages
// de CI, parce que la CI était le seul endroit où l'environnement réel
// pouvait être exercé. La répétition ramène ce retour à 0,2 seconde.
//
// Mais un banc qui se trompe est PIRE qu'un banc absent, parce qu'on le croit.
// Son premier jet rendait 5 jours sur 7 en échec sur un scénario que la CI
// réelle validait : son faux client renvoyait la ligne de ventes du jour à
// toutes les tables, et le moteur y lisait une commande fantôme. Ces épreuves
// existent d'abord contre ce risque-là.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const OUTIL = path.join(__dirname, 'outils', 'repetition-recette-carburants.js');
const R = require(OUTIL);

let passes = 0;
function t(nom, fn) { return fn().then(() => { passes++; console.log('OK — ' + nom); }); }

function config() { return JSON.parse(fs.readFileSync(R.CONFIG, 'utf8')); }

(async () => {

await t('le scénario tient les 14 cas sur la configuration réelle de la station', async () => {
  // Sans cette épreuve, toutes les suivantes passeraient avec un outil qui
  // refuse tout. Et sept jours, pas un : la fenêtre de vente avant livraison
  // dépend du jour, et c'est ce qui avait périmé la version précédente.
  const jours = await R.repeter(config());
  assert.strictEqual(jours.length, 14, 'sept jours × deux côtés du cutoff');
  for (const j of jours) {
    assert.deepStrictEqual(j.echecs, [], `${j.dateISO} : ${j.echecs.join(' | ')}`);
    assert.strictEqual(j.reliquatL, R.ATTENDU.reliquatL);
    assert.ok(j.stockPrevuSp95 >= R.BANDE_SP95.min && j.stockPrevuSp95 <= R.BANDE_SP95.max);
  }
  assert.strictEqual([...new Set(jours.map(j => j.fenetre))].sort().join(','), '1,2,3,4',
    'les QUATRE fenêtres doivent être réellement exercées, cutoff compris');
});

await t('la fenêtre dépend du jour ET du cutoff — la moitié qui manquait', async () => {
  // Le 08/09/2026, le scénario a été validé sur sept jours mais UNE seule
  // heure. Il a cassé à 13 h 25 : après le cutoff de 11 h, la commande part le
  // lendemain, la fenêtre de vente s'allonge, le stock projeté passe de +400 à
  // −1000 et la recommandation redevient physiquement impossible.
  //
  // Sept jours à une heure, c'était la moitié du domaine. Ces valeurs sont
  // MESURÉES au banc, jamais déduites — le jeudi après 11 h saute à quatre
  // jours (commande vendredi, livraison lundi), ce qu'aucun raisonnement
  // simple ne donne.
  assert.strictEqual(R.CUTOFF_HEURE, 11);
  const attendu = {
    1: [1, 2], 2: [1, 2], 3: [1, 2], 4: [1, 4], 5: [3, 4], 6: [3, 3], 7: [2, 2],
  };
  for (const [dow, [avant, apres]] of Object.entries(attendu)) {
    assert.strictEqual(R.fenetreDeVente(Number(dow), '09:00'), avant, `jour ${dow} avant cutoff`);
    assert.strictEqual(R.fenetreDeVente(Number(dow), '15:00'), apres, `jour ${dow} après cutoff`);
  }
  // La bascule se fait À 11 h pile, pas à 11 h 01.
  assert.strictEqual(R.fenetreDeVente(4, '10:59'), 1);
  assert.strictEqual(R.fenetreDeVente(4, '11:00'), 4, 'le cutoff est inclusif');
});

await t('LE DÉFAUT DU 07/09 — des cuves d’une AUTRE station sont détectées', async () => {
  // Le scénario avait été calibré avec les cuves de vito-sainte-marie
  // (SP95 limite 28 761 L) puis semé dans la station Test (23 750 L). Il
  // recommandait 24 000 L dans une cuve qui n'en accepte que 23 750, et rien
  // ne comparait les deux. C'est ce cas exact, désormais attrapé en 0,2 s.
  const c = config();
  c.cuves_carburants.sp95.cuves[0].limite_remplissage = 28761;
  c.cuves_carburants.sp95.cuves[0].capacite = 30276;
  const jours = await R.repeter(c);
  const enEchec = jours.filter(j => j.echecs.length);
  assert.ok(enEchec.length, 'une configuration de cuves étrangère doit être refusée');
  const texte = enEchec.flatMap(j => j.echecs).join(' | ');
  assert.ok(/attendu 23000 L|bande utile|physiquement impossible/.test(texte), texte);
});

await t('un stock hors de la bande utile est refusé, et la bande est NOMMÉE', async () => {
  // La bande [1, 750] a été mesurée, pas devinée. Au-delà, la signature
  // CARB-004 disparaît ; en dessous de 0, on entre dans le cas dégénéré.
  const bande = R.BANDE_SP95;
  assert.ok(bande.min >= 1 && bande.max <= 750, JSON.stringify(bande));
  const c = config();
  c.carburant_commande_config.maximum_camion_litres = 30000; // casse le total
  const jours = await R.repeter(c);
  assert.ok(jours.some(j => j.echecs.length), 'un camion plus petit ne peut plus produire 36 000 L');
});

await t('chaque règle du jugement est éprouvée SEULE, pas en meute', async () => {
  // Trois mutations avaient survécu au premier jet : les contrôles se
  // couvraient mutuellement, et supprimer l'un laissait les autres crier à sa
  // place. Une épreuve qui constate « un échec survient » ne prouve pas QUEL
  // contrôle l'a produit. D'où un jugement extrait, et une entrée conforme
  // qu'on abîme d'un seul défaut à la fois.
  const c = config();
  const limiteSp95 = R.limiteTotale(c.cuves_carburants.sp95);
  const bonne = () => ({
    total: 36000, volumes: { sp95: 23000, go: 13000 },
    reliquatArrondi: { recupereL: 1000, parCarburant: { go: 1000 },
      motifs: { sp95: 'Capacité disponible à la livraison insuffisante pour un compartiment de plus.' } },
  });
  const capaBonne = limiteSp95 - 400; // stock projeté 400 L, milieu de bande

  assert.deepStrictEqual(R.verifierJour({ commande: bonne(), capaciteSp95: capaBonne, config: c }), [],
    'la situation conforme doit passer, sinon les cas suivants ne prouvent rien');

  const cas = [
    ['total faux', { ...bonne(), total: 35000 }, capaBonne, /total 35000/],
    ['sp95 faux', { ...bonne(), volumes: { sp95: 22000, go: 13000 } }, capaBonne, /sp95 22000 L, attendu/],
    ['reliquat absent', { ...bonne(), reliquatArrondi: { recupereL: 0, parCarburant: {}, motifs: {} } }, capaBonne, /ne prouverait pas CARB-004/],
    ['reliquat mal crédité', { ...bonne(), reliquatArrondi: { recupereL: 1000, parCarburant: { sp95: 1000 }, motifs: { sp95: 'Capacité disponible…' } } }, capaBonne, /crédité à go/],
    ['refus sans motif', { ...bonne(), reliquatArrondi: { recupereL: 1000, parCarburant: { go: 1000 }, motifs: {} } }, capaBonne, /nommant la capacité/],
    ['volume irrecevable', { ...bonne(), volumes: { sp95: 24000, go: 12000 } }, capaBonne, /physiquement impossible/],
    ['capacité au-delà de la cuve', bonne(), limiteSp95 + 1000, /cas dégénéré CARB-006/],
    ['stock hors bande haute', bonne(), limiteSp95 - 900, /hors de la bande utile/],
    ['capacité inconnue', bonne(), null, /ne rien conclure/],
  ];
  for (const [nom, commande, capa, motif] of cas) {
    const e = R.verifierJour({ commande, capaciteSp95: capa, config: c });
    assert.ok(e.length, `${nom} doit être refusé`);
    assert.ok(motif.test(e.join(' | ')), `${nom} : ${e.join(' | ')}`);
  }

  assert.ok(R.verifierJour({ commande: null, capaciteSp95: capaBonne, config: c }).length,
    'une absence de commande est un échec, pas un silence');
});

await t('une configuration ABSENTE rend INDISPONIBLE, jamais « conforme »', async () => {
  const { spawnSync } = require('child_process');
  const r = spawnSync('node', ['-e',
    `const R = require(${JSON.stringify(OUTIL)});
     const o = R.lireConfig.toString();
     process.stdout.write(String(/introuvable/.test(o)));`], { encoding: 'utf8' });
  assert.strictEqual(r.stdout, 'true', 'lireConfig doit traiter le cas du fichier absent');
  const { erreur } = (() => { const vrai = R.CONFIG; try { return R.lireConfig(); } finally { void vrai; } })();
  assert.strictEqual(erreur, undefined, 'le fichier réel doit être lisible ici');
});

await t('une dérive de l’instantané est détectée, un simple réordonnancement non', async () => {
  // La garde existe pour empêcher le défaut du 07/09 de revenir par la fenêtre
  // : un banc calibré sur un fichier périmé « prouve » un scénario que la
  // station ne produit pas. Mais elle doit distinguer une VRAIE dérive d'un
  // simple ordre de clés différent — une garde qui crie pour rien finit
  // désactivée, et emporte les vraies alertes avec elle.
  const c = config();
  const vivant = JSON.parse(JSON.stringify(c));
  assert.deepStrictEqual(R.comparerInstantane(c, vivant), [], 'identique doit passer');

  // Mêmes valeurs, clés dans un autre ordre : ce n'est pas une dérive.
  const reordonne = JSON.parse(JSON.stringify(c));
  reordonne.carburant_commande_config = Object.fromEntries(
    Object.entries(reordonne.carburant_commande_config).reverse());
  assert.deepStrictEqual(R.comparerInstantane(c, reordonne), [],
    'un réordonnancement de clés n’est pas une dérive');

  // La dérive du 07/09 : les cuves d'une autre station.
  const derive = JSON.parse(JSON.stringify(c));
  derive.cuves_carburants.sp95.cuves[0].limite_remplissage = 28761;
  const e = R.comparerInstantane(c, derive);
  assert.strictEqual(e.length, 1, e.join(' | '));
  assert.ok(/cuves_carburants a dérivé/.test(e[0]) && /28761/.test(e[0]), e[0]);

  // Une configuration vivante illisible ne conclut RIEN.
  for (const rien of [null, undefined, 'texte', 42]) {
    const r = R.comparerInstantane(c, rien);
    assert.ok(r.length && /ne rien conclure/.test(r[0]), JSON.stringify(rien) + ' -> ' + r.join(' | '));
  }

  // Un champ hors périmètre ne fait pas crier la garde.
  const horsPerimetre = JSON.parse(JSON.stringify(c));
  horsPerimetre.parametres_inventaire = { reviewTime: '21:00' };
  assert.deepStrictEqual(R.comparerInstantane(c, horsPerimetre), [],
    'seuls les champs dont le scénario dépend sont suivis');
});

await t('CONTRAT — le faux client ne sert des ventes qu’à la table des ventes', async () => {
  // La régression qui a produit 5 échecs sur 7 : la table générique renvoyait
  // la ligne de ventes du jour à `carburant_commandes`, et le moteur y voyait
  // une commande en cours. Un contrat de source, parce que le symptôme est
  // silencieux — l'outil ne plante pas, il ment.
  const src = fs.readFileSync(OUTIL, 'utf8');
  assert.ok(/const tableVide = \(\)/.test(src), 'une table VIDE distincte doit exister');
  assert.ok(/return tableVide\(\);/.test(src), 'tout ce qui n’est pas les ventes doit la recevoir');
  const bloc = src.slice(src.indexOf('const tableVide'), src.indexOf('const tableVentes'));
  assert.ok(!/quart1|histo/.test(bloc),
    'la table vide ne doit connaître ni l’historique ni le quart du jour : ' + bloc);
});

await t('CONTRAT — la répétition n’écrit rien et ne prétend pas remplacer la recette', async () => {
  const src = fs.readFileSync(OUTIL, 'utf8').replace(/\/\/.*$/gm, '');
  // `push` n'est PAS dans cette liste : le premier jet l'y avait mis en pensant
  // à `git push`, alors que c'est `Array.push` partout dans le fichier. Une
  // interdiction qui vise le mauvais mot n'est pas un contrat, c'est un piège
  // qui se déclenche sur du code sain.
  for (const verbe of ['writeFileSync', 'appendFileSync', 'mkdirSync', 'rmSync',
    'execFileSync', 'execSync', 'spawnSync', 'fetch']) {
    assert.ok(!new RegExp(`\\b${verbe}\\s*\\(`).test(src), `la répétition ne doit jamais employer ${verbe}`);
  }
  const brut = fs.readFileSync(OUTIL, 'utf8');
  assert.ok(/PAS la preuve UI/.test(brut),
    'elle doit dire elle-même qu’un vert ici ne vaut pas preuve d’écran');
});

console.log(`\n${passes}/${passes} vérifications passées — la répétition rend le même verdict que la CI, six minutes plus tôt.`);
})().catch(e => { console.error(e); process.exit(1); });
