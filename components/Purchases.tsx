
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, ArrowRight, PackageCheck, AlertCircle, History, X, CheckCircle, Clock, Sparkles, Copy, ExternalLink, AlertTriangle, FileDown, Database } from 'lucide-react';
import { Wine, Domain, PurchaseItem, StockMovement, Invoice } from '../types';
import { formatCurrency, getColorBadgeClass, getBottleEquivalent } from '../utils';
import PaymentModal from './PaymentModal';

const Purchases = ({ 
  wines, 
  domains, 
  stockMovements,
  invoices,
  initialSelection, // New Prop
  onClearInitialSelection, // New Prop
  onConfirmPurchase,
  onCancelPurchase,
  onDeleteInvoice,
  onUpdatePurchaseItem,
  onUpdateShippingCost,
  onEditDomain,
  onEditWine,
  onUpdatePayment 
}: { 
  wines: Wine[], 
  domains: Domain[], 
  stockMovements: StockMovement[],
  invoices: Invoice[],
  initialSelection?: string[],
  onClearInitialSelection?: () => void,
  onConfirmPurchase: (provider: string, reference: string, items: PurchaseItem[], date?: string, shippingCostHT?: number, impactStock?: boolean) => Promise<boolean>,
  onCancelPurchase: (movements: StockMovement[]) => Promise<boolean>,
  onDeleteInvoice?: (id: string) => Promise<boolean>,
  onUpdatePurchaseItem?: (movements: { id: string, wineId?: string, newPrice?: number, newQuantity?: number, newVatRate?: number, newProvider?: string, newReference?: string }[], context?: { provider: string, reference: string, invoiceId?: string }) => Promise<boolean>,
  onUpdateShippingCost?: (provider: string, reference: string, date: string, newShippingCostHT: number) => Promise<boolean>,
  onEditDomain: (id: string) => void,
  onEditWine: (id: string | null, initialData?: Partial<Wine>) => void,
  onUpdatePayment?: (provider: string, reference: string, paymentData: { date: string, method: string }, invoiceId?: string) => Promise<boolean>
}) => {
  console.log("Purchases component rendered");
  const [activeTab, setActiveTab] = useState<'new' | 'journal'>('new');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [provider, setProvider] = useState('');
  const [reference, setReference] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [shippingCostHT, setShippingCostHT] = useState<number>(0);
  const [impactStock, setImpactStock] = useState<boolean>(true);
  const [showZeroWarning, setShowZeroWarning] = useState(false);
  const [cancelWarningEntry, setCancelWarningEntry] = useState<any>(null);
  
  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<{provider: string, reference: string, invoiceId?: string} | null>(null);

  // Edit Total Amount State
  const [editingTotal, setEditingTotal] = useState<{ id: string, amount: number | string } | null>(null);
  const [editingShippingCost, setEditingShippingCost] = useState<{ id: string, amount: number | string } | null>(null);
  const [editingHeader, setEditingHeader] = useState<{ id: string, date: string, provider: string, reference: string } | null>(null);
  const [editingItemPrice, setEditingItemPrice] = useState<{ id: string, price: number | string } | null>(null);
  const [editingItemQuantity, setEditingItemQuantity] = useState<{ id: string, quantity: number | string } | null>(null);
  const [editingItemVat, setEditingItemVat] = useState<{ id: string, vatRate: number | string } | null>(null);

  // Filters states similar to Cart
  const [regionFilter, setRegionFilter] = useState('all');
  const [subRegionFilter, setSubRegionFilter] = useState('all');
  const [domainFilter, setDomainFilter] = useState('all');
  const [itemSearch, setItemSearch] = useState('');

  // --- AUTO-ADD NEW WINE LOGIC ---
  const prevWineIdsRef = useRef<Set<string>>(new Set(wines.map(w => w.id)));
  const isCreatingRef = useRef(false);

  // Detect new wines added globally while in this view
  useEffect(() => {
    const currentWineIds = new Set(wines.map(w => w.id));
    
    // If we have more wines now than before, and we marked that we were creating one
    if (currentWineIds.size > prevWineIdsRef.current.size && isCreatingRef.current) {
        // Find the new wine
        const newWine = wines.find(w => !prevWineIdsRef.current.has(w.id));
        if (newWine) {
            // Auto add to cart
            setPurchaseItems(prev => {
                // Avoid duplicates just in case
                if (prev.find(i => i.id === newWine.id)) return prev;
                return [...prev, { ...newWine, quantity: 0, purchasePriceHT: newWine.buyingPriceHT }];
            });
            // Reset flag
            isCreatingRef.current = false;
        }
    }
    
    // Update ref for next render
    prevWineIdsRef.current = currentWineIds;
  }, [wines]);

  // --- EFFECT: Load Initial Selection ---
  useEffect(() => {
    if (initialSelection && initialSelection.length > 0) {
        setPurchaseItems(prev => {
            const newItems: PurchaseItem[] = [];
            initialSelection.forEach(id => {
                // Avoid duplicates
                if (prev.find(i => i.id === id)) return;
                
                const wine = wines.find(w => w.id === id);
                if (wine) {
                    newItems.push({
                        ...wine,
                        quantity: 0, // Default case of 0 for professional purchase
                        purchasePriceHT: wine.buyingPriceHT
                    });
                }
            });
            return [...prev, ...newItems];
        });
        // Switch to "new" tab
        setActiveTab('new');
        // Clear global selection
        if (onClearInitialSelection) onClearInitialSelection();
    }
  }, [initialSelection, wines, onClearInitialSelection]);


  // --- LOGIC JOURNAL ---
  const normalize = (s: string | null | undefined) => (s || "").trim().toLowerCase();

  const purchaseJournal = useMemo(() => {
    const groups: Record<string, { 
      id: string, 
      date: string, 
      timestamp: number,
      provider: string, 
      reference: string, 
      originalProvider: string,
      originalReference: string,
      items: { id: string, wineId: string, wineName: string, quantity: number, price: number }[], 
      totalHT: number,
      totalShippingCost: number,
      totalTTC: number,
      paymentStatus: 'Paid' | 'Pending',
      paymentDate?: string,
      paymentMethod?: string,
      impactStock: boolean,
      invoiceId?: string
    }> = {};

    const purchaseInvoices = invoices.filter(i => i.type?.toLowerCase() === 'purchase');
    
    // Sort purchase invoices by date descending to ensure newest is kept
    purchaseInvoices.sort((a, b) => {
        const parseDate = (d: string) => {
            if (!d) return 0;
            if (d.includes('/')) {
               const [day, month, year] = d.split('/');
               return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).getTime();
            }
            return new Date(d).getTime();
        };
        return parseDate(b.date) - parseDate(a.date);
    });

    purchaseInvoices.forEach(i => {
       let dateObj;
       if (i.date.includes('/')) {
           const [day, month, year] = i.date.split('/');
           dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
       } else {
           dateObj = new Date(i.date);
       }
       
       let dateKey = i.date;
       let timestamp = dateObj.getTime();
       if (!isNaN(dateObj.getTime())) {
           const [year, month, day] = [dateObj.getFullYear(), String(dateObj.getMonth() + 1).padStart(2, '0'), String(dateObj.getDate()).padStart(2, '0')];
           dateKey = `${day}/${month}/${year}`;
       }
       
       const providerKey = i.clientName || 'Inconnu';
       const refKey = i.paymentReference || 'Sans Ref';
       const uniqueKey = `${providerKey}_${refKey}`;
       
       // Because we are sorted descending, the first one encountered is the newest.
       // Skip subsequent duplicates.
       if (groups[uniqueKey]) {
            return;
       }
       
       const key = uniqueKey; 

       groups[key] = {
          id: key,
          date: dateKey,
          timestamp: timestamp,
          provider: providerKey,
          reference: refKey,
          originalProvider: i.clientName || '',
          originalReference: i.paymentReference || '',
          items: i.items.map(item => {
             const normInvProvider = normalize(i.clientName);
             const normInvRef = normalize(i.paymentReference);

             // Prioritize movementId if stored in item, fallback to robust matching
             let movementId = (item as any).movementId || stockMovements.find(m => 
                m.wineId === item.id && 
                normalize(m.provider) === normInvProvider && 
                normalize(m.reference) === normInvRef &&
                m.type === 'IN'
             )?.id;
             
             // Generous fallback for old records with mismatching references (e.g. "Sans Ref" vs "86418")
             if (!movementId) {
                movementId = stockMovements.find(m => 
                   m.wineId === item.id && 
                   normalize(m.provider) === normInvProvider && 
                   m.type === 'IN'
                )?.id;
             }
             
             if (!movementId && !(item as any).movementId) {
                console.warn(`Could not link item ${item.name} in invoice ${i.id} to any stock movement. Fallback to wineId used.`, { normInvProvider, normInvRef });
             }

             return {
                id: movementId || item.id,
                wineId: item.id,
                wineName: item.name,
                vintage: item.vintage,
                quantity: item.quantity,
                price: item.buyingPriceHT || (item as any).purchasePriceHT || 0,
                movementId: movementId
             };
          }),
          totalHT: i.totalHT,
          totalShippingCost: i.shippingCost || 0,
          totalTTC: i.totalTTC || (i.totalHT + (i.totalTVA || 0)),
          paymentStatus: i.status === 'Paid' ? 'Paid' : 'Pending',
          paymentDate: i.paymentDate,
          paymentMethod: i.paymentMethod,
          impactStock: (function() {
             const relatedMoves = stockMovements.filter(m => 
                (m.provider === i.clientName || m.provider === i.id) && 
                (m.reference === i.paymentReference || m.reason?.includes(i.id))
             );
             return relatedMoves.length > 0 ? relatedMoves.some(m => m.impactStock !== false) : true;
          })(),
          invoiceId: i.id
       };
    });

    // Round values to 2 decimal places to avoid floating point issues
    Object.values(groups).forEach(g => {
        g.totalHT = Math.round(g.totalHT * 100) / 100;
        g.totalShippingCost = Math.round(g.totalShippingCost * 100) / 100;
        g.totalTTC = Math.round(g.totalTTC * 100) / 100;
    });

    return Object.values(groups).sort((a, b) => {
        return b.timestamp - a.timestamp;
    });
  }, [invoices, stockMovements]);

  // --- FILTERS LOGIC (Same as Cart.tsx) ---
  const allRegions = useMemo(() => [...new Set(domains.map(d => d.region))].sort(), [domains]);
  
  const availableSubRegions = useMemo(() => {
    let relevantDomainIds = new Set(domains.map(d => d.id));
    if (regionFilter !== 'all') {
      relevantDomainIds = new Set(domains.filter(d => d.region === regionFilter).map(d => d.id));
    }
    
    const subs = new Set<string>();
    wines.forEach(w => {
        if (!w.isArchived && relevantDomainIds.has(w.domainId) && w.subRegion) {
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
            .filter(w => w.subRegion === subRegionFilter && !w.isArchived)
            .map(w => w.domainId));
        relevantDomains = relevantDomains.filter(d => domainIdsWithSubRegion.has(d.id));
    }
    
    return relevantDomains.sort((a, b) => a.name.localeCompare(b.name));
  }, [domains, wines, regionFilter, subRegionFilter]);

  const filteredWines = wines.filter(w => {
    if (w.isArchived) return false;
    
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

  // --- CART ACTIONS ---
  const addToCart = (wine: Wine) => {
    console.log("addToCart called for:", wine.id);
    setActiveTab('new');
    setPurchaseItems(prev => {
      const existing = prev.find(i => i.id === wine.id);
      if (existing) return prev; 
      return [...prev, { ...wine, quantity: 1, purchasePriceHT: wine.buyingPriceHT }];
    });
  };

  const handleCreateNewWine = () => {
      isCreatingRef.current = true;
      onEditWine(null);
  };

  const handleDuplicateWine = (wine: Wine) => {
      isCreatingRef.current = true; // IMPORTANT : Ceci déclenchera l'ajout automatique après sauvegarde
      const copyData = { ...wine, id: undefined, stock: 0 };
      onEditWine(null, copyData);
  };

  const removeFromCart = (id: string) => {
    setPurchaseItems(prev => prev.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: 'quantity' | 'purchasePriceHT', value: number) => {
    setPurchaseItems(prev => prev.map(i => {
      if (i.id === id) {
        // Sécurité : si on reçoit NaN (champ vidé), on garde la valeur actuelle ou 0
        const safeValue = Number.isNaN(value) ? 0 : value;
        return { ...i, [field]: safeValue };
      }
      return i;
    }));
  };

  const totalHT = purchaseItems.reduce((sum, item) => sum + ((item.purchasePriceHT || 0) * (item.quantity || 0)), 0);
  const grandTotalHT = totalHT + (shippingCostHT || 0);

  const handleSubmit = async (ignoreZeroWarning = false) => {
    console.log("handleSubmit called. Provider:", provider, "Items length:", purchaseItems.length);
    if (!provider) return alert('Nom du fournisseur requis');
    if (purchaseItems.length === 0) return alert('La réception est vide');
    
    // Validation des prix à 0€
    if (!ignoreZeroWarning) {
      const zeroPriceItems = purchaseItems.filter(item => (item.purchasePriceHT || 0) === 0);
      if (zeroPriceItems.length > 0) {
        setShowZeroWarning(true);
        return;
      }
    }

    const validItems = purchaseItems
      .filter(item => (item.quantity || 0) > 0)
      .map(item => ({
        ...item,
        quantity: item.quantity || 0,
        purchasePriceHT: item.purchasePriceHT || 0,
        vatRate: item.vatRate || 20
      }));

    if (validItems.length === 0) return alert('La réception est vide ou les quantités sont invalides');

    const safeShippingCost = Number.isNaN(shippingCostHT) ? 0 : shippingCostHT;

    const success = await onConfirmPurchase(provider, reference, validItems, purchaseDate, safeShippingCost, impactStock);
    if (success) {
      const message = impactStock 
        ? "Réception validée avec succès ! Le stock a été mis à jour et le PMP recalculé."
        : "Réception validée avec succès ! (Rétro-documentation : aucun impact sur le stock ni sur le PMP).";
      alert(message);
      setPurchaseItems([]);
      setProvider('');
      setReference('');
      setShippingCostHT(0);
      setImpactStock(true);
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setActiveTab('journal'); 
    }
  };
  
  const handleCancelClick = async (entry: any) => {
     setCancelWarningEntry(entry);
  };

  const handleExportExcel = () => {
    const headers = ["Date", "Fournisseur", "Référence", "Vin", "Quantité", "Prix Unitaire HT", "Total Ligne HT", "Total Facture HT", "Statut Paiement"];
    const rows: any[] = [];

    purchaseJournal.forEach(entry => {
      entry.items.forEach((item: any) => {
        rows.push([
          entry.date,
          entry.provider,
          entry.reference,
          `${item.wineName || item.name} ${item.vintage ? `(${item.vintage})` : ''}`,
          item.quantity,
          (item.price || 0).toFixed(2),
          ((item.price || 0) * item.quantity).toFixed(2),
          (entry.totalHT + (entry.totalShippingCost || 0)).toFixed(2),
          entry.paymentStatus
        ]);
      });
    });

    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.join(";"))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "journal_achats_detaille.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const confirmCancel = async () => {
     if (cancelWarningEntry) {
        if (onDeleteInvoice && cancelWarningEntry.invoiceId) {
           await onDeleteInvoice(cancelWarningEntry.invoiceId);
        } else if (onCancelPurchase) {
           // Fallback for very old entries without invoiceId
           await onCancelPurchase(cancelWarningEntry.items);
        }
        setCancelWarningEntry(null);
     }
  };

  const openPaymentModal = (entry: any) => {
     setSelectedPurchase({ provider: entry.originalProvider, reference: entry.originalReference, invoiceId: entry.invoiceId });
     setIsPaymentModalOpen(true);
  };

  const handlePaymentConfirm = async (date: string, method: string) => {
      if (selectedPurchase && onUpdatePayment) {
          await onUpdatePayment(selectedPurchase.provider, selectedPurchase.reference, { date, method }, selectedPurchase.invoiceId);
          setIsPaymentModalOpen(false);
          setSelectedPurchase(null);
      }
  };

  const handleSaveShippingCost = async (entry: any) => {
      if (!editingShippingCost || !onUpdateShippingCost) return;
      
      const cleanAmount = editingShippingCost.amount.toString().replace(',', '.');
      const newShipping = parseFloat(cleanAmount);
      if (isNaN(newShipping) || newShipping < 0) {
          alert("Montant invalide");
          return;
      }

      // Convert date back to YYYY-MM-DD for the API
      const [day, month, year] = entry.date.split('/');
      const isoDate = `${year}-${month}-${day}`;

      const success = await onUpdateShippingCost(entry.provider, entry.reference, entry.date, newShipping);
      if (success) {
          setEditingShippingCost(null);
      }
  };

  const handleSaveTotalAmount = async (entry: any) => {
      if (!editingTotal || !onUpdatePurchaseItem) return;
      
      const cleanAmount = editingTotal.amount.toString().replace(',', '.');
      const newTotalFacture = parseFloat(cleanAmount);
      if (isNaN(newTotalFacture) || newTotalFacture < 0) {
          alert("Montant invalide");
          return;
      }

      const newTotalVins = newTotalFacture - (entry.totalShippingCost || 0);

      if (newTotalVins < 0) {
          alert("Le total des vins ne peut pas être négatif (frais de port supérieurs au total).");
          return;
      }

      if (entry.totalHT === 0 && newTotalVins > 0) {
          alert("Impossible de modifier le montant d'une réception à 0€");
          return;
      }

      // Calculate the ratio between the new total and the old total
      const ratio = entry.totalHT > 0 ? newTotalVins / entry.totalHT : 1;
      
      // Calculate new prices for each item
      const updates = entry.items.map((item: any) => ({
          id: item.id,
          newPrice: item.price * ratio
      }));

      const success = await onUpdatePurchaseItem(updates, { provider: entry.provider, reference: entry.reference, invoiceId: entry.invoiceId });
      if (success) {
          setEditingTotal(null);
      }
  };

  const handleSaveHeader = async (entry: any) => {
      if (!editingHeader || !onUpdatePurchaseItem) return;
      
      // Normalize date to ISO YYYY-MM-DD if needed
      let normalizedDate = editingHeader.date;
      if (normalizedDate.includes('/')) {
          const [d, m, y] = normalizedDate.split('/');
          normalizedDate = `${y}-${m}-${d}`;
      }

      const success = await onUpdatePurchaseItem(entry.items.map((item: any) => ({
          id: item.id,
          wineId: item.wineId,
          newDate: normalizedDate,
          newProvider: editingHeader.provider,
          newReference: editingHeader.reference
      })), { provider: entry.originalProvider, reference: entry.originalReference, invoiceId: entry.invoiceId });
      
      if (success) {
          setEditingHeader(null);
      }
  };

  const handleSaveItemPrice = async (item: any, entry: any) => {
      if (!editingItemPrice || !onUpdatePurchaseItem) return;
      
      const newPrice = parseFloat(editingItemPrice.price.toString().replace(',', '.'));
      if (isNaN(newPrice) || newPrice < 0) {
          alert("Prix invalide");
          return;
      }

      const success = await onUpdatePurchaseItem([{ 
          id: item.id, 
          wineId: item.wineId,
          newPrice,
          newProvider: entry.provider,
          newReference: entry.reference
      }], { provider: entry.provider, reference: entry.reference, invoiceId: entry.invoiceId });
      if (success) {
          setEditingItemPrice(null);
      }
  };

  const handleSaveItemQuantity = async (item: any, entry: any) => {
      if (!editingItemQuantity || !onUpdatePurchaseItem) return;
      
      const newQuantity = parseInt(editingItemQuantity.quantity.toString());
      if (isNaN(newQuantity) || newQuantity < 1) {
          alert("Quantité invalide");
          return;
      }

      const success = await onUpdatePurchaseItem([{ 
          id: item.id, 
          wineId: item.wineId,
          newQuantity,
          newProvider: entry.provider,
          newReference: entry.reference
      }], { provider: entry.provider, reference: entry.reference, invoiceId: entry.invoiceId });
      if (success) {
          setEditingItemQuantity(null);
      }
  };

  const handleSaveItemVat = async (item: any, entry: any) => {
      if (!editingItemVat || !onUpdatePurchaseItem) return;
      
      const newVat = parseFloat(editingItemVat.vatRate.toString().replace(',', '.'));
      if (isNaN(newVat) || newVat < 0) {
          alert("Taux de TVA invalide");
          return;
      }

      const success = await onUpdatePurchaseItem([{ 
          id: item.id, 
          wineId: item.wineId,
          newVatRate: newVat,
          newProvider: entry.provider,
          newReference: entry.reference
      }], { provider: entry.provider, reference: entry.reference, invoiceId: entry.invoiceId });
      if (success) {
          setEditingItemVat(null);
      }
  };

  return (
    <div className="relative flex flex-col md:h-[calc(100vh-9rem)] gap-6">
       <PaymentModal 
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          onConfirm={(d, m, r) => handlePaymentConfirm(d, m)} // Ref is optional
       />

       <div className="flex p-1 bg-gray-100 border border-gray-200 rounded-lg w-fit overflow-x-auto max-w-full mb-4">
          <button 
             onClick={() => setActiveTab('new')} 
             className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'new' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'}`}
          >
             <PackageCheck size={16} /> Nouvelle Réception
          </button>
          <button 
             onClick={() => setActiveTab('journal')} 
             className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'journal' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'}`}
          >
             <History size={16} /> Journal des Achats
          </button>
       </div>

       {activeTab === 'new' ? (
         <div className="min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
            {/* LEFT COLUMN: CATALOG */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden h-[60vh] lg:h-full">
                <div className="p-4 border-b border-gray-100 space-y-3 bg-gray-50">
                  <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input 
                          type="text" 
                          placeholder="Rechercher un vin..." 
                          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          value={itemSearch}
                          onChange={e => setItemSearch(e.target.value)}
                        />
                        {itemSearch && (
                          <button onClick={() => setItemSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              <X size={14} />
                          </button>
                        )}
                      </div>
                      <button 
                        onClick={handleCreateNewWine}
                        className="px-3 md:px-4 py-2 bg-red-800 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-red-900 shadow-sm transition-colors whitespace-nowrap"
                        title="Créer une nouvelle référence et l'ajouter au bon de réception"
                      >
                         <Plus size={16} /> <span className="hidden sm:inline">Créer Référence</span>
                      </button>
                  </div>
                  
                  {/* Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
                      <div className="text-center py-10 flex flex-col items-center justify-center">
                         <p className="text-gray-400 italic mb-4">Aucun vin trouvé.</p>
                         <button 
                            onClick={handleCreateNewWine}
                            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors"
                         >
                            <Sparkles size={16} /> Créer cette référence manquante
                         </button>
                      </div>
                  ) : (
                      <>
                        {filteredWines.length > 0 && (
                          <div className="flex justify-end mb-2">
                            <button 
                              onClick={() => {
                                filteredWines.forEach(wine => {
                                  if (!purchaseItems.some(i => i.id === wine.id)) {
                                    addToCart(wine);
                                  }
                                });
                              }}
                              className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-100 font-medium transition-colors"
                            >
                              Ajouter tous les vins affichés
                            </button>
                          </div>
                        )}
                        {filteredWines.map(wine => {
                          const domain = domains.find(d => d.id === wine.domainId);
                          const inCart = purchaseItems.some(i => i.id === wine.id);
                        return (
                          <div 
                            key={wine.id}
                            className={`w-full text-left p-3 rounded-lg border flex justify-between items-center group transition-all ${inCart ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-gray-100'}`}
                          >
                            <div className="flex-1 cursor-pointer" onClick={() => {
                                console.log("Clicked wine:", wine.id);
                                addToCart(wine);
                            }}>
                              <div className="font-semibold text-gray-800">
                                {domain?.name}
                              </div>
                              <div className="text-sm text-gray-600">
                                {wine.name} <span className="text-gray-400">| {wine.vintage}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getColorBadgeClass(wine.color)}`}>{wine.color}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">Stock: {wine.stock}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">P.A.: {formatCurrency(wine.buyingPriceHT)}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 pl-3 border-l border-gray-100 ml-2">
                               <button 
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    onEditWine(wine.id);
                                 }}
                                 className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                 title="Voir/Modifier la référence"
                               >
                                  <ExternalLink size={16} />
                               </button>
                               {/* DUPLICATE BUTTON */}
                               <button 
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicateWine(wine);
                                 }}
                                 className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                 title="Dupliquer (Créer nouveau millésime)"
                               >
                                  <Copy size={16} />
                               </button>

                               {/* ADD BUTTON or STATUS */}
                               {inCart ? (
                                  <span className="text-xs font-bold text-blue-600 px-2">Sélectionné</span>
                               ) : (
                                  <button 
                                    onClick={() => addToCart(wine)}
                                    className="p-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                                  >
                                    <Plus size={16} />
                                  </button>
                               )}
                            </div>
                          </div>
                        )
                      })
                      }
                      </>
                  )}
                  </div>
                </div>
            </div>

            {/* RIGHT COLUMN: RECEPTION FORM */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-[60vh] lg:h-full">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2 shrink-0">
                  <PackageCheck className="text-blue-800" /> 
                  Bon de Réception
                </h2>
                
                {/* FOOTER - NOW AT TOP */}
                <div className="border-b border-gray-200 pb-4 space-y-2 mb-4 bg-gray-50 p-4 rounded-lg shrink-0">
                  <button 
                    onClick={handleSubmit} 
                    className="w-full mb-4 bg-blue-800 text-white py-3 rounded-lg font-semibold hover:bg-blue-900 transition-colors flex items-center justify-center gap-2"
                  >
                    Valider la Réception <ArrowRight size={18} />
                  </button>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Total Vins HT</span>
                    <span>{formatCurrency(totalHT)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-200 pt-2">
                    <span>Total Facture HT</span>
                    <span>{formatCurrency(grandTotalHT)}</span>
                  </div>
                </div>

                {/* FORM HEADER - FIXED */}
                <div className="space-y-3 mb-4 shrink-0 bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur *</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      placeholder="Nom du fournisseur (ex: Domaine Leflaive)"
                      value={provider}
                      onChange={e => setProvider(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Référence Facture / BL</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      placeholder="N° Facture"
                      value={reference}
                      onChange={e => setReference(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date de la Facture</label>
                    <input 
                      type="date" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={purchaseDate}
                      onChange={e => setPurchaseDate(e.target.value)}
                    />
                  </div>
                  <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Mode d'entrée</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setImpactStock(true)}
                          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                            impactStock 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <Database size={14} /> Réel (Stock +)
                        </button>
                        <button
                          type="button"
                          onClick={() => setImpactStock(false)}
                          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                            !impactStock 
                              ? 'bg-purple-600 border-purple-600 text-white shadow-md' 
                              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <History size={14} /> Rétro / Archivage
                        </button>
                    </div>
                    <p className="mt-2 text-[10px] text-gray-500 leading-tight">
                        {impactStock 
                          ? "Ajoute les bouteilles au stock physique de l'application." 
                          : "Enregistre la facture sans modifier vos compteurs de stock."}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ajouter une référence</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                      onChange={(e) => {
                        const wine = wines.find(w => w.id === e.target.value);
                        if (wine) addToCart(wine);
                      }}
                      value=""
                    >
                      <option value="" disabled>Sélectionner une référence...</option>
                      {wines.filter(w => !w.isArchived).map(wine => {
                        const domain = domains.find(d => d.id === wine.domainId);
                        return (
                          <option key={wine.id} value={wine.id}>
                            {domain?.name} - {wine.name} ({wine.vintage})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frais de port HT</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
                        placeholder="0.00"
                        value={Number.isNaN(shippingCostHT) ? '' : shippingCostHT}
                        onChange={e => {
                           const val = e.target.value.replace(',', '.');
                           setShippingCostHT(parseFloat(val) || 0);
                        }}
                      />
                      <span className="absolute right-3 top-2 text-gray-500">€</span>
                    </div>
                  </div>
                </div>

                {/* SCROLLABLE LIST - FLEX-1 */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 touch-pan-y h-0">
                  {purchaseItems.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 italic border-2 border-dashed border-gray-100 rounded-lg">
                      Aucun article sélectionné.<br/>Ajoutez des vins depuis la gauche.
                    </div>
                  ) : (
                    purchaseItems.map(item => {
                      // ... (Calculs conservés)
                      const itemEquivalents = item.quantity * getBottleEquivalent(item.format || 'Bouteille (75cl)');
                      const itemShippingCost = (totalHT > 0 && shippingCostHT > 0) ? ((shippingCostHT || 0) / (purchaseItems.reduce((sum, i) => sum + (i.quantity * getBottleEquivalent(i.format || 'Bouteille (75cl)')), 0))) * itemEquivalents : 0;
                      const oldStock = Math.max(0, item.stock); 
                      const oldTotal = oldStock * item.buyingPriceHT;
                      const newBatchTotal = (item.quantity * item.purchasePriceHT) + itemShippingCost;
                      const newTotalQty = oldStock + item.quantity;
                      const newCump = newTotalQty > 0 ? (oldTotal + newBatchTotal) / newTotalQty : item.purchasePriceHT;

                      return (
                        <div key={item.id} className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm">
                          <div className="flex justify-between items-start mb-2">
                            <div className="font-medium text-gray-900 w-3/4 line-clamp-2 cursor-pointer hover:text-blue-600 hover:underline" onClick={() => onEditWine(item.id)}>
                              {item.name} <span className="text-gray-500 font-normal">{item.vintage}</span>
                            </div>
                            <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Quantité</label>
                                <div className="flex items-center gap-1 bg-white rounded border border-gray-300 shadow-sm">
                                    <button onClick={() => updateItem(item.id, 'quantity', Math.max(1, item.quantity - 1))} className="px-2 py-1 hover:bg-gray-100 rounded-l border-r font-bold text-gray-600">-</button>
                                    <input 
                                        type="number"
                                        className="w-12 text-center font-medium text-gray-900 outline-none"
                                        value={item.quantity}
                                        onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                                    />
                                    <button onClick={() => updateItem(item.id, 'quantity', item.quantity + 1)} className="px-2 py-1 hover:bg-gray-100 rounded-r border-l font-bold text-gray-600">+</button>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Prix Achat HT</label>
                                <input 
                                  type="text" 
                                  className="w-full px-2 py-1 border border-gray-300 rounded bg-white text-center font-semibold text-blue-700"
                                  value={item.purchasePriceHT || ''}
                                  onChange={(e) => updateItem(item.id, 'purchasePriceHT', parseFloat(e.target.value.replace(',', '.')) || 0)}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">TVA (%)</label>
                                <input 
                                  type="text" 
                                  className="w-full px-2 py-1 border border-gray-300 rounded bg-white text-center font-semibold text-green-700"
                                  value={item.vatRate || 20}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(',', '.');
                                    const newRate = parseFloat(val) || 0;
                                    setPurchaseItems(prev => prev.map(i => i.id === item.id ? { ...i, vatRate: newRate } : i));
                                  }}
                                />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
            </div>
         </div>
       ) : (
         // JOURNAL VIEW
         <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
               <h3 className="font-bold text-gray-800 flex items-center gap-2">
                 <History size={18} /> Historique des Achats
               </h3>
               <button 
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
               >
                  <FileDown size={16} /> Exporter Excel
               </button>
             </div>
             <div className="flex-1 overflow-auto">
               <table className="w-full text-left min-w-[800px]">
                <thead className="bg-gray-100 sticky top-0 z-10 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Fournisseur</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Référence</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Bouteilles</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Total Vins HT</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Frais de Port HT</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Total Facture HT</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Total Facture TTC</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Statut Paiement</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                   {purchaseJournal.length === 0 ? (
                      <tr><td colSpan={10} className="p-8 text-center text-gray-400 italic">Aucune réception enregistrée pour le moment.</td></tr>
                   ) : (
                     purchaseJournal.map(entry => (
                        <React.Fragment key={entry.id}>
                           <tr className="hover:bg-blue-50 group">
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                 {editingHeader?.id === entry.id ? (
                                    <input 
                                       type="text" 
                                       className="w-24 px-2 py-1 text-xs border border-gray-300 rounded"
                                       value={editingHeader.date}
                                       placeholder="JJ/MM/AAAA"
                                       onChange={(e) => setEditingHeader({ ...editingHeader, date: e.target.value })}
                                       onKeyDown={(e) => e.key === 'Enter' && handleSaveHeader(entry)}
                                    />
                                 ) : (
                                    entry.date
                                 )}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-800 font-bold">
                                 {editingHeader?.id === entry.id ? (
                                    <div className="space-y-1">
                                       <input 
                                          type="text" 
                                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded font-bold"
                                          value={editingHeader.provider}
                                          onChange={(e) => setEditingHeader({ ...editingHeader, provider: e.target.value })}
                                          onKeyDown={(e) => e.key === 'Enter' && handleSaveHeader(entry)}
                                       />
                                       <div className="flex gap-1 justify-end">
                                          <button onClick={() => handleSaveHeader(entry)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                             <CheckCircle size={14} />
                                          </button>
                                          <button onClick={() => setEditingHeader(null)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                                             <X size={14} />
                                          </button>
                                       </div>
                                    </div>
                                 ) : (
                                    <div className="group relative">
                                       <div>{entry.provider}</div>
                                       {entry.impactStock === false && (
                                          <div className="mt-1">
                                             <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100 text-[10px] font-bold uppercase tracking-wider">
                                                <History size={10} /> Rétro-documentation
                                             </span>
                                          </div>
                                       )}
                                       <button 
                                          onClick={() => setEditingHeader({ id: entry.id, date: entry.date, provider: entry.provider, reference: entry.reference })}
                                          className="absolute -right-6 top-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-blue-600"
                                          title="Modifier l'entête (Fournisseur, Réf, Date)"
                                       >
                                          <Sparkles size={12} />
                                       </button>
                                    </div>
                                 )}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                 {editingHeader?.id === entry.id ? (
                                    <input 
                                       type="text" 
                                       className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                       value={editingHeader.reference}
                                       placeholder="Référence"
                                       onChange={(e) => setEditingHeader({ ...editingHeader, reference: e.target.value })}
                                       onKeyDown={(e) => e.key === 'Enter' && handleSaveHeader(entry)}
                                    />
                                 ) : (
                                    entry.reference !== 'Sans Ref' ? <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200">{entry.reference}</span> : <span className="text-gray-400 italic">-</span>
                                 )}
                              </td>
                              <td className="px-6 py-4 text-sm text-center font-medium text-gray-700">
                                 {entry.items.reduce((sum, item) => sum + item.quantity, 0)}
                              </td>
                              <td className="px-6 py-4 text-sm text-right font-medium text-gray-600">
                                 {formatCurrency(entry.totalHT)}
                              </td>
                              <td className="px-6 py-4 text-sm text-right text-gray-600">
                                 {editingShippingCost?.id === entry.id ? (
                                    <div className="flex items-center justify-end gap-2">
                                       <input
                                          type="text"
                                          className="w-24 px-2 py-1 text-sm border border-gray-300 rounded font-medium"
                                          value={editingShippingCost.amount}
                                          onChange={(e) => setEditingShippingCost({ ...editingShippingCost, amount: e.target.value })}
                                          onKeyDown={(e) => {
                                             if (e.key === 'Enter') handleSaveShippingCost(entry);
                                          }}
                                       />
                                       <button
                                          onClick={() => handleSaveShippingCost(entry)}
                                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                                       >
                                          <CheckCircle size={16} />
                                       </button>
                                       <button
                                          onClick={() => setEditingShippingCost(null)}
                                          className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                       >
                                          <X size={16} />
                                       </button>
                                    </div>
                                 ) : (
                                    <div className="flex items-center justify-end gap-2 group/edit-shipping">
                                       <span>{formatCurrency(entry.totalShippingCost || 0)}</span>
                                       <button
                                          onClick={() => setEditingShippingCost({ id: entry.id, amount: entry.totalShippingCost || 0 })}
                                          className="p-1 text-gray-400 opacity-0 group-hover/edit-shipping:opacity-100 hover:text-blue-600 transition-all"
                                          title="Modifier les frais de port"
                                       >
                                          <Sparkles size={14} />
                                       </button>
                                    </div>
                                 )}
                              </td>
                              <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                                 {editingTotal?.id === entry.id ? (
                                    <div className="flex items-center justify-end gap-2">
                                       <input
                                          type="text"
                                          className="w-24 px-2 py-1 text-sm border border-gray-300 rounded font-bold"
                                          value={editingTotal.amount}
                                          onChange={(e) => setEditingTotal({ ...editingTotal, amount: e.target.value })}
                                          onKeyDown={(e) => {
                                             if (e.key === 'Enter') handleSaveTotalAmount(entry);
                                          }}
                                       />
                                       <button
                                          onClick={() => handleSaveTotalAmount(entry)}
                                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                                       >
                                          <CheckCircle size={16} />
                                       </button>
                                       <button
                                          onClick={() => setEditingTotal(null)}
                                          className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                       >
                                          <X size={16} />
                                       </button>
                                    </div>
                                 ) : (
                                    <div className="flex items-center justify-end gap-2 group/edit">
                                       <span>{formatCurrency(entry.totalHT + (entry.totalShippingCost || 0))}</span>
                                       <button
                                          onClick={() => setEditingTotal({ id: entry.id, amount: entry.totalHT + (entry.totalShippingCost || 0) })}
                                          className="p-1 text-gray-400 opacity-0 group-hover/edit:opacity-100 hover:text-blue-600 transition-all"
                                          title="Modifier le montant total facture"
                                       >
                                          <Sparkles size={14} />
                                       </button>
                                    </div>
                                 )}
                              </td>
                              <td className="px-6 py-4 text-sm text-right font-extrabold text-blue-900 bg-blue-50/50">
                                  {formatCurrency(entry.totalTTC)}
                               </td>
                               <td className="px-6 py-4 text-center">
                                  {entry.paymentStatus === 'Paid' ? (
                                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold" title={`Payé le ${entry.paymentDate} par ${entry.paymentMethod}`}>
                                       <CheckCircle size={12} /> Payé
                                    </span>
                                 ) : (
                                    <button 
                                       onClick={() => openPaymentModal(entry)}
                                       className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-bold hover:bg-orange-200 transition-colors"
                                    >
                                       <Clock size={12} /> À Payer
                                    </button>
                                 )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                 <button 
                                    onClick={() => handleCancelClick(entry)}
                                    className="p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors"
                                    title="Annuler cette réception (Retire le stock et recalcule le PMP)"
                                 >
                                    <Trash2 size={16} />
                                 </button>
                              </td>
                           </tr>
                           <tr className="bg-gray-50 border-b border-gray-100">
                              <td colSpan={10} className="px-6 py-2 pb-4">
                                 <div className="pl-4 border-l-2 border-gray-300">
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Détail des vins reçus :</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                       {entry.items.map(m => (
                                          <div key={m.id} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-gray-200 group/item">
                                             <div 
                                                className="truncate pr-2 cursor-pointer hover:text-blue-600 hover:underline" 
                                                title={`Voir la référence ${m.wineName}`}
                                                onClick={() => onEditWine(m.wineId)}
                                             >
                                                {m.wineName} <span className="text-gray-400">({m.vintage})</span>
                                             </div>
                                             <div className="whitespace-nowrap font-medium flex items-center gap-2">
                                                {editingItemQuantity?.id === m.id ? (
                                                   <div className="flex items-center gap-1">
                                                      <input
                                                         type="number"
                                                         className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded"
                                                         value={editingItemQuantity.quantity}
                                                         onChange={(e) => setEditingItemQuantity({ ...editingItemQuantity, quantity: e.target.value })}
                                                         onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                               handleSaveItemQuantity(m, entry);
                                                            }
                                                         }}
                                                         min="1"
                                                      />
                                                      <button
                                                         onClick={() => handleSaveItemQuantity(m, entry)}
                                                         className="text-green-600 hover:bg-green-50 rounded"
                                                      >
                                                         <CheckCircle size={14} />
                                                      </button>
                                                      <button
                                                         onClick={() => setEditingItemQuantity(null)}
                                                         className="text-red-600 hover:bg-red-50 rounded"
                                                      >
                                                         <X size={14} />
                                                      </button>
                                                   </div>
                                                ) : (
                                                   <span 
                                                      className="cursor-pointer hover:text-blue-600 border-b border-dashed border-transparent hover:border-blue-600"
                                                      onClick={() => setEditingItemQuantity({ id: m.id, quantity: m.quantity })}
                                                      title="Modifier la quantité"
                                                   >
                                                      +{m.quantity}
                                                   </span>
                                                )}
                                                <span className="text-gray-400">x</span> 
                                                {editingItemPrice?.id === m.id ? (
                                                   <div className="flex items-center gap-1">
                                                      <input
                                                         type="text"
                                                         className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded font-bold text-blue-700"
                                                         value={editingItemPrice.price}
                                                         onChange={(e) => setEditingItemPrice({ ...editingItemPrice, price: e.target.value })}
                                                         onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                               handleSaveItemPrice(m, entry);
                                                            }
                                                         }}
                                                      />
                                                      <button
                                                         onClick={() => handleSaveItemPrice(m, entry)}
                                                         className="text-green-600 hover:bg-green-50 rounded"
                                                      >
                                                         <CheckCircle size={14} />
                                                      </button>
                                                      <button
                                                         onClick={() => setEditingItemPrice(null)}
                                                         className="text-gray-400 hover:bg-gray-100 rounded"
                                                      >
                                                         <X size={14} />
                                                      </button>
                                                   </div>
                                                ) : (
                                                   <div className="flex items-center gap-1">
                                                      <span>{formatCurrency(m.price || 0)}</span>
                                                      <button
                                                         onClick={() => setEditingItemPrice({ id: m.id, price: m.price || 0 })}
                                                         className="text-gray-400 opacity-0 group-hover/item:opacity-100 hover:text-blue-600 transition-all"
                                                         title="Modifier le prix d'achat"
                                                      >
                                                         <Sparkles size={12} />
                                                      </button>
                                                   </div>
                                                )}
                                             </div>

                                                 <span className="text-gray-300 font-normal ml-1">|</span>
                                                 {editingItemVat?.id === m.id ? (
                                                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded px-1 py-0.5 shadow-sm">
                                                       <select
                                                          className="text-xs border-0 outline-none focus:ring-0 font-bold bg-white text-blue-700 min-w-[50px] cursor-pointer"
                                                          value={editingItemVat.vatRate}
                                                          onChange={(e) => setEditingItemVat({ ...editingItemVat, vatRate: e.target.value })}
                                                          onBlur={() => handleSaveItemVat(m, entry)}
                                                       >
                                                          <option value="20">20%</option>
                                                          <option value="10">10%</option>
                                                          <option value="5.5">5.5%</option>
                                                          <option value="0">0%</option>
                                                       </select>
                                                    </div>
                                                 ) : (
                                                    <div className="flex items-center gap-0.5 group/vat">
                                                       <span 
                                                          className="cursor-pointer font-semibold text-gray-500 hover:text-blue-600 border-b border-dashed border-gray-300 hover:border-blue-600"
                                                          onClick={() => {
                                                             const actualMove = stockMovements.find(sm => sm.id === m.id);
                                                             setEditingItemVat({ id: m.id, vatRate: actualMove?.vatRate ?? 20 });
                                                          }}
                                                          title="Modifier la TVA de cette ligne (cliquer pour modifier)"
                                                       >
                                                          TVA {(stockMovements.find(sm => sm.id === m.id)?.vatRate ?? 20)}%
                                                       </span>
                                                    </div>
                                                 )}
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                              </td>
                           </tr>
                        </React.Fragment>
                     ))
                   )}
                </tbody>
              </table>
            </div>
         </div>
       )}

      {/* ZERO PRICE WARNING MODAL */}
      {showZeroWarning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-amber-50">
              <h3 className="text-xl font-bold text-amber-800 flex items-center gap-2">
                <AlertTriangle size={24} className="text-amber-600" />
                Attention : Prix à 0€
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Certains vins de votre réception ont un prix d'achat à <strong>0€</strong>.
              </p>
              <p className="text-gray-600 mb-6">
                Est-ce normal (ex: échantillon gratuit, cadeau) ?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowZeroWarning(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                >
                  Annuler et corriger
                </button>
                <button
                  onClick={() => {
                    setShowZeroWarning(false);
                    handleSubmit(true);
                  }}
                  className="px-4 py-2 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors shadow-lg shadow-amber-200"
                >
                  Oui, valider quand même
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL WARNING MODAL */}
      {cancelWarningEntry && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-red-50">
              <h3 className="text-xl font-bold text-red-800 flex items-center gap-2">
                <AlertTriangle size={24} className="text-red-600" />
                Attention !
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Vous êtes sur le point d'annuler la réception de <strong>{cancelWarningEntry.provider}</strong> ({cancelWarningEntry.reference}).
              </p>
              
              {cancelWarningEntry.impactStock ? (
                <div className="bg-gray-50 p-4 rounded-lg mb-6 text-sm text-gray-600">
                  <p className="font-medium mb-2">Cela va :</p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Soustraire les quantités du stock</li>
                    <li>Recalculer le PMP inversement pour retrouver le prix d'avant</li>
                  </ol>
                </div>
              ) : (
                <div className="bg-blue-50 p-4 rounded-lg mb-6 text-sm text-blue-800">
                  <p className="font-medium mb-2">Il s'agit d'une rétro-documentation.</p>
                  <p>Cela va simplement supprimer cette facture de l'historique des achats. <strong>Aucun impact sur le stock ni sur le PMP.</strong></p>
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setCancelWarningEntry(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmCancel}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                >
                  Continuer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Purchases;
