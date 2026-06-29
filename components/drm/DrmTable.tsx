import React from 'react';
import { WineColor } from '../../types';

interface DrmTableProps {
  drmData: Record<string, { in: number, out: number, adjust: number }>;
}

export const DrmTable: React.FC<DrmTableProps> = ({ drmData }) => {
  return (
    <div className="overflow-x-auto rounded-lg border border-blue-200 bg-white shadow-sm">
      <table className="w-full text-sm text-left min-w-[600px]">
        <thead className="bg-blue-100 text-blue-900 font-semibold uppercase text-xs">
          <tr>
            <th className="px-4 py-3">Catégorie</th>
            <th className="px-4 py-3 text-center text-green-700 bg-green-50/50">Entrées (Achats)</th>
            <th className="px-4 py-3 text-center text-red-700 bg-red-50/50">Sorties (Ventes)</th>
            <th className="px-4 py-3 text-center text-orange-700 bg-orange-50/50">Ajustements (+/-)</th>
            <th className="px-4 py-3 text-center bg-gray-100">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Object.entries(drmData).map(([color, stats]: [string, { in: number, out: number, adjust: number }]) => (
            <tr key={color} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-4 font-medium text-gray-700">{color}</td>
              <td className="px-4 py-4 text-center font-mono text-green-600 font-bold">+{stats.in}</td>
              <td className="px-4 py-4 text-center font-mono text-red-600 font-bold">-{stats.out}</td>
              <td className="px-4 py-4 text-center font-mono font-bold text-orange-600">
                {stats.adjust > 0 ? '+' : ''}{stats.adjust}
              </td>
              <td className="px-4 py-4 text-center font-bold text-gray-800 bg-gray-50/50">
                {stats.in - stats.out + stats.adjust > 0 ? '+' : ''}{stats.in - stats.out + stats.adjust}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
