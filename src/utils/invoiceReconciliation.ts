import { Wine, Domain } from '../../types';
import { getSmartCoefficient } from '../../utils';

export interface ParsedInvoiceItem {
  id: string; // temporary client uuid
  rawText: string;
  domainName: string;
  wineName: string;
  vintage: string;
  format: string;
  color: string;
  quantity: number;
  unitPriceHT: number;
  vatRate: number;
  totalHT: number;
  
  // Reconciliation state
  action: 'match_existing' | 'create_new_vintage' | 'create_new_wine' | 'ignore';
  matchedWineId?: string;
  selectedDomainId?: string;
  confidenceScore: number; // 0 to 100
  matchType: 'exact' | 'suggested' | 'vintage_variant' | 'new';
  warningMessage?: string;
  
  // Editable fields for creating a new reference
  customWineName?: string;
  customVintage?: string;
  customFormat?: string;
  customColor?: string;
  customRegion?: string;
  customSubRegion?: string;
  customBuyingPriceHT?: number;
  customSellingPriceHT?: number;
  customCoefficient?: number;
}

export interface ParsedInvoiceData {
  provider: string;
  invoiceNumber: string;
  invoiceDate: string;
  shippingCostHT: number;
  totalHT?: number;
  totalTTC?: number;
  items: ParsedInvoiceItem[];
}

/**
 * Nettoie une chaîne de caractères pour comparaison textuelle
 */
export function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .toLowerCase()
    .replace(/['’\-_\/\\.,;:!?()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Supprime les mots de bruit viticole courants
 */
const NOISE_WORDS = new Set([
  'domaine', 'chateau', 'château', 'maison', 'sarl', 'sas', 'vignobles', 
  'famille', 'les', 'des', 'du', 'de', 'la', 'le', 'et', 'fils', 'pere', 
  'cuvee', 'cuvée', 'aoc', 'aop', 'igp', 'vin', 'vins', 'france', 'grand', 'cru', 'bio'
]);

export function cleanWineTokens(str: string): string[] {
  const normalized = normalizeString(str);
  return normalized
    .split(' ')
    .filter(token => token.length > 1 && !NOISE_WORDS.has(token));
}

/**
 * Calcule la distance de Levenshtein entre deux chaînes
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  
  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[bn][an];
}

/**
 * Score de similarité entre 0 et 1
 */
export function similarityScore(a: string, b: string): number {
  const s1 = normalizeString(a);
  const s2 = normalizeString(b);
  if (!s1 && !s2) return 1;
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return 0.8 + (0.2 * (minLen / maxLen));
  }

  const tokens1 = cleanWineTokens(s1);
  const tokens2 = cleanWineTokens(s2);
  
  // Jaccard similarity sur les tokens signifiants
  if (tokens1.length > 0 && tokens2.length > 0) {
    const set2 = new Set(tokens2);
    const intersection = tokens1.filter(t => set2.has(t) || tokens2.some(t2 => t2.includes(t) || t.includes(t2)));
    const union = new Set([...tokens1, ...tokens2]);
    const jaccard = intersection.length / union.size;
    if (jaccard > 0.4) {
      return jaccard;
    }
  }

  const maxLen = Math.max(s1.length, s2.length);
  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, 1 - (dist / maxLen));
}

/**
 * Normalise le millésime pour comparaison
 */
export function normalizeVintage(v: string | number | undefined | null): string {
  if (!v) return '';
  const str = String(v).trim();
  const match = str.match(/\b(19\d\d|20\d\d)\b/);
  if (match) return match[1];
  if (['nv', 'sa', 'sans millesime', 'non millesime', 'brut'].includes(normalizeString(str))) {
    return 'NV';
  }
  return str;
}

/**
 * Moteur de réconciliation intelligente d'une ligne de facture avec le catalogue existant
 */
