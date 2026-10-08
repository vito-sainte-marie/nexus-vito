// Test — 08/10/2026 : modification d'un audit de caisse DÉJÀ VALIDÉ.
// Défaut corrigé : l'enregistrement recalculait ecart_piste / ecart_boutique
// mais jamais ecart_*_valide, que tout NEXUS lit en priorité (« validé,
// sinon brut ») — le nouvel écart était masqué par l'ancien, et la carte
// affichait « corrigé » sans que personne n'ait corrigé.
// Décision de Frédéric (08/10) : « Conserver les écarts d'origine et les
// validations manuelles. » Règle : une validation qui portait sur le calcul
// suit la correction ; une validation saisie à la main est conservée et
// signalée. Fonctions pures + câblage statique dans NEXUS-Verify-v1.html.

const path = require('path');
const fs = require('fs');
const assert = require('assert');
const DIR = __dirname;
require(path.join(DIR, 'nexus-verify-moteur.js'));
const M = globalThis.NexusVerifyMoteur;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

const v = (action, created_at, valeurs) => ({ action, created_at, valeurs });

// ------------------------------------------------------------
// 1) Audit non validé : rien à réaligner, aucun patch.
// ------------------------------------------------------------
{
  const a = { ecart_piste: 1, ecart_boutique: -2, ecart_piste_valide: null, ecart_boutique_valide: null };
  assert.strictEqual(M.auditEstValide(a), false);
  const r = M.reconcilierValidationApresModification(a, { piste: 3, boutique: -1 }, { brutAuValidation: {} });
  assert.deepStrictEqual(r.patch, {});
  assert.deepStrictEqual(r.signalements, []);
  assert.strictEqual(r.caisses.piste.etat, 'non_validee');
  assert.strictEqual(r.caisses.boutique.etat, 'non_validee');
  ok('audit non validé — aucun patch, aucun signalement');
}

// ------------------------------------------------------------
// 2) auditEstValide — n'importe quel marqueur de validation suffit.
// ------------------------------------------------------------
{
  assert.strictEqual(M.auditEstValide({ valide_le_piste: '2026-09-18T15:49:00Z' }), true);
  assert.strictEqual(M.auditEstValide({ valide_le: '2026-09-18T15:49:00Z' }), true);
  assert.strictEqual(M.auditEstValide({ ecart_boutique_valide: 0 }), true, '0 € validé reste une validation');
  assert.strictEqual(M.auditEstValide(null), false);
  ok('auditEstValide — date ou écart validé (0 compris)');
}

// ------------------------------------------------------------
// 3) Validation qui avait accepté le calcul : réalignée sur le recalcul.
// Cas réel du 18/09 Q1 (Production, lecture seule) : piste validée 0,40
// = brut au moment de la validation, modifiée ensuite → 1,90.
// ------------------------------------------------------------
{
  const versions = [
    v('validation_piste', '2026-09-18T15:49:00Z', { ecart_piste: 0.4, ecart_boutique: 1.05, ecart_piste_valide: null, ecart_boutique_valide: null }),
    v('validation_boutique', '2026-09-18T15:49:30Z', { ecart_piste: 0.4, ecart_boutique: 1.05, ecart_piste_valide: 0.4, ecart_boutique_valide: 1.05 }),
    v('modification', '2026-09-18T20:29:00Z', { ecart_piste: 0.4, ecart_boutique: 1.05, ecart_piste_valide: 0.4, ecart_boutique_valide: 1.05 }),
  ];
  const refs = { piste: M.brutAuDerniereValidation(versions, 'piste'), boutique: M.brutAuDerniereValidation(versions, 'boutique') };
  assert.deepStrictEqual(refs, { piste: 0.4, boutique: 1.05 });
  // État courant : la modification du 18/09 20:29 a déjà décalé le brut,
  // la validation est restée figée — c'est précisément l'état divergent.
  const a = { ecart_piste: 1.9, ecart_boutique: 0.55, ecart_piste_valide: 0.4, ecart_boutique_valide: 1.05, valide_le_piste: 'x' };
  const r = M.reconcilierValidationApresModification(a, { piste: 1.9, boutique: 0.55 }, { brutAuValidation: refs });
  assert.deepStrictEqual(r.patch, { ecart_piste_valide: 1.9, ecart_boutique_valide: 0.55 });
  assert.strictEqual(r.caisses.piste.etat, 'realignee');
  assert.strictEqual(r.caisses.boutique.etat, 'realignee');
  assert.deepStrictEqual(r.signalements.map(s => [s.caisse, s.code, s.avant, s.apres]), [
    ['piste', 'validation_realignee', 0.4, 1.9],
    ['boutique', 'validation_realignee', 1.05, 0.55],
  ]);
  ok('validation du calcul (cas 18/09) — réalignée sur le recalcul, signalée');
}

