
import { supabase } from './supabaseClient';
import { Wine, Domain, Invoice, StockMovement, Client, Expense, ExpenseCategory, Asset } from './types';

// --- MAPPING HELPERS ---

const mapWineFromDB = (w: any): Wine => ({
  id: w.id,
  domainId: w.domain_id,
  name: w.name,
  vintage: w.vintage,
  color: w.color,
  buyingPriceHT: w.buying_price_ht,
  sellingPriceHT: w.selling_price_ht,
  coefficient: w.coefficient,
  stock: w.stock,
  region: w.region,
  subRegion: w.sub_region,
  isArchived: w.is_archived,
  format: w.format || 'Bouteille (75cl)'
});

const mapDomainFromDB = (d: any): Domain => ({
  id: d.id,
  name: d.name,
  region: d.region,
  coefficient: d.coefficient,
  isArchived: d.is_archived
});

const mapClientFromDB = (c: any): Client => ({
  id: c.id,
  name: c.name,
  contactName: c.contact_name,
  email: c.email,
  phone: c.phone,
  phoneLandline: c.phone_landline,
  address: c.address,
  externalStock: typeof c.external_stock === 'string' ? JSON.parse(c.external_stock) : c.external_stock || []
});

const mapInvoiceFromDB = (i: any): Invoice => ({
  id: i.id,
  date: i.date,
  invoiceDate: i.invoice_date,
  clientName: i.client_name,
  clientId: i.client_id,
  clientAddress: i.client_address,
  items: typeof i.items === 'string' ? JSON.parse(i.items) : i.items,
  totalHT: i.total_ht,
  totalTVA: i.total_tva,
  totalTTC: i.total_ttc,
  discount: i.discount,
  shippingCost: i.shipping_cost || 0, // NEW
  status: i.status,
  type: i.type,
  paymentMethod: i.payment_method,
  paymentDate: i.payment_date,
  paymentReference: i.payment_reference
});

const mapMovementFromDB = (m: any): StockMovement => ({
  id: m.id,
  date: m.date,
  wineId: m.wine_id,
  wineName: m.wine_name,
  type: m.type,
  quantity: Number(m.quantity) || 0,
  reason: m.reason,
  price: m.price !== null && m.price !== undefined ? Number(m.price) : undefined,
  vatRate: m.vat_rate !== null && m.vat_rate !== undefined ? Number(m.vat_rate) : undefined,
  tva: m.tva !== null && m.tva !== undefined ? Number(m.tva) : undefined,
  provider: m.provider,
  reference: m.reference,
  paymentStatus: m.payment_status,
  paymentDate: m.payment_date,
  paymentMethod: m.payment_method,
  shippingCost: m.shipping_cost !== null && m.shipping_cost !== undefined ? Number(m.shipping_cost) : undefined,
  impactStock: m.impact_stock,
  isArchived: m.is_archived
});

const mapExpenseFromDB = (e: any): Expense => ({
  id: e.id,
  date: e.date,
  provider: e.provider,
  category: e.category,
  description: e.description,
  amountHT: e.amount_ht,
  amountTVA: e.amount_tva,
  amountTTC: e.amount_ttc,
  paymentMethod: e.payment_method,
  assetId: e.asset_id
});

const mapAssetFromDB = (a: any): Asset => ({
  id: a.id,
  name: a.name,
  category: a.category,
  purchaseDate: a.purchase_date,
  amountHT: a.amount_ht,
  vatAmount: a.vat_amount,
  durationYears: a.duration_years,
  startDepreciationDate: a.start_depreciation_date,
  description: a.description,
  isArchived: a.is_archived
});

const mapCategoryFromDB = (c: any): ExpenseCategory => ({
  id: c.id,
  label: c.label
});

// --- API METHODS ---

