
import React, { useMemo } from 'react';
import { Wine, Invoice, StockMovement, Client, Expense, WineColor } from '../types';
import { formatCurrency } from '../utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, AlertTriangle, Crown, Percent, PieChart as PieChartIcon, ShoppingBag } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const PIE_COLORS: Record<string, string> = {
  [WineColor.Red]: '#b91c1c', // Red-700
  [WineColor.White]: '#fbbf24', // Amber-400
  [WineColor.Rose]: '#f472b6', // Pink-400
  [WineColor.Sparkling]: '#94a3b8', // Slate-400
  [WineColor.Liquor]: '#7c3aed', // Violet-600
};

const Projection = ({
  wines,
  invoices,
  movements,
  clients,
  expenses
}: {
  wines: Wine[],
  invoices: Invoice[],
  movements: StockMovement[],
  clients: Client[],
  expenses: Expense[]
}) => {
  const currentYear = new Date().getFullYear();

  // 1. MARGE PAR RÉGION
  const marginByRegion = useMemo(() => {
    const data: Record<string, { revenue: number, cost: number, margin: number }> = {};
    
    invoices.forEach(inv => {
      if (inv.status === 'Paid' || inv.status === 'Validated') {
        inv.items.forEach(item => {
          const wine = wines.find(w => w.id === item.id);
          const region = wine?.region || 'Autre';
          
          if (!data[region]) data[region] = { revenue: 0, cost: 0, margin: 0 };
          
          const lineRevenue = item.sellingPriceHT * item.quantity;
          const lineCost = (wine?.buyingPriceHT || 0) * item.quantity;
          
          data[region].revenue += lineRevenue;
          data[region].cost += lineCost;
          data[region].margin += (lineRevenue - lineCost);
        });
      }
    });

    return Object.entries(data)
      .map(([name, stats]) => ({
        name,
        marge: Math.round(stats.margin),
        percent: stats.revenue > 0 ? Math.round((stats.margin / stats.revenue) * 100) : 0
      }))
      .sort((a, b) => b.marge - a.marge)
      .slice(0, 7);
  }, [invoices, wines]);

  // 2. STOCK DORMANT
  const sleepingStock = useMemo(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    return wines
      .filter(w => w.stock > 0 && !w.isArchived)
      .map(w => {
        const lastOut = movements
          .filter(m => m.wineId === w.id && m.type === 'OUT')
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        
        const lastDate = lastOut ? new Date(lastOut.date) : new Date(0); 
        
        return {
          ...w,
          lastMovement: lastDate,
          totalValue: w.stock * w.buyingPriceHT
        };
      })
      .filter(w => w.lastMovement < sixMonthsAgo)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 5);
  }, [wines, movements]);

  // 3. TOP CLIENTS
  const topClients = useMemo(() => {
    const clientStats: Record<string, number> = {};
    invoices.forEach(inv => {
      if (inv.status === 'Paid' && inv.type === 'Sale') {
        clientStats[inv.clientName] = (clientStats[inv.clientName] || 0) + inv.totalHT;
      }
    });
    
    return Object.entries(clientStats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [invoices]);

  // 4. CASHFLOW CUMULÉ (Graphique Linéaire demandé)
  const cashflowData = useMemo(() => {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    let cumulatedSales = 0;
    let cumulatedExpenses = 0;

    return months.map((month, index) => {
      // Ventes encaissées
      const monthSales = invoices
        .filter(i => {
           const d = new Date(i.paymentDate ? i.paymentDate.split('/').reverse().join('-') : i.date.split('/').reverse().join('-'));
           return i.status === 'Paid' && d.getMonth() === index && d.getFullYear() === currentYear;
        })
        .reduce((acc, i) => acc + i.totalHT, 0);
      
      // Frais Généraux
      const monthOverhead = expenses
        .filter(e => {
           const d = new Date(e.date);
           return d.getMonth() === index && d.getFullYear() === currentYear;
        })
        .reduce((acc, e) => acc + e.amountHT, 0);

      // Achats de Marchandise (Stock)
      const monthStockPurchase = movements
        .filter(m => {
           const d = new Date(m.date);
           return m.type === 'IN' && m.price !== undefined && d.getMonth() === index && d.getFullYear() === currentYear;
        })
        .reduce((acc, m) => acc + (m.quantity * (m.price || 0)), 0);

      cumulatedSales += monthSales;
      cumulatedExpenses += (monthOverhead + monthStockPurchase);

      return {
        name: month,
        Ventes: cumulatedSales,
        Depenses: cumulatedExpenses,
        Benefice: cumulatedSales - cumulatedExpenses
      };
    });
  }, [invoices, expenses, movements, currentYear]);

  // 5. SALES BY COLOR (PIE)
  const salesByColor = useMemo(() => {
     const stats: Record<string, number> = {};
     invoices.forEach(inv => {
        if (inv.status === 'Paid' || inv.status === 'Validated') {
           inv.items.forEach(item => {
              const wine = wines.find(w => w.id === item.id);
              const color = wine?.color || 'Autre';
              stats[color] = (stats[color] || 0) + (item.quantity * item.sellingPriceHT);
           });
        }
     });
     return Object.entries(stats)
        .map(([name, value]) => ({ name, value }))
        .filter(item => item.value > 0);
  }, [invoices, wines]);

  // 6. AVERAGE BASKET (KPI)
  const averageBasket = useMemo(() => {
     const paidInvoices = invoices.filter(i => i.status === 'Paid' && i.type === 'Sale');
     if (paidInvoices.length === 0) return 0;
     const total = paidInvoices.reduce((acc, i) => acc + i.totalHT, 0);
     return total / paidInvoices.length;
  }, [invoices]);

  return (
    <div className="space-y-6">
      
      {/* TOP KPI ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
            <div>
               <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Panier Moyen (HT)</p>
               <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(averageBasket)}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-full text-blue-600"><ShoppingBag size={24} /></div>
         </div>
         
         <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
            <div>
               <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Top Vendeur (Région)</p>
               <p className="text-xl font-bold text-emerald-700 mt-1">{marginByRegion.length > 0 ? marginByRegion[0].name : '-'}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-full text-emerald-600"><TrendingUp size={24} /></div>
         </div>

         <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
            <div>
               <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Taux de Marge Moyen</p>
               <p className="text-xl font-bold text-indigo-700 mt-1">
                  {marginByRegion.length > 0 
                     ? Math.round(marginByRegion.reduce((acc, curr) => acc + curr.percent, 0) / marginByRegion.length) + '%' 
                     : '-'}
               </p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-full text-indigo-600"><Percent size={24} /></div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRAPH 1: RENTABILITÉ PAR RÉGION */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <TrendingUp className="text-emerald-600" /> Rentabilité par Région (Marge Brute)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marginByRegion} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                <Tooltip 
                   formatter={(val: number) => formatCurrency(val)} 
                   contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="marge" fill="#059669" radius={[0, 4, 4, 0]} barSize={20} name="Marge HT">
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRAPH 2: VENTES PAR COULEUR (PIE) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
           <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
             <PieChartIcon className="text-purple-500" /> Répartition Ventes
           </h3>
           <p className="text-xs text-gray-400 mb-4">Volume d'affaires par couleur</p>
           <div className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesByColor}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {salesByColor.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number) => formatCurrency(val)} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         
         {/* GRAPH 3: STOCK DORMANT */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100">
            <h3 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2">
               <AlertTriangle className="text-red-500" /> Stock Dormant (Top 5 Valeur)
            </h3>
            <p className="text-xs text-red-600 mb-4">
               Ces vins représentent de la trésorerie immobilisée. Ils n'ont pas enregistré de sortie depuis plus de 6 mois.
            </p>
            <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-red-50 text-red-900 uppercase text-xs">
                     <tr>
                        <th className="px-4 py-2 rounded-l-lg">Vin</th>
                        <th className="px-4 py-2 text-center">Qte</th>
                        <th className="px-4 py-2 text-right rounded-r-lg">Valeur Immob.</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                     {sleepingStock.map(wine => (
                        <tr key={wine.id}>
                           <td className="px-4 py-3 font-medium text-gray-800">{wine.name} <span className="text-gray-400 text-xs">({wine.vintage})</span></td>
                           <td className="px-4 py-3 text-center text-gray-600">{wine.stock}</td>
                           <td className="px-4 py-3 text-right font-bold text-red-700">{formatCurrency(wine.totalValue)}</td>
                        </tr>
                     ))}
                     {sleepingStock.length === 0 && (
                        <tr><td colSpan={3} className="p-4 text-center text-gray-500 italic">Votre stock tourne bien ! Aucun dormant identifié.</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>

         {/* GRAPH 4: CASHFLOW CUMULÉ (NEW) */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
               <Percent className="text-blue-600" /> Atterrissage Financier {currentYear}
            </h3>
            <div className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cashflowData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                     <CartesianGrid stroke="#f5f5f5" />
                     <XAxis dataKey="name" tick={{fontSize: 10}} />
                     <YAxis tickFormatter={(val) => `${val/1000}k`} tick={{fontSize: 10}} />
                     <Tooltip formatter={(val: number) => formatCurrency(val)} />
                     <Legend />
                     <Line type="monotone" dataKey="Ventes" stroke="#059669" strokeWidth={2} dot={false} name="Ventes (Enc.)" />
                     <Line type="monotone" dataKey="Depenses" stroke="#dc2626" strokeWidth={2} dot={false} name="Dépenses (Total)" />
                     <Line type="monotone" dataKey="Benefice" stroke="#4f46e5" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Bénéfice Net" />
                  </LineChart>
               </ResponsiveContainer>
            </div>
            <p className="text-xs text-center text-gray-400 mt-2">Cumul Annuel (Ventes encaissées vs Achats + Frais)</p>
         </div>

      </div>
    </div>
  );
};

export default Projection;
