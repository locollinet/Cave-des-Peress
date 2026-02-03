
import React from 'react';
import { Package, TrendingUp, Euro, AlertCircle, Wallet, History } from 'lucide-react';
import { Wine, Invoice, StockMovement, Client } from '../types';
import { formatCurrency } from '../utils';

const Dashboard = ({ 
  wines, 
  invoices, 
  movements,
  clients
}: { 
  wines: Wine[], 
  invoices: Invoice[], 
  movements: StockMovement[],
  clients: Client[]
}) => {
  const activeWines = wines.filter(w => !w.isArchived);
  
  // 1. Valeur Stock Principal (Cave)
  const mainStockValue = activeWines.reduce((acc, wine) => acc + (wine.buyingPriceHT * wine.stock), 0);

  // 2. Valeur Stock Déporté (Chez les clients)
  const externalStockValue = clients.reduce((total, client) => {
    return total + client.externalStock.reduce((clientTotal, item) => {
      const wine = wines.find(w => w.id === item.wineId);
      return clientTotal + (item.quantity * (wine?.buyingPriceHT || 0));
    }, 0);
  }, 0);

  // 3. Valeur Totale Stock
  const totalStockValue = mainStockValue + externalStockValue;

  // 4. CA Encaissé (Ce qui est réellement sur le compte en banque)
  const paidInvoices = invoices.filter(i => i.type === 'Sale' && i.status === 'Paid');
  const totalSalesPaid = paidInvoices.reduce((acc, i) => acc + i.totalHT, 0);
  
  // 5. Créances Clients (Facturé mais pas encore payé - Trésorerie attendue)
  const pendingInvoices = invoices.filter(i => i.type === 'Sale' && i.status === 'Validated');
  const totalReceivables = pendingInvoices.reduce((acc, i) => acc + i.totalTTC, 0); // En TTC car c'est ce que le client doit payer

  // 6. Marge Brute (Uniquement sur ce qui est payé pour l'instant, prudence)
  const totalMargin = paidInvoices.reduce((acc, inv) => {
      if (inv.items && inv.items.length > 0) {
        const cost = inv.items.reduce((c, item) => c + (item.buyingPriceHT * item.quantity), 0);
        return acc + (inv.totalHT - cost); 
      } else {
        const estimatedCost = inv.totalHT / 1.3;
        return acc + (inv.totalHT - estimatedCost);
      }
    }, 0);

  // 7. Taux de Marge (Calculé)
  const marginRate = totalSalesPaid > 0 ? (totalMargin / totalSalesPaid) * 100 : 0;

  const recentMovements = [...movements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

  return (
    <div className="space-y-6">
      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* STOCK */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
             <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Valeur Stock (HT)</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalStockValue)}</p>
             </div>
             <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Package size={20} /></div>
          </div>
          <div className="text-[10px] text-gray-500 flex gap-2 mt-2">
             <span>Cave: <b>{formatCurrency(mainStockValue)}</b></span>
             <span>Déporté: <b>{formatCurrency(externalStockValue)}</b></span>
          </div>
        </div>
        
        {/* CA ENCAISSÉ + MARGE % */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
             <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">CA Encaissé (HT)</p>
                <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(totalSalesPaid)}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${marginRate >= 30 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`} title="Taux de marge brute moyen">
                       {marginRate.toFixed(1)}%
                    </span>
                </div>
             </div>
             <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><TrendingUp size={20} /></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Sur {paidInvoices.length} factures payées</p>
        </div>

        {/* MARGE */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
             <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Marge Réalisée</p>
                <p className="text-xl font-bold text-indigo-600 mt-1">{formatCurrency(totalMargin)}</p>
             </div>
             <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Euro size={20} /></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Avant impôts et charges</p>
        </div>

        {/* CRÉANCES (Trésorerie dehors) */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-orange-200 flex flex-col justify-between h-32 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-16 h-16 bg-orange-100 rounded-bl-full -mr-8 -mt-8 z-0"></div>
          <div className="flex justify-between items-start relative z-10">
             <div>
                <p className="text-xs font-bold text-orange-800 uppercase tracking-wider flex items-center gap-1">
                   <AlertCircle size={12} /> À Encaisser (TTC)
                </p>
                <p className="text-xl font-bold text-orange-600 mt-1">{formatCurrency(totalReceivables)}</p>
             </div>
             <div className="p-2 bg-white rounded-lg text-orange-500 shadow-sm"><Wallet size={20} /></div>
          </div>
          <p className="text-xs text-orange-700 mt-2 relative z-10">{pendingInvoices.length} factures en attente</p>
        </div>

      </div>

      <div className="grid grid-cols-1 gap-6">
         {/* HISTORY */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
               <History className="text-blue-500 w-5 h-5" />
               <h3 className="text-lg font-semibold text-gray-800">Derniers Mouvements</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Vin</th>
                    <th className="px-4 py-2 text-center">Type</th>
                    <th className="px-4 py-2 text-center">Qté</th>
                    <th className="px-4 py-2">Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                   {recentMovements.length === 0 ? (
                     <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-500 italic">Aucun mouvement récent.</td></tr>
                   ) : (
                     recentMovements.map(m => (
                       <tr key={m.id} className="hover:bg-gray-50">
                         <td className="px-4 py-2 text-gray-500">{new Date(m.date).toLocaleDateString()}</td>
                         <td className="px-4 py-2 font-medium text-gray-800 truncate max-w-[300px]">{m.wineName}</td>
                         <td className="px-4 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              m.type === 'IN' ? 'bg-green-100 text-green-700' :
                              m.type === 'OUT' ? 'bg-blue-100 text-blue-700' :
                              m.type?.includes('TRANSFER') ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {m.type === 'IN' ? 'ENTRÉE' : m.type === 'OUT' ? 'SORTIE' : 'MOUVEMENT'}
                            </span>
                         </td>
                         <td className={`px-4 py-2 text-center font-bold ${m.type === 'IN' ? 'text-green-600' : m.type === 'OUT' ? 'text-blue-600' : 'text-gray-700'}`}>
                           {m.type === 'IN' ? '+' : '-'}{m.quantity}
                         </td>
                         <td className="px-4 py-2 text-gray-500 text-xs">
                           {m.reason}
                           {m.provider && <div className="text-[10px] text-blue-600 font-semibold">{m.provider} {m.reference ? `(#${m.reference})` : ''}</div>}
                           {m.price && m.type === 'IN' && <div className="text-[10px] text-gray-600">{formatCurrency(m.price)} / btl</div>}
                         </td>
                       </tr>
                     ))
                   )}
                </tbody>
              </table>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Dashboard;
