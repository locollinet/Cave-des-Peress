import React, { useState, useEffect } from 'react';
import { Wine, Domain, Invoice, StockMovement, Client, CartItem, PurchaseItem, Expense, ExpenseCategory, WineColor, Asset } from './types';
import { api } from './api';
import { calculateInvoiceTotals, getBottleEquivalent } from './utils'; // Import du calculateur centralisé
import { calculateNewCump, recalculateFromHistory } from './src/services/stockService';
import { useWines } from './src/hooks/useWines';
import { usePurchases } from './src/hooks/usePurchases';
import { useInvoices } from './src/hooks/useInvoices';
import { useExpenses } from './src/hooks/useExpenses';

const DEFAULT_CATEGORIES = [
  'Achat Marchandise (Vin)',
  'Frais de Repas / Restaurant',
  'Leasing / Véhicule',
  'Carburant / Péage',
  'Téléphonie / Internet',
  'Fournitures de Bureau',
  'Loyer / Charges Locatives',
  'Assurances',
  'Honoraires / Prestations Tiers',
  'Frais Bancaires',
  'Taxes & Impôts',
  'Avoir / Remboursement Client',
  'Remboursement Fournisseur',
  'Immobilisation (Matériel / Investissement)',
  'Régularisation / Autre'
];

// Hook pour gérer le logo en local et les paramètres persistants
export const useStickyState = <T,>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const stickyValue = window.localStorage.getItem(key);
      return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
};

