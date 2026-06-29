
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, FileText, Gift, UserPlus, Home, X, Truck, Briefcase, Utensils, Coffee, MousePointer2 } from 'lucide-react';
import { Wine, Domain, CartItem, Client, WineColor } from '../types';
import { formatCurrency, getSellingPrice, getColorBadgeClass, calculateInvoiceTotals } from '../utils'; // Import updated utils

const Cart = ({ 
  wines, 
  domains, 
  clients,
  initialSelection,
  onClearInitialSelection,
  onCreateInvoice,
  onEditDomain,
  onEditWine,
  onEditClient
}: { 
  wines: Wine[], 
  domains: Domain[], 
  clients: Client[],
  initialSelection?: string[],
  onClearInitialSelection?: () => void,
  onCreateInvoice: (clientName: string, items: CartItem[], type: 'ProForma' | 'Invoice', shippingCost?: number) => void,
  onEditDomain: (id: string) => void,
  onEditWine: (id: string) => void,
  onEditClient: (id: string | null) => void
}) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [clientName, setClientName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [docType, setDocType] = useState<'ProForma' | 'Invoice'>('ProForma');
  const [isPersonalConsumption, setIsPersonalConsumption] = useState(false);
  const [shippingCost, setShippingCost] = useState('');
  
  // New: Menu for special items
  const [showAddItemMenu, setShowAddItemMenu] = useState(false);
  const addItemMenuRef = useRef<HTMLDivElement>(null);

  const [regionFilter, setRegionFilter] = useState('all');
  const [subRegionFilter, setSubRegionFilter] = useState('all');
  const [domainFilter, setDomainFilter] = useState('all');
  const [itemSearch, setItemSearch] = useState('');

  const suggestionsRef = useRef<HTMLDivElement>(null);

  // --- EFFECT: Load Initial Selection from Inventory ---
  useEffect(() => {
    if (initialSelection && initialSelection.length > 0) {
        setCartItems(prev => {
            const newItems: CartItem[] = [];
            initialSelection.forEach(id => {
                // Avoid duplicates if already in cart
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
                        vatRate: 20 // Default wine VAT
                    });
                }
            });
            return [...prev, ...newItems];
        });
        
        // Clear the global selection so it doesn't re-trigger on next mount
        if (onClearInitialSelection) onClearInitialSelection();
    }
  }, [initialSelection, wines, domains, isPersonalConsumption, onClearInitialSelection]);


  // Close suggestions when clicking outside
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
     if (!clientName) return [];
     return clients.filter(c => c.name.toLowerCase().includes(clientName.toLowerCase())).slice(0, 5);
  }, [clientName, clients]);

  const togglePersonalConsumption = () => {
    const newValue = !isPersonalConsumption;
    setIsPersonalConsumption(newValue);
    
    setCartItems(prev => prev.map(item => {
        if (item.isGift || item.isService) return item;
        
        const wine = wines.find(w => w.id === item.id);
        const domain = domains.find(d => d.id === item.domainId);
        
        if (!wine) return item;

        if (newValue) {
            return { ...item, sellingPriceHT: wine.buyingPriceHT };
        } else {
            return { ...item, sellingPriceHT: getSellingPrice(wine, domain) };
        }
    }));
  };

  const addToCart = (wine: Wine) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.id === wine.id && !i.fromExternalStock);
      if (existing) {
        return prev.map(i => i.id === wine.id && !i.fromExternalStock ? { ...i, quantity: i.quantity + 1 } : i);
      }
      
      const domain = domains.find(d => d.id === wine.domainId);
      const price = isPersonalConsumption ? wine.buyingPriceHT : getSellingPrice(wine, domain);
      
      return [...prev, { 
          ...wine, 
          quantity: 1, 
          sellingPriceHT: price, 
          isGift: false, 
          fromExternalStock: false,
          vatRate: 20 // Default Wine VAT
      }];
    });
  };

  const handleAddSpecialItem = (label: string, defaultVat: number, prefix: string = 'Autre') => {
      const newItem: CartItem = {
          id: `cust_${Date.now()}`,
          domainId: '',
          name: label === 'Autre' ? 'Saisie Libre (Modifier titre)' : label,
          vintage: '',
          color: WineColor.Sparkling, // Dummy
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

  const updateServiceName = (id: string, name: string) => {
      setCartItems(prev => prev.map(i => i.id === id ? { ...i, name } : i));
  };

  const removeFromCart = (id: string, fromExternal: boolean = false) => {
    setCartItems(prev => prev.filter(i => !(i.id === id && (i.fromExternalStock || false) === fromExternal)));
  };

  const updateQuantity = (id: string, delta: number, fromExternal: boolean = false) => {
    setCartItems(prev => prev.map(i => {
      if (i.id === id && (i.fromExternalStock || false) === fromExternal) {
        const newQ = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQ };
      }
      return i;
    }));
  };

  const setQuantity = (id: string, newQ: number, fromExternal: boolean = false) => {
    setCartItems(prev => prev.map(i => {
      if (i.id === id && (i.fromExternalStock || false) === fromExternal) {
        return { ...i, quantity: Math.max(1, newQ) };
      }
      return i;
    }));
  };

  const updatePrice = (id: string, newPrice: string, fromExternal: boolean = false) => {
    const parsedPrice = parseFloat(newPrice);
    if (isNaN(parsedPrice)) return;
    
    setCartItems(prev => prev.map(i => {
      if (i.id === id && (i.fromExternalStock || false) === fromExternal) {
        return { ...i, sellingPriceHT: parsedPrice, isGift: false };
      }
      return i;
    }));
  };

  const updateVatRate = (id: string, newRate: string) => {
      const rate = parseFloat(newRate);
      setCartItems(prev => prev.map(i => i.id === id ? { ...i, vatRate: rate } : i));
  };

  const toggleGift = (id: string, fromExternal: boolean = false) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === id && (item.fromExternalStock || false) === fromExternal) {
        if (item.isGift) {
          const originalWine = wines.find(w => w.id === item.id);
          if (originalWine) {
             const domain = domains.find(d => d.id === originalWine.domainId);
             const price = isPersonalConsumption ? originalWine.buyingPriceHT : getSellingPrice(originalWine, domain);
             return { ...item, isGift: false, sellingPriceHT: price };
          }
          // For service items, restore previous price is tricky so it stays 0 unless edited manually
          return { ...item, isGift: false };
        } else {
          return { ...item, isGift: true, sellingPriceHT: 0 };
        }
      }
      return item;
    }));
  };

  const allRegions = useMemo(() => [...new Set(domains.map(d => d.region))].sort(), [domains]);
  
  const availableSubRegions = useMemo(() => {
    let relevantDomainIds = new Set(domains.map(d => d.id));
    if (regionFilter !== 'all') {
      relevantDomainIds = new Set(domains.filter(d => d.region === regionFilter).map(d => d.id));
    }
    
    const subs = new Set<string>();
    wines.forEach(w => {
        if (!w.isArchived && w.stock > 0 && relevantDomainIds.has(w.domainId) && w.subRegion) {
            subs.add(w.subRegion);
        }
    });
    
    return [...subs].sort();
  }, [domains, wines, regionFilter]);

  const availableDomains = useMemo(() => {
    let relevantDomains = domains;
    if (regionFilter !== 'all') relevantDomains = relevantDomains.filter(d => d.region === regionFilter);
    
    if (subRegionFilter !== 'all') {
        const domainIdsWithSubRegion = new Set(wines
            .filter(w => w.subRegion === subRegionFilter && !w.isArchived && w.stock > 0)
            .map(w => w.domainId));
        relevantDomains = relevantDomains.filter(d => domainIdsWithSubRegion.has(d.id));
    }
    
    return relevantDomains.sort((a, b) => a.name.localeCompare(b.name));
  }, [domains, wines, regionFilter, subRegionFilter]);

  const filteredWines = wines.filter(w => {
    if (w.isArchived || w.stock <= 0) return false;
    const domain = domains.find(d => d.id === w.domainId);
    if (!domain) return false;

    const matchesSearch = itemSearch === '' || 
      w.name.toLowerCase().includes(itemSearch.toLowerCase()) || 
      domain.name.toLowerCase().includes(itemSearch.toLowerCase());
    
    const matchesRegion = regionFilter === 'all' || domain.region === regionFilter;
    const matchesSubRegion = subRegionFilter === 'all' || w.subRegion === subRegionFilter;
    const matchesDomain = domainFilter === 'all' || w.domainId === domainFilter;

    return matchesSearch && matchesRegion && matchesSubRegion && matchesDomain;
  });

  const shipping = parseFloat(shippingCost) || 0;
  // --- USE CENTRAL CALCULATION ---
  const totals = calculateInvoiceTotals(cartItems, shipping);
  // -------------------------------

  const handleSubmit = () => {
    if (!clientName) return alert('Nom du client requis');
    if (cartItems.length === 0) return alert('Panier vide');
    onCreateInvoice(clientName, cartItems, docType, shipping);
    setCartItems([]);
    setClientName('');
    setShippingCost('');
    setIsPersonalConsumption(false); 
  };

  const selectedClient = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:h-[calc(100vh-100px)]">
       <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden h-[60vh] lg:h-full">
          <div className="p-4 border-b border-gray-100 space-y-3 bg-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Recherche rapide (vin, domaine)..." 
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500"
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
              />
              {itemSearch && (
                 <button onClick={() => setItemSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                 </button>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none bg-white"
                value={regionFilter}
                onChange={(e) => {
                  setRegionFilter(e.target.value);
                  setSubRegionFilter('all');
                  setDomainFilter('all');
                }}
              >
                <option value="all">Toutes régions</option>
                {allRegions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <select
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none bg-white disabled:bg-gray-100"
                value={subRegionFilter}
                onChange={(e) => {
                  setSubRegionFilter(e.target.value);
                  setDomainFilter('all');
                }}
                disabled={availableSubRegions.length === 0}
              >
                <option value="all">Toutes sous-régions</option>
                {availableSubRegions.map(r => (
                  <option key={r} value={r as string}>{r}</option>
                ))}
              </select>

              <select
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none bg-white"
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
              >
                <option value="all">Tous les domaines</option>
                {availableDomains.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
             <div className="space-y-2">
             {filteredWines.length === 0 ? (
                <div className="text-center py-10 text-gray-400 italic">Aucun vin trouvé avec ces critères.</div>
             ) : (
                filteredWines.map(wine => {
                  const domain = domains.find(d => d.id === wine.domainId);
                  const priceToDisplay = isPersonalConsumption ? wine.buyingPriceHT : getSellingPrice(wine, domain);
                  
                  return (
                    <div 
                      key={wine.id}
                      onClick={() => addToCart(wine)}
                      className="w-full text-left p-3 hover:bg-gray-50 rounded-lg border border-gray-100 flex justify-between items-center group transition-all cursor-pointer"
                    >
                      <div>
                        {/* CLICKABLE DOMAIN */}
                        <div 
                          className="font-semibold text-gray-800 hover:text-blue-600 hover:underline cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); onEditDomain(wine.domainId); }}
                        >
                          {domain?.name}
                        </div>
                        
                        <div 
                           className="text-sm text-gray-600 hover:text-blue-600 hover:underline cursor-pointer"
                           onClick={(e) => { e.stopPropagation(); onEditWine(wine.id); }}
                        >
                           {wine.name} <span className="text-gray-400">| {wine.vintage}</span>
                           {wine.format && wine.format !== 'Bouteille (75cl)' && (
                              <span className="ml-2 inline-block px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] rounded border border-indigo-100 font-bold uppercase">{wine.format}</span>
                           )}
                        </div>
                        <div className="mt-1 flex gap-2">
                           <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getColorBadgeClass(wine.color)}`}>{wine.color}</span>
                           <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">Stock: {wine.stock}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`font-bold ${isPersonalConsumption ? 'text-indigo-600' : 'text-emerald-700'}`}>
                           {formatCurrency(priceToDisplay)} HT
                        </span>
                        <div className="bg-red-50 text-red-700 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus size={16} />
                        </div>
                      </div>
                    </div>
                  )
                })
             )}
             </div>
          </div>
       </div>

       <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-[60vh] lg:h-full">
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
               <FileText className="text-red-800" /> Panier
             </h2>
             <div className="relative" ref={addItemMenuRef}>
                 <button 
                    onClick={() => setShowAddItemMenu(!showAddItemMenu)} 
                    className="text-xs flex items-center gap-1 bg-indigo-100 text-indigo-800 px-3 py-1.5 rounded hover:bg-indigo-200 border border-indigo-200 font-bold transition-colors"
                 >
                    <Plus size={14} /> Ajouter Élément
                 </button>
                 {showAddItemMenu && (
                     <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 shadow-xl rounded-lg w-48 z-30 py-1">
                        <button onClick={() => handleAddSpecialItem('Prestation de Service', 20)} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2">
                           <Briefcase size={14} className="text-gray-500" /> Prestation (20%)
                        </button>
                        <button onClick={() => handleAddSpecialItem('Alimentaire', 10)} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2">
                           <Utensils size={14} className="text-gray-500" /> Alimentaire (10%)
                        </button>
                        <button onClick={() => handleAddSpecialItem('Boisson Soft', 5.5)} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2">
                           <Coffee size={14} className="text-gray-500" /> Soft (5.5%)
                        </button>
                        <button onClick={() => handleAddSpecialItem('Autre', 20)} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2 border-t border-gray-100">
                           <MousePointer2 size={14} className="text-gray-500" /> Autre / Libre
                        </button>
                     </div>
                 )}
             </div>
          </div>
          
          <div className="mb-6 relative" ref={suggestionsRef}>
             <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
             <div className="relative">
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500 pr-10"
                  placeholder="Nom du client"
                  value={clientName}
                  onChange={e => { setClientName(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                />
                {selectedClient ? (
                   <button 
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800"
                      onClick={() => onEditClient(selectedClient.id)}
                      title="Voir/Modifier la fiche client"
                   >
                      <FileText size={16} />
                   </button>
                ) : (
                   clientName && !clients.find(c => c.name.toLowerCase() === clientName.toLowerCase()) && (
                     <button 
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600 hover:text-green-800" 
                        title="Créer nouveau client"
                        onClick={() => onEditClient(null)} 
                     >
                       <UserPlus size={16} />
                     </button>
                   )
                )}
             </div>
             {showSuggestions && clientSuggestions.length > 0 && (
                <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-b-lg shadow-lg mt-1">
                  {clientSuggestions.map(c => (
                    <div 
                      key={c.id} 
                      className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                      onClick={() => { setClientName(c.name); setShowSuggestions(false); }}
                    >
                      {c.name}
                    </div>
                  ))}
                </div>
             )}
          </div>

          <div className="flex-1 overflow-y-auto mb-6 space-y-3 pr-2">
             {cartItems.length === 0 ? (
               <div className="text-center py-10 text-gray-400 italic border-2 border-dashed border-gray-100 rounded-lg">
                 Le panier est vide.<br/>Sélectionnez des vins à gauche.
               </div>
             ) : (
               cartItems.map(item => (
                 <div key={`${item.id}-${item.fromExternalStock}`} className={`flex flex-col text-sm p-3 rounded-lg border ${item.isGift ? 'bg-pink-50 border-pink-100' : item.isService ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-transparent'}`}>
                    <div className="flex justify-between items-start w-full mb-2">
                        {item.isService ? (
                            <div className="flex-1 mr-2">
                                <label className="text-[10px] uppercase font-bold text-indigo-500 mb-1 flex items-center justify-between">
                                   <span>Description</span>
                                   <select 
                                      className="bg-transparent text-right outline-none text-[10px] font-bold text-indigo-600 cursor-pointer border-b border-indigo-200"
                                      value={item.vatRate}
                                      onChange={(e) => updateVatRate(item.id, e.target.value)}
                                   >
                                      <option value="20">TVA 20%</option>
                                      <option value="10">TVA 10%</option>
                                      <option value="5.5">TVA 5.5%</option>
                                      <option value="0">TVA 0%</option>
                                   </select>
                                </label>
                                <input 
                                    type="text" 
                                    className="font-bold text-gray-900 w-full bg-white border border-indigo-200 rounded px-2 py-1 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    value={item.name}
                                    onChange={(e) => updateServiceName(item.id, e.target.value)}
                                    placeholder="Libellé personnalisé..."
                                />
                            </div>
                        ) : (
                            <div className="flex-1 mr-2">
                                <div 
                                className="font-medium text-gray-900 line-clamp-2 hover:text-blue-600 hover:underline cursor-pointer"
                                onClick={() => onEditWine(item.id)}
                                >
                                {item.name} 
                                {item.format && item.format !== 'Bouteille (75cl)' && <span className="ml-1 text-[10px] bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded border border-indigo-100">{item.format}</span>}
                                {item.isGift && <span className="ml-2 text-[10px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide font-bold">Cadeau</span>}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">{item.vintage}</div>
                            </div>
                        )}
                        
                        <div className="flex flex-col items-end gap-1">
                            <span className="font-bold text-gray-900 text-lg">{item.isGift ? 'Offert' : formatCurrency(item.sellingPriceHT * item.quantity)}</span>
                        </div>
                    </div>

                    <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-2">
                            <div className={`flex items-center border rounded bg-white overflow-hidden ${item.isService ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-gray-300'}`}>
                                <span className="pl-2 text-gray-400 text-xs">€</span>
                                <input 
                                    type="number"
                                    step="0.01"
                                    className={`w-20 px-2 py-1 text-sm font-bold outline-none text-right ${item.isGift ? 'text-pink-500 line-through bg-pink-50' : isPersonalConsumption && !item.isService ? 'text-indigo-600' : 'text-gray-900'}`}
                                    value={item.sellingPriceHT}
                                    onChange={(e) => updatePrice(item.id, e.target.value, item.fromExternalStock)}
                                    disabled={item.isGift}
                                    placeholder="Prix HT"
                                />
                            </div>
                            <span className="text-xs text-gray-500">x</span>
                            <div className="flex items-center gap-1 bg-white rounded border border-gray-200 shadow-sm">
                                <button onClick={() => updateQuantity(item.id, -1, item.fromExternalStock)} className="px-2 py-1 hover:bg-gray-100 rounded-l border-r font-bold text-gray-600">-</button>
                                <input 
                                    type="number"
                                    className="w-12 text-center font-medium text-gray-900 outline-none"
                                    value={item.quantity}
                                    onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 1, item.fromExternalStock)}
                                />
                                <button onClick={() => updateQuantity(item.id, 1, item.fromExternalStock)} className="px-2 py-1 hover:bg-gray-100 rounded-r border-l font-bold text-gray-600">+</button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {!item.isService && (
                                <button 
                                    onClick={() => toggleGift(item.id, item.fromExternalStock)} 
                                    className={`p-1.5 border rounded hover:bg-pink-50 transition-colors ${item.isGift ? 'text-pink-600 border-pink-200 bg-pink-50' : 'text-gray-400 border-gray-200'}`} 
                                    title="Offrir (Cadeau)"
                                >
                                <Gift size={14} />
                                </button>
                            )}
                            <button 
                                onClick={() => removeFromCart(item.id, item.fromExternalStock)} 
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded border border-gray-200 hover:border-red-200 transition-colors"
                                title="Supprimer la ligne"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                    {item.fromExternalStock && (
                        <div className="text-[10px] text-orange-600 font-bold mt-1">Depuis stock déporté</div>
                    )}
                 </div>
               ))
             )}
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-2 mb-6 bg-gray-50 p-4 rounded-lg">
             <button 
                onClick={togglePersonalConsumption}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-4 border ${isPersonalConsumption ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}
             >
                <span className="flex items-center gap-2"><Home size={16} /> Conso Personnelle (Prix Coûtant)</span>
                <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${isPersonalConsumption ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${isPersonalConsumption ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
             </button>

             <div className="flex justify-between text-gray-600 text-sm">
               <span>Total HT</span>
               <span>{formatCurrency(totals.totalHT)}</span>
             </div>
             
             {/* SHIPPING INPUT */}
             <div className="flex justify-between items-center text-gray-600 text-sm">
               <div className="flex items-center gap-1">
                  <Truck size={14} /> <span>Frais de Port HT</span>
               </div>
               <div className="flex items-center w-24 border border-gray-300 rounded bg-white overflow-hidden">
                  <input 
                     type="number" 
                     step="0.01" 
                     className="w-full px-2 py-0.5 text-right outline-none text-sm"
                     placeholder="0"
                     value={shippingCost}
                     onChange={e => setShippingCost(e.target.value)}
                  />
                  <span className="pr-1 text-xs text-gray-400">€</span>
               </div>
             </div>

             <div className="flex justify-between text-gray-600 text-sm">
               <span>TVA</span>
               <span>{formatCurrency(totals.totalTVA)}</span>
             </div>
             <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
               <span>Total TTC</span>
               <span>{formatCurrency(totals.totalTTC)}</span>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <button 
               onClick={() => setDocType('ProForma')} 
               className={`py-2 rounded-lg border text-sm font-medium transition-all ${docType === 'ProForma' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
             >
               Pro Forma
             </button>
             <button 
               onClick={() => setDocType('Invoice')} 
               className={`py-2 rounded-lg border text-sm font-medium transition-all ${docType === 'Invoice' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
             >
               Facture
             </button>
          </div>

          <button 
            onClick={handleSubmit} 
            className="w-full mt-6 bg-red-800 text-white py-3 rounded-lg font-semibold hover:bg-red-900 transition-colors shadow-lg shadow-red-100 flex items-center justify-center gap-2"
          >
            Créer {docType === 'ProForma' ? 'le Devis' : 'la Facture'}
          </button>
       </div>
    </div>
  );
};

export default Cart;