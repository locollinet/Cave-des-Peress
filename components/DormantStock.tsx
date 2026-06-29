import React, { useMemo } from 'react';
import { Wine } from '../types';
import { formatCurrency } from '../utils';
import { Clock, DollarSign } from 'lucide-react';

interface DormantStockProps {
  topDormantByDuration: (Wine & { firstPurchaseDate: Date, domainName: string })[];
  topDormantByValue: (Wine & { domainName: string })[];
  allWinesWithPurchaseDate: (Wine & { firstPurchaseDate: Date, domainName: string })[];
}

const DormantStock: React.FC<DormantStockProps> = ({ topDormantByDuration, topDormantByValue, allWinesWithPurchaseDate }) => {
  const { maxDuration, count } = useMemo(() => {
    let max = 0;
    const durations = allWinesWithPurchaseDate.map(w => {
       const days = Math.floor((new Date().getTime() - w.firstPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
       if (days > max) max = days;
       return days;
    });
    const countAtMax = allWinesWithPurchaseDate.filter((_, i) => durations[i] === max).length;
    return { maxDuration: max, count: countAtMax };
  }, [allWinesWithPurchaseDate]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Clock size={20} className="text-blue-500" />
              Stock Dormant (Durée)
            </h3>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{count} réf. à {maxDuration} jours</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Domaine</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Vin</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Durée</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Qté</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Valeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topDormantByDuration.map(w => {
                   const days = Math.floor((new Date().getTime() - w.firstPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
                   return (
                      <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{w.domainName}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{w.name} {w.vintage}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 text-right font-mono">{days} j.</td>
                          <td className="px-6 py-4 text-sm text-gray-700 text-right">{w.stock}</td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">{formatCurrency(w.stock * w.buyingPriceHT)}</td>
                      </tr>
                   );
                })}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <DollarSign size={20} className="text-emerald-500" />
              Stock Dormant (Valeur HT)
            </h3>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Domaine</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Vin</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Valeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topDormantByValue.map(w => (
                   <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{w.domainName}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{w.name} {w.vintage}</td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">{formatCurrency(w.stock * w.buyingPriceHT)}</td>
                   </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DormantStock;
