import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Plus, Minus, Trash2, FileText, Gift, UserPlus, 
  Home, X, Truck, Briefcase, Utensils, Coffee, MousePointer2, 
  Receipt, Check, ChevronDown, Sparkles, AlertCircle, ShoppingBag, ArrowRight
} from 'lucide-react';
import { Wine, Domain, CartItem, Client, WineColor } from '../types';
import { formatCurrency, getSellingPrice, calculateInvoiceTotals } from '../utils';

interface CartProps {
  wines: Wine[];
  domains: Domain[];
  clients: Client[];
  initialSelection?: string[];
  onClearInitialSelection?: () => void;
  onCreateInvoice: (clientName: string, items: CartItem[], type: 'ProForma' | 'Invoice', shippingCost?: number) => void;
  onEditDomain: (id: string) => void;
  onEditWine: (id: string) => void;
  onEditClient: (id: string | null) => void;
}

export const Cart: React.FC<CartProps> = ({
  wines,
  domains,
  clients,
  initialSelection,
  onClearInitialSelection,
  onCreateInvoice,
  onEditDomain,
  onEditWine,
  onEditClient
}) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [clientName, setClientName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [docType, setDocType] = useState<'ProForma' | 'Invoice'>('Invoice');
  const [isPersonalConsumption, setIsPersonalConsumption] = useState(false);
  const [shippingCost, setShippingCost] = useState('');
  
  // Menu ajout libre/prestation
  const [showAddItemMenu, setShowAddItemMenu] = useState(false);
  const addItemMenuRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filtres catalogue
  const [selectedColor, setSelectedColor] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [domainFilter, setDomainFilter] = useState('all');
  const [itemSearch, setItemSearch] = useState('');

  // Transfert depuis inventaire
  useEffect(() => {
    if (initialSelection && initialSelection.length > 0) {
      setCartItems(prev => {
        const newItems: CartItem[] = [];
        initialSelection.forEach(id => {
          if (prev.find(i => i.id === id && !i.fromExternalStock)) return;
          const wine = wines.find(w => w.id === id);
          if (wine) {
            const domain = domains.find(d => d.id === wine.domainId);
            const price = isPersonalConsumption ? wine.buyingPriceHT : getSellingPrice(wine, domain);
            newItems.push({
              ...wine,
              quantity: 1,
              sellingPriceHT: price,
              isGift: false,
              fromExternalStock: false,
              vatRate: 20
            });
          }
        });
        return [...prev, ...newItems];
      });
      if (onClearInitialSelection) onClearInitialSelection();
    }
  }, [initialSelection, wines, domains, isPersonalConsumption, onClearInitialSelection]);

  // Fermeture des menus au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      if (addItemMenuRef.current && !addItemMenuRef.current.contains(event.target as Node)) {
        setShowAddItemMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Suggestions clients
  const clientSuggestions = useMemo(() => {
    if (!clientName.trim()) return [];
    return clients.filter(c => c.name.toLowerCase().includes(clientName.toLowerCase())).slice(0, 5);
  }, [clientName, clients]);

  const selectedClient = useMemo(() => {
    return clients.find(c => c.name.toLowerCase() === clientName.trim().toLowerCase());
  }, [clientName, clients]);

  // Bascule sortie perso / prix coûtant
  const togglePersonalConsumption = () => {
    const newValue = !isPersonalConsumption;
    setIsPersonalConsumption(newValue);
    
    setCartItems(prev => prev.map(item => {
      if (item.isGift || item.isService) return item;
      const wine = wines.find(w => w.id === item.id);
      const domain = domains.find(d => d.id === item.domainId);
      if (!wine) return item;

      return {
        ...item,
        sellingPriceHT: newValue ? wine.buyingPriceHT : getSellingPrice(wine, domain)
      };
    }));
  };

  const addToCart = (wine: Wine) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.id === wine.id && !i.fromExternalStock);
      if (existing) {
        return prev.map(i => i.id === wine.id && !i.fromExternalStock 
          ? { ...i, quantity: Math.min(wine.stock, i.quantity + 1) } 
          : i
        );
      }
      
      const domain = domains.find(d => d.id === wine.domainId);
      const price = isPersonalConsumption ? wine.buyingPriceHT : getSellingPrice(wine, domain);
      
      return [...prev, { 
        ...wine, 
        quantity: 1, 
        sellingPriceHT: price, 
        isGift: false, 
        fromExternalStock: false,
        vatRate: 20
      }];
    });
  };

  const handleAddSpecialItem = (label: string, defaultVat: number) => {
    const newItem: CartItem = {
      id: `cust_${Date.now()}`,
      domainId: '',
      name: label === 'Autre' ? 'Prestation libre' : label,
      vintage: '',
      color: WineColor.Other,
      buyingPriceHT: 0,
      sellingPriceHT: 0,
      stock: 999,
      format: 'Unité',
      quantity: 1,
      isService: true,
      fromExternalStock: false,
      vatRate: defaultVat
    };
    setCartItems(prev => [...prev, newItem]);
    setShowAddItemMenu(false);
  };

  const removeFromCart = (id: string, fromExternal: boolean = false) => {
    setCartItems(prev => prev.filter(i => !(i.id === id && (i.fromExternalStock || false) === fromExternal)));
  };

  const updateQuantity = (id: string, delta: number, fromExternal: boolean = false) => {
    setCartItems(prev => prev.map(i => {
      if (i.id === id && (i.fromExternalStock || false) === fromExternal) {
        const wine = wines.find(w => w.id === id);
        const maxStock = wine ? wine.stock : 999;
        const newQ = Math.max(1, Math.min(maxStock, i.quantity + delta));
        return { ...i, quantity: newQ };
      }
      return i;
    }));
  };

  const setQuantity = (id: string, newQ: number, fromExternal: boolean = false) => {
    setCartItems(prev => prev.map(i => {
      if (i.id === id && (i.fromExternalStock || false) === fromExternal) {
        const wine = wines.find(w => w.id === id);
        const maxStock = wine ? wine.stock : 999;
        return { ...i, quantity: Math.max(1, Math.min(maxStock, newQ)) };
      }
      return i;
    }));
  };

  const updatePrice = (id: string, newPrice: string, fromExternal: boolean = false) => {
    const parsedPrice = parseFloat(newPrice);
    if (isNaN(parsedPrice)) return;
    
    setCartItems(prev => prev.map(i => {
      if (i.id === id && (i.fromExternalStock || false) === fromExternal) {
        return { ...i, sellingPriceHT: Math.max(0, parsedPrice), isGift: false };
      }
      return i;
    }));
  };

  const toggleGift = (id: string, fromExternal: boolean = false) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === id && (item.fromExternalStock || false) === fromExternal) {
        if (item.isGift) {
          const originalWine = wines.find(w => w.id === item.id);
          const domain = originalWine ? domains.find(d => d.id === originalWine.domainId) : undefined;
          const price = originalWine ? (isPersonalConsumption ? originalWine.buyingPriceHT : getSellingPrice(originalWine, domain)) : 0;
          return { ...item, isGift: false, sellingPriceHT: price };
        } else {
          return { ...item, isGift: true, sellingPriceHT: 0 };
        }
      }
      return item;
    }));
  };

  // Régions disponibles
  const allRegions = useMemo(() => [...new Set(domains.map(d => d.region).filter(Boolean))].sort(), [domains]);

  // Vins filtrés
  const filteredWines = useMemo(() => {
    return wines.filter(w => {
      if (w.isArchived || w.stock <= 0) return false;
      const domain = domains.find(d => d.id === w.domainId);
      if (!domain) return false;

      // Filtre couleur
      if (selectedColor !== 'all' && w.color !== selectedColor) return false;

      // Filtre région
      if (regionFilter !== 'all' && domain.region !== regionFilter) return false;

      // Filtre domaine
      if (domainFilter !== 'all' && w.domainId !== domainFilter) return false;

      // Recherche textuelle
      if (itemSearch.trim()) {
        const query = itemSearch.toLowerCase();
        const matchName = w.name.toLowerCase().includes(query);
        const matchDomain = domain.name.toLowerCase().includes(query);
        const matchVintage = w.vintage ? w.vintage.toLowerCase().includes(query) : false;
        const matchRegion = (w.region || domain.region || '').toLowerCase().includes(query);
        if (!matchName && !matchDomain && !matchVintage && !matchRegion) return false;
      }

      return true;
    });
  }, [wines, domains, selectedColor, regionFilter, domainFilter, itemSearch]);

  const shipping = parseFloat(shippingCost) || 0;
  const totals = calculateInvoiceTotals(cartItems, shipping);

  const handleSubmit = () => {
    if (!clientName.trim()) {
      alert('Veuillez renseigner ou sélectionner le nom du client.');
      return;
    }
    if (cartItems.length === 0) {
      alert('Le ticket de caisse est vide. Veuillez ajouter au moins un vin.');
      return;
    }
    onCreateInvoice(clientName.trim(), cartItems, docType, shipping);
    setCartItems([]);
    setClientName('');
    setShippingCost('');
    setIsPersonalConsumption(false);
  };

  // Helper couleur de vin subtile
  const getColorBadge = (color: WineColor) => {
    switch (color) {
      case WineColor.Red:
        return 'text-bordeaux-800 bg-bordeaux-50 border-bordeaux-200';
      case WineColor.White:
        return 'text-amber-800 bg-amber-50 border-amber-200';
      case WineColor.Rose:
        return 'text-rose-700 bg-rose-50 border-rose-200';
      case WineColor.Sparkling:
        return 'text-champagne-600 bg-champagne-100 border-champagne-300';
      default:
        return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-[1600px] mx-auto p-4 md:p-6 gap-6 font-sans">
      
      {/* EN-TÊTE DE LA CAISSE */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-lin-300 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-bordeaux-800 text-ivory-50 flex items-center justify-center shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-bordeaux-950">
                Comptoir & Caisse
              </h1>
              <p className="text-xs text-slate-500 font-medium tracking-wide">
                Édition des ventes directes, devis et sorties dégustation
              </p>
            </div>
          </div>
        </div>

        {/* STATUT RAPIDE */}
        <div className="flex items-center gap-4 text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-white border border-lin-300 text-slate-600 shadow-sm">
            <span className="text-slate-400 mr-1">Références disponibles :</span>
            <span className="font-mono font-semibold text-bordeaux-900">{filteredWines.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white border border-lin-300 text-slate-600 shadow-sm">
            <span className="text-slate-400 mr-1">Articles au ticket :</span>
            <span className="font-mono font-semibold text-bordeaux-900">{cartItems.reduce((acc, i) => acc + i.quantity, 0)}</span>
          </div>
        </div>
      </header>

      {/* DISPOSITION DOUBLE COLONNE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* COLONNE GAUCHE (7/12) : CATALOGUE DE LA CAVE */}
        <section className="lg:col-span-7 flex flex-col bg-white rounded-xl border border-lin-300 shadow-sm overflow-hidden">
          
          {/* BARRE DE RECHERCHE ET FILTRES */}
          <div className="p-4 border-b border-lin-200 bg-ivory-50 space-y-3">
            
            {/* Champ de recherche */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Rechercher une cuvée, un domaine, un millésime..." 
                className="w-full pl-10 pr-9 py-2.5 bg-white border border-lin-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-bordeaux-700 focus:ring-1 focus:ring-bordeaux-700 transition-all shadow-sm"
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
              />
              {itemSearch && (
                <button 
                  onClick={() => setItemSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filtres par robe & catégories */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[
                { label: 'Toutes robes', value: 'all' },
                { label: 'Rouges', value: WineColor.Red },
                { label: 'Blancs', value: WineColor.White },
                { label: 'Effervescents', value: WineColor.Sparkling },
                { label: 'Rosés', value: WineColor.Rose },
                { label: 'Spiritueux', value: WineColor.Liquor }
              ].map(btn => (
                <button
                  key={btn.value}
                  onClick={() => setSelectedColor(btn.value)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    selectedColor === btn.value
                      ? 'bg-bordeaux-800 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-lin-100 border border-lin-300'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Sélecteurs Région & Domaine */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <select
                className="w-full px-3 py-2 bg-white border border-lin-300 rounded-lg text-slate-700 outline-none focus:border-bordeaux-700"
                value={regionFilter}
                onChange={(e) => {
                  setRegionFilter(e.target.value);
                  setDomainFilter('all');
                }}
              >
                <option value="all">Toutes les régions viticoles</option>
                {allRegions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <select
                className="w-full px-3 py-2 bg-white border border-lin-300 rounded-lg text-slate-700 outline-none focus:border-bordeaux-700"
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
              >
                <option value="all">Tous les domaines</option>
                {domains
                  .filter(d => regionFilter === 'all' || d.region === regionFilter)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))
                }
              </select>
            </div>
          </div>

          {/* LISTE DES BOUTEILLES DU CATALOGUE */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-lin-100">
            {filteredWines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <ShoppingBag className="w-10 h-10 stroke-1 text-lin-400 mb-2" />
                <p className="font-serif text-lg font-medium text-slate-600">Aucune référence trouvée</p>
                <p className="text-xs text-slate-400 mt-1">Modifiez vos termes de recherche ou réinitialisez les filtres.</p>
              </div>
            ) : (
              filteredWines.map(wine => {
                const domain = domains.find(d => d.id === wine.domainId);
                const priceHT = isPersonalConsumption ? wine.buyingPriceHT : getSellingPrice(wine, domain);
                const priceTTC = priceHT * 1.20;
                const inCartItem = cartItems.find(i => i.id === wine.id);

                return (
                  <div
                    key={wine.id}
                    onClick={() => addToCart(wine)}
                    className="pt-2 first:pt-0 group cursor-pointer"
                  >
                    <div className="p-3 rounded-lg border border-transparent hover:border-lin-300 hover:bg-ivory-50 transition-all flex items-center justify-between gap-4">
                      
                      {/* Détails du Vin */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span 
                            onClick={(e) => { e.stopPropagation(); onEditDomain(wine.domainId); }}
                            className="font-serif text-xs uppercase tracking-wider font-semibold text-bordeaux-800 hover:underline"
                          >
                            {domain?.name || 'Domaine non renseigné'}
                          </span>
                          {wine.region && (
                            <span className="text-[10px] text-slate-400">· {wine.region}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5">
                          <h3 
                            onClick={(e) => { e.stopPropagation(); onEditWine(wine.id); }}
                            className="text-sm font-semibold text-slate-900 hover:text-bordeaux-700 truncate"
                          >
                            {wine.name}
                          </h3>
                          {wine.vintage && (
                            <span className="font-mono text-xs text-slate-500 font-medium shrink-0">
                              {wine.vintage}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                          <span className={`px-2 py-0.5 rounded border text-[10px] font-medium ${getColorBadge(wine.color)}`}>
                            {wine.color}
                          </span>
                          <span className="text-slate-500 font-mono">
                            {wine.format}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className={`font-mono font-medium ${
                            wine.stock <= 3 
                              ? 'text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200' 
                              : 'text-slate-600'
                          }`}>
                            Stock : {wine.stock}
                          </span>
                        </div>
                      </div>

                      {/* Prix et Action */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <div className="font-mono text-base font-bold text-bordeaux-950">
                            {formatCurrency(priceTTC)} <span className="text-[10px] font-sans font-normal text-slate-400">TTC</span>
                          </div>
                          <div className="font-mono text-xs text-slate-400">
                            {formatCurrency(priceHT)} HT
                          </div>
                        </div>

                        {/* Bouton Ajout */}
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                          inCartItem
                            ? 'bg-bordeaux-800 text-white shadow-sm'
                            : 'bg-ivory-100 text-slate-700 group-hover:bg-bordeaux-800 group-hover:text-white border border-lin-300'
                        }`}>
                          {inCartItem ? (
                            <span className="font-mono text-xs font-bold">+{inCartItem.quantity}</span>
                          ) : (
                            <Plus size={16} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* COLONNE DROITE (5/12) : TICKET DE CAISSE EN DIRECT */}
        <section className="lg:col-span-5 flex flex-col bg-white rounded-xl border border-lin-300 shadow-sm overflow-hidden">
          
          {/* EN-TÊTE DU TICKET */}
          <div className="p-4 border-b border-lin-200 bg-ivory-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-bordeaux-800" />
              <h2 className="font-serif text-lg font-bold text-slate-900">
                Ticket de Vente
              </h2>
            </div>

            {/* Menu Ajout prestation libre */}
            <div className="relative" ref={addItemMenuRef}>
              <button
                onClick={() => setShowAddItemMenu(!showAddItemMenu)}
                className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-lin-100 text-slate-700 border border-lin-300 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Plus size={13} /> Ligne Libre
              </button>

              {showAddItemMenu && (
                <div className="absolute right-0 top-full mt-1.5 bg-white border border-lin-300 rounded-lg shadow-xl w-56 z-30 py-1 text-xs">
                  <button 
                    onClick={() => handleAddSpecialItem('Prestation de Service', 20)}
                    className="w-full text-left px-3.5 py-2 hover:bg-ivory-100 flex items-center gap-2 text-slate-700"
                  >
                    <Briefcase size={14} className="text-bordeaux-800" /> Prestation Sommelier (20%)
                  </button>
                  <button 
                    onClick={() => handleAddSpecialItem('Alimentaire / Épicerie', 10)}
                    className="w-full text-left px-3.5 py-2 hover:bg-ivory-100 flex items-center gap-2 text-slate-700"
                  >
                    <Utensils size={14} className="text-amber-800" /> Épicerie fine (10%)
                  </button>
                  <button 
                    onClick={() => handleAddSpecialItem('Boisson Sans Alcool', 5.5)}
                    className="w-full text-left px-3.5 py-2 hover:bg-ivory-100 flex items-center gap-2 text-slate-700"
                  >
                    <Coffee size={14} className="text-slate-600" /> Boisson soft (5.5%)
                  </button>
                  <button 
                    onClick={() => handleAddSpecialItem('Autre prestation', 20)}
                    className="w-full text-left px-3.5 py-2 hover:bg-ivory-100 flex items-center gap-2 text-slate-700 border-t border-lin-200"
                  >
                    <MousePointer2 size={14} className="text-slate-400" /> Autre / Saisie libre
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* SÉLECTEUR CLIENT & TYPE DE DOCUMENT */}
          <div className="p-4 border-b border-lin-200 space-y-3 bg-white">
            
            {/* Sélection du Client */}
            <div className="relative" ref={suggestionsRef}>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1">
                <span>Client de la cave</span>
                {selectedClient && (
                  <button 
                    onClick={() => onEditClient(selectedClient.id)}
                    className="text-bordeaux-700 hover:underline flex items-center gap-1"
                  >
                    <FileText size={12} /> Fiche client
                  </button>
                )}
              </div>

              <div className="relative">
                <input 
                  type="text"
                  placeholder="Nom du client (ex: Comptoir, Dupont...)"
                  className="w-full px-3.5 py-2 bg-ivory-50 border border-lin-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-bordeaux-700 focus:ring-1 focus:ring-bordeaux-700 transition-all"
                  value={clientName}
                  onChange={e => {
                    setClientName(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
                
                {clientName && !selectedClient && (
                  <button
                    onClick={() => onEditClient(null)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-bordeaux-800 hover:text-bordeaux-950 p-1"
                    title="Nouveau client"
                  >
                    <UserPlus size={16} />
                  </button>
                )}
              </div>

              {/* Suggestions dropdown */}
              {showSuggestions && clientSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-lin-300 rounded-lg shadow-lg z-20 py-1 text-sm divide-y divide-lin-100">
                  {clientSuggestions.map(c => (
                    <div 
                      key={c.id}
                      onClick={() => {
                        setClientName(c.name);
                        setShowSuggestions(false);
                      }}
                      className="px-3.5 py-2 hover:bg-ivory-100 cursor-pointer flex justify-between items-center"
                    >
                      <span className="font-medium text-slate-800">{c.name}</span>
                      {c.phone && <span className="text-xs text-slate-400 font-mono">{c.phone}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bascule Facture vs Devis */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setDocType('Invoice')}
                className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  docType === 'Invoice'
                    ? 'bg-bordeaux-800 border-bordeaux-900 text-white shadow-sm'
                    : 'bg-ivory-50 border-lin-300 text-slate-600 hover:bg-white'
                }`}
              >
                Facture Immédiate
              </button>
              <button
                onClick={() => setDocType('ProForma')}
                className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  docType === 'ProForma'
                    ? 'bg-amber-700 border-amber-800 text-white shadow-sm'
                    : 'bg-ivory-50 border-lin-300 text-slate-600 hover:bg-white'
                }`}
              >
                Devis / Pro-Forma
              </button>
            </div>
          </div>

          {/* LIGNES DU TICKET */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-lin-100">
            {cartItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                <Receipt className="w-8 h-8 stroke-1 text-lin-400 mb-2" />
                <p className="font-serif text-base font-medium text-slate-600">Le ticket est vide</p>
                <p className="text-xs text-slate-400 mt-0.5">Cliquez sur un vin à gauche pour commencer la saisie.</p>
              </div>
            ) : (
              cartItems.map(item => (
                <div 
                  key={`${item.id}-${item.fromExternalStock}`}
                  className="pt-3 first:pt-0 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {item.isService ? (
                        <input 
                          type="text" 
                          value={item.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCartItems(prev => prev.map(i => i.id === item.id ? { ...i, name: val } : i));
                          }}
                          className="font-medium text-sm text-slate-900 bg-transparent border-b border-dashed border-slate-300 focus:border-bordeaux-700 outline-none w-full"
                        />
                      ) : (
                        <div className="text-sm font-semibold text-slate-900 leading-tight">
                          {item.name} <span className="font-mono text-xs text-slate-400 font-normal">({item.vintage || 'NV'})</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-1 text-xs">
                        {item.isGift && (
                          <span className="px-1.5 py-0.2 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-semibold uppercase">
                            Offert
                          </span>
                        )}
                        {item.fromExternalStock && (
                          <span className="text-[10px] text-amber-700 font-semibold">
                            Stock déporté
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Total de la ligne */}
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-bold text-slate-900">
                        {item.isGift ? '0,00 €' : formatCurrency(item.sellingPriceHT * item.quantity * (1 + (item.vatRate || 20) / 100))}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">
                        {formatCurrency(item.sellingPriceHT * item.quantity)} HT
                      </div>
                    </div>
                  </div>

                  {/* Contrôles de Quantité & Prix unitaire */}
                  <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                    
                    {/* Stepper Quantité */}
                    <div className="flex items-center border border-lin-300 rounded-lg bg-ivory-50 overflow-hidden shadow-sm">
                      <button
                        onClick={() => updateQuantity(item.id, -1, item.fromExternalStock)}
                        className="px-2.5 py-1 text-slate-600 hover:bg-lin-200 transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <input 
                        type="number"
                        className="w-10 text-center font-mono font-semibold bg-transparent text-slate-900 outline-none"
                        value={item.quantity}
                        onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 1, item.fromExternalStock)}
                      />
                      <button
                        onClick={() => updateQuantity(item.id, 1, item.fromExternalStock)}
                        className="px-2.5 py-1 text-slate-600 hover:bg-lin-200 transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    {/* Prix unitaire HT */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">P.U. HT :</span>
                      <div className="flex items-center border border-lin-300 rounded px-2 py-0.5 bg-white">
                        <input 
                          type="number"
                          step="0.01"
                          disabled={item.isGift}
                          className="w-16 font-mono text-xs text-right outline-none text-slate-800"
                          value={item.sellingPriceHT}
                          onChange={(e) => updatePrice(item.id, e.target.value, item.fromExternalStock)}
                        />
                        <span className="text-slate-400 ml-1">€</span>
                      </div>
                    </div>

                    {/* Boutons actions rapides */}
                    <div className="flex items-center gap-1">
                      {!item.isService && (
                        <button
                          onClick={() => toggleGift(item.id, item.fromExternalStock)}
                          className={`p-1.5 rounded border transition-colors ${
                            item.isGift 
                              ? 'bg-rose-50 text-rose-700 border-rose-300' 
                              : 'text-slate-400 border-lin-300 hover:text-slate-700'
                          }`}
                          title="Offrir cette bouteille (geste commercial)"
                        >
                          <Gift size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => removeFromCart(item.id, item.fromExternalStock)}
                        className="p-1.5 rounded border border-lin-300 text-slate-400 hover:text-rose-700 hover:border-rose-200 transition-colors"
                        title="Supprimer du ticket"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* RÉCAPITULATIF FINANCIER DU TICKET */}
          <div className="p-4 border-t border-lin-200 bg-ivory-50 space-y-2.5">
            
            {/* Toggle Sortie Perso / Conso */}
            <div 
              onClick={togglePersonalConsumption}
              className={`p-2 rounded-lg border cursor-pointer flex items-center justify-between text-xs font-medium transition-all ${
                isPersonalConsumption 
                  ? 'bg-champagne-100 border-champagne-400 text-champagne-600' 
                  : 'bg-white border-lin-300 text-slate-600 hover:bg-ivory-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Home size={14} className={isPersonalConsumption ? 'text-champagne-500' : 'text-slate-400'} />
                <span>Sortie Perso / Dégustation (Prix Coûtant HT)</span>
              </div>
              <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${
                isPersonalConsumption ? 'bg-champagne-500 border-champagne-500 text-white' : 'border-slate-300'
              }`}>
                {isPersonalConsumption && <Check size={10} />}
              </div>
            </div>

            {/* Frais de port */}
            <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
              <span className="flex items-center gap-1.5">
                <Truck size={13} className="text-slate-400" /> Frais de port HT
              </span>
              <div className="flex items-center border border-lin-300 rounded px-2 py-0.5 bg-white">
                <input 
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  className="w-16 font-mono text-right text-xs outline-none text-slate-800"
                  value={shippingCost}
                  onChange={e => setShippingCost(e.target.value)}
                />
                <span className="text-slate-400 ml-1">€</span>
              </div>
            </div>

            <div className="flex justify-between text-xs text-slate-500">
              <span>Total HT</span>
              <span className="font-mono">{formatCurrency(totals.totalHT)}</span>
            </div>

            <div className="flex justify-between text-xs text-slate-500">
              <span>TVA (20%)</span>
              <span className="font-mono">{formatCurrency(totals.totalTVA)}</span>
            </div>

            {/* TOTAL TTC GÉANT */}
            <div className="pt-2 border-t border-lin-300 flex items-baseline justify-between">
              <span className="font-serif text-base font-bold text-slate-900">
                Total TTC
              </span>
              <span className="font-serif text-2xl font-bold text-bordeaux-950 font-mono-numbers">
                {formatCurrency(totals.totalTTC)}
              </span>
            </div>

            {/* BOUTON D'ENCAISSEMENT PRINCIPAL */}
            <button
              onClick={handleSubmit}
              disabled={cartItems.length === 0}
              className="w-full mt-3 py-3 px-4 bg-bordeaux-800 hover:bg-bordeaux-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-md shadow-bordeaux-950/20 flex items-center justify-center gap-2 transition-all text-sm"
            >
              <span>{docType === 'Invoice' ? 'Valider & Encaisser la Vente' : 'Éditer le Devis Pro-Forma'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Cart;