'use strict';
// Vigie de la CI du rail — VIGIE-CI-RAIL-20261024.
// Alerte (run en échec + annotation ::error) quand la série de runs TERMINÉS rouges du workflow « Tests » sur
// la branche du rail dure depuis plus de 60 minutes, mesurée depuis la création du premier rouge qui suit le
// dernier vert (jamais depuis le dernier run). Un vert plus récent éteint l'alerte ; un run en cours ne la lève pas. Lecture seule : `gh run list` et
// `gh run view --log-failed`, rien d'autre (permission `actions: read`, jamais `write`).
// Réglages (épreuves) : NEXUS_GH (binaire), NEXUS_RAIL, NEXUS_SEUIL_MINUTES, NEXUS_MAINTENANT (ISO).
const { execFileSync } = require('child_process');

const GH = process.env.NEXUS_GH || 'gh';
const RAIL = process.env.NEXUS_RAIL || 'handoff-continuite-20260920';
const SEUIL_MIN = Number(process.env.NEXUS_SEUIL_MINUTES || 60);
const MAINTENANT = process.env.NEXUS_MAINTENANT ? new Date(process.env.NEXUS_MAINTENANT) : new Date();

const une = (l) => String(l).replace(/[\r\n%]/g, ' ');
const alerte = (titre, msg) => console.log(`::error title=${titre}::${une(msg)}`);
const gh = (...a) => execFileSync(GH, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env });

function premierRouge(id) {
  let texte;
  try { texte = gh('run', 'view', String(id), '--log-failed'); } catch (e) { return 'journal du run illisible'; }
  const lignes = texte.replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/).filter(Boolean);
  const nettoie = (l) => { const [job, etape, ...reste] = l.split('\t'); return reste.length ? { etape: `${job} / ${etape}`, texte: reste.join('\t').replace(/^﻿?\S+Z /, '') } : { etape: '', texte: l }; };
  const vues = lignes.map(nettoie);
  const rouge = vues.find(v => /\bFAIL\b|\bnot ok\b|^\s*\[\w+\] \S+\.js/.test(v.texte)) || vues.find(v => /##\[error\]/.test(v.texte)) || vues[0];
  return rouge ? `${rouge.etape ? `étape « ${rouge.etape} » : ` : ''}${rouge.texte.slice(0, 240)}` : 'aucune ligne de journal';
}

const LIMITE = 20;
let runs;
try { runs = JSON.parse(gh('run', 'list', '--workflow', 'Tests', '--branch', RAIL, '--limit', String(LIMITE), '--json', 'databaseId,conclusion,status,headSha,createdAt,updatedAt')); }
catch (e) { alerte('Vigie CI du rail aveugle', `lecture des runs de ${RAIL} impossible : ${une((e.stderr || e.message || '').toString().trim().slice(0, 200))}`); process.exit(1); }

// Verdicts = runs terminés, ni annulés ni sautés, du plus récent au plus ancien. On remonte jusqu'au dernier
// vert : la série rouge commence au premier rouge qui le suit. Mesurer depuis le dernier run rouge remettrait
// le compteur à zéro à chaque push : une journée de pushes rouges ne déclencherait jamais l'alerte.
const verdicts = runs.filter(r => r.status === 'completed' && r.conclusion !== 'cancelled' && r.conclusion !== 'skipped');
const serie = [];
let vert = null;
for (const r of verdicts) { if (r.conclusion === 'success') { vert = r; break; } serie.push(r); }
if (!serie.length) { console.log(vert ? `Vigie CI du rail : dernier run vert (${vert.headSha.slice(0, 8)}).` : `Vigie CI du rail : aucun run terminé sur ${RAIL}.`); process.exit(0); }

const dernier = serie[0];
const premier = serie[serie.length - 1];
// Pas de vert dans les runs lus et la liste est pleine : la série est peut-être plus longue que ce qu'on voit.
const tronquee = !vert && runs.length >= LIMITE;
const minutes = (MAINTENANT - new Date(premier.createdAt)) / 60000;
if (!(minutes > SEUIL_MIN)) { console.log(`Vigie CI du rail : rouge depuis ${Math.floor(minutes)} min (seuil ${SEUIL_MIN}) — silence.`); process.exit(0); }
const duree = tronquee ? `au moins ${Math.floor(minutes)} min (série plus longue que les ${LIMITE} runs lus : mesurée depuis le plus ancien lu)` : `${Math.floor(minutes)} min`;
alerte('CI du rail rouge', `${RAIL} : rouge depuis ${duree}, ${serie.length} run(s) rouge(s) d'affilée, premier rouge sur ${premier.headSha.slice(0, 8)} (run ${premier.databaseId}), dernier sur ${dernier.headSha.slice(0, 8)} (run ${dernier.databaseId}) — première ligne rouge du dernier : ${premierRouge(dernier.databaseId)}`);
process.exit(1);
