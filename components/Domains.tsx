
import React, { useState } from 'react';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { Domain } from '../types';

const Domains = ({ 
  domains, 
  onAddDomain,
  onUpdateDomain,
  onDeleteDomain,
  onEditDomain
}: { 
  domains: Domain[],
  onAddDomain: (domain: Domain) => void,
  onUpdateDomain: (id: string, updates: Partial<Domain>) => void,
  onDeleteDomain: (id: string) => void,
  onEditDomain: (id: string) => void
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDomains = domains.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.region.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Rechercher un domaine..." 
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
         </div>
         <button 
           onClick={() => onEditDomain('new')}
           className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
         >
           <Plus size={18} />
           Nouveau Domaine
         </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
            <thead className="bg-gray-50 border-b border-gray-200">
               <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Domaine</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Région (Défaut)</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Coefficient</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
               {filteredDomains.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                     <td className="px-6 py-4 font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => onEditDomain(d.id)}>
                        {d.name}
                     </td>
                     <td className="px-6 py-4 text-gray-600">{d.region}</td>
                     <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold border border-blue-100">
                           x{d.coefficient}
                        </span>
                     </td>
                     <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                           <button onClick={() => onEditDomain(d.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Modifier">
                              <Pencil size={16} />
                           </button>
                           <button onClick={() => onDeleteDomain(d.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Supprimer">
                              <Trash2 size={16} />
                           </button>
                        </div>
                     </td>
                  </tr>
               ))}
               {filteredDomains.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500 italic">Aucun domaine trouvé.</td></tr>
               )}
            </tbody>
         </table>
         </div>
      </div>
    </div>
  );
};

export default Domains;
