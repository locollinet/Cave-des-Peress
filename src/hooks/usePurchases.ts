import { Dispatch, SetStateAction } from 'react';
import { PurchaseItem, StockMovement, Wine, Invoice } from '../../types';
import { api } from '../../api';
import { calculateNewCump } from '../services/stockService';
import { calculateInvoiceTotals, getBottleEquivalent } from '../../utils';

export const usePurchases = (
  wines: Wine[],
  stockMovements: StockMovement[],
  setWines: Dispatch<SetStateAction<Wine[]>>,
  setStockMovements: Dispatch<SetStateAction<StockMovement[]>>,
  fetchData: () => Promise<void>
) => {
  
  const handleReception = async (provider: string, reference: string, items: PurchaseItem[], date?: string, shippingCostHT: number = 0, impactStock: boolean = true) => {
    const movementsToCreate: StockMovement[] = [];
    const winesToUpdate: Wine[] = [];
    
    let now = new Date().toISOString();
    if (date) {
        try {
            if (date.includes('/')) {
                const parts = date.split('/');
                if (parts.length === 2) {
                    // MM/YYYY format
                    const [month, year] = parts;
                    now = `${year}-${month.padStart(2, '0')}-01T12:00:00.000Z`;
                } else if (parts.length === 3) {
                    // DD/MM/YYYY format
                    const [day, month, year] = parts;
                    now = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00.000Z`;
                } else {
                    now = `${date}T12:00:00.000Z`;
                }
            } else {
                // YYYY-MM-DD or YYYY-MM format
                if (date.includes('T')) {
                    now = date; // Already an ISO string
                } else if (date.split('-').length === 2) {
                    now = `${date}-01T12:00:00.000Z`;
                } else {
                    now = `${date}T12:00:00.000Z`;
                }
            }
            
            // Validate the date by creating a Date object. If it's invalid, it will throw.
            if (isNaN(new Date(now).getTime())) {
                throw new Error("Invalid date");
            }
        } catch (e) {
            console.warn("Invalid date format, using current date", date);
            now = new Date().toISOString();
        }
    }
    
    // 1. Prepare Data Logic
    console.log("DEBUG: handleReception started. Provider:", provider, "Reference:", reference, "Items:", items.length, "ImpactStock:", impactStock);
    const itemToMovementId = new Map<string, string>();

    const totalEquivalents = items.reduce((sum, item) => {
        const currentWine = wines.find(w => w.id === item.id);
        const format = currentWine?.format || 'Bouteille (75cl)';
        return sum + (item.quantity * getBottleEquivalent(format));
    }, 0);

    for (const item of items) {
      const currentWine = wines.find(w => w.id === item.id);
      if (currentWine) {
        const movementId = `mv_in_${crypto.randomUUID()}`;
        itemToMovementId.set(item.id, movementId);

        const format = currentWine.format || 'Bouteille (75cl)';
        const itemEquivalents = item.quantity * getBottleEquivalent(format);
        const itemShippingCost = totalEquivalents > 0 ? (shippingCostHT / totalEquivalents) * itemEquivalents : 0;

        const newMovement: StockMovement = {
          id: movementId, 
          date: now,
          wineId: item.id,
          wineName: item.name,
          type: 'IN',
          quantity: item.quantity,
          reason: impactStock ? `Réception Fournisseur` : `Rétro-documentation (Sans Impact Stock)`,
          price: item.purchasePriceHT,
          vatRate: item.vatRate || 20,
          tva: (item.purchasePriceHT * item.quantity + itemShippingCost) * ((item.vatRate || 20) / 100),
          provider: provider.trim(),
          reference: reference.trim(),
          paymentStatus: 'Pending',
          shippingCost: itemShippingCost, 
          impactStock: impactStock
        };
        movementsToCreate.push(newMovement);

        const { stock, buyingPriceHT } = calculateNewCump(currentWine, newMovement);

        winesToUpdate.push({
          ...currentWine,
          stock: stock,
          buyingPriceHT: buyingPriceHT
        });
      }
    }

    // 2. Execution
    console.log("DEBUG: handleReception preparing to call API. Movements:", movementsToCreate.length);
    try {
      await api.createMovements(movementsToCreate);
      console.log("DEBUG: createMovements successful.");
      await Promise.all(winesToUpdate.map(w => api.updateWine(w)));
      console.log("DEBUG: updateWine successful.");
      
      // Create invoice for all purchases
      console.log("DEBUG: Creating invoice for purchase.");
      const itemsWithPrice = items.map(item => ({
          ...item,
          sellingPriceHT: item.purchasePriceHT,
          isGift: false,
          healthInfo: undefined,
          fromExternalStock: false,
          isService: false,
          movementId: itemToMovementId.get(item.id)
      }));
      const totals = calculateInvoiceTotals(itemsWithPrice, shippingCostHT, 0);
      
      const newInvoice: Invoice = {
          id: `inv_pur_${reference}_${Date.now()}`,
          date: now,
          invoiceDate: now,
          clientName: provider,
          items: itemsWithPrice,
          totalHT: totals.totalHT,
          totalTVA: totals.totalTVA,
          totalTTC: totals.totalTTC,
          discount: 0,
          shippingCost: shippingCostHT,
          status: 'Validated',
          type: 'Purchase',
          paymentReference: reference.trim()
      };
      console.log("DEBUG: Invoice object:", newInvoice);
      await api.createInvoice(newInvoice);
      console.log("DEBUG: createInvoice successful.");

      await fetchData();
      console.log("DEBUG: fetchData successful. Returning true.");
      return true;
    } catch (e: any) {
      console.error("DEBUG: handleReception caught error:", e);
      alert("ERREUR CRITIQUE RÉCEPTION : " + e.message);
      fetchData(); 
      return false;
    }
  };

  return { handleReception };
};
