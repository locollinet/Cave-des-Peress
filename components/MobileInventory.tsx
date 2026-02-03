import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Minus, ArrowLeft, X } from 'lucide-react';
import { Wine, Domain } from '../types';
import { getColorBadgeClass } from '../utils';

// --- SUB-COMPONENT: STOCK ROW WITH DEBOUNCE ---
interface StockRowProps {
  wine: Wine;
  domain?: Domain;
  onStockUpdate: (id: string, newStock: number) => void;
  onEditDomain: (id: string) => void;
  onEditWine: (id: string) => void;
}

const StockRow: React.FC<StockRowProps> = ({ 
  wine, 
  domain, 
  onStockUpdate,
  onEditDomain,
  onEditWine
}) => {
  // Local state for immediate UI response
  const [localStock, setLocalStock] = useState(wine.stock);
  const [isPending, setIsPending] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local stock if external changes happen (e.g. initial load or other user update)
  useEffect(() => {
    setLocalStock(wine.stock);
  }, [wine.stock]);

  const vibrate = () => {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const handleUpdate = (delta: number) => {
    vibrate();
    const newStock = Math.max(0, localStock + delta);
    
    // Immediate UI Update
    setLocalStock(newStock);
    setIsPending(true);

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer (Debounce 600ms)
    debounceTimerRef.current = setTimeout(() => {
      onStockUpdate(wine.id, newStock);
      setIsPending(false);
    }, 600);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col transform transition-all duration-200">
        <div className="p-4 border-b border-gray-100 flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${getColorBadgeClass(wine.color)}`}>
                    {wine.color}
                  </span>
                  <span className="text-gray-400 text-xs font-bold">{wine.vintage}</span>
                  {isPending && <span className="text-[10px] text-orange-500 font-medium animate-pulse">Enregistrement...</span>}
              </div>
              <h3 
                className="font-bold text-gray-900 text-base truncate leading-tight uppercase tracking-wide cursor-pointer active:text-blue-600 active:underline"
                onClick={() => domain && onEditDomain(domain.id)}
              >
                {domain?.name}
              </h3>
              <p 
                className="text-gray-600 text-sm leading-tight mt-1 line-clamp-2 cursor-pointer active:text-blue-600 active:underline"
                onClick={() => onEditWine(wine.id)}
              >
                  {wine.name} {wine.subRegion ? `(${wine.subRegion})` : ''}
              </p>
              {wine.format && wine.format !== 'Bouteille (75cl)' && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] rounded border border-indigo-100 font-bold uppercase">
                    {wine.format}
                  </span>
              )}
            </div>
        </div>

        <div className="flex items-stretch h-16 bg-gray-50">
            <button 
              onClick={() => handleUpdate(-1)}
              className="flex-1 flex items-center justify-center bg-white border-r border-gray-200 text-gray-400 active:bg-red-50 active:text-red-600 transition-colors touch-manipulation"
            >
              <Minus size={28} strokeWidth={3} />
            </button>
            
            <div className="w-24 flex flex-col items-center justify-center bg-white transition-colors duration-300 relative">
              <span className={`text-3xl font-black tabular-nums tracking-tighter ${localStock === 0 ? 'text-red-500' : 'text-gray-800'}`}>
                  {localStock}
              </span>
            </div>

            <button 
              onClick={() => handleUpdate(1)}
              className="flex-1 flex items-center justify-center bg-white border-l border-gray-200 text-gray-400 active:bg-green-50 active:text-green-600 transition-colors touch-manipulation"
            >
              <Plus size={28} strokeWidth={3} />
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
  onAddProduct,
  onExit,
  onEditDomain,
  onEditWine
}: { 
  wines: Wine[], 
  domains: Domain[],
  onStockUpdate: (id: string, newStock: number) => void,
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
                  onStockUpdate={onStockUpdate}
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