import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Download, Scale, TrendingDown, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { Invoice, Expense, Wine, Domain } from '../types';
import { formatCurrency } from '../utils';
import { calculateVatReport } from '../src/services/vatService';

const VatReport = ({
  invoices,
  expenses,
  wines,
  domains
}: {
  invoices: Invoice[];
  expenses: Expense[];
  wines: Wine[];
  domains: Domain[];
}) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [vatStatuses, setVatStatuses] = useState<Record<string, 'Pending' | 'Paid'>>(() => {
    const saved = localStorage.getItem('vatStatuses');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('vatStatuses', JSON.stringify(vatStatuses));
  }, [vatStatuses]);

  const toggleVatStatus = (monthKey: string) => {
    setVatStatuses(prev => ({
      ...prev,
      [monthKey]: prev[monthKey] === 'Paid' ? 'Pending' : 'Paid'
    }));
  };

  const report = useMemo(() => {
    return calculateVatReport(invoices, expenses, selectedYear);
  }, [selectedYear, invoices, expenses]);

  // Totaux Annuels
  const totals = report.reduce((acc, curr) => ({
    collected: acc.collected + curr.collected,
    deductiblePurchases: acc.deductiblePurchases + curr.deductiblePurchases,
    deductibleExpenses: acc.deductibleExpenses + curr.deductibleExpenses,
    balance: acc.balance + curr.balance
  }), { collected: 0, deductiblePurchases: 0, deductibleExpenses: 0, balance: 0 });

  return (
    <div className="space-y-6">
       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Scale className="text-indigo-600" /> Bilan TVA (Encaissements)
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              <strong>TVA Collectée :</strong> Sur encaissements (date de paiement).<br/>
              <strong>TVA Déductible :</strong> Sur débits (date de facture fournisseur).
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
               <Calendar size={18} className="text-gray-500" />
               <select 
                 value={selectedYear} 
                 onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                 className="bg-transparent font-bold text-gray-800 outline-none"
               >
                 {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
               </select>
            </div>
            <button className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Exporter">
               <Download size={20} />
            </button>
          </div>
       </div>

       {/* BLOCS RÉCAPITULATIFS */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-green-100 shadow-sm relative overflow-hidden">
             <div className="absolute right-0 top-0 p-4 opacity-5"><TrendingUp size={80} className="text-green-600" /></div>
             <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">TVA Collectée (Annuel)</p>
             <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.collected)}</p>
             <p className="text-xs text-gray-400 mt-1">Basé sur les paiements reçus</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm relative overflow-hidden">
             <div className="absolute right-0 top-0 p-4 opacity-5"><TrendingDown size={80} className="text-red-600" /></div>
             <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">TVA Déductible (Annuel)</p>
             <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.deductiblePurchases + totals.deductibleExpenses)}</p>
             </div>
             <div className="flex gap-3 text-xs mt-2">
                <span className="text-red-800">Achats: {formatCurrency(totals.deductiblePurchases)}</span>
                <span className="text-orange-600">Frais: {formatCurrency(totals.deductibleExpenses)}</span>
             </div>
          </div>

          <div className={`p-5 rounded-xl border shadow-sm relative overflow-hidden ${totals.balance > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
             <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${totals.balance > 0 ? 'text-red-800' : 'text-green-800'}`}>
               Solde Annuel ({totals.balance > 0 ? 'À Payer' : 'Crédit'})
             </p>
             <p className={`text-3xl font-bold ${totals.balance > 0 ? 'text-red-900' : 'text-green-900'}`}>
               {formatCurrency(Math.abs(totals.balance))}
             </p>
          </div>
       </div>

       {/* TABLEAU MENSUEL */}
       <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[800px]">
             <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase text-xs">
                <tr>
                   <th className="px-6 py-4">Période</th>
                   <th className="px-6 py-4 text-right text-green-700 bg-green-50/30">TVA Collectée</th>
                   <th className="px-6 py-4 text-right text-red-900 bg-red-100/30">TVA Déd. (Achats)</th>
                   <th className="px-6 py-4 text-right text-orange-700 bg-orange-50/30">TVA Déd. (Frais)</th>
                   <th className="px-6 py-4 text-right">Solde Mensuel</th>
                   <th className="px-6 py-4 text-center">Statut</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
                 {report.filter(r => r.collected > 0 || r.deductiblePurchases > 0 || r.deductibleExpenses > 0).map((row) => (
                   <React.Fragment key={row.monthIndex}>
                     <tr className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setExpandedMonth(expandedMonth === row.monthIndex ? null : row.monthIndex)}>
                        <td className="px-6 py-4 font-medium text-gray-900">{row.monthName}</td>
                        <td className="px-6 py-4 text-right font-medium text-gray-600">{row.collected > 0 ? formatCurrency(row.collected) : '-'}</td>
                        <td className="px-6 py-4 text-right text-gray-500">{row.deductiblePurchases > 0 ? formatCurrency(row.deductiblePurchases) : '-'}</td>
                        <td className="px-6 py-4 text-right text-gray-500">{row.deductibleExpenses > 0 ? formatCurrency(row.deductibleExpenses) : '-'}</td>
                        <td className={`px-6 py-4 text-right font-bold ${row.balance > 0 ? 'text-red-600' : row.balance < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                           {formatCurrency(row.balance)}
                        </td>
                        <td className="px-6 py-4 text-center">
                           {row.balance !== 0 ? (
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleVatStatus(`${selectedYear}-${row.monthIndex}`); }}
                                className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors w-full ${
                                  vatStatuses[`${selectedYear}-${row.monthIndex}`] === 'Paid' 
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                    : row.balance > 0 
                                      ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                                      : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                }`}
                              >
                                 {vatStatuses[`${selectedYear}-${row.monthIndex}`] === 'Paid' ? (
                                   <><CheckCircle size={14} /> Payé</>
                                 ) : row.balance > 0 ? (
                                   <><Clock size={14} /> À Payer</>
                                 ) : (
                                   <><Clock size={14} /> Crédit</>
                                 )}
                              </button>
                           ) : (
                              <span className="text-gray-300">-</span>
                           )}
                        </td>
                     </tr>
                     {expandedMonth === row.monthIndex && (
                       <tr>
                         <td colSpan={6} className="bg-gray-50 p-6 border-t border-gray-200">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div>
                               <h4 className="font-bold text-gray-800 mb-2">Ventes (TVA Collectée)</h4>
                               {row.collectedInvoices.filter((inv: any) => inv.totalTVA > 0).length > 0 ? (
                                 <ul className="text-xs text-gray-600 space-y-1">
                                   {row.collectedInvoices.filter((inv: any) => inv.totalTVA > 0).map((inv: any) => <li key={inv.id}>{inv.clientName} - {formatCurrency(inv.totalTVA)}</li>)}
                                 </ul>
                               ) : <p className="text-xs text-gray-400">Aucune vente</p>}
                             </div>
                             <div>
                               <h4 className="font-bold text-gray-800 mb-2">Achats & Frais (TVA Déd.)</h4>
                               {(row.deductiblePurchasesInvoices || []).filter((inv: any) => (inv.totalTVA || 0) > 0).length > 0 && (
                                 <div className="mb-2">
                                   <p className="text-[10px] font-bold text-gray-500 uppercase">Factures d'achat</p>
                                   <ul className="text-xs text-gray-600 space-y-1">
                                     {(row.deductiblePurchasesInvoices || []).filter((inv: any) => (inv.totalTVA || 0) > 0).map((inv: any) => (
                                       <li key={inv.id}>{inv.clientName} ({inv.paymentReference || inv.id}) - {formatCurrency(inv.totalTVA || 0)}</li>
                                     ))}
                                   </ul>
                                 </div>
                               )}
                               {(row.deductibleExpensesList || []).filter((exp: any) => (exp.amountTVA || 0) > 0).length > 0 && (
                                 <div>
                                   <p className="text-[10px] font-bold text-gray-500 uppercase">Frais</p>
                                   <ul className="text-xs text-gray-600 space-y-1">
                                     {(row.deductibleExpensesList || []).filter((exp: any) => (exp.amountTVA || 0) > 0).map((exp: any) => (
                                       <li key={exp.id}>{exp.provider} - {formatCurrency(exp.amountTVA || 0)}</li>
                                     ))}
                                   </ul>
                                 </div>
                               )}
                               {((row.deductiblePurchasesInvoices || []).filter((inv: any) => (inv.totalTVA || 0) > 0).length === 0 && (row.deductibleExpensesList || []).filter((exp: any) => (exp.amountTVA || 0) > 0).length === 0) && (
                                 <p className="text-xs text-gray-400">Aucun achat/frais</p>
                               )}
                             </div>
                           </div>
                         </td>
                       </tr>
                     )}
                   </React.Fragment>
                 ))}
             </tbody>
          </table>
       </div>
    </div>
  );
};

export default VatReport;
