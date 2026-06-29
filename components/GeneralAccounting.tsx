
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Calendar, FileText, TrendingDown, TrendingUp, DollarSign, PieChart, CreditCard, Landmark, Settings, X, Pencil, Copy, Search, ShieldCheck, Box, History, Info, ArrowRight, Settings as SettingsIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Expense, Invoice, StockMovement, ExpenseCategory, Asset } from '../types';
import { formatCurrency, parseSmartDate, generateUUID, calculateAssetDepreciationForYear, calculateAssetDepreciationSchedule } from '../utils';

const VAT_RATES = [20, 10, 5.5, 2.1, 0];
const ASSET_DURATIONS = [
  { label: '3 ans (Informatique / Logiciel)', value: 3 },
  { label: '5 ans (Mobilier de bureau / Bureau / Téléphone)', value: 5 },
  { label: '10 ans (Aménagement / Gros mobilier)', value: 10 },
  { label: '2 ans', value: 2 },
  { label: '4 ans', value: 4 },
  { label: '7 ans', value: 7 }
];

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
  assets = [],
  invoices, 
  stockMovements,
  onAddExpense, 
  onDeleteExpense,
  onAddCategory,
  onDeleteCategory,
  onAddAsset,
  onDeleteAsset,
  defaultTab = 'journal'
}: { 
  expenses: Expense[], 
  categories: ExpenseCategory[],
  assets: Asset[],
  invoices: Invoice[], 
  stockMovements: StockMovement[],
  onAddExpense: (e: Expense) => void, 
  onDeleteExpense: (id: string) => void,
  onAddCategory: (label: string) => void,
  onDeleteCategory: (id: string) => void,
  onAddAsset: (a: Asset) => void,
  onDeleteAsset: (id: string) => void,
  defaultTab?: 'journal' | 'assets' | 'report'
}) => {
  const [activeTab, setActiveTab] = useState<'journal' | 'assets' | 'report'>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Asset State
  const [assetEditId, setAssetEditId] = useState<string | null>(null);
  const [assetForm, setAssetForm] = useState<Partial<Asset>>({
    purchaseDate: new Date().toISOString().split('T')[0],
    durationYears: 5,
    category: 'Mobilier'
  });
  const [showManualAssetForm, setShowManualAssetForm] = useState(false);

  // Form State (Expenses)
  const [editId, setEditId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [provider, setProvider] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CB');
  const [linkedAssetId, setLinkedAssetId] = useState<string | undefined>(undefined);

  // Suggested Asset logic
  const [isAssetSuggestionOpen, setIsAssetSuggestionOpen] = useState(false);
  const [pendingExpenseForAsset, setPendingExpenseForAsset] = useState<Expense | null>(null);
  const [selectedAssetForSchedule, setSelectedAssetForSchedule] = useState<Asset | null>(null);

  // VAT & Amount Management
  const [vatMode, setVatMode] = useState<'simple' | 'advanced'>('simple');
  
  // Simple Mode State
  const [entryMode, setEntryMode] = useState<'HT' | 'TTC'>('TTC');
  const [amount, setAmount] = useState('');
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
      const entryVal = parseFloat(amount) || 0;
      
      if (entryMode === 'TTC') {
        ttc = entryVal;
        // Extraction
        if (manualTVA !== '') {
          tva = parseFloat(manualTVA) || 0;
          ht = ttc - tva;
        } else {
          ht = ttc / (1 + simpleRate / 100);
          tva = ttc - ht;
        }
      } else {
        // Entry is HT
        ht = entryVal;
        if (manualTVA !== '') {
          tva = parseFloat(manualTVA) || 0;
          ttc = ht + tva;
        } else {
          tva = ht * (simpleRate / 100);
          ttc = ht + tva;
        }
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
  }, [vatMode, amount, entryMode, simpleRate, manualTVA, lines]);

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

  const handleEditExpense = (exp: Expense) => {
      setEditId(exp.id);
      setDate(exp.date);
      setProvider(exp.provider);
      setCategory(exp.category); 
      setDescription(exp.description || '');
      setPaymentMethod(exp.paymentMethod);
      setLinkedAssetId(exp.assetId);
      
      setVatMode('simple');
      setAmount(exp.amountTTC.toString());
      setEntryMode('TTC');
      setManualTVA(exp.amountTVA.toString());
      
      const exists = categories.some(c => c.label === exp.category);
      if (!exists && exp.category !== 'Autre') {
          setCategory('Autre');
          setCustomCategory(exp.category);
      }
  };

  const handleDuplicateExpense = (exp: Expense) => {
      setEditId(null); 
      setDate(new Date().toISOString().split('T')[0]); 
      setProvider(exp.provider);
      setCategory(exp.category);
      setDescription(exp.description || '');
      setPaymentMethod(exp.paymentMethod);
      setLinkedAssetId(undefined); // Don't duplicate asset link
      
      setVatMode('simple');
      setAmount(exp.amountTTC.toString());
      setEntryMode('TTC');
      setManualTVA(exp.amountTVA.toString());
      
      const exists = categories.some(c => c.label === exp.category);
      if (!exists && exp.category !== 'Autre') {
          setCategory('Autre');
          setCustomCategory(exp.category);
      }
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider || totals.ttc === 0) {
      alert("Veuillez saisir un fournisseur et un montant non nul.");
      return;
    }

    const finalCategory = category === 'Autre' && customCategory ? customCategory : category;
    
    let finalDescription = description;
    if (vatMode === 'advanced') {
       const details = lines
         .filter(l => parseFloat(l.amountTTC) !== 0)
         .map(l => `${l.label || 'Item'}: ${l.amountTTC}€ @${l.rate}%`)
         .join(' | ');
       finalDescription = description ? `${description} (${details})` : details;
    }

    const newExpense: Expense = {
      id: editId || generateUUID(), // Ensure UUID for linking
      date,
      provider,
      category: finalCategory,
      description: finalDescription,
      amountHT: totals.ht,
      amountTVA: totals.tva,
      amountTTC: totals.ttc,
      paymentMethod,
      assetId: linkedAssetId
    };

    // --- IMMO CHECK (500€ Rule) ---
    if (!newExpense.assetId && newExpense.amountHT >= 500 && !editId) {
       setPendingExpenseForAsset(newExpense);
       setIsAssetSuggestionOpen(true);
       return; // Wait for suggestion modal
    }

    onAddExpense(newExpense);
    resetExpenseForm();
  };

  const resetExpenseForm = () => {
    setEditId(null);
    setProvider('');
    setAmount('');
    setManualTVA('');
    setLines([
      { id: Date.now(), label: 'Nourriture', amountTTC: '', rate: 10 },
      { id: Date.now() + 1, label: 'Alcool', amountTTC: '', rate: 20 }
    ]);
    setDescription('');
    setCustomCategory('');
    setLinkedAssetId(undefined);
  };

  const handleConfirmAssetCreation = () => {
     if (pendingExpenseForAsset) {
        const newAsset: Asset = {
           id: generateUUID(),
           name: pendingExpenseForAsset.provider + " - " + (pendingExpenseForAsset.description || "Achat"),
           category: pendingExpenseForAsset.category,
           purchaseDate: pendingExpenseForAsset.date,
           amountHT: pendingExpenseForAsset.amountHT,
           vatAmount: pendingExpenseForAsset.amountTVA,
           durationYears: 5,
           startDepreciationDate: pendingExpenseForAsset.date
        };
        
        onAddAsset(newAsset);
        onAddExpense({ ...pendingExpenseForAsset, assetId: newAsset.id });
     }
     setIsAssetSuggestionOpen(false);
     setPendingExpenseForAsset(null);
     resetExpenseForm();
  };

  const handleSkipAssetCreation = () => {
     if (pendingExpenseForAsset) {
        onAddExpense(pendingExpenseForAsset);
     }
     setIsAssetSuggestionOpen(false);
     setPendingExpenseForAsset(null);
     resetExpenseForm();
  };

  const handleSubmitAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetForm.name || !assetForm.amountHT) return;

    const finalAsset: Asset = {
      id: assetEditId || generateUUID(),
      name: assetForm.name,
      category: assetForm.category || 'Mobilier',
      purchaseDate: assetForm.purchaseDate || new Date().toISOString().split('T')[0],
      amountHT: Number(assetForm.amountHT),
      vatAmount: Number(assetForm.vatAmount || 0),
      durationYears: Number(assetForm.durationYears || 5),
      startDepreciationDate: assetForm.startDepreciationDate || assetForm.purchaseDate || new Date().toISOString().split('T')[0],
      description: assetForm.description,
      isArchived: false
    };

    onAddAsset(finalAsset);
    setAssetEditId(null);
    setAssetForm({ purchaseDate: new Date().toISOString().split('T')[0], durationYears: 5, category: 'Mobilier' });
  };

  const handleCancelEdit = () => {
      setEditId(null);
      setProvider('');
      setAmount('');
      setManualTVA('');
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
    // 1. REVENU HT (CA Facturé - Engagement)
    const salesInvoices = invoices.filter(i => {
       const dateStr = i.invoiceDate || i.date;
       const d = parseSmartDate(dateStr);
       return (i.type === 'Sale') && (i.status === 'Validated' || i.status === 'Paid') && d.getFullYear() === reportYear;
    });

    // 1b. TVA COLLECTÉE (Sur Encaissements - Uniquement les payées)
    const paidSalesInvoices = invoices.filter(i => {
       const dateStr = i.paymentDate || i.invoiceDate || i.date;
       const d = parseSmartDate(dateStr);
       return (i.type === 'Sale') && (i.status === 'Paid') && d.getFullYear() === reportYear;
    });
    
    const totalSalesHT = salesInvoices.reduce((acc, i) => acc + i.totalHT, 0);
    const totalSalesTVA = paidSalesInvoices.reduce((acc, i) => acc + i.totalTVA, 0);

    // 2. ACHATS VINS (Engagement + Suivi Dette)
    const winePurchases = invoices.filter(i => {
       const dateStr = i.invoiceDate || i.date;
       const d = parseSmartDate(dateStr);
       return i.type?.toLowerCase() === 'purchase' && (i.status !== 'Cancelled') && d.getFullYear() === reportYear;
    });

    const totalWinePurchasesHT = winePurchases.reduce((acc, i) => acc + i.totalHT, 0);
    const totalWinePurchasesTVA = winePurchases.reduce((acc, i) => acc + i.totalTVA, 0);
    const paidWinePurchasesHT = winePurchases.filter(i => i.status === 'Paid').reduce((acc, i) => acc + i.totalHT, 0);
    const debtWinePurchasesHT = totalWinePurchasesHT - paidWinePurchasesHT;

    // 3. CHARGES & FRAIS GÉNÉRAUX
    const yearExpenses = expenses.filter(e => new Date(e.date).getFullYear() === reportYear);
    
    // Séparation URSSAF
    const urssafExpenses = yearExpenses.filter(e => e.category.toLowerCase().includes('urssaf') || e.category.toLowerCase().includes('social'));
    const urssafHT = urssafExpenses.reduce((acc, e) => acc + e.amountHT, 0);
    
    const overheadHT = yearExpenses.filter(e => !e.assetId && !urssafExpenses.includes(e)).reduce((acc, e) => acc + e.amountHT, 0);
    const overheadTVA = yearExpenses.reduce((acc, e) => acc + e.amountTVA, 0);

    // 4. DEPRECIATION (Amortissements)
    const totalDepreciation = (assets || []).reduce((acc, asset) => {
       return acc + calculateAssetDepreciationForYear(asset, reportYear);
    }, 0);

    // Group expenses by category for list
    const expensesByCategory: Record<string, number> = {};
    yearExpenses.forEach(e => {
       if (!e.assetId) {
          expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amountHT;
       }
    });

    return {
       salesHT: totalSalesHT,
       salesTVA: totalSalesTVA,
       wineCostHT: totalWinePurchasesHT,
       wineCostTVA: totalWinePurchasesTVA,
       paidWinePurchasesHT,
       debtWinePurchasesHT,
       overheadHT,
       overheadTVA,
       urssafHT,
       depreciation: totalDepreciation,
       expensesDetail: expensesByCategory,
       resultNet: totalSalesHT - totalWinePurchasesHT - overheadHT - urssafHT - totalDepreciation,
       tvaBalance: totalSalesTVA - (totalWinePurchasesTVA + overheadTVA) 
    };
  }, [invoices, stockMovements, expenses, assets, reportYear]);

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

  const filteredExpenses = useMemo(() => {
    if (!expenseSearch) return expenses;
    const lowerSearch = expenseSearch.toLowerCase();
    return expenses.filter(exp => 
      exp.provider.toLowerCase().includes(lowerSearch) || 
      exp.category.toLowerCase().includes(lowerSearch)
    );
  }, [expenses, expenseSearch]);

  const filteredExpensesTotalHT = useMemo(() => filteredExpenses.reduce((sum, exp) => sum + exp.amountHT, 0), [filteredExpenses]);
  const filteredExpensesTotalTTC = useMemo(() => filteredExpenses.reduce((sum, exp) => sum + exp.amountTTC, 0), [filteredExpenses]);

  return (
    <div className="space-y-6">
      
      {/* Header Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button 
               onClick={() => setActiveTab('journal')}
               className={`flex-1 md:flex-none justify-center flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'journal' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
               <FileText size={18} /> <span className="hidden sm:inline">Journal des Dépenses</span><span className="sm:hidden">Journal</span>
            </button>
            <button 
               onClick={() => setActiveTab('assets')}
               className={`flex-1 md:flex-none justify-center flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'assets' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
               <ShieldCheck size={18} /> <span className="hidden sm:inline">Immobilisations</span><span className="sm:hidden">Immo</span>
            </button>
            <button 
               onClick={() => setActiveTab('report')}
               className={`flex-1 md:flex-none justify-center flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'report' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
               <PieChart size={18} /> <span className="hidden sm:inline">Bilan Financier</span><span className="sm:hidden">Bilan</span>
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
                  {editId ? <Pencil className="text-orange-600" /> : <Plus className="text-indigo-600" />}
                  {editId ? 'Modifier la dépense' : 'Saisir une dépense'}
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
                            <SettingsIcon size={18} />
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
                        <div className="space-y-4">
                           <div className="flex gap-2 p-1 bg-indigo-50 border border-indigo-100 rounded-lg">
                              <button 
                                 type="button" 
                                 onClick={() => setEntryMode('HT')} 
                                 className={`flex-1 py-1 text-[10px] uppercase font-bold rounded ${entryMode === 'HT' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-400 hover:bg-white'}`}
                              >
                                 Saisie HT
                              </button>
                              <button 
                                 type="button" 
                                 onClick={() => setEntryMode('TTC')} 
                                 className={`flex-1 py-1 text-[10px] uppercase font-bold rounded ${entryMode === 'TTC' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-400 hover:bg-white'}`}
                              >
                                 Saisie TTC
                              </button>
                           </div>

                           <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">
                                 Montant {entryMode}
                              </label>
                              <div className="relative">
                                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">€</span>
                                 <input 
                                    type="number" step="0.01" required 
                                    value={amount} 
                                    onChange={e => setAmount(e.target.value)} 
                                    className="w-full pl-8 pr-3 py-2 border border-indigo-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-800 bg-white"
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

                           <div className="pt-2">
                              <div className="flex justify-between text-[10px] font-medium px-1 mb-1">
                                 <span className="text-gray-400">
                                    {entryMode === 'HT' ? (
                                       <>Base HT {formatCurrency(totals.ht)} + TVA {simpleRate}%</>
                                    ) : (
                                       <>Total TTC {formatCurrency(totals.ttc)} - TVA {simpleRate}%</>
                                    )}
                                 </span>
                                 <span className="text-indigo-600">Calcul auto</span>
                              </div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Montant TVA</label>
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
                                 <button type="button" onClick={() => handleRemoveLine(line.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
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

                  <div className="flex gap-2">
                     {editId && (
                        <button type="button" onClick={handleCancelEdit} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm">
                           Annuler
                        </button>
                     )}
                     <button type="submit" className={`flex-1 ${editId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white py-2 rounded-lg transition-colors font-medium text-sm shadow-sm`}>
                        {editId ? 'Mettre à jour' : 'Enregistrer'}
                     </button>
                  </div>
               </form>
            </div>

            {/* Liste des Dépenses */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
               <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center gap-4 flex-wrap">
                  <h3 className="font-bold text-gray-800 whitespace-nowrap">Historique des frais généraux</h3>
                  
                  <div className="flex items-center gap-4 flex-1 justify-end min-w-[300px]">
                     <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input 
                           type="text" 
                           placeholder="Filtrer par fournisseur ou catégorie..." 
                           className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                           value={expenseSearch}
                           onChange={e => setExpenseSearch(e.target.value)}
                        />
                        {expenseSearch && (
                           <button onClick={() => setExpenseSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              <X size={14} />
                           </button>
                        )}
                     </div>
                     
                     {expenseSearch && (
                        <div className="flex items-center gap-3 text-sm bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                           <div className="flex flex-col items-end">
                              <span className="text-xs text-indigo-600 font-medium">Total filtré HT</span>
                              <span className="font-bold text-indigo-900">{formatCurrency(filteredExpensesTotalHT)}</span>
                           </div>
                           <div className="w-px h-8 bg-indigo-200"></div>
                           <div className="flex flex-col items-end">
                              <span className="text-xs text-indigo-600 font-medium">Total filtré TTC</span>
                              <span className="font-bold text-indigo-900">{formatCurrency(filteredExpensesTotalTTC)}</span>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
               <div className="flex-1 overflow-auto max-h-[600px]">
                  <table className="w-full text-left text-sm min-w-[600px]">
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
                        {filteredExpenses.length === 0 ? (
                           <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Aucune dépense trouvée.</td></tr>
                        ) : (
                           filteredExpenses.map(exp => (
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
                                    <div className="flex items-center justify-center gap-2">
                                       <button onClick={() => handleDuplicateExpense(exp)} className="text-emerald-500 hover:text-emerald-700 p-1" title="Dupliquer"><Copy size={16} /></button>
                                       <button onClick={() => handleEditExpense(exp)} className="text-blue-400 hover:text-blue-600 p-1" title="Modifier"><Pencil size={16} /></button>
                                       <button onClick={() => onDeleteExpense(exp.id)} className="text-red-400 hover:text-red-600 p-1" title="Supprimer"><Trash2 size={16} /></button>
                                    </div>
                                 </td>
                              </tr>
                           ))
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>
      ) : activeTab === 'assets' ? (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
               {assetEditId || showManualAssetForm ? (
                  <div className="bg-white rounded-xl shadow-sm border border-orange-200 p-6 h-fit bg-gradient-to-br from-white to-orange-50/30">
                     <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        {assetEditId ? <Pencil size={20} className="text-orange-600" /> : <Plus size={20} className="text-indigo-600" />}
                        {assetEditId ? "Modifier l'Immobilisation" : "Saisir une Immobilisation"}
                     </h3>
                     <form onSubmit={(e) => { handleSubmitAsset(e); setShowManualAssetForm(false); }} className="space-y-4">
                        <div>
                           <label className="block text-xs font-semibold text-gray-500 mb-1">Nom du bien / Désignation</label>
                           <input type="text" required placeholder="Ex: Mac Book Pro M3" value={assetForm.name || ''} onChange={e => setAssetForm({...assetForm, name: e.target.value})} className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Date d'achat</label>
                              <input 
                                type="date" 
                                required 
                                value={assetForm.purchaseDate || ''} 
                                onChange={e => setAssetForm({...assetForm, purchaseDate: e.target.value, startDepreciationDate: assetForm.startDepreciationDate || e.target.value})} 
                                className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                              />
                           </div>
                           <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Mise en service</label>
                              <input 
                                type="date" 
                                required 
                                value={assetForm.startDepreciationDate || assetForm.purchaseDate || ''} 
                                onChange={e => setAssetForm({...assetForm, startDepreciationDate: e.target.value})} 
                                className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                              />
                           </div>
                           <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Montant HT</label>
                              <div className="relative">
                                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">€</span>
                                 <input type="number" step="0.01" required value={assetForm.amountHT || ''} onChange={e => setAssetForm({...assetForm, amountHT: e.target.value})} className="w-full pl-7 pr-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" />
                              </div>
                           </div>
                        </div>
                        <div>
                           <label className="block text-xs font-semibold text-gray-500 mb-1">Durée d'amortissement</label>
                           <select value={assetForm.durationYears} onChange={e => setAssetForm({...assetForm, durationYears: Number(e.target.value)})} className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                              {ASSET_DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                           </select>
                        </div>
                        <div className="pt-2 flex gap-2">
                           <button type="submit" className={`flex-1 ${assetEditId ? 'bg-orange-600' : 'bg-indigo-600'} text-white py-2 rounded-lg hover:opacity-90 transition-colors font-medium text-sm shadow-sm`}>
                              {assetEditId ? 'Mettre à jour' : 'Enregistrer'}
                           </button>
                           <button type="button" onClick={() => {setAssetEditId(null); setShowManualAssetForm(false); setAssetForm({purchaseDate: new Date().toISOString().split('T')[0], durationYears: 5, category: 'Mobilier'});}} className="px-4 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                              Annuler
                           </button>
                        </div>
                     </form>
                  </div>
               ) : (
                  <div className="bg-indigo-50 rounded-xl shadow-sm border border-indigo-200 p-6 h-fit border-dashed text-center">
                     <div className="inline-flex p-3 bg-white rounded-full text-indigo-600 shadow-sm border border-indigo-100 mb-4">
                        <Landmark size={24} />
                     </div>
                     <h3 className="font-bold text-indigo-900">Gestion des Immos</h3>
                     <p className="text-xs text-indigo-700 mt-2 leading-relaxed mb-4">
                        Les immo courantes se créent via le <strong>Journal</strong> ({'>'} 500€ HT). 
                        Utilisez le bouton ci-dessous pour saisir un historique ou une immo manuelle.
                     </p>
                     <button 
                        onClick={() => setShowManualAssetForm(true)}
                        className="w-full py-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                     >
                        <Plus size={14} /> Saisie manuelle / Historique
                     </button>
                  </div>
               )}
               
               <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                  <h4 className="text-xs font-bold text-blue-800 flex items-center gap-1 mb-2"><Info size={14} /> Rappel Fiscal</h4>
                  <p className="text-[10px] text-blue-700 leading-relaxed">
                     Tout investissement supérieur à <strong>500€ HT</strong> doit être immobilisé. Le montant n'est pas déduit en une fois mais étalé sur sa durée d'usage (Dotation aux amortissements).
                  </p>
               </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-fit">
               <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="font-bold text-gray-800">Registre des Immobilisations</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                     <Box size={14} className="text-indigo-500" />
                     {assets.length} actif(s)
                  </div>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[600px]">
                     <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                        <tr>
                           <th className="px-4 py-3">Bien</th>
                           <th className="px-4 py-3">Achat</th>
                           <th className="px-4 py-3">Durée</th>
                           <th className="px-4 py-3 text-right">Montant HT</th>
                           <th className="px-4 py-3 text-right">Annuite (Régime)</th>
                           <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                        {assets.length === 0 ? (
                           <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Aucune immobilisation enregistrée.</td></tr>
                        ) : (
                           assets.map(a => (
                              <tr key={a.id} className="hover:bg-gray-50 group">
                                 <td className="px-4 py-3">
                                    <div className="font-medium text-gray-900">{a.name}</div>
                                    <div className="text-xs text-gray-500">{a.category}</div>
                                 </td>
                                 <td className="px-4 py-3 text-gray-600">{new Date(a.purchaseDate).toLocaleDateString()}</td>
                                 <td className="px-4 py-3 text-gray-600">{a.durationYears} ans</td>
                                 <td className="px-4 py-3 text-right font-bold">{formatCurrency(a.amountHT)}</td>
                                 <td className="px-4 py-3 text-right text-indigo-600 font-medium">{formatCurrency(calculateAssetDepreciationForYear(a, reportYear))} en {reportYear}</td>
                                 <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                       <button onClick={() => setSelectedAssetForSchedule(a)} className="text-indigo-400 hover:text-indigo-600 p-1" title="Voir l'échéancier d'amortissement"><Calendar size={16} /></button>
                                       <button onClick={() => { setAssetEditId(a.id); setAssetForm(a); }} className="text-blue-400 hover:text-blue-600 p-1"><Pencil size={16} /></button>
                                       <button onClick={() => onDeleteAsset(a.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                                    </div>
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
                  <div className="flex justify-between items-start mb-2">
                     <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Chiffre d'Affaires HT</p>
                     <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-bold">FACTURE</span>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-green-100 text-green-700 rounded-lg"><TrendingUp size={20} /></div>
                     <span className="text-2xl font-bold text-gray-900">{formatCurrency(reportData.salesHT)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 italic">Exercice {reportYear} (Engagement)</p>
               </div>

               <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Achats Vins HT</p>
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><TrendingDown size={20} /></div>
                     <span className="text-2xl font-bold text-gray-900">{formatCurrency(reportData.wineCostHT)}</span>
                  </div>
                  <div className="mt-2 flex flex-col gap-1">
                     <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">Décaissé (Payé):</span>
                        <span className="font-bold text-green-600">{formatCurrency(reportData.paidWinePurchasesHT)}</span>
                     </div>
                     <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">Dette vigneron (À payer):</span>
                        <span className="font-bold text-red-600">{formatCurrency(reportData.debtWinePurchasesHT)}</span>
                     </div>
                  </div>
               </div>

               <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Charges & Social HT</p>
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-orange-100 text-orange-700 rounded-lg"><CreditCard size={20} /></div>
                     <span className="text-2xl font-bold text-gray-900">{formatCurrency(reportData.overheadHT + reportData.urssafHT)}</span>
                  </div>
                  <div className="mt-2 flex flex-col gap-1">
                     <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">URSSAF / Social:</span>
                        <span className="font-bold text-orange-600">{formatCurrency(reportData.urssafHT)}</span>
                     </div>
                     <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">Frais Généraux:</span>
                        <span className="font-bold text-gray-700">{formatCurrency(reportData.overheadHT)}</span>
                     </div>
                  </div>
               </div>

               <div className={`p-5 rounded-xl border shadow-sm ${reportData.resultNet >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-red-50 border-red-100'}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${reportData.resultNet >= 0 ? 'text-indigo-800' : 'text-red-800'}`}>Résultat Net Estimé</p>
                  <div className="flex items-center gap-3">
                     <div className={`p-2 rounded-lg ${reportData.resultNet >= 0 ? 'bg-white text-indigo-700' : 'bg-white text-red-700'}`}><Landmark size={20} /></div>
                     <span className={`text-2xl font-bold ${reportData.resultNet >= 0 ? 'text-indigo-900' : 'text-red-900'}`}>{formatCurrency(reportData.resultNet)}</span>
                  </div>
                  <p className={`text-xs mt-2 ${reportData.resultNet >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>Après {formatCurrency(reportData.depreciation)} d'amortissements</p>
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
                  <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                     <h4 className="font-bold text-gray-800">Charges & Amortissements</h4>
                     <span className="text-[10px] text-gray-400 bg-white px-2 py-0.5 rounded border">Année {reportYear}</span>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-sm min-w-[400px]">
                        <tbody className="divide-y divide-gray-100">
                           <tr className="bg-indigo-50/30">
                              <td className="px-6 py-3 font-semibold text-indigo-900 border-l-4 border-indigo-500">Dotation aux amortissements</td>
                              <td className="px-6 py-3 text-right font-bold text-indigo-700">{formatCurrency(reportData.depreciation)}</td>
                              <td className="px-6 py-3 text-right text-xs text-gray-400 w-16">
                                 {reportData.overheadHT + reportData.urssafHT + reportData.depreciation > 0 
                                     ? Math.round((reportData.depreciation / (reportData.overheadHT + reportData.urssafHT + reportData.depreciation)) * 100) + '%' 
                                     : '0%'}
                              </td>
                           </tr>
                           <tr className="bg-orange-50/30">
                              <td className="px-6 py-3 font-semibold text-orange-900 border-l-4 border-orange-500">Charges Sociales (URSSAF)</td>
                              <td className="px-6 py-3 text-right font-bold text-orange-700">{formatCurrency(reportData.urssafHT)}</td>
                              <td className="px-6 py-3 text-right text-xs text-gray-400 w-16">
                                 {reportData.overheadHT + reportData.urssafHT + reportData.depreciation > 0 
                                     ? Math.round((reportData.urssafHT / (reportData.overheadHT + reportData.urssafHT + reportData.depreciation)) * 100) + '%' 
                                     : '0%'}
                              </td>
                           </tr>
                           {(Object.entries(reportData.expensesDetail) as [string, number][])
                              .filter(([cat]) => !cat.toLowerCase().includes('urssaf') && !cat.toLowerCase().includes('social'))
                              .sort((a,b) => b[1] - a[1]).map(([cat, amount]) => (
                              <tr key={cat} className="hover:bg-gray-50">
                                 <td className="px-6 py-3 text-gray-600">{cat}</td>
                                 <td className="px-6 py-3 text-right font-medium text-gray-900">{formatCurrency(amount)}</td>
                                 <td className="px-6 py-3 text-right text-xs text-gray-400 w-16">
                                    {reportData.overheadHT + reportData.urssafHT + reportData.depreciation > 0 
                                       ? Math.round((amount / (reportData.overheadHT + reportData.urssafHT + reportData.depreciation)) * 100) + '%' 
                                       : '0%'}
                                 </td>
                              </tr>
                           ))}
                           {Object.keys(reportData.expensesDetail).length === 0 && reportData.depreciation === 0 && (
                              <tr><td colSpan={3} className="p-6 text-center text-gray-400 italic">Aucune charge cette année.</td></tr>
                           )}
                        </tbody>
                     </table>
                  </div>
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

      {/* Modal Suggestion Immobilisation */}
      {isAssetSuggestionOpen && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
               <div className="p-6 text-center border-b border-gray-100 bg-indigo-50">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                     <ShieldCheck size={32} className="text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-bold text-indigo-900 mb-2">Règle des 500€</h3>
                  <p className="text-sm text-indigo-700">
                     Cette dépense de <span className="font-bold">{formatCurrency(pendingExpenseForAsset?.amountHT || 0)} HT</span> dépasse le seuil légal de 500€.
                  </p>
               </div>
               <div className="p-6 space-y-4">
                  <p className="text-sm text-gray-600 text-center">
                     Souhaitez-vous classer ce bien en <strong>immobilisation</strong> ? 
                     Cela l'ajoutera automatiquement à votre registre d'actifs pour l'amortir sur plusieurs années.
                  </p>
                  <div className="flex flex-col gap-2">
                     <button onClick={handleConfirmAssetCreation} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-md">
                        Oui, immobiliser ce bien
                     </button>
                     <button onClick={handleSkipAssetCreation} className="w-full bg-white text-gray-500 py-3 rounded-xl font-medium hover:bg-gray-50 border border-gray-200">
                        Non, laisser en frais simples
                     </button>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* Modal Échéancier d'amortissement */}
      {selectedAssetForSchedule && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
               <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Échéancier d'amortissement</h3>
                    <p className="text-xs text-indigo-600 font-medium">{selectedAssetForSchedule.name}</p>
                  </div>
                  <button onClick={() => setSelectedAssetForSchedule(null)} className="text-gray-400 hover:text-gray-600">
                     <X size={20} />
                  </button>
               </div>
               <div className="p-6">
                  <div className="mb-4 flex flex-col gap-1 text-xs text-gray-500 pb-4 border-b border-gray-100">
                    <div className="flex justify-between">
                      <span>Prix d'achat HT:</span>
                      <span className="font-bold text-gray-800">{formatCurrency(selectedAssetForSchedule.amountHT)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date d'achat:</span>
                      <span className="font-bold text-gray-800">{new Date(selectedAssetForSchedule.purchaseDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Durée:</span>
                      <span className="font-bold text-gray-800">{selectedAssetForSchedule.durationYears} ans</span>
                    </div>
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-[10px] uppercase tracking-wider border-b border-gray-50">
                        <th className="py-2 text-left">Année</th>
                        <th className="py-2 text-right">Dotation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {calculateAssetDepreciationSchedule(selectedAssetForSchedule).map((item) => (
                        <tr key={item.year} className={item.year === reportYear ? "bg-indigo-50/50" : ""}>
                          <td className="py-2 py-2 font-medium text-gray-700">
                            {item.year}
                            {item.year === reportYear && <span className="ml-2 text-[8px] bg-indigo-600 text-white px-1 rounded">ACTUEL</span>}
                          </td>
                          <td className="py-2 text-right font-bold text-indigo-700">{formatCurrency(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-100">
                        <td className="pt-3 font-bold text-gray-900 border-t-2 border-gray-100">TOTAL</td>
                        <td className="pt-3 text-right font-bold text-gray-900 border-t-2 border-gray-100">{formatCurrency(selectedAssetForSchedule.amountHT)}</td>
                      </tr>
                    </tfoot>
                  </table>

                  <button 
                    onClick={() => setSelectedAssetForSchedule(null)}
                    className="w-full mt-6 bg-gray-100 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-200"
                  >
                    Fermer
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default GeneralAccounting;
