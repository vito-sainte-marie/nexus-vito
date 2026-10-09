#!/usr/bin/env node
'use strict';
// Guardian Philosophie NEXUS — la part mécanisable.
//
// Doctrine : `docs/gouvernance/GUARDIAN-PHILOSOPHIE-NEXUS.md`. Neuf critères,
// un droit de veto. Arbitré CONSULTATIF par decision-1.md (Q75) : jamais
// bloquant tant qu'il dépend d'un jugement de modèle.
//
// Cette contrainte n'interdit pas de mécaniser ce qui n'est PAS un jugement.
// Deux critères ont une conséquence objectivement vérifiable sur les écrans :
//
//   · critère 4, EXPLICABILITÉ — un humain qui lit l'état du système doit
//     pouvoir reconstituer pourquoi, sans deviner ;
//   · critère 8, FAIL-CLOSED — en cas d'information absente, le système
//     s'arrête et le dit, plutôt que de deviner ou d'agir par défaut.
//
// Formulé par Frédéric le 08/09/2026 en regardant NEXUS Live :
//
//   « Le silence doit avoir une signification explicite. Pas de disparition
//     de carte qui pourrait signifier "non contrôlé". »
//
// Une section TITRÉE qui disparaît entièrement quand sa condition est fausse
// laisse le lecteur incapable de distinguer « vérifié, rien à signaler » de
// « pas vérifié ». Les deux se ressemblent à l'écran ; elles n'ont rien à voir.
//
// CALIBRÉE AVANT D'ÊTRE CÂBLÉE (QA-002). Le premier jet signalait toute
// expression conditionnelle rendant du vide : 435 signalements sur 47
// fichiers. Une garde qui crie autant se fait désactiver et emporte avec elle
// ses vraies trouvailles. Resserrée sur les sections titrées : 7 signalements
// sur 62 écrans, tous relus un par un.
//
// CE QU'ELLE NE FAIT PAS. Elle ne juge PAS les neuf critères. Elle les
// rappelle au relecteur. Une garde qui déclarerait « simplicité : conforme »
// fabriquerait une conformité que personne n'a jugée — précisément ce que le
// critère 4 interdit.
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
// Surchargeable pour éprouver le repli : sans cela, le chemin « doctrine
// illisible » ne s'exécute jamais sur un dépôt sain, et une mutation qui le
// transforme en silence y survit sans être vue.
const DOCTRINE = process.env.NEXUS_DOCTRINE_PHILOSOPHIE
  || path.join(RACINE, 'docs', 'gouvernance', 'GUARDIAN-PHILOSOPHIE-NEXUS.md');

// Un bloc conditionnel qui rend du vide : `${cond ? `…` : ''}`.
const BLOC_CONDITIONNEL = /\$\{[^}]{1,80}\?\s*`[\s\S]{0,600}?`\s*:\s*''\}/g;
// Ce qui fait d'un bloc une SECTION : il porte un titre visible.
const MARQUEURS_SECTION = /class="card"|section-label|section-titre|section-head/;

// Les neuf critères, rappelés au relecteur — jamais évalués par la machine.
const CRITERES = [
  'Simplicité — le mécanisme le plus simple qui satisfait les invariants l’emporte.',
  'Automatisation par défaut, humain par exception — une étape manuelle se justifie par une valeur de jugement réelle.',
  'Absence de double saisie / double surveillance — ce qui existe déjà se lit, ne se reconstruit pas.',
  'Explicabilité — reconstituer POURQUOI une action a eu lieu ou a été refusée, sans deviner.',
  'Attribution correcte de la décision — une décision porte l’identité de qui l’a réellement rendue.',
  'Prévention de la dérive ERP — chaque brique répond à un besoin démontré, jamais « au cas où ».',
  'Contrôle de la complexité cumulative — ce qui rend l’ensemble plus dur à auditer se reporte.',
  'Fail-closed par défaut — en cas d’état contradictoire ou d’autorisation absente, on s’arrête.',
  'Isolation des données clientes préservée — aucune identité machine ne devient un passe-partout métier.',
];

