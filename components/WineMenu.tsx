
import React, { useMemo, useState } from 'react';
import { Printer, Edit2, Check, X, FileSpreadsheet, Eye, EyeOff, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Wine, Domain } from '../types';
import { formatCurrency, getSellingPrice, printWineMenu } from '../utils';

const WineMenu = ({ 
  wines, 
  domains, 
  isEmbedded = false,
  logo,
  onUpdateWine,
  onEditWine
}: { 
  wines: Wine[], 
  domains: Domain[],
  isEmbedded?: boolean,
  logo?: string,
  onUpdateWine: (wine: Wine) => void,
  onEditWine: (wineId: string | null) => void
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [excludedWineIds, setExcludedWineIds] = useState<Set<string>>(new Set());
  const [showQuantities, setShowQuantities] = useState(false);

  const toggleWineExclusion = (wineId: string) => {
    const newExcluded = new Set(excludedWineIds);
    if (newExcluded.has(wineId)) {
      newExcluded.delete(wineId);
    } else {
      newExcluded.add(wineId);
    }
    setExcludedWineIds(newExcluded);
  };

  const handlePrint = () => {
    const filteredWines = wines.filter(w => !excludedWineIds.has(w.id));
    printWineMenu(filteredWines, domains, logo);
  };

  const handleExportExcel = () => {
    const filteredWines = wines.filter(w => !excludedWineIds.has(w.id) && !w.isArchived && (w.stock > 0 || w.isPreSale));
    
    // Create data for Excel
    const data = filteredWines.map(w => {
      const domain = domains.find(d => d.id === w.domainId);
      const sellingPrice = getSellingPrice(w, domain);
      const effectiveRegion = w.region || domain?.region || "Autre";
      
      return {
        'Région': effectiveRegion,
        'Domaine': domain?.name || '',
        'Appellation/Vin': w.name,
        'Millésime': w.vintage,
        'Couleur': w.color,
        'Format': w.format || 'Bouteille (75cl)',
        'Prix HT': sellingPrice,
        'Quantité Dispo': w.stock
      };
    });

    // Sort data by Region, then Domain, then Wine Name
    data.sort((a, b) => {
      if (a.Région !== b.Région) return a.Région.localeCompare(b.Région);
      if (a.Domaine !== b.Domaine) return a.Domaine.localeCompare(b.Domaine);
      return a['Appellation/Vin'].localeCompare(b['Appellation/Vin']);
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Carte des Vins");
    
    // Auto-size columns
    const wscols = [
      {wch: 15}, // Region
      {wch: 25}, // Domain
      {wch: 40}, // Wine
      {wch: 10}, // Vintage
      {wch: 10}, // Color
      {wch: 20}, // Format
      {wch: 10}, // Price
      {wch: 15}  // Quantity
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, "Carte_des_Vins.xlsx");
  };

  const winesByRegion = useMemo<Record<string, { domain: Domain, wines: Wine[] }[]>>(() => {
    // 1. Group wines by their effective region (wine.region OR domain.region)
    // Structure: { "Bourgogne": [WineA, WineB], "Loire": [WineC] }
    const winesGroupedByEffectiveRegion: Record<string, Wine[]> = {};
    
    wines.forEach(w => {
      if (w.isArchived || (w.stock <= 0 && !w.isPreSale)) return;
      const domain = domains.find(d => d.id === w.domainId);
      if (!domain) return;

      const effectiveRegion = w.region || domain.region || "Autre";
      
      if (!winesGroupedByEffectiveRegion[effectiveRegion]) {
        winesGroupedByEffectiveRegion[effectiveRegion] = [];
      }
      winesGroupedByEffectiveRegion[effectiveRegion].push(w);
    });

    // 2. Inside each region, regroup by Domain
    const finalGrouped: Record<string, { domain: Domain, wines: Wine[] }[]> = {};

    Object.keys(winesGroupedByEffectiveRegion).forEach(region => {
      const regionWines = winesGroupedByEffectiveRegion[region];
      const winesByDomain: Record<string, Wine[]> = {};

      regionWines.forEach(w => {
        if (!winesByDomain[w.domainId]) winesByDomain[w.domainId] = [];
        winesByDomain[w.domainId].push(w);
      });

      finalGrouped[region] = [];

      Object.keys(winesByDomain).forEach(domainId => {
        const domain = domains.find(d => d.id === domainId);
        if (domain) {
          finalGrouped[region].push({
            domain: domain,
            wines: winesByDomain[domainId]
          });
        }
      });
      
      // Sort domains alphabetically within the region
      finalGrouped[region].sort((a, b) => a.domain.name.localeCompare(b.domain.name));
    });

    // 3. Sort regions alphabetically
    return Object.keys(finalGrouped).sort().reduce((acc, key) => {
      acc[key] = finalGrouped[key];
      return acc;
    }, {} as typeof finalGrouped);
  }, [wines, domains]);

  const Container = isEmbedded ? 'div' : 'div';
  const containerClasses = isEmbedded 
    ? "bg-white w-full rounded-2xl shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-8rem)]"
    : "fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex items-center justify-center p-4";
  
  const innerClasses = isEmbedded
    ? "flex-1 overflow-y-auto flex flex-col"
    : "bg-white w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col";

  return (
    <Container className={containerClasses}>
      <div className={innerClasses}>
        <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
           <div>
             <h2 className="text-3xl font-serif tracking-wide italic">La Cave des Peress</h2>
             <p className="text-slate-400 text-sm mt-1 uppercase tracking-widest">Carte des Vins</p>
             <p className="text-red-400 text-sm mt-2 font-medium">Prix HT départ Cave</p>
           </div>
           <div className="flex gap-3 flex-wrap justify-end mt-4 sm:mt-0">
             <button 
               onClick={() => onEditWine(null)} 
               className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 font-medium"
             >
               <Plus size={18} /> Ajouter un vin
             </button>
             <button 
               onClick={() => setShowQuantities(!showQuantities)} 
               className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium ${showQuantities ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'}`}
             >
               {showQuantities ? <><EyeOff size={18} /> Masquer les quantités</> : <><Eye size={18} /> Afficher les quantités</>}
             </button>
             <button 
               onClick={handleExportExcel} 
               className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 font-medium"
             >
               <FileSpreadsheet size={18} /> Export Excel
             </button>
             <button 
               onClick={() => setIsEditMode(!isEditMode)} 
               className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium ${isEditMode ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'}`}
             >
               {isEditMode ? <><Check size={18} /> Terminer la sélection</> : <><Edit2 size={18} /> Modifier la sélection</>}
             </button>
             <button onClick={handlePrint} className="px-4 py-2 bg-white text-slate-900 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 font-medium">
               <Printer size={18} /> Imprimer / PDF
             </button>
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 bg-[#fdfbf7]">
           <div className="max-w-4xl mx-auto space-y-12">
              {(Object.entries(winesByRegion) as [string, { domain: Domain, wines: Wine[] }[]][]).map(([region, domainsGroup]) => (
                <div key={region} className="break-inside-avoid">
                   <h3 className="text-2xl font-serif text-center text-red-900 border-b-2 border-red-900/10 pb-4 mb-8 uppercase tracking-widest">
                     {region}
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
                     {domainsGroup.map(({ domain, wines }) => (
                       <div key={domain.id} className="break-inside-avoid mb-6">
                          <h4 className="font-bold text-lg text-slate-900 mb-1 border-l-4 border-red-900 pl-3">{domain.name}</h4>
                          {wines[0]?.subRegion && <p className="text-xs text-slate-500 uppercase tracking-wider pl-4 mb-2">{wines[0].subRegion}</p>}
                          <ul className="space-y-2 mt-3 pl-4">
                            {wines.map(w => {
                               const sellingPrice = getSellingPrice(w, domain);
                               const isExcluded = excludedWineIds.has(w.id);
                               return (
                                 <li key={w.id} className={`flex justify-between items-end text-sm group ${isExcluded && isEditMode ? 'opacity-40' : ''}`}>
                                    <div className="flex-1 mr-4 overflow-hidden relative flex items-center gap-2">
                                       {isEditMode && (
                                         <div className="flex items-center gap-2">
                                           <input 
                                             type="checkbox" 
                                             checked={!isExcluded}
                                             onChange={() => toggleWineExclusion(w.id)}
                                             className="w-4 h-4 text-red-900 rounded border-gray-300 focus:ring-red-900 cursor-pointer"
                                             title="Exclure de la carte"
                                           />
                                           <input 
                                             type="checkbox" 
                                             checked={!!w.isPreSale}
                                             onChange={() => onUpdateWine({ ...w, isPreSale: !w.isPreSale })}
                                             className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-600 cursor-pointer"
                                             title="Basculer en prévente"
                                           />
                                         </div>
                                       )}
                                       <span className="text-slate-700 font-medium relative z-10 bg-[#fdfbf7] pr-2">
                                          {w.name}
                                          <span className="text-slate-400 font-normal italic ml-2 text-[10px]">({w.color} - {w.format})</span>
                                           {w.isPreSale && <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase rounded">Prévente</span>}
                                       </span>
                                       <div className="border-b border-dotted border-slate-300 absolute w-full bottom-1 left-0 -z-0"></div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 relative z-10 bg-[#fdfbf7] pl-2">
                                       {showQuantities && (
                                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${w.stock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                            {w.stock} dispo.
                                          </span>
                                        )}
                                       <span className="text-slate-400 text-xs italic">{w.vintage}</span>
                                       <span className="text-slate-900 font-bold w-16 text-right">{formatCurrency(sellingPrice)}</span>
                                    </div>
                                 </li>
                               );
                            })}
                          </ul>
                       </div>
                     ))}
                   </div>
                </div>
              ))}
           </div>
           
           <div className="text-center mt-12 pt-6 border-t border-gray-200 text-slate-400 text-xs">
              <p>Tous nos prix sont affichés Hors Taxes (HT). L'abus d'alcool est dangereux pour la santé, à consommer avec modération.</p>
           </div>
        </div>
      </div>
    </Container>
  );
};

export default WineMenu;
