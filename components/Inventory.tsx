import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Eye, EyeOff, ChevronRight, ChevronDown, Pencil, Trash2, Copy, Package, Download, History, ShoppingCart, PackagePlus, CheckSquare, Square } from 'lucide-react';
import { Wine, Domain, Invoice, StockMovement, Client, PurchaseItem } from '../types';
import { formatCurrency, getColorBadgeClass, getSellingPrice, getSmartCoefficient } from '../utils';
import { ADJUSTMENT_REASONS } from '../constants';

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
  onStockUpdate: (id: string, newStock: number, reason: string) => void,
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
  onConfirmPurchase: (provider: string, reference: string, items: PurchaseItem[], date?: string, shippingCostHT?: number, impactStock?: boolean) => Promise<boolean>
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  // Adjustment Modal State
  const [wineToAdjust, setWineToAdjust] = useState<Wine | null>(null);
  const [adjustmentQuantity, setAdjustmentQuantity] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState(ADJUSTMENT_REASONS[0]);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [domainFilter, setDomainFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [subRegionFilter, setSubRegionFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all'); 
  const [showArchived, setShowArchived] = useState(false);
  const [collapsedRegions, setCollapsedRegions] = useState<string[]>([]);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleRegion = (region: string) => {
    setCollapsedRegions(prev => 
      prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
    );
  };

  const handleDuplicateClick = (wine: Wine) => {
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

  // Calcul du stock déporté total par vin
  const externalStockDetails = useMemo(() => {
    const map: Record<string, { total: number, details: string[] }> = {};
    clients.forEach(c => {
      c.externalStock.forEach(item => {
        if (!map[item.wineId]) map[item.wineId] = { total: 0, details: [] };
        map[item.wineId].total += item.quantity;
        map[item.wineId].details.push(`${c.name} (${item.quantity})`);
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
      {selectedIds.size > 0 && (
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

          <div className="flex flex-col md:flex-row gap-4 justify-between">
            {/* Filters */}
            <div className="flex gap-2 flex-wrap md:flex-nowrap">
              <select
                className="block w-full md:w-auto pl-3 pr-8 py-2 text-base border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-lg bg-gray-50"
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
                  className="block w-full md:w-auto pl-3 pr-8 py-2 text-base border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-lg bg-gray-50"
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
            <div className="flex gap-2 flex-wrap md:flex-nowrap">
               <button onClick={() => onEditWine(null)} className="px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors flex items-center justify-center gap-2 text-sm font-medium shadow-sm flex-1 md:flex-none">
                 <Plus size={18} /> <span className="hidden sm:inline">Nouveau Vin</span><span className="sm:hidden">Nouveau</span>
               </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0 flex-col md:flex-row">
        {/* MAIN INVENTORY TABLE */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col transition-all duration-300 w-full">
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto flex-1">
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
                            <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${isRegionAllSelected ? 'bg-slate-600 border-slate-600' : 'border-slate-300 hover:border-slate-400 bg-white'}`}>
                                {isRegionAllSelected && <CheckSquare size={14} className="text-white" />}
                            </div>
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
                        const extStock = externalStockDetails[wine.id];
                        const externalStock = extStock?.total || 0;
                        const externalStockTooltip = extStock ? `Stock en dépôt :\n${extStock.details.join('\n')}` : "Stock en dépôt chez les clients";
                        const isSelected = selectedIds.has(wine.id);
                        
                        return (
                          <tr 
                              key={wine.id} 
                              className={`transition-colors border-l-4 
                                  ${isSelected ? 'bg-blue-50/80 border-transparent' : 'hover:bg-gray-50 border-transparent'} 
                                  ${wine.stock === 0 && !wine.isArchived ? 'opacity-60' : ''} 
                                  ${wine.isArchived ? 'bg-orange-50 opacity-80' : ''}`
                              }
                              onClick={() => {
                                 toggleSelection(wine.id);
                              }}
                          >
                            <td className="w-12 px-4 py-4 text-center cursor-pointer">
                                <div className={`w-5 h-5 border-2 rounded mx-auto flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                                    {isSelected && <CheckSquare size={14} className="text-white" />}
                                </div>
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
                                        wine.stock > 0 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : (wine.stock === 0 ? 'bg-red-100 text-red-800 border-red-200' : 'bg-red-600 text-white border-red-700')
                                     }`}>
                                        {wine.stock}
                                     </span>
                                     <button onClick={(e) => { e.stopPropagation(); setWineToAdjust(wine); setIsAdjustmentModalOpen(true); }} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold">Ajuster</button>
                                  </div>
                                  {/* STOCK EXTERNE */}
                                  {externalStock > 0 && (
                                     <div className="flex items-center gap-1 text-[10px] text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100 cursor-help" title={externalStockTooltip}>
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

                                 <button onClick={() => onToggleArchive(wine.id)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors" title={wine.isArchived ? "Désarchiver" : "Archiver"}>
                                   {wine.isArchived ? <Eye size={16} /> : <EyeOff size={16} />}
                                 </button>
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

          {/* Mobile Card View */}
          <div className="md:hidden flex-1 overflow-y-auto p-2 space-y-3 bg-gray-50">
            {sortedRegionKeys.map(region => {
              const regionWines = winesByRegion[region];
              const isCollapsed = collapsedRegions.includes(region);
              const isRegionAllSelected = regionWines.length > 0 && regionWines.every(w => selectedIds.has(w.id));

              return (
                <div key={region} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Region Header */}
                  <div 
                    className="bg-slate-100 px-4 py-3 flex items-center justify-between cursor-pointer"
                    onClick={() => toggleRegion(region)}
                  >
                    <div className="flex items-center gap-2">
                        <div 
                          className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${isRegionAllSelected ? 'bg-slate-600 border-slate-600' : 'border-slate-300 bg-white'}`}
                          onClick={(e) => { e.stopPropagation(); selectRegion(regionWines); }}
                        >
                          {isRegionAllSelected && <CheckSquare size={14} className="text-white" />}
                        </div>
                      <span className="font-bold text-slate-700 uppercase tracking-wide text-xs">{region}</span>
                      <span className="text-gray-400 font-normal text-xs">({regionWines?.length || 0})</span>
                    </div>
                    {isCollapsed ? <ChevronRight size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                  </div>

                  {/* Wines List */}
                  {!isCollapsed && (
                    <div className="divide-y divide-gray-100">
                      {regionWines?.map(wine => {
                        const domain = domains.find(d => d.id === wine.domainId);
                        const sellingPrice = getSellingPrice(wine, domain);
                        const isSelected = selectedIds.has(wine.id);
                        const extStock = externalStockDetails[wine.id];
                        const externalStock = extStock?.total || 0;
                        const externalStockTooltip = extStock ? `Stock en dépôt :\n${extStock.details.join('\n')}` : "Stock en dépôt chez les clients";

                        return (
                          <div 
                            key={wine.id} 
                            className={`p-4 flex gap-3 relative transition-colors ${isSelected ? 'bg-blue-50/80' : ''}`}
                            onClick={() => {
                                toggleSelection(wine.id);
                            }}
                          >
                            {/* Checkbox / Add icon */}
                            <div className="pt-1">
                                <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                                  {isSelected && <CheckSquare size={14} className="text-white" />}
                                </div>
                            </div>
                            
                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-1">
                                <div className="truncate pr-2">
                                  <span className="text-xs font-bold text-gray-900 truncate" onClick={(e) => { e.stopPropagation(); onEditDomain(wine.domainId); }}>{domain?.name}</span>
                                  {wine.isArchived && <span className="ml-2 text-[10px] bg-orange-200 text-orange-800 px-1 rounded">Archivé</span>}
                                </div>
                                <span className="text-xs text-gray-500 whitespace-nowrap">{wine.vintage}</span>
                              </div>
                              <div className="text-sm text-gray-700 mb-2 truncate font-medium" onClick={(e) => { e.stopPropagation(); onEditWine(wine.id); }}>{wine.name}</div>
                              
                              <div className="flex flex-wrap gap-2 mb-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${getColorBadgeClass(wine.color)}`}>{wine.color}</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">{wine.format || 'Bouteille (75cl)'}</span>
                              </div>

                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                                <div className="flex gap-4">
                                  <div>
                                    <div className="text-[10px] text-gray-400 uppercase">Achat HT</div>
                                    <div className="text-sm font-medium">{formatCurrency(wine.buyingPriceHT)}</div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-gray-400 uppercase">Vente HT</div>
                                    <div className="text-sm font-bold text-emerald-600">{formatCurrency(sellingPrice)}</div>
                                  </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold border ${wine.stock > 10 ? 'bg-green-100 text-green-800 border-green-200' : wine.stock > 0 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : wine.stock === 0 ? 'bg-red-100 text-red-800 border-red-200' : 'bg-red-600 text-white border-red-700'}`}>
                                      {wine.stock}
                                    </span>
                                    <button onClick={(e) => { e.stopPropagation(); setWineToAdjust(wine); setIsAdjustmentModalOpen(true); }} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold">Ajuster</button>
                                  </div>
                                  {externalStock > 0 && (
                                    <div className="text-[10px] text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-100 cursor-help" title={externalStockTooltip}>
                                      Dépôt: {externalStock}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => onEditWine(wine.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Modifier">
                                  <Pencil size={16} />
                                </button>
                                <button onClick={() => handleDuplicateClick(wine)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Dupliquer">
                                  <Copy size={16} />
                                </button>
                                  <button onClick={() => onToggleArchive(wine.id)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors" title={wine.isArchived ? "Désarchiver" : "Archiver"}>
                                    {wine.isArchived ? <Eye size={16} /> : <EyeOff size={16} />}
                                  </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* HISTORIQUE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-4 shrink-0">
           <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                 <History size={18} className="text-gray-500" /> Historique des Mouvements
              </h3>
              <span className="text-xs text-gray-400">Derniers 200 mouvements</span>
           </div>
           <div className="max-h-[300px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[800px]">
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
      {isAdjustmentModalOpen && wineToAdjust && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[200]">
           <div className="bg-white p-6 rounded-lg max-w-sm w-full mx-4 shadow-xl">
              <h2 className="text-xl font-bold mb-4">Ajuster {wineToAdjust.name}</h2>
              <label className="block mb-4">
                 Quantité (positive pour ajouter, négative pour retirer):
                 <input type="number" className="border p-2 w-full roudned" value={adjustmentQuantity} onChange={(e) => setAdjustmentQuantity(Number(e.target.value))} />
              </label>
              <label className="block mb-4">
                 Raison:
                 <select className="border p-2 w-full rounded" value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)}>
                    {ADJUSTMENT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                 </select>
              </label>
              <div className="flex justify-end gap-2">
                 <button onClick={() => setIsAdjustmentModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">Annuler</button>
                 <button onClick={() => {
                     onStockUpdate(wineToAdjust.id, wineToAdjust.stock + adjustmentQuantity, adjustmentReason);
                     setIsAdjustmentModalOpen(false);
                 }} className="px-4 py-2 bg-red-800 text-white rounded">Confirmer</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
