import fs from 'fs';
import path from 'path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, writeBatch, doc, collection, getDocs, getCountFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

// Helper to remove undefined properties since Firestore rejects undefined
function cleanObject(obj: Record<string, any>): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        cleaned[key] = cleanObject(val);
      } else {
        cleaned[key] = val;
      }
    }
  }
  return cleaned;
}

// Map snake_case to camelCase
function transformWine(w: any) {
  return cleanObject({
    id: String(w.id),
    domainId: w.domain_id || w.domainId || '',
    name: w.name || '',
    vintage: w.vintage ? String(w.vintage) : '',
    color: w.color || 'Rouge',
    buyingPriceHT: Number(w.buying_price_ht ?? w.buyingPriceHT ?? 0),
    sellingPriceHT: w.selling_price_ht !== null && w.selling_price_ht !== undefined ? Number(w.selling_price_ht) : (w.sellingPriceHT !== undefined ? Number(w.sellingPriceHT) : undefined),
    coefficient: w.coefficient !== null && w.coefficient !== undefined ? Number(w.coefficient) : undefined,
    stock: Number(w.stock ?? 0),
    region: w.region || '',
    subRegion: w.sub_region || w.subRegion || '',
    isArchived: Boolean(w.is_archived ?? w.isArchived ?? false),
    format: w.format || 'Bouteille (75cl)',
    isPreSale: Boolean(w.is_pre_sale ?? w.isPreSale ?? false)
  });
}

function transformDomain(d: any) {
  return cleanObject({
    id: String(d.id),
    name: d.name || '',
    region: d.region || '',
    coefficient: Number(d.coefficient ?? 1.5),
    isArchived: Boolean(d.is_archived ?? d.isArchived ?? false)
  });
}

function transformClient(c: any) {
  let externalStock = c.external_stock ?? c.externalStock;
  if (typeof externalStock === 'string') {
    try { externalStock = JSON.parse(externalStock); } catch { externalStock = []; }
  }
  return cleanObject({
    id: String(c.id),
    name: c.name || '',
    contactName: c.contact_name || c.contactName || '',
    email: c.email || '',
    phone: c.phone || '',
    phoneLandline: c.phone_landline || c.phoneLandline || '',
    address: c.address || '',
    externalStock: Array.isArray(externalStock) ? externalStock : []
  });
}

function transformInvoice(i: any) {
  let items = i.items;
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  return cleanObject({
    id: String(i.id),
    date: i.date || '',
    invoiceDate: i.invoice_date || i.invoiceDate || '',
    clientName: i.client_name || i.clientName || '',
    clientId: i.client_id || i.clientId || null,
    clientAddress: i.client_address || i.clientAddress || null,
    items: Array.isArray(items) ? items : [],
    totalHT: Number(i.total_ht ?? i.totalHT ?? 0),
    totalTVA: Number(i.total_tva ?? i.totalTVA ?? 0),
    totalTTC: Number(i.total_ttc ?? i.totalTTC ?? 0),
    discount: Number(i.discount ?? 0),
    shippingCost: Number(i.shipping_cost ?? i.shippingCost ?? 0),
    status: i.status || 'ProForma',
    type: i.type || 'Sale',
    paymentMethod: i.payment_method || i.paymentMethod || null,
    paymentReference: i.payment_reference || i.paymentReference || null,
    paymentDate: i.payment_date || i.paymentDate || null
  });
}

function transformMovement(m: any) {
  return cleanObject({
    id: String(m.id),
    date: m.date || new Date().toISOString(),
    wineId: m.wine_id || m.wineId || '',
    wineName: m.wine_name || m.wineName || '',
    type: m.type || 'ADJUST',
    quantity: Number(m.quantity ?? 0),
    reason: m.reason || '',
    price: m.price !== null && m.price !== undefined ? Number(m.price) : null,
    vatRate: m.vat_rate !== null && m.vat_rate !== undefined ? Number(m.vat_rate) : (m.vatRate !== null && m.vatRate !== undefined ? Number(m.vatRate) : null),
    tva: m.tva !== null && m.tva !== undefined ? Number(m.tva) : null,
    provider: m.provider || null,
    reference: m.reference || null,
    paymentStatus: m.payment_status || m.paymentStatus || null,
    paymentDate: m.payment_date || m.paymentDate || null,
    paymentMethod: m.payment_method || m.paymentMethod || null,
    shippingCost: m.shipping_cost !== null && m.shipping_cost !== undefined ? Number(m.shipping_cost) : (m.shippingCost !== null && m.shippingCost !== undefined ? Number(m.shippingCost) : 0),
    impactStock: m.impact_stock !== undefined ? Boolean(m.impact_stock) : (m.impactStock !== undefined ? Boolean(m.impactStock) : true),
    isArchived: Boolean(m.is_archived ?? m.isArchived ?? false)
  });
}