export function reconcileInvoiceItem(
  item: {
    rawText: string;
    domainName: string;
    wineName: string;
    vintage: string;
    format: string;
    color: string;
    quantity: number;
    unitPriceHT: number;
    vatRate: number;
    totalHT?: number;
  },
  wines: Wine[],
  domains: Domain[]
): ParsedInvoiceItem {
  const cleanDomain = normalizeString(item.domainName);
  const cleanWine = normalizeString(item.wineName);
  const cleanItemVintage = normalizeVintage(item.vintage);

  // 1. Trouver le meilleur domaine correspondant
  let bestDomain: Domain | undefined;
  let bestDomainScore = 0;

  for (const d of domains) {
    const dScore = similarityScore(d.name, item.domainName);
    if (dScore > bestDomainScore) {
      bestDomainScore = dScore;
      bestDomain = d;
    }
  }

  // 2. Chercher parmi tous les vins du catalogue
  let bestWine: Wine | undefined;
  let highestScore = 0;
  let bestMatchType: 'exact' | 'suggested' | 'vintage_variant' | 'new' = 'new';
  let warningMessage: string | undefined;

  for (const wine of wines) {
    const wineDomain = domains.find(d => d.id === wine.domainId);
    const domainScore = wineDomain ? similarityScore(wineDomain.name, item.domainName) : 0;
    const nameScore = similarityScore(wine.name, item.wineName);
    const wineVintage = normalizeVintage(wine.vintage);
    const vintageMatch = cleanItemVintage && wineVintage && cleanItemVintage === wineVintage;

    // Score combiné
    // Si le domaine matche bien (> 0.6) et le nom matche bien (> 0.6)
    let totalScore = (domainScore * 0.45) + (nameScore * 0.45);

    if (domainScore > 0.5 && nameScore > 0.6) {
      if (vintageMatch) {
        totalScore += 0.15; // Bonus match exact millésime
      } else if (cleanItemVintage && wineVintage && cleanItemVintage !== wineVintage) {
        // Même domaine et même cuvée, mais millésime différent
        totalScore = Math.min(totalScore, 0.75); // Cap score à 75%
      }
    }

    if (totalScore > highestScore) {
      highestScore = totalScore;
      bestWine = wine;

      if (totalScore >= 0.82 && vintageMatch) {
        bestMatchType = 'exact';
        warningMessage = undefined;
      } else if (domainScore >= 0.6 && nameScore >= 0.65 && !vintageMatch) {
        bestMatchType = 'vintage_variant';
        warningMessage = `Même cuvée trouvée au catalogue en millésime ${wine.vintage || 'NV'} (facture: ${item.vintage || 'Sans millésime'}).`;
      } else if (totalScore >= 0.55) {
        bestMatchType = 'suggested';
        warningMessage = `Correspondance probable avec ${wineDomain?.name || ''} - ${wine.name} (${wine.vintage || 'NV'}).`;
      }
    }
  }

  const confidenceScore = Math.round(highestScore * 100);

  // Déterminer l'action par défaut
  let defaultAction: 'match_existing' | 'create_new_vintage' | 'create_new_wine' | 'ignore' = 'create_new_wine';
  let matchedWineId: string | undefined;
  let selectedDomainId: string | undefined = bestDomainScore > 0.6 ? bestDomain?.id : undefined;

  if (bestMatchType === 'exact' && bestWine) {
    defaultAction = 'match_existing';
    matchedWineId = bestWine.id;
    selectedDomainId = bestWine.domainId;
  } else if (bestMatchType === 'vintage_variant' && bestWine) {
    // Par défaut, proposer de créer le nouveau millésime rattaché au même domaine
    defaultAction = 'create_new_vintage';
    matchedWineId = bestWine.id; // gardé en référence
    selectedDomainId = bestWine.domainId;
  } else if (bestMatchType === 'suggested' && bestWine && confidenceScore >= 70) {
    defaultAction = 'match_existing';
    matchedWineId = bestWine.id;
    selectedDomainId = bestWine.domainId;
  } else {
    defaultAction = 'create_new_wine';
  }

  // Calcul du prix de vente suggéré basé sur le coefficient du domaine ou la grille sommelier intelligente
  const buyingPrice = Number(item.unitPriceHT) || 0;
  const matchedDomain = selectedDomainId ? domains.find(d => d.id === selectedDomainId) : undefined;
  const domainCoeff = matchedDomain?.coefficient && matchedDomain.coefficient > 0
    ? matchedDomain.coefficient
    : getSmartCoefficient(buyingPrice);
  const suggestedSellingPrice = Math.round((buyingPrice * domainCoeff) * 100) / 100;

  return {
    id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    rawText: item.rawText,
    domainName: item.domainName,
    wineName: item.wineName,
    vintage: item.vintage || '',
    format: item.format || 'Bouteille (75cl)',
    color: item.color || 'Rouge',
    quantity: Math.max(1, Math.round(item.quantity || 1)),
    unitPriceHT: buyingPrice,
    vatRate: item.vatRate || 20,
    totalHT: item.totalHT || (buyingPrice * (item.quantity || 1)),
    action: defaultAction,
    matchedWineId,
    selectedDomainId,
    confidenceScore,
    matchType: bestMatchType,
    warningMessage,
    // Champs pré-remplis pour création
    customWineName: item.wineName,
    customVintage: item.vintage || '',
    customFormat: item.format || 'Bouteille (75cl)',
    customColor: item.color || 'Rouge',
    customRegion: selectedDomainId ? domains.find(d => d.id === selectedDomainId)?.region || 'Bourgogne' : 'Bourgogne',
    customSubRegion: bestWine?.subRegion || '',
    customBuyingPriceHT: buyingPrice,
    customSellingPriceHT: suggestedSellingPrice,
    customCoefficient: domainCoeff
  };
}
