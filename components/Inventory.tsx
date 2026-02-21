
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Eye, EyeOff, ChevronRight, ChevronDown, Pencil, Trash2, Copy, Package, Download, History, ShoppingCart, PackagePlus, CheckSquare, Square, PackageCheck, AlertCircle, ArrowRight, X } from 'lucide-react';
import { Wine, Domain, Invoice, StockMovement, Client, PurchaseItem } from '../types';
import { formatCurrency, getColorBadgeClass, getSellingPrice, getSmartCoefficient } from '../utils';

const Inventory = ({ 
  wines, 
  domains,
  clients,
  invoices,
  stockMovements,
  facCount,
  proCount,
  onStockUpdate,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onUpdateDomain,
  onToggleArchive,
  onRestoreBackup,
  onResetData,
  onEditDomain,
  onEditWine,
  onTransferTo,
  onConfirmPurchase // New prop passed from App
}: { 
  wines: Wine[], 
  domains: Domain[],
  clients: Client[],
  invoices: Invoice[],
  stockMovements: StockMovement[],
  facCount: number,
  proCount: number,
  onStockUpdate: (id: string, newStock: number) => void,
  onAddProduct: (wine: Wine, domainName?: string, domainCoef?: number, domainRegion?: string) => void,
  onUpdateProduct: (wine: Wine, domainName?: string, domainCoef?: number, domainRegion?: string) => void,
  onDeleteProduct: (id: string) => void,
  onUpdateDomain: (id: string, updates: Partial<Domain>) => void,
  onToggleArchive: (id: string) => void,
  onRestoreBackup: (data: any) => void,
  onResetData: () => void,
  onEditDomain: (domainId: string) => void,
  onEditWine: (wineId: string | null, initialData?: Partial<Wine>) => void,
  onTransferTo: (wineIds: string[], destination: 'sales' | 'purchases') => void,
  onConfirmPurchase: (provider: string, reference: string, items: PurchaseItem[]) => Promise<boolean>
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [subRegionFilter, setSubRegionFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all'); 
  const [showArchived, setShowArchived] = useState(false);
  const [collapsedRegions, setCollapsedRegions] = useState<string[]>([]);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // --- RECEPTION MODE STATE ---
  const [isReceptionMode, setIsReceptionMode] = useState(false);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [provider, setProvider] = useState('');
  const [reference, setReference] = useState('');

  // --- AUTO-ADD NEW WINE LOGIC (For Reception Mode) ---
  const prevWineIdsRef = useRef<Set<string>>(new Set(wines.map(w => w.id)));
  
  // Cette Ref sert à savoir si on a cliqué sur "Nouveau" pour déclencher l'ajout auto
  const isCreatingRef = useRef(false);

  useEffect(() => {
    const currentWineIds = new Set(wines.map(w => w.id));
    
    // Si on a plus de vins maintenant, que le mode réception est actif, et qu'on a cliqué sur Nouveau/Dupliquer
    if (currentWineIds.size > prevWineIdsRef.current.size && isReceptionMode && isCreatingRef.current) {
        const newWine = wines.find(w => !prevWineIdsRef.current.has(w.id));
        if (newWine) {
            setPurchaseItems(prev => {
                if (prev.find(i => i.id === newWine.id)) return prev;
                return [...prev, { ...newWine, quantity: 12, purchasePriceHT: newWine.buyingPriceHT }];
            });
            // On reset le flag
            isCreatingRef.current = false; 
        }
    }
    prevWineIdsRef.current = currentWineIds;
  }, [wines, isReceptionMode]);


  const toggleRegion = (region: string) => {
    setCollapsedRegions(prev => 
      prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
    );
  };

  const handleDuplicateClick = (wine: Wine) => {
    // Si on est en mode réception, on active le flag pour l'ajout automatique au panier après création
    if (isReceptionMode) {
        isCreatingRef.current = true;
    }
    
    const copyData: Partial<Wine> = {
       ...wine,
       id: undefined, 
       stock: 0, 
    };
    onEditWine(null, copyData);
  };

  // Selection handlers
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
        newSet.delete(id);
    } else {
        newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectRegion = (winesInRegion: Wine[]) => {
    const newSet = new Set(selectedIds);
    const allSelected = winesInRegion.every(w => newSet.has(w.id));
    
    if (allSelected) {
        winesInRegion.forEach(w => newSet.delete(w.id));
    } else {
        winesInRegion.forEach(w => newSet.add(w.id));
    }
    setSelectedIds(newSet);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // --- RECEPTION HANDLERS ---
  const addToPurchase = (wine: Wine) => {
    setPurchaseItems(prev => {
        const existing = prev.find(i => i.id === wine.id);
        if (existing) {
             // Increment if exists? Or just ignore? Let's increment
             return prev.map(i => i.id === wine.id ? { ...i, quantity: i.quantity + 12 } : i);
        }
        return [...prev, { ...wine, quantity: 12, purchasePriceHT: wine.buyingPriceHT }];
    });
  };

  const removeFromPurchase = (id: string) => {
    setPurchaseItems(prev => prev.filter(i => i.id !== id));
  };

  const updatePurchaseItem = (id: string, field: 'quantity' | 'purchasePriceHT', value: number) => {
    setPurchaseItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleConfirmReception = async () => {
    if (!provider) return alert('Nom du fournisseur requis');
    if (purchaseItems.length === 0) return alert('La réception est vide');
    
    const success = await onConfirmPurchase(provider, reference, purchaseItems);
    if (success) {
      alert("Réception validée et stock mis à jour !");
      setPurchaseItems([]);
      setProvider('');
      setReference('');
      setIsReceptionMode(false);
    }
  };

  const handleCreateNewWineInReception = () => {
      isCreatingRef.current = true;
      onEditWine(null);
  };

  // Calcul du stock déporté total par vin
  const externalStockByWine = useMemo(() => {
    const map: Record<string, number> = {};
    clients.forEach(c => {
      c.externalStock.forEach(item => {
        map[item.wineId] = (map[item.wineId] || 0) + item.quantity;
      });
    });
    return map;
  }, [clients]);

  const filteredWines = useMemo(() => {
    return wines.filter(wine => {
      if (wine.isArchived && !showArchived) return false;
      if (!wine.isArchived && showArchived && stockFilter === 'all') return true; 

      const domain = domains.find(d => d.id === wine.domainId);
      if (!domain) return false;
      
      const effectiveRegion = wine.region || domain.region;
      const effectiveSubRegion = wine.subRegion;

      const matchesSearch = wine.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            domain.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDomain = domainFilter === 'all' || wine.domainId === domainFilter;
      const matchesRegion = regionFilter === 'all' || effectiveRegion === regionFilter;
      const matchesSubRegion = subRegionFilter === 'all' || effectiveSubRegion === subRegionFilter;
      const matchesStock = stockFilter === 'all' ? true : stockFilter === 'in_stock' ? wine.stock > 0 : wine.stock === 0;
      
      return matchesSearch && matchesDomain && matchesRegion && matchesSubRegion && matchesStock;
    });
  }, [wines, domains, searchTerm, domainFilter, regionFilter, subRegionFilter, stockFilter, showArchived]);

  const winesByRegion = useMemo<Record<string, Wine[]>>(() => {
    const grouped: Record<string, Wine[]> = {};
    
    filteredWines.forEach(wine => {
        const domain = domains.find(d => d.id === wine.domainId);
        const region = wine.region || domain?.region || 'Autre';
        
        if (!grouped[region]) grouped[region] = [];
        grouped[region].push(wine);
    });

    Object.keys(grouped).forEach(region => {
       grouped[region].sort((a, b) => {
          const domA = domains.find(d => d.id === a.domainId)?.name || '';
          const domB = domains.find(d => d.id === b.domainId)?.name || '';
          
          const domainCompare = domA.localeCompare(domB);
          if (domainCompare !== 0) return domainCompare;
          
          return a.name.localeCompare(b.name);
       });
    });

    return grouped;
  }, [filteredWines, domains]);

  const allRegions = useMemo(() => {
    const s = new Set<string>();
    wines.forEach(w => {
       if(w.region) s.add(w.region);
       else {
         const d = domains.find(dom => dom.id === w.domainId);
         if(d) s.add(d.region);
       }
    });
    return [...s].sort();
  }, [wines, domains]);

  const availableSubRegions = useMemo<string[]>(() => {
    const s = new Set<string>();
    filteredWines.forEach(w => {
        const d = domains.find(dom => dom.id === w.domainId);
        const r = w.region || d?.region;
        const sr = w.subRegion; 
        if (regionFilter === 'all' || r === regionFilter) {
            if (sr) s.add(sr);
        }
    });
    return [...s].sort();
  }, [filteredWines, domains, regionFilter]);

  const sortedRegionKeys = Object.keys(winesByRegion).sort();

  return (
    <div className="space-y-4 pb-20 relative h-full flex flex-col">
      
      {/* BARRE D'ACTION FLOTTANTE (MULTI-SELECTION) - Masquée si mode réception */}
      {selectedIds.size > 0 && !isReceptionMode && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl z-[100] flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-300 border border-slate-700">
             <div className="flex items-center gap-3 border-r border-slate-700 pr-6">
                 <span className="bg-white text-slate-900 font-bold w-6 h-6 rounded-full flex items-center justify-center text-xs">
                     {selectedIds.size}
                 </span>
                 <span className="font-medium text-sm">Sélectionnés</span>
             </div>
             
             <div className="flex items-center gap-3">
                 <button 
                    onClick={() => onTransferTo(Array.from(selectedIds), 'sales')}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                 >
                     <ShoppingCart size={18} /> Vendre
                 </button>
             </div>

             <button 
                onClick={clearSelection}
                className="ml-2 text-slate-400 hover:text-white"
             >
                 <Trash2 size={18} />
             </button>
          </div>
      )}

      {/* SEARCH & FILTER BAR */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 shrink-0">
        <div className="flex flex-col lg:flex-row justify-between gap-4">
          <div className="flex flex-1 gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Rechercher (vin, domaine)..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 sm:text-sm transition duration-150 ease-in-out"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <button 
               onClick={() => setShowArchived(!showArchived)}
               className={`px-4 py-2 border rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${showArchived ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'}`}
             >
               {showArchived ? <Eye size={16} /> : <EyeOff size={16} />}
               <span className="hidden md:inline">{showArchived ? "Masquer Archives" : "Voir Archives"}</span>
             </button>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            {/* Filters */}
            <div className="flex gap-2">
              <select
                className="block w-full pl-3 pr-8 py-2 text-base border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-lg bg-gray-50"
                value={regionFilter}
                onChange={(e) => {
                  setRegionFilter(e.target.value);
                  setSubRegionFilter('all');
                }}
              >
                <option value="all">Toutes régions</option>
                {allRegions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              
              {availableSubRegions.length > 0 && (
                <select
                  className="block w-full pl-3 pr-8 py-2 text-base border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-lg bg-gray-50"
                  value={subRegionFilter}
                  onChange={(e) => setSubRegionFilter(e.target.value)}
                >
                  <option value="all">Toutes sous-régions</option>
                  {availableSubRegions.map(r => (
                    <option key={r} value={r as string}>{r}</option>
                  ))}
                </select>
              )}
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex gap-2">
               {/* TOGGLE RECEPTION MODE */}
               <button 
                 onClick={() => setIsReceptionMode(!isReceptionMode)}
                 className={`px-4 py-2 border rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-sm ${isReceptionMode ? 'bg-blue-600 border-blue-600 text-white ring-2 ring-blue-300 ring-offset-1' : 'bg-white border-gray-300 text-blue-700 hover:bg-blue-50'}`}
               >
                  <PackageCheck size={18} /> 
                  <span>{isReceptionMode ? 'Mode Réception ACTIF' : 'Saisir une Facture Achat'}</span>
               </button>

               {!isReceptionMode && (
                  <button onClick={() => onEditWine(null)} className="px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors flex items-center justify-center gap-2 text-sm font-medium shadow-sm">
                    <Plus size={18} /> Nouveau Vin
                  </button>
               )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* MAIN INVENTORY TABLE */}
        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col transition-all duration-300 ${isReceptionMode ? 'w-2/3' : 'w-full'}`}>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left relative">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="w-12 px-4 py-3 bg-gray-50 text-center">
                      {/* Checkbox column */}
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Domaine / Vin</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Millésime</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Prix Achat HT</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Prix Vente HT</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Stocks</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 overflow-y-auto">
                {sortedRegionKeys.map(region => {
                  const regionWines = winesByRegion[region];
                  const isCollapsed = collapsedRegions.includes(region);
                  const isRegionAllSelected = regionWines.length > 0 && regionWines.every(w => selectedIds.has(w.id));

                  return (
                    <React.Fragment key={region}>
                      <tr className="bg-slate-100 hover:bg-slate-200 cursor-pointer">
                        <td className="w-12 px-4 py-2 text-center" onClick={(e) => { e.stopPropagation(); selectRegion(regionWines); }}>
                          {!isReceptionMode && (
                            <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${isRegionAllSelected ? 'bg-slate-600 border-slate-600' : 'border-slate-300 hover:border-slate-400 bg-white'}`}>
                                {isRegionAllSelected && <CheckSquare size={14} className="text-white" />}
                            </div>
                          )}
                        </td>
                        <td colSpan={7} className="px-6 py-2 font-bold text-slate-700 uppercase tracking-wide text-xs flex items-center gap-2" onClick={() => toggleRegion(region)}>
                          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          {region} <span className="text-gray-400 font-normal ml-2">({regionWines?.length || 0} références)</span>
                        </td>
                      </tr>
                      {!isCollapsed && regionWines?.map(wine => {
                        const domain = domains.find(d => d.id === wine.domainId);
                        const sellingPrice = getSellingPrice(wine, domain);
                        const isManualPrice = !!wine.sellingPriceHT;
                        const appliedCoef = wine.coefficient || domain?.coefficient || getSmartCoefficient(wine.buyingPriceHT);
                        const effectiveSubRegion = wine.subRegion;
                        const externalStock = externalStockByWine[wine.id] || 0;
                        const isSelected = selectedIds.has(wine.id);
                        
                        // Check if in purchase items
                        const inPurchase = purchaseItems.find(p => p.id === wine.id);

                        return (
                          <tr 
                              key={wine.id} 
                              className={`transition-colors border-l-4 
                                  ${isReceptionMode 
                                    ? (inPurchase ? 'bg-blue-50 border-blue-500' : 'hover:bg-blue-50/30 border-transparent cursor-pointer') 
                                    : (isSelected ? 'bg-blue-50/80 border-transparent' : 'hover:bg-gray-50 border-transparent')
                                  } 
                                  ${wine.stock === 0 && !wine.isArchived && !inPurchase ? 'opacity-60' : ''} 
                                  ${wine.isArchived ? 'bg-orange-50 opacity-80' : ''}`
                              }
                              onClick={() => {
                                if (isReceptionMode) {
                                   if (!inPurchase) addToPurchase(wine);
                                } else {
                                   toggleSelection(wine.id);
                                }
                              }}
                          >
                            <td className="w-12 px-4 py-4 text-center cursor-pointer">
                               {isReceptionMode ? (
                                  inPurchase ? <PackageCheck className="text-blue-600 mx-auto" size={20} /> : <Plus className="text-gray-300 mx-auto hover:text-blue-500" size={20} />
                               ) : (
                                  <div className={`w-5 h-5 border-2 rounded mx-auto flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                                      {isSelected && <CheckSquare size={14} className="text-white" />}
                                  </div>
                               )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="ml-0">
                                  <div className="text-sm font-medium text-gray-900 flex items-center gap-2 group">
                                    <span 
                                      onClick={(e) => { e.stopPropagation(); onEditDomain(wine.domainId); }}
                                      className="cursor-pointer hover:text-blue-600 hover:underline"
                                    >
                                      {domain?.name}
                                    </span>
                                    {effectiveSubRegion && <span className="ml-1 text-xs text-gray-500 font-normal bg-gray-100 px-1.5 py-0.5 rounded-full">{effectiveSubRegion}</span>}
                                    {wine.isArchived && <span className="ml-1 text-xs bg-orange-200 text-orange-800 px-1 rounded border border-orange-300">Archivé</span>}
                                  </div>
                                  <div 
                                    className="text-sm text-gray-500 cursor-pointer hover:text-blue-600 hover:underline mb-1"
                                    onClick={(e) => { e.stopPropagation(); onEditWine(wine.id); }}
                                  >
                                     {wine.name}
                                  </div>
                                  <div className="flex gap-2 items-center">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${getColorBadgeClass(wine.color)}`}>
                                        {wine.color}
                                      </span>
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                         {wine.format || 'Bouteille (75cl)'}
                                      </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{wine.vintage}</td>
                            <td className="px-6 py-4 text-sm text-gray-900 font-medium">{formatCurrency(wine.buyingPriceHT)}</td>
                            <td className="px-6 py-4 text-sm text-emerald-600 font-bold">{formatCurrency(sellingPrice)}</td>
                            <td className="px-6 py-4">
                               <div className="flex flex-col gap-1 items-center">
                                  {/* STOCK CAVE */}
                                  <div className="flex items-center space-x-1">
                                     <span className={`inline-flex items-center justify-center w-12 py-0.5 rounded text-xs font-bold border ${
                                        wine.stock > 10 ? 'bg-green-100 text-green-800 border-green-200' : 
                                        wine.stock > 0 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-red-100 text-red-800 border-red-200'
                                     }`}>
                                        {wine.stock}
                                     </span>
                                     {!isReceptionMode && (
                                       <div className="flex flex-col">
                                          <button onClick={(e) => { e.stopPropagation(); onStockUpdate(wine.id, wine.stock + 1); }} className="px-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded text-[10px] leading-none mb-px">▲</button>
                                          <button onClick={(e) => { e.stopPropagation(); onStockUpdate(wine.id, wine.stock - 1); }} className="px-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded text-[10px] leading-none" disabled={wine.stock <= 0}>▼</button>
                                       </div>
                                     )}
                                  </div>
                                  {/* STOCK EXTERNE */}
                                  {externalStock > 0 && (
                                     <div className="flex items-center gap-1 text-[10px] text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100" title="Stock en dépôt chez les clients">
                                        <Package size={10} /> Dépôt: <b>{externalStock}</b>
                                     </div>
                                  )}
                               </div>
                            </td>
                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                               <div className="flex justify-end gap-2">
                                 <button onClick={() => onEditWine(wine.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Modifier">
                                   <Pencil size={16} />
                                 </button>
                                 
                                 {/* BOUTON DUPLIQUER (Visible même en Mode Réception) */}
                                 <button onClick={() => handleDuplicateClick(wine)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Dupliquer (Créer nouveau millésime)">
                                   <Copy size={16} />
                                 </button>

                                 {!isReceptionMode && (
                                   <button onClick={() => onToggleArchive(wine.id)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors" title={wine.isArchived ? "Désarchiver" : "Archiver"}>
                                     {wine.isArchived ? <Eye size={16} /> : <EyeOff size={16} />}
                                   </button>
                                 )}
                               </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RECEPTION SIDEBAR PANEL */}
        {isReceptionMode && (
          <div className="w-1/3 bg-white rounded-xl shadow-xl border border-blue-200 flex flex-col animate-in slide-in-from-right duration-300">
             <div className="p-4 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                <h3 className="font-bold text-blue-900 flex items-center gap-2">
                   <PackageCheck size={20} /> Réception Fournisseur
                </h3>
                <button onClick={() => setIsReceptionMode(false)} className="text-blue-400 hover:text-blue-700">
                   <X size={20} />
                </button>
             </div>
             
             <div className="p-4 border-b border-gray-100 space-y-3 bg-gray-50/50">
                  <button 
                     onClick={handleCreateNewWineInReception}
                     className="w-full py-2 bg-white border-2 border-dashed border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 hover:border-blue-500 transition-all font-bold flex items-center justify-center gap-2"
                  >
                     <Plus size={18} /> Créer référence manquante
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Fournisseur *</label>
                        <input 
                           type="text" 
                           className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                           placeholder="Nom..."
                           value={provider}
                           onChange={e => setProvider(e.target.value)}
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Réf. Facture</label>
                        <input 
                           type="text" 
                           className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                           placeholder="N°..."
                           value={reference}
                           onChange={e => setReference(e.target.value)}
                        />
                     </div>
                  </div>
             </div>

             <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {purchaseItems.length === 0 ? (
                   <div className="text-center py-10 text-gray-400 italic">
                      Cliquez sur les vins dans la liste à gauche pour les ajouter au bon de réception.
                   </div>
                ) : (
                   purchaseItems.map(item => {
                      const oldStock = Math.max(0, item.stock);
                      const newTotalQty = oldStock + item.quantity;
                      const oldTotalVal = oldStock * item.buyingPriceHT;
                      const newBatchVal = item.quantity * item.purchasePriceHT;
                      const newCump = newTotalQty > 0 ? (oldTotalVal + newBatchVal) / newTotalQty : item.purchasePriceHT;

                      return (
                         <div key={item.id} className="bg-white border border-gray-200 p-3 rounded-lg text-sm shadow-sm relative group">
                            <button 
                               onClick={() => removeFromPurchase(item.id)}
                               className="absolute top-2 right-2 text-gray-300 hover:text-red-500"
                            >
                               <Trash2 size={14} />
                            </button>
                            <div className="font-bold text-gray-800 w-11/12 truncate">{item.name}</div>
                            <div className="text-xs text-gray-500 mb-2">{item.vintage}</div>
                            
                            <div className="flex gap-3 items-end">
                               <div className="flex-1">
                                  <label className="text-[10px] font-bold text-gray-400 block mb-0.5">Quantité</label>
                                  <input 
                                     type="number" 
                                     className="w-full border border-gray-300 rounded px-2 py-1 font-bold text-center"
                                     value={item.quantity}
                                     onChange={(e) => updatePurchaseItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                                  />
                               </div>
                               <div className="flex-1">
                                  <label className="text-[10px] font-bold text-gray-400 block mb-0.5">Prix Achat</label>
                                  <input 
                                     type="number"
                                     step="0.01" 
                                     className="w-full border border-gray-300 rounded px-2 py-1 font-bold text-center text-blue-700"
                                     value={item.purchasePriceHT}
                                     onChange={(e) => updatePurchaseItem(item.id, 'purchasePriceHT', parseFloat(e.target.value) || 0)}
                                  />
                               </div>
                            </div>
                            
                            {Math.abs(item.purchasePriceHT - item.buyingPriceHT) > 0.01 && (
                               <div className="mt-2 text-[10px] bg-yellow-50 text-yellow-800 p-1.5 rounded border border-yellow-100 flex items-center gap-1">
                                  <AlertCircle size={10} /> Nouveau PMP estimé : <strong>{formatCurrency(newCump)}</strong>
                               </div>
                            )}
                         </div>
                      );
                   })
                )}
             </div>

             <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                   <span className="font-bold text-gray-600">Total HT</span>
                   <span className="font-bold text-xl text-blue-800">
                      {formatCurrency(purchaseItems.reduce((acc, i) => acc + (i.quantity * i.purchasePriceHT), 0))}
                   </span>
                </div>
                <button 
                   onClick={handleConfirmReception}
                   disabled={purchaseItems.length === 0}
                   className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                >
                   Valider l'Entrée en Stock <ArrowRight size={18} />
                </button>
             </div>
          </div>
        )}
      </div>

      {/* HISTORIQUE (Visible seulement si pas en mode réception pour ne pas encombrer) */}
      {!isReceptionMode && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-4 shrink-0">
           <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                 <History size={18} className="text-gray-500" /> Historique des Mouvements
              </h3>
              <span className="text-xs text-gray-400">Derniers 200 mouvements</span>
           </div>
           <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                 <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-100">
                    <tr>
                       <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase">Date</th>
                       <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase">Vin</th>
                       <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase text-center">Type</th>
                       <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase text-right">Quantité</th>
                       <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase">Raison / Référence</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                    {stockMovements.slice(0, 200).map(move => (
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
                             {move.provider && <span className="ml-1 text-gray-400">({move.provider})</span>}
                          </td>
                       </tr>
                    ))}
                    {stockMovements.length === 0 && (
                       <tr><td colSpan={5} className="p-6 text-center text-gray-400 italic">Aucun mouvement enregistré.</td></tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