function ecransDuDepot(racine) {
  return fs.readdirSync(racine)
    .filter(f => /^NEXUS-.*\.html$/.test(f))
    .sort();
}

// Le jugement, séparé de la lecture de fichiers pour être éprouvable.
function analyserSource(source, fichier) {
  const trouves = [];
  const blocs = String(source || '').match(BLOC_CONDITIONNEL) || [];
  for (const bloc of blocs) {
    if (!MARQUEURS_SECTION.test(bloc)) continue;
    const condition = (bloc.match(/^\$\{([^?]{1,80})\?/) || [, ''])[1].trim();
    const titre = (bloc.match(/(?:section-label|section-titre)[^>]*>([^<]{1,60})</) || [, null])[1];
    trouves.push({
      fichier: fichier || null,
      critere: 4,
      code: 'SECTION_QUI_DISPARAIT',
      condition,
      titre: titre ? titre.trim() : null,
      texte: `La section ${titre ? `« ${titre.trim()} »` : 'titrée'} disparaît entièrement quand `
        + `\`${condition}\` est faux. Le lecteur ne peut pas distinguer « vérifié, rien à signaler » `
        + 'de « pas vérifié » — critères 4 (explicabilité) et 8 (fail-closed).',
    });
  }
  return trouves;
}

function analyserDepot(racine) {
  const r = racine || RACINE;
  const findings = [];
  for (const f of ecransDuDepot(r)) {
    findings.push(...analyserSource(fs.readFileSync(path.join(r, f), 'utf8'), f));
  }
  return findings;
}

function doctrineLisible(chemin) {
  const p = chemin || DOCTRINE;
  if (!fs.existsSync(p)) return { lisible: false, motif: `${path.relative(RACINE, p)} introuvable` };
  const src = fs.readFileSync(p, 'utf8');
  // Une doctrine amputée ne vaut pas une doctrine : les neuf critères et la
  // question obligatoire en sont le cœur.
  const manque = [];
  if (!/Pourquoi un humain doit-il intervenir ici/.test(src)) manque.push('la question obligatoire');
  for (let i = 1; i <= 9; i++) if (!new RegExp(`^${i}\\.\\s+\\*\\*`, 'm').test(src)) manque.push(`le critère ${i}`);
  return manque.length ? { lisible: false, motif: 'doctrine incomplète : ' + manque.join(', ') } : { lisible: true };
}

module.exports = { analyserSource, analyserDepot, doctrineLisible, ecransDuDepot, CRITERES, DOCTRINE };

if (require.main === module) {
  const d = doctrineLisible();
  if (!d.lisible) {
    // Fail closed : sans doctrine lisible, on ne rend AUCUN verdict. Une garde
    // qui juge sans référence écrite juge selon elle-même.
    console.error('Guardian Philosophie INDISPONIBLE — ' + d.motif);
    console.error('Aucun verdict rendu : une garde sans doctrine lisible jugerait selon elle-même.');
    process.exit(1);
  }
  const findings = analyserDepot();
  console.log('Guardian Philosophie NEXUS — consultatif (Q75), jamais bloquant.\n');
  if (!findings.length) {
    console.log('Aucune section qui disparaît en silence.');
  } else {
    console.log(`${findings.length} section(s) dont le silence est ambigu :\n`);
    for (const f of findings) console.log(`  · ${f.fichier} — ${f.texte}`);
  }
  console.log('\nLes neuf critères ne sont PAS évalués ici — ils sont rappelés au relecteur :');
  CRITERES.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  console.log('\nQuestion obligatoire pour toute évolution sollicitant un humain :');
  console.log('  « Pourquoi un humain doit-il intervenir ici ? »');
  console.log('  Sans réponse écrite, la conception se revoit avant d\'aller à l\'arbitrage.');
  process.exit(0);
}
