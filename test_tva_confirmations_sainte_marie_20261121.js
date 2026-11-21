// Confirmations de TVA des 62 références « TVA à vérifier » de Sainte-Marie (décisions du pilote du 21/11/2026).
// Vérifie le fichier de données, le script SQL (RAPPORT / APPLIQUER, append-only, sans identifiant en dur),
// l'effet d'une confirmation à 8,5 % sur le contrôle BUZZ Vodka, et le libellé sans « le » orphelin.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const M = require('./nexus-produits-mesure.js');
let n = 0;
function ok(c, m) { assert.ok(c, m); n++; }

const dir = path.join(__dirname, 'outils', 'tva');
const rows = JSON.parse(fs.readFileSync(path.join(dir, 'confirmations_sainte_marie_20261121.json'), 'utf8'));
const sql = fs.readFileSync(path.join(dir, 'confirmations_sainte_marie_20261121.sql'), 'utf8');
const epreuve = fs.readFileSync(path.join(dir, 'epreuve_confirmations_20261121.sql'), 'utf8');

// Données
ok(rows.length === 62, '62 lignes');
ok(rows.filter(r => r.taux === 8.5).length === 4, '4 lignes à 8,5 %');
ok(rows.filter(r => r.taux === 0).length === 58, '58 lignes à 0 %');
ok(rows.every(r => r.taux === 0 || r.taux === 8.5), 'taux 0 ou 8,5 seulement');
const norm = s => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
const cle = r => (r.code_barres && String(r.code_barres).trim()) ? 'cb:' + String(r.code_barres).trim() : 'nom:' + norm(r.article);
ok(new Set(rows.map(cle)).size === 62, 'aucune cible en double');
ok(rows.every(r => typeof r.article === 'string' && r.article.trim().length > 0), 'article renseigné');
ok(rows.every(r => typeof r.code_barres === 'string'), 'code_barres texte (vide permis)');
ok(rows.every(r => r.commentaire && r.commentaire.startsWith('Décision du pilote du 21/11/2026')), 'commentaire repris tel quel');
const a85 = rows.filter(r => r.taux === 8.5).map(r => r.code_barres).sort();
['42214465', '5010891012063', '54012707', '762571305006'].forEach(cb => ok(a85.includes(cb), 'à 8,5 % : ' + cb));

// Le SQL embarque exactement les mêmes lignes
const m = sql.match(/\$json\$([\s\S]*?)\$json\$/);
ok(m, 'bloc JSON dans le SQL');
const dansSql = JSON.parse(m[1]);
ok(dansSql.length === 62, '62 lignes dans le SQL');
assert.deepStrictEqual(
  dansSql.map(r => [r.article, r.code_barres, r.taux, r.commentaire]),
  rows.map(r => [r.article, r.code_barres, r.taux, r.commentaire]),
  'SQL identique au fichier de données');
n++;

