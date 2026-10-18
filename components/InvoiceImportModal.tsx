import React, { useState, useMemo, useRef } from 'react';
import { 
  X, Upload, FileText, Sparkles, CheckCircle2, AlertTriangle, 
  HelpCircle, ArrowRight, RefreshCw, Plus, Check, Eye, Trash2,
  Layers, Package, Building2, ChevronDown, Search
} from 'lucide-react';
import { Wine, Domain, PurchaseItem } from '../types';
import { formatCurrency, getColorBadgeClass, getSmartCoefficient } from '../utils';
import { 
  ParsedInvoiceData, 
  ParsedInvoiceItem, 
  reconcileInvoiceItem, 
  normalizeString 
} from '../src/utils/invoiceReconciliation';

interface InvoiceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  wines: Wine[];
  domains: Domain[];
  onAddDomain?: (domain: Domain) => Promise<void>;
  onAddProduct?: (wine: Wine, domainName?: string, domainCoef?: number, domainRegion?: string) => Promise<void>;
  onConfirmPurchaseDirect?: (data: {
    provider: string;
    reference: string;
    purchaseDate: string;
    shippingCostHT: number;
    items: PurchaseItem[];
  }) => Promise<boolean>;
  onApplyToCart: (data: {
    provider: string;
    reference: string;
    purchaseDate: string;
    shippingCostHT: number;
    items: PurchaseItem[];
  }) => void;
}

