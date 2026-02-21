
export enum WineColor {
  Red = 'Rouge',
  White = 'Blanc',
  Rose = 'Rosé',
  Sparkling = 'Effervescent',
  Liquor = 'Spiritueux'
}

export interface Domain {
  id: string;
  name: string;
  region: string;
  coefficient: number;
  isArchived?: boolean;
}

export interface Wine {
  id: string;
  domainId: string;
  name: string;
  vintage: string;
  color: WineColor;
  buyingPriceHT: number;
  sellingPriceHT?: number; // Override calculated price
  coefficient?: number; // Specific coefficient for this wine
  stock: number;
  isArchived?: boolean;
  region?: string; // Override domain region
  subRegion?: string; // Specific sub-region for this wine (e.g. Côte de Beaune)
  format: string; // Ex: 'Bouteille (75cl)', 'Magnum (1.5L)'
}

export interface CartItem extends Wine {
  quantity: number;
  sellingPriceHT: number;
  isGift?: boolean;
  fromExternalStock?: boolean; // If true, stock is deducted from client, not main inventory
  isService?: boolean; // Si true, c'est une prestation ou produit libre
  vatRate?: number; // NEW: Taux de TVA spécifique (ex: 5.5, 10, 20)
}

// Interface spécifique pour le panier d'achat (Réception fournisseur)
export interface PurchaseItem extends Wine {
  quantity: number;
  purchasePriceHT: number; // Le prix d'achat spécifique pour cette commande
}

export interface Invoice {
  id: string;
  date: string; // Date of creation (Pro Forma date)
  invoiceDate?: string; // Date it became a real invoice
  clientName: string;
  clientId?: string; // Link to client DB
  clientAddress?: string; // Snapshot of address
  items: CartItem[];
  totalHT: number;
  discount: number;
  shippingCost?: number; // Frais de port HT
  totalTVA: number;
  totalTTC: number;
  status: 'ProForma' | 'Validated' | 'Paid' | 'Cancelled'; // Workflow status
  type: 'Sale' | 'Purchase';
  paymentMethod?: string; // Virement, CB, Espèces, Sortie Perso...
  paymentReference?: string; // Cheque slip number, transaction ID...
  paymentDate?: string;
}

export interface StockMovement {
  id: string;
  date: string;
  wineId: string;
  wineName: string;
  type: 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER';
  quantity: number;
  reason?: string;
  // Nouveaux champs pour la gestion des achats (CUMP)
  price?: number;        // Prix unitaire du mouvement (si achat)
  provider?: string;     // Nom du fournisseur
  reference?: string;    // Numéro de facture fournisseur
  // Gestion Paiement Fournisseur (Nouveau)
  paymentStatus?: 'Paid' | 'Pending';
  paymentDate?: string;
  paymentMethod?: string;
}

export interface Client {
  id: string;
  name: string;
  contactName?: string;
  address?: string;
  phone?: string;          // Mobile / Principal
  phoneLandline?: string;  // Fixe
  email?: string;
  externalStock: { wineId: string; quantity: number }[];
}

export interface Expense {
  id: string;
  date: string;
  provider: string;
  category: string;
  description?: string;
  amountHT: number;
  amountTVA: number;
  amountTTC: number;
  paymentMethod: string;
}

export interface ExpenseCategory {
  id: string;
  label: string;
}