
import React, { useState, useMemo } from 'react';
import { User, Phone, Mail, MapPin, Package, ArrowLeft, FileText, Search, Plus, Save, X, Smartphone, Trash2, Printer, History, Euro, ExternalLink } from 'lucide-react';
import { Client, Wine, Domain, CartItem, Invoice } from '../types';
import { formatCurrency, getSellingPrice, getColorBadgeClass, printInvoice } from '../utils';

const Clients = ({
  clients,
  wines,
  domains,
  invoices,
  logo,
  onUpdateClient,
  onAddClient,
  onDeleteClient,
  onCreateInvoice,
  onStockTransfer,
  onEditDomain,
  onEditWine,
  onEditClient // Injection du handler global
}: {
  clients: Client[],
  wines: Wine[],
  domains: Domain[],
  invoices: Invoice[],
  logo: string,
  onUpdateClient: (client: Client) => void,
  onAddClient: (client: Client) => void,
  onDeleteClient: (clientId: string) => void,
  onCreateInvoice: (clientName: string, items: CartItem[], type: 'ProForma' | 'Invoice', clientId?: string) => void,
  onStockTransfer: (clientId: string, wineId: string, quantity: number, direction: 'deposit' | 'return') => void,
  onEditDomain: (id: string) => void,
  onEditWine: (id: string) => void,
  onEditClient: (id: string | null) => void
}) => {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showStockModal, setShowStockModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'stock' | 'invoices'>('stock');

  // Modal Facturation Globale
  const [isGlobalBillingOpen, setIsGlobalBillingOpen] = useState(false);
  const [billingQuantities, setBillingQuantities] = useState<Record<string, number>>({});
  const [billingPrices, setBillingPrices] = useState<Record<string, number>>({});
  
  // Stock Transfer states
  const [transferWineId, setTransferWineId] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [transferSearch, setTransferSearch] = useState('');

  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.contactName?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [clients, searchTerm]);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const clientInvoices = useMemo(() => {
     if (!selectedClient) return [];
     const invs = invoices.filter(i => 
       i.clientId === selectedClient.id || 
       i.clientName.toLowerCase() === selectedClient.name.toLowerCase()
     );
     // Sort desc date, then desc ID
     return invs.sort((a, b) => {
        const dateA = a.invoiceDate ? new Date(a.invoiceDate.split('/').reverse().join('-')) : new Date(a.date.split('/').reverse().join('-'));
        const dateB = b.invoiceDate ? new Date(b.invoiceDate.split('/').reverse().join('-')) : new Date(b.date.split('/').reverse().join('-'));
        const diff = dateB.getTime() - dateA.getTime();
        if (diff === 0) return b.id.localeCompare(a.id);
        return diff;
     });
  }, [invoices, selectedClient]);

  const handleNewClientClick = () => {
    onEditClient(null);
  };

  const handleDeleteClick = () => {
    if (selectedClient) {
      onDeleteClient(selectedClient.id);
      setSelectedClientId(null);
    }
  };

  const handleDeposit = () => {
    if (selectedClientId && transferWineId) {
      onStockTransfer(selectedClientId, transferWineId, transferQty, 'deposit');
      setShowStockModal(false);
      setTransferWineId('');
      setTransferQty(1);
    }
  };

  const openGlobalBilling = () => {
    if (!selectedClient) return;
    const initialQty: Record<string, number> = {};
    const initialPrices: Record<string, number> = {};
    
    selectedClient.externalStock.forEach(item => {
        initialQty[item.wineId] = 0; // Default to 0 to force user input (relevé de conso)
        const wine = wines.find(w => w.id === item.wineId);
        const domain = wine ? domains.find(d => d.id === wine.domainId) : undefined;
        if (wine) {
            initialPrices[item.wineId] = getSellingPrice(wine, domain);
        }
    });
    setBillingQuantities(initialQty);
    setBillingPrices(initialPrices);
    setIsGlobalBillingOpen(true);
  };

  const handleBillingQtyChange = (wineId: string, val: number) => {
      if (!selectedClient) return;
      const stockItem = selectedClient.externalStock.find(s => s.wineId === wineId);
      if (!stockItem) return;
      const safeVal = Math.min(stockItem.quantity, Math.max(0, val));
      setBillingQuantities(prev => ({ ...prev, [wineId]: safeVal }));
  };

  const handleBillingPriceChange = (wineId: string, val: string) => {
      const price = parseFloat(val);
      if (!isNaN(price)) {
          setBillingPrices(prev => ({ ...prev, [wineId]: price }));
      }
  };

  const setAllToMax = () => {
      if (!selectedClient) return;
      const maxQty: Record<string, number> = {};
      selectedClient.externalStock.forEach(item => {
          maxQty[item.wineId] = item.quantity;
      });
      setBillingQuantities(maxQty);
  };

  const confirmGlobalBill = () => {
    if (!selectedClient) return;
    
    const itemsToBill: CartItem[] = [];
    
    Object.entries(billingQuantities).forEach(([wineId, qty]) => {
        // Explicitly cast qty to number to avoid TypeScript 'unknown' errors
        const quantity = qty as number;
        if (quantity > 0) {
            const wine = wines.find(w => w.id === wineId);
            if (wine) {
                itemsToBill.push({
                    ...wine,
                    quantity: quantity,
                    sellingPriceHT: billingPrices[wineId], // Use modified price
                    fromExternalStock: true
                });
            }
        }
    });

    if (itemsToBill.length === 0) {
        alert("Aucune quantité saisie à facturer.");
        return;
    }

    onCreateInvoice(selectedClient.name, itemsToBill, 'Invoice', selectedClient.id);
    setIsGlobalBillingOpen(false);
  };

  const handleReturnStock = (wineId: string, qty: number) => {
    if (selectedClientId && window.confirm("Restituer ce stock vers la cave principale ?")) {
      onStockTransfer(selectedClientId, wineId, qty, 'return');
    }
  };

  const filteredWinesForTransfer = wines.filter(w => 
    !w.isArchived && w.stock > 0 &&
    (w.name.toLowerCase().includes(transferSearch.toLowerCase()) || 
     domains.find(d => d.id === w.domainId)?.name.toLowerCase().includes(transferSearch.toLowerCase()))
  ).sort((a,b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col md:flex-row md:h-[calc(100vh-100px)] gap-6">
      {/* Client List */}
      <div className={`w-full md:w-1/3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col ${selectedClientId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Rechercher un client..." 
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={handleNewClientClick}
            className="w-full py-2 bg-white border border-dashed border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Nouveau Client
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredClients.map(client => {
            // Calculer la valorisation totale du stock déporté en PRIX D'ACHAT HT
            const stockValue = client.externalStock.reduce((acc, item) => {
                const wine = wines.find(w => w.id === item.wineId);
                if (!wine) return acc;
                // Valeur Stock = Prix Achat HT * Quantité
                return acc + (wine.buyingPriceHT * item.quantity);
            }, 0);

            return (
            <div 
              key={client.id}
              onClick={() => { setSelectedClientId(client.id); setActiveTab('stock'); }}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${selectedClientId === client.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
            >
              <div className="font-semibold text-gray-900">{client.name}</div>
              {client.contactName && <div className="text-sm text-gray-500">{client.contactName}</div>}
              {client.externalStock.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                    <Package size={12} /> {client.externalStock.reduce((acc, s) => acc + s.quantity, 0)} btl
                  </div>
                  {stockValue > 0 && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium" title="Valeur Stock (Achat HT)">
                       <Euro size={12} /> {formatCurrency(stockValue)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )})}
          {filteredClients.length === 0 && (
             <div className="p-4 text-center text-gray-400 text-sm">Aucun client trouvé.</div>
          )}
        </div>
      </div>

      {/* Client Details */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
        {selectedClient ? (
          <>
            {/* Header / Info */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-4">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 group">
                   {selectedClient.name}
                   <button 
                      onClick={() => onEditClient(selectedClient.id)} 
                      className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Modifier les coordonnées"
                   >
                      <ExternalLink size={20} />
                   </button>
                </h2>
                
                <div className="flex gap-2 w-full md:w-auto">
                  <button 
                    onClick={() => setSelectedClientId(null)}
                    className="md:hidden px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-200 flex items-center gap-2 flex-1 justify-center"
                  >
                    <ArrowLeft size={16} /> Retour
                  </button>
                  <button 
                    onClick={handleDeleteClick}
                    className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100 hover:bg-red-100 flex items-center gap-2 flex-1 md:flex-none justify-center"
                    title="Supprimer le client"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button 
                    onClick={() => onEditClient(selectedClient.id)}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50 flex-1 md:flex-none justify-center"
                  >
                    Modifier
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <User size={16} /> Contact
                    </div>
                    <span className="text-gray-800">{selectedClient.contactName || "Non renseigné"}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Mail size={16} /> Email
                    </div>
                    {selectedClient.email ? <a href={`mailto:${selectedClient.email}`} className="text-blue-600 hover:underline">{selectedClient.email}</a> : <span className="text-gray-400">Non renseigné</span>}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Smartphone size={16} /> Téléphone Mobile
                    </div>
                    <span className="text-gray-800">{selectedClient.phone || "Non renseigné"}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Phone size={16} /> Téléphone Fixe
                    </div>
                    <span className="text-gray-800">{selectedClient.phoneLandline || "Non renseigné"}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <MapPin size={16} /> Adresse
                    </div>
                    <span className="whitespace-pre-line text-gray-800 block">{selectedClient.address || "Aucune adresse"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex border-b border-gray-200 bg-white">
                <button 
                    onClick={() => setActiveTab('stock')}
                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'stock' ? 'border-orange-500 text-orange-600 bg-orange-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <Package size={16} /> Stock Déporté
                </button>
                <button 
                    onClick={() => setActiveTab('invoices')}
                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'invoices' ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <History size={16} /> Historique Factures
                </button>
            </div>

            {/* TAB CONTENT: STOCK */}
            {activeTab === 'stock' && selectedClient && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  Stock en Consignation
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={openGlobalBilling}
                    disabled={selectedClient.externalStock.length === 0}
                    className="px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText size={16} /> Facturer Consommations
                  </button>
                  <button 
                    onClick={() => setShowStockModal(true)}
                    className="px-3 py-1.5 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <Plus size={16} /> Nouveau Dépôt
                  </button>
                </div>
              </div>

              {selectedClient.externalStock.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500">
                  Aucun stock en dépôt chez ce client.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase">
                      <th className="py-2 pl-2">Vin</th>
                      <th className="py-2 text-center">En Stock</th>
                      <th className="py-2 text-center">Vendu</th>
                      <th className="py-2 text-right">Valeur Vente HT</th>
                      <th className="py-2 text-right pr-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...selectedClient.externalStock]
                      .sort((a, b) => {
                         const wineA = wines.find(w => w.id === a.wineId);
                         const wineB = wines.find(w => w.id === b.wineId);
                         if (!wineA || !wineB) return 0;
                         return wineA.name.localeCompare(wineB.name);
                      })
                      .map(stockItem => {
                      const wine = wines.find(w => w.id === stockItem.wineId);
                      const domain = wine ? domains.find(d => d.id === wine.domainId) : null;
                      if (!wine) return null;
                      
                      const unitPrice = getSellingPrice(wine, domain);
                      
                      const soldQuantity = invoices
                        .filter(inv => inv.clientId === selectedClient.id && inv.type === 'FACTURE')
                        .flatMap(inv => inv.items)
                        .filter(item => item.id === stockItem.wineId && item.fromExternalStock)
                        .reduce((acc, item) => acc + item.quantity, 0);
                      
                      return (
                        <tr key={stockItem.wineId} className="hover:bg-gray-50">
                          <td className="py-3 pl-2">
                            <div 
                               className="font-medium text-gray-900 cursor-pointer hover:text-blue-600 hover:underline"
                               onClick={() => onEditWine(wine.id)}
                            >
                               {wine.name}
                            </div>
                            <div className="text-xs text-gray-500 flex flex-wrap items-center gap-1 mt-1">
                               <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${getColorBadgeClass(wine.color)}`}>
                                 {wine.color}
                               </span>
                               <span 
                                 onClick={(e) => { e.stopPropagation(); if(domain) onEditDomain(domain.id); }}
                                 className="cursor-pointer hover:text-blue-600 hover:underline"
                               >
                                 {domain?.name}
                               </span>
                               <span>•</span>
                               <span>{wine.vintage}</span>
                               
                               {wine.format && (
                                  <span className={`px-1 py-0.5 text-[9px] rounded border uppercase ml-1 ${
                                     wine.format === 'Bouteille (75cl)' 
                                       ? 'bg-gray-50 text-gray-500 border-gray-100' 
                                       : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                  }`}>
                                     {wine.format}
                                  </span>
                               )}
                            </div>
                          </td>
                          <td className="py-3 text-center font-bold text-gray-800 bg-orange-50 rounded-lg">
                            {stockItem.quantity}
                          </td>
                          <td className="py-3 text-center text-gray-600 font-medium">
                            {soldQuantity}
                          </td>
                          <td className="py-3 text-right text-gray-600">
                            {formatCurrency(unitPrice * stockItem.quantity)}
                          </td>
                          <td className="py-3 text-right pr-2">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => handleReturnStock(stockItem.wineId, stockItem.quantity)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" 
                                title="Retour de stock (Invendus)"
                                disabled={stockItem.quantity === 0}
                              >
                                <ArrowLeft size={16} className={stockItem.quantity === 0 ? 'opacity-50' : ''} />
                              </button>
                              <button 
                                onClick={() => {
                                  if (window.confirm("Êtes-vous sûr de vouloir supprimer cette ligne de stock déporté ?")) {
                                    const newExternalStock = selectedClient.externalStock.filter(s => s.wineId !== stockItem.wineId);
                                    onUpdateClient({ ...selectedClient, externalStock: newExternalStock });
                                  }
                                }}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded" 
                                title="Supprimer la ligne"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>
            )}

            {/* TAB CONTENT: INVOICES */}
            {activeTab === 'invoices' && selectedClient && (
              <div className="flex-1 overflow-y-auto p-6">
                 <h3 className="text-lg font-bold text-gray-800 mb-4">Historique de facturation</h3>
                 {clientInvoices.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500">
                       Aucune facture ou devis trouvé pour ce client.
                    </div>
                 ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                       <table className="w-full text-left min-w-[600px]">
                          <thead className="bg-gray-50 border-b border-gray-200">
                             <tr>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">N°</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Montant TTC</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Statut</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Action</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                             {clientInvoices.map(inv => (
                                <tr key={inv.id} className="hover:bg-gray-50 text-sm">
                                   <td className="px-4 py-3 font-mono text-gray-900">{inv.id}</td>
                                   <td className="px-4 py-3 text-gray-600">{inv.invoiceDate || inv.date}</td>
                                   <td className="px-4 py-3 font-bold text-gray-900 text-right">{formatCurrency(inv.totalTTC)}</td>
                                   <td className="px-4 py-3 text-center">
                                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                         inv.status === 'Paid' ? 'bg-green-100 text-green-800' :
                                         inv.status === 'Validated' ? 'bg-blue-100 text-blue-800' :
                                         inv.status === 'Cancelled' ? 'bg-gray-100 text-gray-800 line-through' :
                                         'bg-orange-100 text-orange-800'
                                      }`}>
                                         {inv.status === 'Paid' ? 'Payée' : inv.status === 'Validated' ? 'Validée' : inv.status === 'Cancelled' ? 'Annulée' : 'Pro Forma'}
                                      </span>
                                   </td>
                                   <td className="px-4 py-3 text-right">
                                      <button 
                                         onClick={() => printInvoice(inv, clients, logo)}
                                         className="p-1.5 hover:bg-gray-100 rounded text-gray-600" 
                                         title="Imprimer"
                                      >
                                         <Printer size={16} />
                                      </button>
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 )}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <User size={48} className="mb-4 opacity-20" />
            <p>Sélectionnez un client pour voir les détails</p>
          </div>
        )}
      </div>

      {/* Modal Depot Stock */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800">Déposer du stock chez {selectedClient?.name}</h3>
              <button onClick={() => setShowStockModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 border-b border-gray-100">
               <input 
                  type="text"
                  placeholder="Rechercher un vin à déposer..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                  value={transferSearch}
                  onChange={e => setTransferSearch(e.target.value)}
               />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
               {filteredWinesForTransfer.map(wine => {
                  const domain = domains.find(d => d.id === wine.domainId);
                  return (
                    <div 
                      key={wine.id}
                      onClick={() => setTransferWineId(wine.id)}
                      className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center ${transferWineId === wine.id ? 'border-orange-500 bg-orange-50' : 'border-gray-100 hover:bg-gray-50'}`}
                    >
                       <div>
                          <div className="font-medium text-gray-900">{wine.name}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                             <span 
                               onClick={(e) => { e.stopPropagation(); if(domain) onEditDomain(domain.id); }}
                               className="cursor-pointer hover:text-blue-600 hover:underline"
                             >
                               {domain?.name}
                             </span> • {wine.vintage}
                             {wine.format && wine.format !== 'Bouteille (75cl)' && (
                                <span className="bg-indigo-50 text-indigo-700 px-1 rounded text-[10px] border border-indigo-100">{wine.format}</span>
                             )}
                             <span className={`${getColorBadgeClass(wine.color)} px-1 rounded ml-1`}>{wine.color}</span>
                          </div>
                       </div>
                       <div className="text-sm font-bold text-gray-600">
                          Stock: {wine.stock}
                       </div>
                    </div>
                  );
               })}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50">
               <div className="flex items-center gap-4 mb-4">
                  <label className="text-sm font-medium text-gray-700">Quantité à déposer :</label>
                  <input 
                    type="number" 
                    min="1" 
                    max={wines.find(w => w.id === transferWineId)?.stock || 1}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg outline-none"
                    value={transferQty}
                    onChange={e => setTransferQty(parseInt(e.target.value))}
                  />
               </div>
               <button 
                 onClick={handleDeposit}
                 disabled={!transferWineId}
                 className="w-full py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
               >
                 Confirmer le dépôt
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Facturation Globale (Consommations) */}
      {isGlobalBillingOpen && selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800">Facturer les consommations : {selectedClient.name}</h3>
              <button onClick={() => setIsGlobalBillingOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 bg-yellow-50 border-b border-yellow-100 text-sm text-yellow-800">
               Saisissez les quantités consommées (vendues) pour chaque référence. Le prix unitaire est modifiable ici sans affecter le catalogue.
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-auto">
               <table className="w-full text-left min-w-[800px]">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                     <tr>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Vin / Domaine</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-center">En Stock</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Quantité à Facturer</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Prix Unit. HT</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Total Ligne HT</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                     {[...selectedClient.externalStock]
                        .sort((a, b) => {
                           const wineA = wines.find(w => w.id === a.wineId);
                           const wineB = wines.find(w => w.id === b.wineId);
                           if (!wineA || !wineB) return 0;
                           return wineA.name.localeCompare(wineB.name);
                        })
                        .map(item => {
                        const wine = wines.find(w => w.id === item.wineId);
                        const domain = wine ? domains.find(d => d.id === wine.domainId) : null;
                        const qtyToBill = billingQuantities[item.wineId] || 0;
                        const price = billingPrices[item.wineId] || 0;
                        
                        if (!wine) return null;

                        return (
                           <tr key={item.wineId} className={qtyToBill > 0 ? 'bg-green-50' : 'hover:bg-gray-50'}>
                              <td className="px-6 py-3">
                                 <div 
                                    className="font-medium text-gray-900 cursor-pointer hover:text-blue-600 hover:underline"
                                    onClick={() => onEditWine(wine.id)}
                                 >
                                    {wine.name}
                                 </div>
                                 <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${getColorBadgeClass(wine.color)}`}>
                                       {wine.color}
                                    </span>
                                    <span 
                                      onClick={(e) => { e.stopPropagation(); if(domain) onEditDomain(domain.id); }}
                                      className="cursor-pointer hover:text-blue-600 hover:underline"
                                    >
                                      {domain?.name}
                                    </span>
                                    <span>•</span>
                                    <span>{wine.vintage}</span>
                                 </div>
                              </td>
                              <td className="px-6 py-3 text-center">
                                 <span className="inline-block px-2 py-1 bg-gray-100 rounded text-gray-700 font-medium text-sm">
                                    {item.quantity}
                                 </span>
                              </td>
                              <td className="px-6 py-3 text-center">
                                 <div className="flex items-center justify-center gap-2">
                                    <button 
                                       onClick={() => handleBillingQtyChange(item.wineId, Math.max(0, qtyToBill - 1))}
                                       className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                                    >-</button>
                                    <input 
                                       type="number" 
                                       className="w-16 text-center border border-gray-300 rounded py-1 font-bold text-gray-900 focus:ring-2 focus:ring-green-500 outline-none"
                                       min="0"
                                       max={item.quantity}
                                       value={qtyToBill}
                                       onChange={(e) => handleBillingQtyChange(item.wineId, parseInt(e.target.value) || 0)}
                                    />
                                    <button 
                                       onClick={() => handleBillingQtyChange(item.wineId, Math.min(item.quantity, qtyToBill + 1))}
                                       className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                                    >+</button>
                                 </div>
                              </td>
                              <td className="px-6 py-3 text-right">
                                <div className="flex justify-end items-center gap-1">
                                    <input 
                                        type="number"
                                        step="0.01"
                                        className="w-20 text-right border border-gray-300 rounded py-1 px-2 font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={price}
                                        onChange={(e) => handleBillingPriceChange(item.wineId, e.target.value)}
                                    />
                                    <span className="text-gray-500">€</span>
                                </div>
                              </td>
                              <td className="px-6 py-3 text-right font-bold text-gray-900">
                                {formatCurrency(price * qtyToBill)}
                              </td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
               <button 
                  onClick={setAllToMax}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
               >
                  Tout sélectionner (Vider le stock)
               </button>
               <button 
                 onClick={confirmGlobalBill}
                 className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2 shadow-sm"
               >
                 <FileText size={18} /> Générer Facture Globale
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