// Script SQL : sans UPDATE ni DELETE de données, sans identifiant en dur, deux modes
const code = sql.split('\n').filter(l => !/^\s*--/.test(l)).join('\n').replace(/\$json\$[\s\S]*?\$json\$/, '');
ok(!/\bupdate\b\s+\w+\s+set\b/i.test(code), 'aucun UPDATE de données');
ok(!/\bdelete\s+from\b/i.test(code), 'aucun DELETE');
ok(!/\btruncate\b|\bdrop\s+(schema|function|policy|column|view|index)\b/i.test(code), 'aucun TRUNCATE ni DROP');
ok(!/\bdrop\s+table\b/i.test(code), 'aucun DROP TABLE');
ok(!/\bcreate\s+(temp\s+|temporary\s+|unlogged\s+)?table\b/i.test(code), 'aucun create table (RAPPORT passe sous begin transaction read only)');
ok(!/\b(create|alter)\s+(or\s+replace\s+)?(function|procedure|view|index|schema|extension)\b/i.test(code), 'aucun DDL : ni fonction, ni vue, ni index');
ok(!/\bselect\b[^;]*\binto\s+(temp|temporary|unlogged)?\s*table\b/i.test(code), 'aucun select into table');
ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(code), 'aucun uuid en dur');
ok(/set_config\('tva\.mode', 'RAPPORT', false\)/.test(code), 'mode : RAPPORT par défaut');
ok(/set_config\('tva\.site', 'vito-sainte-marie', false\)/.test(sql), 'site vito-sainte-marie');
ok(/set_config\('tva\.compte_test', 'false', false\)/.test(sql), 'créateur hors compte test');
ok(/set_config\('tva\.attendu', '62', false\)/.test(sql), 'nombre de cibles attendu : 62');
ok(/set_config\('tva\.donnees', \$json\$/.test(sql), 'données passées par set_config');
ok(/\bdo \$tva\$/.test(code), 'corps = un bloc DO');
ok(code.includes("'RAPPORT'") && code.includes("'APPLIQUER'"), 'deux modes');
ok(code.includes("raise exception 'RAPPORT_TVA"), 'RAPPORT se termine par une exception RAPPORT_TVA');
ok(/est_createur/.test(code) && /v_nb_pilote <> 1/.test(code) && /compte_test = p_compte_test/.test(code), 'confirme_par trouvé par requête, exactement un');
ok(/remplace_id/.test(code) && /annule_le is null/.test(code), 'chaîne remplace_id et actives');
ok(/insert into produits_tva_confirmations/.test(code), 'insertion dans produits_tva_confirmations');
ok(/CIBLES_ABSENTES_DE_PRODUCTS/.test(code), 'refus si cible absente de products');
ok(/count\(\*\) filter \(where x\.actif_id is null and x\.dans_catalogue\),/.test(code), 'a_inserer exclut les cibles absentes de products (APPLIQUER les refuse)');
ok(!/count\(\*\) filter \(where x\.actif_id is null\),/.test(code), 'a_inserer : plus de comptage sans condition de catalogue');
ok(/cibles=5, a_inserer=2, a_remplacer=1, deja_conformes=1, cibles_absentes_de_products=1/.test(epreuve), 'épreuve E1 : la cible absente n est pas comptée à insérer');
ok(!/vito-sainte-marie.*(prenom|nom propre)/i.test(code), 'aucun nom de personne');

// Corps identique entre Production et épreuve Test
const corps = t => { const a = t.indexOf('-- DEBUT_FONCTION_PARTAGEE'), b = t.indexOf('-- FIN_FONCTION_PARTAGEE'); ok(a >= 0 && b > a, 'marqueurs de fonction partagée'); return t.slice(a, b); };
const cp = corps(sql), ce = corps(epreuve);
ok(cp.length > 2000 && cp === ce, 'corps de la fonction identique octet pour octet : Production = épreuve');
ok(/^declare/m.test(cp) && !/\bcreate\b/i.test(cp.split('\n').filter(l => !/^\s*--/.test(l)).join('\n')), 'corps partagé : bloc DO sans aucun create');
ok(!/\$corps\$|\$tva\$/.test(cp), 'corps sans délimiteur de dollar');
const codeEp = epreuve.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
ok(/raise exception 'RAPPORT_EPREUVE_TVA/.test(codeEp), 'épreuve terminée par RAPPORT_EPREUVE_TVA');
ok(/7678069749886157684/.test(codeEp) && /garde_projet_test/.test(codeEp), 'garde projet Test');
ok(!/\bdelete\s+from\b|\btruncate\b/i.test(codeEp.replace(cp, '')), 'épreuve : ni DELETE ni TRUNCATE');
ok(/transaction_read_only/.test(codeEp) && /E13 RAPPORT en lecture seule/.test(codeEp), 'épreuve : RAPPORT rejoué en lecture seule');
ok(/execute 'do \$tva\$'/.test(codeEp), 'épreuve : exécute le corps comme bloc DO');
ok(!/\bupdate\s+(public\.)?\w+\s+set\b/i.test(codeEp), 'épreuve : aucun UPDATE');
ok(!/vito-sainte-marie/.test(codeEp), 'épreuve : jamais le site de Production');
ok(/'site-fantome-test'/.test(codeEp), 'épreuve : site d essai');
['E1','E2','E3','E4','E5','E6','E7','E8','E9','E10','E11','E12','E13'].forEach(e => ok(new RegExp("'" + e + ' ').test(codeEp), 'cas ' + e));

// BUZZ Vodka : une confirmation à 8,5 % lève le contrôle « TVA différente sur la période précédente »
const conf = { taux_confirme: 8.5, confirme_le: '2026-11-21T10:00:00Z' };
const sans = M.etatTva(8.5, 0, false, null, '2026-11-15');
ok(sans.etat === 'incoherente' && /période précédente/.test(sans.raison), 'sans confirmation : période précédente');
const avec = M.etatTva(8.5, 0, false, conf, '2026-11-15');
ok(avec.etat === 'confirmee' && avec.taux === 8.5, 'avec confirmation à 8,5 % : confirmée');
ok(!/période précédente/.test(avec.raison), 'la raison ne parle plus de la période précédente');
const apres = M.etatTva(8.5, 0, false, conf, '2026-12-01');
ok(apres.etat === 'confirmee', 'import ultérieur au même taux : confirmée');
ok(M.etatTva(0, 0, false, conf, '2026-12-01').etat === 'incoherente', 'import ultérieur à un autre taux : incohérente');

// Libellé : jamais de « le » orphelin
const bouts = [
  M.etatTva(0, null, false, { taux_confirme: 0 }, null),
  M.etatTva(0, null, false, { taux_confirme: 0, confirme_le: null }, null),
  M.etatTva(0, null, false, { taux_confirme: 0, confirme_le: 'pas une date' }, null),
  M.etatTva(5, null, false, { taux_confirme: 0, confirme_le: '' }, '2026-12-01'),
  M.etatTva(5, null, false, { taux_confirme: 0 }, null)
];
bouts.forEach(r => { ok(!/\ble\s*$/.test(r.raison), 'pas de « le » en fin : ' + r.raison); ok(!/ le ·/.test(r.raison), 'pas de « le » avant « · » : ' + r.raison); });
ok(bouts[0].raison === 'TVA confirmée à 0 %', 'sans date : « TVA confirmée à 0 % »');
const datee = M.etatTva(0, null, false, { taux_confirme: 0, confirme_le: '2026-11-21T09:30:00Z' }, null);
ok(datee.raison === 'TVA confirmée à 0 % le 21/11/2026', 'avec date : « le 21/11/2026 »');

console.log('test_tva_confirmations_sainte_marie_20261121 : ' + n + ' vérifications OK');
