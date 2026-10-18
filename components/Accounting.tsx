
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Printer, FileBadge, Ban, Euro, Undo2, Trash2, Download, FileSpreadsheet, Calendar, Scale, User, Pencil, Save, X, Check, Truck, FileClock, Eye, Calculator, Plus, TrendingUp, TrendingDown, Landmark, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Invoice, Client, Wine, StockMovement, ExpenseCategory, CartItem, WineColor } from '../types';
import { formatCurrency, printInvoice, calculateInvoiceTotals, getSellingPrice, parseYear } from '../utils'; // Import updated utils
import PaymentModal from './PaymentModal';
import { DrmTable } from './drm/DrmTable';
import HistoricalInvoiceModal from './HistoricalInvoiceModal';

  const Accounting = ({ 
  invoices, 
  clients,
  wines,
  domains,
  stockMovements,
  onUpdateStatus,
  onUpdateInvoice,
  onRenumberInvoice,
  onDeleteInvoice,
  logo,
  onEditClient,
  onEditWine,
  onImportHistoricalInvoice,
  defaultTab = 'proforma'
}: { 
  invoices: Invoice[], 
  clients: Client[],
  wines: Wine[],
  domains: any[],
  stockMovements: StockMovement[],
  onUpdateStatus: (id: string, status: Invoice['status'], paymentDetails?: { date: string, method: string, reference?: string }) => void,
  onUpdateInvoice: (invoice: Invoice) => Promise<boolean>,
  onRenumberInvoice: (oldId: string, newId: string) => Promise<boolean>,
  onDeleteInvoice: (id: string) => void,
  logo: string,
  onEditClient: (id: string | null) => void,
  onEditWine: (id: string | null) => void,
  onImportHistoricalInvoice: (invoice: Invoice) => Promise<boolean>,
  defaultTab?: 'proforma' | 'invoice' | 'cancelled' | 'drm'
}) => {
  const [tab, setTab] = useState<'proforma' | 'invoice' | 'cancelled' | 'drm' | 'margin'>(defaultTab as any);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  
  // Historical Import Modal
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState(false);

  // State pour le rapport DRM
  const [drmMonth, setDrmMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // 1. CALCUL MARGE COMMERCIALE (Prix Vente HT - Coût Achat HT)
  const marginData = useMemo(() => {
    return invoices.filter(i => i.status === 'Paid' || i.status === 'Validated').reduce((acc, inv) => {
      const invMargin = inv.items.reduce((itemAcc, item) => {
        const wine = wines.find(w => w.id === item.id);
        const cost = (item as any).purchasePriceHT || wine?.buyingPriceHT || 0;
        return itemAcc + ((item.sellingPriceHT - cost) * item.quantity);
      }, 0);
      return acc + invMargin;
    }, 0);
  }, [invoices, wines]);
  
  const totalCA = useMemo(() => {
    return invoices.filter(i => i.status === 'Paid' || i.status === 'Validated').reduce((acc, inv) => acc + inv.totalHT, 0);
  }, [invoices]);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // State pour l'inspection (Détail TVA)
  const [invoiceToView, setInvoiceToView] = useState<Invoice | null>(null);

  // State pour l'édition de l'ID (Renumérotation) dans la modale
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempId, setTempId] = useState('');

  // --- LOGIC DRM ---
  const drmData = useMemo<Record<string, { in: number, out: number, adjust: number }>>(() => {
    const [year, month] = drmMonth.split('-').map(Number);
    const report: Record<string, { in: number, out: number, adjust: number }> = {};
    
    // Initialize permitted colors (exclude WineColor.Other)
    Object.values(WineColor).forEach(c => {
      if (c !== WineColor.Other) report[c] = { in: 0, out: 0, adjust: 0 };
    });

    // 1. Invoices (Purchases + Sales)
    invoices.forEach(inv => {
      if ((inv.status === 'Validated' || inv.status === 'Paid')) {
        const d = new Date(inv.invoiceDate || inv.date);
        if (d.getMonth() + 1 === month && d.getFullYear() === year) {
          inv.items.forEach(item => {
            const wine = wines.find(w => w.id === item.id);
            if (wine && wine.color !== WineColor.Other) {
              const color = wine.color;
              if (!report[color]) report[color] = { in: 0, out: 0, adjust: 0 };
              
              if (inv.type === 'Purchase') report[color].in += item.quantity;
              if (inv.type === 'Sale') report[color].out += item.quantity;
            }
          });
        }
      }
    });

    // 2. Adjustments (stockMovements)
    stockMovements.forEach(m => {
       if (m.type === 'ADJUST') {
          const d = new Date(m.date);
          if (d.getMonth() + 1 === month && d.getFullYear() === year) {
             const wine = wines.find(w => w.id === m.wineId);
             if (wine && wine.color !== WineColor.Other) {
                const color = wine.color;
                if (!report[color]) report[color] = { in: 0, out: 0, adjust: 0 };
                
                // --- LOG AUDIT SPIRITUEUX ---
                if (color === WineColor.Liquor) {
                    console.log(`[AUDIT SPIRITUEUX] Ajustement du ${d.toLocaleDateString()}: ${wine.name} | Qty: ${m.quantity}`);
                }
                
                report[color].adjust += m.quantity;
             }
          }
       }
    });

    return report;
  }, [drmMonth, invoices, stockMovements, wines]);

  const filtered = useMemo(() => {
    let list = invoices.filter(inv => {
      if (inv.type !== 'Sale') return false;
      let statusMatch = false;
      if (tab === 'invoice') statusMatch = (inv.status === 'Validated' || inv.status === 'Paid');
      else if (tab === 'proforma') statusMatch = inv.status === 'ProForma';
      else if (tab === 'cancelled') statusMatch = inv.status === 'Cancelled';
      else if (tab === 'drm') return true; 
      
      const searchMatch = !searchTerm || 
        inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        inv.id.toLowerCase().includes(searchTerm.toLowerCase());

      return statusMatch && searchMatch;
    });

    // TRI PAR DATE (Le plus récent en haut)
    return list.sort((a, b) => {
       const dateA = a.invoiceDate ? new Date(a.invoiceDate.split('/').reverse().join('-')) : new Date(a.date.split('/').reverse().join('-'));
       const dateB = b.invoiceDate ? new Date(b.invoiceDate.split('/').reverse().join('-')) : new Date(b.date.split('/').reverse().join('-'));
       const diff = dateB.getTime() - dateA.getTime();
       // Si même date, tri par ID décroissant (le plus grand ID en premier)
       if (diff === 0) return b.id.localeCompare(a.id);
       return diff;
    });
  }, [invoices, tab, searchTerm]);

  const handlePaymentClick = (id: string) => {
    setSelectedInvoiceId(id);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentConfirm = (date: string, method: string, reference: string) => {
    if (selectedInvoiceId) {
      onUpdateStatus(selectedInvoiceId, 'Paid', { date, method, reference });
      setIsPaymentModalOpen(false);
      setSelectedInvoiceId(null);
    }
  };

  const handleEditClick = (invoice: Invoice) => {
      // Create a deep copy to edit and normalize vatRate for each item
      const copy = JSON.parse(JSON.stringify(invoice));
      if (copy.items && Array.isArray(copy.items)) {
          copy.items = copy.items.map((item: any) => ({
              ...item,
              vatRate: (item.vatRate !== undefined && item.vatRate !== null && !isNaN(Number(item.vatRate))) ? Number(item.vatRate) : 20
          }));
      }
      setInvoiceToEdit(copy);
      setIsEditModalOpen(true);
      setIsRenaming(false);
      setTempId(invoice.id);
  };

  const handleEditSave = async () => {
      if (invoiceToEdit) {
          const cleanedInvoice = {
              ...invoiceToEdit,
              items: invoiceToEdit.items.map(item => {
                  const rawVat = item.vatRate;
                  const vatRateNum = (rawVat === '' || rawVat === undefined || rawVat === null || isNaN(Number(rawVat))) ? 20 : Number(rawVat);
                  return {
                      ...item,
                      quantity: (item.quantity === '' || item.quantity === undefined || item.quantity === null) ? 0 : Number(item.quantity) || 0,
                      sellingPriceHT: (item.sellingPriceHT === '' || item.sellingPriceHT === undefined || item.sellingPriceHT === null) ? 0 : Number(item.sellingPriceHT) || 0,
                      vatRate: vatRateNum
                  };
              }),
              shippingCost: (invoiceToEdit.shippingCost === '' || invoiceToEdit.shippingCost === undefined || invoiceToEdit.shippingCost === null) ? 0 : Number(invoiceToEdit.shippingCost) || 0
          };

          const success = await onUpdateInvoice(cleanedInvoice);
          if (success) {
              setIsEditModalOpen(false);
              setInvoiceToEdit(null);
          }
      }
  };

  const handleRenumber = async () => {
      if (!invoiceToEdit || !tempId) return;
      if (tempId === invoiceToEdit.id) {
          setIsRenaming(false);
          return;
      }

      if (window.confirm(`Confirmer la renumérotation de ${invoiceToEdit.id} vers ${tempId} ?\n\nCela mettra également à jour l'historique des mouvements de stock.`)) {
          const success = await onRenumberInvoice(invoiceToEdit.id, tempId);
          if (success) {
              setInvoiceToEdit(prev => prev ? ({ ...prev, id: tempId }) : null);
              setIsRenaming(false);
          }
      }
  };

  const updateEditItem = (itemId: string, field: 'name' | 'quantity' | 'sellingPriceHT' | 'vatRate', value: string) => {
      if (!invoiceToEdit) return;
      
      let parsedValue: string | number = value;
      if (field === 'quantity') {
          parsedValue = value === '' ? ('' as any as number) : parseInt(value);
      } else if (field === 'sellingPriceHT' || field === 'vatRate') {
          parsedValue = value === '' ? ('' as any as number) : parseFloat(value);
      }

      setInvoiceToEdit(prev => {
          if (!prev) return null;
          return {
              ...prev,
              items: prev.items.map(i => i.id === itemId ? { ...i, [field]: parsedValue } : i)
          };
      });
  };

  const removeEditItem = (itemId: string) => {
      if (!invoiceToEdit) return;
      setInvoiceToEdit(prev => {
          if (!prev) return null;
          return {
              ...prev,
              items: prev.items.filter(i => i.id !== itemId)
          };
      });
  };

  const addEditItem = () => {
      if (!invoiceToEdit) return;
      setInvoiceToEdit(prev => {
          if (!prev) return null;
          const newItem = {
              id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              name: 'Nouvelle ligne',
              quantity: 1,
              sellingPriceHT: 0,
              vatRate: 20,
              isService: true
          };
          return {
              ...prev,
              items: [...prev.items, newItem as any]
          };
      });
  };

  const addWineItem = (wineId: string) => {
      if (!invoiceToEdit) return;
      const wine = wines.find(w => w.id === wineId);
      if (!wine) return;
      
      const domain = domains.find(d => d.id === wine.domainId);
      const sellingPriceHT = getSellingPrice(wine, domain);

      setInvoiceToEdit(prev => {
          if (!prev) return null;
          
          const existingItemIndex = prev.items.findIndex(i => i.id === wine.id && !i.fromExternalStock && !i.isService);
          
          if (existingItemIndex >= 0) {
              const newItems = [...prev.items];
              newItems[existingItemIndex] = {
                  ...newItems[existingItemIndex],
                  quantity: newItems[existingItemIndex].quantity + 1
              };
              return { ...prev, items: newItems };
          }
          
          const newItem = {
              id: wine.id,
              wineId: wine.id, // Keep a reference to the actual wine
              name: wine.name,
              domainId: wine.domainId,
              vintage: wine.vintage,
              color: wine.color,
              quantity: 1,
              sellingPriceHT: sellingPriceHT,
              vatRate: 20,
              isService: false,
              fromExternalStock: false
          };
          return {
              ...prev,
              items: [...prev.items, newItem as any]
          };
      });
  };

  const updateShippingCost = (value: string) => {
      if (!invoiceToEdit) return;
      const cost = value === '' ? ('' as any as number) : parseFloat(value);
      setInvoiceToEdit(prev => {
          if (!prev) return null;
          return { ...prev, shippingCost: cost };
      });
  };

  const handleExportCSV = () => {
    const header = ['Numero Facture', 'Date Facture', 'Client', 'Total HT', 'Frais Port HT', 'TVA', 'Total TTC', 'Statut', 'Date Paiement', 'Mode Paiement', 'Reference Paiement'];
    const exportData = invoices
      .filter(i => i.status !== 'ProForma')
      .map(i => [
        i.id,
        i.invoiceDate || i.date,
        i.clientName,
        i.totalHT.toFixed(2),
        (i.shippingCost || 0).toFixed(2),
        i.totalTVA.toFixed(2),
        i.totalTTC.toFixed(2),
        i.status,
        i.paymentDate || '',
        i.paymentMethod || '',
        i.paymentReference || ''
      ]);

    const csvContent = [header.join(';'), ...exportData.map(row => row.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `JOURNAL_VENTES_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to recalculate totals on the fly for the modal display
  const editTotals = useMemo(() => {
      if (!invoiceToEdit) return { ht: 0, tva: 0, ttc: 0 };
      const calc = calculateInvoiceTotals(invoiceToEdit.items, invoiceToEdit.shippingCost || 0, invoiceToEdit.discount || 0);
      return {
          ht: calc.totalHT,
          tva: calc.totalTVA,
          ttc: calc.totalTTC
      };
  }, [invoiceToEdit]);

  // Helper pour la modale d'inspection (VIEW ONLY)
  const viewTotals = useMemo(() => {
      if (!invoiceToView) return null;
      return calculateInvoiceTotals(invoiceToView.items, invoiceToView.shippingCost || 0, invoiceToView.discount || 0);
  }, [invoiceToView]);

  return (
    <div className="space-y-6">
      <PaymentModal 
        isOpen={isPaymentModalOpen} 
        onClose={() => setIsPaymentModalOpen(false)} 
        onConfirm={handlePaymentConfirm} 
      />

      <HistoricalInvoiceModal 
        isOpen={isHistoricalModalOpen}
        onClose={() => setIsHistoricalModalOpen(false)}
        onConfirm={onImportHistoricalInvoice}
        existingClientNames={clients.map(c => c.name)}
      />

      {/* MODAL INSPECTION (VIEW ONLY) */}
      {invoiceToView && viewTotals && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Calculator size={20} className="text-blue-600" /> Détail Calculs : {invoiceToView.id}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">{invoiceToView.clientName} - {invoiceToView.invoiceDate || invoiceToView.date}</p>
                    </div>
                    <button onClick={() => setInvoiceToView(null)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {/* 1. TABLEAU RÉPARTITION TVA (LE PLUS IMPORTANT) */}
                    <div className="mb-8">
                        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 border-l-4 border-blue-500 pl-2">Répartition TVA (Synthèse)</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border border-gray-200 rounded-lg overflow-hidden min-w-[400px]">
                                <thead className="bg-gray-100 text-xs text-gray-600 uppercase">
                                    <tr>
                                        <th className="px-4 py-2">Taux TVA</th>
                                        <th className="px-4 py-2 text-right">Base HT</th>
                                        <th className="px-4 py-2 text-right">Montant TVA</th>
                                        <th className="px-4 py-2 text-right font-bold">Total TTC</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {Object.entries(viewTotals.vatBreakdown).sort((a,b) => parseFloat(b[0]) - parseFloat(a[0])).map(([rate, value]) => {
                                        const data = value as { base: number, amount: number };
                                        return (
                                        <tr key={rate} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 font-bold text-blue-700">{rate}%</td>
                                            <td className="px-4 py-2 text-right">{formatCurrency(data.base)}</td>
                                            <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(data.amount)}</td>
                                            <td className="px-4 py-2 text-right font-medium">{formatCurrency(data.base + data.amount)}</td>
                                        </tr>
                                    )})}
                                    <tr className="bg-gray-50 font-bold border-t border-gray-300">
                                        <td className="px-4 py-3">TOTAL</td>
                                        <td className="px-4 py-3 text-right">{formatCurrency(viewTotals.totalHT)}</td>
                                        <td className="px-4 py-3 text-right text-blue-700">{formatCurrency(viewTotals.totalTVA)}</td>
                                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(viewTotals.totalTTC)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 2. DÉTAIL DES LIGNES (POUR VÉRIFIER QUEL ARTICLE A QUEL TAUX) */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 border-l-4 border-gray-400 pl-2">Détail des lignes</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-200 text-gray-500 text-xs">
                                        <th className="py-2 pl-2">Désignation</th>
                                        <th className="py-2 text-center">Taux TVA</th>
                                        <th className="py-2 text-center">Qté</th>
                                        <th className="py-2 text-right">P.U. HT</th>
                                        <th className="py-2 text-right pr-2">Total HT</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {invoiceToView.items.map((item, idx) => {
                                        const domain = domains.find(d => d.id === item.domainId);
                                        return (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="py-2 pl-2 text-gray-800">
                                                <div 
                                                    className="font-medium cursor-pointer hover:text-blue-600 hover:underline"
                                                    onClick={() => onEditWine(item.id)}
                                                >
                                                    {item.name}
                                                </div>
                                                {domain && <div className="text-xs text-gray-500">{domain.name}</div>}
                                            </td>
                                            <td className="py-2 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[10px] border ${
                                                    (item.vatRate || 20) === 20 ? 'bg-gray-100 border-gray-200' : 'bg-orange-100 border-orange-200 text-orange-800'
                                                }`}>
                                                    {item.vatRate || 20}%
                                                </span>
                                            </td>
                                            <td className="py-2 text-center text-gray-500">{item.quantity}</td>
                                            <td className="py-2 text-right text-gray-500">{formatCurrency(item.sellingPriceHT)}</td>
                                            <td className="py-2 text-right pr-2 font-medium">{formatCurrency(item.sellingPriceHT * item.quantity)}</td>
                                        </tr>
                                    )})}
                                    {invoiceToView.shippingCost !== undefined && invoiceToView.shippingCost > 0 && (
                                        <tr className="bg-gray-50 italic">
                                            <td className="py-2 pl-2">Frais de Port</td>
                                            <td className="py-2 text-center text-xs">20%</td>
                                            <td className="py-2 text-center">1</td>
                                            <td className="py-2 text-right">{formatCurrency(invoiceToView.shippingCost)}</td>
                                            <td className="py-2 text-right pr-2">{formatCurrency(invoiceToView.shippingCost)}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <div className="bg-gray-50 p-4 border-t border-gray-200 text-right">
                    <button onClick={() => setInvoiceToView(null)} className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium">
                        Fermer
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL EDITION FACTURE (Code existant inchangé) */}
      {isEditModalOpen && invoiceToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-3">
                        <Pencil className="text-blue-600" size={24} /> 
                        {isRenaming ? (
                            <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                                <input 
                                    type="text" 
                                    className="border border-blue-300 rounded px-2 py-1 font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none w-48"
                                    value={tempId}
                                    onChange={(e) => setTempId(e.target.value)}
                                    autoFocus
                                />
                                <button onClick={handleRenumber} className="bg-green-100 text-green-700 p-1.5 rounded hover:bg-green-200" title="Valider le nouveau numéro">
                                    <Check size={18} />
                                </button>
                                <button onClick={() => setIsRenaming(false)} className="bg-red-100 text-red-700 p-1.5 rounded hover:bg-red-200" title="Annuler">
                                    <X size={18} />
                                </button>
                            </div>
                        ) : (
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2 group">
                                {invoiceToEdit.id}
                                <button 
                                    onClick={() => { setTempId(invoiceToEdit.id); setIsRenaming(true); }}
                                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 p-1 transition-opacity"
                                    title="Modifier le numéro de facture (Renumérotation)"
                                >
                                    <Pencil size={16} />
                                </button>
                            </h3>
                        )}
                    </div>
                    <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-4 bg-blue-50 text-blue-800 text-sm border-b border-blue-100 flex items-start gap-2">
                    <div className="mt-0.5"><Pencil size={16} /></div>
                    <div>
                        <strong>Modification Exceptionnelle :</strong> Vous pouvez ajuster les coordonnées, les quantités, les prix et <strong>les intitulés</strong>.<br/>
                        <span className="text-xs opacity-80">Utile pour corriger une erreur de saisie ou ajuster une prestation de service.</span>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Header Fields Edit */}
                    <div className="grid grid-cols-3 gap-6 mb-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Client</label>
                            <input 
                                type="text" 
                                className="w-full border border-gray-300 rounded px-3 py-2 text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={invoiceToEdit.clientName}
                                onChange={(e) => setInvoiceToEdit({...invoiceToEdit, clientName: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                            <input 
                                type="date" 
                                className="w-full border border-gray-300 rounded px-3 py-2 text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none h-[42px]"
                                value={(() => {
                                    const d = invoiceToEdit.invoiceDate || invoiceToEdit.date;
                                    if (!d) return '';
                                    const parts = d.split('/');
                                    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
                                    return d;
                                })()}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (!val) return;
                                    const parts = val.split('-');
                                    const newDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : val;
                                    
                                    if (invoiceToEdit.status === 'ProForma') {
                                        setInvoiceToEdit({...invoiceToEdit, date: newDate});
                                    } else {
                                        setInvoiceToEdit({...invoiceToEdit, invoiceDate: newDate});
                                    }
                                }}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Adresse</label>
                            <textarea 
                                className="w-full border border-gray-300 rounded px-3 py-2 text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none h-[42px] resize-none"
                                value={invoiceToEdit.clientAddress || ''}
                                onChange={(e) => setInvoiceToEdit({...invoiceToEdit, clientAddress: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                            <Truck size={14} /> Frais de Port (HT)
                        </label>
                        <div className="relative w-32">
                            <input 
                                type="number"
                                step="0.01"
                                className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-800"
                                value={Number.isNaN(invoiceToEdit.shippingCost) ? '' : (invoiceToEdit.shippingCost || 0)}
                                onChange={(e) => updateShippingCost(e.target.value)}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                                    <th className="px-4 py-2 w-[40%]">Désignation</th>
                                    <th className="px-4 py-2 w-20 text-center">TVA %</th>
                                    <th className="px-4 py-2 w-20 text-center">Qté</th>
                                    <th className="px-4 py-2 w-28 text-right">Prix Unit. HT</th>
                                    <th className="px-4 py-2 w-28 text-right">Total HT</th>
                                    <th className="px-4 py-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {invoiceToEdit.items.map(item => {
                                    const domain = domains.find(d => d.id === item.domainId);
                                    return (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <input 
                                                type="text" 
                                                className="w-full border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none bg-transparent font-medium text-gray-900"
                                                value={item.name}
                                                onChange={(e) => updateEditItem(item.id, 'name', e.target.value)}
                                            />
                                            {domain && <div className="text-xs text-gray-500 mt-1">{domain.name}</div>}
                                            <div className="text-xs text-gray-500 mt-1">{item.vintage} {item.color ? `• ${item.color}` : ''}</div>
                                            {item.isService && <div className="text-[10px] bg-indigo-100 text-indigo-700 px-1 rounded inline-block mt-1">Prestation</div>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                           <select 
                                              className="w-full text-center border border-gray-300 rounded py-1 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                              value={item.vatRate !== undefined ? item.vatRate : 20}
                                              onChange={(e) => updateEditItem(item.id, 'vatRate', e.target.value)}
                                           >
                                              <option value="20">20</option>
                                              <option value="10">10</option>
                                              <option value="5.5">5.5</option>
                                              <option value="0">0</option>
                                           </select>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <input 
                                                type="number" 
                                                className="w-16 text-center border border-gray-300 rounded py-1 px-2 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={Number.isNaN(item.quantity) ? '' : item.quantity}
                                                onChange={(e) => updateEditItem(item.id, 'quantity', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <input 
                                                    type="number" 
                                                    step="0.01"
                                                    className="w-24 text-right border border-gray-300 rounded py-1 px-2 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={Number.isNaN(item.sellingPriceHT) ? '' : item.sellingPriceHT}
                                                    onChange={(e) => updateEditItem(item.id, 'sellingPriceHT', e.target.value)}
                                                />
                                                <span className="text-gray-500">€</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                                            {formatCurrency(item.sellingPriceHT * item.quantity)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button 
                                                onClick={() => removeEditItem(item.id)}
                                                className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                                                title="Supprimer la ligne"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                            <tfoot>
                                <tr className="border-t border-gray-200">
                                    <td colSpan={4} className="px-4 py-3 text-left">
                                        <div className="flex items-center gap-4">
                                            <button 
                                                onClick={addEditItem}
                                                className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1"
                                            >
                                                <Plus size={16} /> Ajouter une prestation
                                            </button>
                                            <div className="h-4 w-px bg-gray-300"></div>
                                            <select 
                                                className="text-sm border border-gray-300 rounded py-1 px-2 outline-none focus:ring-2 focus:ring-blue-500 max-w-[300px]"
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        addWineItem(e.target.value);
                                                        e.target.value = '';
                                                    }
                                                }}
                                            >
                                                <option value="">+ Ajouter un vin...</option>
                                                {[...wines].sort((a, b) => a.name.localeCompare(b.name)).map(w => (
                                                    <option key={w.id} value={w.id}>{w.name} ({w.vintage})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(editTotals.ht)}</td>
                                    <td className="px-4 py-3"></td>
                                </tr>
                                <tr>
                                    <td colSpan={4} className="px-4 py-2 text-right text-gray-600">Total TVA</td>
                                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(editTotals.tva)}</td>
                                    <td className="px-4 py-2"></td>
                                </tr>
                                <tr className="bg-gray-50">
                                    <td colSpan={4} className="px-4 py-3 text-right font-bold text-gray-900">Total TTC</td>
                                    <td className="px-4 py-3 text-right font-bold text-gray-900 text-lg">{formatCurrency(editTotals.ttc)}</td>
                                    <td className="px-4 py-3"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button 
                        onClick={() => setIsEditModalOpen(false)}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
                    >
                        Annuler
                    </button>
                    <button 
                        onClick={handleEditSave}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center gap-2"
                    >
                        <Save size={18} /> Enregistrer modifications
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row justify-between items-center gap-4">
        <div className="flex p-1 bg-gray-100 rounded-lg overflow-x-auto max-w-full">
          <button onClick={() => setTab('proforma')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${tab === 'proforma' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            Pro Forma
          </button>
          <button onClick={() => setTab('invoice')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${tab === 'invoice' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            Factures
          </button>
          <button onClick={() => setTab('cancelled')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${tab === 'cancelled' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            Annulées
          </button>
          <button onClick={() => setTab('drm')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${tab === 'drm' ? 'bg-blue-600 shadow text-white' : 'text-blue-700 hover:bg-blue-50'}`}>
            <Scale size={16} /> Douanes (DRM)
          </button>
        </div>

        {tab !== 'drm' && (
          <div className="flex gap-4 w-full xl:w-auto">
              <div className="relative flex-1 xl:w-64">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                 <input 
                   type="text" 
                   placeholder="Client, N°..." 
                   className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                 />
              </div>
              
              <button 
                 onClick={() => setIsHistoricalModalOpen(true)}
                 className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium flex items-center gap-2 shadow-sm whitespace-nowrap"
                 title="Importer une ancienne facture sans déstocker"
              >
                 <FileClock size={16} /> Historique
              </button>

              <button 
                 onClick={handleExportCSV}
                 className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2 shadow-sm whitespace-nowrap"
                 title="Exporter en CSV"
              >
                 <Download size={16} /> Export Compta
              </button>
          </div>
        )}
      </div>

      {tab === 'drm' ? (
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
           <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
             <FileSpreadsheet size={20} className="text-blue-600" /> Assistant DRM (Déclaration Récapitulative Mensuelle)
           </h2>
           <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
                 <label className="text-sm font-medium text-blue-900 flex items-center gap-2">
                    <Calendar size={16} /> Mois de déclaration :
                 </label>
                 <input 
                    type="month" 
                    value={drmMonth}
                    onChange={(e) => setDrmMonth(e.target.value)}
                    className="px-3 py-1 border border-blue-200 rounded text-sm text-blue-800 font-medium outline-none focus:ring-2 focus:ring-blue-500"
                 />
              </div>
              <p className="text-xs text-blue-700 mb-4">
                 Ce tableau récapitule les mouvements de stock physiques (Entrées / Sorties / Ajustements) pour la période sélectionnée.
                 <br/><strong>Note :</strong> Les quantités sont exprimées en <em>nombre de cols (bouteilles)</em>.
              </p>
              <div className="mb-4 flex items-center gap-2 text-[10px] text-blue-600 bg-blue-100/50 p-2 rounded border border-blue-200">
                 <Info size={14} />
                 <span>Les transferts en <strong>stock déporté</strong> (chez les clients) ne sont pas comptabilisés ici. Seules les ventes facturées impactent la colonne Sorties.</span>
              </div>
              <DrmTable drmData={drmData} />
           </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
           <table className="w-full text-left min-w-[1000px]">
             <thead className="bg-gray-50 border-b border-gray-200">
               <tr>
                 <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">N°</th>
                 <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                 <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Client</th>
                 <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Total HT</th>
                 <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Total TVA</th>
                 <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Total TTC</th>
                 <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Statut</th>
                 <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Paiement</th>
                 <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-200">
               {filtered.length === 0 ? (
                 <tr><td colSpan={9} className="px-6 py-8 text-center text-gray-500 italic">Aucun document trouvé.</td></tr>
               ) : (
                 filtered.map(inv => (
                   <tr key={inv.id} className={`hover:bg-gray-50 ${inv.paymentMethod === 'Sortie Perso' ? 'bg-purple-50 hover:bg-purple-100' : ''}`}>
                      <td className="px-6 py-4 font-mono text-sm font-medium text-gray-900">
                         {inv.id}
                         {inv.paymentMethod === 'Sortie Perso' && <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] bg-purple-200 text-purple-800 font-bold">PERSO</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{inv.invoiceDate || inv.date}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 group cursor-pointer relative">
                         {inv.clientName}
                         {inv.clientId && (
                            <button 
                               onClick={(e) => { e.stopPropagation(); onEditClient(inv.clientId || null); }}
                               className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-blue-500 hover:bg-blue-50 p-1 rounded"
                               title="Voir fiche client"
                            >
                               <User size={14} />
                            </button>
                         )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatCurrency(inv.totalHT)}</td>
                      <td 
                        className="px-6 py-4 text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-right font-medium"
                        onClick={() => setInvoiceToView(inv)}
                        title="Cliquez pour voir le détail de la TVA par taux"
                      >
                        {formatCurrency(inv.totalTVA)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">{formatCurrency(inv.totalTTC)}</td>
                      <td className="px-6 py-4 text-center">
                         <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                           inv.status === 'Paid' ? 'bg-green-100 text-green-800' :
                           inv.status === 'Validated' ? 'bg-blue-100 text-blue-800' :
                           inv.status === 'Cancelled' ? 'bg-gray-100 text-gray-800 line-through' :
                           'bg-orange-100 text-orange-800'
                         }`}>
                           {inv.status === 'Paid' ? 'Payée' : inv.status === 'Validated' ? 'Validée' : inv.status === 'Cancelled' ? 'Annulée' : 'Pro Forma'}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 text-center">
                         {inv.paymentDate ? (
                            <div className="flex flex-col items-center">
                               <span className="font-medium text-gray-700">{inv.paymentDate}</span>
                               {inv.paymentMethod && <span className="text-[10px] text-gray-400 uppercase tracking-wide">{inv.paymentMethod}</span>}
                            </div>
                         ) : (
                            <span className="text-gray-300">-</span>
                         )}
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex items-center justify-end gap-2">
                            <button 
                               onClick={() => setInvoiceToView(inv)}
                               className="p-1.5 hover:bg-blue-50 rounded text-blue-500" 
                               title="Inspecter le calcul TVA"
                            >
                               <Eye size={16} />
                            </button>

                            <button 
                              onClick={() => printInvoice(inv, clients, domains, logo)}
                              className="p-1.5 hover:bg-gray-100 rounded text-gray-600" 
                              title="Imprimer"
                            >
                              <Printer size={16} />
                            </button>

                            {/* BOUTON ÉDITER - Dispo pour ProForma et Validated */}
                            {(inv.status === 'ProForma' || inv.status === 'Validated') && (
                                <button 
                                    onClick={() => handleEditClick(inv)} 
                                    className="p-1.5 hover:bg-blue-100 rounded text-blue-600" 
                                    title="Modifier le contenu / numéro"
                                >
                                    <Pencil size={16} />
                                </button>
                            )}
                            
                            {inv.status === 'ProForma' && (
                              <>
                                <button onClick={() => onUpdateStatus(inv.id, 'Validated')} className="p-1.5 hover:bg-green-100 rounded text-green-600" title="Valider en Facture">
                                  <FileBadge size={16} />
                                </button>
                                <button 
                                  onClick={() => { if(window.confirm('Voulez-vous vraiment supprimer définitivement ce Pro Forma ?')) onDeleteInvoice(inv.id); }} 
                                  className="p-1.5 hover:bg-red-100 rounded text-red-600" 
                                  title="Supprimer définitivement"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}

                            {inv.status === 'Validated' && (
                               <button onClick={() => handlePaymentClick(inv.id)} className="p-1.5 hover:bg-green-100 rounded text-green-600" title="Enregistrer paiement">
                                 <Euro size={16} />
                               </button>
                            )}
                            
                            {(inv.status === 'Validated' || inv.status === 'Paid') && (
                              <button 
                                  onClick={() => { if(window.confirm('Annuler cette facture va remettre les articles en stock. Continuer ?')) onUpdateStatus(inv.id, 'Cancelled'); }} 
                                  className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600" 
                                  title="Annuler (Avoir) et Remettre en stock"
                              >
                                <Ban size={16} />
                              </button>
                            )}

                            {inv.status === 'Cancelled' && (
                               <>
                                 <button onClick={() => onUpdateStatus(inv.id, 'ProForma')} className="p-1.5 hover:bg-orange-100 rounded text-orange-600" title="Restaurer en Pro Forma">
                                   <Undo2 size={16} />
                                 </button>
                                 <button 
                                   onClick={() => { if(window.confirm('Voulez-vous vraiment supprimer cette facture annulée ?')) onDeleteInvoice(inv.id); }} 
                                   className="p-1.5 hover:bg-red-100 rounded text-red-600" 
                                   title="Supprimer définitivement"
                                 >
                                   <Trash2 size={16} />
                                 </button>
                               </>
                            )}
                         </div>
                      </td>
                   </tr>
                 ))
               )}
             </tbody>
           </table>
        </div>
      )}
    </div>
  );
}

export default Accounting;