export const useAppController = () => {
  // Data States
  const [wines, setWines] = useState<Wine[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  
  // UI States
  const [logo, setLogo] = useStickyState<string>('', 'app_logo');
  const [isLoading, setIsLoading] = useState(true);

  // --- CHARGEMENT ---
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Pour éviter de tout bloquer si la nouvelle table 'assets' n'existe pas encore chez le client
      const fetchWines = api.fetchWines().catch(e => { console.error("Wines fetch error:", e); return []; });
      const fetchDomains = api.fetchDomains().catch(e => { console.error("Domains fetch error:", e); return []; });
      const fetchClients = api.fetchClients().catch(e => { console.error("Clients fetch error:", e); return []; });
      const fetchInvoices = api.fetchInvoices().catch(e => { console.error("Invoices fetch error:", e); return []; });
      const fetchMovements = api.fetchMovements().catch(e => { console.error("Movements fetch error:", e); return []; });
      const fetchExpenses = api.fetchExpenses().catch(e => { console.error("Expenses fetch error:", e); return []; });
      const fetchExpenseCategories = api.fetchExpenseCategories().catch(e => { console.error("Categories fetch error:", e); return []; });
      const fetchAssets = api.fetchAssets().catch(e => { 
          if (e.code === '42P01') {
              console.warn("Table 'assets' manquante. Pensez à exécuter le SQL de création.");
          } else {
              console.error("Assets fetch error:", e); 
          }
          return []; 
      });

      const [w, d, c, i, m, e, cat, a] = await Promise.all([
        fetchWines,
        fetchDomains,
        fetchClients,
        fetchInvoices,
        fetchMovements,
        fetchExpenses,
        fetchExpenseCategories,
        fetchAssets
      ]);
      
      setWines(w);
      setDomains(d);
      setClients(c);
      setInvoices(i.filter(inv => inv.status !== 'Deleted'));
      setStockMovements(m);
      setExpenses(e);
      setAssets(a);

      // Seed categories (only use seeded if fetch failed or empty)
      const currentCats = cat || [];
      if (currentCats.length === 0) {
         for (const label of DEFAULT_CATEGORIES) {
            await api.createExpenseCategory(label);
         }
         const seeded = await api.fetchExpenseCategories();
         setExpenseCategories(seeded || []);
      } else {
         setExpenseCategories(currentCats);
      }

    } catch (error) {
      console.error("Erreur chargement données:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- COMPTEURS ---
  const currentYear = new Date().getFullYear();
  const facCount = invoices.filter(i => i.id.startsWith(`FAC-${currentYear}`)).length;
  const proCount = invoices.filter(i => i.id.startsWith(`PF-${currentYear}`)).length;

  // --- BUSINESS LOGIC ---

  const handleStockUpdate = async (id: string, newStock: number, reason?: string) => {
    try {
      // Optimistic Update
      setWines(prev => prev.map(w => w.id === id ? { ...w, stock: newStock } : w));
      
      await api.updateWineStock(id, newStock);

      const wine = wines.find(w => w.id === id);
      if (wine && wine.stock !== newStock) {
          const diff = newStock - wine.stock;
          const movement: StockMovement = {
              id: `mv_adj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              date: new Date().toISOString(),
              wineId: id,
              wineName: wine.name,
              type: 'ADJUST',
              quantity: diff,
              reason: reason || 'Ajustement manuel inventaire'
          };
          await api.createMovement(movement);
          setStockMovements(prev => [movement, ...prev]);
      }
    } catch (e: any) {
      console.error(e);
      alert("Erreur mise à jour stock: " + (e.message || e));
      fetchData(); // Rollback
    }
  };

  const { handleReception } = usePurchases(wines, stockMovements, setWines, setStockMovements, fetchData);

  const handleUpdatePurchasePayment = async (provider: string, reference: string, paymentData: { date: string, method: string }, invoiceId?: string) => {
     try {
        if (invoiceId) {
            // Update invoice
            await api.updateInvoiceStatus(invoiceId, 'Paid', paymentData);
            setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, status: 'Paid', paymentDate: paymentData.date, paymentMethod: paymentData.method } : i));
        } else {
            // Update stock movements
            await api.updatePurchasePayment(provider, reference, { ...paymentData, status: 'Paid' });
            setStockMovements(prev => prev.map(m => {
               if ((m.provider || '') === provider && (m.reference || '') === reference && m.type === 'IN') {
                  return { ...m, paymentStatus: 'Paid', paymentDate: paymentData.date, paymentMethod: paymentData.method };
               }
               return m;
            }));
        }
        return true;
     } catch(e: any) {
        console.error(e);
        alert("Erreur maj paiement : " + e.message);
        return false;
     }
  };

  const handleUpdateReceptionShippingCost = async (provider: string, reference: string, date: string, newShippingCostHT: number) => {
    try {
      const norm = (val: string | null | undefined) => (val || "").trim().toLowerCase();
      const refMatches = (r1: string | null | undefined, r2: string | null | undefined) => {
         const norm1 = norm(r1);
         const norm2 = norm(r2);
         if (norm1 === norm2) return true;
         const is1Empty = !norm1 || norm1 === "sans ref" || norm1 === "sans-ref";
         const is2Empty = !norm2 || norm2 === "sans ref" || norm2 === "sans-ref";
         return is1Empty && is2Empty;
      };

      // Find the related invoice in a tolerant way
      let relatedInvoice = invoices.find(i => 
          (i.type || '').toLowerCase() === 'purchase' && 
          norm(i.clientName) === norm(provider) && 
          (refMatches(i.paymentReference, reference) || i.date === date)
      );

      // Fallback by provider and date check
      if (!relatedInvoice) {
         relatedInvoice = invoices.find(i => {
            if ((i.type || '').toLowerCase() !== 'purchase' || norm(i.clientName) !== norm(provider)) return false;
            let iDate = i.date;
            if (iDate.includes('T')) {
                const parts = iDate.split('T')[0].split('-');
                iDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            return iDate === date || i.date === date;
         });
      }

      const movementIds = relatedInvoice ? (relatedInvoice.items || []).map(item => (item as any).movementId).filter(Boolean) : [];

      // 1. Find all IN movements for this invoice
      const invoiceMovements = stockMovements.filter(m => {
        if (m.type !== 'IN') return false;
        
        // Link via direct movementId stored in items (extremely reliable)
        if (movementIds.length > 0 && movementIds.includes(m.id)) {
           return true;
        }

        if (norm(m.provider) !== norm(provider)) return false;

        const dateObj = new Date(m.date);
        let mDateStr = m.date;
        if (!isNaN(dateObj.getTime())) {
            const isoString = dateObj.toISOString();
            const [year, month, day] = isoString.split('T')[0].split('-');
            mDateStr = `${day}/${month}/${year}`;
        }

        const isSameDate = mDateStr === date || m.date === date;
        return isSameDate && refMatches(m.reference, reference);
      });

      if (invoiceMovements.length === 0) {
        console.warn(`DEBUG: No stock movements found for provider=${provider}, ref=${reference}, date=${date}. Skipping auto-split.`);
        return false;
      }

      // 2. Calculate total bottle equivalents for this invoice
      const totalEquivalents = invoiceMovements.reduce((sum, m) => {
        const currentWine = wines.find(w => w.id === m.wineId);
        const format = currentWine?.format || 'Bouteille (75cl)';
        return sum + (m.quantity * getBottleEquivalent(format));
      }, 0);

      // 3. Prepare updates
      const updatedMovementsMap = new Map<string, StockMovement>();
      const affectedWineIds = new Set<string>();

      for (const m of invoiceMovements) {
        const currentWine = wines.find(w => w.id === m.wineId);
        const format = currentWine?.format || 'Bouteille (75cl)';
        const itemEquivalents = m.quantity * getBottleEquivalent(format);
        const itemShippingCost = totalEquivalents > 0 ? (newShippingCostHT / totalEquivalents) * itemEquivalents : 0;

        const lineHT = (m.price || 0) * m.quantity + itemShippingCost;
        const vatRate = m.vatRate || 20;
        const lineTVA = lineHT * (vatRate / 100);

        updatedMovementsMap.set(m.id, { ...m, shippingCost: itemShippingCost, tva: lineTVA });
        affectedWineIds.add(m.wineId);
        
        // Update DB
        await api.updateMovementShippingCost(m.id, itemShippingCost, lineTVA);
      }

      // 4. Recalculate CUMP for affected wines
      const winesToUpdate: Wine[] = [];
      const allMovementsUpdated = stockMovements.map(m => updatedMovementsMap.has(m.id) ? updatedMovementsMap.get(m.id)! : m);

      for (const wineId of affectedWineIds) {
        const currentWine = wines.find(w => w.id === wineId);
        if (!currentWine) continue;

        // Use stockService to recalculate CUMP from history since we changed a historical value (shipping)
        const wineHistory = allMovementsUpdated.filter(m => m.wineId === wineId);
        const { stock, buyingPriceHT } = recalculateFromHistory(currentWine, wineHistory);

        winesToUpdate.push({
          ...currentWine,
          stock: stock,
          buyingPriceHT: buyingPriceHT
        });
      }

      // 5. Update wines in DB
      for (const w of winesToUpdate) {
        await api.updateWine(w);
      }

      // 6. Update Invoice totals
      if (relatedInvoice) {
          const totals = calculateInvoiceTotals(relatedInvoice.items, newShippingCostHT);
          await api.updateInvoice({
              ...relatedInvoice,
              shippingCost: newShippingCostHT,
              totalHT: totals.totalHT,
              totalTVA: totals.totalTVA,
              totalTTC: totals.totalTTC
          });
      }

      // 7. Refresh local state
      await fetchData();
      return true;

    } catch (e: any) {
      console.error(e);
      alert("Erreur lors de la mise à jour des frais de port : " + (e.message || e));
      return false;
    }
  };

  const normalize = (s: string | null | undefined) => (s || "").trim().toLowerCase();

  const handleUpdateReceptionItem = async (movementsToUpdate: { id: string, wineId?: string, newPrice?: number, newQuantity?: number, newVatRate?: number, newDate?: string, newProvider?: string, newReference?: string }[], context?: { provider: string, reference: string, invoiceId?: string }) => {
    try {
      const affectedWineIds = new Set<string>();
      const affectedInvoices = new Set<string>();
      const updatedMovementsMap = new Map<string, StockMovement>();
      const orphanUpdatesMap = new Map<string, any>();

      console.log("DEBUG: handleUpdateReceptionItem started. Context:", context, "Updates:", movementsToUpdate);

      for (const update of movementsToUpdate) {
        const matchesRef = (ref1: string | null | undefined, ref2: string | null | undefined) => {
           const r1 = (ref1 || "").trim().toLowerCase();
           const r2 = (ref2 || "").trim().toLowerCase();
           if (r1 === r2) return true;
           const is1Empty = !r1 || r1 === 'sans ref' || r1 === 'sans-ref';
           const is2Empty = !r2 || r2 === 'sans ref' || r2 === 'sans-ref';
           return is1Empty && is2Empty;
        };

        // 1. Recherche par ID direct (le plus fiable)
        let move = stockMovements.find(m => m.id === update.id);
        
        // 2. Recherche par fallback si non trouvé (cas des vieilles données)
        if (!move && context) {
            console.warn("Movement not found by ID, attempting contextual fallback...", update.id);
            const normCtxProv = normalize(context.provider);
            
            move = stockMovements.find(m => 
                m.type === 'IN' && 
                (m.wineId === update.id || m.wineId === update.wineId) &&
                normalize(m.provider) === normCtxProv &&
                matchesRef(m.reference, context.reference)
            );
        }

        if (move && move.type === 'IN') {
           let updated = false;
           const newMove = { ...move };
           const dbUpdates: any = {};
           
           if (update.newPrice !== undefined && move.price !== update.newPrice) {
               newMove.price = update.newPrice;
               dbUpdates.price = update.newPrice;
               updated = true;
           }
           if (update.newQuantity !== undefined && move.quantity !== update.newQuantity) {
               newMove.quantity = update.newQuantity;
               dbUpdates.quantity = update.newQuantity;
               updated = true;
           }
           if (update.newVatRate !== undefined && move.vatRate !== update.newVatRate) {
               newMove.vatRate = update.newVatRate;
               dbUpdates.vatRate = update.newVatRate;
               updated = true;
           }
           
           // DATE NORMALIZATION
           if (update.newDate !== undefined && move.date !== update.newDate) {
               let dateToSave = update.newDate;
               if (dateToSave.includes('/')) {
                   const parts = dateToSave.split('/');
                   if (parts.length === 3) {
                       dateToSave = `${parts[2]}-${parts[1]}-${parts[0]}`;
                   }
               }
               newMove.date = dateToSave;
               dbUpdates.date = dateToSave;
               updated = true;
           }

           if (update.newProvider !== undefined && move.provider !== update.newProvider) {
               newMove.provider = update.newProvider;
               dbUpdates.provider = update.newProvider;
               updated = true;
           }
           if (update.newReference !== undefined && move.reference !== update.newReference) {
               newMove.reference = update.newReference;
               dbUpdates.reference = update.newReference;
               updated = true;
           }

           if (updated) {
               const lineHT = (newMove.price || 0) * newMove.quantity + (newMove.shippingCost || 0);
               const vatRate = newMove.vatRate || 20;
               const lineTVA = lineHT * (vatRate / 100);
               
               newMove.tva = lineTVA;
               dbUpdates.tva = lineTVA;

               updatedMovementsMap.set(move.id, newMove);
               affectedWineIds.add(move.wineId);
               
               // Link to related purchase invoice
               const relatedInvoice = invoices.find(i => 
                  (i.type || '').toLowerCase() === 'purchase' && 
                  (
                    (normalize(i.clientName) === normalize(context?.provider || move.provider) && matchesRef(i.paymentReference, context?.reference || move.reference)) || 
                    i.id === move.reason || (move.reason && move.reason.includes(i.id)) ||
                    i.id === context?.invoiceId
                  )
               );
               if (relatedInvoice) {
                   affectedInvoices.add(relatedInvoice.id);
                   console.log(`DEBUG: Found related invoice ${relatedInvoice.id} for movement ${move.id}`);
               }

               await api.updateMovement(move.id, dbUpdates);
           }
        } else {
            if (context && context.invoiceId) { affectedInvoices.add(context.invoiceId); orphanUpdatesMap.set(update.id, update); } else { console.error("CRITICAL: Movement still not found or wrong type.", update.id); alert(`Impossible de localiser la ligne d'achat pour l'ID: ${update.id}. Contactez le support.`); }
        }
      }
      
      // Update affected invoices
      for (const invId of affectedInvoices) {
         const inv = invoices.find(i => i.id === invId);
         if (!inv) continue;

         let invoiceUpdated = false;
         let newClientName = inv.clientName;
         let newRef = inv.paymentReference;
         let newDate = inv.date;

         const newItems = inv.items.map(item => {
            // Find updated movement for this item
            const movementUpdate = Array.from(updatedMovementsMap.values()).find(m => {
               // 1. Strong match via movementId
               if (item.movementId && m.id === item.movementId) return true;
               
               // 2. Fallback: match by wineId and OLD provider/ref/date (contextual search)
               // This is for legacy data where movementId was not stored in the invoice item
               const originalMove = stockMovements.find(sm => sm.id === m.id);
               if (!originalMove) return false;

               return originalMove.wineId === item.id && 
                      normalize(originalMove.provider) === normalize(inv.clientName) && 
                      normalize(originalMove.reference) === normalize(inv.paymentReference);
                      // removed date check as it might be slightly different in ISO vs local
            });
            
            if (movementUpdate) {
               invoiceUpdated = true;
               // If the header changed in any movement of this invoice, update the invoice header
               if (movementUpdate.provider && movementUpdate.provider !== inv.clientName) newClientName = movementUpdate.provider;
               if (movementUpdate.reference && movementUpdate.reference !== inv.paymentReference) newRef = movementUpdate.reference;
               
               let normalizedInvDate = inv.date;
               console.log("DEBUG: Original Inv Date:", normalizedInvDate);
               if (normalizedInvDate && normalizedInvDate.includes('/')) {
                   const parts = normalizedInvDate.split('/');
                   if (parts.length === 3) {
                       normalizedInvDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                   }
               }
               console.log("DEBUG: Normalized Inv Date:", normalizedInvDate, "MovementUpdate Date:", movementUpdate.date);
               if (movementUpdate.date && movementUpdate.date !== normalizedInvDate) {
                    console.log("DEBUG: Updating Date! Original:", normalizedInvDate, "Target:", movementUpdate.date);
                    newDate = movementUpdate.date;
               } else if (movementUpdate.date && movementUpdate.date === normalizedInvDate) {
                    console.log("DEBUG: Dates are the same, no update needed.");
               } else {
                    console.log("DEBUG: MovementUpdate Date is missing or doesn't trigger change.", movementUpdate.date);
               }

               return {
                  ...item,
                  quantity: movementUpdate.quantity,
                  buyingPriceHT: movementUpdate.price,
                  sellingPriceHT: movementUpdate.price, 
                  purchasePriceHT: movementUpdate.price,
                  vatRate: movementUpdate.vatRate,
                   movementId: movementUpdate.id // Upgrade legacy items to store the ID!
               };
            }
            const orphanUpdate = orphanUpdatesMap.get(item.movementId) || orphanUpdatesMap.get(item.id);
            if (orphanUpdate) {
                invoiceUpdated = true;
                if (orphanUpdate.newProvider && orphanUpdate.newProvider !== inv.clientName) newClientName = orphanUpdate.newProvider;
                if (orphanUpdate.newReference && orphanUpdate.newReference !== inv.paymentReference) newRef = orphanUpdate.newReference;
                let normalizedInvDate = inv.date;
                if (normalizedInvDate && normalizedInvDate.includes('/')) {
                    const parts = normalizedInvDate.split('/');
                    if (parts.length === 3) normalizedInvDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
                if (orphanUpdate.newDate && orphanUpdate.newDate !== normalizedInvDate) newDate = orphanUpdate.newDate;

                return {
                    ...item,
                    quantity: orphanUpdate.newQuantity !== undefined ? orphanUpdate.newQuantity : item.quantity,
                    buyingPriceHT: orphanUpdate.newPrice !== undefined ? orphanUpdate.newPrice : item.buyingPriceHT,
                    sellingPriceHT: orphanUpdate.newPrice !== undefined ? orphanUpdate.newPrice : item.sellingPriceHT,
                    purchasePriceHT: orphanUpdate.newPrice !== undefined ? orphanUpdate.newPrice : (item as any).purchasePriceHT,
                    vatRate: orphanUpdate.newVatRate !== undefined ? orphanUpdate.newVatRate : item.vatRate
                };
            }
            return item;
         });

         if (invoiceUpdated) {
            const totals = calculateInvoiceTotals(newItems, inv.shippingCost || 0);
            await api.updateInvoice({
               ...inv,
               clientName: newClientName,
               paymentReference: newRef,
               date: newDate,
               invoiceDate: newDate,
               items: newItems,
               totalHT: totals.totalHT,
               totalTVA: totals.totalTVA,
               totalTTC: totals.totalTTC
            });
         }
      }
      
      // Recalculate CUMP for affected wines
      const winesToUpdate: Wine[] = [];
      const allMovementsUpdated = stockMovements.map(m => updatedMovementsMap.has(m.id) ? updatedMovementsMap.get(m.id)! : m);

      for (const wineId of affectedWineIds) {
        const currentWine = wines.find(w => w.id === wineId);
        if (!currentWine) continue;

        // Use stockService to recalculate CUMP from history
        const wineHistory = allMovementsUpdated.filter(m => m.wineId === wineId);
        const { stock, buyingPriceHT } = recalculateFromHistory(currentWine, wineHistory);

        winesToUpdate.push({
          ...currentWine,
          stock: stock,
          buyingPriceHT: buyingPriceHT
        });
      }

      // Update wines in DB
      for (const w of winesToUpdate) {
        await api.updateWine(w);
      }

      // Refresh local state
      await fetchData();
      return true;

    } catch(e: any) {
       console.error(e);
       alert("Erreur mise à jour réception: " + (e.message || e));
       fetchData(); 
       return false;
    }
  };

  const handleCancelReception = async (movementsToCancel: StockMovement[]) => {
    try {
      const affectedWineIds = new Set<string>();
      const canceledMovementIds = new Set<string>();

      for (const move of movementsToCancel) {
        if (move.type === 'IN') {
           canceledMovementIds.add(move.id);
           affectedWineIds.add(move.wineId);
           await api.deleteMovement(move.id);
        }
      }
      
      // Recalculate CUMP for affected wines
      const winesToUpdate: Wine[] = [];
      const allMovementsUpdated = stockMovements.filter(m => !canceledMovementIds.has(m.id));

      for (const wineId of affectedWineIds) {
        const currentWine = wines.find(w => w.id === wineId);
        if (!currentWine) continue;

        // Use stockService to recalculate CUMP from history
        const wineHistory = allMovementsUpdated.filter(m => m.wineId === wineId);
        const { stock, buyingPriceHT } = recalculateFromHistory(currentWine, wineHistory);

        winesToUpdate.push({
          ...currentWine,
          stock: stock,
          buyingPriceHT: buyingPriceHT
        });
      }

      // Update wines in DB
      for (const w of winesToUpdate) {
        await api.updateWine(w);
      }

      // Delete the related purchase invoice if it exists
      if (movementsToCancel.length > 0) {
          const firstMove = movementsToCancel[0];
          const relatedInvoice = invoices.find(i => 
              (i.type || '').toLowerCase() === 'purchase' && 
              i.clientName === firstMove.provider && 
              i.paymentReference === firstMove.reference
          );
          if (relatedInvoice) {
              await api.deleteInvoice(relatedInvoice.id);
          }
      }

      // Refresh local state
      await fetchData();
      return true;

    } catch(e: any) {
       console.error(e);
       alert("Erreur annulation réception: " + e.message);
       fetchData(); 
       return false;
    }
  };

  const { handleAddProduct, handleUpdateProduct, handleDeleteProduct, handleToggleArchive: originalHandleToggleArchive } = useWines(setWines, invoices, stockMovements);
  const handleToggleArchive = (id: string) => originalHandleToggleArchive(id, wines);

  const handleAddDomain = async (newDomain: Domain) => {
    try {
      await api.createDomain(newDomain);
      setDomains(prev => [...prev, newDomain]);
    } catch(e: any) {
        console.error(e);
        alert("Erreur ajout domaine: " + (e.message || e));
    }
  };


  const handleUpdateDomain = async (id: string, updates: Partial<Domain>) => {
     try {
       await api.updateDomain(id, updates);
       setDomains(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
     } catch(e: any) { 
        console.error(e); 
        alert("Erreur modification domaine: " + (e.message || e));
     }
  }

  const handleDeleteDomain = async (id: string) => {
    const winesLinked = wines.filter(w => w.domainId === id);
    if (winesLinked.length > 0) {
      alert(`Impossible de supprimer ce domaine : ${winesLinked.length} vin(s) y sont rattachés. Supprimez ou modifiez ces vins d'abord.`);
      return;
    }

    if (!window.confirm("Êtes-vous sûr de vouloir supprimer définitivement ce domaine ?")) {
      return;
    }

    try {
      await api.deleteDomain(id);
      setDomains(prev => prev.filter(d => d.id !== id));
    } catch(e: any) {
      console.error(e);
      alert("Erreur suppression domaine: " + (e.message || e));
    }
  };

  const handleClientUpdate = async (updatedClient: Client) => {
    try {
      await api.updateClient(updatedClient);
      setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
    } catch(e: any) { 
        console.error(e);
        alert("Erreur mise à jour client: " + (e.message || e));
    }
  };

  const handleAddClient = async (newClient: Client) => {
    try {
      await api.createClient(newClient);
      setClients(prev => [...prev, newClient]);
    } catch(e: any) { 
        console.error(e); 
        throw e;
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      const hasInvoices = invoices.some(i => i.clientId === clientId);
      if (hasInvoices) {
        alert("Impossible de supprimer ce client : il est lié à des factures ou des devis existants. Veuillez d'abord archiver ou supprimer ces documents.");
        return;
      }

      const client = clients.find(c => c.id === clientId);
      if (client && client.externalStock.length > 0) {
        if(!window.confirm("Ce client possède encore du stock déporté. La suppression effacera ces données de stock. Continuer ?")) {
          return;
        }
      } else {
        if(!window.confirm("Êtes-vous sûr de vouloir supprimer définitivement ce client ?")) {
          return;
        }
      }

      await api.deleteClient(clientId);
      setClients(prev => prev.filter(c => c.id !== clientId));

    } catch (e: any) {
      console.error(e);
      alert("Erreur suppression client: " + (e.message || e));
    }
  };

  const handleBulkStockTransfer = async (clientId: string, transfers: { wineId: string, quantity: number }[], direction: 'deposit' | 'return') => {
     const client = clients.find(c => c.id === clientId);
     if (!client) return;

     let newClientStock = [...client.externalStock];
     const movements: StockMovement[] = [];
     const winesToUpdate: Wine[] = [];

     for (const transfer of transfers) {
         const wine = wines.find(w => w.id === transfer.wineId);
         if (!wine) continue;

         const existingItemIndex = newClientStock.findIndex(i => i.wineId === transfer.wineId);
         let nextWineStock = wine.stock;
         let reason = '';

         if (direction === 'deposit') {
            nextWineStock = wine.stock - transfer.quantity;
            if (existingItemIndex >= 0) {
               newClientStock[existingItemIndex].quantity += transfer.quantity;
            } else {
               newClientStock.push({ wineId: transfer.wineId, quantity: transfer.quantity });
            }
            reason = `Dépôt chez ${client.name}`;
         } else {
            nextWineStock = wine.stock + transfer.quantity;
            if (existingItemIndex >= 0) {
               newClientStock[existingItemIndex].quantity = newClientStock[existingItemIndex].quantity - transfer.quantity;
               if (newClientStock[existingItemIndex].quantity === 0) {
                  newClientStock.splice(existingItemIndex, 1);
               }
            }
            reason = `Retour dépôt ${client.name}`;
         }

         winesToUpdate.push({ ...wine, stock: nextWineStock });
         movements.push({
             id: `mv_${direction}_${Date.now()}_${transfer.wineId}_${Math.random().toString(36).substr(2, 5)}`,
             date: new Date().toISOString(),
             wineId: wine.id,
             wineName: wine.name,
             type: 'TRANSFER',
             quantity: transfer.quantity,
             reason
         });
     }

     try {
       for (const w of winesToUpdate) {
           await api.updateWineStock(w.id, w.stock);
       }
       await api.updateClient({ ...client, externalStock: newClientStock });
       await api.createMovements(movements);

       setWines(prev => prev.map(w => {
           const updated = winesToUpdate.find(u => u.id === w.id);
           return updated ? updated : w;
       }));
       setClients(prev => prev.map(c => c.id === clientId ? { ...c, externalStock: newClientStock } : c));
       setStockMovements(prev => [...movements, ...prev]);
     } catch(e: any) { 
         console.error(e); 
         alert("Erreur transfert stock: " + (e.message || e));
     }
  };

  const handleStockTransfer = async (clientId: string, wineId: string, quantity: number, direction: 'deposit' | 'return') => {
     await handleBulkStockTransfer(clientId, [{ wineId, quantity }], direction);
  };

  // NOUVEAU: Import Facture Historique (Sans Mouvement Stock)
  const handleImportHistoricalInvoice = async (invoiceData: Invoice) => {
    try {
        let clientId = invoiceData.clientId;
        if (!clientId) {
          const existingClient = clients.find(c => c.name.toLowerCase() === invoiceData.clientName.toLowerCase());
          if (existingClient) {
             clientId = existingClient.id;
          } else {
             // Create new client
             const newClient: Client = {
                id: `client_${Date.now()}`,
                name: invoiceData.clientName,
                externalStock: []
             };
             await api.createClient(newClient);
             setClients(prev => [...prev, newClient]);
             clientId = newClient.id;
          }
        }
        
        const finalInvoice = { ...invoiceData, clientId };
        await api.createInvoice(finalInvoice);
        setInvoices(prev => [finalInvoice, ...prev]);
        return true;
    } catch (e: any) {
        console.error(e);
        alert("Erreur lors de l'import historique : " + e.message);
        return false;
    }
  };

  // UPDATE: Ajout du paramètre shippingCost
  const handleCreateInvoice = async (clientName: string, items: CartItem[], type: 'ProForma' | 'Invoice', forceClientId?: string, shippingCost: number = 0) => {
    let clientId = forceClientId;
    const dateNow = new Date();
    
    try {
        if (!clientId) {
          const existingClient = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
          if (existingClient) {
            clientId = existingClient.id;
          } else {
            const newId = `cli_${Date.now()}`;
            const newClient: Client = { id: newId, name: clientName, externalStock: [] };
            await handleAddClient(newClient);
            clientId = newId;
          }
        }

        // --- CALCUL CENTRALISÉ DES TOTAUX ---
        const totals = calculateInvoiceTotals(items, shippingCost);
        // ------------------------------------

        const prefix = type === 'Invoice' ? 'FAC' : 'PF';
        const yearStr = currentYear.toString();
        const pattern = new RegExp(`^${prefix}-${yearStr}-(\\d{4})$`);
        
        let maxNum = 0;
        invoices.forEach(inv => {
          const match = inv.id.match(pattern);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        });

        const nextNum = maxNum + 1;
        const invoiceId = `${prefix}-${yearStr}-${String(nextNum).padStart(4, '0')}`;
        const dateStr = dateNow.toLocaleDateString('fr-FR');

        let clientAddress = '';
        if (clientId) {
          const client = clients.find(c => c.id === clientId);
          if (client) {
            clientAddress = client.address || '';
          }
        }

        const newInvoice: Invoice = {
          id: invoiceId,
          date: dateStr,
          invoiceDate: type === 'Invoice' ? dateStr : undefined,
          clientName,
          clientId,
          clientAddress,
          items,
          type: 'Sale',
          status: type === 'Invoice' ? 'Validated' : 'ProForma',
          totalHT: totals.totalHT,
          totalTVA: totals.totalTVA,
          totalTTC: totals.totalTTC,
          discount: 0,
          shippingCost: totals.shippingCost
        };

        await api.createInvoice(newInvoice);
        setInvoices(prev => [newInvoice, ...prev]);

        // CRITIQUE: Filtrer les prestations (isService) pour ne pas déstocker
        const mainStockItems = items.filter(i => !i.fromExternalStock && !i.isService);
        const externalStockItems = items.filter(i => i.fromExternalStock && !i.isService);

        for (const item of mainStockItems) {
            const currentWine = wines.find(w => w.id === item.id);
            if (currentWine) {
                const nextStock = currentWine.stock - item.quantity;
                await api.updateWineStock(item.id, nextStock);
                setWines(prev => prev.map(w => w.id === item.id ? { ...w, stock: nextStock } : w));

                await api.createMovement({
                    id: `mv_${Date.now()}_${item.id}_${Math.random().toString(36).substr(2, 5)}`,
                    date: new Date().toISOString(),
                    wineId: item.id,
                    wineName: item.name,
                    type: 'OUT',
                    quantity: item.quantity,
                    reason: `Vente ${invoiceId}`
                });
            }
        }

        if (clientId && externalStockItems.length > 0) {
            const client = clients.find(c => c.id === clientId);
            if (client) {
                const newExternalStock = client.externalStock.map(s => {
                    const soldItem = externalStockItems.find(i => i.id === s.wineId);
                    if (soldItem) {
                    return { ...s, quantity: s.quantity - soldItem.quantity };
                    }
                    return s;
                });

                await handleClientUpdate({ ...client, externalStock: newExternalStock });
                
                for (const item of externalStockItems) {
                    await api.createMovement({
                        id: `mv_ext_${Date.now()}_${item.id}_${Math.random().toString(36).substr(2, 5)}`,
                        date: new Date().toISOString(),
                        wineId: item.id,
                        wineName: item.name,
                        type: 'OUT',
                        quantity: item.quantity,
                        reason: `Vente Stock Déporté ${invoiceId}`
                    });
                }
            }
        }
        
        const m = await api.fetchMovements();
        setStockMovements(m);
        
        return true;

    } catch(e: any) { 
        console.error(e);
        alert("ERREUR CRITIQUE lors de la création : " + (e.message || e));
        return false;
    }
  };

  const handleUpdateInvoice = async (invoice: Invoice) => {
      try {
          // --- CALCUL CENTRALISÉ DES TOTAUX ---
          const totals = calculateInvoiceTotals(invoice.items, invoice.shippingCost || 0);
          // ------------------------------------

          const updatedInvoice = {
              ...invoice,
              totalHT: totals.totalHT,
              totalTVA: totals.totalTVA,
              totalTTC: totals.totalTTC
          };

          const oldInvoice = invoices.find(i => i.id === invoice.id);
          if (oldInvoice) {
              const oldItems = oldInvoice.items.filter(i => !i.isService);
              const newItems = updatedInvoice.items.filter(i => !i.isService);

              const getItemKey = (i: CartItem) => i.id + '_' + !!i.fromExternalStock;
              const oldItemsMap = new Map(oldItems.map(i => [getItemKey(i), i]));
              const newItemsMap = new Map(newItems.map(i => [getItemKey(i), i]));

              for (const oldItem of oldItems) {
                  const newItem = newItemsMap.get(getItemKey(oldItem));
                  const oldQty = oldItem.quantity;
                  const newQty = newItem ? newItem.quantity : 0;
                  const diff = oldQty - newQty; 

                  if (diff !== 0) {
                      if (oldItem.fromExternalStock) {
                          const client = clients.find(c => c.id === invoice.clientId);
                          if (client) {
                              const newExternalStock = client.externalStock.map(s => {
                                  if (s.wineId === oldItem.id) {
                                      return { ...s, quantity: s.quantity + diff };
                                  }
                                  return s;
                              });
                              await handleClientUpdate({ ...client, externalStock: newExternalStock });
                              
                              await api.createMovement({
                                  id: `mv_ext_adj_${Date.now()}_${oldItem.id}_${Math.random().toString(36).substr(2, 5)}`,
                                  date: new Date().toISOString(),
                                  wineId: oldItem.id,
                                  wineName: oldItem.name,
                                  type: diff > 0 ? 'IN' : 'OUT',
                                  quantity: Math.abs(diff),
                                  reason: `Ajustement Facture ${invoice.id}`
                              });
                          }
                      } else {
                          const currentWine = wines.find(w => w.id === oldItem.id);
                          if (currentWine) {
                              const nextStock = currentWine.stock + diff;
                              await api.updateWineStock(oldItem.id, nextStock);
                              setWines(prev => prev.map(w => w.id === oldItem.id ? { ...w, stock: nextStock } : w));

                              await api.createMovement({
                                  id: `mv_adj_${Date.now()}_${oldItem.id}_${Math.random().toString(36).substr(2, 5)}`,
                                  date: new Date().toISOString(),
                                  wineId: oldItem.id,
                                  wineName: oldItem.name,
                                  type: diff > 0 ? 'IN' : 'OUT',
                                  quantity: Math.abs(diff),
                                  reason: `Ajustement Facture ${invoice.id}`
                              });
                          }
                      }
                  }
              }

              for (const newItem of newItems) {
                  const itemKey = newItem.id + '_' + !!newItem.fromExternalStock;
                  if (!oldItemsMap.has(itemKey)) {
                      const diff = -newItem.quantity;
                      if (newItem.fromExternalStock) {
                          const client = clients.find(c => c.id === invoice.clientId);
                          if (client) {
                              const newExternalStock = client.externalStock.map(s => {
                                  if (s.wineId === newItem.id) {
                                      return { ...s, quantity: s.quantity + diff };
                                  }
                                  return s;
                              });
                              await handleClientUpdate({ ...client, externalStock: newExternalStock });
                              
                              await api.createMovement({
                                  id: `mv_ext_adj_${Date.now()}_${newItem.id}_${Math.random().toString(36).substr(2, 5)}`,
                                  date: new Date().toISOString(),
                                  wineId: newItem.id,
                                  wineName: newItem.name,
                                  type: 'OUT',
                                  quantity: Math.abs(diff),
                                  reason: `Ajustement Facture ${invoice.id}`
                              });
                          }
                      } else {
                          const currentWine = wines.find(w => w.id === newItem.id);
                          if (currentWine) {
                              const nextStock = currentWine.stock + diff;
                              await api.updateWineStock(newItem.id, nextStock);
                              setWines(prev => prev.map(w => w.id === newItem.id ? { ...w, stock: nextStock } : w));

                              await api.createMovement({
                                  id: `mv_adj_${Date.now()}_${newItem.id}_${Math.random().toString(36).substr(2, 5)}`,
                                  date: new Date().toISOString(),
                                  wineId: newItem.id,
                                  wineName: newItem.name,
                                  type: 'OUT',
                                  quantity: Math.abs(diff),
                                  reason: `Ajustement Facture ${invoice.id}`
                              });
                          }
                      }
                  }
              }
          }

          await api.updateInvoice(updatedInvoice);
          setInvoices(prev => prev.map(i => i.id === invoice.id ? updatedInvoice : i));
          
          if (oldInvoice && oldInvoice.status !== 'ProForma') {
              const m = await api.fetchMovements();
              setStockMovements(m);
          }
          
          return true;
      } catch (e: any) {
          console.error(e);
          alert("Erreur mise à jour facture: " + (e.message || e));
          return false;
      }
  };

  const handleRenumberInvoice = async (oldId: string, newId: string) => {
      try {
          await api.renumberInvoice(oldId, newId);
          setInvoices(prev => prev.map(i => i.id === oldId ? { ...i, id: newId } : i));
          setStockMovements(prev => prev.map(m => ({
              ...m,
              reason: m.reason ? m.reason.replace(oldId, newId) : m.reason
          })));
          return true;
      } catch (e: any) {
          console.error(e);
          alert("Erreur renumérotation : " + e.message);
          return false;
      }
  };

  const handleInvoiceStatusUpdate = async (
    id: string, 
    newStatus: Invoice['status'], 
    paymentDetails?: { date: string, method: string, reference?: string }
  ) => {
    try {
      const invoiceToUpdate = invoices.find(i => i.id === id);

      // --- LOGIQUE AUTOMATIQUE DE TRANSITION PF -> FAC ---
      // Si l'ID est 'PF-...' et qu'on Valide ou Paie, on génère un nouveau numéro FAC
      if (invoiceToUpdate && invoiceToUpdate.id.startsWith('PF') && (newStatus === 'Validated' || newStatus === 'Paid')) {
         
         const yearStr = currentYear.toString();
         const prefix = `FAC-${yearStr}`;
         const pattern = new RegExp(`^${prefix}-(\\d{4})$`);

         let maxNum = 0;
         invoices.forEach(inv => {
           const match = inv.id.match(pattern);
           if (match) {
             const num = parseInt(match[1], 10);
             if (num > maxNum) maxNum = num;
           }
         });

         const nextNum = maxNum + 1;
         const newInvoiceId = `${prefix}-${String(nextNum).padStart(4, '0')}`;
         const todayStr = new Date().toLocaleDateString('fr-FR');

         // 1. Mise à jour en base : Changement d'ID (api.renumberInvoice)
         // Note: Cette fonction met aussi à jour les mouvements de stock associés !
         await api.renumberInvoice(id, newInvoiceId);

         // 2. Mise à jour en base : Changement de Status + Date sur le NOUVEL ID
         const updatedInvoiceObj: Invoice = {
            ...invoiceToUpdate,
            id: newInvoiceId,
            status: newStatus,
            invoiceDate: todayStr, // La date légale devient la date de validation
            paymentDate: paymentDetails?.date,
            paymentMethod: paymentDetails?.method,
            paymentReference: paymentDetails?.reference
         };

         await api.updateInvoice(updatedInvoiceObj);
         if (paymentDetails) {
             await api.updateInvoiceStatus(newInvoiceId, newStatus, paymentDetails);
         } else {
             await api.updateInvoiceStatus(newInvoiceId, newStatus);
         }

         // 3. Mise à jour du State Local
         setInvoices(prev => prev.map(i => i.id === id ? updatedInvoiceObj : i));
         
         // 4. Mise à jour locale des mouvements de stock (le backend est déjà fait par renumberInvoice, mais le state local doit suivre)
         setStockMovements(prev => prev.map(m => ({
             ...m,
             reason: m.reason ? m.reason.replace(id, newInvoiceId) : m.reason
         })));

         return;
      }


      // --- LOGIQUE STANDARD D'ANNULATION ---
      if (newStatus === 'Cancelled') {
        const invoice = invoices.find(i => i.id === id);
        if (invoice && invoice.status !== 'Cancelled' && invoice.items.length > 0) {
            const isPurchase = invoice.type?.toLowerCase() === 'purchase';
            
            // Ignorer les prestations lors de la remise en stock
            const mainItems = invoice.items.filter(i => !i.fromExternalStock && !i.isService);
            for (const item of mainItems) {
               const wine = wines.find(w => w.id === item.id);
               if (wine) {
                 // Si Achat -> On retire (-) car l'entrée est annulée
                 // Si Vente -> On remet (+) car la sortie est annulée
                 const delta = isPurchase ? -item.quantity : item.quantity;
                 const restoredStock = wine.stock + delta;
                 await api.updateWineStock(wine.id, restoredStock);
                 
                 await api.createMovement({
                   id: `mv_cancel_${Date.now()}_${item.id}_${Math.random().toString(36).substr(2, 5)}`,
                   date: new Date().toISOString(),
                   wineId: item.id,
                   wineName: item.name,
                   type: delta > 0 ? 'IN' : 'OUT',
                   quantity: Math.abs(delta),
                   reason: `Annulation Facture ${invoice.id}`
                 });

                 setWines(prev => prev.map(w => w.id === wine.id ? { ...w, stock: restoredStock } : w));
               }
            }

            const externalItems = invoice.items.filter(i => i.fromExternalStock && !i.isService);
            if (externalItems.length > 0 && invoice.clientId) {
               const client = clients.find(c => c.id === invoice.clientId);
               if (client) {
                 let updatedExternalStock = [...client.externalStock];
                 
                 for (const item of externalItems) {
                    const existingIdx = updatedExternalStock.findIndex(s => s.wineId === item.id);
                    const delta = isPurchase ? -item.quantity : item.quantity;

                    if (existingIdx >= 0) {
                       updatedExternalStock[existingIdx].quantity += delta;
                    } else if (delta > 0) {
                       updatedExternalStock.push({ wineId: item.id, quantity: delta });
                    }

                    await api.createMovement({
                        id: `mv_cancel_ext_${Date.now()}_${item.id}_${Math.random().toString(36).substr(2, 5)}`,
                        date: new Date().toISOString(),
                        wineId: item.id,
                        wineName: item.name,
                        type: delta > 0 ? 'IN' : 'OUT',
                        quantity: Math.abs(delta),
                        reason: `Annulation Facture Déporté ${invoice.id}`
                    });
                 }

                 await api.updateClient({ ...client, externalStock: updatedExternalStock });
                 setClients(prev => prev.map(c => c.id === client.id ? { ...c, externalStock: updatedExternalStock } : c));
               }
            }

            const m = await api.fetchMovements();
            setStockMovements(m);
        }
      }

      // --- MISE À JOUR STANDARD (Autres cas) ---
      await api.updateInvoiceStatus(id, newStatus, paymentDetails);
      setInvoices(prev => prev.map(i => i.id === id ? { 
        ...i, 
        status: newStatus, 
        paymentDate: paymentDetails?.date,
        paymentMethod: paymentDetails?.method,
        paymentReference: paymentDetails?.reference
      } : i));

    } catch(e: any) { 
        console.error(e); 
        alert("Erreur mise à jour statut: " + (e.message || e));
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    const invoice = invoices.find(i => i.id === id);
    if (!invoice) return;

    try {
        console.log(`DEBUG: Starting deletion of invoice ${id}`);
        
        let physicalDeleted = false;
        try {
            await api.deleteInvoice(id);
            physicalDeleted = true;
            console.log(`DEBUG: Physical deletion success for ${id}`);
        } catch (apiError: any) {
            console.warn(`DEBUG: Physical deletion failed (possibly RLS), falling back to Soft Delete:`, apiError);
            // Fallback soft delete (update the invoice status to 'Deleted')
            await api.updateInvoice({
                ...invoice,
                status: 'Deleted'
            });
            console.log(`DEBUG: Soft deletion success for ${id}`);
        }

        // 2. STOCK RESTORATION ONLY AFTER SUCCESS (Physical or Soft)
        if (invoice.status !== 'Cancelled' && invoice.status !== 'Deleted' && invoice.status !== 'SoftDeleted') {
            const isPurchase = invoice.type?.toLowerCase() === 'purchase';
            const mainItems = invoice.items.filter(i => !i.fromExternalStock && !i.isService);
            
            for (const item of mainItems) {
                const wine = wines.find(w => w.id === item.id);
                if (wine) {
                    const delta = isPurchase ? -item.quantity : item.quantity;
                    const restoredStock = wine.stock + delta;
                    
                    await api.updateWineStock(wine.id, restoredStock);
                    
                    await api.createMovement({
                        id: `mv_del_${Date.now()}_${item.id}_${Math.random().toString(36).substr(2, 5)}`,
                        date: new Date().toISOString(),
                        wineId: item.id,
                        wineName: item.name,
                        type: delta > 0 ? 'IN' : 'OUT',
                        quantity: Math.abs(delta),
                        reason: `Suppression définitive ${invoice.id}`
                    });
                }
            }

            const externalItems = invoice.items.filter(i => i.fromExternalStock && !i.isService);
            if (externalItems.length > 0 && invoice.clientId) {
                const client = clients.find(c => c.id === invoice.clientId);
                if (client) {
                    const updatedStock = [...client.externalStock];
                    for (const item of externalItems) {
                        const idx = updatedStock.findIndex(s => s.wineId === item.id);
                        const delta = isPurchase ? -item.quantity : item.quantity;
                        
                        if (idx >= 0) {
                            updatedStock[idx].quantity += delta;
                        } else if (delta > 0) {
                            updatedStock.push({ wineId: item.id, quantity: delta });
                        }

                        await api.createMovement({
                            id: `mv_del_ext_${Date.now()}_${item.id}_${Math.random().toString(36).substr(2, 5)}`,
                            date: new Date().toISOString(),
                            wineId: item.id,
                            wineName: item.name,
                            type: delta > 0 ? 'IN' : 'OUT',
                            quantity: Math.abs(delta),
                            reason: `Suppression définitive déporté ${invoice.id}`
                        });
                    }
                    await handleClientUpdate({ ...client, externalStock: updatedStock });
                }
            }
        }
        
        // Final refresh
        fetchData();
        return true;
    } catch (e: any) {
        console.error("ERROR during invoice deletion:", e);
        alert("Impossible de supprimer cette facture. Elle est peut-être liée à d'autres données ou le serveur a refusé la requête. " + (e.message || e));
        return false;
    }
  };

  const handleAddExpense = async (expense: Expense) => {
    try {
      await api.upsertExpense(expense);
      fetchData(); // S'assurer que tout est à jour (expenses, immo, bilan)
    } catch(e: any) {
      console.error(e);
      alert("Erreur lors de l'enregistrement de la dépense : " + (e.message || e));
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if(!window.confirm("Supprimer cette dépense ?")) return;
    try {
      await api.deleteExpense(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch(e: any) {
      console.error(e);
      alert("Erreur suppression dépense : " + (e.message || e));
    }
  };

  const handleAddCategory = async (label: string) => {
    try {
      await api.createExpenseCategory(label);
      const cats = await api.fetchExpenseCategories();
      setExpenseCategories(cats);
    } catch(e: any) {
      console.error(e);
      alert("Erreur ajout catégorie : " + (e.message || e));
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if(!window.confirm("Supprimer cette catégorie ?")) return;
    try {
      await api.deleteExpenseCategory(id);
      setExpenseCategories(prev => prev.filter(c => c.id !== id));
    } catch(e: any) {
      console.error(e);
      alert("Erreur suppression catégorie : " + (e.message || e));
    }
  }

  const handleAddAsset = async (asset: Asset) => {
    try {
      const existing = assets.find(a => a.id === asset.id);
      if (existing) {
        await api.updateAsset(asset);
        setAssets(prev => prev.map(a => a.id === asset.id ? asset : a));
      } else {
        await api.createAsset(asset);
        setAssets(prev => [asset, ...prev]);
      }
    } catch(e: any) {
      console.error(e);
      alert("Erreur enregistrement immo : " + (e.message || e));
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if(!window.confirm("Supprimer cette immobilisation ?")) return;
    try {
      await api.deleteAsset(id);
      setAssets(prev => prev.filter(a => a.id !== id));
      setExpenses(prev => prev.map(e => e.assetId === id ? { ...e, assetId: undefined } : e));
    } catch(e: any) {
      console.error(e);
      alert("Erreur suppression immo : " + (e.message || e));
    }
  };

  return {
    data: { wines, domains, invoices, clients, stockMovements, expenses, expenseCategories, assets, facCount, proCount, logo },
    actions: {
      handleStockUpdate, handleAddProduct, handleUpdateProduct, handleDeleteProduct, handleToggleArchive,
      handleUpdateDomain, handleAddDomain, handleDeleteDomain,
      handleClientUpdate, handleAddClient, handleDeleteClient, handleStockTransfer, handleBulkStockTransfer, handleCreateInvoice, handleUpdateInvoice, handleRenumberInvoice, handleImportHistoricalInvoice,
      handleReception, handleUpdatePurchasePayment, handleCancelReception, handleUpdateReceptionItem: (updates: any, context?: any) => handleUpdateReceptionItem(updates, context), handleUpdateReceptionShippingCost,
      handleInvoiceStatusUpdate, handleDeleteInvoice, handleAddExpense, handleDeleteExpense, handleAddCategory, handleDeleteCategory, handleAddAsset, handleDeleteAsset, setWines, setLogo
    }
  };
};
