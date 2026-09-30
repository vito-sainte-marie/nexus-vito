#!/usr/bin/env node
'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// LE CÂBLAGE DES MAILLONS EST-IL RÉELLEMENT EN PLACE ?
//
// `test_etat_maillon` prouve que la porte fonctionne. Il ne prouve pas qu'on
// s'en sert. La distinction n'est pas théorique : pendant quatre jours la
// chaîne du Handoff a été arrêtée par des refus qui sortaient en 0, et tous
// les modules concernés étaient, eux, parfaitement corrects. Le défaut n'était
// jamais dans la fonction — il était dans le câblage.
//
// Cette épreuve lit donc le workflow, pas les modules. Elle mesure que les
// maillons de la chaîne Handoff publient un état, et qu'un arrêt publié porte
// de quoi agir. Elle ne juge pas les rapports consultatifs (Guardians), qui
// ne refusent aucune action essentielle : les confondre avec des maillons
// rendrait cette épreuve inutilisable, et donc, à terme, retirée.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const assert = require('assert');

const WORKFLOW = '.github/workflows/tests.yml';
const PORTE = 'outils/etat-maillon.js';
const ETATS = ['EXECUTE', 'NO_WORK', 'BLOCKED', 'HUMAN_DECISION_REQUIRED', 'FAILED'];
const ETATS_QUI_ARRETENT = ['BLOCKED', 'HUMAN_DECISION_REQUIRED', 'FAILED'];
const OPTIONS_D_ARRET = ['--condition', '--sha', '--branche', '--lot', '--prochaine-action'];

// Les maillons de la chaîne : un outil dont le silence arrête le Handoff.
// La liste est fermée et nommée à la main. Une découverte automatique aurait
// l'air plus robuste et serait moins sûre : elle promouvrait en maillon le
// premier script ajouté au workflow, et l'épreuve rougirait pour une raison
// qui n'a rien à voir avec la continuité.
const MAILLONS = Object.freeze([
  { outil: 'outils/reveil-orchestrateur.js', role: 'calcule et publie le réveil de l’Orchestrateur' },
  { outil: 'outils/garde-branches-en-rade.js', role: 'constate le travail resté hors du rail' },
]);

const echecs = [];
let passees = 0;
function ep(titre, f) {
  try { f(); passees++; } catch (e) { echecs.push(`${titre} — ${e.message}`); }
}

const brut = fs.readFileSync(WORKFLOW, 'utf8');
// Le shell continue une commande sur la ligne suivante avec `\`. Sans recoller
// ces lignes, une invocation d'arrêt paraîtrait dépourvue de tous ses champs.
const recolle = brut.replace(/\\\n\s*/g, ' ');
const lignes = recolle.split('\n');

// ── 1. CHAQUE MAILLON PUBLIE UN ÉTAT ─────────────────────────────────────────
// Un maillon peut s’étaler sur plusieurs étapes, et toutes n’ont pas le même
// statut. Une étape qui se contente d’écrire le message dans le résumé de run
// ne refuse rien : elle rend. Celle qui peut TERMINER sur le résultat de
// l’outil, elle, décide — et c’est exactement là que le refus muet se logeait.
// D’où la règle : rendre est libre, décider oblige à publier.
for (const m of MAILLONS) {
  ep(`le maillon ${m.outil} publie un état`, () => {
    const etapes = etapesQuiInvoquent(m.outil);
    assert.ok(etapes.length > 0, `aucune étape du workflow n’invoque ${m.outil} (${m.role})`);
    assert.ok(etapes.some(e => e.texte.includes(PORTE)),
      `aucune étape ne publie d’état pour ${m.outil} : son refus resterait invisible, ` +
      `exactement le défaut que §4 ferme`);
    for (const e of etapes) {
      const decide = /(^|\s)exit\s/.test(e.texte);
      if (decide) assert.ok(e.texte.includes(PORTE),
        `l’étape « ${e.nom} » peut terminer sur le résultat de ${m.outil} sans publier d’état`);
    }
  });
}

