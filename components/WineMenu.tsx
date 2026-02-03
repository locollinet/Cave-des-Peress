
import React, { useMemo } from 'react';
import { Printer } from 'lucide-react';
import { Wine, Domain } from '../types';
import { formatCurrency, getSellingPrice, printWineMenu } from '../utils';

const WineMenu = ({ 
  wines, 
  domains, 
  isEmbedded = false,
  logo
}: { 
  wines: Wine[], 
  domains: Domain[],
  isEmbedded?: boolean,
  logo?: string
}) => {
  const winesByRegion = useMemo<Record<string, { domain: Domain, wines: Wine[] }[]>>(() => {
    // 1. Group wines by their effective region (wine.region OR domain.region)
    // Structure: { "Bourgogne": [WineA, WineB], "Loire": [WineC] }
    const winesGroupedByEffectiveRegion: Record<string, Wine[]> = {};
    
    wines.forEach(w => {
      if (w.isArchived) return;
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
           </div>
           <div className="flex gap-3">
             <button onClick={() => printWineMenu(wines, domains, logo)} className="px-4 py-2 bg-white text-slate-900 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 font-medium">
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
                          <ul className="space-y-2 mt-3 pl-4">
                            {wines.map(w => {
                               const sellingPrice = getSellingPrice(w, domain);
                               return (
                                 <li key={w.id} className="flex justify-between items-end text-sm group">
                                    <div className="flex-1 mr-4 overflow-hidden relative">
                                       <span className="text-slate-700 font-medium relative z-10 bg-[#fdfbf7] pr-2">
                                          {w.name}
                                          {w.subRegion && <span className="text-slate-400 font-normal italic ml-2 text-xs">({w.subRegion})</span>}
                                       </span>
                                       <div className="border-b border-dotted border-slate-300 absolute w-full bottom-1 left-0 -z-0"></div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 relative z-10 bg-[#fdfbf7] pl-2">
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
