import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebaseClient';
import { Wine, Domain, Invoice, StockMovement, Client, Expense, ExpenseCategory, Asset } from './types';

// --- FIRESTORE ERROR HANDLING AS PER SKILL SPECIFICATION ---
type OperationType = 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: any[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {},
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Clean helper to remove undefined fields before Firestore operations
function cleanPayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        cleaned[key] = cleanPayload(val);
      } else {
        cleaned[key] = val;
      }
    }
  }
  return cleaned;
}

// --- MAPPING HELPERS ---
const mapWineFromDB = (w: any): Wine => ({
  id: String(w.id),
  domainId: w.domainId || w.domain_id || '',
  name: w.name || '',
  vintage: w.vintage ? String(w.vintage) : '',
  color: w.color || 'Rouge',
  buyingPriceHT: Number(w.buyingPriceHT ?? w.buying_price_ht ?? 0),
  sellingPriceHT: w.sellingPriceHT !== undefined && w.sellingPriceHT !== null ? Number(w.sellingPriceHT) : (w.selling_price_ht !== undefined && w.selling_price_ht !== null ? Number(w.selling_price_ht) : undefined),
  coefficient: w.coefficient !== undefined && w.coefficient !== null ? Number(w.coefficient) : undefined,
  stock: Number(w.stock ?? 0),
  region: w.region || '',
  subRegion: w.subRegion || w.sub_region || '',
  isArchived: Boolean(w.isArchived ?? w.is_archived ?? false),
  format: w.format || 'Bouteille (75cl)',
  isPreSale: Boolean(w.isPreSale ?? w.is_pre_sale ?? false)
});

const mapDomainFromDB = (d: any): Domain => ({
  id: String(d.id),
  name: d.name || '',
  region: d.region || '',
  coefficient: Number(d.coefficient ?? 1.5),
  isArchived: Boolean(d.isArchived ?? d.is_archived ?? false)
});

const mapClientFromDB = (c: any): Client => {
  let ext = c.externalStock ?? c.external_stock;
  if (typeof ext === 'string') {
    try { ext = JSON.parse(ext); } catch { ext = []; }
  }
  return {
    id: String(c.id),
    name: c.name || '',
    contactName: c.contactName || c.contact_name || '',
    email: c.email || '',
    phone: c.phone || '',
    phoneLandline: c.phoneLandline || c.phone_landline || '',
    address: c.address || '',
    externalStock: Array.isArray(ext) ? ext : []
  };
};

const mapInvoiceFromDB = (i: any): Invoice => {
  let items = i.items;
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  return {
    id: String(i.id),
    date: i.date || '',
    invoiceDate: i.invoiceDate || i.invoice_date || '',
    clientName: i.clientName || i.client_name || '',
    clientId: i.clientId || i.client_id || undefined,
    clientAddress: i.clientAddress || i.client_address || undefined,
    items: Array.isArray(items) ? items : [],
    totalHT: Number(i.totalHT ?? i.total_ht ?? 0),
    totalTVA: Number(i.totalTVA ?? i.total_tva ?? 0),
    totalTTC: Number(i.totalTTC ?? i.total_ttc ?? 0),
    discount: Number(i.discount ?? 0),
    shippingCost: Number(i.shippingCost ?? i.shipping_cost ?? 0),
    status: i.status || 'ProForma',
    type: i.type || 'Sale',
    paymentMethod: i.paymentMethod || i.payment_method || undefined,
    paymentDate: i.paymentDate || i.payment_date || undefined,
    paymentReference: i.paymentReference || i.payment_reference || undefined
  };
};

