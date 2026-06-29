import React from 'react';
import { Expense } from '../../types';
import { api } from '../../api';

export const useExpenses = (
  expenses: Expense[],
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>,
  fetchData: () => Promise<void>
) => {
  const handleAddExpense = async (newExpense: Expense) => {
    try {
      await api.upsertExpense(newExpense);
      fetchData();
    } catch (e: any) {
      console.error(e);
      alert("Erreur ajout dépense: " + (e.message || e));
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette dépense ?")) return;
    try {
      await api.deleteExpense(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (e: any) {
      console.error(e);
      alert("Erreur suppression dépense: " + (e.message || e));
    }
  };

  return { handleAddExpense, handleDeleteExpense };
};
