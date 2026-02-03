
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Calendar, FileText, TrendingDown, TrendingUp, DollarSign, PieChart, CreditCard, Landmark, Settings, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Expense, Invoice, StockMovement, ExpenseCategory } from '../types';
import { formatCurrency } from '../utils';

const VAT_RATES = [20, 10, 5.5, 0];
const CHART_COLORS = [
  '#4f46e5', // Indigo
  '#059669', // Emerald
  '#d97706', // Amber
  '#dc2626', // Red
  '#0891b2', // Cyan
  '#7c3aed', // Violet
  '#db2777', // Pink
  '#65a30d', // Lime
  '#ea580c', // Orange
  '#2563eb'  // Blue
];

const GeneralAccounting = ({ 
  expenses, 
  categories,
  invoices, 
  stockMovements,
  onAddExpense, 
  onDeleteExpense,
  onAddCategory,
  onDeleteCategory
}: { 
  expenses: Expense[], 
  categories: ExpenseCategory[],
  invoices: Invoice[], 
  stockMovements: StockMovement[],
  onAddExpense: (e: Expense) => void, 
  onDeleteExpense: (id: string) => void,
  onAddCategory: (label: string) => void,
  onDeleteCategory: (id: string) => void
}) => {
  const [activeTab, setActiveTab] = useState<'journal' | 'report'>('journal');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [provider, setProvider] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CB');

  // VAT & Amount Management
  const [vatMode, setVatMode] = useState<'simple' | 'advanced'>('simple');
  
  // Simple Mode State
  const [simpleTTC, setSimpleTTC] = useState('');
  const [simpleRate, setSimpleRate] = useState(20);
  const [manualTVA, setManualTVA] = useState(''); // Override calculated TVA

  // Advanced Mode State
  const [lines, setLines] = useState<{ id: number, label: string, amountTTC: string, rate: number }[]>([
    { id: 1, label: 'Nourriture', amountTTC: '', rate: 10 },
    { id: 2, label: 'Alcool', amountTTC: '', rate: 20 }
  ]);

  // Report State
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  // Initialize default category
  useEffect(() => {
     if (categories.length > 0 && !category) {
        setCategory(categories[0].label);
     }
  }, [categories]);

  // --- HANDLERS ---

  // Calculated values
  const totals = useMemo(() => {
    let ht = 0;
    let tva = 0;
    let ttc = 0;

    if (vatMode === 'simple') {
      const ttcVal = parseFloat(simpleTTC) || 0;
      ttc = ttcVal;
      
      // If manual TVA is entered, use it. Otherwise calculate from rate.
      if (manualTVA !== '') {
        tva = parseFloat(manualTVA) || 0;
        ht = ttc - tva;
      } else {
        ht = ttc / (1 + simpleRate / 100);
        tva = ttc - ht;
      }
    } else {
      // Advanced
      lines.forEach(line => {
        const lineTTC = parseFloat(line.amountTTC) || 0;
        const lineHT = lineTTC / (1 + line.rate / 100);
        const lineTVA = lineTTC - lineHT;
        
        ttc += lineTTC;
        ht += lineHT;
        tva += lineTVA;
      });
    }

    return {
      ht: parseFloat(ht.toFixed(2)),
      tva: parseFloat(tva.toFixed(2)),
      ttc: parseFloat(ttc.toFixed(2))
    };
  }, [vatMode, simpleTTC, simpleRate, manualTVA, lines]);

  const handleAddLine = () => {
    setLines([...lines, { id: Date.now(), label: '', amountTTC: '', rate: 20 }]);
  };

  const handleRemoveLine = (id: number) => {
    if (lines.length > 1) {
      setLines(lines.filter(l => l.id !== id));
    }
  };

  const updateLine = (id: number, field: keyof typeof lines[0], value: any) => {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider || totals.ttc === 0) { // Allow negative numbers, check for non-zero
      alert("Veuillez saisir un fournisseur et un montant non nul.");
      return;
    }

    const finalCategory = category === 'Autre' && customCategory ? customCategory : category;
    
    // Construct Description with details if in advanced mode
    let finalDescription = description;
    if (vatMode === 'advanced') {
       const details = lines
         .filter(l => parseFloat(l.amountTTC) !== 0)
         .map(l => `${l.label || 'Item'}: ${l.amountTTC}€ @${l.rate}%`)
         .join(' | ');
       finalDescription = description ? `${description} (${details})` : details;
    }

    const newExpense: Expense = {
      id: '', 
      date,
      provider,
      category: finalCategory,
      description: finalDescription,
      amountHT: totals.ht,
      amountTVA: totals.tva,
      amountTTC: totals.ttc,
      paymentMethod
    };

    onAddExpense(newExpense);

    // Reset Form
    setProvider('');
    setSimpleTTC('');
    setManualTVA('');
    setLines([
      { id: Date.now(), label: 'Nourriture', amountTTC: '', rate: 10 },
      { id: Date.now() + 1, label: 'Alcool', amountTTC: '', rate: 20 }
    ]);
    setDescription('');
    setCustomCategory('');
  };

  const handleCreateCategory = () => {
     if (newCategoryName.trim()) {
        onAddCategory(newCategoryName.trim());
        setNewCategoryName('');
     }
  };

  // --- REPORT LOGIC ---

  const reportData = useMemo(() => {
    // 1. CASH IN (Ventes de Vin - Factures Payées)
    const salesInvoices = invoices.filter(i => {
       const d = new Date(i.paymentDate ? i.paymentDate.split('/').reverse().join('-') : i.date.split('/').reverse().join('-'));
       return i.status === 'Paid' && d.getFullYear() === reportYear;
    });
    
    const totalSalesHT = salesInvoices.reduce((acc, i) => acc + i.totalHT, 0);
    const totalSalesTVA = salesInvoices.reduce((acc, i) => acc + i.totalTVA, 0);

    // 2. CASH OUT - WINE (Achats de Vin)
    // On se base sur les mouvements de stock entrants valorisés de l'année
    const winePurchases = stockMovements.filter(m => {
       const d = new Date(m.date);
       return d.getFullYear() === reportYear && m.type === 'IN' && m.price !== undefined;
    });

    const totalWinePurchasesHT = winePurchases.reduce((acc, m) => acc + (m.quantity * (m.price || 0)), 0);
    // Approximation TVA 20% pour le vin si non enregistré spécifiquement
    const totalWinePurchasesTVA = totalWinePurchasesHT * 0.20; 

    // 3. CASH OUT - OVERHEAD (Frais Généraux)
    const yearExpenses = expenses.filter(e => new Date(e.date).getFullYear() === reportYear);
    const totalExpensesHT = yearExpenses.reduce((acc, e) => acc + e.amountHT, 0);
    const totalExpensesTVA = yearExpenses.reduce((acc, e) => acc + e.amountTVA, 0);

    // Group expenses by category for list
    const expensesByCategory: Record<string, number> = {};
    yearExpenses.forEach(e => {
       expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amountHT;
    });

    return {
       salesHT: totalSalesHT,
       salesTVA: totalSalesTVA,
       wineCostHT: totalWinePurchasesHT,
       wineCostTVA: totalWinePurchasesTVA,
       overheadHT: totalExpensesHT,
       overheadTVA: totalExpensesTVA,
       expensesDetail: expensesByCategory,
       resultNet: totalSalesHT - totalWinePurchasesHT - totalExpensesHT,
       tvaBalance: totalSalesTVA - (totalWinePurchasesTVA + totalExpensesTVA) // TVA Collectée - TVA Déductible
    };
  }, [invoices, stockMovements, expenses, reportYear]);

  // --- CHART DATA ---
  const chartData = useMemo(() => {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const data = months.map(m => ({ name: m }));
    const activeCategories = new Set<string>();

    expenses.forEach(e => {
      const d = new Date(e.date);
      if (d.getFullYear() === reportYear) {
        const monthIndex = d.getMonth();
        const cat = e.category;
        activeCategories.add(cat);
        // @ts-ignore
        data[monthIndex][cat] = (data[monthIndex][cat] || 0) + e.amountHT;
      }
    });

    return { 
      data, 
      categories: Array.from(activeCategories).sort() 
    };
  }, [expenses, reportYear]);

  return (
    <div className="space-y-6">
      
      {/* Header Navigation */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
         <div className="flex gap-4">
            <button 
               onClick={() => setActiveTab('journal')}
               className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'journal' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
               <FileText size={18} /> Journal des Dépenses
            </button>
            <button 
               onClick={() => setActiveTab('report')}
               className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'report' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
               <PieChart size={18} /> Bilan Financier
            </button>
         </div>
         {activeTab === 'report' && (
            <div className="flex items-center gap-2">
               <label className="text-sm font-medium text-gray-600">Exercice :</label>
               <select 
                  className="bg-gray-50 border border-gray-300 rounded px-3 py-1 text-sm font-bold"
                  value={reportYear}
                  onChange={(e) => setReportYear(parseInt(e.target.value))}
               >
                  {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
               </select>
            </div>
         )}
      </div>

      {activeTab === 'journal' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Formulaire Saisie */}
           <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-fit">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                 <Plus className="text-indigo-600" /> Saisir une dépense
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Date</label>
                    <div className="relative">
                       <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                       <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                 </div>
                 
                 <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Fournisseur</label>
                    <input type="text" required placeholder="Ex: Restaurant Le Gourmet" value={provider} onChange={e => setProvider(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                 </div>

                 <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Catégorie</label>
                    <div className="flex gap-2">
                        <select value={category} onChange={e => setCategory(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                           {categories.map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
                           <option value="Autre">Autre (Saisie libre)</option>
                        </select>
                        <button type="button" onClick={() => setIsCategoryModalOpen(true)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600" title="Gérer les catégories">
                           <Settings size={18} />
                        </button>
                    </div>
                    {category === 'Autre' && (
                       <input type="text" placeholder="Préciser..." value={customCategory} onChange={e => setCustomCategory(e.target.value)} className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    )}
                 </div>

                 {/* VAT SECTION */}
                 <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 space-y-4">
                    <div className="flex gap-2 p-1 bg-white border border-gray-200 rounded-lg w-full">
                       <button type="button" onClick={() => setVatMode('simple')} className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${vatMode === 'simple' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>TVA Unique</button>
                       <button type="button" onClick={() => setVatMode('advanced')} className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${vatMode === 'advanced' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>Multi-TVA (Resto)</button>
                    </div>

                    {vatMode === 'simple' ? (
                       <div className="space-y-3">
                          <div>
                             <label className="block text-xs font-semibold text-gray-500 mb-1">Montant TTC</label>
                             <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">€</span>
                                <input 
                                   type="number" step="0.01" required 
                                   value={simpleTTC} 
                                   onChange={e => setSimpleTTC(e.target.value)} 
                                   className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-800"
                                   placeholder="0.00"
                                />
                             </div>
                             <p className="text-[10px] text-gray-400 mt-1">Saisir un nombre négatif (ex: -50) pour un avoir.</p>
                          </div>
                          <div>
                             <label className="block text-xs font-semibold text-gray-500 mb-1">Taux de TVA</label>
                             <div className="flex flex-wrap gap-2">
                                {VAT_RATES.map(r => (
                                   <button 
                                      key={r} 
                                      type="button" 
                                      onClick={() => { setSimpleRate(r); setManualTVA(''); }}
                                      className={`px-3 py-1.5 text-xs border rounded transition-colors ${simpleRate === r && manualTVA === '' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}
                                   >
                                      {r}%
                                   </button>
                                ))}
                             </div>
                          </div>
                          <div>
                             <label className="block text-xs font-semibold text-gray-500 mb-1">Montant TVA (Calculé)</label>
                             <input 
                                type="number" step="0.01"
                                value={manualTVA !== '' ? manualTVA : totals.tva} 
                                onChange={e => setManualTVA(e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none ${manualTVA ? 'bg-yellow-50 border-yellow-300 text-yellow-800' : 'bg-gray-100 text-gray-500'}`}
                             />
                             {manualTVA && <p className="text-[10px] text-yellow-700 mt-1">* Valeur manuelle</p>}
                          </div>
                       </div>
                    ) : (
                       <div className="space-y-3">
                          {lines.map((line, idx) => (
                             <div key={line.id} className="flex gap-2 items-start">
                                <div className="flex-1 space-y-1">
                                   <input 
                                      type="text" 
                                      placeholder="Libellé (ex: Vin)" 
                                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                                      value={line.label}
                                      onChange={(e) => updateLine(line.id, 'label', e.target.value)}
                                   />
                                   <div className="flex gap-2">
                                      <input 
                                         type="number" step="0.01" 
                                         placeholder="TTC" 
                                         className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-bold"
                                         value={line.amountTTC}
                                         onChange={(e) => updateLine(line.id, 'amountTTC', e.target.value)}
                                      />
                                      <select 
                                         className="flex-1 px-1 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
                                         value={line.rate}
                                         onChange={(e) => updateLine(line.id, 'rate', parseFloat(e.target.value))}
                                      >
                                         {VAT_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                                      </select>
                                   </div>
                                </div>
                                <button type="button" onClick={() => handleRemoveLine(line.id)} className="mt-6 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                             </div>
                          ))}
                          <button type="button" onClick={handleAddLine} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                             <Plus size={12} /> Ajouter une ligne
                          </button>
                       </div>
                    )}

                    {/* Summary for both modes */}
                    <div className="pt-2 border-t border-gray-200 mt-2">
                       <div className="flex justify-between text-xs text-gray-600">
                          <span>Total HT</span>
                          <span>{formatCurrency(totals.ht)}</span>
                       </div>
                       <div className="flex justify-between text-xs text-gray-600">
                          <span>Total TVA</span>
                          <span>{formatCurrency(totals.tva)}</span>
                       </div>
                       <div className="flex justify-between text-sm font-bold text-gray-900 mt-1">
                          <span>Total TTC</span>
                          <span>{formatCurrency(totals.ttc)}</span>
                       </div>
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Moyen de paiement</label>
                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                       <option value="CB">Carte Bancaire (Pro)</option>
                       <option value="Virement">Virement</option>
                       <option value="Espèces">Espèces</option>
                       <option value="Prélèvement">Prélèvement</option>
                    </select>
                 </div>

                 <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm">
                    Enregistrer la dépense
                 </button>
              </form>
           </div>

           {/* Liste des Dépenses */}
           <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                 <h3 className="font-bold text-gray-800">Historique des frais généraux</h3>
              </div>
              <div className="flex-1 overflow-auto max-h-[600px]">
                 <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0 z-10 border-b border-gray-200">
                       <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Fournisseur / Catégorie</th>
                          <th className="px-4 py-3 text-right">HT</th>
                          <th className="px-4 py-3 text-right">TVA</th>
                          <th className="px-4 py-3 text-right">TTC</th>
                          <th className="px-4 py-3 text-center">Action</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                       {expenses.length === 0 ? (
                          <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Aucune dépense enregistrée.</td></tr>
                       ) : (
                          expenses.map(exp => (
                             <tr key={exp.id} className="hover:bg-gray-50 group">
                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{new Date(exp.date).toLocaleDateString()}</td>
                                <td className="px-4 py-3">
                                   <div className="font-medium text-gray-900">{exp.provider}</div>
                                   <div className="text-xs text-gray-500 bg-gray-100 inline-block px-1.5 py-0.5 rounded mt-0.5">{exp.category}</div>
                                   {exp.description && (
                                      <div className="text-[10px] text-gray-400 mt-1 italic">{exp.description}</div>
                                   )}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(exp.amountHT)}</td>
                                <td className="px-4 py-3 text-right text-gray-400 text-xs">{formatCurrency(exp.amountTVA)}</td>
                                <td className={`px-4 py-3 text-right font-bold ${exp.amountTTC < 0 ? 'text-red-600' : 'text-gray-800'}`}>{formatCurrency(exp.amountTTC)}</td>
                                <td className="px-4 py-3 text-center">
                                   <button onClick={() => onDeleteExpense(exp.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                                </td>
                             </tr>
                          ))
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      ) : (
        <div className="space-y-6">
           {/* KPI Bilan */}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Chiffre d'Affaires (HT)</p>
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 text-green-700 rounded-lg"><TrendingUp size={20} /></div>
                    <span className="text-2xl font-bold text-gray-900">{formatCurrency(reportData.salesHT)}</span>
                 </div>
                 <p className="text-xs text-gray-500 mt-2">Factures payées {reportYear}</p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Achats Marchandises (HT)</p>
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><TrendingDown size={20} /></div>
                    <span className="text-2xl font-bold text-gray-900">{formatCurrency(reportData.wineCostHT)}</span>
                 </div>
                 <p className="text-xs text-gray-500 mt-2">Réceptions vin {reportYear}</p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Frais Généraux (HT)</p>
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 text-orange-700 rounded-lg"><CreditCard size={20} /></div>
                    <span className="text-2xl font-bold text-gray-900">{formatCurrency(reportData.overheadHT)}</span>
                 </div>
                 <p className="text-xs text-gray-500 mt-2">Dépenses hors vin {reportYear}</p>
              </div>

              <div className={`p-5 rounded-xl border shadow-sm ${reportData.resultNet >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-red-50 border-red-100'}`}>
                 <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${reportData.resultNet >= 0 ? 'text-indigo-800' : 'text-red-800'}`}>Résultat Net (Avant Impôt)</p>
                 <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${reportData.resultNet >= 0 ? 'bg-white text-indigo-700' : 'bg-white text-red-700'}`}><Landmark size={20} /></div>
                    <span className={`text-2xl font-bold ${reportData.resultNet >= 0 ? 'text-indigo-900' : 'text-red-900'}`}>{formatCurrency(reportData.resultNet)}</span>
                 </div>
                 <p className={`text-xs mt-2 ${reportData.resultNet >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>Marge brute: {formatCurrency(reportData.salesHT - reportData.wineCostHT)}</p>
              </div>
           </div>

           {/* GRAPHIQUE BARRES */}
           <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h4 className="font-bold text-gray-800 mb-6">Évolution mensuelle des charges par catégorie ({reportYear})</h4>
              <div className="h-80 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                       data={chartData.data}
                       margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                       <CartesianGrid strokeDasharray="3 3" vertical={false} />
                       <XAxis dataKey="name" axisLine={false} tickLine={false} />
                       <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${value}€`} />
                       <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                       />
                       <Legend />
                       {chartData.categories.map((cat, index) => (
                          <Bar 
                             key={cat} 
                             dataKey={cat} 
                             stackId="a" 
                             fill={CHART_COLORS[index % CHART_COLORS.length]} 
                             name={cat}
                             radius={[index === chartData.categories.length - 1 ? 4 : 0, index === chartData.categories.length - 1 ? 4 : 0, 0, 0]}
                          />
                       ))}
                    </BarChart>
                 </ResponsiveContainer>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Détail Frais Généraux */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                 <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <h4 className="font-bold text-gray-800">Répartition des Frais Généraux</h4>
                 </div>
                 <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                       {(Object.entries(reportData.expensesDetail) as [string, number][]).sort((a,b) => b[1] - a[1]).map(([cat, amount]) => (
                          <tr key={cat} className="hover:bg-gray-50">
                             <td className="px-6 py-3 text-gray-600">{cat}</td>
                             <td className="px-6 py-3 text-right font-medium text-gray-900">{formatCurrency(amount)}</td>
                             <td className="px-6 py-3 text-right text-xs text-gray-400 w-16">{reportData.overheadHT > 0 ? Math.round((amount / reportData.overheadHT) * 100) + '%' : '0%'}</td>
                          </tr>
                       ))}
                       {Object.keys(reportData.expensesDetail).length === 0 && (
                          <tr><td colSpan={3} className="p-6 text-center text-gray-400 italic">Aucune dépense cette année.</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>

              {/* Bilan TVA */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-fit">
                 <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <h4 className="font-bold text-gray-800">Bilan TVA (Estimatif)</h4>
                 </div>
                 <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                       <span className="text-gray-600">TVA Collectée (Ventes)</span>
                       <span className="font-medium text-green-600">+{formatCurrency(reportData.salesTVA)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                       <span className="text-gray-600">TVA Déductible (Achats Vin)</span>
                       <span className="font-medium text-red-600">-{formatCurrency(reportData.wineCostTVA)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                       <span className="text-gray-600">TVA Déductible (Frais Généraux)</span>
                       <span className="font-medium text-red-600">-{formatCurrency(reportData.overheadTVA)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                       <span className="font-bold text-gray-900">Solde à payer</span>
                       <span className={`font-bold text-lg ${reportData.tvaBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                          {formatCurrency(reportData.tvaBalance)}
                       </span>
                    </div>
                    <p className="text-xs text-gray-400 italic mt-2">* Ce calcul est indicatif. Le montant réel dépend de vos déclarations et dates d'exigibilité exactes.</p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Modal Gestion Catégories */}
      {isCategoryModalOpen && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
               <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-800">Catégories de dépenses</h3>
                  <button onClick={() => setIsCategoryModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                     <X size={20} />
                  </button>
               </div>
               <div className="p-4 bg-gray-50 border-b border-gray-100">
                  <div className="flex gap-2">
                     <input 
                        type="text" 
                        placeholder="Nouvelle catégorie..." 
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                     />
                     <button onClick={handleCreateCategory} disabled={!newCategoryName.trim()} className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                        <Plus size={18} />
                     </button>
                  </div>
               </div>
               <div className="p-4 max-h-[300px] overflow-y-auto space-y-2">
                  {categories.map(cat => (
                     <div key={cat.id} className="flex justify-between items-center p-2 bg-white border border-gray-200 rounded text-sm hover:bg-gray-50">
                        <span>{cat.label}</span>
                        <button onClick={() => onDeleteCategory(cat.id)} className="text-gray-400 hover:text-red-500">
                           <Trash2 size={16} />
                        </button>
                     </div>
                  ))}
                  {categories.length === 0 && <p className="text-center text-gray-400 text-xs italic">Aucune catégorie.</p>}
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default GeneralAccounting;
