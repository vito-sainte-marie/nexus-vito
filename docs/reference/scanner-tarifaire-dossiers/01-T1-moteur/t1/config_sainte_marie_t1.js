// Paramètres de Sainte-Marie pour le passage T1, repris des arbitrages du gérant du 16/11/2026.
// En T1 ils sont fournis au moteur par ce fichier ; en T2 ils viendront des registres versionnés (non créés).
const RAYONS = ['Bières, Cidres et Panachés', 'Bières Stouts', 'Jus de fruits et légumes', 'Sodas, toniques', 'Boissons Energétiques',
  'Eaux non aromatisées', 'Glaces et crèmes glacées', 'Pains - Patisseries fraiches', 'Confiserie', 'Kits et Packs', 'PUFFS',
  "Biscuiterie - Pains d'épices - Patisserie Industrielle", 'Huile Moteur', 'Feuilles à rouler - Filtres - Tubes', 'Glacons',
  'Eaux Aromatisées', 'Chips - Biscuits et Petits Salés'];
// Statut des seuils (examen du gérant du 16/11/2026) : « valide » pour les objectifs arrêtés (sodas 2 L, confiserie, vapotage) ;
// « indicatif » pour les seuils dits indicatifs ou proposés, qui ne produisent aucune proposition décisionnelle.
const V = 'valide', I = 'indicatif';
const seuil = (minimum, cible, sMin, sCib) => ({ minimum, cible, statutMinimum: sMin, statutCible: sCib });

