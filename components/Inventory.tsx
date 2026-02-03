
import React, { useState, useMemo } from 'react';
import { Search, Plus, Eye, EyeOff, ChevronRight, ChevronDown, Pencil, Trash2, Copy, Package, Download } from 'lucide-react';
import { Wine, Domain, Invoice, StockMovement, Client } from '../types';
import { formatCurrency, getColorBadgeClass, getSellingPrice } from '../utils';

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
  onEditWine // Injection
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
  onEditWine: (wineId: string | null, initialData?: Partial<Wine>) => void
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [subRegionFilter, setSubRegionFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all'); 
  const [showArchived, setShowArchived] = useState(false);
  const [collapsedRegions, setCollapsedRegions] = useState<string[]>([]);

  const toggleRegion = (region: string) => {
    setCollapsedRegions(prev => 
      prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
    );
  };

  const handleDuplicateClick = (wine: Wine) => {
    // On prépare les données pour la création d'un nouveau vin basé sur celui-ci
    const copyData: Partial<Wine> = {
       ...wine,
       id: undefined, // Sera généré
       stock: 0, // Stock à 0 pour la copie
       // On garde le reste (prix, nom, etc)
    };
    onEditWine(null, copyData);
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

  const handleExportStock = () => {
    // 1. Définition des en-têtes
    const csvHeader = [
      'Domaine', 
      'Cuvée', 
      'Millésime', 
      'Région', 
      'Sous-Région', 
      'Couleur', 
      'Format', 
      'Prix Achat HT', 
      'Stock Cave', 
      'Stock Déporté', 
      'Stock Total', 
      'Valorisation HT'
    ];
    
    // Variables pour la ligne des totaux
    let totalStockCave = 0;
    let totalStockDeporte = 0;
    let totalStockGlobal = 0;
    let totalValorisation = 0;

    const csvRows: string[] = [];

    // VALORISATION TOTALE DES ACTIFS (Pilotage)
    // On prend TOUS les vins sans exception.
    // Si un vin est archivé mais qu'il reste du stock, il DOIT apparaitre dans l'inventaire fiscal/comptable.
    
    const winesToExport = [...wines].sort((a, b) => {
        const domA = domains.find(d => d.id === a.domainId)?.name || '';
        const domB = domains.find(d => d.id === b.domainId)?.name || '';
        return domA.localeCompare(domB) || a.name.localeCompare(b.name);
    });

    // 2. Parcours de TOUS les vins
    winesToExport.forEach(wine => {
      const externalStock = externalStockByWine[wine.id] || 0;
      // On prend le stock réel physique, peu importe le statut 'archivé' dans l'interface
      const totalStock = wine.stock + externalStock;

      // EXCLURE UNIQUEMENT SI STOCK TOTAL EST À 0
      if (totalStock <= 0) return;

      const domain = domains.find(d => d.id === wine.domainId);
      const valorisation = totalStock * wine.buyingPriceHT;

      // Accumulation pour les totaux
      totalStockCave += wine.stock;
      totalStockDeporte += externalStock;
      totalStockGlobal += totalStock;
      totalValorisation += valorisation;
      
      const row = [
        `"${domain?.name || ''}"`,
        `"${wine.name.replace(/"/g, '""')}"`,
        wine.vintage,
        `"${wine.region || domain?.region || ''}"`,
        `"${wine.subRegion || ''}"`,
        wine.color,
        wine.format || 'Bouteille (75cl)',
        wine.buyingPriceHT.toFixed(2).replace('.', ','),
        wine.stock, 
        externalStock,
        totalStock,
        valorisation.toFixed(2).replace('.', ',')
      ].join(';');

      csvRows.push(row);
    });

    // 3. Création de la ligne TOTAL
    const totalRow = [
      'TOTAL ACTIF',
      '',
      '',
      '',
      '',
      '',
      '',
      '', 
      totalStockCave,
      totalStockDeporte,
      totalStockGlobal,
      totalValorisation.toFixed(2).replace('.', ',')
    ].join(';');

    const csvContent = [csvHeader.join(';'), ...csvRows, totalRow].join('\n');
    
    // Ajout du BOM \uFEFF pour que Excel reconnaisse l'UTF-8 automatiquement
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `INVENTAIRE_VALORISE_COMPLET_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    <div className="space-y-4">
      {/* ... (Search Bar) ... */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
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

            <div className="flex gap-2">
              <button 
                onClick={handleExportStock}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium shadow-sm"
                title="Exporter TOUT l'inventaire physique (y compris archivés avec stock)"
              >
                <Download size={18} /> <span className="hidden xl:inline">Export Total</span>
              </button>
              <button onClick={() => onEditWine(null)} className="px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors flex items-center justify-center gap-2 text-sm font-medium shadow-sm">
                <Plus size={18} /> Nouveau
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left relative">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Domaine / Vin</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Millésime</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Prix Achat HT</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Coef. / Marge</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Prix Vente HT</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Stocks (Cave / Dépôt)</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 overflow-y-auto">
              {sortedRegionKeys.map(region => {
                const regionWines = winesByRegion[region];
                const isCollapsed = collapsedRegions.includes(region);
                return (
                  <React.Fragment key={region}>
                    <tr className="bg-slate-100 hover:bg-slate-200 cursor-pointer" onClick={() => toggleRegion(region)}>
                      <td colSpan={7} className="px-6 py-2 font-bold text-slate-700 uppercase tracking-wide text-xs flex items-center gap-2">
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        {region} <span className="text-gray-400 font-normal ml-2">({regionWines?.length || 0} références)</span>
                      </td>
                    </tr>
                    {!isCollapsed && regionWines?.map(wine => {
                      const domain = domains.find(d => d.id === wine.domainId);
                      const sellingPrice = getSellingPrice(wine, domain);
                      const isManualPrice = !!wine.sellingPriceHT;
                      const hasSpecificCoef = !!wine.coefficient;
                      const appliedCoef = wine.coefficient || domain?.coefficient || 1.2;
                      const effectiveCoef = wine.buyingPriceHT > 0 ? (sellingPrice / wine.buyingPriceHT).toFixed(2) : '-';
                      
                      const effectiveSubRegion = wine.subRegion;
                      const externalStock = externalStockByWine[wine.id] || 0;

                      return (
                        <tr key={wine.id} className={`hover:bg-gray-50 transition-colors ${wine.stock === 0 && !wine.isArchived ? 'opacity-60 bg-gray-50' : ''} ${wine.isArchived ? 'bg-orange-50 opacity-80' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="ml-0">
                                <div className="text-sm font-medium text-gray-900 flex items-center gap-2 group">
                                  {/* CLICKABLE DOMAIN NAME */}
                                  <span 
                                    onClick={(e) => { e.stopPropagation(); onEditDomain(wine.domainId); }}
                                    className="cursor-pointer hover:text-blue-600 hover:underline transition-colors"
                                    title="Modifier le domaine"
                                  >
                                    {domain?.name}
                                  </span>
                                  {effectiveSubRegion && <span className="ml-1 text-xs text-gray-500 font-normal bg-gray-100 px-1.5 py-0.5 rounded-full">{effectiveSubRegion}</span>}
                                  {wine.isArchived && <span className="ml-1 text-xs bg-orange-200 text-orange-800 px-1 rounded border border-orange-300">Archivé</span>}
                                  {!wine.isArchived && wine.stock === 0 && <span className="ml-1 text-xs bg-gray-200 text-gray-600 px-1 rounded border border-gray-300">Rupture</span>}
                                </div>
                                {/* CLICKABLE WINE NAME */}
                                <div 
                                  className="text-sm text-gray-500 cursor-pointer hover:text-blue-600 hover:underline mb-1"
                                  onClick={() => onEditWine(wine.id)}
                                >
                                   {wine.name}
                                </div>
                                <div className="flex gap-2 items-center">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${getColorBadgeClass(wine.color)}`}>
                                      {wine.color}
                                    </span>
                                    {/* Affichage systématique du format pour meilleure distinction */}
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                       {wine.format || 'Bouteille (75cl)'}
                                    </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{wine.vintage}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">{formatCurrency(wine.buyingPriceHT)}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {isManualPrice ? (
                               <span className="text-blue-600 font-medium" title="Prix manuel">Fixe (x{effectiveCoef})</span>
                            ) : (
                               <span title={hasSpecificCoef ? "Coef. spécifique vin" : "Coef. domaine"}>
                                 x{appliedCoef} {hasSpecificCoef && '*'}
                               </span>
                            )}
                          </td>
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
                                   <div className="flex flex-col">
                                      <button onClick={(e) => { e.stopPropagation(); onStockUpdate(wine.id, wine.stock + 1); }} className="px-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded text-[10px] leading-none mb-px">▲</button>
                                      <button onClick={(e) => { e.stopPropagation(); onStockUpdate(wine.id, wine.stock - 1); }} className="px-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded text-[10px] leading-none" disabled={wine.stock <= 0}>▼</button>
                                   </div>
                                </div>
                                {/* STOCK EXTERNE */}
                                {externalStock > 0 && (
                                   <div className="flex items-center gap-1 text-[10px] text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100" title="Stock en dépôt chez les clients">
                                      <Package size={10} /> Dépôt: <b>{externalStock}</b>
                                   </div>
                                )}
                             </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex justify-end gap-2">
                               <button onClick={() => onEditWine(wine.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Modifier">
                                 <Pencil size={16} />
                               </button>
                               <button onClick={() => handleDuplicateClick(wine)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Dupliquer (Nouveau Millésime)">
                                 <Copy size={16} />
                               </button>
                               <button onClick={() => onToggleArchive(wine.id)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors" title={wine.isArchived ? "Désarchiver" : "Archiver"}>
                                 {wine.isArchived ? <Eye size={16} /> : <EyeOff size={16} />}
                               </button>
                               <div className="w-px bg-gray-200 mx-1"></div>
                               <button onClick={() => onDeleteProduct(wine.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Supprimer définitivement">
                                   <Trash2 size={16} />
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
      </div>
    </div>
  );
};

export default Inventory;
