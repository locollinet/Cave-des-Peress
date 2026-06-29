import React from 'react';
import { Invoice } from '../../types';
import { api } from '../../api';

export const useInvoices = (
  invoices: Invoice[],
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>,
  fetchData: () => Promise<void>
) => {
  const handleAddInvoice = async (newInvoice: Invoice) => {
    try {
      await api.createInvoice(newInvoice);
      setInvoices(prev => [...prev, newInvoice]);
    } catch (e: any) {
      console.error(e);
      alert("Erreur ajout facture: " + (e.message || e));
    }
  };

  const handleUpdateInvoicePayment = async (id: string, paymentStatus: 'Paid' | 'Pending', paymentDate?: string) => {
    try {
      await api.updateInvoiceStatus(id, paymentStatus, paymentDate ? { date: paymentDate } : undefined);
      await fetchData();
    } catch (e: any) {
      console.error(e);
      alert("Erreur mise à jour paiement: " + (e.message || e));
    }
  };

  return { handleAddInvoice, handleUpdateInvoicePayment };
};
