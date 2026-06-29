import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Minus, ArrowLeft, X } from 'lucide-react';
import { Wine, Domain } from '../types';
import { getColorBadgeClass } from '../utils';

// --- SUB-COMPONENT: STOCK ROW WITH DEBOUNCE ---
interface StockRowProps {
  wine: Wine;
  domain?: Domain;
  onOpenAdjustmentModal: (wine: Wine) => void;
  onEditDomain: (id: string) => void;
  onEditWine: (id: string) => void;
}

const StockRow: React.FC<StockRowProps> = ({ 
  wine, 
  domain, 
  onOpenAdjustmentModal,
  onEditDomain,
  onEditWine
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col transform transition-all duration-200">
        <div className="p-4 border-b border-gray-100 flex justify-between items-start gap-4">
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                   <span className={`w-3 h-3 rounded-full ${getColorBadgeClass(wine.color)}`}></span>
                   <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{wine.appellation || 'Appellation'}</span>
                </div>
                <h3 className="font-bold text-gray-900 leading-tight text-lg">{wine.name}</h3>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEditDomain(wine.domainId); }}
                    className="text-sm font-medium text-red-700 hover:underline"
                  >
                    {domain?.name || 'Domaine inconnu'}
                  </button>
                  <span className="text-sm text-gray-500">{wine.millesime || 'N.V.'}</span>
                </div>
            </div>
            <div className="flex flex-col items-end">
                <span className={`text-2xl font-black ${wine.stock <= 6 ? 'text-red-500' : 'text-slate-900'}`}>
                    {wine.stock}
                </span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Unités</span>
            </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100 bg-gray-50/50">
            <button 
              onClick={() => onEditWine(wine.id)}
              className="py-3 text-xs font-bold text-gray-500 uppercase tracking-wider active:bg-gray-100"
            >
              Détails
            </button>
            <button 
              onClick={() => onOpenAdjustmentModal(wine)}
              className="py-3 text-xs font-bold text-red-700 uppercase tracking-wider active:bg-gray-100"
            >
              Ajuster Stock
            </button>
        </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
const MobileInventory = ({ 
  wines, 
  domains,
  onStockUpdate,
  onOpenAdjustmentModal,
  onAddProduct,
  onExit,
  onEditDomain,
  onEditWine
}: { 
  wines: Wine[], 
  domains: Domain[],
  onStockUpdate: (id: string, newStock: number, reason: string) => void,
  onOpenAdjustmentModal: (wine: Wine) => void,
  onAddProduct: (wine: Wine, domainName?: string) => void,
  onExit: () => void,
  onEditDomain: (id: string) => void,
  onEditWine: (id: string | null) => void
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterColor, setFilterColor] = useState<string>('all');

  const filteredWines = useMemo(() => {
    return wines.filter(w => {
      if (w.isArchived) return false;
      const domain = domains.find(d => d.id === w.domainId);
      
      const matchesSearch = 
        !searchTerm || 
        w.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (domain?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesColor = filterColor === 'all' || w.color === filterColor;

      return matchesSearch && matchesColor;
    }).sort((a, b) => {
        const domA = domains.find(d => d.id === a.domainId)?.name || '';
        const domB = domains.find(d => d.id === b.domainId)?.name || '';
        return domA.localeCompare(domB) || a.name.localeCompare(b.name);
    });
  }, [wines, domains, searchTerm, filterColor]);

  return (
    <div className="fixed inset-0 z-[100] bg-gray-100 flex flex-col font-sans">
      {/* --- HEADER --- */}
      <div className="bg-slate-900 px-4 pt-4 pb-2 shadow-lg shrink-0">
        <div className="flex items-center justify-between mb-4">
           <div className="flex items-center gap-3">
              <button 
                onClick={onExit}
                className="p-2 bg-slate-800 rounded-full text-slate-300 hover:text-white active:bg-slate-700 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                 <h2 className="text-white font-bold text-lg leading-none">Inventaire Flash</h2>
                 <p className="text-slate-400 text-xs mt-1">Mode Terrain</p>
              </div>
           </div>
           
           <div className="flex gap-2">
              {/* Bouton Ajout Rapide */}
              <button 
                 onClick={() => onEditWine(null)}
                 className="bg-white/10 w-10 h-10 rounded-full flex items-center justify-center text-white active:bg-white/20"
              >
                 <Plus size={24} />
              </button>
           </div>
        </div>
        
        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Rechercher..." 
            className="w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-base"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-600 rounded-full p-0.5 text-slate-300"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters Scrollable */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4">
           <button 
             onClick={() => setFilterColor('all')} 
             className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${filterColor === 'all' ? 'bg-white text-slate-900 border-white' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
           >
             Tout
           </button>
           {['Rouge', 'Blanc', 'Rosé', 'Effervescent', 'Spiritueux'].map(c => (
             <button 
               key={c} 
               onClick={() => setFilterColor(c)} 
               className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${filterColor === c ? 'bg-white text-slate-900 border-white' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
             >
               {c}
             </button>
           ))}
        </div>
      </div>

      {/* --- CONTENT LIST --- */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-100 pb-12">
        {filteredWines.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Search size={48} className="mb-4 opacity-20" />
              <p className="text-lg mb-4">Aucune référence trouvée.</p>
              <button onClick={() => onEditWine(null)} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg flex items-center gap-2">
                 <Plus size={20} /> Créer cette référence
              </button>
           </div>
        ) : (
           filteredWines.map(wine => {
             const domain = domains.find(d => d.id === wine.domainId);
             return (
               <StockRow 
                  key={wine.id} 
                  wine={wine} 
                  domain={domain} 
                  onOpenAdjustmentModal={onOpenAdjustmentModal}
                  onEditDomain={onEditDomain}
                  onEditWine={onEditWine}
               />
             );
           })
        )}
        <div className="h-12"></div>
      </div>
    </div>
  );
};

export default MobileInventory;