const mapMovementFromDB = (m: any): StockMovement => ({
  id: String(m.id),
  date: m.date || new Date().toISOString(),
  wineId: m.wineId || m.wine_id || '',
  wineName: m.wineName || m.wine_name || '',
  type: m.type || 'ADJUST',
  quantity: Number(m.quantity ?? 0),
  reason: m.reason || undefined,
  price: m.price !== null && m.price !== undefined ? Number(m.price) : undefined,
  vatRate: m.vatRate !== null && m.vatRate !== undefined ? Number(m.vatRate) : (m.vat_rate !== null && m.vat_rate !== undefined ? Number(m.vat_rate) : undefined),
  tva: m.tva !== null && m.tva !== undefined ? Number(m.tva) : undefined,
  provider: m.provider || undefined,
  reference: m.reference || undefined,
  paymentStatus: m.paymentStatus || m.payment_status || undefined,
  paymentDate: m.paymentDate || m.payment_date || undefined,
  paymentMethod: m.paymentMethod || m.payment_method || undefined,
  shippingCost: m.shippingCost !== null && m.shippingCost !== undefined ? Number(m.shippingCost) : (m.shipping_cost !== null && m.shipping_cost !== undefined ? Number(m.shipping_cost) : undefined),
  impactStock: m.impactStock !== undefined ? Boolean(m.impactStock) : (m.impact_stock !== undefined ? Boolean(m.impact_stock) : true),
  isArchived: Boolean(m.isArchived ?? m.is_archived ?? false)
});

const mapExpenseFromDB = (e: any): Expense => ({
  id: String(e.id),
  date: e.date || '',
  provider: e.provider || '',
  category: e.category || '',
  description: e.description || '',
  amountHT: Number(e.amountHT ?? e.amount_ht ?? 0),
  amountTVA: Number(e.amountTVA ?? e.amount_tva ?? 0),
  amountTTC: Number(e.amountTTC ?? e.amount_ttc ?? 0),
  paymentMethod: e.paymentMethod || e.payment_method || '',
  assetId: e.assetId || e.asset_id || undefined
});

const mapAssetFromDB = (a: any): Asset => ({
  id: String(a.id),
  name: a.name || '',
  category: a.category || '',
  purchaseDate: a.purchaseDate || a.purchase_date || '',
  amountHT: Number(a.amountHT ?? a.amount_ht ?? 0),
  vatAmount: Number(a.vatAmount ?? a.vat_amount ?? 0),
  durationYears: Number(a.durationYears ?? a.duration_years ?? 5),
  startDepreciationDate: a.startDepreciationDate || a.start_depreciation_date || '',
  description: a.description || '',
  isArchived: Boolean(a.isArchived ?? a.is_archived ?? false)
});

const mapCategoryFromDB = (c: any): ExpenseCategory => ({
  id: String(c.id),
  label: c.label || ''
});

// --- LOCAL STORAGE HELPERS (FOR RESILIENT INSTANT RENDERING) ---
const getLocal = <T>(key: string, defaultValue: T): T => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return defaultValue;
    const item = window.localStorage.getItem(`app_db_${key}`);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

