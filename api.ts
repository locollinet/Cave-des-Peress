
import { supabase } from './supabaseClient';
import { Wine, Domain, Invoice, StockMovement, Client, Expense, ExpenseCategory } from './types';

// --- INTERNAL SIMULATION STATE ---
let _isSimulation = false;

const checkSim = (action: string, data: any) => {
  if (_isSimulation) {
    console.log(`%c[SIMULATION] ${action}`, 'background: #f59e0b; color: #fff; padding: 2px 4px; border-radius: 2px;', data);
    return true;
  }
  return false;
};

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
  quantity: m.quantity,
  reason: m.reason,
  price: m.price,
  provider: m.provider,
  reference: m.reference,
  paymentStatus: m.payment_status,
  paymentDate: m.payment_date,
  paymentMethod: m.payment_method,
  shippingCost: m.shipping_cost
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
  paymentMethod: e.payment_method
});

const mapCategoryFromDB = (c: any): ExpenseCategory => ({
  id: c.id,
  label: c.label
});

// --- API METHODS ---

export const api = {
  // CONFIG
  setSimulationMode: (isSim: boolean) => {
    _isSimulation = isSim;
    if (isSim) console.log('%c[API] Mode Simulation Activé', 'color: orange; font-weight: bold;');
  },

  // READ - Avec Tri Alphabétique par défaut
  fetchWines: async () => {
    const { data, error } = await supabase.from('wines').select('*').order('name', { ascending: true });
    if (error) throw error;
    return data.map(mapWineFromDB);
  },
  
  fetchDomains: async () => {
    const { data, error } = await supabase.from('domains').select('*').order('name', { ascending: true });
    if (error) throw error;
    return data.map(mapDomainFromDB);
  },

  fetchClients: async () => {
    const { data, error } = await supabase.from('clients').select('*').order('name', { ascending: true });
    if (error) throw error;
    return data.map(mapClientFromDB);
  },

  fetchInvoices: async () => {
    const { data, error } = await supabase.from('invoices').select('*').order('id', { ascending: false });
    if (error) throw error;
    return data.map(mapInvoiceFromDB);
  },

  fetchMovements: async () => {
    const { data, error } = await supabase.from('stock_movements').select('*').order('date', { ascending: false });
    if (error) throw error;
    return data.map(mapMovementFromDB);
  },

  fetchExpenses: async () => {
    const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    if (error) throw error;
    return data.map(mapExpenseFromDB);
  },

  fetchExpenseCategories: async () => {
    const { data, error } = await supabase.from('expense_categories').select('*').order('label', { ascending: true });
    if (error) throw error;
    return data.map(mapCategoryFromDB);
  },

  // WRITE - WINES
  createWine: async (wine: Wine) => {
    if (checkSim('createWine', wine)) return;
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
    if (checkSim('updateWine', wine)) return;
    const { error } = await supabase.from('wines').update({
      name: wine.name,
      vintage: wine.vintage,
      color: wine.color,
      buying_price_ht: wine.buyingPriceHT,
      selling_price_ht: wine.sellingPriceHT,
      coefficient: wine.coefficient,
      stock: wine.stock,
      region: wine.region,
      sub_region: wine.subRegion,
      is_archived: wine.isArchived,
      format: wine.format
    }).eq('id', wine.id);
    if (error) throw error;
  },

  updateWineStock: async (id: string, stock: number) => {
    if (checkSim('updateWineStock', { id, stock })) return;
    const { error } = await supabase.from('wines').update({ stock }).eq('id', id);
    if (error) throw error;
  },

  deleteWine: async (id: string) => {
    if (checkSim('deleteWine', id)) return;
    const { error } = await supabase.from('wines').delete().eq('id', id);
    if (error) throw error;
  },

  // WRITE - DOMAINS
  createDomain: async (domain: Domain) => {
    if (checkSim('createDomain', domain)) return;
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
    if (checkSim('updateDomain', { id, updates })) return;
    const { error } = await supabase.from('domains').update(updates).eq('id', id);
    if (error) throw error;
  },

  deleteDomain: async (id: string) => {
    if (checkSim('deleteDomain', id)) return;
    const { error } = await supabase.from('domains').delete().eq('id', id);
    if (error) throw error;
  },

  // WRITE - CLIENTS
  createClient: async (client: Client) => {
    if (checkSim('createClient', client)) return;
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
    if (checkSim('updateClient', client)) return;
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
    if (checkSim('deleteClient', id)) return;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
  },

  // WRITE - INVOICES
  createInvoice: async (invoice: Invoice) => {
    if (checkSim('createInvoice', invoice)) return;
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
    if (checkSim('updateInvoice', invoice)) return;
    const { error } = await supabase.from('invoices').update({
        items: invoice.items,
        total_ht: invoice.totalHT,
        total_tva: invoice.totalTVA,
        total_ttc: invoice.totalTTC,
        shipping_cost: invoice.shippingCost || 0,
        client_address: invoice.clientAddress,
        client_name: invoice.clientName
    }).eq('id', invoice.id);
    if (error) throw error;
  },

  renumberInvoice: async (oldId: string, newId: string) => {
    if (checkSim('renumberInvoice', { oldId, newId })) return;
    const { data: existing } = await supabase.from('invoices').select('id').eq('id', newId).maybeSingle();
    if (existing) throw new Error(`Le numéro ${newId} existe déjà.`);

    const { error } = await supabase.from('invoices').update({ id: newId }).eq('id', oldId);
    if (error) throw error;

    const { data: moves } = await supabase.from('stock_movements').select('*').ilike('reason', `%${oldId}%`);
    if(moves && moves.length > 0) {
        for(const m of moves) {
            const newReason = m.reason.replace(oldId, newId);
            await supabase.from('stock_movements').update({ reason: newReason }).eq('id', m.id);
        }
    }
  },

  updateInvoiceStatus: async (id: string, status: string, paymentDetails?: any) => {
    if (checkSim('updateInvoiceStatus', { id, status, paymentDetails })) return;
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
    if (checkSim('deleteInvoice', id)) return;
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw error;
  },

  // WRITE - MOVEMENTS
  createMovement: async (movement: StockMovement) => {
    if (checkSim('createMovement', movement)) return;
    
    // Standard insert with all fields. 
    // Requires 'payment_status', 'payment_date', 'payment_method' to exist in DB.
    const { error } = await supabase.from('stock_movements').insert({
      id: movement.id,
      date: movement.date,
      wine_id: movement.wineId,
      wine_name: movement.wineName,
      type: movement.type,
      quantity: movement.quantity,
      reason: movement.reason,
      price: movement.price,
      provider: movement.provider,
      reference: movement.reference,
      payment_status: movement.paymentStatus,
      payment_date: movement.paymentDate,
      payment_method: movement.paymentMethod,
      shipping_cost: movement.shippingCost
    });

    if (error) throw error;
  },

  // NEW: Bulk insert for safety
  createMovements: async (movements: StockMovement[]) => {
    if (checkSim('createMovements', movements)) return;
    if (movements.length === 0) return;
    
    const records = movements.map(m => ({
      id: m.id,
      date: m.date,
      wine_id: m.wineId,
      wine_name: m.wineName,
      type: m.type,
      quantity: m.quantity,
      reason: m.reason,
      price: m.price,
      provider: m.provider,
      reference: m.reference,
      payment_status: m.paymentStatus,
      payment_date: m.paymentDate,
      payment_method: m.paymentMethod,
      shipping_cost: m.shippingCost
    }));

    const { error } = await supabase.from('stock_movements').insert(records);
    if (error) throw error;
  },

  // Pour la gestion groupée des paiements fournisseurs
  updatePurchasePayment: async (provider: string, reference: string, paymentData: { status: 'Paid', date: string, method: string }) => {
     if (checkSim('updatePurchasePayment', { provider, reference, paymentData })) return;
     
     const { error } = await supabase.from('stock_movements')
        .update({
            payment_status: paymentData.status,
            payment_date: paymentData.date,
            payment_method: paymentData.method
        })
        .eq('provider', provider)
        .eq('reference', reference)
        .eq('type', 'IN');
     
     if (error) throw error;
  },

  // Pour la mise à jour des frais de port d'une facture
  updateMovementShippingCost: async (id: string, shippingCost: number) => {
     if (checkSim('updateMovementShippingCost', { id, shippingCost })) return;
     const { error } = await supabase.from('stock_movements').update({ shipping_cost: shippingCost }).eq('id', id);
     if (error) throw error;
  },

  updateMovementPrice: async (id: string, newPrice: number) => {
     if (checkSim('updateMovementPrice', { id, newPrice })) return;
     const { error } = await supabase.from('stock_movements').update({ price: newPrice }).eq('id', id);
     if (error) throw error;
  },

  deleteMovement: async (id: string) => {
    if (checkSim('deleteMovement', id)) return;
    const { error } = await supabase.from('stock_movements').delete().eq('id', id);
    if (error) throw error;
  },

  // WRITE - EXPENSES
  createExpense: async (expense: Expense) => {
    if (checkSim('createExpense', expense)) return;
    const { error } = await supabase.from('expenses').insert({
      date: expense.date,
      provider: expense.provider,
      category: expense.category,
      description: expense.description,
      amount_ht: expense.amountHT,
      amount_tva: expense.amountTVA,
      amount_ttc: expense.amountTTC,
      payment_method: expense.paymentMethod
    });
    if (error) throw error;
  },

  updateExpense: async (expense: Expense) => {
      if (checkSim('updateExpense', expense)) return;
      const { error } = await supabase.from('expenses').update({
        date: expense.date,
        provider: expense.provider,
        category: expense.category,
        description: expense.description,
        amount_ht: expense.amountHT,
        amount_tva: expense.amountTVA,
        amount_ttc: expense.amountTTC,
        payment_method: expense.paymentMethod
      }).eq('id', expense.id);
      if (error) throw error;
  },

  deleteExpense: async (id: string) => {
    if (checkSim('deleteExpense', id)) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
  },

  // WRITE - EXPENSE CATEGORIES
  createExpenseCategory: async (label: string) => {
    if (checkSim('createExpenseCategory', label)) return;
    const { error } = await supabase.from('expense_categories').insert({ label });
    if (error) throw error;
  },

  deleteExpenseCategory: async (id: string) => {
    if (checkSim('deleteExpenseCategory', id)) return;
    const { error } = await supabase.from('expense_categories').delete().eq('id', id);
    if (error) throw error;
  }
};
