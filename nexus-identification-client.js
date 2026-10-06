// ============================================================================
// À QUEL CLIENT APPARTIENT CETTE FACTURE ? (06/10/2026)
//
// Règle unique, lue par la Boîte de réception ; le worker de l'iMac
// (dossier_watcher.py, _identifier_client) en est la copie Python et
// s'éprouve sur les mêmes cas (test_doublons_identification_20261006.js).
//
// Défauts corrigés : l'ancienne détection prenait le PREMIER numéro à 14
// chiffres du texte — le SIRET de l'émetteur (pied de page BONYC) quand la
// facture n'a pas de « Siret Client » — et le PREMIER contact portant
// l'e-mail : m.dupont@… désigne DUPONT Anaïs ET DUPONT Anaïs divers, d'où une
// facture « divers » classée et envoyée sous le compte principal.
//
// Priorité, du plus sûr au moins sûr ; le premier niveau qui désigne UN
// SEUL compte décide, un niveau qui en désigne plusieurs arrête tout
// (ambigu → « à vérifier », jamais un choix) :
//   1. « Siret Client » imprimé (14 chiffres exacts, ou SIREN 9 chiffres) ;
//   2. raison sociale exacte, accents et ponctuation ignorés, en mots
//      entiers ; un nom contenu dans un nom plus long trouvé au même endroit
//      s'efface (DUPONT Anaïs dans « DUPONT Anaïs divers ») ;
//   3. code client imprimé (DUPA-014) ;
//   4. e-mails imprimés, tous : retenus seulement s'ils désignent un seul
//      compte à eux tous.
// ============================================================================

const NEXUS_REGEX_SIRET_CLIENT = /Siret\s*Client\s*:?\s*(\d[\d ]{7,18}\d)/i;
const NEXUS_REGEX_EMAIL_G = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function nexusNormaliserTexte(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

// Emplacements [début, fin) où la suite de mots `nom` apparaît dans `mots`.
function nexusOccurrences(mots, nom) {
  const n = nom.length, res = [];
  if (!n) return res;
  for (let i = 0; i + n <= mots.length; i++) {
    let k = 0;
    while (k < n && mots[i + k] === nom[k]) k++;
    if (k === n) res.push([i, i + n]);
  }
  return res;
}

const nexusDistincts = ids => [...new Set(ids)];

// clients : [{ id, raison_sociale, code_client, siret }] (actifs du site)
// contacts : [{ client_id, email_principal, email_secondaire }]
function nexusIdentifierClient(texte, clients, contacts) {
  const brut = String(texte || '');
  const mSiret = brut.match(NEXUS_REGEX_SIRET_CLIENT);
  const siret = mSiret ? mSiret[1].replace(/\s/g, '') : null;
  const emails = [...new Set((brut.match(NEXUS_REGEX_EMAIL_G) || []).map(e => e.toLowerCase()))];
  const resultat = (clientId, methode, confiance, motif, extra) => Object.assign({
    clientId, methode, confiance, motif, siret, email: emails[0] || null, candidats: [],
  }, extra || {});
  // Ambigu : aucun compte retenu, la facture part « à vérifier » avec les candidats.
  const ambigu = (niveau, ids) => resultat(null, 'manuel', null, 'AMBIGU_METIER', { niveau, candidats: ids });
  clients = clients || [];

  // 1. Siret Client
  if (siret && (siret.length === 14 || siret.length === 9)) {
    const ids = nexusDistincts(clients.filter(c => {
      const s = String(c.siret || '').replace(/\s/g, '');
      return s && (siret.length === 14 ? s === siret : s.slice(0, 9) === siret);
    }).map(c => c.id));
    if (ids.length === 1) return resultat(ids[0], 'siret', 1, 'SIRET_CLIENT');
    if (ids.length > 1) return ambigu('siret', ids);
  }

  // Les adresses sont retirées avant de chercher noms et codes : « snta@… »
  // ne doit pas valoir la raison sociale SNTA (les e-mails ont leur niveau).
  const mots = nexusNormaliserTexte(brut.replace(NEXUS_REGEX_EMAIL_G, ' ')).split(' ');

  // 2. Raison sociale exacte
  const occ = [];
  for (const c of clients) {
    const nom = nexusNormaliserTexte(c.raison_sociale).split(' ').filter(Boolean);
    for (const [d, f] of nexusOccurrences(mots, nom)) occ.push({ id: c.id, d, f });
  }
  const gardees = occ.filter(o => !occ.some(p => p.id !== o.id && p.d <= o.d && o.f <= p.f && (p.f - p.d) > (o.f - o.d)));
  const idsNom = nexusDistincts(gardees.map(o => o.id));
  if (idsNom.length === 1) return resultat(idsNom[0], 'raison_sociale', 0.95, 'RAISON_SOCIALE');
  if (idsNom.length > 1) return ambigu('raison_sociale', idsNom);

  // 3. Code client
  const idsCode = nexusDistincts(clients.filter(c => c.code_client &&
    nexusOccurrences(mots, nexusNormaliserTexte(c.code_client).split(' ').filter(Boolean)).length).map(c => c.id));
  if (idsCode.length === 1) return resultat(idsCode[0], 'code_client', 0.9, 'CODE_CLIENT');
  if (idsCode.length > 1) return ambigu('code_client', idsCode);

  // 4. E-mails : tous ceux du document, un seul compte à eux tous
  const actifs = new Set(clients.map(c => c.id));
  const parEmail = new Map();
  for (const ct of (contacts || [])) {
    if (!actifs.has(ct.client_id)) continue;
    for (const e of [ct.email_principal, ct.email_secondaire]) {
      if (e && emails.includes(e.toLowerCase())) parEmail.set(ct.client_id, e.toLowerCase());
    }
  }
  const idsEmail = [...parEmail.keys()];
  if (idsEmail.length === 1) return resultat(idsEmail[0], 'email', 0.8, 'EMAIL_UNIQUE', { email: parEmail.get(idsEmail[0]) });
  if (idsEmail.length > 1) return ambigu('email', idsEmail);

  return resultat(null, 'manuel', null, 'AUCUN_INDICE');
}