const setLocal = <T>(key: string, value: T): void => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(`app_db_${key}`, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to save ${key} to localStorage`, e);
  }
};

// --- API METHODS BACKED BY FIRESTORE ---

export const api = {
  // READ WINES
  fetchWines: async (): Promise<Wine[]> => {
    try {
      const snap = await getDocs(collection(db, 'wines'));
      const list = snap.docs.map(doc => mapWineFromDB(doc.data()));
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setLocal('wines', list);
      return list;
    } catch (err) {
      console.warn("Firestore fetchWines non disponible, utilisation du stockage local:", err);
      return getLocal<Wine[]>('wines', []);
    }
  },

  // READ DOMAINS
  fetchDomains: async (): Promise<Domain[]> => {
    try {
      const snap = await getDocs(collection(db, 'domains'));
      const list = snap.docs.map(doc => mapDomainFromDB(doc.data()));
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setLocal('domains', list);
      return list;
    } catch (err) {
      console.warn("Firestore fetchDomains non disponible, utilisation du stockage local:", err);
      return getLocal<Domain[]>('domains', []);
    }
  },

  // READ CLIENTS
  fetchClients: async (): Promise<Client[]> => {
    try {
      const snap = await getDocs(collection(db, 'clients'));
      const list = snap.docs.map(doc => mapClientFromDB(doc.data()));
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setLocal('clients', list);
      return list;
    } catch (err) {
      console.warn("Firestore fetchClients non disponible, utilisation du stockage local:", err);
      return getLocal<Client[]>('clients', []);
    }
  },

  // READ INVOICES
  fetchInvoices: async (): Promise<Invoice[]> => {
    try {
      const snap = await getDocs(collection(db, 'invoices'));
      const list = snap.docs
        .map(doc => mapInvoiceFromDB(doc.data()))
        .filter(i => (i.status as string) !== 'Deleted');
      list.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
      setLocal('invoices', list);
      return list;
    } catch (err) {
      console.warn("Firestore fetchInvoices non disponible, utilisation du stockage local:", err);
      return getLocal<Invoice[]>('invoices', []).filter(i => (i.status as string) !== 'Deleted');
    }
  },

  // READ MOVEMENTS
  fetchMovements: async (): Promise<StockMovement[]> => {
    try {
      const snap = await getDocs(collection(db, 'stock_movements'));
      const list = snap.docs
        .map(doc => mapMovementFromDB(doc.data()))
        .filter(m => !m.isArchived);
      list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setLocal('movements', list);
      return list;
    } catch (err) {
      console.warn("Firestore fetchMovements non disponible, utilisation du stockage local:", err);
      return getLocal<StockMovement[]>('movements', []);
    }
  },

  // READ EXPENSES
  fetchExpenses: async (): Promise<Expense[]> => {
    try {
      const snap = await getDocs(collection(db, 'expenses'));
      const list = snap.docs.map(doc => mapExpenseFromDB(doc.data()));
      list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setLocal('expenses', list);
      return list;
    } catch (err) {
      console.warn("Firestore fetchExpenses non disponible, utilisation du stockage local:", err);
      return getLocal<Expense[]>('expenses', []);
    }
  },

  // READ EXPENSE CATEGORIES
  fetchExpenseCategories: async (): Promise<ExpenseCategory[]> => {
    try {
      const snap = await getDocs(collection(db, 'expense_categories'));
      if (!snap.empty) {
        const list = snap.docs.map(doc => mapCategoryFromDB(doc.data()));
        list.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
        setLocal('categories', list);
        return list;
      }
    } catch (err) {
      console.warn("Firestore fetchExpenseCategories non disponible, utilisation du stockage local:", err);
    }
    const defaultCats: ExpenseCategory[] = [
      'Achat Marchandise (Vin)',
      'Frais de Repas / Restaurant',
      'Leasing / Véhicule',
      'Carburant / Péage',
      'Téléphonie / Internet',
      'Fournitures de Bureau',
      'Loyer / Charges Locatives',
      'Assurances',
      'Honoraires / Prestations Tiers',
      'Frais Bancaires',
      'Taxes & Impôts',
      'Avoir / Remboursement Client',
      'Remboursement Fournisseur',
      'Immobilisation (Matériel / Investissement)',
      'Régularisation / Autre'
    ].map((label, index) => ({ id: String(index + 1), label }));

    return getLocal<ExpenseCategory[]>('categories', defaultCats);
  },

  // READ ASSETS
  fetchAssets: async (): Promise<Asset[]> => {
    try {
      const snap = await getDocs(collection(db, 'assets'));
      const list = snap.docs.map(doc => mapAssetFromDB(doc.data()));
      list.sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''));
      setLocal('assets', list);
      return list;
    } catch (err) {
      console.warn("Firestore fetchAssets non disponible, utilisation du stockage local:", err);
      return getLocal<Asset[]>('assets', []);
    }
  },

  // WRITE - WINES
  createWine: async (wine: Wine) => {
    const list = getLocal<Wine[]>('wines', []);
    setLocal('wines', [...list.filter(w => w.id !== wine.id), wine]);
    try {
      const payload = cleanPayload({
        id: wine.id,
        domainId: wine.domainId,
        name: wine.name,
        vintage: wine.vintage,
        color: wine.color,
        buyingPriceHT: Number.isNaN(wine.buyingPriceHT) ? 0 : wine.buyingPriceHT,
        sellingPriceHT: wine.sellingPriceHT,
        coefficient: wine.coefficient,
        stock: Number.isNaN(wine.stock) ? 0 : wine.stock,
        region: wine.region || '',
        subRegion: wine.subRegion || '',
        isArchived: false,
        format: wine.format || 'Bouteille (75cl)',
        isPreSale: wine.isPreSale || false
      });
      await setDoc(doc(db, 'wines', wine.id), payload);
    } catch (e) {
      console.warn("Firestore createWine failed:", e);
    }
  },

  updateWine: async (wine: Wine) => {
    const list = getLocal<Wine[]>('wines', []);
    setLocal('wines', list.map(w => w.id === wine.id ? wine : w));
    try {
      const payload = cleanPayload({
        name: wine.name,
        vintage: wine.vintage,
        color: wine.color,
        buyingPriceHT: Number.isNaN(wine.buyingPriceHT) ? 0 : wine.buyingPriceHT,
        sellingPriceHT: Number.isNaN(wine.sellingPriceHT as number) ? 0 : wine.sellingPriceHT,
        coefficient: Number.isNaN(wine.coefficient as number) ? 1 : wine.coefficient,
        stock: Number.isNaN(wine.stock) ? 0 : wine.stock,
        region: wine.region || '',
        subRegion: wine.subRegion || '',
        isArchived: wine.isArchived ?? false,
        format: wine.format || 'Bouteille (75cl)',
        isPreSale: wine.isPreSale ?? false
      });
      await updateDoc(doc(db, 'wines', wine.id), payload);
    } catch (e) {
      console.warn("Firestore updateWine failed:", e);
    }
  },

  updateWineStock: async (id: string, stock: number) => {
    const safeStock = Number.isNaN(stock) ? 0 : stock;
    const list = getLocal<Wine[]>('wines', []);
    setLocal('wines', list.map(w => w.id === id ? { ...w, stock: safeStock } : w));
    try {
      await updateDoc(doc(db, 'wines', id), { stock: safeStock });
    } catch (e) {
      console.warn("Firestore updateWineStock failed:", e);
    }
  },

  deleteWine: async (id: string) => {
    const list = getLocal<Wine[]>('wines', []);
    setLocal('wines', list.filter(w => w.id !== id));
    try {
      await deleteDoc(doc(db, 'wines', id));
    } catch (e) {
      console.warn("Firestore deleteWine failed:", e);
    }
  },

  // WRITE - DOMAINS
  createDomain: async (domain: Domain) => {
    const list = getLocal<Domain[]>('domains', []);
    setLocal('domains', [...list.filter(d => d.id !== domain.id), domain]);
    try {
      const payload = cleanPayload({
        id: domain.id,
        name: domain.name,
        region: domain.region || '',
        coefficient: domain.coefficient ?? 1.5,
        isArchived: false
      });
      await setDoc(doc(db, 'domains', domain.id), payload);
    } catch (e) {
      console.warn("Firestore createDomain failed:", e);
    }
  },

  updateDomain: async (id: string, updates: Partial<Domain>) => {
    const list = getLocal<Domain[]>('domains', []);
    setLocal('domains', list.map(d => d.id === id ? { ...d, ...updates } : d));
    try {
      await updateDoc(doc(db, 'domains', id), cleanPayload(updates));
    } catch (e) {
      console.warn("Firestore updateDomain failed:", e);
    }
  },

  deleteDomain: async (id: string) => {
    const list = getLocal<Domain[]>('domains', []);
    setLocal('domains', list.filter(d => d.id !== id));
    try {
      await deleteDoc(doc(db, 'domains', id));
    } catch (e) {
      console.warn("Firestore deleteDomain failed:", e);
    }
  },

  // WRITE - CLIENTS
  createClient: async (client: Client) => {
    const list = getLocal<Client[]>('clients', []);
    setLocal('clients', [...list.filter(c => c.id !== client.id), client]);
    try {
      const payload = cleanPayload({
        id: client.id,
        name: client.name,
        contactName: client.contactName || '',
        email: client.email || '',
        phone: client.phone || '',
        phoneLandline: client.phoneLandline || '',
        address: client.address || '',
        externalStock: client.externalStock || []
      });
      await setDoc(doc(db, 'clients', client.id), payload);
    } catch (e) {
      console.warn("Firestore createClient failed:", e);
    }
  },

  updateClient: async (client: Client) => {
    const list = getLocal<Client[]>('clients', []);
    setLocal('clients', list.map(c => c.id === client.id ? client : c));
    try {
      const payload = cleanPayload({
        name: client.name,
        contactName: client.contactName || '',
        email: client.email || '',
        phone: client.phone || '',
        phoneLandline: client.phoneLandline || '',
        address: client.address || '',
        externalStock: client.externalStock || []
      });
      await updateDoc(doc(db, 'clients', client.id), payload);
    } catch (e) {
      console.warn("Firestore updateClient failed:", e);
    }
  },

  deleteClient: async (id: string) => {
    const list = getLocal<Client[]>('clients', []);
    setLocal('clients', list.filter(c => c.id !== id));
    try {
      await deleteDoc(doc(db, 'clients', id));
    } catch (e) {
      console.warn("Firestore deleteClient failed:", e);
    }
  },

  // WRITE - INVOICES
  createInvoice: async (invoice: Invoice) => {
    const list = getLocal<Invoice[]>('invoices', []);
    setLocal('invoices', [invoice, ...list.filter(i => i.id !== invoice.id)]);
    try {
      const payload = cleanPayload({
        id: invoice.id,
        date: invoice.date,
        invoiceDate: invoice.invoiceDate || '',
        clientName: invoice.clientName,
        clientId: invoice.clientId || null,
        clientAddress: invoice.clientAddress || null,
        items: invoice.items || [],
        totalHT: invoice.totalHT || 0,
        totalTVA: invoice.totalTVA || 0,
        totalTTC: invoice.totalTTC || 0,
        discount: invoice.discount || 0,
        shippingCost: invoice.shippingCost || 0,
        status: invoice.status,
        type: invoice.type,
        paymentDate: invoice.paymentDate || null,
        paymentMethod: invoice.paymentMethod || null,
        paymentReference: invoice.paymentReference || null
      });
      await setDoc(doc(db, 'invoices', invoice.id), payload);
    } catch (e) {
      console.warn("Firestore createInvoice failed:", e);
    }
  },

  updateInvoice: async (invoice: Invoice) => {
    const list = getLocal<Invoice[]>('invoices', []);
    setLocal('invoices', list.map(i => i.id === invoice.id ? invoice : i));
    try {
      const payload = cleanPayload({
        items: invoice.items,
        totalHT: invoice.totalHT,
        totalTVA: invoice.totalTVA,
        totalTTC: invoice.totalTTC,
        discount: invoice.discount || 0,
        shippingCost: invoice.shippingCost || 0,
        clientAddress: invoice.clientAddress || null,
        clientName: invoice.clientName,
        status: invoice.status,
        date: invoice.date,
        invoiceDate: invoice.invoiceDate || '',
        paymentDate: invoice.paymentDate || null,
        paymentMethod: invoice.paymentMethod || null,
        paymentReference: invoice.paymentReference || null
      });
      await updateDoc(doc(db, 'invoices', invoice.id), payload);
    } catch (e) {
      console.warn("Firestore updateInvoice failed:", e);
    }
  },

  renumberInvoice: async (oldId: string, newId: string) => {
    const list = getLocal<Invoice[]>('invoices', []);
    if (list.some(i => i.id === newId)) throw new Error(`Le numéro ${newId} existe déjà.`);
    const found = list.find(i => i.id === oldId);
    if (!found) return;

    const updated = { ...found, id: newId };
    setLocal('invoices', list.map(i => i.id === oldId ? updated : i));

    try {
      // In Firestore, changing document ID requires creating the new doc and deleting the old doc
      const payload = cleanPayload(updated);
      await setDoc(doc(db, 'invoices', newId), payload);
      await deleteDoc(doc(db, 'invoices', oldId));
    } catch (e) {
      console.warn("Firestore renumberInvoice failed:", e);
    }
  },

  updateInvoiceStatus: async (id: string, status: string, paymentDetails?: any) => {
    const list = getLocal<Invoice[]>('invoices', []);
    setLocal('invoices', list.map(i => {
      if (i.id !== id) return i;
      return {
        ...i,
        status: status as any,
        paymentDate: paymentDetails?.date || i.paymentDate,
        paymentMethod: paymentDetails?.method || i.paymentMethod,
        paymentReference: paymentDetails?.reference || i.paymentReference
      };
    }));
    try {
      const updatePayload: any = { status };
      if (paymentDetails) {
        if (paymentDetails.date) updatePayload.paymentDate = paymentDetails.date;
        if (paymentDetails.method) updatePayload.paymentMethod = paymentDetails.method;
        if (paymentDetails.reference) updatePayload.paymentReference = paymentDetails.reference;
      }
      await updateDoc(doc(db, 'invoices', id), updatePayload);
    } catch (e) {
      console.warn("Firestore updateInvoiceStatus failed:", e);
    }
  },

  deleteInvoice: async (id: string) => {
    const list = getLocal<Invoice[]>('invoices', []);
    setLocal('invoices', list.filter(i => i.id !== id));
    try {
      await updateDoc(doc(db, 'invoices', id), { status: 'Deleted' });
    } catch (e) {
      console.warn("Firestore deleteInvoice failed:", e);
    }
  },

  deleteInvoiceSecure: async (id: string, _secretKey: string) => {
    const list = getLocal<Invoice[]>('invoices', []);
    setLocal('invoices', list.filter(i => i.id !== id));
    try {
      await deleteDoc(doc(db, 'invoices', id));
    } catch (e) {
      console.warn("Firestore deleteInvoiceSecure failed:", e);
    }
  },

  // WRITE - MOVEMENTS
  createMovement: async (movement: StockMovement) => {
    const list = getLocal<StockMovement[]>('movements', []);
    setLocal('movements', [movement, ...list.filter(m => m.id !== movement.id)]);
    try {
      const payload = cleanPayload({
        id: movement.id,
        date: movement.date,
        wineId: movement.wineId,
        wineName: movement.wineName,
        type: movement.type,
        quantity: Number.isNaN(movement.quantity) ? 0 : movement.quantity,
        reason: movement.reason || '',
        price: Number.isNaN(movement.price as number) ? 0 : movement.price,
        vatRate: Number.isNaN(movement.vatRate as number) ? 20 : movement.vatRate,
        tva: Number.isNaN(movement.tva as number) ? 0 : movement.tva,
        provider: movement.provider || null,
        reference: movement.reference || null,
        paymentStatus: movement.paymentStatus || null,
        paymentDate: movement.paymentDate || null,
        paymentMethod: movement.paymentMethod || null,
        shippingCost: Number.isNaN(movement.shippingCost as number) ? 0 : movement.shippingCost,
        impactStock: movement.impactStock ?? true,
        isArchived: false
      });
      await setDoc(doc(db, 'stock_movements', movement.id), payload);
    } catch (e) {
      console.warn("Firestore createMovement failed:", e);
    }
  },

  createMovements: async (movements: StockMovement[]) => {
    if (movements.length === 0) return;
    const list = getLocal<StockMovement[]>('movements', []);
    setLocal('movements', [...movements, ...list]);
    try {
      const batch = writeBatch(db);
      for (const m of movements) {
        const payload = cleanPayload({
          id: m.id,
          date: m.date,
          wineId: m.wineId,
          wineName: m.wineName,
          type: m.type,
          quantity: Number.isNaN(m.quantity) ? 0 : m.quantity,
          reason: m.reason || '',
          price: Number.isNaN(m.price as number) ? 0 : m.price,
          vatRate: Number.isNaN(m.vatRate as number) ? 20 : m.vatRate,
          tva: Number.isNaN(m.tva as number) ? 0 : m.tva,
          provider: m.provider || null,
          reference: m.reference || null,
          paymentStatus: m.paymentStatus || null,
          paymentDate: m.paymentDate || null,
          paymentMethod: m.paymentMethod || null,
          shippingCost: Number.isNaN(m.shippingCost as number) ? 0 : m.shippingCost,
          impactStock: m.impactStock ?? true,
          isArchived: false
        });
        batch.set(doc(db, 'stock_movements', m.id), payload);
      }
      await batch.commit();
    } catch (e) {
      console.warn("Firestore createMovements failed:", e);
    }
  },

  updatePurchasePayment: async (provider: string, reference: string, paymentData: { status: 'Paid', date: string, method: string }) => {
    try {
      let q = query(collection(db, 'stock_movements'), where('type', '==', 'IN'));
      if (provider) {
        q = query(q, where('provider', '==', provider));
      }
      if (reference) {
        q = query(q, where('reference', '==', reference));
      }
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        batch.update(d.ref, {
          paymentStatus: paymentData.status,
          paymentDate: paymentData.date,
          paymentMethod: paymentData.method
        });
      });
      await batch.commit();
    } catch (e) {
      console.warn("Firestore updatePurchasePayment failed:", e);
    }
  },

  updateMovementShippingCost: async (id: string, shippingCost: number, tva: number) => {
    const list = getLocal<StockMovement[]>('movements', []);
    setLocal('movements', list.map(m => m.id === id ? { ...m, shippingCost, tva } : m));
    try {
      await updateDoc(doc(db, 'stock_movements', id), {
        shippingCost,
        tva
      });
    } catch (e) {
      console.warn("Firestore updateMovementShippingCost failed:", e);
    }
  },

  updateMovement: async (id: string, updates: Partial<StockMovement & { wine_id?: string, wine_name?: string, vat_rate?: number, shipping_cost?: number, impact_stock?: boolean, newDate?: string, newProvider?: string, newReference?: string }>) => {
    const list = getLocal<StockMovement[]>('movements', []);
    setLocal('movements', list.map(m => m.id === id ? { ...m, ...updates } : m));
    try {
      const dbUpdates: any = {};
      if (updates.price !== undefined) dbUpdates.price = updates.price;
      if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
      if (updates.tva !== undefined) dbUpdates.tva = updates.tva;
      if (updates.vatRate !== undefined) dbUpdates.vatRate = updates.vatRate;
      if (updates.vat_rate !== undefined) dbUpdates.vatRate = updates.vat_rate;
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.provider !== undefined) dbUpdates.provider = updates.provider;
      if (updates.reference !== undefined) dbUpdates.reference = updates.reference;
      if (updates.reason !== undefined) dbUpdates.reason = updates.reason;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.shippingCost !== undefined) dbUpdates.shippingCost = updates.shippingCost;
      if (updates.shipping_cost !== undefined) dbUpdates.shippingCost = updates.shipping_cost;
      if (updates.impactStock !== undefined) dbUpdates.impactStock = updates.impactStock;
      if (updates.impact_stock !== undefined) dbUpdates.impactStock = updates.impact_stock;
      if (updates.newDate !== undefined) dbUpdates.date = updates.newDate;
      if (updates.newProvider !== undefined) dbUpdates.provider = updates.newProvider;
      if (updates.newReference !== undefined) dbUpdates.reference = updates.newReference;

      await updateDoc(doc(db, 'stock_movements', id), cleanPayload(dbUpdates));
    } catch (e) {
      console.warn("Firestore updateMovement failed:", e);
    }
  },

  updateMovementPrice: async (id: string, newPrice: number) => {
    const list = getLocal<StockMovement[]>('movements', []);
    setLocal('movements', list.map(m => m.id === id ? { ...m, price: newPrice } : m));
    try {
      await updateDoc(doc(db, 'stock_movements', id), { price: newPrice });
    } catch (e) {
      console.warn("Firestore updateMovementPrice failed:", e);
    }
  },

  deleteMovement: async (id: string) => {
    const list = getLocal<StockMovement[]>('movements', []);
    setLocal('movements', list.filter(m => m.id !== id));
    try {
      await deleteDoc(doc(db, 'stock_movements', id));
    } catch (e) {
      console.warn("Firestore deleteMovement failed:", e);
    }
  },

  // WRITE - EXPENSES
  upsertExpense: async (expense: Expense) => {
    const list = getLocal<Expense[]>('expenses', []);
    setLocal('expenses', [expense, ...list.filter(e => e.id !== expense.id)]);
    try {
      const payload = cleanPayload({
        id: expense.id,
        date: expense.date,
        provider: expense.provider,
        category: expense.category,
        description: expense.description || '',
        amountHT: Number(expense.amountHT),
        amountTVA: Number(expense.amountTVA),
        amountTTC: Number(expense.amountTTC),
        paymentMethod: expense.paymentMethod,
        assetId: expense.assetId || null
      });
      await setDoc(doc(db, 'expenses', expense.id), payload);
    } catch (e) {
      console.warn("Firestore upsertExpense failed:", e);
    }
  },

  deleteExpense: async (id: string) => {
    const list = getLocal<Expense[]>('expenses', []);
    setLocal('expenses', list.filter(e => e.id !== id));
    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (e) {
      console.warn("Firestore deleteExpense failed:", e);
    }
  },

  // WRITE - ASSETS
  createAsset: async (asset: Asset) => {
    const list = getLocal<Asset[]>('assets', []);
    setLocal('assets', [asset, ...list.filter(a => a.id !== asset.id)]);
    try {
      const payload = cleanPayload({
        id: asset.id,
        name: asset.name,
        category: asset.category,
        purchaseDate: asset.purchaseDate,
        amountHT: asset.amountHT,
        vatAmount: asset.vatAmount,
        durationYears: asset.durationYears,
        startDepreciationDate: asset.startDepreciationDate,
        description: asset.description || '',
        isArchived: false
      });
      await setDoc(doc(db, 'assets', asset.id), payload);
    } catch (e) {
      console.warn("Firestore createAsset failed:", e);
    }
  },

  updateAsset: async (asset: Asset) => {
    const list = getLocal<Asset[]>('assets', []);
    setLocal('assets', list.map(a => a.id === asset.id ? asset : a));
    try {
      const payload = cleanPayload({
        name: asset.name,
        category: asset.category,
        purchaseDate: asset.purchaseDate,
        amountHT: asset.amountHT,
        vatAmount: asset.vatAmount,
        durationYears: asset.durationYears,
        startDepreciationDate: asset.startDepreciationDate,
        description: asset.description || '',
        isArchived: asset.isArchived ?? false
      });
      await updateDoc(doc(db, 'assets', asset.id), payload);
    } catch (e) {
      console.warn("Firestore updateAsset failed:", e);
    }
  },

  deleteAsset: async (id: string) => {
    const list = getLocal<Asset[]>('assets', []);
    setLocal('assets', list.filter(a => a.id !== id));
    try {
      await deleteDoc(doc(db, 'assets', id));
    } catch (e) {
      console.warn("Firestore deleteAsset failed:", e);
    }
  },

  // WRITE - EXPENSE CATEGORIES
  createExpenseCategory: async (label: string) => {
    const id = String(Date.now());
    const list = getLocal<ExpenseCategory[]>('categories', []);
    const newCat = { id, label };
    setLocal('categories', [...list, newCat]);
    try {
      await setDoc(doc(db, 'expense_categories', id), { id, label });
    } catch (e) {
      console.warn("Firestore createExpenseCategory failed:", e);
    }
  },

  deleteExpenseCategory: async (id: string) => {
    const list = getLocal<ExpenseCategory[]>('categories', []);
    setLocal('categories', list.filter(c => c.id !== id));
    try {
      await deleteDoc(doc(db, 'expense_categories', id));
    } catch (e) {
      console.warn("Firestore deleteExpenseCategory failed:", e);
    }
  }
};
