// Génère le SQL d'import d'un lot (AUCUNE connexion, AUCUNE écriture ici). Vérifie d'abord le SHA-256 de l'export et du manifeste
// (contre EMPREINTES-SHA256.txt) puis le md5 de chaque jeu (lignes jointes par \n, ordre de l'export) contre le manifeste.
// Usage : node 20_import_lot.mjs <dossier-export> <sortie.sql> [--id-attendu 7678069749886157684]
// Le SQL produit commence par la garde projet Test et crée un NOUVEAU lot (jamais de mise à jour). Il est à jouer d'un seul bloc.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const [dir, sortie, ...opts] = process.argv.slice(2);
if (!dir || !sortie) { console.error('usage : node 20_import_lot.mjs <dossier-export> <sortie.sql>'); process.exit(2); }
const idAttendu = (opts[opts.indexOf('--id-attendu') + 1]) || '7678069749886157684';
const sha = b => crypto.createHash('sha256').update(b).digest('hex'), md5 = s => crypto.createHash('md5').update(s).digest('hex');
const q = s => s === null || s === undefined ? 'null' : "'" + String(s).replace(/'/g, "''") + "'";
const fichiers = fs.readdirSync(dir);
const nomExport = fichiers.find(f => /^export_scanner_.*\.json$/.test(f)), nomManif = 'MANIFESTE.json';
if (!nomExport || !fichiers.includes(nomManif) || !fichiers.includes('EMPREINTES-SHA256.txt')) { console.error('ARRÊT : fichiers attendus absents'); process.exit(1); }
const bExp = fs.readFileSync(path.join(dir, nomExport)), bMan = fs.readFileSync(path.join(dir, nomManif));
const empr = Object.fromEntries(fs.readFileSync(path.join(dir, 'EMPREINTES-SHA256.txt'), 'utf8').split('\n').map(l => l.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/)).filter(Boolean).map(m => [m[2], m[1]]));
const shaExp = sha(bExp), shaMan = sha(bMan);
if (empr[nomExport] !== shaExp) { console.error(`ARRÊT : SHA-256 de ${nomExport} ${shaExp} ≠ ${empr[nomExport]}`); process.exit(1); }
if (empr[nomManif] !== shaMan) { console.error(`ARRÊT : SHA-256 de ${nomManif} ${shaMan} ≠ ${empr[nomManif]}`); process.exit(1); }
const exp = JSON.parse(bExp), man = JSON.parse(bMan);
const attendus = man.jeux || {};
const jeux = exp.jeux; const noms = Object.keys(jeux), verdicts = [];
for (const nom of noms) {
  const j = jeux[nom], calc = md5(j.lignes.join('\n')), ref = attendus[nom] && attendus[nom].md5_base;
  const ok = calc === j.md5_base && j.lignes.length === j.n && ref === calc && attendus[nom].n === j.n;
  verdicts.push({ jeu: nom, n: j.n, md5: calc, ok });
}
console.log(JSON.stringify({ export: nomExport, sha256_export: shaExp, sha256_manifeste: shaMan, verdicts }, null, 1));
if (verdicts.some(v => !v.ok)) { console.error('ARRÊT : md5 ou effectif d\'un jeu ne correspond pas. Aucun SQL produit.'); process.exit(1); }
const out = [];
out.push(`-- Import généré. Vérifié : SHA-256 export ${shaExp}, manifeste ${shaMan}. NOUVEAU lot, ajout seul. À jouer d'un seul bloc.`);
out.push(`do $garde$ declare v text; begin select system_identifier::text into v from pg_control_system(); if v is distinct from '${idAttendu}' then raise exception 'GARDE PROJET TEST : % ≠ ${idAttendu}. Rien n''est écrit.', v; end if; end $garde$;`);
out.push(`create temp table _lot on commit drop as select gen_random_uuid() as lot_id;`);
out.push(`insert into recette_scanner.lots(lot_id, site, export_nom, export_sha256, manifeste_sha256, source_projet, source_identifiant_systeme, lu_le, note) select lot_id, 'vito-sainte-marie', ${q(nomExport)}, ${q(shaExp)}, ${q(shaMan)}, ${q(man.source.projet)}, ${q(man.source.identifiant_systeme)}, ${q(man.source.lu_le)}::timestamptz, 'import recette scanner' from _lot;`);
for (const nom of noms) {
  const j = jeux[nom], cols = j.colonnes;
  out.push(`insert into recette_scanner.jeux(lot_id, jeu, n, md5_manifeste, lot_import) select lot_id, ${q(nom)}, ${j.n}, ${q(j.md5_base)}, ${q(JSON.stringify(j.lot_import ?? null))}::jsonb from _lot;`);
  const rangs = j.lignes.map((s, i) => { const c = s.split('\t'); return { i: i + 1, s, c }; });
  const par = 500;
  for (let d = 0; d < rangs.length; d += par) {
    const lot = rangs.slice(d, d + par);
    if (nom.startsWith('ventes_')) {
      out.push(`insert into recette_scanner.ventes(lot_id, jeu, ligne, texte, ${cols.join(', ')}) select lot_id, ${q(nom)}, v.ligne, v.texte, ${cols.map((_, k) => 'v.c' + k).join(', ')} from _lot, (values ${lot.map(r => `(${r.i}, ${q(r.s)}, ${cols.map((_, k) => q(r.c[k] ?? '')).join(', ')})`).join(',\n')}) as v(ligne, texte, ${cols.map((_, k) => 'c' + k).join(', ')});`);
    } else {
      const cs = ['categorie', 'libelle', 'pa_net_ht', 'stock_actuel', 'stock_date', 'valeur_stock_ht', 'mouvements'];
      out.push(`insert into recette_scanner.stock_brut(lot_id, numero_ligne, texte, ${cs.join(', ')}) select lot_id, v.ligne, v.texte, ${cs.map((_, k) => 'v.c' + k).join(', ')} from _lot, (values ${lot.map(r => `(${r.i}, ${q(r.s)}, ${cs.map((_, k) => q(r.c[k + 1] ?? '')).join(', ')})`).join(',\n')}) as v(ligne, texte, ${cs.map((_, k) => 'c' + k).join(', ')});`);
    }
  }
}
const dec = exp.declarations || {};
for (const [reg, d] of Object.entries(dec)) (d && d.lignes || []).forEach((r, i) => out.push(`insert into recette_scanner.declarations(lot_id, registre, rang, donnees) select lot_id, ${q(reg)}, ${i + 1}, ${q(JSON.stringify(r))}::jsonb from _lot;`));
fs.writeFileSync(sortie, out.join('\n') + '\n');
console.log('SQL écrit :', sortie, '—', out.length, 'instructions');