// ------------------------------------------------------------
// 4) Validation manuelle (le manager avait retenu une autre valeur que le
// calcul) : conservée, et signalée quand le recalcul diffère.
// ------------------------------------------------------------
{
  const versions = [v('validation_piste', '2026-09-26T08:00:00Z', { ecart_piste: -0.53, ecart_boutique: 0, ecart_piste_valide: null, ecart_boutique_valide: null })];
  const a = { ecart_piste: -0.53, ecart_boutique: 0, ecart_piste_valide: 0, ecart_boutique_valide: 0 };
  const r = M.reconcilierValidationApresModification(a, { piste: -0.03, boutique: 0 },
    { brutAuValidation: { piste: M.brutAuDerniereValidation(versions, 'piste'), boutique: M.brutAuDerniereValidation(versions, 'boutique') } });
  assert.strictEqual(r.caisses.piste.etat, 'manuelle_conservee');
  assert.strictEqual('ecart_piste_valide' in r.patch, false, 'une validation manuelle n\'est jamais écrasée');
  assert.deepStrictEqual(r.signalements.filter(s => s.caisse === 'piste'), [{ caisse: 'piste', code: 'validation_manuelle_conservee', valide: 0, recalcul: -0.03 }]);
  // Manuelle, mais le recalcul retombe dessus : rien à signaler.
  const r2 = M.reconcilierValidationApresModification(a, { piste: 0, boutique: 0 }, { brutAuValidation: { piste: -0.53, boutique: 0 } });
  assert.strictEqual(r2.signalements.filter(s => s.caisse === 'piste').length, 0);
  ok('validation manuelle — conservée, signalée seulement si le recalcul diffère');
}

// ------------------------------------------------------------
// 5) Repli sans version (audits d'avant le 29/08) : le brut actuel sert de
// référence. Inchangée quand le recalcul ne bouge pas.
// ------------------------------------------------------------
{
  assert.strictEqual(M.brutAuDerniereValidation([], 'piste'), null);
  const a = { ecart_piste: 2, ecart_boutique: -1, ecart_piste_valide: 2, ecart_boutique_valide: -4 };
  const r = M.reconcilierValidationApresModification(a, { piste: 2, boutique: -1.5 }, { brutAuValidation: { piste: null, boutique: null } });
  assert.strictEqual(r.caisses.piste.etat, 'inchangee');
  assert.strictEqual(r.patch.ecart_piste_valide, 2);
  assert.strictEqual(r.caisses.boutique.etat, 'manuelle_conservee', 'sans version : validé ≠ brut actuel → manuel');
  assert.deepStrictEqual(r.signalements.map(s => s.code), ['validation_manuelle_conservee']);
  ok('repli sans version — brut actuel comme référence');
}

// ------------------------------------------------------------
// 6) Restauration plus récente que la dernière validation : référence
// indéterminable (null) → repli sur le brut actuel.
// ------------------------------------------------------------
{
  const versions = [
    v('validation_piste', '2026-09-20T08:00:00Z', { ecart_piste: 5, ecart_piste_valide: null }),
    v('restauration', '2026-09-21T08:00:00Z', { ecart_piste: 7, ecart_piste_valide: 5 }),
  ];
  assert.strictEqual(M.brutAuDerniereValidation(versions, 'piste'), null);
  // Ordre d'arrivée indifférent : le tri se fait par date.
  assert.strictEqual(M.brutAuDerniereValidation([...versions].reverse(), 'piste'), null);
  // Une validation postérieure à la restauration redevient la référence.
  versions.push(v('validation_piste', '2026-09-22T08:00:00Z', { ecart_piste: 6, ecart_piste_valide: 5 }));
  assert.strictEqual(M.brutAuDerniereValidation(versions, 'piste'), 6);
  ok('restauration la plus récente — référence nulle ; validation postérieure — référence retrouvée');
}

