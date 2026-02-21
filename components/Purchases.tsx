
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, ArrowRight, PackageCheck, AlertCircle, History, X, CheckCircle, Clock, Sparkles, Copy } from 'lucide-react';
import { Wine, Domain, PurchaseItem, StockMovement } from '../types';
import { formatCurrency, getColorBadgeClass } from '../utils';
import PaymentModal from './PaymentModal';

const Purchases = ({ 
  wines, 
  domains, 
  stockMovements,
  initialSelection, // New Prop
  onClearInitialSelection, // New Prop
  onConfirmPurchase,
  onCancelPurchase,
  onEditDomain,
  onEditWine,
  onUpdatePayment 
}: { 
  wines: Wine[], 
  domains: Domain[], 
  stockMovements: StockMovement[],
  initialSelection?: string[],
  onClearInitialSelection?: () => void,
  onConfirmPurchase: (provider: string, reference: string, items: PurchaseItem[]) => Promise<boolean>,
  onCancelPurchase: (movements: StockMovement[]) => Promise<boolean>,
  onEditDomain: (id: string) => void,
  onEditWine: (id: string | null, initialData?: Partial<Wine>) => void,
  onUpdatePayment?: (provider: string, reference: string, paymentData: { date: string, method: string }) => Promise<boolean>
}) => {
  const [activeTab, setActiveTab] = useState<'new' | 'journal'>('new');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [provider, setProvider] = useState('');
  const [reference, setReference] = useState('');
  
  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<{provider: string, reference: string} | null>(null);

  // Filters states similar to Cart
  const [regionFilter, setRegionFilter] = useState('all');
  const [subRegionFilter, setSubRegionFilter] = useState('all');
  const [domainFilter, setDomainFilter] = useState('all');
  const [itemSearch, setItemSearch] = useState('');

  // --- AUTO-ADD NEW WINE LOGIC ---
  const prevWineIdsRef = useRef<Set<string>>(new Set(wines.map(w => w.id)));
  const isCreatingRef = useRef(false);

  // Detect new wines added globally while in this view
  useEffect(() => {
    const currentWineIds = new Set(wines.map(w => w.id));
    
    // If we have more wines now than before, and we marked that we were creating one
    if (currentWineIds.size > prevWineIdsRef.current.size && isCreatingRef.current) {
        // Find the new wine
        const newWine = wines.find(w => !prevWineIdsRef.current.has(w.id));
        if (newWine) {
            // Auto add to cart
            setPurchaseItems(prev => {
                // Avoid duplicates just in case
                if (prev.find(i => i.id === newWine.id)) return prev;
                return [...prev, { ...newWine, quantity: 12, purchasePriceHT: newWine.buyingPriceHT }];
            });
            // Reset flag
            isCreatingRef.current = false;
        }
    }
    
    // Update ref for next render
    prevWineIdsRef.current = currentWineIds;
  }, [wines]);

  // --- EFFECT: Load Initial Selection ---
  useEffect(() => {
    if (initialSelection && initialSelection.length > 0) {
        setPurchaseItems(prev => {
            const newItems: PurchaseItem[] = [];
            initialSelection.forEach(id => {
                // Avoid duplicates
                if (prev.find(i => i.id === id)) return;
                
                const wine = wines.find(w => w.id === id);
                if (wine) {
                    newItems.push({
                        ...wine,
                        quantity: 12, // Default case of 12 for professional purchase
                        purchasePriceHT: wine.buyingPriceHT
                    });
                }
            });
            return [...prev, ...newItems];
        });
        // Switch to "new" tab
        setActiveTab('new');
        // Clear global selection
        if (onClearInitialSelection) onClearInitialSelection();
    }
  }, [initialSelection, wines, onClearInitialSelection]);


  // --- LOGIC JOURNAL ---
  const purchaseJournal = useMemo(() => {
    const groups: Record<string, { 
      id: string, 
      date: string, 
      provider: string, 
      reference: string, 
      items: StockMovement[], 
      totalHT: number,
      paymentStatus: 'Paid' | 'Pending',
      paymentDate?: string,
      paymentMethod?: string
    }> = {};

    stockMovements.filter(m => m.type === 'IN' && m.price !== undefined).forEach(m => {
       const dateKey = new Date(m.date).toLocaleDateString('fr-FR');
       const providerKey = m.provider || 'Inconnu';
       const refKey = m.reference || 'Sans Ref';
       const key = `${dateKey}_${providerKey}_${refKey}`;

       if (!groups[key]) {
         groups[key] = {
            id: key,
            date: dateKey,
            provider: providerKey,
            reference: refKey,
            items: [],
            totalHT: 0,
            paymentStatus: m.paymentStatus || 'Pending',
            paymentDate: m.paymentDate,
            paymentMethod: m.paymentMethod
         };
       }

       groups[key].items.push(m);
       groups[key].totalHT += (m.quantity * (m.price || 0));
       
       // Priority to Paid status if inconsistent (should not happen if batch updated)
       if (m.paymentStatus === 'Paid') groups[key].paymentStatus = 'Paid';
    });

    return Object.values(groups).sort((a, b) => {
        const dateA = a.date.split('/').reverse().join('');
        const dateB = b.date.split('/').reverse().join('');
        return dateB.localeCompare(dateA);
    });
  }, [stockMovements]);

  // --- FILTERS LOGIC (Same as Cart.tsx) ---
  const allRegions = useMemo(() => [...new Set(domains.map(d => d.region))].sort(), [domains]);
  
  const availableSubRegions = useMemo(() => {
    let relevantDomainIds = new Set(domains.map(d => d.id));
    if (regionFilter !== 'all') {
      relevantDomainIds = new Set(domains.filter(d => d.region === regionFilter).map(d => d.id));
    }
    
    const subs = new Set<string>();
    wines.forEach(w => {
        if (!w.isArchived && relevantDomainIds.has(w.domainId) && w.subRegion) {
            subs.add(w.subRegion);
        }
    });
    
    return [...subs].sort();
  }, [domains, wines, regionFilter]);

  const availableDomains = useMemo(() => {
    let relevantDomains = domains;
    if (regionFilter !== 'all') relevantDomains = relevantDomains.filter(d => d.region === regionFilter);
    
    if (subRegionFilter !== 'all') {
        const domainIdsWithSubRegion = new Set(wines
            .filter(w => w.subRegion === subRegionFilter && !w.isArchived)
            .map(w => w.domainId));
        relevantDomains = relevantDomains.filter(d => domainIdsWithSubRegion.has(d.id));
    }
    
    return relevantDomains.sort((a, b) => a.name.localeCompare(b.name));
  }, [domains, wines, regionFilter, subRegionFilter]);

  const filteredWines = wines.filter(w => {
    if (w.isArchived) return false;
    
    const domain = domains.find(d => d.id === w.domainId);
    if (!domain) return false;

    const matchesSearch = itemSearch === '' || 
      w.name.toLowerCase().includes(itemSearch.toLowerCase()) || 
      domain.name.toLowerCase().includes(itemSearch.toLowerCase());
    
    const matchesRegion = regionFilter === 'all' || domain.region === regionFilter;
    const matchesSubRegion = subRegionFilter === 'all' || w.subRegion === subRegionFilter;
    const matchesDomain = domainFilter === 'all' || w.domainId === domainFilter;

    return matchesSearch && matchesRegion && matchesSubRegion && matchesDomain;
  });

  // --- CART ACTIONS ---
  const addToCart = (wine: Wine) => {
    setPurchaseItems(prev => {
      const existing = prev.find(i => i.id === wine.id);
      if (existing) return prev; 
      return [...prev, { ...wine, quantity: 12, purchasePriceHT: wine.buyingPriceHT }];
    });
  };

  const handleCreateNewWine = () => {
      isCreatingRef.current = true;
      onEditWine(null);
  };

  const handleDuplicateWine = (wine: Wine) => {
      isCreatingRef.current = true; // IMPORTANT : Ceci déclenchera l'ajout automatique après sauvegarde
      const copyData = { ...wine, id: undefined, stock: 0 };
      onEditWine(null, copyData);
  };

  const removeFromCart = (id: string) => {
    setPurchaseItems(prev => prev.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: 'quantity' | 'purchasePriceHT', value: number) => {
    setPurchaseItems(prev => prev.map(i => {
      if (i.id === id) {
        return { ...i, [field]: value };
      }
      return i;
    }));
  };

  const totalHT = purchaseItems.reduce((sum, item) => sum + (item.purchasePriceHT * item.quantity), 0);

  const handleSubmit = async () => {
    if (!provider) return alert('Nom du fournisseur requis');
    if (purchaseItems.length === 0) return alert('La réception est vide');
    
    const success = await onConfirmPurchase(provider, reference, purchaseItems);
    if (success) {
      alert("Réception validée et stock mis à jour !");
      setPurchaseItems([]);
      setProvider('');
      setReference('');
      setActiveTab('journal'); 
    }
  };
  
  const handleCancelClick = async (entry: any) => {
     if (window.confirm(`Attention ! \n\nVous êtes sur le point d'annuler la réception de ${entry.provider} (${entry.reference}).\n\nCela va :\n1. Soustraire les quantités du stock\n2. Recalculer le PMP inversement pour retrouver le prix d'avant.\n\nContinuer ?`)) {
        await onCancelPurchase(entry.items);
     }
  };

  const openPaymentModal = (entry: any) => {
     setSelectedPurchase({ provider: entry.provider, reference: entry.reference });
     setIsPaymentModalOpen(true);
  };

  const handlePaymentConfirm = async (date: string, method: string) => {
      if (selectedPurchase && onUpdatePayment) {
          await onUpdatePayment(selectedPurchase.provider, selectedPurchase.reference, { date, method });
          setIsPaymentModalOpen(false);
          setSelectedPurchase(null);
      }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] gap-6">
       <PaymentModal 
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          onConfirm={(d, m, r) => handlePaymentConfirm(d, m)} // Ref is optional
       />

       <div className="flex p-1 bg-gray-200 rounded-lg w-fit">
          <button 
             onClick={() => setActiveTab('new')} 
             className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'new' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
             <PackageCheck size={16} /> Nouvelle Réception
          </button>
          <button 
             onClick={() => setActiveTab('journal')} 
             className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'journal' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
             <History size={16} /> Journal des Achats
          </button>
       </div>

       {activeTab === 'new' ? (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden min-h-0">
            {/* LEFT COLUMN: CATALOG */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-100 space-y-3 bg-gray-50">
                  <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input 
                          type="text" 
                          placeholder="Rechercher un vin..." 
                          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          value={itemSearch}
                          onChange={e => setItemSearch(e.target.value)}
                        />
                        {itemSearch && (
                          <button onClick={() => setItemSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              <X size={14} />
                          </button>
                        )}
                      </div>
                      <button 
                        onClick={handleCreateNewWine}
                        className="px-4 py-2 bg-red-800 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-red-900 shadow-sm transition-colors whitespace-nowrap"
                        title="Créer une nouvelle référence et l'ajouter au bon de réception"
                      >
                         <Plus size={16} /> Créer Référence
                      </button>
                  </div>
                  
                  {/* Filters */}
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none bg-white"
                      value={regionFilter}
                      onChange={(e) => {
                        setRegionFilter(e.target.value);
                        setSubRegionFilter('all');
                        setDomainFilter('all');
                      }}
                    >
                      <option value="all">Toutes régions</option>
                      {allRegions.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>

                    <select
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none bg-white disabled:bg-gray-100"
                      value={subRegionFilter}
                      onChange={(e) => {
                        setSubRegionFilter(e.target.value);
                        setDomainFilter('all');
                      }}
                      disabled={availableSubRegions.length === 0}
                    >
                      <option value="all">Toutes sous-régions</option>
                      {availableSubRegions.map(r => (
                        <option key={r} value={r as string}>{r}</option>
                      ))}
                    </select>

                    <select
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none bg-white"
                      value={domainFilter}
                      onChange={(e) => setDomainFilter(e.target.value)}
                    >
                      <option value="all">Tous les domaines</option>
                      {availableDomains.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-2">
                  {filteredWines.length === 0 ? (
                      <div className="text-center py-10 flex flex-col items-center justify-center">
                         <p className="text-gray-400 italic mb-4">Aucun vin trouvé.</p>
                         <button 
                            onClick={handleCreateNewWine}
                            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors"
                         >
                            <Sparkles size={16} /> Créer cette référence manquante
                         </button>
                      </div>
                  ) : (
                      filteredWines.map(wine => {
                        const domain = domains.find(d => d.id === wine.domainId);
                        const inCart = purchaseItems.some(i => i.id === wine.id);
                        return (
                          <div 
                            key={wine.id}
                            className={`w-full text-left p-3 rounded-lg border flex justify-between items-center group transition-all ${inCart ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-gray-100'}`}
                          >
                            <div className="flex-1 cursor-pointer" onClick={() => !inCart && addToCart(wine)}>
                              <div className="font-semibold text-gray-800">
                                {domain?.name}
                              </div>
                              <div className="text-sm text-gray-600">
                                {wine.name} <span className="text-gray-400">| {wine.vintage}</span>
                              </div>
                              <div className="mt-1 flex gap-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getColorBadgeClass(wine.color)}`}>{wine.color}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">Stock: {wine.stock}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">P.A.: {formatCurrency(wine.buyingPriceHT)}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 pl-3 border-l border-gray-100 ml-2">
                               {/* DUPLICATE BUTTON */}
                               <button 
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicateWine(wine);
                                 }}
                                 className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                 title="Dupliquer (Créer nouveau millésime)"
                               >
                                  <Copy size={16} />
                               </button>

                               {/* ADD BUTTON or STATUS */}
                               {inCart ? (
                                  <span className="text-xs font-bold text-blue-600 px-2">Sélectionné</span>
                               ) : (
                                  <button 
                                    onClick={() => addToCart(wine)}
                                    className="p-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                                  >
                                    <Plus size={16} />
                                  </button>
                               )}
                            </div>
                          </div>
                        )
                      })
                  )}
                  </div>
                </div>
            </div>

            {/* RIGHT COLUMN: RECEPTION FORM */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full overflow-hidden">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2 shrink-0">
                  <PackageCheck className="text-blue-800" /> 
                  Bon de Réception
                </h2>
                
                <div className="space-y-3 mb-4 shrink-0 bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur *</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      placeholder="Nom du fournisseur (ex: Domaine Leflaive)"
                      value={provider}
                      onChange={e => setProvider(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Référence Facture / BL</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      placeholder="N° Facture"
                      value={reference}
                      onChange={e => setReference(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-2 min-h-0">
                  {purchaseItems.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 italic border-2 border-dashed border-gray-100 rounded-lg">
                      Aucun article sélectionné.<br/>Ajoutez des vins depuis la gauche.
                    </div>
                  ) : (
                    purchaseItems.map(item => {
                      const oldStock = Math.max(0, item.stock); 
                      const oldTotal = oldStock * item.buyingPriceHT;
                      const newBatchTotal = item.quantity * item.purchasePriceHT;
                      const newTotalQty = oldStock + item.quantity;
                      const newCump = newTotalQty > 0 ? (oldTotal + newBatchTotal) / newTotalQty : item.purchasePriceHT;

                      return (
                      <div key={item.id} className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm animate-in slide-in-from-right-2 duration-300">
                          <div className="flex justify-between items-start mb-2">
                            <div className="font-medium text-gray-900 w-3/4 line-clamp-2">{item.name}</div>
                            <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mb-2">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Quantité</label>
                                <input 
                                  type="number" 
                                  min="1"
                                  className="w-full px-2 py-1 border border-gray-300 rounded bg-white text-center font-bold"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Prix Achat HT</label>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  className="w-full px-2 py-1 border border-gray-300 rounded bg-white text-center font-semibold text-blue-700"
                                  value={item.purchasePriceHT}
                                  onChange={(e) => updateItem(item.id, 'purchasePriceHT', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                          </div>
                          
                          {item.purchasePriceHT !== item.buyingPriceHT && (
                            <div className="flex items-start gap-1.5 text-xs bg-yellow-50 text-yellow-800 p-2 rounded border border-yellow-100">
                                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                <div>
                                  <div>Ancien P.A. : {formatCurrency(item.buyingPriceHT)}</div>
                                  <div className="font-bold">Nouveau P.A. (CUMP) : {formatCurrency(newCump)}</div>
                                </div>
                            </div>
                          )}
                      </div>
                    )})
                  )}
                </div>

                <div className="border-t border-gray-200 pt-4 bg-gray-50 p-4 rounded-lg mb-4 shrink-0">
                  <div className="flex justify-between text-lg font-bold text-gray-900">
                    <span>Total Réception HT</span>
                    <span>{formatCurrency(totalHT)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Le stock sera incrémenté et le P.A. moyen recalculé automatiquement.</p>
                </div>
                
                <button 
                  onClick={handleSubmit} 
                  className="w-full bg-blue-800 text-white py-3 rounded-lg font-semibold hover:bg-blue-900 transition-colors shadow-lg shadow-blue-100 flex items-center justify-center gap-2 shrink-0"
                >
                  Valider la Réception <ArrowRight size={18} />
                </button>
            </div>
         </div>
       ) : (
         // JOURNAL VIEW
         <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
               <h3 className="font-bold text-gray-800 flex items-center gap-2">
                 <History size={18} /> Historique des Achats
               </h3>
               <div className="text-sm text-gray-500">
                 Basé sur l'historique des mouvements de stock
               </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-100 sticky top-0 z-10 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Fournisseur</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Référence</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Total HT (Est.)</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Statut Paiement</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                   {purchaseJournal.length === 0 ? (
                     <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Aucune réception enregistrée pour le moment.</td></tr>
                   ) : (
                     purchaseJournal.map(entry => (
                        <React.Fragment key={entry.id}>
                           <tr className="hover:bg-blue-50 group">
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">{entry.date}</td>
                              <td className="px-6 py-4 text-sm text-gray-800 font-bold">{entry.provider}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                 {entry.reference !== 'Sans Ref' ? <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200">{entry.reference}</span> : <span className="text-gray-400 italic">-</span>}
                              </td>
                              <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                                 {formatCurrency(entry.totalHT)}
                              </td>
                              <td className="px-6 py-4 text-center">
                                 {entry.paymentStatus === 'Paid' ? (
                                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold" title={`Payé le ${entry.paymentDate} par ${entry.paymentMethod}`}>
                                       <CheckCircle size={12} /> Payé
                                    </span>
                                 ) : (
                                    <button 
                                       onClick={() => openPaymentModal(entry)}
                                       className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-bold hover:bg-orange-200 transition-colors"
                                    >
                                       <Clock size={12} /> À Payer
                                    </button>
                                 )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                 <button 
                                    onClick={() => handleCancelClick(entry)}
                                    className="p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors"
                                    title="Annuler cette réception (Retire le stock et recalcule le PMP)"
                                 >
                                    <Trash2 size={16} />
                                 </button>
                              </td>
                           </tr>
                           <tr className="bg-gray-50 border-b border-gray-100">
                              <td colSpan={6} className="px-6 py-2 pb-4">
                                 <div className="pl-4 border-l-2 border-gray-300">
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Détail des vins reçus :</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                       {entry.items.map(m => (
                                          <div key={m.id} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-gray-200">
                                             <div className="truncate pr-2" title={m.wineName}>{m.wineName}</div>
                                             <div className="whitespace-nowrap font-medium">
                                                +{m.quantity} <span className="text-gray-400">x</span> {formatCurrency(m.price || 0)}
                                             </div>
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                              </td>
                           </tr>
                        </React.Fragment>
                     ))
                   )}
                </tbody>
              </table>
            </div>
         </div>
       )}
    </div>
  )
}

export default Purchases;