export const InvoiceImportModal: React.FC<InvoiceImportModalProps> = ({
  isOpen,
  onClose,
  wines,
  domains,
  onAddDomain,
  onAddProduct,
  onConfirmPurchaseDirect,
  onApplyToCart
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // Parsed invoice state
  const [invoiceData, setInvoiceData] = useState<ParsedInvoiceData | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'exact' | 'vintage_variant' | 'new' | 'ignore'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Custom new domain input state when creating inline
  const [newDomainNames, setNewDomainNames] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:application/pdf;base64, prefix
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile) return;
    
    // Check file type
    const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');
    const isImage = selectedFile.type.startsWith('image/');
    
    if (!isPdf && !isImage) {
      alert("Veuillez sélectionner un fichier PDF ou une image (PNG, JPG).");
      return;
    }

    setFile(selectedFile);
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const base64Data = await fileToBase64(selectedFile);
      const mimeType = selectedFile.type || (isPdf ? 'application/pdf' : 'image/jpeg');

      const response = await fetch('/api/parse-invoice-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: base64Data,
          mimeType
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Erreur serveur HTTP ${response.status}`);
      }

      const result = await response.json();
      const rawData = result.data;

      if (!rawData || !Array.isArray(rawData.items) || rawData.items.length === 0) {
        throw new Error("Aucune ligne de facture n'a pu être extraite. Vérifiez la lisibilité du document.");
      }

      // Run local reconciliation engine on all items against current database
      const reconciledItems: ParsedInvoiceItem[] = rawData.items.map((item: any) => 
        reconcileInvoiceItem(item, wines, domains)
      );

      setInvoiceData({
        provider: rawData.provider || '',
        invoiceNumber: rawData.invoiceNumber || '',
        invoiceDate: rawData.invoiceDate || new Date().toISOString().split('T')[0],
        shippingCostHT: Number(rawData.shippingCostHT) || 0,
        totalHT: Number(rawData.totalHT) || 0,
        totalTTC: Number(rawData.totalTTC) || 0,
        items: reconciledItems
      });

    } catch (err: any) {
      console.error("Erreur d'analyse facture:", err);
      setAnalysisError(err.message || "Impossible d'analyser le document. Vérifiez votre clé API Gemini ou le format du fichier.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRetryAnalysis = () => {
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Batch apply coefficient to newly created items
  const handleApplyGlobalCoef = (targetCoef: number) => {
    if (!invoiceData) return;
    setInvoiceData({
      ...invoiceData,
      items: invoiceData.items.map(item => {
        if (item.action === 'create_new_wine' || item.action === 'create_new_vintage') {
          const bp = item.customBuyingPriceHT || item.unitPriceHT || 0;
          return {
            ...item,
            customCoefficient: targetCoef,
            customSellingPriceHT: Math.round(bp * targetCoef * 100) / 100
          };
        }
        return item;
      })
    });
  };

  // Reapply smart sommelier tiers (<70€ -> 1.2, >=70€ -> 1.1 or domain coefficient)
  const handleApplySmartCoefToAll = () => {
    if (!invoiceData) return;
    setInvoiceData({
      ...invoiceData,
      items: invoiceData.items.map(item => {
        if (item.action === 'create_new_wine' || item.action === 'create_new_vintage') {
          const bp = item.customBuyingPriceHT || item.unitPriceHT || 0;
          const dom = domains.find(d => d.id === item.selectedDomainId);
          const coeff = dom?.coefficient && dom.coefficient > 0 ? dom.coefficient : getSmartCoefficient(bp);
          return {
            ...item,
            customCoefficient: coeff,
            customSellingPriceHT: Math.round(bp * coeff * 100) / 100
          };
        }
        return item;
      })
    });
  };

  // Update item field
  const updateItem = (itemId: string, updates: Partial<ParsedInvoiceItem>) => {
    if (!invoiceData) return;
    setInvoiceData({
      ...invoiceData,
      items: invoiceData.items.map(item => {
        if (item.id === itemId) {
          const updated = { ...item, ...updates };
          
          // If action changed to match_existing, check wineId
          if (updates.matchedWineId) {
            const matched = wines.find(w => w.id === updates.matchedWineId);
            if (matched) {
              updated.selectedDomainId = matched.domainId;
            }
          }

          // Recalculate selling price if buying price or coefficient changed
          if (updates.customBuyingPriceHT !== undefined || updates.customCoefficient !== undefined || updates.unitPriceHT !== undefined) {
            const bp = updates.customBuyingPriceHT !== undefined ? updates.customBuyingPriceHT : (updates.unitPriceHT !== undefined ? updates.unitPriceHT : updated.customBuyingPriceHT || updated.unitPriceHT || 0);
            const dom = domains.find(d => d.id === updated.selectedDomainId);
            const defaultCoef = dom?.coefficient && dom.coefficient > 0 ? dom.coefficient : getSmartCoefficient(bp);
            const coef = updates.customCoefficient !== undefined ? updates.customCoefficient : (updated.customCoefficient || defaultCoef);
            updated.customCoefficient = coef;
            updated.customBuyingPriceHT = bp;
            updated.customSellingPriceHT = Math.round(bp * coef * 100) / 100;
          }

          // Recalculate total line HT if quantity or unit price changed
          if (updates.quantity !== undefined || updates.unitPriceHT !== undefined) {
            const q = updates.quantity !== undefined ? updates.quantity : updated.quantity;
            const p = updates.unitPriceHT !== undefined ? updates.unitPriceHT : updated.unitPriceHT;
            updated.totalHT = Math.round(q * p * 100) / 100;
          }

          return updated;
        }
        return item;
      })
    });
  };

  // Check if a proposed new wine duplicate already exists in the catalog
  const checkForDuplicate = (item: ParsedInvoiceItem) => {
    if (item.action === 'match_existing' || item.action === 'ignore') return null;

    const targetDomainId = item.selectedDomainId;
    const targetName = normalizeString(item.customWineName || item.wineName);
    const targetVintage = normalizeString(item.customVintage || item.vintage);

    const existingMatch = wines.find(w => {
      if (w.isArchived) return false;
      const sameDomain = targetDomainId ? w.domainId === targetDomainId : false;
      const sameName = normalizeString(w.name) === targetName;
      const sameVintage = normalizeString(w.vintage) === targetVintage;
      return sameDomain && sameName && sameVintage;
    });

    return existingMatch || null;
  };

  // Filtered items
  const filteredItems = useMemo(() => {
    if (!invoiceData) return [];
    return invoiceData.items.filter(item => {
      const matchesSearch = searchTerm === '' ||
        item.rawText.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.wineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.domainName.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (activeFilter === 'all') return true;
      if (activeFilter === 'exact') return item.action === 'match_existing';
      if (activeFilter === 'vintage_variant') return item.action === 'create_new_vintage';
      if (activeFilter === 'new') return item.action === 'create_new_wine';
      if (activeFilter === 'ignore') return item.action === 'ignore';
      return true;
    });
  }, [invoiceData, activeFilter, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    if (!invoiceData) return { total: 0, matched: 0, newVintages: 0, newWines: 0, ignored: 0, totalHT: 0, totalBottles: 0 };
    let matched = 0;
    let newVintages = 0;
    let newWines = 0;
    let ignored = 0;
    let totalHT = 0;
    let totalBottles = 0;

    invoiceData.items.forEach(item => {
      if (item.action === 'ignore') {
        ignored++;
      } else {
        if (item.action === 'match_existing') matched++;
        else if (item.action === 'create_new_vintage') newVintages++;
        else if (item.action === 'create_new_wine') newWines++;

        totalHT += (item.quantity * item.unitPriceHT);
        totalBottles += item.quantity;
      }
    });

    return {
      total: invoiceData.items.length,
      matched,
      newVintages,
      newWines,
      ignored,
      totalHT,
      totalBottles
    };
  }, [invoiceData]);

  // Submit and inject into Reception cart or confirm reception directly
  const handleConfirmImport = async (directValidation: boolean = true) => {
    if (!invoiceData) return;
    setIsSubmitting(true);

    try {
      const activeItems = invoiceData.items.filter(i => i.action !== 'ignore');
      if (activeItems.length === 0) {
        alert("Aucun vin sélectionné pour l'import.");
        setIsSubmitting(false);
        return;
      }

      const cartItemsToCreate: PurchaseItem[] = [];

      // Process each item
      for (const item of activeItems) {
        if (item.action === 'match_existing' && item.matchedWineId) {
          const existingWine = wines.find(w => w.id === item.matchedWineId);
          if (existingWine) {
            cartItemsToCreate.push({
              ...existingWine,
              quantity: item.quantity,
              purchasePriceHT: item.unitPriceHT,
              vatRate: item.vatRate || 20
            });
          }
        } else if (item.action === 'create_new_wine' || item.action === 'create_new_vintage') {
          // Resolve domain
          let targetDomainId = item.selectedDomainId;

          // If domain does not exist, create domain first
          if (!targetDomainId || targetDomainId === 'NEW_DOMAIN') {
            const domainName = newDomainNames[item.id] || item.domainName || invoiceData.provider || 'Nouveau Domaine';
            const generatedDomainId = `dom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const newDomainObj: Domain = {
              id: generatedDomainId,
              name: domainName,
              region: item.customRegion || 'Bourgogne',
              coefficient: item.customCoefficient || 1.2,
              isArchived: false
            };

            if (onAddDomain) {
              await onAddDomain(newDomainObj);
            }
            targetDomainId = generatedDomainId;
          }

          const buyingPrice = Number(item.unitPriceHT) || 0;
          const dom = domains.find(d => d.id === targetDomainId);
          const defaultCoeff = dom?.coefficient && dom.coefficient > 0 ? dom.coefficient : getSmartCoefficient(buyingPrice);
          const coeff = Number(item.customCoefficient) || defaultCoeff;
          const sellingPrice = item.customSellingPriceHT || (Math.round(buyingPrice * coeff * 100) / 100);

          const targetWineName = (item.customWineName || item.wineName).trim();
          const targetVintage = (item.customVintage || item.vintage || '').trim();

          // Check if this wine already exists to prevent duplicate zero-stock clones
          const existingSame = wines.find(w => 
            !w.isArchived &&
            w.domainId === targetDomainId &&
            normalizeString(w.name) === normalizeString(targetWineName) &&
            normalizeString(w.vintage) === normalizeString(targetVintage)
          );

          let resolvedWineObj: Wine;
          if (existingSame) {
            resolvedWineObj = {
              ...existingSame,
              buyingPriceHT: buyingPrice,
              sellingPriceHT: sellingPrice,
              coefficient: coeff
            };
          } else {
            const newWineId = `wine_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            resolvedWineObj = {
              id: newWineId,
              domainId: targetDomainId,
              name: targetWineName,
              vintage: targetVintage,
              color: (item.customColor as any) || 'Rouge',
              format: (item.customFormat as any) || 'Bouteille (75cl)',
              buyingPriceHT: buyingPrice,
              sellingPriceHT: sellingPrice,
              coefficient: coeff,
              stock: 0,
              region: item.customRegion || dom?.region || 'Bourgogne',
              subRegion: item.customSubRegion || '',
              isArchived: false
            };

            if (onAddProduct) {
              await onAddProduct(resolvedWineObj);
            }
          }

          cartItemsToCreate.push({
            ...resolvedWineObj,
            quantity: item.quantity,
            purchasePriceHT: item.unitPriceHT,
            vatRate: item.vatRate || 20
          });
        }
      }

      if (directValidation && onConfirmPurchaseDirect) {
        const ok = await onConfirmPurchaseDirect({
          provider: invoiceData.provider || 'Fournisseur Inconnu',
          reference: invoiceData.invoiceNumber || '',
          purchaseDate: invoiceData.invoiceDate || new Date().toISOString().split('T')[0],
          shippingCostHT: invoiceData.shippingCostHT || 0,
          items: cartItemsToCreate
        });
        if (ok) {
          onClose();
        }
      } else {
        // Apply to Reception form
        onApplyToCart({
          provider: invoiceData.provider || 'Fournisseur Inconnu',
          reference: invoiceData.invoiceNumber || '',
          purchaseDate: invoiceData.invoiceDate || new Date().toISOString().split('T')[0],
          shippingCostHT: invoiceData.shippingCostHT || 0,
          items: cartItemsToCreate
        });
        onClose();
      }
    } catch (err: any) {
      console.error("Erreur lors de l'application de la facture:", err);
      alert("Une erreur est survenue : " + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Import & Analyse IA de Facture d'Achat</h2>
                <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Gemini 3.7
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Extraction automatique, réconciliation avec vos références et protection anti-doublon
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">

          {/* UPLOAD / DROPZONE STATE (When no data yet or re-uploading) */}
          {!invoiceData && (
            <div className="max-w-2xl mx-auto py-8">
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                  isDragging 
                    ? 'border-blue-500 bg-blue-50/50 scale-[1.01]' 
                    : 'border-slate-300 hover:border-blue-400 bg-white hover:bg-blue-50/20 shadow-xs'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  accept=".pdf,image/*" 
                  className="hidden" 
                />

                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center space-y-4 py-6">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
                      <Sparkles className="w-6 h-6 text-blue-600 absolute inset-0 m-auto animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-bold text-slate-900">Analyse IA de la facture en cours...</p>
                      <p className="text-xs text-slate-500">Extraction du fournisseur, des cuvées, millésimes, quantités et tarifs HT</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
                      <Upload size={28} />
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-800">
                        Glissez-déposez votre facture fournisseur ou bon de livraison
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Formats supportés : PDF, PNG, JPG (jusqu'à 30 Mo)
                      </p>
                    </div>
                    <button 
                      type="button" 
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors inline-flex items-center gap-2"
                    >
                      <FileText size={16} /> Parcourir un fichier
                    </button>
                  </div>
                )}
              </div>

              {analysisError && (
                <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <strong className="font-semibold">Erreur d'analyse :</strong> {analysisError}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {file && (
                        <button 
                          onClick={handleRetryAnalysis}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                        >
                          <RefreshCw size={13} />
                          Réessayer l'analyse ({file.name})
                        </button>
                      )}
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs underline font-semibold text-red-800 hover:text-red-900"
                      >
                        Sélectionner un autre document
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RECONCILIATION WORKSPACE */}
          {invoiceData && (
            <div className="space-y-5">
              
              {/* DOCUMENT META HEADER */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Fournisseur / Domaine
                  </label>
                  <input 
                    type="text" 
                    value={invoiceData.provider} 
                    onChange={e => setInvoiceData({ ...invoiceData, provider: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Nom du fournisseur"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    N° Facture / BL
                  </label>
                  <input 
                    type="text" 
                    value={invoiceData.invoiceNumber} 
                    onChange={e => setInvoiceData({ ...invoiceData, invoiceNumber: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="ex: FA-2024-089"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Date Facture / Réception
                  </label>
                  <input 
                    type="date" 
                    value={invoiceData.invoiceDate} 
                    onChange={e => setInvoiceData({ ...invoiceData, invoiceDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Frais de Port HT (€)
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={invoiceData.shippingCostHT} 
                    onChange={e => setInvoiceData({ ...invoiceData, shippingCostHT: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* SOMMELIER COEFFICIENT & PRICING BAR */}
              <div className="bg-gradient-to-r from-amber-50/80 via-white to-blue-50/80 p-3.5 sm:p-4 rounded-xl border border-amber-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start md:items-center gap-2.5">
                  <div className="p-2 bg-amber-500/10 text-amber-700 rounded-lg shrink-0">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <span>Coefficients & Prix de Vente HT des nouvelles cuvées</span>
                      <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold border border-amber-200">
                        Grille Sommelier
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Règle automatique : Domaine prioritaire, sinon &lt; 70€ = <strong>1.20</strong>, ≥ 70€ = <strong>1.10</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 mr-1">Appliquer à tous :</span>
                  <button
                    type="button"
                    onClick={handleApplySmartCoefToAll}
                    className="px-2.5 py-1 bg-white hover:bg-amber-100/70 border border-amber-300 rounded-lg text-xs font-bold text-amber-900 shadow-2xs transition-colors"
                    title="Réappliquer la règle intelligente sommelier selon les paliers de prix et domaines"
                  >
                    Auto (Sommelier)
                  </button>
                  {[1.2, 1.3, 1.4, 1.5].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleApplyGlobalCoef(c)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 shadow-2xs transition-colors"
                    >
                      x{c.toFixed(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* STATS & FILTER TABS */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl overflow-x-auto text-xs font-semibold">
                  <button
                    onClick={() => setActiveFilter('all')}
                    className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                      activeFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Toutes les lignes ({stats.total})
                  </button>
                  <button
                    onClick={() => setActiveFilter('exact')}
                    className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      activeFilter === 'exact' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <CheckCircle2 size={13} /> Rapprochées ({stats.matched})
                  </button>
                  <button
                    onClick={() => setActiveFilter('vintage_variant')}
                    className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      activeFilter === 'vintage_variant' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-700 hover:bg-amber-50'
                    }`}
                  >
                    <Layers size={13} /> Nouveaux millésimes ({stats.newVintages})
                  </button>
                  <button
                    onClick={() => setActiveFilter('new')}
                    className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      activeFilter === 'new' ? 'bg-blue-600 text-white shadow-2xs' : 'text-blue-700 hover:bg-blue-50'
                    }`}
                  >
                    <Plus size={13} /> Nouvelles réf ({stats.newWines})
                  </button>
                  <button
                    onClick={() => setActiveFilter('ignore')}
                    className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                      activeFilter === 'ignore' ? 'bg-slate-700 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Ignorées ({stats.ignored})
                  </button>
                </div>

                {/* SEARCH FILTER */}
                <div className="relative min-w-[220px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Filtrer les lignes..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* RECONCILED ITEMS LIST */}
              <div className="space-y-3">
                {filteredItems.map((item, index) => {
                  const duplicateWarning = checkForDuplicate(item);
                  const matchedWine = item.matchedWineId ? wines.find(w => w.id === item.matchedWineId) : undefined;
                  const matchedDomain = item.selectedDomainId ? domains.find(d => d.id === item.selectedDomainId) : undefined;

                  return (
                    <div 
                      key={item.id}
                      className={`bg-white rounded-xl border transition-all p-4 shadow-2xs ${
                        item.action === 'ignore' 
                          ? 'opacity-50 border-slate-200 bg-slate-50' 
                          : duplicateWarning 
                            ? 'border-amber-300 bg-amber-50/30 ring-1 ring-amber-300' 
                            : item.action === 'match_existing'
                              ? 'border-emerald-200 bg-emerald-50/10'
                              : item.action === 'create_new_vintage'
                                ? 'border-amber-200 bg-amber-50/10'
                                : 'border-blue-200 bg-blue-50/10'
                      }`}
                    >
                      {/* Top row: Raw designation & Action selector */}
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              #{index + 1}
                            </span>
                            <span className="text-xs font-semibold text-slate-800">
                              Désignation facture : <span className="font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-bold">{item.rawText}</span>
                            </span>
                          </div>
                        </div>

                        {/* Action buttons segmented toggle */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-lg self-start lg:self-auto text-xs font-medium">
                          <button
                            type="button"
                            onClick={() => updateItem(item.id, { action: 'match_existing' })}
                            className={`px-2.5 py-1 rounded-md transition-all ${
                              item.action === 'match_existing'
                                ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            🔗 Associer existant
                          </button>
                          <button
                            type="button"
                            onClick={() => updateItem(item.id, { action: 'create_new_vintage' })}
                            className={`px-2.5 py-1 rounded-md transition-all ${
                              item.action === 'create_new_vintage'
                                ? 'bg-amber-600 text-white font-bold shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            ✨ Nouveau millésime
                          </button>
                          <button
                            type="button"
                            onClick={() => updateItem(item.id, { action: 'create_new_wine' })}
                            className={`px-2.5 py-1 rounded-md transition-all ${
                              item.action === 'create_new_wine'
                                ? 'bg-blue-600 text-white font-bold shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            ➕ Nouvelle réf
                          </button>
                          <button
                            type="button"
                            onClick={() => updateItem(item.id, { action: item.action === 'ignore' ? 'match_existing' : 'ignore' })}
                            className={`px-2 py-1 rounded-md transition-all ${
                              item.action === 'ignore'
                                ? 'bg-slate-700 text-white font-bold shadow-2xs'
                                : 'text-slate-400 hover:text-slate-700'
                            }`}
                            title="Ignorer cette ligne"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* DUPLICATE WARNING ALERT */}
                      {duplicateWarning && (
                        <div className="mt-3 p-3 rounded-lg bg-amber-100/80 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={16} className="text-amber-700 shrink-0" />
                            <span>
                              <strong>Alerte doublon :</strong> Le vin <strong>{duplicateWarning.name} {duplicateWarning.vintage}</strong> existe déjà dans le catalogue (Stock actuel: {duplicateWarning.stock}).
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateItem(item.id, { action: 'match_existing', matchedWineId: duplicateWarning.id, selectedDomainId: duplicateWarning.domainId })}
                            className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-md shadow-2xs whitespace-nowrap transition-colors"
                          >
                            Associer plutôt à ce vin existant
                          </button>
                        </div>
                      )}

                      {/* Middle row: Matching & creation inputs */}
                      <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                        
                        {/* LEFT: Wine & Domain resolution (8 cols) */}
                        <div className="lg:col-span-8 space-y-3">
                          {item.action === 'match_existing' ? (
                            <div className="space-y-2">
                              <label className="block text-[11px] font-bold text-slate-500 uppercase">
                                Vin sélectionné au catalogue
                              </label>
                              <select
                                value={item.matchedWineId || ''}
                                onChange={e => updateItem(item.id, { matchedWineId: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                              >
                                <option value="">-- Sélectionner un vin du catalogue --</option>
                                {wines.filter(w => !w.isArchived).map(w => {
                                  const d = domains.find(dom => dom.id === w.domainId);
                                  return (
                                    <option key={w.id} value={w.id}>
                                      {d?.name || 'Sans Domaine'} - {w.name} {w.vintage ? `(${w.vintage})` : ''} | PA: {formatCurrency(w.buyingPriceHT)} | Stock: {w.stock}
                                    </option>
                                  );
                                })}
                              </select>
                              {matchedWine && (
                                <div className="text-xs text-slate-500 flex items-center gap-3">
                                  <span>Domaine : <strong className="text-slate-700">{matchedDomain?.name}</strong></span>
                                  <span>Stock actuel : <strong className="text-slate-700">{matchedWine.stock} btles</strong></span>
                                  <span>Dernier P.A. : <strong className="text-slate-700">{formatCurrency(matchedWine.buyingPriceHT)}</strong></span>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* CREATE NEW VINTAGE OR NEW WINE FORM */
                            <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200 space-y-3">
                              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <Sparkles size={14} className="text-blue-600" />
                                {item.action === 'create_new_vintage' ? 'Création d\'un nouveau millésime pour ce domaine' : 'Création d\'une nouvelle référence'}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {/* Domain picker */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                                    Domaine
                                  </label>
                                  <select
                                    value={item.selectedDomainId || 'NEW_DOMAIN'}
                                    onChange={e => {
                                      const val = e.target.value;
                                      const dom = domains.find(d => d.id === val);
                                      updateItem(item.id, { 
                                        selectedDomainId: val,
                                        customCoefficient: dom?.coefficient || 1.3,
                                        customRegion: dom?.region || item.customRegion || 'Bourgogne'
                                      });
                                    }}
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="NEW_DOMAIN">+ Créer nouveau domaine ({item.domainName})</option>
                                    {domains.filter(d => !d.isArchived).map(d => (
                                      <option key={d.id} value={d.id}>{d.name} ({d.region || 'Bourgogne'})</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Wine Name */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                                    Nom de la cuvée
                                  </label>
                                  <input 
                                    type="text"
                                    value={item.customWineName || ''}
                                    onChange={e => updateItem(item.id, { customWineName: e.target.value })}
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="ex: Meursault 1er Cru Charmes"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {/* Vintage */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                                    Millésime
                                  </label>
                                  <input 
                                    type="text"
                                    value={item.customVintage || ''}
                                    onChange={e => updateItem(item.id, { customVintage: e.target.value })}
                                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-900 outline-none"
                                    placeholder="2023 / NV"
                                  />
                                </div>

                                {/* Color */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                                    Couleur
                                  </label>
                                  <select
                                    value={item.customColor || 'Rouge'}
                                    onChange={e => updateItem(item.id, { customColor: e.target.value })}
                                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-xs font-medium outline-none"
                                  >
                                    <option value="Rouge">Rouge</option>
                                    <option value="Blanc">Blanc</option>
                                    <option value="Rosé">Rosé</option>
                                    <option value="Effervescent">Effervescent</option>
                                    <option value="Autre">Autre</option>
                                  </select>
                                </div>

                                {/* Format */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                                    Format
                                  </label>
                                  <select
                                    value={item.customFormat || 'Bouteille (75cl)'}
                                    onChange={e => updateItem(item.id, { customFormat: e.target.value })}
                                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-xs font-medium outline-none"
                                  >
                                    <option value="Bouteille (75cl)">Bouteille (75cl)</option>
                                    <option value="Magnum (1.5L)">Magnum (1.5L)</option>
                                    <option value="Demi-bouteille (37.5cl)">Demi-bouteille (37.5cl)</option>
                                    <option value="Jéroboam (3L)">Jéroboam (3L)</option>
                                  </select>
                                </div>

                                {/* Coefficient */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                                    Coef. Vente
                                  </label>
                                  <input 
                                    type="number"
                                    step="0.05"
                                    value={item.customCoefficient || getSmartCoefficient(item.unitPriceHT || 0)}
                                    onChange={e => updateItem(item.id, { customCoefficient: parseFloat(e.target.value) || 1.2 })}
                                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-900 outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* RIGHT: Quantities, Prices & Line Total (4 cols) */}
                        <div className="lg:col-span-4 bg-slate-50/60 p-3 rounded-lg border border-slate-200 grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                              Quantité
                            </label>
                            <input 
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => updateItem(item.id, { quantity: parseInt(e.target.value) || 0 })}
                              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-sm font-bold text-slate-900 text-center outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                              Prix Achat HT (€)
                            </label>
                            <input 
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unitPriceHT}
                              onChange={e => updateItem(item.id, { 
                                unitPriceHT: parseFloat(e.target.value) || 0,
                                customBuyingPriceHT: parseFloat(e.target.value) || 0
                              })}
                              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-sm font-bold text-slate-900 text-right outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div className="col-span-2 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                            <span className="text-slate-500 font-medium">Total Ligne HT :</span>
                            <span className="font-bold text-slate-900 text-sm">{formatCurrency(item.totalHT)}</span>
                          </div>

                          {(item.action === 'create_new_wine' || item.action === 'create_new_vintage') && (
                            <div className="col-span-2 pt-1.5 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px]">
                              <span className="text-slate-500 font-medium">Prix Vente HT calculé :</span>
                              <span className="font-bold text-blue-700">
                                {formatCurrency(item.customSellingPriceHT || (Math.round((item.unitPriceHT || 0) * (item.customCoefficient || getSmartCoefficient(item.unitPriceHT || 0)) * 100) / 100))}
                                <span className="text-[10px] font-semibold text-slate-500 ml-1">
                                  (x{(item.customCoefficient || getSmartCoefficient(item.unitPriceHT || 0)).toFixed(2)})
                                </span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* FOOTER ACTIONS */}
        {invoiceData && (
          <div className="p-4 sm:p-5 border-t border-gray-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="text-slate-600">
                Lignes à importer : <strong className="text-slate-900 font-bold">{stats.total - stats.ignored}</strong>
              </div>
              <div className="text-slate-600">
                Bouteilles totales : <strong className="text-slate-900 font-bold">{stats.totalBottles} btles</strong>
              </div>
              <div className="text-slate-600">
                Total Vins HT : <strong className="text-slate-900 font-bold text-sm">{formatCurrency(stats.totalHT)}</strong>
              </div>
              <div className="bg-blue-50 text-blue-900 px-3 py-1.5 rounded-lg border border-blue-200 font-bold text-xs">
                Total Facture HT (avec port) : {formatCurrency(stats.totalHT + (invoiceData.shippingCostHT || 0))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => {
                  setInvoiceData(null);
                  setFile(null);
                }}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Changer de fichier
              </button>
              
              <button
                type="button"
                onClick={() => handleConfirmImport(false)}
                disabled={isSubmitting || (stats.total - stats.ignored === 0)}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold rounded-xl transition-all border border-slate-300"
                title="Transfère les lignes dans le formulaire de réception sans valider tout de suite"
              >
                Pré-remplir le Bon (Brouillon)
              </button>

              <button
                type="button"
                onClick={() => handleConfirmImport(true)}
                disabled={isSubmitting || (stats.total - stats.ignored === 0)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Validation & Entrée en stock...
                  </>
                ) : (
                  <>
                    <PackageCheckIcon size={16} />
                    Valider & Entrer en Stock Immédiatement
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// Helper icon
function PackageCheckIcon(props: any) {
  return <CheckCircle2 {...props} />;
}