// ------------------------------------------------------------
// 7) Validation de l'autre caisse : elle n'a fixé l'écart validé de cette
// caisse que s'il était absent (recopie du brut). Sinon on remonte plus loin.
// ------------------------------------------------------------
{
  const recopie = [v('validation_boutique', '2026-09-25T10:00:00Z', { ecart_piste: 3, ecart_piste_valide: null, ecart_boutique: 1 })];
  assert.strictEqual(M.brutAuDerniereValidation(recopie, 'piste'), 3, 'recopie du brut piste par la validation boutique');
  const dejaValidee = [
    v('validation_piste', '2026-09-25T09:00:00Z', { ecart_piste: 4, ecart_piste_valide: null }),
    v('validation_boutique', '2026-09-25T10:00:00Z', { ecart_piste: 8, ecart_piste_valide: 4, ecart_boutique: 1 }),
  ];
  assert.strictEqual(M.brutAuDerniereValidation(dejaValidee, 'piste'), 4, 'la validation boutique n\'a pas statué sur la piste');
  ok('validation de l\'autre caisse — recopie reconnue, sinon ignorée');
}

// ------------------------------------------------------------
// 8) Modifications successives : chaque modification réaligne à partir de
// l'état précédent, sans jamais toucher aux champs _origine ni valide_le.
// ------------------------------------------------------------
{
  let a = { ecart_piste: -20, ecart_boutique: 0, ecart_piste_valide: -20, ecart_boutique_valide: 0, ecart_piste_origine: -20, ecart_boutique_origine: 0, valide_le_piste: 't0' };
  const versions = [v('validation_piste', '2026-10-01T08:00:00Z', { ecart_piste: -20, ecart_boutique: 0, ecart_piste_valide: null, ecart_boutique_valide: null })];
  for (const [i, brut] of [-12, -8, -8].entries()) {
    const refs = { piste: M.brutAuDerniereValidation(versions, 'piste'), boutique: M.brutAuDerniereValidation(versions, 'boutique') };
    const r = M.reconcilierValidationApresModification(a, { piste: brut, boutique: 0 }, { brutAuValidation: refs });
    for (const k of Object.keys(r.patch)) assert.ok(/^ecart_(piste|boutique)_valide$/.test(k), `patch limité aux écarts validés (${k})`);
    versions.push(v('modification', `2026-10-0${2 + i}T08:00:00Z`, { ...a }));
    a = { ...a, ecart_piste: brut, ...r.patch };
  }
  assert.strictEqual(a.ecart_piste_valide, -8);
  assert.strictEqual(a.ecart_piste_origine, -20, 'l\'écart d\'origine est conservé');
  assert.strictEqual(a.valide_le_piste, 't0');
  ok('modifications successives — −20 → −12 → −8, origine −20 conservée');
}

// ------------------------------------------------------------
// 9) Centimes : un flottant 0,1 + 0,2 n'est pas une validation manuelle.
// ------------------------------------------------------------
{
  const a = { ecart_piste: 0.30, ecart_boutique: 0, ecart_piste_valide: 0.1 + 0.2, ecart_boutique_valide: 0 };
  const r = M.reconcilierValidationApresModification(a, { piste: 0.5, boutique: 0 }, { brutAuValidation: { piste: 0.3, boutique: 0 } });
  assert.strictEqual(r.caisses.piste.etat, 'realignee');
  ok('comparaison au centime — pas de faux manuel');
}

