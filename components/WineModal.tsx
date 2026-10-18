import React, { useState, useEffect } from 'react';
import { Wine as WineIcon, Save, Copy, Search } from 'lucide-react';
import { Wine, Domain, WineColor, Invoice, Client } from '../types';
import { getColorBadgeClass, getSmartCoefficient } from '../utils';
import SlideOver from './SlideOver';

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
  invoices?: Invoice[];
  clients?: Client[];
  onSave: (wine: Wine, domainName?: string, domainCoef?: number, domainRegion?: string) => void;
}

export const WineModal: React.FC<WineModalProps> = ({ 
  isOpen, 
  onClose, 
  wine, 
  initialData, 
  wines, 
  domains, 
  invoices, 
  clients, 
  onSave 
}) => {
  // États du formulaire
  const [name, setName] = useState('');
  const [vintage, setVintage] = useState(new Date().getFullYear().toString());
  const [color, setColor] = useState<WineColor>(WineColor.Red);
  const [price, setPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [coef, setCoef] = useState('');
  const [stock, setStock] = useState('0');
  const [format, setFormat] = useState('Bouteille (75cl)');
  const [isPreSale, setIsPreSale] = useState(false);
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
      
      const p = source.buyingPriceHT !== undefined ? source.buyingPriceHT.toString() : '';
      setPrice(p);
      setSellingPrice(source.sellingPriceHT ? source.sellingPriceHT.toString() : '');
      setFormat(source.format || 'Bouteille (75cl)');
      setIsPreSale(!!source.isPreSale);
      setRegion(source.region || '');
      setSubRegion(source.subRegion || '');
      
      if (wine) {
         setStock(source.stock !== undefined ? source.stock.toString() : '0');
         setCoef(source.coefficient ? source.coefficient.toString() : '');
         setDomainId(source.domainId || (domains.length > 0 ? domains[0].id : ''));
      } else {
         setStock(source.stock !== undefined ? source.stock.toString() : '0');
         if (source.domainId) {
             setDomainId(source.domainId);
         } else if (domains.length > 0) {
             setDomainId(domains[0].id);
         }
         
         if (p && !isNaN(parseFloat(p))) {
             const smart = getSmartCoefficient(parseFloat(p));
             setCoef(smart.toString());
         } else if (source.coefficient) {
             setCoef(source.coefficient.toString());
         } else {
             const d = domains.find(dom => dom.id === source.domainId);
             setCoef(d ? d.coefficient.toString() : '1.5');
         }
      }

      setNewDomainName('');
      setNewDomainRegion('');
      setNewDomainCoef('1.5');
      setImportSearch('');
      setShowImportSuggestions(false);
    }
  }, [isOpen, wine, initialData, domains]);

  useEffect(() => {
    if (!wine && domainId && domainId !== 'new') {
      const d = domains.find(dom => dom.id === domainId);
      if (d) {
        if (!region) setRegion(d.region || '');
      }
    }
  }, [domainId, domains, wine, region]);

  const buyers = React.useMemo(() => {
    if (!wine || !invoices || !clients) return [];
    
    const relevantInvoices = invoices.filter(inv => 
      inv.type === 'Sale' && 
      (inv.status === 'Validated' || inv.status === 'Paid') &&
      inv.items.some(item => item.id === wine.id)
    );
    
    const clientMap = new Map<string, { clientName: string, totalQuantity: number }>();
    
    relevantInvoices.forEach(inv => {
      const items = inv.items.filter(i => i.id === wine.id);
      const totalQuantityInInvoice = items.reduce((sum, i) => sum + i.quantity, 0);
      if (totalQuantityInInvoice === 0) return;
      
      const clientName = inv.clientName || 'Client Comptoir';
      const key = inv.clientId || clientName;
      
      const existing = clientMap.get(key);
      if (existing) {
        existing.totalQuantity += totalQuantityInInvoice;
      } else {
        clientMap.set(key, { clientName, totalQuantity: totalQuantityInInvoice });
      }
    });
    
    return Array.from(clientMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [wine, invoices, clients]);

  // Handlers intelligents de calcul
  const handlePriceChange = (val: string) => {
    setPrice(val);
    const p = parseFloat(val);

    if (!wine && !isNaN(p)) {
      const smartCoef = getSmartCoefficient(p);
      setCoef(smartCoef.toString());
      setSellingPrice(Math.ceil(p * smartCoef).toString());
    } else {
      const c = parseFloat(coef);
      if (!isNaN(p) && !isNaN(c)) {
        setSellingPrice(Math.ceil(p * c).toString());
      }
    }
  };

  const handleCoefChange = (val: string) => {
    setCoef(val);
    const c = parseFloat(val);
    const p = parseFloat(price);
    
    if (!isNaN(p) && !isNaN(c)) {
      setSellingPrice(Math.ceil(p * c).toString());
    }
  };

  const handleImportSelection = (sourceWine: Wine) => {
    setName(sourceWine.name);
    setVintage(sourceWine.vintage);
    setColor(sourceWine.color);
    setPrice(sourceWine.buyingPriceHT.toString());
    setSellingPrice(sourceWine.sellingPriceHT ? sourceWine.sellingPriceHT.toString() : '');
    setCoef(sourceWine.coefficient ? sourceWine.coefficient.toString() : '');
    setFormat(sourceWine.format);
    setRegion(sourceWine.region || '');
    setSubRegion(sourceWine.subRegion || '');
    setDomainId(sourceWine.domainId);
    setStock('0');
    setImportSearch('');
    setShowImportSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanPrice = price.toString().replace(',', '.');
    const cleanSellingPrice = sellingPrice.toString().replace(',', '.');
    const cleanCoef = coef.toString().replace(',', '.');

    if (!name || cleanPrice === '') {
      alert("Le nom et le prix d'achat sont obligatoires (utilisez 0€ si besoin)");
      return;
    }

    if (domainId === 'new' && !newDomainName) {
      alert("Nom du nouveau domaine obligatoire");
      return;
    }

    const parsedPrice = parseFloat(cleanPrice);
    if (isNaN(parsedPrice)) {
      alert("Le prix d'achat n'est pas un nombre valide");
      return;
    }

    const finalWine: Wine = {
      id: wine?.id || `w_${Date.now()}`,
      domainId: domainId === 'new' ? `d_${Date.now()}` : domainId,
      name,
      vintage,
      color,
      buyingPriceHT: parsedPrice,
      sellingPriceHT: cleanSellingPrice ? parseFloat(cleanSellingPrice) : undefined,
      coefficient: cleanCoef ? parseFloat(cleanCoef) : undefined,
      stock: isPreSale ? 0 : (parseInt(stock) || 0),
      isPreSale,
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

  const filteredImportWines = wines 
    ? wines.filter(w => !w.isArchived && (
        w.name.toLowerCase().includes(importSearch.toLowerCase()) || 
        domains.find(d => d.id === w.domainId)?.name.toLowerCase().includes(importSearch.toLowerCase())
      )).slice(0, 5)
    : [];

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={wine ? 'Modifier la Référence' : (initialData ? 'Dupliquer la Référence' : 'Ajouter un Vin')}
      subtitle={wine ? `${wine.name} (${wine.vintage})` : 'Fiche cuvée & tarification'}
      icon={<WineIcon size={20} className="text-rose-400" />}
      widthClass="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* SECTION DUPLICATION (Seulement en mode création) */}
        {!wine && (
          <div className="bg-rose-950/40 border border-rose-900/40 rounded-xl p-3.5 mb-4 relative z-20">
            <label className="block text-xs font-semibold text-rose-300 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Copy size={13} /> Pré-remplir depuis un vin existant
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Rechercher pour dupliquer (ex: Chablis 2020)..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-rose-500 outline-none"
                value={importSearch}
                onChange={(e) => { setImportSearch(e.target.value); setShowImportSuggestions(true); }}
                onFocus={() => setShowImportSuggestions(true)}
              />
              {showImportSuggestions && importSearch && filteredImportWines.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
                  {filteredImportWines.map(w => {
                    const d = domains.find(dom => dom.id === w.domainId);
                    return (
                      <div 
                        key={w.id} 
                        className="px-3.5 py-2 hover:bg-slate-800 cursor-pointer border-b border-slate-800 last:border-0 flex justify-between items-center text-sm"
                        onClick={() => handleImportSelection(w)}
                      >
                        <div>
                          <span className="font-semibold text-slate-100">{d?.name}</span>
                          <span className="text-slate-300 ml-2">{w.name}</span>
                          <span className="text-slate-400 text-xs ml-1.5">({w.vintage})</span>
                        </div>
                        <div className="text-rose-400 text-xs font-semibold">Dupliquer</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section Domaine */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Domaine Viticole
          </label>
          <select 
            className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none text-slate-100 font-medium text-sm"
            value={domainId}
            onChange={(e) => setDomainId(e.target.value)}
          >
            {domains.sort((a,b) => a.name.localeCompare(b.name)).map(d => (
              <option key={d.id} value={d.id} className="bg-slate-900 text-slate-200">{d.name}</option>
            ))}
            <option value="new" className="bg-slate-900 text-rose-300 font-bold">+ Créer un nouveau domaine</option>
          </select>

          {domainId === 'new' && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 pl-3.5 border-l-2 border-rose-800/80">
              <input type="text" placeholder="Nom du Domaine" className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-100" value={newDomainName} onChange={e => setNewDomainName(e.target.value)} />
              <input type="text" placeholder="Région par défaut" className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-100" value={newDomainRegion} onChange={e => setNewDomainRegion(e.target.value)} />
              <div className="md:col-span-2 flex items-center gap-2">
                <span className="text-xs text-slate-400">Coef. Défaut :</span>
                <input type="number" step="0.1" className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-100" value={newDomainCoef} onChange={e => setNewDomainCoef(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Cuvée & Millésime */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">
              Nom de la cuvée
            </label>
            <input 
              type="text" 
              required 
              className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none text-slate-100 font-medium text-sm placeholder-slate-500" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Les Charmes ou Chassagne-Montrachet"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">
              Millésime
            </label>
            <input 
              type="text" 
              className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none text-slate-100 font-mono text-sm" 
              value={vintage} 
              onChange={(e) => setVintage(e.target.value)} 
            />
          </div>
        </div>

        {/* Région & Sous-Région */}
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">Région</label>
            <input 
              type="text" 
              className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 outline-none focus:ring-2 focus:ring-rose-500 placeholder-slate-500" 
              value={region} 
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Hérité du domaine"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">Sous-Région / Climat</label>
            <input 
              type="text" 
              className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 outline-none focus:ring-2 focus:ring-rose-500 placeholder-slate-500" 
              value={subRegion} 
              onChange={(e) => setSubRegion(e.target.value)}
              placeholder="Ex: Côte de Nuits"
            />
          </div>
        </div>

        {/* Couleur & Format */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">Couleur</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.values(WineColor).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    color === c 
                      ? 'bg-rose-950 text-rose-200 border-rose-700 ring-1 ring-rose-600' 
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">Format</label>
            <select 
              className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 outline-none focus:ring-2 focus:ring-rose-500"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              {BOTTLE_FORMATS.map(f => <option key={f} value={f} className="bg-slate-900 text-slate-200">{f}</option>)}
            </select>
          </div>
        </div>

        {/* Prix & Coefficient */}
        <div className="grid grid-cols-3 gap-3.5 pt-3 border-t border-slate-800/80">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">
              Prix Achat HT
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono">€</span>
              <input 
                type="text"
                className="w-full pl-7 pr-3 py-2 bg-slate-800/90 border border-slate-700/80 rounded-lg text-sm font-mono font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-rose-500" 
                value={price} 
                placeholder="0.00"
                onChange={(e) => handlePriceChange(e.target.value)} 
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">
              Coefficient
            </label>
            <input 
              type="text"
              className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700/80 rounded-lg text-sm font-mono text-center text-slate-100 outline-none focus:ring-2 focus:ring-rose-500" 
              value={coef} 
              onChange={(e) => handleCoefChange(e.target.value)} 
              title="< 70€ = 1.2 | >= 70€ = 1.1"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">
              Prix Vente HT
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono">€</span>
              <input 
                type="text"
                className="w-full pl-7 pr-3 py-2 bg-slate-800/90 border border-slate-700/80 rounded-lg text-sm font-mono font-bold text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500" 
                value={sellingPrice} 
                onChange={(e) => setSellingPrice(e.target.value)} 
                placeholder="Auto"
              />
            </div>
          </div>
        </div>

        {/* Stock & Prévente */}
        <div className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1">
              Stock Actuel (Bouteilles)
            </label>
            <input 
              type="number" 
              disabled={isPreSale}
              className="w-28 px-3 py-1.5 bg-slate-800/90 border border-slate-700/80 rounded-lg text-sm font-mono font-bold text-slate-100 outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50" 
              value={stock} 
              onChange={(e) => setStock(e.target.value)} 
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300 select-none">
            <input 
              type="checkbox" 
              id="isPreSale"
              checked={isPreSale}
              onChange={(e) => setIsPreSale(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-rose-600 focus:ring-rose-500"
            />
            <span>Cuvée en prévente (n'impacte pas le stock)</span>
          </label>
        </div>

        {/* Historique des acheteurs (si vin existant) */}
        {wine && (
          <div className="pt-3 border-t border-slate-800/80">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Historique des Ventes
            </label>
            {buyers.length > 0 ? (
              <div className="bg-slate-950/60 rounded-lg border border-slate-800/80 overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-800/50 text-slate-400 uppercase text-[10px] font-mono">
                    <tr>
                      <th className="px-3 py-2">Client</th>
                      <th className="px-3 py-2 text-right">Quantité Achetée</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {buyers.map(({ clientName, totalQuantity }, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-medium text-slate-200">{clientName}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-100">{totalQuantity} btls</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic bg-slate-950/40 p-2.5 rounded-lg border border-slate-800 text-center">
                Aucune vente enregistrée pour cette référence.
              </div>
            )}
          </div>
        )}

        <div className="pt-6 border-t border-slate-800/80 flex gap-3">
          <button 
            type="button" 
            onClick={onClose} 
            className="flex-1 px-4 py-2.5 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors text-sm"
          >
            Annuler
          </button>
          <button 
            type="submit" 
            className="flex-1 px-4 py-2.5 bg-rose-900/90 hover:bg-rose-800 text-rose-100 border border-rose-700/50 rounded-lg font-semibold shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
          >
            <Save size={16} /> Enregistrer la Référence
          </button>
        </div>
      </form>
    </SlideOver>
  );
};

export default WineModal;