// ── 2. AUCUN MAILLON N’EST BÂILLONNÉ PAR `|| true` ───────────────────────────
// `|| true` sur une AFFECTATION est légitime et répandu ici (GitHub lance bash
// avec -e). Sur l’INVOCATION d’un maillon, c’est le bâillon : le code de sortie
// est jeté, et avec lui la seule chose que le maillon avait à dire.
for (const m of MAILLONS) {
  ep(`le maillon ${m.outil} n’est pas bâillonné`, () => {
    const motif = new RegExp('node\\s+' + m.outil.replace(/[.]/g, '\\.') + '[^\\n]*\\|\\|\\s*true');
    const coupable = lignes.find(l => motif.test(l) && !/^\s*#/.test(l));
    assert.ok(!coupable, `le code de sortie de ${m.outil} est avalé par « || true » : ${String(coupable).trim()}`);
  });
}

// ── 3. UN ARRÊT PUBLIÉ PORTE DE QUOI AGIR ────────────────────────────────────
// Un `BLOCKED` sans SHA ni prochaine action est un `success` déguisé avec plus
// d’étapes. La porte l’interdit déjà à l’exécution ; on le veut aussi visible
// à la lecture, avant qu’un run ne soit dépensé pour l’apprendre.
ep('tout arrêt publié depuis le workflow porte ses six champs', () => {
  const sites = lignes.filter(l => l.includes(PORTE) && !/^\s*#/.test(l));
  assert.ok(sites.length > 0, `aucune invocation de ${PORTE} dans le workflow`);
  for (const site of sites) {
    const etat = ETATS.find(e => new RegExp(PORTE.replace(/[.]/g, '\\.') + '\\s+' + e + '\\b').test(site));
    assert.ok(etat, `invocation sans état lisible : ${site.trim()}`);
    if (!ETATS_QUI_ARRETENT.includes(etat)) continue;
    for (const o of OPTIONS_D_ARRET) {
      assert.ok(site.includes(o + ' '), `un ${etat} publié sans ${o} : ${site.trim().slice(0, 120)}…`);
    }
    assert.ok(site.includes('--maillon '), `un ${etat} publié sans --maillon : ${site.trim().slice(0, 120)}…`);
  }
});

// ── 4. AUCUN ÉTAT INVENTÉ ────────────────────────────────────────────────────
// La liste est fermée côté module. Si le workflow appelle `SUCCESS` ou `OK`,
// la porte rougira — en production, un run plus tard. Autant le savoir ici.
ep('le workflow n’invente aucun état hors de la liste fermée', () => {
  const motif = new RegExp(PORTE.replace(/[.]/g, '\\.') + '\\s+([A-Za-z_][A-Za-z_]*)', 'g');
  let m;
  while ((m = motif.exec(recolle)) !== null) {
    assert.ok(ETATS.includes(m[1]), `état inconnu appelé depuis le workflow : « ${m[1] }»`);
  }
});

// ── 5. LE RÉVEIL NE SE REDÉCLENCHE PAS LUI-MÊME ──────────────────────────────
// Publier un corps qui mentionne Claude relancerait Claude sur son propre
// réveil. Ce n’est pas un arrêt à signaler, c’est une boucle à empêcher : elle
// doit rester le seul rouge franc de l’étape.
ep('la mention redéclenchante reste un rouge franc', () => {
  const etapes = etapesQuiInvoquent('outils/reveil-orchestrateur.js');
  assert.ok(etapes.length > 0, 'étape du réveil introuvable');
  const texte = etapes.map(e => e.texte).join('\n');
  assert.ok(/MENTION_REDECLENCHANTE/.test(texte),
    'la garde contre la boucle a disparu des étapes du réveil');
  const site = texte.split('\n').find(l => l.includes('MENTION_REDECLENCHANTE') && l.includes(PORTE));
  assert.ok(site && /\bFAILED\b/.test(site),
    'la mention redéclenchante ne doit pas être publiée autrement qu’en FAILED');
});

// ── 6. AUCUN CHEMIN DE SORTIE MUET ───────────────────────────────────────────
// La forme exacte du défaut de septembre : `echo "…" ; exit 0`. Une première
// version de cette épreuve comptait les sorties et les publications, et exigeait
// au moins autant de secondes que de premières. Une mutation l'a démasquée :
// retirer la publication d'UN chemin tout en gardant celle d'un autre laissait
// les totaux intacts. Compter ne dit rien de QUI publie.
//
// On regarde donc chaque sortie, et le chemin qui y mène : depuis la sortie
// précédente jusqu'à celle-ci, un état a-t-il été publié ? C'est approximatif
// — bash n'est pas analysé, seulement lu — mais c'est la bonne approximation :
// elle est sensible là où le défaut se loge, au chemin, et pas au total.
for (const m of MAILLONS) {
  ep(`aucun chemin de sortie muet dans le maillon ${m.outil}`, () => {
    for (const e of etapesQuiInvoquent(m.outil)) {
      const corps = e.texte.split('\n').filter(l => !/^\s*#/.test(l));
      let fenetre = [];
      for (const l of corps) {
        fenetre.push(l);
        if (!/(^|\s|;)exit\s/.test(l)) continue;
        assert.ok(fenetre.join('\n').includes(PORTE),
          `l’étape « ${e.nom} » a un chemin qui se termine sans publier d’état : ` +
          `« ${l.trim().slice(0, 90)} »`);
        fenetre = [];
      }
    }
  });
}

// Un step qui lit `$?` doit d'abord désarmer `-e`.
//
// GitHub lance `shell: bash` avec `-e`. Sous `-e`, la commande dont on veut
// lire le code de retour tue le step AVANT la ligne qui le lit : le `$?` n'est
// jamais atteint, rien ne s'imprime, et le run montre un rouge nu. `set -uo
// pipefail` ne désarme PAS `-e` — c'est la confusion qui a coûté le coup, et
// elle se relit sans se voir.
//
// Le coût exact, mesuré en vol le 30/09 : l'étape des branches en rade est
// morte à l'affectation, donc précisément le jour où la garde avait quelque
// chose à dire. Son état de maillon n'a jamais été publié. Une étape écrite
// pour supprimer les refus silencieux en produisait un.
//
// L'épreuve est statique et porte sur TOUS les steps, pas sur les deux
// connus : la règle vaut pour le prochain step écrit, qui n'est pas encore là.
ep('un step qui lit `$?` a désarmé le `-e` de GitHub', () => {
  const fautifs = [];
  for (const s of tousLesSteps()) {
    // Un `$?` cité dans un commentaire ne s'exécute pas : le compter ferait
    // rougir l'épreuve sur l'explication du défaut plutôt que sur le défaut.
    const code = s.texte.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
    const lu = code.indexOf('$?');
    if (lu === -1) continue;
    const desarme = code.indexOf('set +e');
    if (desarme === -1 || desarme > lu) fautifs.push(`${s.nom} (ligne ${s.ligne})`);
  }
  assert.deepStrictEqual(fautifs, [],
    'ces steps lisent `$?` sous le `-e` de GitHub, donc ne l’atteignent jamais : '
    + fautifs.join(' | '));
});
// ── outillage ────────────────────────────────────────────────────────────────
// Découpe le workflow en étapes (`- name:` au niveau des étapes) et rend
// TOUTES celles qui invoquent l’outil demandé — s’arrêter à la première ferait
// passer un second site muet pour inexistant.
// Rend TOUS les steps du workflow, pas seulement ceux qui invoquent un outil
// nommé : une règle de forme du shell vaut pour le step qui n'existe pas
// encore, et une liste fermée ne l'attraperait pas.
function tousLesSteps() {
  const l = brut.split('\n');
  const debuts = [];
  for (let i = 0; i < l.length; i++) if (/^\s{6}- name:/.test(l[i])) debuts.push(i);
  return debuts.map((i, d) => ({
    nom: l[i].replace(/^\s*- name:\s*/, '').trim(),
    texte: l.slice(i, d + 1 < debuts.length ? debuts[d + 1] : l.length).join('\n'),
    ligne: i + 1,
  }));
}
function etapesQuiInvoquent(outil) {
  const l = recolle.split('\n');
  const debuts = [];
  for (let i = 0; i < l.length; i++) if (/^\s{6}- name:/.test(l[i])) debuts.push(i);
  const trouvees = [];
  for (let d = 0; d < debuts.length; d++) {
    const i = debuts[d];
    const fin = d + 1 < debuts.length ? debuts[d + 1] : l.length;
    const texte = l.slice(i, fin).join('\n');
    if (texte.includes('node ' + outil)) {
      trouvees.push({ nom: l[i].replace(/^\s*- name:\s*/, '').trim(), texte, ligne: i + 1 });
    }
  }
  return trouvees;
}

console.log(`\nCâblage des maillons — ${passees} épreuve(s) passée(s), ${echecs.length} échec(s).`);
for (const e of echecs) console.log('  ÉCHEC : ' + e);
process.exitCode = echecs.length ? 1 : 0;