function transformExpense(e: any) {
  return cleanObject({
    id: String(e.id),
    date: e.date || '',
    provider: e.provider || '',
    category: e.category || '',
    description: e.description || '',
    amountHT: Number(e.amount_ht ?? e.amountHT ?? 0),
    amountTVA: Number(e.amount_tva ?? e.amountTVA ?? 0),
    amountTTC: Number(e.amount_ttc ?? e.amountTTC ?? 0),
    paymentMethod: e.payment_method || e.paymentMethod || '',
    assetId: e.asset_id || e.assetId || null
  });
}

function transformCategory(c: any) {
  return cleanObject({
    id: String(c.id),
    label: c.label || ''
  });
}

function transformAsset(a: any) {
  return cleanObject({
    id: String(a.id),
    name: a.name || '',
    category: a.category || '',
    purchaseDate: a.purchase_date || a.purchaseDate || '',
    amountHT: Number(a.amount_ht ?? a.amountHT ?? 0),
    vatAmount: Number(a.vat_amount ?? a.vatAmount ?? 0),
    durationYears: Number(a.duration_years ?? a.durationYears ?? 5),
    startDepreciationDate: a.start_depreciation_date || a.startDepreciationDate || '',
    description: a.description || '',
    isArchived: Boolean(a.is_archived ?? a.isArchived ?? false)
  });
}

async function batchUpload(collectionName: string, items: any[], transformFn: (item: any) => any) {
  console.log(`\nStarting migration for [${collectionName}]: ${items.length} records...`);
  const BATCH_SIZE = 400;
  let batchCount = 0;
  let currentBatch = writeBatch(db);
  let opCount = 0;

  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    const docData = transformFn(raw);
    const docRef = doc(db, collectionName, docData.id);

    currentBatch.set(docRef, docData);
    opCount++;

    if (opCount >= BATCH_SIZE || i === items.length - 1) {
      batchCount++;
      await currentBatch.commit();
      console.log(`  -> Committed batch ${batchCount} (${opCount} items) for ${collectionName} [Progress: ${i + 1}/${items.length}]`);
      currentBatch = writeBatch(db);
      opCount = 0;
    }
  }

  console.log(`Completed [${collectionName}] successfully.`);
}

async function run() {
  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    throw new Error('No backups directory found! Run backup first.');
  }

  const wines = JSON.parse(fs.readFileSync(path.join(backupDir, 'wines.json'), 'utf8'));
  const domains = JSON.parse(fs.readFileSync(path.join(backupDir, 'domains.json'), 'utf8'));
  const clients = JSON.parse(fs.readFileSync(path.join(backupDir, 'clients.json'), 'utf8'));
  const invoices = JSON.parse(fs.readFileSync(path.join(backupDir, 'invoices.json'), 'utf8'));
  const movements = JSON.parse(fs.readFileSync(path.join(backupDir, 'stock_movements.json'), 'utf8'));
  const expenses = JSON.parse(fs.readFileSync(path.join(backupDir, 'expenses.json'), 'utf8'));
  const categories = JSON.parse(fs.readFileSync(path.join(backupDir, 'expense_categories.json'), 'utf8'));
  const assets = JSON.parse(fs.readFileSync(path.join(backupDir, 'assets.json'), 'utf8'));

  console.log('=== STARTING FIRESTORE MIGRATION ===');
  console.log(`Database ID: ${firebaseConfig.firestoreDatabaseId}`);

  await batchUpload('domains', domains, transformDomain);
  await batchUpload('wines', wines, transformWine);
  await batchUpload('clients', clients, transformClient);
  await batchUpload('invoices', invoices, transformInvoice);
  await batchUpload('stock_movements', movements, transformMovement);
  await batchUpload('expenses', expenses, transformExpense);
  await batchUpload('expense_categories', categories, transformCategory);
  await batchUpload('assets', assets, transformAsset);

  console.log('\n=== MIGRATION COMPLETED SUCCESSFULLY! ===');
}

run().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
