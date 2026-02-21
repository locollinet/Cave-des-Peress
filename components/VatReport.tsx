
import React, { useState, useMemo } from 'react';
import { Calendar, Download, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { Invoice, StockMovement, Expense } from '../types';
import { formatCurrency } from '../utils';

const VatReport = ({
  invoices,
  stockMovements,
  expenses
}: {
  invoices: Invoice[];
  stockMovements: StockMovement[];
  expenses: Expense[];
}) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const report = useMemo(() => {
    // Structure de données pour les 12 mois
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      monthIndex: i,
      monthName: months[i],
      collected: 0, // Ventes (Encaissements)
      deductibleWine: 0, // Achats Stock (Facturation)
      deductibleExpenses: 0, // Frais Généraux (Facturation)
      balance: 0
    }));

    // 1. TVA COLLECTÉE (Ventes)
    // NOUVELLE RÈGLE : Basée sur les ENCAISSEMENTS (Date de paiement)
    invoices.forEach(inv => {
      // On ne compte la TVA que si la facture est PAYÉE
      if (inv.status === 'Paid' && inv.paymentDate) {
        const dateStr = inv.paymentDate; // format DD/MM/YYYY
        const [day, month, year] = dateStr.split('/').map(Number);
        
        if (year === selectedYear) {
           monthlyData[month - 1].collected += inv.totalTVA;
        }
      }
    });

    // 2. TVA DÉDUCTIBLE (Achats Stock)
    // RÈGLE : Achats facturés du mois (Date de facture/réception), même impayés
    stockMovements.forEach(mv => {
      if (mv.type === 'IN' && mv.price !== undefined) {
        const d = new Date(mv.date);
        if (d.getFullYear() === selectedYear) {
          // Estimation TVA 20% sur achat vin
          const tva = (mv.quantity * mv.price) * 0.20;
          monthlyData[d.getMonth()].deductibleWine += tva;
        }
      }
    });

    // 3. TVA DÉDUCTIBLE (Frais Généraux)
    // RÈGLE : Date de la dépense
    expenses.forEach(exp => {
      const d = new Date(exp.date);
      if (d.getFullYear() === selectedYear) {
        monthlyData[d.getMonth()].deductibleExpenses += exp.amountTVA;
      }
    });

    // Calcul des balances
    monthlyData.forEach(row => {
      row.balance = row.collected - (row.deductibleWine + row.deductibleExpenses);
    });

    return monthlyData;
  }, [selectedYear, invoices, stockMovements, expenses]);

  // Totaux Annuels
  const totals = report.reduce((acc, curr) => ({
    collected: acc.collected + curr.collected,
    deductibleWine: acc.deductibleWine + curr.deductibleWine,
    deductibleExpenses: acc.deductibleExpenses + curr.deductibleExpenses,
    balance: acc.balance + curr.balance
  }), { collected: 0, deductibleWine: 0, deductibleExpenses: 0, balance: 0 });

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
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.deductibleWine + totals.deductibleExpenses)}</p>
             </div>
             <div className="flex gap-3 text-xs mt-2">
                <span className="text-red-600">Stock: {formatCurrency(totals.deductibleWine)}</span>
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
       <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left text-sm">
             <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase text-xs">
                <tr>
                   <th className="px-6 py-4">Période</th>
                   <th className="px-6 py-4 text-right text-green-700 bg-green-50/30">TVA Collectée</th>
                   <th className="px-6 py-4 text-right text-red-700 bg-red-50/30">TVA Déd. (Stock)</th>
                   <th className="px-6 py-4 text-right text-orange-700 bg-orange-50/30">TVA Déd. (Frais)</th>
                   <th className="px-6 py-4 text-right">Solde Mensuel</th>
                   <th className="px-6 py-4 text-center">Statut</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
                {report.map((row) => (
                   <tr key={row.monthIndex} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{row.monthName}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-600">{row.collected > 0 ? formatCurrency(row.collected) : '-'}</td>
                      <td className="px-6 py-4 text-right text-gray-500">{row.deductibleWine > 0 ? formatCurrency(row.deductibleWine) : '-'}</td>
                      <td className="px-6 py-4 text-right text-gray-500">{row.deductibleExpenses > 0 ? formatCurrency(row.deductibleExpenses) : '-'}</td>
                      <td className={`px-6 py-4 text-right font-bold ${row.balance > 0 ? 'text-red-600' : row.balance < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                         {formatCurrency(row.balance)}
                      </td>
                      <td className="px-6 py-4 text-center">
                         {row.balance !== 0 ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.balance > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                               {row.balance > 0 ? 'À Payer' : 'Crédit'}
                            </span>
                         ) : (
                            <span className="text-gray-300">-</span>
                         )}
                      </td>
                   </tr>
                ))}
                <tr className="bg-gray-100 font-bold border-t border-gray-200">
                   <td className="px-6 py-4 text-gray-900">TOTAL {selectedYear}</td>
                   <td className="px-6 py-4 text-right text-green-800">{formatCurrency(totals.collected)}</td>
                   <td className="px-6 py-4 text-right text-red-800">{formatCurrency(totals.deductibleWine)}</td>
                   <td className="px-6 py-4 text-right text-orange-800">{formatCurrency(totals.deductibleExpenses)}</td>
                   <td className={`px-6 py-4 text-right ${totals.balance > 0 ? 'text-red-800' : 'text-green-800'}`}>{formatCurrency(totals.balance)}</td>
                   <td className="px-6 py-4"></td>
                </tr>
             </tbody>
          </table>
       </div>
    </div>
  );
};

export default VatReport;
