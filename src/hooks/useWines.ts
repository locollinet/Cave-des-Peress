import React from 'react';
import { Wine, Invoice, StockMovement, Domain } from '../../types';
import { api } from '../../api';

export const useWines = (
  setWines: React.Dispatch<React.SetStateAction<Wine[]>>,
  invoices: Invoice[],
  stockMovements: StockMovement[],
  setDomains?: React.Dispatch<React.SetStateAction<Domain[]>>
) => {
  const handleAddProduct = async (newWine: Wine, domainName?: string, domainCoef?: number, domainRegion?: string) => {
    try {
      if (domainName) {
        const newDomain: Domain = {
          id: newWine.domainId,
          name: domainName,
          region: domainRegion || '',
          coefficient: domainCoef || 1.5,
          isArchived: false
        };
        await api.createDomain(newDomain);
        if (setDomains) {
          setDomains(prev => [...prev, newDomain]);
        }
      }
      await api.createWine(newWine);
      setWines(prev => [...prev, newWine]);
    } catch (e: any) {
      console.error(e);
      alert("Erreur ajout produit: " + (e.message || e));
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
    const hasInvoices = invoices.some(i => i.items.some((item: any) => item.id === id));
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

  const handleToggleArchive = async (id: string, wines: Wine[]) => {
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

  return { handleAddProduct, handleUpdateProduct, handleDeleteProduct, handleToggleArchive };
};
