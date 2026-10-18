import fs from 'fs';
import path from 'path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function runAudit() {
  const backupDir = path.join(process.cwd(), 'backups');
  const winesRaw: any[] = JSON.parse(fs.readFileSync(path.join(backupDir, 'wines.json'), 'utf8'));
  const domainsRaw: any[] = JSON.parse(fs.readFileSync(path.join(backupDir, 'domains.json'), 'utf8'));
  const clientsRaw: any[] = JSON.parse(fs.readFileSync(path.join(backupDir, 'clients.json'), 'utf8'));
  const invoicesRaw: any[] = JSON.parse(fs.readFileSync(path.join(backupDir, 'invoices.json'), 'utf8'));
  const movementsRaw: any[] = JSON.parse(fs.readFileSync(path.join(backupDir, 'stock_movements.json'), 'utf8'));
  const expensesRaw: any[] = JSON.parse(fs.readFileSync(path.join(backupDir, 'expenses.json'), 'utf8'));
  const categoriesRaw: any[] = JSON.parse(fs.readFileSync(path.join(backupDir, 'expense_categories.json'), 'utf8'));
  const assetsRaw: any[] = JSON.parse(fs.readFileSync(path.join(backupDir, 'assets.json'), 'utf8'));

  console.log('=== AUDIT CROISÉ SUPABASE VS FIRESTORE ===\n');

  // Fetch all collections from Firestore
  const [
    winesSnap,
    domainsSnap,
    clientsSnap,
    invoicesSnap,
    movementsSnap,
    expensesSnap,
    categoriesSnap,
    assetsSnap
  ] = await Promise.all([
    getDocs(collection(db, 'wines')),
    getDocs(collection(db, 'domains')),
    getDocs(collection(db, 'clients')),
    getDocs(collection(db, 'invoices')),
    getDocs(collection(db, 'stock_movements')),
    getDocs(collection(db, 'expenses')),
    getDocs(collection(db, 'expense_categories')),
    getDocs(collection(db, 'assets'))
  ]);

  const firestoreWines = winesSnap.docs.map(d => d.data());
  const firestoreDomains = domainsSnap.docs.map(d => d.data());
  const firestoreClients = clientsSnap.docs.map(d => d.data());
  const firestoreInvoices = invoicesSnap.docs.map(d => d.data());
  const firestoreMovements = movementsSnap.docs.map(d => d.data());
  const firestoreExpenses = expensesSnap.docs.map(d => d.data());
  const firestoreCategories = categoriesSnap.docs.map(d => d.data());
  const firestoreAssets = assetsSnap.docs.map(d => d.data());

  const auditTable = [
    { entity: 'Vins (wines)', supabase: winesRaw.length, firestore: firestoreWines.length },
    { entity: 'Domaines (domains)', supabase: domainsRaw.length, firestore: firestoreDomains.length },
    { entity: 'Clients (clients)', supabase: clientsRaw.length, firestore: firestoreClients.length },
    { entity: 'Factures (invoices)', supabase: invoicesRaw.length, firestore: firestoreInvoices.length },
    { entity: 'Mouvements (stock_movements)', supabase: movementsRaw.length, firestore: firestoreMovements.length },
    { entity: 'Dépenses (expenses)', supabase: expensesRaw.length, firestore: firestoreExpenses.length },
    { entity: 'Catégories (expense_categories)', supabase: categoriesRaw.length, firestore: firestoreCategories.length },
    { entity: 'Actifs (assets)', supabase: assetsRaw.length, firestore: firestoreAssets.length }
  ];

  console.log('1. COMPTAGES PAR COLLECTION :');
  console.table(auditTable);

  // 2. CHECK UNICITÉ DES IDENTIFIANTS (Zéro doublon)
  function checkUniqueness(name: string, list: any[]) {
    const ids = list.map(item => String(item.id));
    const set = new Set(ids);
    const duplicates = ids.length - set.size;
    if (duplicates > 0) {
      console.error(`❌ ALERTE DOUBLONS dans ${name}: ${duplicates} doublons détectés !`);
    } else {
      console.log(`✅ ${name}: 100% IDs uniques (${ids.length} documents, 0 doublon)`);
    }
  }

  console.log('\n2. VÉRIFICATION DE NON-DUPLICATION :');
  checkUniqueness('wines', firestoreWines);
  checkUniqueness('domains', firestoreDomains);
  checkUniqueness('clients', firestoreClients);
  checkUniqueness('invoices', firestoreInvoices);
  checkUniqueness('stock_movements', firestoreMovements);
  checkUniqueness('expenses', firestoreExpenses);

  // 3. CHECK INTÉGRITÉ 1-À-1 DES IDS (Chaque ID Supabase existe dans Firestore)
  function checkIdParity(name: string, supList: any[], fsList: any[]) {
    const fsIdSet = new Set(fsList.map(item => String(item.id)));
    const missing = supList.filter(item => !fsIdSet.has(String(item.id)));
    if (missing.length > 0) {
      console.error(`❌ ALERTE: ${missing.length} documents de Supabase manquent dans Firestore pour ${name}!`);
    } else {
      console.log(`✅ ${name}: 100% des IDs Supabase présents dans Firestore (0 manquant)`);
    }
  }

  console.log('\n3. PARITÉ STRICTE DES IDENTIFIANTS :');
  checkIdParity('wines', winesRaw, firestoreWines);
  checkIdParity('domains', domainsRaw, firestoreDomains);
  checkIdParity('clients', clientsRaw, firestoreClients);
  checkIdParity('invoices', invoicesRaw, firestoreInvoices);
  checkIdParity('stock_movements', movementsRaw, firestoreMovements);
  checkIdParity('expenses', expensesRaw, firestoreExpenses);

  // 4. TOTAUX MÉTIER (STOCKS & VALEUR)
  const supTotalBottles = winesRaw.reduce((acc, w) => acc + (Number(w.stock) || 0), 0);
  const fsTotalBottles = firestoreWines.reduce((acc, w) => acc + (Number(w.stock) || 0), 0);

  const supStockValue = winesRaw.reduce((acc, w) => acc + ((Number(w.stock) || 0) * (Number(w.buying_price_ht) || 0)), 0);
  const fsStockValue = firestoreWines.reduce((acc, w) => acc + ((Number(w.stock) || 0) * (Number(w.buyingPriceHT) || 0)), 0);

  console.log('\n4. INTÉGRITÉ DU STOCK TOTAL DE LA CAVE :');
  console.log(`- Supabase total bouteilles : ${supTotalBottles}`);
  console.log(`- Firestore total bouteilles : ${fsTotalBottles}`);
  console.log(`-> Écart bouteilles : ${fsTotalBottles - supTotalBottles} (Diff = 0 attendu)`);

  console.log(`\n- Supabase valeur totale stock HT : ${supStockValue.toFixed(2)} €`);
  console.log(`- Firestore valeur totale stock HT : ${fsStockValue.toFixed(2)} €`);
  console.log(`-> Écart valorisation : ${(fsStockValue - supStockValue).toFixed(2)} € (Diff = 0 attendu)`);

  // 5. TOTAUX FACTURATION (CA HT, TVA, TTC)
  const supInvoicesHT = invoicesRaw.reduce((acc, i) => acc + (Number(i.total_ht) || 0), 0);
  const fsInvoicesHT = firestoreInvoices.reduce((acc, i) => acc + (Number(i.totalHT) || 0), 0);

  const supInvoicesTTC = invoicesRaw.reduce((acc, i) => acc + (Number(i.total_ttc) || 0), 0);
  const fsInvoicesTTC = firestoreInvoices.reduce((acc, i) => acc + (Number(i.totalTTC) || 0), 0);

  console.log('\n5. INTÉGRITÉ FINANCIÈRE DE LA FACTURATION :');
  console.log(`- Supabase total factures HT  : ${supInvoicesHT.toFixed(2)} €`);
  console.log(`- Firestore total factures HT : ${fsInvoicesHT.toFixed(2)} €`);
  console.log(`-> Écart CA HT : ${(fsInvoicesHT - supInvoicesHT).toFixed(2)} €`);

  console.log(`- Supabase total factures TTC  : ${supInvoicesTTC.toFixed(2)} €`);
  console.log(`- Firestore total factures TTC : ${fsInvoicesTTC.toFixed(2)} €`);
  console.log(`-> Écart CA TTC : ${(fsInvoicesTTC - supInvoicesTTC).toFixed(2)} €`);

  // 6. VOLUMÉTRIE MOUVEMENTS DE STOCK
  const supInMovements = movementsRaw.filter(m => m.type === 'IN').reduce((acc, m) => acc + (Number(m.quantity) || 0), 0);
  const fsInMovements = firestoreMovements.filter(m => m.type === 'IN').reduce((acc, m) => acc + (Number(m.quantity) || 0), 0);

  const supOutMovements = movementsRaw.filter(m => m.type === 'OUT').reduce((acc, m) => acc + (Number(m.quantity) || 0), 0);
  const fsOutMovements = firestoreMovements.filter(m => m.type === 'OUT').reduce((acc, m) => acc + (Number(m.quantity) || 0), 0);

  console.log('\n6. INTÉGRITÉ TRAÇABILITÉ DOUANES / DRM :');
  console.log(`- Entrées cumulées (IN)  - Supabase: ${supInMovements} | Firestore: ${fsInMovements} (Écart: ${fsInMovements - supInMovements})`);
  console.log(`- Sorties cumulées (OUT) - Supabase: ${supOutMovements} | Firestore: ${fsOutMovements} (Écart: ${fsOutMovements - supOutMovements})`);

  console.log('\n=== FIN DU RAPPORT DE CERTIFICATION ===');
  process.exit(0);
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
