
import React, { useState, useEffect } from 'react';
import { Wine, Domain, Invoice, StockMovement, Client, CartItem, PurchaseItem, Expense, ExpenseCategory } from './types';
import { api } from './api';

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
  
  // UI States
  const [logo, setLogo] = useStickyState<string>('', 'app_logo');
  const [isSimulation, setIsSimulation] = useStickyState<boolean>(false, 'app_simulation_mode');
  const [isLoading, setIsLoading] = useState(true);

  // Sync Simulation Mode with API module
  useEffect(() => {
    api.setSimulationMode(isSimulation);
  }, [isSimulation]);

  // --- CHARGEMENT ---
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [w, d, c, i, m, e, cat] = await Promise.all([
        api.fetchWines(),
        api.fetchDomains(),
        api.fetchClients(),
        api.fetchInvoices(),
        api.fetchMovements(),
        api.fetchExpenses(),
        api.fetchExpenseCategories()
      ]);
      
      setWines(w);
      setDomains(d);
      setClients(c);
      setInvoices(i);
      setStockMovements(m);
      setExpenses(e);

      // Seed categories if empty (Configuration only, not fake data)
      if (cat.length === 0) {
         for (const label of DEFAULT_CATEGORIES) {
            await api.createExpenseCategory(label);
         }
         const seeded = await api.fetchExpenseCategories();
         setExpenseCategories(seeded);
      } else {
         setExpenseCategories(cat);
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

  const handleStockUpdate = async (id: string, newStock: number) => {
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
              reason: 'Ajustement manuel inventaire'
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

  const handleReception = async (provider: string, reference: string, items: PurchaseItem[]) => {
    try {
      for (const item of items) {
        const currentWine = wines.find(w => w.id === item.id);
        if (currentWine) {
          const oldStock = Math.max(0, currentWine.stock);
          const oldTotalValue = oldStock * currentWine.buyingPriceHT;
          const newBatchValue = item.quantity * item.purchasePriceHT;
          const newTotalQty = oldStock + item.quantity;
          
          let newWeightedPrice = currentWine.buyingPriceHT;
          if (newTotalQty > 0) {
            newWeightedPrice = (oldTotalValue + newBatchValue) / newTotalQty;
          }

          const updatedWine: Wine = {
            ...currentWine,
            stock: currentWine.stock + item.quantity,
            buyingPriceHT: parseFloat(newWeightedPrice.toFixed(4))
          };

          await api.updateWine(updatedWine);

          await api.createMovement({
            id: `mv_in_${Date.now()}_${item.id}_${Math.random().toString(36).substr(2, 5)}`,
            date: new Date().toISOString(),
            wineId: item.id,
            wineName: item.name,
            type: 'IN',
            quantity: item.quantity,
            reason: `Réception Fournisseur`,
            price: item.purchasePriceHT,
            provider: provider,
            reference: reference
          });

          setWines(prev => prev.map(w => w.id === item.id ? updatedWine : w));
        }
      }
      
      const m = await api.fetchMovements();
      setStockMovements(m);
      return true;
    } catch (e: any) {
      console.error(e);
      alert("Erreur lors de la réception : " + e.message);
      fetchData(); // Rollback
      return false;
    }
  };

  const handleCancelReception = async (movementsToCancel: StockMovement[]) => {
    try {
      for (const move of movementsToCancel) {
        if (move.type === 'IN' && move.price !== undefined) {
           const wine = wines.find(w => w.id === move.wineId);
           if (wine) {
              const currentTotalValue = wine.stock * wine.buyingPriceHT;
              const valueToRemove = move.quantity * move.price;
              const prevStock = wine.stock - move.quantity;
              
              let prevPrice = wine.buyingPriceHT;
              
              if (prevStock > 0) {
                 const prevTotalValue = currentTotalValue - valueToRemove;
                 const safeTotalValue = Math.max(0, prevTotalValue);
                 prevPrice = safeTotalValue / prevStock;
              } else if (prevStock === 0) {
                 prevPrice = wine.buyingPriceHT; 
              }

              const updatedWine: Wine = {
                 ...wine,
                 stock: Math.max(0, prevStock),
                 buyingPriceHT: parseFloat(prevPrice.toFixed(4))
              };

              await api.updateWine(updatedWine);
              await api.deleteMovement(move.id);

              setWines(prev => prev.map(w => w.id === wine.id ? updatedWine : w));
           }
        }
      }
      
      const m = await api.fetchMovements();
      setStockMovements(m);
      return true;

    } catch(e: any) {
       console.error(e);
       alert("Erreur annulation réception: " + e.message);
       fetchData(); 
       return false;
    }
  };

  const handleAddProduct = async (newWine: Wine, domainName?: string, domainCoef?: number, domainRegion?: string) => {
    try {
      if (domainName) {
        const newDomain: Domain = {
          id: newWine.domainId,
          name: domainName,
          region: domainRegion || 'Autre',
          coefficient: domainCoef || 1.2
        };
        await api.createDomain(newDomain);
        setDomains(prev => [...prev, newDomain]);
      }
      await api.createWine(newWine);
      setWines(prev => [...prev, newWine]);
    } catch (e: any) {
      console.error(e);
      alert("Erreur ajout produit: " + (e.message || e));
    }
  };

  const handleAddDomain = async (newDomain: Domain) => {
    try {
      await api.createDomain(newDomain);
      setDomains(prev => [...prev, newDomain]);
    } catch(e: any) {
        console.error(e);
        alert("Erreur ajout domaine: " + (e.message || e));
    }
  };

  const handleUpdateProduct = async (updatedWine: Wine) => {
    try {
      await api.updateWine(updatedWine);
      setWines(prev => prev.map(w => w.id === updatedWine.id ? updatedWine : w));
    } catch (e: any) {
      console.error(e);
      alert("Erreur modification produit: " + (e.message || e));
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const hasInvoices = invoices.some(i => i.items.some(item => item.id === id));
    const hasMovements = stockMovements.some(m => m.wineId === id);

    if (hasInvoices || hasMovements) {
      alert("Impossible de supprimer ce vin car il est lié à des factures ou des mouvements de stock. Veuillez l'archiver à la place.");
      return;
    }

    if (!window.confirm("Êtes-vous sûr de vouloir supprimer définitivement cette référence ?")) {
      return;
    }

    try {
      await api.deleteWine(id);
      setWines(prev => prev.filter(w => w.id !== id));
    } catch (e: any) {
      console.error(e);
      alert("Erreur suppression produit: " + (e.message || e));
    }
  };

  const handleToggleArchive = async (id: string) => {
      const wine = wines.find(w => w.id === id);
      if (!wine) return;
      const updatedWine = { ...wine, isArchived: !wine.isArchived };
      
      try {
          await api.updateWine(updatedWine);
          setWines(prev => prev.map(w => w.id === id ? updatedWine : w));
      } catch (e: any) {
          console.error(e);
          alert("Erreur archivage produit: " + (e.message || e));
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

  const handleStockTransfer = async (clientId: string, wineId: string, quantity: number, direction: 'deposit' | 'return') => {
     const client = clients.find(c => c.id === clientId);
     const wine = wines.find(w => w.id === wineId);
     if (!client || !wine) return;

     let newClientStock = [...client.externalStock];
     const existingItemIndex = newClientStock.findIndex(i => i.wineId === wineId);
     let movementType: 'TRANSFER' = 'TRANSFER';
     let reason = '';
     let nextWineStock = wine.stock;

     if (direction === 'deposit') {
        nextWineStock = Math.max(0, wine.stock - quantity);
        if (existingItemIndex >= 0) {
           newClientStock[existingItemIndex].quantity += quantity;
        } else {
           newClientStock.push({ wineId, quantity });
        }
        reason = `Dépôt chez ${client.name}`;
     } else {
        nextWineStock = wine.stock + quantity;
        if (existingItemIndex >= 0) {
           newClientStock[existingItemIndex].quantity = Math.max(0, newClientStock[existingItemIndex].quantity - quantity);
           if (newClientStock[existingItemIndex].quantity === 0) {
              newClientStock.splice(existingItemIndex, 1);
           }
        }
        reason = `Retour dépôt ${client.name}`;
     }

     try {
       await api.updateWineStock(wineId, nextWineStock);
       await api.updateClient({ ...client, externalStock: newClientStock });
       
       const movement: StockMovement = {
           id: `mv_${direction}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
           date: new Date().toISOString(),
           wineId: wine.id,
           wineName: wine.name,
           type: movementType,
           quantity,
           reason
       };
       await api.createMovement(movement);

       setWines(prev => prev.map(w => w.id === wineId ? { ...w, stock: nextWineStock } : w));
       setClients(prev => prev.map(c => c.id === clientId ? { ...c, externalStock: newClientStock } : c));
       setStockMovements(prev => [movement, ...prev]);
     } catch(e: any) { 
         console.error(e); 
         alert("Erreur transfert stock: " + (e.message || e));
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

        const totalHT = items.reduce((sum, i) => sum + (i.sellingPriceHT * i.quantity), 0);
        // TVA : 20% sur la marchandise + 20% sur les frais de port
        const itemsTVA = totalHT * 0.20;
        const shippingTVA = shippingCost * 0.20;
        const totalTVA = itemsTVA + shippingTVA;
        
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
          totalHT,
          totalTVA,
          totalTTC: totalHT + shippingCost + totalTVA,
          discount: 0,
          shippingCost
        };

        await api.createInvoice(newInvoice);
        setInvoices(prev => [newInvoice, ...prev]);

        // CRITIQUE: Filtrer les prestations (isService) pour ne pas déstocker
        const mainStockItems = items.filter(i => !i.fromExternalStock && !i.isService);
        const externalStockItems = items.filter(i => i.fromExternalStock && !i.isService);

        for (const item of mainStockItems) {
            const currentWine = wines.find(w => w.id === item.id);
            if (currentWine) {
                const nextStock = Math.max(0, currentWine.stock - item.quantity);
                await handleStockUpdate(item.id, nextStock); 

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
                    return { ...s, quantity: Math.max(0, s.quantity - soldItem.quantity) };
                    }
                    return s;
                }).filter(s => s.quantity > 0);

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
          const totalHT = invoice.items.reduce((sum, i) => sum + (i.sellingPriceHT * i.quantity), 0);
          const shipping = invoice.shippingCost || 0;
          const itemsTVA = totalHT * 0.20;
          const shippingTVA = shipping * 0.20;
          const totalTVA = itemsTVA + shippingTVA;
          const totalTTC = totalHT + shipping + totalTVA;

          const updatedInvoice = {
              ...invoice,
              totalHT,
              totalTVA,
              totalTTC
          };

          await api.updateInvoice(updatedInvoice);
          setInvoices(prev => prev.map(i => i.id === invoice.id ? updatedInvoice : i));
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
            ...paymentDetails
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
            // Ignorer les prestations lors de la remise en stock
            const mainItems = invoice.items.filter(i => !i.fromExternalStock && !i.isService);
            for (const item of mainItems) {
               const wine = wines.find(w => w.id === item.id);
               if (wine) {
                 const restoredStock = wine.stock + item.quantity;
                 await api.updateWineStock(wine.id, restoredStock);
                 
                 await api.createMovement({
                   id: `mv_cancel_${Date.now()}_${item.id}_${Math.random().toString(36).substr(2, 5)}`,
                   date: new Date().toISOString(),
                   wineId: item.id,
                   wineName: item.name,
                   type: 'IN',
                   quantity: item.quantity,
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
                    if (existingIdx >= 0) {
                       updatedExternalStock[existingIdx].quantity += item.quantity;
                    } else {
                       updatedExternalStock.push({ wineId: item.id, quantity: item.quantity });
                    }

                    await api.createMovement({
                        id: `mv_cancel_ext_${Date.now()}_${item.id}_${Math.random().toString(36).substr(2, 5)}`,
                        date: new Date().toISOString(),
                        wineId: item.id,
                        wineName: item.name,
                        type: 'IN',
                        quantity: item.quantity,
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
      setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: newStatus, ...paymentDetails } : i));

    } catch(e: any) { 
        console.error(e); 
        alert("Erreur mise à jour statut: " + (e.message || e));
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    const invoice = invoices.find(i => i.id === id);
    if (!invoice) return;

    try {
        if (invoice.status !== 'Cancelled') {
            const mainItems = invoice.items.filter(i => !i.fromExternalStock && !i.isService);
            for (const item of mainItems) {
                const wine = wines.find(w => w.id === item.id);
                if (wine) {
                    const restoredStock = wine.stock + item.quantity;
                    await handleStockUpdate(wine.id, restoredStock);

                    await api.createMovement({
                        id: `mv_del_${Date.now()}_${item.id}_${Math.random().toString(36).substr(2, 5)}`,
                        date: new Date().toISOString(),
                        wineId: item.id,
                        wineName: item.name,
                        type: 'IN',
                        quantity: item.quantity,
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
                        if (idx >= 0) updatedStock[idx].quantity += item.quantity;
                        else updatedStock.push({ wineId: item.id, quantity: item.quantity });

                        await api.createMovement({
                            id: `mv_del_ext_${Date.now()}_${item.id}_${Math.random().toString(36).substr(2, 5)}`,
                            date: new Date().toISOString(),
                            wineId: item.id,
                            wineName: item.name,
                            type: 'IN',
                            quantity: item.quantity,
                            reason: `Suppression définitive déporté ${invoice.id}`
                        });
                    }
                    await handleClientUpdate({ ...client, externalStock: updatedStock });
                }
            }
        }

        await api.deleteInvoice(id);
        setInvoices(prev => prev.filter(i => i.id !== id));
        const m = await api.fetchMovements();
        setStockMovements(m);

    } catch (e: any) {
        console.error(e);
        alert("Erreur suppression facture: " + (e.message || e));
    }
  };

  const handleAddExpense = async (expense: Expense) => {
    try {
      await api.createExpense(expense);
      const newExpenses = await api.fetchExpenses();
      setExpenses(newExpenses);
    } catch(e: any) {
      console.error(e);
      alert("Erreur lors de l'ajout de la dépense : " + (e.message || e));
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

  return {
    data: { wines, domains, invoices, clients, stockMovements, expenses, expenseCategories, facCount, proCount, logo, isSimulation },
    actions: {
      handleStockUpdate, handleAddProduct, handleUpdateProduct, handleDeleteProduct, handleToggleArchive,
      handleUpdateDomain, handleAddDomain, handleDeleteDomain,
      handleClientUpdate, handleAddClient, handleDeleteClient, handleStockTransfer, handleCreateInvoice, handleUpdateInvoice, handleRenumberInvoice, handleReception, handleCancelReception,
      handleInvoiceStatusUpdate, handleDeleteInvoice, handleAddExpense, handleDeleteExpense, handleAddCategory, handleDeleteCategory, setWines, setLogo, setIsSimulation
    }
  };
};