// ------------------------------------------------------------
// 10) Libellés, montants signés, échappement HTML.
// ------------------------------------------------------------
{
  assert.strictEqual(M.formatEuroSigne(1.9), '+1,90 €');
  assert.strictEqual(M.formatEuroSigne(-0.03), '-0,03 €');
  assert.ok(M.libelleSignalementValidation({ caisse: 'piste', code: 'validation_realignee', avant: 0.4, apres: 1.9 }).includes('+0,40 € → +1,90 €'));
  assert.ok(M.libelleSignalementValidation({ caisse: 'boutique', code: 'validation_manuelle_conservee', valide: 3.1, recalcul: 0.68 }).includes('conservée à +3,10 €'));
  assert.strictEqual(M.echapperHtml(`<img src=x onerror="a('b')">&`), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
  assert.strictEqual(M.echapperHtml(null), '');
  ok('libellés et échappement HTML');
}

// ------------------------------------------------------------
// 11) mentionsEcartCarte — plus de « corrigé » déduit d'un validé figé.
// ------------------------------------------------------------
{
  // Réaligné : validé = brut → aucune mention « retenu par le manager ».
  const m1 = M.mentionsEcartCarte({ ecart_piste: 1.9, ecart_piste_valide: 1.9, ecart_piste_origine: 0.4 }, 'piste');
  assert.deepStrictEqual(m1, { effectif: 1.9, retenuManuellement: false, ecartCalcule: null, constatInitial: 0.4 });
  // Manuel : l'écart calculé est montré à côté de l'écart retenu.
  const m2 = M.mentionsEcartCarte({ ecart_boutique: 0.68, ecart_boutique_valide: 3.1, ecart_boutique_origine: 0.68 }, 'boutique');
  assert.deepStrictEqual(m2, { effectif: 3.1, retenuManuellement: true, ecartCalcule: 0.68, constatInitial: null });
  // Constat initial égal à l'écart retenu : pas de mention redondante.
  const m4 = M.mentionsEcartCarte({ ecart_boutique: 0.68, ecart_boutique_valide: 3.1, ecart_boutique_origine: 3.1 }, 'boutique');
  assert.strictEqual(m4.constatInitial, null);
  assert.strictEqual(m4.ecartCalcule, 0.68);
  // Non validé, jamais modifié : rien.
  const m3 = M.mentionsEcartCarte({ ecart_piste: -2, ecart_piste_valide: null, ecart_piste_origine: -2 }, 'piste');
  assert.deepStrictEqual(m3, { effectif: -2, retenuManuellement: false, ecartCalcule: null, constatInitial: null });
  ok('mentionsEcartCarte — calculé si retenu à la main, constat initial si modifié');
}

// ------------------------------------------------------------
// 12) diffEcartsVersion — avant/après de la timeline, au centime.
// ------------------------------------------------------------
{
  const d = M.diffEcartsVersion(
    { ecart_piste: 0.4, ecart_boutique: 1.05, ecart_piste_valide: 0.4, ecart_boutique_valide: 1.05 },
    { ecart_piste: 1.9, ecart_boutique: 1.05, ecart_piste_valide: 1.9, ecart_boutique_valide: 0.1 + 0.95 });
  assert.deepStrictEqual(d.map(x => [x.champ, x.avant, x.apres]), [['ecart_piste', 0.4, 1.9], ['ecart_piste_valide', 0.4, 1.9]]);
  assert.deepStrictEqual(M.diffEcartsVersion(null, {}), []);
  const d2 = M.diffEcartsVersion({ ecart_piste_valide: null }, { ecart_piste_valide: 0 });
  assert.deepStrictEqual(d2.map(x => [x.champ, x.avant, x.apres]), [['ecart_piste_valide', null, 0]]);
  ok('diffEcartsVersion — seuls les écarts changés, null ≠ 0');
}

// ------------------------------------------------------------
// 13) Câblage dans NEXUS-Verify-v1.html — prouver la fonction ne prouve pas
// le câblage : le patch doit atteindre l'upsert, le motif la version.
// ------------------------------------------------------------
{
  const html = fs.readFileSync(path.join(DIR, 'NEXUS-Verify-v1.html'), 'utf8');
  const iRec = html.indexOf('NexusVerifyMoteur.reconcilierValidationApresModification(');
  const iSnap = html.indexOf("snapshotAuditAvantEcriture(auditExistant, 'modification', motifModification)");
  const iPatch = html.indexOf('...reconciliation.patch,');
  const iUpsert = html.lastIndexOf(".from('audits_caisse')", iPatch);
  assert.ok(iRec > 0, 'réconciliation appelée à l\'enregistrement');
  assert.ok(iSnap > iRec, 'la version « modification » porte le motif, après la réconciliation');
  assert.ok(iPatch > iSnap, 'le patch est étalé dans l\'écriture de l\'audit');
  assert.ok(iUpsert > iSnap && /\.upsert\(/.test(html.slice(iUpsert, iPatch)), 'le patch est dans l\'upsert de audits_caisse');
  assert.ok(/brutAuDerniereValidation\(versionsAudit, 'piste'\)/.test(html) && /brutAuDerniereValidation\(versionsAudit, 'boutique'\)/.test(html));
  assert.ok(/if \(motifModification === null \|\| !motifModification\.trim\(\)\) \{[\s\S]{0,400}?return;/.test(html), 'motif vide → rien n\'est enregistré');
  assert.ok(/if \(eVersions\) \{[\s\S]{0,500}?return;/.test(html), 'historique illisible → rien n\'est enregistré');
  assert.ok(!/corrigePiste|corrigeBoutique/.test(html), 'l\'ancienne déduction « corrigé » a disparu');
  assert.ok(/mentionsEcartCarte\(a, type\)/.test(html) && /diffEcartsVersion\(v\.valeurs/.test(html));
  assert.ok(/echapperHtml\(v\.motif\)/.test(html), 'le motif saisi est échappé dans la timeline');
  ok('câblage Verify — patch dans l\'upsert, motif exigé et versionné, carte et timeline');
}

console.log(`\n${n} blocs OK — test_verify_modification_audit_valide_20261008`);
