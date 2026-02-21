
import React, { useState, useEffect } from 'react';
import { Wine as WineIcon, X, Save, Copy, Search } from 'lucide-react';
import { Wine, Domain, WineColor } from '../types';
import { getColorBadgeClass, getSmartCoefficient } from '../utils';

const BOTTLE_FORMATS = [
  'Demi-bouteille (37.5cl)',
  '50cl',
  'Bouteille (70cl)',
  'Bouteille (75cl)',
  '1L',
  'Magnum (1.5L)',
  'Jéroboam (3L)',
  'Mathusalem (6L)',
  'Autre'
];

interface WineModalProps {
  isOpen: boolean;
  onClose: () => void;
  wine?: Wine; // Si undefined, mode création
  initialData?: Partial<Wine>; // Pour la duplication ou pré-remplissage
  wines?: Wine[]; // Liste complète pour la recherche de duplication
  domains: Domain[];
  onSave: (wine: Wine, domainName?: string, domainCoef?: number, domainRegion?: string) => void;
}

const WineModal: React.FC<WineModalProps> = ({ isOpen, onClose, wine, initialData, wines, domains, onSave }) => {
  // États du formulaire
  const [name, setName] = useState('');
  const [vintage, setVintage] = useState(new Date().getFullYear().toString());
  const [color, setColor] = useState<WineColor>(WineColor.Red);
  const [price, setPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [coef, setCoef] = useState('');
  const [stock, setStock] = useState('0');
  const [format, setFormat] = useState('Bouteille (75cl)');
  const [region, setRegion] = useState('');
  const [subRegion, setSubRegion] = useState('');
  const [domainId, setDomainId] = useState('');

  // États pour nouveau domaine à la volée
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainRegion, setNewDomainRegion] = useState('');
  const [newDomainCoef, setNewDomainCoef] = useState('1.5');

  // États pour la duplication interne (Recherche)
  const [importSearch, setImportSearch] = useState('');
  const [showImportSuggestions, setShowImportSuggestions] = useState(false);

  // Initialisation
  useEffect(() => {
    if (isOpen) {
      const source = wine || initialData || {};
      setName(source.name || '');
      setVintage(source.vintage || new Date().getFullYear().toString());
      setColor(source.color || WineColor.Red);
      setPrice(source.buyingPriceHT ? source.buyingPriceHT.toString() : '');
      setSellingPrice(source.sellingPriceHT ? source.sellingPriceHT.toString() : '');
      setCoef(source.coefficient ? source.coefficient.toString() : '');
      setStock(source.stock !== undefined ? source.stock.toString() : '0');
      setFormat(source.format || 'Bouteille (75cl)');
      setRegion(source.region || '');
      setSubRegion(source.subRegion || '');
      setDomainId(source.domainId || (domains.length > 0 ? domains[0].id : 'new'));
      
      // Reset new domain fields
      setNewDomainName('');
      setNewDomainRegion('');
      setNewDomainCoef('1.5');
      
      // Reset Import
      setImportSearch('');
      setShowImportSuggestions(false);
    }
  }, [isOpen, wine, initialData, domains]);

  // Auto-fill region/coef/price when domain changes
  useEffect(() => {
    if (domainId !== 'new') {
      const d = domains.find(dom => dom.id === domainId);
      if (d) {
        // Logique : On applique les valeurs par défaut du domaine SEULEMENT si on crée un nouveau vin (pas en édition)
        // ou si les champs sont vides.
        if (!wine) {
            if (!region) setRegion(d.region);
            
            // NOTE: On ne force pas le coef du domaine ici si un prix est déjà saisi,
            // car la règle du prix (<70 vs >70) est prioritaire pour le négociant.
            // On l'initialise seulement si le champ est vide.
            if (!coef) {
                setCoef(d.coefficient.toString());
            }
        }
      }
    }
  }, [domainId, domains]);

  // --- HANDLERS INTELLIGENTS ---

  const handlePriceChange = (val: string) => {
    setPrice(val);
    const p = parseFloat(val);

    // RÈGLE INTELLIGENTE (EXCEL)
    // En mode création, le prix dicte le coefficient :
    // < 70€ -> 1.2
    // >= 70€ -> 1.1
    if (!wine && !isNaN(p)) {
        const smartCoef = getSmartCoefficient(p);
        setCoef(smartCoef.toString());
        setSellingPrice(Math.ceil(p * smartCoef).toString());
    } else {
        // Mode édition ou fallback : on garde le coef actuel
        const c = parseFloat(coef);
        if (!isNaN(p) && !isNaN(c)) {
            setSellingPrice(Math.ceil(p * c).toString());
        }
    }
  };

  const handleCoefChange = (val: string) => {
    setCoef(val);
    // Calcul automatique du prix de vente si un prix d'achat existe
    const c = parseFloat(val);
    const p = parseFloat(price);
    
    if (!isNaN(p) && !isNaN(c)) {
        setSellingPrice(Math.ceil(p * c).toString());
    }
  };

  const handleImportSelection = (sourceWine: Wine) => {
      setName(sourceWine.name);
      setVintage(sourceWine.vintage); // L'utilisateur le changera probablement
      setColor(sourceWine.color);
      setPrice(sourceWine.buyingPriceHT.toString());
      setSellingPrice(sourceWine.sellingPriceHT ? sourceWine.sellingPriceHT.toString() : '');
      setCoef(sourceWine.coefficient ? sourceWine.coefficient.toString() : '');
      setFormat(sourceWine.format);
      setRegion(sourceWine.region || '');
      setSubRegion(sourceWine.subRegion || '');
      setDomainId(sourceWine.domainId);
      
      // On reset le stock à 0 car c'est une nouvelle référence
      setStock('0');
      
      setImportSearch('');
      setShowImportSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) {
       alert("Nom et Prix d'achat obligatoires");
       return;
    }

    if (domainId === 'new' && !newDomainName) {
       alert("Nom du nouveau domaine obligatoire");
       return;
    }

    const finalWine: Wine = {
      id: wine?.id || `w_${Date.now()}`,
      domainId: domainId === 'new' ? `d_${Date.now()}` : domainId,
      name,
      vintage,
      color,
      buyingPriceHT: parseFloat(price),
      sellingPriceHT: sellingPrice ? parseFloat(sellingPrice) : undefined,
      coefficient: coef ? parseFloat(coef) : undefined,
      stock: parseInt(stock) || 0,
      region: region || undefined,
      subRegion: subRegion || undefined,
      format,
      isArchived: wine?.isArchived || false
    };

    onSave(
        finalWine, 
        domainId === 'new' ? newDomainName : undefined, 
        domainId === 'new' ? parseFloat(newDomainCoef) : undefined,
        domainId === 'new' ? newDomainRegion : undefined
    );
    onClose();
  };

  // Filter wines for duplication search
  const filteredImportWines = wines 
    ? wines.filter(w => !w.isArchived && (
        w.name.toLowerCase().includes(importSearch.toLowerCase()) || 
        domains.find(d => d.id === w.domainId)?.name.toLowerCase().includes(importSearch.toLowerCase())
      )).slice(0, 5)
    : [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
             <WineIcon className="text-red-700" size={20} />
             {wine ? 'Modifier la Référence' : 'Ajouter un Vin'}
          </h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* SECTION DUPLICATION (Seulement en mode création) */}
          {!wine && (
             <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 relative z-20">
                <label className="block text-xs font-bold text-blue-700 uppercase tracking-wide mb-1.5 flex items-center gap-2">
                   <Copy size={12} /> Pré-remplir depuis un vin existant
                </label>
                <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 w-4 h-4" />
                   <input 
                      type="text" 
                      placeholder="Rechercher pour dupliquer (ex: Chablis 2020)..."
                      className="w-full pl-9 pr-4 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={importSearch}
                      onChange={(e) => { setImportSearch(e.target.value); setShowImportSuggestions(true); }}
                      onFocus={() => setShowImportSuggestions(true)}
                   />
                   {showImportSuggestions && importSearch && filteredImportWines.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50">
                         {filteredImportWines.map(w => {
                            const d = domains.find(dom => dom.id === w.domainId);
                            return (
                               <div 
                                  key={w.id} 
                                  className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0 flex justify-between items-center"
                                  onClick={() => handleImportSelection(w)}
                               >
                                  <div>
                                     <span className="font-bold text-gray-800 text-sm">{d?.name}</span>
                                     <span className="text-gray-600 text-sm ml-2">{w.name}</span>
                                     <span className="text-gray-400 text-xs ml-2">({w.vintage})</span>
                                  </div>
                                  <div className="text-blue-600 text-xs font-medium">Copier</div>
                               </div>
                            );
                         })}
                      </div>
                   )}
                </div>
                <p className="text-[10px] text-blue-600 mt-1.5">
                   Sélectionnez un vin pour copier ses caractéristiques (Prix, Domaine, Coef...). Vous n'aurez plus qu'à changer le millésime.
                </p>
             </div>
          )}

          {/* Section Domaine */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Domaine</label>
             <select 
               className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition-all font-medium"
               value={domainId}
               onChange={(e) => setDomainId(e.target.value)}
             >
                {domains.sort((a,b) => a.name.localeCompare(b.name)).map(d => (
                   <option key={d.id} value={d.id}>{d.name}</option>
                ))}
                <option value="new">+ Créer un nouveau domaine</option>
             </select>

             {domainId === 'new' && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 pl-4 border-l-2 border-red-200">
                   <input type="text" placeholder="Nom du Domaine" className="w-full px-3 py-2 border rounded-md text-sm" value={newDomainName} onChange={e => setNewDomainName(e.target.value)} />
                   <input type="text" placeholder="Région par défaut" className="w-full px-3 py-2 border rounded-md text-sm" value={newDomainRegion} onChange={e => setNewDomainRegion(e.target.value)} />
                   <div className="md:col-span-2 flex items-center gap-2">
                      <span className="text-sm text-gray-600">Coef. Défaut :</span>
                      <input type="number" step="0.1" className="w-20 px-2 py-1 border rounded-md text-sm" value={newDomainCoef} onChange={e => setNewDomainCoef(e.target.value)} />
                   </div>
                </div>
             )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
             <div className="md:col-span-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Nom de la cuvée</label>
                <input 
                  type="text" 
                  required 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Les Charmes"
                />
             </div>
             <div className="md:col-span-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Millésime</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" 
                  value={vintage} 
                  onChange={(e) => setVintage(e.target.value)} 
                />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Région (Spécifique)</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" 
                  value={region} 
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="Hérité du domaine si vide"
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Sous-Région</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" 
                  value={subRegion} 
                  onChange={(e) => setSubRegion(e.target.value)}
                  placeholder="Ex: Côte de Nuits"
                />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Couleur</label>
                <div className="flex flex-wrap gap-2">
                   {Object.values(WineColor).map(c => (
                      <button
                         key={c}
                         type="button"
                         onClick={() => setColor(c)}
                         className={`px-3 py-1 rounded-full text-xs border transition-colors ${color === c ? getColorBadgeClass(c) + ' ring-2 ring-offset-1 ring-gray-300' : 'bg-white text-gray-600 border-gray-200'}`}
                      >
                         {c}
                      </button>
                   ))}
                </div>
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Format</label>
                <select 
                   className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white"
                   value={format}
                   onChange={(e) => setFormat(e.target.value)}
                >
                   {BOTTLE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
             </div>
          </div>

          <div className="grid grid-cols-3 gap-5 pt-2 border-t border-gray-100">
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Prix Achat HT</label>
                <div className="relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                   <input 
                     type="number" step="0.01" required 
                     className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none font-medium" 
                     value={price} 
                     onChange={(e) => handlePriceChange(e.target.value)} 
                   />
                </div>
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Coef.</label>
                <input 
                  type="number" step="0.1" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-center" 
                  value={coef} 
                  onChange={(e) => handleCoefChange(e.target.value)} 
                  title="< 70€ = 1.2 | >= 70€ = 1.1"
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Prix Vente HT</label>
                <div className="relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                   <input 
                     type="number" step="0.01" 
                     className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none font-bold text-emerald-700" 
                     value={sellingPrice} 
                     onChange={(e) => setSellingPrice(e.target.value)} 
                     placeholder="Auto"
                   />
                </div>
             </div>
          </div>

          <div>
             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Stock Initial / Actuel</label>
             <input 
               type="number" 
               className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" 
               value={stock} 
               onChange={(e) => setStock(e.target.value)} 
             />
          </div>

        </form>

        <div className="p-4 border-t border-gray-100 flex gap-3 shrink-0 bg-white">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors">
              Annuler
            </button>
            <button onClick={handleSubmit} type="button" className="flex-1 px-4 py-3 bg-red-800 text-white rounded-xl hover:bg-red-900 font-semibold shadow-lg shadow-red-200 flex items-center justify-center gap-2 transition-transform active:scale-95">
               <Save size={18} /> Enregistrer
            </button>
        </div>
      </div>
    </div>
  );
};

export default WineModal;
