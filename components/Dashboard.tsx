
import React, { useMemo, useState } from 'react';
import { Package, TrendingUp, Euro, AlertCircle, Wallet, CreditCard, TrendingDown, Scale, History } from 'lucide-react';
import { Wine, Invoice, StockMovement, Client, Expense, Domain } from '../types';
import { formatCurrency, getSellingPrice } from '../utils';

const Dashboard = ({ 
  wines, 
  domains,
  invoices, 
  movements,
  clients,
  expenses // Now receiving expenses
}: { 
  wines: Wine[], 
  domains: Domain[],
  invoices: Invoice[], 
  movements: StockMovement[],
  clients: Client[],
  expenses: Expense[]
}) => {
  const activeWines = wines.filter(w => !w.isArchived);
  
  // 1. STOCK VALORISATION (Identique)
  const mainStockValue = activeWines.reduce((acc, wine) => acc + (wine.buyingPriceHT * wine.stock), 0);
  const externalStockValue = clients.reduce((total, client) => {
    return total + client.externalStock.reduce((clientTotal, item) => {
      const wine = wines.find(w => w.id === item.wineId);
      return clientTotal + (item.quantity * (wine?.buyingPriceHT || 0));
    }, 0);
  }, 0);
  const totalStockValue = mainStockValue + externalStockValue;

  // 1.1 POTENTIAL REVENUE
  const totalPotentialRevenue = activeWines.reduce((acc, wine) => {
    const domain = domains.find(d => d.id === wine.domainId);
    const sellingPrice = getSellingPrice(wine, domain);
    return acc + (wine.stock * sellingPrice);
  }, 0) + clients.reduce((total, client) => {
    return total + client.externalStock.reduce((cTotal, item) => {
       const wine = wines.find(w => w.id === item.wineId);
       const domain = wine ? domains.find(d => d.id === wine.domainId) : undefined;
       const sellingPrice = wine ? getSellingPrice(wine, domain) : 0;
       return cTotal + (item.quantity * sellingPrice);
    }, 0);
  }, 0);

  const potentialMargin = totalPotentialRevenue - totalStockValue;


  // 2. CA TTC (Ventes)
  // "En Caisse" = Status Paid
  const paidInvoices = invoices.filter(i => i.type === 'Sale' && i.status === 'Paid');
  const revenuePaidTTC = paidInvoices.reduce((acc, i) => acc + i.totalTTC, 0);
  const revenuePaidHT = paidInvoices.reduce((acc, i) => acc + i.totalHT, 0);
  
  // "À Encaisser" = Status Validated
  const pendingInvoices = invoices.filter(i => i.type === 'Sale' && i.status === 'Validated');
  const revenuePendingTTC = pendingInvoices.reduce((acc, i) => acc + i.totalTTC, 0);


  // 3. ACHATS VINS TTC (Dépenses Stock)
  const purchaseGroups = useMemo(() => {
     const groups: Record<string, { totalTTC: number, status: string }> = {};
     movements.filter(m => m.type === 'IN' && m.price !== undefined).forEach(m => {
        const key = `${m.date}_${m.provider}_${m.reference}`;
        if (!groups[key]) {
           groups[key] = { totalTTC: 0, status: m.paymentStatus || 'Pending' };
        }
        const lineTotalHT = m.quantity * (m.price || 0);
        groups[key].totalTTC += lineTotalHT * 1.20; 
        if (m.paymentStatus === 'Paid') groups[key].status = 'Paid';
     });
     return Object.values(groups);
  }, [movements]);

  const purchasePaidTTC = purchaseGroups.filter(g => g.status === 'Paid').reduce((acc, g) => acc + g.totalTTC, 0);
  const purchasePendingTTC = purchaseGroups.filter(g => g.status !== 'Paid').reduce((acc, g) => acc + g.totalTTC, 0);
  const purchasePaidHT = purchasePaidTTC / 1.20;


  // 4. FRAIS GÉNÉRAUX TTC (Année en cours)
  const currentYear = new Date().getFullYear();
  const yearExpenses = expenses.filter(e => new Date(e.date).getFullYear() === currentYear);
  const totalExpensesTTC = yearExpenses.reduce((acc, e) => acc + e.amountTTC, 0);
  const totalExpensesTVA = yearExpenses.reduce((acc, e) => acc + e.amountTVA, 0);
  

  // 5. BILAN TVA (Année en cours - Basé sur Date Facture / Emission)
  const vatStats = useMemo(() => {
    // Collectée: Factures Validées ou Payées de l'année
    const collected = invoices
        .filter(i => (i.status === 'Validated' || i.status === 'Paid'))
        .filter(i => {
            const dateStr = i.invoiceDate || i.date;
            const year = parseInt(dateStr.split('/').pop() || '0');
            return year === currentYear;
        })
        .reduce((acc, i) => acc + i.totalTVA, 0);

    // Déductible (Vin): Mouvements d'achat de l'année
    const deductibleWine = movements
        .filter(m => m.type === 'IN' && m.price !== undefined && new Date(m.date).getFullYear() === currentYear)
        .reduce((acc, m) => acc + (m.quantity * (m.price || 0) * 0.20), 0);
    
    // Déductible (Frais): Dépenses de l'année
    const deductibleExpenses = totalExpensesTVA;

    return {
        collected,
        deductible: deductibleWine + deductibleExpenses,
        balance: collected - (deductibleWine + deductibleExpenses)
    };
  }, [invoices, movements, totalExpensesTVA, currentYear]);


  return (
    <div className="space-y-6">
      
      {/* LIGNE 1 : SYNTHÈSE TRÉSORERIE & RÉSULTAT */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* BLOC 1 : CA TTC */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-emerald-100 relative overflow-hidden flex flex-col justify-between h-40">
           <div className="absolute right-0 top-0 p-4 opacity-10">
              <TrendingUp size={60} className="text-emerald-600" />
           </div>
           <div>
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">Chiffre d'Affaires TTC</p>
              <div className="space-y-1">
                 <div className="flex justify-between items-end">
                    <span className="text-sm text-gray-500">En Caisse (Payé)</span>
                    <span className="text-xl font-bold text-emerald-600">{formatCurrency(revenuePaidTTC)}</span>
                 </div>
                 <div className="flex justify-between items-end">
                    <span className="text-sm text-gray-500">À Encaisser</span>
                    <span className="text-base font-semibold text-orange-500">{formatCurrency(revenuePendingTTC)}</span>
                 </div>
              </div>
           </div>
        </div>

        {/* BLOC 2 : ACHATS VINS TTC */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-blue-100 relative overflow-hidden flex flex-col justify-between h-40">
           <div className="absolute right-0 top-0 p-4 opacity-10">
              <Package size={60} className="text-blue-600" />
           </div>
           <div>
              <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Achats Vins TTC</p>
              <div className="space-y-1">
                 <div className="flex justify-between items-end">
                    <span className="text-sm text-gray-500">Payé</span>
                    <span className="text-xl font-bold text-blue-600">{formatCurrency(purchasePaidTTC)}</span>
                 </div>
                 <div className="flex justify-between items-end">
                    <span className="text-sm text-gray-500">À Payer</span>
                    <span className="text-base font-semibold text-orange-500">{formatCurrency(purchasePendingTTC)}</span>
                 </div>
              </div>
           </div>
        </div>

        {/* BLOC 3 : FRAIS GÉNÉRAUX */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-orange-100 relative overflow-hidden flex flex-col justify-between h-40">
           <div className="absolute right-0 top-0 p-4 opacity-10">
              <TrendingDown size={60} className="text-orange-600" />
           </div>
           <div>
              <p className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-2">Frais Généraux ({currentYear})</p>
              <div className="flex flex-col gap-1">
                  <span className="text-xl font-bold text-orange-600">{formatCurrency(totalExpensesTTC)}</span>
                  <span className="text-xs text-gray-500">Total TTC Cumulé</span>
              </div>
           </div>
           <div className="mt-2 pt-2 border-t border-orange-50 text-xs text-orange-700 flex justify-between">
              <span>Dont TVA :</span>
              <span className="font-bold">{formatCurrency(totalExpensesTVA)}</span>
           </div>
        </div>

        {/* BLOC 4 : TVA BALANCE (ESTIMATION) */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-indigo-100 relative overflow-hidden flex flex-col justify-between h-40">
           <div className="absolute right-0 top-0 p-4 opacity-10">
              <Scale size={60} className="text-indigo-600" />
           </div>
           <div>
              <p className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2">Bilan TVA {currentYear}</p>
              <div className="flex flex-col gap-1">
                 <div className="flex justify-between text-xs">
                    <span className="text-green-600">+ Collectée</span>
                    <span className="font-medium">{formatCurrency(vatStats.collected)}</span>
                 </div>
                 <div className="flex justify-between text-xs">
                    <span className="text-red-500">- Déductible</span>
                    <span className="font-medium">{formatCurrency(vatStats.deductible)}</span>
                 </div>
              </div>
           </div>
           <div className="mt-2 pt-2 border-t border-indigo-50 flex justify-between items-center">
              <span className="text-xs font-bold text-indigo-900">Solde {currentYear} :</span>
              <span className={`text-lg font-bold ${vatStats.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                 {formatCurrency(vatStats.balance)}
              </span>
           </div>
        </div>
      </div>

      {/* LIGNE 2 : MARGE HT & STOCK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         
         {/* MARGE NETTE APPROXIMATIVE */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
               <Euro size={20} className="text-gray-600" /> Rentabilité Commerciale (HT)
            </h3>
            <div className="space-y-4">
               <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-green-800">CA HT (Encaissé)</span>
                  <span className="font-bold text-green-700">{formatCurrency(revenuePaidHT)}</span>
               </div>
               <div className="flex justify-between items-center px-3 text-sm text-gray-500">
                  <span>- Coût Achat Vins (Vendus*)</span>
                   <span className="text-red-500">- {formatCurrency(purchasePaidHT)}</span>
               </div>
               <div className="border-t border-gray-200 my-2"></div>
               <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900">Marge Brute (Cashflow)</span>
                  <span className={`text-xl font-bold ${revenuePaidHT - purchasePaidHT >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                     {formatCurrency(revenuePaidHT - purchasePaidHT)}
                  </span>
               </div>
               <p className="text-xs text-gray-400 italic">* Calcul basé sur les flux de trésorerie réels (Encaissements - Décaissements Stock).</p>
            </div>
         </div>

         {/* VALORISATION STOCK */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden flex flex-col justify-between">
           <div className="flex justify-between items-start">
              <div>
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Valeur Stock Actif (HT)</p>
                 <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(totalStockValue)}</p>
              </div>
              <div className="p-2 bg-gray-100 rounded-lg text-gray-600"><Package size={24} /></div>
           </div>
           
           <div className="mt-4 flex gap-4 text-sm border-b border-gray-100 pb-4 mb-4">
              <div className="flex-1 bg-gray-50 p-2 rounded">
                 <div className="text-gray-500 text-xs">Cave Principale</div>
                 <div className="font-bold text-gray-800">{formatCurrency(mainStockValue)}</div>
              </div>
              <div className="flex-1 bg-orange-50 p-2 rounded">
                 <div className="text-orange-600 text-xs">Stock Déporté</div>
                 <div className="font-bold text-orange-800">{formatCurrency(externalStockValue)}</div>
              </div>
           </div>

           <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Potentiel Vente (Est.)</p>
              <div className="flex justify-between items-end mt-1">
                 <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalPotentialRevenue)}</p>
                 <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                    Marge latente: +{formatCurrency(potentialMargin)}
                 </span>
              </div>
           </div>
         </div>

      </div>

      {/* RECENT MOVEMENTS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
               <History size={18} className="text-gray-500" /> Activité Récente (Stock)
            </h3>
            <span className="text-xs text-gray-400">Derniers 10 mouvements</span>
         </div>
         <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-left text-sm">
               <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-100">
                  <tr>
                     <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase">Date</th>
                     <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase">Vin</th>
                     <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase text-center">Type</th>
                     <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase text-right">Quantité</th>
                     <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase">Raison</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                  {movements.slice(0, 10).map(move => (
                     <tr key={move.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-gray-600 whitespace-nowrap">
                           {new Date(move.date).toLocaleDateString()} <span className="text-[10px] text-gray-400 ml-1">{new Date(move.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </td>
                        <td className="px-6 py-3 font-medium text-gray-900">{move.wineName}</td>
                        <td className="px-6 py-3 text-center">
                           <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                              move.type === 'IN' ? 'bg-green-100 text-green-700' :
                              move.type === 'OUT' ? 'bg-red-100 text-red-700' :
                              move.type === 'ADJUST' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                           }`}>
                              {move.type === 'IN' ? 'Entrée' : move.type === 'OUT' ? 'Sortie' : move.type === 'ADJUST' ? 'Ajust.' : 'Transfert'}
                           </span>
                        </td>
                        <td className={`px-6 py-3 text-right font-bold ${
                           move.type === 'IN' || (move.type === 'ADJUST' && move.quantity > 0) ? 'text-green-600' : 'text-red-600'
                        }`}>
                           {move.type === 'IN' || (move.type === 'ADJUST' && move.quantity > 0) ? '+' : '-'}{Math.abs(move.quantity)}
                        </td>
                        <td className="px-6 py-3 text-gray-500 text-xs truncate max-w-xs" title={move.reason}>
                           {move.reason || '-'}
                        </td>
                     </tr>
                  ))}
                  {movements.length === 0 && (
                     <tr><td colSpan={5} className="p-6 text-center text-gray-400 italic">Aucune activité récente.</td></tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default Dashboard;