export const api = {
  // READ - Avec Tri Alphabétique par défaut
  fetchWines: async () => {
    const { data, error } = await supabase.from('wines').select('*').limit(100000).order('name', { ascending: true });
    if (error) throw error;
    return data.map(mapWineFromDB);
  },
  
  fetchDomains: async () => {
    const { data, error } = await supabase.from('domains').select('*').limit(100000).order('name', { ascending: true });
    if (error) throw error;
    return data.map(mapDomainFromDB);
  },

  fetchClients: async () => {
    const { data, error } = await supabase.from('clients').select('*').limit(100000).order('name', { ascending: true });
    if (error) throw error;
    console.log("DEBUG: clients fetched:", data);
    return data.map(mapClientFromDB);
  },

  fetchInvoices: async () => {
    const { data, error } = await supabase.from('invoices').select('*').limit(100000).order('id', { ascending: false });
    if (error) throw error;
    return data.map(mapInvoiceFromDB);
  },

  fetchMovements: async () => {
    const { data, error } = await supabase.from('stock_movements').select('*').eq('is_archived', false).limit(100000).order('date', { ascending: false });
    if (error) throw error;
    return data.map(mapMovementFromDB);
  },

  fetchExpenses: async () => {
    const { data, error } = await supabase.from('expenses').select('*').limit(100000).order('date', { ascending: false });
    if (error) throw error;
    return data.map(mapExpenseFromDB);
  },

  fetchExpenseCategories: async () => {
    const { data, error } = await supabase.from('expense_categories').select('*').limit(100000).order('label', { ascending: true });
    if (error) throw error;
    return data.map(mapCategoryFromDB);
  },

  fetchAssets: async () => {
    const { data, error } = await supabase.from('assets').select('*').limit(100000).order('purchase_date', { ascending: false });
    if (error) throw error;
    return data.map(mapAssetFromDB);
  },

  // WRITE - WINES
  createWine: async (wine: Wine) => {
    const { error } = await supabase.from('wines').insert({
      id: wine.id,
      domain_id: wine.domainId,
      name: wine.name,
      vintage: wine.vintage,
      color: wine.color,
      buying_price_ht: wine.buyingPriceHT,
      selling_price_ht: wine.sellingPriceHT,
      coefficient: wine.coefficient,
      stock: wine.stock,
      region: wine.region,
      sub_region: wine.subRegion,
      is_archived: false,
      format: wine.format
    });
    if (error) throw error;
  },

  updateWine: async (wine: Wine) => {
    const { error } = await supabase.from('wines').update({
      name: wine.name,
      vintage: wine.vintage,
      color: wine.color,
      buying_price_ht: Number.isNaN(wine.buyingPriceHT) ? 0 : wine.buyingPriceHT,
      selling_price_ht: Number.isNaN(wine.sellingPriceHT) ? 0 : wine.sellingPriceHT,
      coefficient: Number.isNaN(wine.coefficient) ? 1 : wine.coefficient,
      stock: Number.isNaN(wine.stock) ? 0 : wine.stock,
      region: wine.region,
      sub_region: wine.subRegion,
      is_archived: wine.isArchived,
      format: wine.format
    }).eq('id', wine.id);
    if (error) throw error;
  },

  updateWineStock: async (id: string, stock: number) => {
    const safeStock = Number.isNaN(stock) ? 0 : stock;
    const { error } = await supabase.from('wines').update({ stock: safeStock }).eq('id', id);
    if (error) throw error;
  },

  deleteWine: async (id: string) => {
    const { error } = await supabase.from('wines').delete().eq('id', id);
    if (error) throw error;
  },

  // WRITE - DOMAINS
  createDomain: async (domain: Domain) => {
    const { error } = await supabase.from('domains').insert({
      id: domain.id,
      name: domain.name,
      region: domain.region,
      coefficient: domain.coefficient,
      is_archived: false
    });
    if (error) throw error;
  },

  updateDomain: async (id: string, updates: Partial<Domain>) => {
    const { error } = await supabase.from('domains').update(updates).eq('id', id);
    if (error) throw error;
  },

  deleteDomain: async (id: string) => {
    const { error } = await supabase.from('domains').delete().eq('id', id);
    if (error) throw error;
  },

  // WRITE - CLIENTS
  createClient: async (client: Client) => {
    const { error } = await supabase.from('clients').insert({
      id: client.id,
      name: client.name,
      contact_name: client.contactName,
      email: client.email,
      phone: client.phone,
      phone_landline: client.phoneLandline,
      address: client.address,
      external_stock: client.externalStock
    });
    if (error) throw error;
  },

  updateClient: async (client: Client) => {
    const { error } = await supabase.from('clients').update({
      name: client.name,
      contact_name: client.contactName,
      email: client.email,
      phone: client.phone,
      phone_landline: client.phoneLandline,
      address: client.address,
      external_stock: client.externalStock
    }).eq('id', client.id);
    if (error) throw error;
  },

  deleteClient: async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
  },

  // WRITE - INVOICES
  createInvoice: async (invoice: Invoice) => {
    // CRITICAL FIX: Include payment fields in the INSERT payload
    const { error } = await supabase.from('invoices').insert({
      id: invoice.id,
      date: invoice.date,
      invoice_date: invoice.invoiceDate,
      client_name: invoice.clientName,
      client_id: invoice.clientId,
      client_address: invoice.clientAddress,
      items: invoice.items,
      total_ht: invoice.totalHT,
      total_tva: invoice.totalTVA,
      total_ttc: invoice.totalTTC,
      discount: invoice.discount || 0,
      shipping_cost: invoice.shippingCost || 0,
      status: invoice.status,
      type: invoice.type,
      payment_date: invoice.paymentDate,         // <--- ADDED
      payment_method: invoice.paymentMethod,     // <--- ADDED
      payment_reference: invoice.paymentReference // <--- ADDED
    });
    if (error) throw error;
  },

  updateInvoice: async (invoice: Invoice) => {
    const { data, error } = await supabase.from('invoices').update({
        items: invoice.items,
        total_ht: invoice.totalHT,
        total_tva: invoice.totalTVA,
        total_ttc: invoice.totalTTC,
        discount: invoice.discount || 0,
        shipping_cost: invoice.shippingCost || 0,
        client_address: invoice.clientAddress,
        client_name: invoice.clientName,
        status: invoice.status,
        date: invoice.date,
        invoice_date: invoice.invoiceDate,
        payment_date: invoice.paymentDate,
        payment_method: invoice.paymentMethod,
        payment_reference: invoice.paymentReference
    }).eq('id', invoice.id).select();
    
    if (error) throw error;
    if (!data || data.length === 0) {
        throw new Error(`Impossible de mettre à jour la facture ${invoice.id}. Vérifiez vos accès.`);
    }

    // Propagation de la date aux mouvements de stock associés
    if (invoice.type?.toLowerCase() === 'purchase') {
        await supabase.from('stock_movements')
            .update({ date: invoice.date })
            .eq('provider', invoice.clientName)
            .eq('reference', invoice.paymentReference);
    }
  },

  renumberInvoice: async (oldId: string, newId: string) => {
    const { data: existing } = await supabase.from('invoices').select('id').eq('id', newId).maybeSingle();
    if (existing) throw new Error(`Le numéro ${newId} existe déjà.`);

    const { error } = await supabase.from('invoices').update({ id: newId }).eq('id', oldId);
    if (error) throw error;

    const { data: moves } = await supabase.from('stock_movements').select('*').limit(100000).ilike('reason', `%${oldId}%`);
    if(moves && moves.length > 0) {
        for(const m of moves) {
            const newReason = m.reason.replace(oldId, newId);
            await supabase.from('stock_movements').update({ reason: newReason }).eq('id', m.id);
        }
    }
  },

  updateInvoiceStatus: async (id: string, status: string, paymentDetails?: any) => {
    const updatePayload: any = { status };
    if (paymentDetails) {
        updatePayload.payment_date = paymentDetails.date;
        updatePayload.payment_method = paymentDetails.method;
        updatePayload.payment_reference = paymentDetails.reference;
    }
    const { error } = await supabase.from('invoices').update(updatePayload).eq('id', id);
    if (error) throw error;
  },

  deleteInvoice: async (id: string) => {
    const { data, error } = await supabase.from('invoices').delete().eq('id', id).select();
    if (error) throw error;
    if (!data || data.length === 0) {
        throw new Error(`Échec de suppression de la facture ${id}. Elle n'existe peut-être plus ou vos droits sont insuffisants.`);
    }
  },

  deleteInvoiceSecure: async (id: string, secretKey: string) => {
    const { error } = await supabase.rpc('delete_invoice_secure', { target_invoice_id: id, secret_key: secretKey });
    if (error) throw error;
  },

  // WRITE - MOVEMENTS
  createMovement: async (movement: StockMovement) => {
    // Standard insert with all fields. 
    // Requires 'payment_status', 'payment_date', 'payment_method' to exist in DB.
    const { error } = await supabase.from('stock_movements').insert({
      id: movement.id,
      date: movement.date,
      wine_id: movement.wineId,
      wine_name: movement.wineName,
      type: movement.type,
      quantity: Number.isNaN(movement.quantity) ? 0 : movement.quantity,
      reason: movement.reason,
      price: Number.isNaN(movement.price) ? 0 : movement.price,
      vat_rate: Number.isNaN(movement.vatRate) ? 20 : movement.vatRate,
      tva: Number.isNaN(movement.tva) ? 0 : movement.tva,
      provider: movement.provider,
      reference: movement.reference,
      payment_status: movement.paymentStatus,
      payment_date: movement.paymentDate,
      payment_method: movement.paymentMethod,
      shipping_cost: Number.isNaN(movement.shippingCost) ? 0 : movement.shippingCost,
      impact_stock: movement.impactStock ?? true,
      is_archived: false
    });

    if (error) throw error;
  },

  // NEW: Bulk insert for safety
  createMovements: async (movements: StockMovement[]) => {
    if (movements.length === 0) return;
    
    const records = movements.map(m => ({
      id: m.id,
      date: m.date,
      wine_id: m.wineId,
      wine_name: m.wineName,
      type: m.type,
      quantity: Number.isNaN(m.quantity) ? 0 : m.quantity,
      reason: m.reason,
      price: Number.isNaN(m.price) ? 0 : m.price,
      vat_rate: Number.isNaN(m.vatRate) ? 20 : m.vatRate,
      tva: Number.isNaN(m.tva) ? 0 : m.tva,
      provider: m.provider,
      reference: m.reference,
      payment_status: m.paymentStatus,
      payment_date: m.paymentDate,
      payment_method: m.paymentMethod,
      shipping_cost: Number.isNaN(m.shippingCost) ? 0 : m.shippingCost,
      impact_stock: m.impactStock ?? true,
      is_archived: false
    }));

    const { error } = await supabase.from('stock_movements').insert(records);
    if (error) throw error;
  },

  // Pour la gestion groupée des paiements fournisseurs
  updatePurchasePayment: async (provider: string, reference: string, paymentData: { status: 'Paid', date: string, method: string }) => {
     let query = supabase.from('stock_movements')
        .update({
            payment_status: paymentData.status,
            payment_date: paymentData.date,
            payment_method: paymentData.method
        })
        .eq('type', 'IN');

     if (provider) {
         query = query.eq('provider', provider);
     } else {
         query = query.or('provider.is.null,provider.eq.""');
     }

     if (reference) {
         query = query.eq('reference', reference);
     } else {
         query = query.or('reference.is.null,reference.eq.""');
     }
     
     const { error } = await query;
     if (error) throw error;
  },

  // Pour la mise à jour des frais de port d'une facture
  updateMovementShippingCost: async (id: string, shippingCost: number, tva: number) => {
     const { error } = await supabase.from('stock_movements').update({ 
         shipping_cost: shippingCost,
         tva: tva
     }).eq('id', id);
     if (error) throw error;
  },

  updateMovement: async (id: string, updates: Partial<StockMovement & { wine_id: string, wine_name: string, vat_rate: number, shipping_cost: number, impact_stock: boolean }>) => {
     // Transform camelCase keys to snake_case for Supabase if necessary, or just handle the ones we send
     const dbUpdates: any = {};
     if (updates.price !== undefined) dbUpdates.price = updates.price;
     if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
     if (updates.tva !== undefined) dbUpdates.tva = updates.tva;
     if (updates.vatRate !== undefined) dbUpdates.vat_rate = updates.vatRate;
     if (updates.date !== undefined) dbUpdates.date = updates.date;
     if (updates.provider !== undefined) dbUpdates.provider = updates.provider;
     if (updates.reference !== undefined) dbUpdates.reference = updates.reference;
     if (updates.reason !== undefined) dbUpdates.reason = updates.reason;
     if (updates.type !== undefined) dbUpdates.type = updates.type;
     if ((updates as any).newDate !== undefined) dbUpdates.date = (updates as any).newDate;
     if ((updates as any).newProvider !== undefined) dbUpdates.provider = (updates as any).newProvider;
     if ((updates as any).newReference !== undefined) dbUpdates.reference = (updates as any).newReference;

     const { error } = await supabase.from('stock_movements').update(dbUpdates).eq('id', id);
     if (error) throw error;
  },

  updateMovementPrice: async (id: string, newPrice: number) => {
     const { error } = await supabase.from('stock_movements').update({ price: newPrice }).eq('id', id);
     if (error) throw error;
  },

  deleteMovement: async (id: string) => {
    const { error } = await supabase.from('stock_movements').delete().eq('id', id);
    if (error) throw error;
  },

  // WRITE - EXPENSES
  upsertExpense: async (expense: Expense) => {
    const { error } = await supabase.from('expenses').upsert({
      id: expense.id,
      date: expense.date,
      provider: expense.provider,
      category: expense.category,
      description: expense.description,
      amount_ht: Number(expense.amountHT),
      amount_tva: Number(expense.amountTVA),
      amount_ttc: Number(expense.amountTTC),
      payment_method: expense.paymentMethod,
      asset_id: expense.assetId
    });
    if (error) throw error;
  },

  deleteExpense: async (id: string) => {
    // On utilise .select() pour vérifier si la suppression a réellement eu lieu (car Supabase ne renvoie pas d'erreur si le RLS bloque)
    const { data, error } = await supabase.from('expenses').delete().eq('id', id).select();
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("Impossible de supprimer cette dépense en base de données. Vérifiez les droits d'accès (RLS) sur Supabase.");
    }
  },

  // WRITE - ASSETS
  createAsset: async (asset: Asset) => {
    const { error } = await supabase.from('assets').insert({
      id: asset.id,
      name: asset.name,
      category: asset.category,
      purchase_date: asset.purchaseDate,
      amount_ht: asset.amountHT,
      vat_amount: asset.vatAmount,
      duration_years: asset.durationYears,
      start_depreciation_date: asset.startDepreciationDate,
      description: asset.description,
      is_archived: false
    });
    if (error) throw error;
  },

  updateAsset: async (asset: Asset) => {
    const { error } = await supabase.from('assets').update({
      name: asset.name,
      category: asset.category,
      purchase_date: asset.purchaseDate,
      amount_ht: asset.amountHT,
      vat_amount: asset.vatAmount,
      duration_years: asset.durationYears,
      start_depreciation_date: asset.startDepreciationDate,
      description: asset.description,
      is_archived: asset.isArchived
    }).eq('id', asset.id);
    if (error) throw error;
  },

  deleteAsset: async (id: string) => {
    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (error) throw error;
  },

  // WRITE - EXPENSE CATEGORIES
  createExpenseCategory: async (label: string) => {
    const { error } = await supabase.from('expense_categories').insert({ label });
    if (error) throw error;
  },

  deleteExpenseCategory: async (id: string) => {
    const { error } = await supabase.from('expense_categories').delete().eq('id', id);
    if (error) throw error;
  }
};
