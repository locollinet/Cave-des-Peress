import { Invoice, StockMovement, Expense } from '../../types';
import { parseSmartDate, isPurchaseInvoice } from '../../utils';

export interface MonthlyVatData {
  monthIndex: number;
  monthName: string;
  collected: number;
  deductiblePurchases: number;
  deductibleExpenses: number;
  balance: number;
  // Détails
  collectedInvoices: Invoice[];
  deductiblePurchasesInvoices: Invoice[];
  deductibleExpensesList: Expense[];
}

export const calculateVatReport = (
  invoices: Invoice[],
  expenses: Expense[],
  selectedYear: number
): MonthlyVatData[] => {
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const monthlyData: MonthlyVatData[] = Array.from({ length: 12 }, (_, i) => ({
    monthIndex: i,
    monthName: months[i],
    collected: 0,
    deductiblePurchases: 0,
    deductibleExpenses: 0,
    balance: 0,
    collectedInvoices: [],
    deductiblePurchasesInvoices: [],
    deductibleExpensesList: []
  }));

  // 1. TVA COLLECTÉE (Ventes - Accrual basis pour marchandises)
  invoices.forEach(inv => {
    let dateObj: Date | null = null;
    let isValid = false;

    if (inv.type === 'Sale') {
      if (inv.status === 'Paid') {
        dateObj = parseSmartDate(inv.paymentDate || inv.invoiceDate || inv.date);
        isValid = true;
      }
    }

    if (isValid && dateObj && dateObj.getFullYear() === selectedYear) {
      monthlyData[dateObj.getMonth()].collected += inv.totalTVA;
      monthlyData[dateObj.getMonth()].collectedInvoices.push(inv);
    }
  });

  // 2. TVA DÉDUCTIBLE (Factures d'achat)
  invoices.filter(isPurchaseInvoice).forEach(inv => {
    const d = parseSmartDate(inv.invoiceDate || inv.date);
    if (d && d.getFullYear() === selectedYear) {
      monthlyData[d.getMonth()].deductiblePurchases += inv.totalTVA;
      monthlyData[d.getMonth()].deductiblePurchasesInvoices.push(inv);
    }
  });

  // 3. TVA DÉDUCTIBLE (Frais Généraux)
  expenses.forEach(exp => {
    const d = parseSmartDate(exp.date);
    if (d && !isNaN(d.getTime()) && d.getFullYear() === selectedYear) {
      monthlyData[d.getMonth()].deductibleExpenses += exp.amountTVA;
      monthlyData[d.getMonth()].deductibleExpensesList.push(exp);
    }
  });

  // Calcul des balances
  monthlyData.forEach(row => {
    row.balance = row.collected - (row.deductiblePurchases + row.deductibleExpenses);
  });

  return monthlyData;
};