const contexte = {
  periode: { debut: '2026-10-05', fin: '2026-11-09' }, jours: 36,
  stockSource: 'valorisation du stock Decenium du 10/11/2026, colonne « PA net HT »',
  familles: {
    parRayon: { 'Bières, Cidres et Panachés': 'Bières', 'Bières Stouts': 'Bières', 'Jus de fruits et légumes': 'Jus', 'Eaux non aromatisées': 'Eaux non aromatisées',
      'Pains - Patisseries fraiches': 'Pains', 'Confiserie': 'Confiserie', 'Kits et Packs': 'Vapotage', 'PUFFS': 'Vapotage',
      "Biscuiterie - Pains d'épices - Patisserie Industrielle": 'Biscuiterie', 'Feuilles à rouler - Filtres - Tubes': 'Feuilles à rouler',
      'Glacons': 'Glaçons', 'Eaux Aromatisées': 'Eaux aromatisées', 'Chips - Biscuits et Petits Salés': 'Chips et petits salés' },
    parMotif: [
      { rayon: 'Boissons Energétiques', motif: 'aloe', famille: "Boissons à l'aloe vera", note: 'hors énergétiques (arbitrage), catégorie Decenium inchangée' },
      { rayon: 'Boissons Energétiques', motif: 'vitamalt', famille: 'Boissons maltées', note: 'hors énergétiques (arbitrage), catégorie Decenium inchangée' },
      { rayon: 'Boissons Energétiques', motif: '.', famille: 'Énergétiques' },
      { rayon: 'Sodas, toniques', motif: '\\b2\\s?l\\b', famille: 'Sodas 2 L' },
      { rayon: 'Sodas, toniques', motif: '.', famille: 'Sodas autres formats' },
      { rayon: 'Glaces et crèmes glacées', motif: '^glace floup -20p', famille: 'Floup classique' },
      { rayon: 'Glaces et crèmes glacées', motif: 'floup', famille: 'Autres Floups' },
      { rayon: 'Glaces et crèmes glacées', motif: '.', famille: 'Glaces hors Floups' },
      { rayon: 'Huile Moteur', motif: 'nautilus|fuchs', famille: 'Huiles hors Shell', note: 'exception à la déclaration « Shell exclusivement », non reclassée' },
      { rayon: 'Huile Moteur', motif: '\\b5\\s?l\\b', famille: 'Huiles Shell 5 L' },
      { rayon: 'Huile Moteur', motif: '\\b2\\s?l\\b', famille: 'Huiles Shell 2 L' },
      { rayon: 'Huile Moteur', motif: '.', famille: 'Huiles Shell 1 L' },
      { rayon: 'Confiserie', motif: 'durmint - 134p|dr tom - 237p', famille: "Menthes à l'unité" },
    ],
  },
  seuils: {
    'Bières': seuil(0.47, 0.50, I, I), 'Jus': seuil(0.41, 0.49, I, 'a_l_etude'), 'Sodas 2 L': seuil(0.41, 0.42, V, V),
    'Sodas autres formats': seuil(0.39, 0.48, 'hypothese', 'hypothese'), 'Énergétiques': seuil(0.47, 0.48, I, I),
    'Eaux non aromatisées': seuil(0.46, 0.51, I, I), 'Glaces hors Floups': seuil(0.40, 0.42, 'a_l_etude', 'a_l_etude'),
    'Confiserie': seuil(null, 0.50, null, V), 'Feuilles à rouler': seuil(0.47, 0.51, I, I), 'Biscuiterie': seuil(0.37, 0.41, I, I),
    'Eaux aromatisées': seuil(0.47, 0.51, I, I), 'Chips et petits salés': seuil(0.41, 0.45, I, I), 'Vapotage': seuil(0.50, null, V, null),
  },
  exceptions: [
    { article: 'Glace floup -20P', statut: 'validee', type: 'produit_appel', motif: "Floup classique à 0,95 € TTC, prix d'appel", conditions: { prix_ttc: 0.95 } },
    { article: 'MENTHE BLEUE DURMINT - 134P', statut: 'validee', type: 'produit_appel', motif: "menthe à l'unité" },
    { article: 'MENTHE VERTE DR TOM - 237P', statut: 'validee', type: 'produit_appel', motif: "menthe à l'unité" },
    { code_barres: '8712000900014', statut: 'validee', type: 'pack', motif: 'pack Heineken' },
    { code_barres: '8712000018948', statut: 'validee', type: 'pack', motif: 'pack Heineken' },
    { code_barres: '3330901751129', statut: 'validee', type: 'pack', motif: 'pack Lorraine' },
    { code_barres: '3289090001938', statut: 'validee', type: 'pack', motif: 'pack Chanflor 1,5 L × 6' },
    { code_barres: '8714800004114', statut: 'validee', type: 'produit_appel', motif: 'Bavaria Blonde, enregistrée le 29/07/2026' },
    { article: 'Glacons Vito 5 kg', statut: 'validee', type: 'concurrence_directe', motif: 'sac de 5 kg à 4,00 € TTC', conditions: { prix_ttc: 4.00 } },
    { article: 'Biere GUINNESS 27.5 CL - 24P', statut: 'validee', type: 'produit_appel', motif: 'enregistré le 29/07/2026' },
    { article: 'Bonbon Menthise 250G - 29P', statut: 'candidate', motif: "à confirmer : conditionnement et vente réelle à l'unité" },
    { code_barres: '543860131458', statut: 'candidate', motif: 'à confirmer : prix, coût et politique du pack' },
    { code_barres: '69861498510', statut: 'refusee', motif: "pack Guinness : pas d'exception validée" },
  ],
  prixDecides: [
    ...['Sprite 2l - 6P', 'Royal soda 2l ananas -6P', 'Royal soda 2L Anis -6P', 'Royal soda 2l banane -6P', 'Royal soda 2l citron -6P', 'Royal soda 2l grenadine -6P', 'Royal soda 2l kampane - 6P']
      .map(article => ({ article, prix_ttc: 4.80, nature: 'changement', decide_le: '2026-11-16' })),
    ...['Orangina 2l -6P', 'Amigo Orange 2L -6P'].map(article => ({ article, prix_ttc: 5.90, nature: 'changement', decide_le: '2026-11-16' })),
    ...['Monster Can Standard 50cl - 12P', 'Boisson Monster Viking Berry 50 cl -12P', 'Boisson Monster Energy Punch 50 cl -12P', 'Boisson Monster PIPELINE Punch 50cl - 12P',
      'Boisson Monster LNORRIS SSUCR 50 cl -12P', 'Boisson Monster MONARCH 50cl - 12P', 'Boisson Monster Mango Loco 50cl - 12P']
      .map(article => ({ article, prix_ttc: 4.20, nature: 'changement', decide_le: '2026-11-16' })),
    { article: 'Coca cola 2l -6P', prix_ttc: null, nature: 'maintenu' },
    { article: 'Glace floup -20P', prix_ttc: 0.95, nature: 'en_vigueur' },
    { article: 'Glace floup fruisson -20P', prix_ttc: 1.25, nature: 'en_vigueur' },
    { article: 'Glace floup berlingot supercoco -20P', prix_ttc: 1.25, nature: 'en_vigueur' },
    { article: 'Glacons Vito 5 kg', prix_ttc: 4.00, nature: 'en_vigueur' },
  ],
  // FINE LEAF : régime de prix non présumé (ni libre ni réglementé) et vérifications réglementaire et fiscale ouvertes.
  regimes: [{ article: 'Feuille de Tabac FINE LEAF 15g - 15P', regime: 'a_qualifier', raison: 'produit du tabac, régime de prix non établi' }],
  reglementaire: [
    { article: 'Feuille de Tabac FINE LEAF 15g - 15P', etat: 'controle_ouvert', type_element: 'feuille de tabac', raison: 'régime de prix et réglementation du tabac à qualifier ; TVA importée à 0 % à vérifier' },
    { rayon: 'Kits et Packs', etat: 'controle_ouvert', raison: 'CSP art. L3513-5-1 et L3513-15 : fiche technique du modèle exact à obtenir' },
    { rayon: 'PUFFS', etat: 'controle_ouvert', raison: 'CSP art. L3513-5-1 et L3513-15 : fiche technique du modèle exact à obtenir' },
  ],
  tva: {
    confirmations: [],
    explications: [
      { rayon: 'Huile Moteur', taux: 0, raison: 'exonération possible des produits pétroliers (CGI art. 295, 1, 6°), à confirmer' },
      { rayon: 'Chips - Biscuits et Petits Salés', motif: 'lays|pringles|brets|vico', taux: 0, raison: 'chips de pomme de terre exonérées (annexe IV CGI art. 50 duodecies, IV), à confirmer' },
      { rayon: 'Pains - Patisseries fraiches', motif: 'baguette', taux: 0, raison: 'pain exonéré (annexe IV CGI art. 50 duodecies, II), à confirmer' },
      { rayon: "Biscuiterie - Pains d'épices - Patisserie Industrielle", motif: 'figolu|granola cookies', taux: 0, raison: 'biscuit sucré possiblement exonéré (19 05 31 99), composition à vérifier' },
    ],
  },
  // Justifications enregistrées dans NEXUS (produits_justifications_marge, 16/11/2026), période du 05/10 au 09/11/2026.
  justifications: [{ article: 'Sachet Menthe Bleue DURMINT 100g - 12P', motif: 'emballage_deteriore' },
    { article: '07-10-2026 HARIBO CARENSAC 120g -P30', motif: 'dlc' }, { article: '02-10-2026 Barre Mars Coeur Fondant 50.4g- 40P', motif: 'dlc' }],
  motifsDivergents: [{ article: 'Sachet Menthe Bleue DURMINT 100g - 12P', motif_declare: 'périmé', motif_enregistre: 'emballage détérioré' }],
  natureDe: r => ['07-10-2026 HARIBO CARENSAC 120g -P30', '02-10-2026 Barre Mars Coeur Fondant 50.4g- 40P', 'Sachet Menthe Bleue DURMINT 100g - 12P'].includes(r.article) ? 'sortie_perimes_casse' : null,
};
module.exports = { RAYONS, contexte };
