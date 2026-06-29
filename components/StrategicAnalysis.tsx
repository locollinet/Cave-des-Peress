import React, { useMemo, useState } from 'react';
import { Wine, Invoice, StockMovement, Client, Expense, Domain, WineColor } from '../types';
import { formatCurrency, parseYear } from '../utils';
import DormantStock from './DormantStock';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Percent, PieChart as PieChartIcon, ShoppingBag } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const PIE_COLORS: Record<string, string> = {
  [WineColor.Red]: '#b91c1c', 
  [WineColor.White]: '#fbbf24', 
  [WineColor.Rose]: '#f472b6', 
  [WineColor.Sparkling]: '#94a3b8', 
  [WineColor.Liquor]: '#7c3aed', 
};

interface StrategicAnalysisProps {
  invoices: Invoice[];
  wines: Wine[];
  domains: Domain[];
  movements: StockMovement[];
  clients: Client[];
  expenses: Expense[];
  selectedYear: number | 'all';
}

const StrategicAnalysis = ({ invoices, wines, domains, movements, clients, expenses, selectedYear }: StrategicAnalysisProps) => {

  // --- SALES ANALYSIS LOGIC ---
  const salesData = useMemo(() => {
    const filteredInvoices = invoices.filter(i => 
        i.type === 'Sale' && 
        (i.status === 'Paid' || i.status === 'Validated') &&
        (selectedYear === 'all' || new Date(i.invoiceDate || i.date).getFullYear() === selectedYear)
    );

    let totalRevenue = 0;
    let totalMargin = 0; // NEW: track total margin
    let totalItemsCount = 0;
    const clientSales: Record<string, { name: string, total: number }> = {};
    const wineSales: Record<string, { name: string, quantity: number }> = {};
    const regionSales: Record<string, number> = {};
    const marginByRegion: Record<string, { revenue: number, margin: number }> = {};
    const salesByColor: Record<string, number> = {};

    filteredInvoices.forEach(inv => {
        let invHTForMetrics = 0;
        
        inv.items.forEach(item => {
            const isOil = item.name.toLowerCase().includes('huile');
            if (isOil) return;

            if (!item.isService) {
                invHTForMetrics += item.sellingPriceHT * item.quantity;
            }
            
            if (!item.isService && !isOil) {
                if (!wineSales[item.id]) wineSales[item.id] = { name: item.name, quantity: 0 };
                wineSales[item.id].quantity += item.quantity;

                const wine = wines.find(w => w.id === item.id);
                const domain = wine ? domains.find(d => d.id === wine.domainId) : undefined;
                const region = domain?.region || 'Inconnue';
                regionSales[region] = (regionSales[region] || 0) + item.quantity;

                // Marges et Couleurs
                const color = wine?.color || 'Autre';
                salesByColor[color] = (salesByColor[color] || 0) + (item.quantity * item.sellingPriceHT);

                if (!marginByRegion[region]) marginByRegion[region] = { revenue: 0, margin: 0 };
                const lineRevenue = item.sellingPriceHT * item.quantity;
                const lineCost = (wine?.buyingPriceHT || 0) * item.quantity;
                marginByRegion[region].revenue += lineRevenue;
                marginByRegion[region].margin += (lineRevenue - lineCost);
                
                totalMargin += (lineRevenue - lineCost); // NEW: track total
            }
        });

        totalRevenue += invHTForMetrics;
        if (invHTForMetrics > 0) totalItemsCount++;

        const clientId = inv.clientId;
        // Find by ID, or if not found/no ID, find by name
        let client = clientId ? clients.find(c => c.id === clientId) : undefined;
        const normalizedInvoiceName = inv.clientName.toLowerCase().trim();
        
        if (!client) {
            client = clients.find(c => c.name.toLowerCase().trim() === normalizedInvoiceName);
        }
        
        // Use normalized name as key to ensure all matching names aggregate
        const key = client ? client.name.toLowerCase().trim() : normalizedInvoiceName;
        const displayName = client ? client.name : inv.clientName;
        
        if (!clientSales[key]) {
            clientSales[key] = { name: displayName, total: 0 };
        }
        clientSales[key].total += inv.totalTTC;
    });

    const averageOrderValue = totalItemsCount > 0 ? totalRevenue / totalItemsCount : 0;
    const overallMarginRate = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
    const topClients = Object.values(clientSales).sort((a,b) => b.total - a.total).slice(0, 10);
    const topWines = Object.values(wineSales).sort((a,b) => b.quantity - a.quantity).slice(0, 10);
    const topRegions = Object.entries(regionSales).sort((a,b) => b[1] - a[1]).slice(0, 5);
    
    const marginChartData = Object.entries(marginByRegion).map(([name, stats]) => ({
        name,
        marge: Math.round(stats.margin),
        percent: stats.revenue > 0 ? Math.round((stats.margin / stats.revenue) * 100) : 0
    })).sort((a, b) => b.marge - a.marge).slice(0, 7);

    const colorData = Object.entries(salesByColor).map(([name, value]) => ({ name, value }));
    
    return { averageOrderValue, topClients, topWines, topRegions, marginChartData, colorData, overallMarginRate };
  }, [invoices, wines, domains, movements, selectedYear, expenses, clients]);

  const cashflowData = useMemo(() => {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    let cumulatedSales = 0;
    let cumulatedExpenses = 0;
    const currentYear = selectedYear === 'all' ? new Date().getFullYear() : selectedYear;

    return months.map((month, index) => {
      const monthSales = invoices.filter(i => {
            const d = new Date(i.paymentDate ? i.paymentDate.split('/').reverse().join('-') : i.date.split('/').reverse().join('-'));
            return i.status === 'Paid' && d.getMonth() === index && d.getFullYear() === currentYear;
        }).reduce((acc, i) => acc + i.totalHT, 0);
      
      const monthOverhead = expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === index && d.getFullYear() === currentYear;
        }).reduce((acc, e) => acc + e.amountHT, 0);

      const monthStockPurchase = movements.filter(m => {
            const d = new Date(m.date);
            return m.type === 'IN' && d.getMonth() === index && d.getFullYear() === currentYear;
        }).reduce((acc, m) => acc + (m.quantity * (m.price || 0)), 0);

      cumulatedSales += monthSales;
      cumulatedExpenses += (monthOverhead + monthStockPurchase);

      return { name: month, Ventes: cumulatedSales, Depenses: cumulatedExpenses, Benefice: cumulatedSales - cumulatedExpenses };
    });
  }, [invoices, expenses, movements, selectedYear]);

  const [selectedTopList, setSelectedTopList] = useState<'clients' | 'wines' | 'regions'>('clients');

  // --- DORMANT STOCK LOGIC ---
  const dormantData = useMemo(() => {
    const today = new Date();
    const movementsIN = movements.filter(m => m.type === 'IN');
    const activeWines = wines.filter(w => !w.isArchived);
    
    const winesWithFirstPurchase = activeWines.filter(w => w.stock > 0).map(w => {
        const firstMove = movementsIN.filter(m => m.wineId === w.id).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
        const purchaseDateFromInvoices = invoices.filter(i => i.type?.toLowerCase() === 'purchase' && i.items.some(item => item.id === w.id)).map(i => new Date(i.date)).sort((a,b) => b.getTime() - a.getTime());
        const lastInvoicePurchaseDate = purchaseDateFromInvoices.length > 0 ? purchaseDateFromInvoices[0] : null;
        let bestDate: Date = lastInvoicePurchaseDate || (firstMove ? new Date(firstMove.date) : new Date('2026-01-01'));
        const domain = domains.find(d => d.id === w.domainId);
        return { ...w, firstPurchaseDate: bestDate, domainName: domain?.name || 'Inconnu' };
    });
      
    const topDormantByDuration = [...winesWithFirstPurchase].sort((a, b) => {
        const diffA = today.getTime() - a.firstPurchaseDate.getTime();
        const diffB = today.getTime() - b.firstPurchaseDate.getTime();
        if (diffB !== diffA) return diffB - diffA; 
        return (b.stock * b.buyingPriceHT) - (a.stock * a.buyingPriceHT);
    }).slice(0, 10);
      
    const topDormantByValue = [...winesWithFirstPurchase].sort((a, b) => (b.stock * b.buyingPriceHT) - (a.stock * a.buyingPriceHT)).slice(0, 10);
      
    return { topDormantByDuration, topDormantByValue, allWinesWithPurchaseDate: winesWithFirstPurchase };
  }, [wines, movements, invoices, domains]);

  return (
    <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Stratégie & Analyse</h2>
        
        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
              <div>
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Panier Moyen (HT)</p>
                 <p className="text-2xl font-bold text-teal-600 mt-1">{formatCurrency(salesData.averageOrderValue)}</p>
              </div>
              <div className="p-3 bg-teal-50 rounded-full text-teal-600"><ShoppingBag size={24} /></div>
           </div>
  
           <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
              <div>
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Taux de Marge Global</p>
                 <p className="text-xl font-bold text-indigo-700 mt-1">
                    {salesData.overallMarginRate.toFixed(1)}%
                 </p>
                 <p className="text-[10px] text-gray-500 mt-1 italic">Marge (CA - Coût d'achat) / CA</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-full text-indigo-600"><Percent size={24} /></div>
           </div>
        </div>

        {/* Analytics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-2">Rentabilité par Région</h3>
              <p className="text-xs text-gray-500 mb-6 italic">CA facturé de l'année et coût d'achat historique</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesData.marginChartData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                    <Tooltip formatter={(val: number) => formatCurrency(val)} />
                    <Bar dataKey="marge" fill="#059669" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
               <h3 className="text-lg font-bold text-gray-800 mb-6">Répartition Ventes</h3>
               <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={salesData.colorData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {salesData.colorData.map((entry, index) => <Cell key={index} fill={PIE_COLORS[entry.name] || COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(val: number) => formatCurrency(val)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
               </div>
            </div>
        </div>

        {/* Lists */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
               <h3 className="font-semibold text-gray-700">Top Analyse</h3>
               <select 
                 className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                 value={selectedTopList}
                 onChange={(e) => setSelectedTopList(e.target.value as any)}
                >
                  <option value="clients">Top 10 Clients</option>
                  <option value="wines">Top Ventes (Réfs)</option>
                  <option value="regions">Top Régions</option>
               </select>
            </div>
            <ul className="text-sm space-y-1">
                {selectedTopList === 'clients' && salesData.topClients.map((c, i) => (
                    <li key={i} className="flex justify-between"><span>{c.name}</span><span className="font-bold">{formatCurrency(c.total)}</span></li>
                ))}
                {selectedTopList === 'wines' && salesData.topWines.map((w, i) => (
                    <li key={i} className="flex justify-between"><span>{w.name}</span><span className="font-bold">{w.quantity} btl</span></li>
                ))}
                {selectedTopList === 'regions' && salesData.topRegions.map((r, i) => (
                    <li key={i} className="flex justify-between"><span>{r[0]}</span><span className="font-bold">{r[1]} btl</span></li>
                ))}
            </ul>
        </div>
        
        {/* Cashflow Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Atterrissage Financier</h3>
              <div className="h-64">
                 <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesData.cashflowData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
           </div>
        </div>

        <DormantStock {...dormantData} />
    </div>
  );
};
export default StrategicAnalysis;
