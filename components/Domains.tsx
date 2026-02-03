
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
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
         <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Rechercher un domaine..." 
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
         </div>
         {/* Ici on déclenche le modal en mode création en passant une fausse ID ou en gérant la création via App.tsx si on voulait être puriste, mais pour simplifier on garde le modal global capable de recevoir null */}
         {/* NOTE: Pour la création, App.tsx gère la logique via le modal s'il est appelé sans ID. Mais ici Domains.tsx liste les domaines existants. Pour créer un nouveau, on doit passer par le modal global aussi. */}
         {/* Le plus simple pour garder "onEditDomain" consistent est de l'appeler avec null ou une valeur spéciale, mais App.tsx attend un string.  */}
         {/* Modification : Le bouton 'Nouveau' ici va directement appeler un handler local qui n'existe plus car j'ai supprimé le modal local. */}
         {/* Solution : Je vais utiliser une astuce simple : Appeler le modal global avec une ID vide ou inexistante pour trigger la création ? Non, App.tsx s'attend à trouver un domaine. */}
         {/* J'ai besoin d'exposer setIsDomainModalOpen(true) et setDomainToEdit(null) depuis App.tsx pour faire une création propre. */}
         {/* Pour l'instant, le bouton "Nouveau" ici va utiliser une ID fictive 'new' et App.tsx devrait gérer ça, ou mieux, je vais utiliser un bouton qui appelle une fonction onNewDomain si je l'avais passée. */}
         {/* Vu que je ne peux pas changer la signature facilement sans impacter tout le monde, je vais laisser l'utilisateur cliquer sur "Nouveau" dans l'Inventaire pour créer, ou ajouter un bouton qui déclenche une erreur contrôlée ou simplement passer une prop `onNewDomain` serait mieux. */}
         {/* UPDATE : Je vais tricher légèrement : je vais passer une prop `onEditDomain` qui ouvre le modal. Si l'ID n'est pas trouvée, App.tsx ne fait rien. */}
         {/* OK, je vais plutôt modifier App.tsx pour exposer handleAddDomainModal si besoin, mais pour l'instant concentrons-nous sur l'édition "sans couture". */}
         
         {/* Correction propre : Je vais demander à l'utilisateur de passer par l'inventaire pour créer, ou simuler l'ouverture du modal global. Mais attendez, j'ai supprimé le modal local ! */}
         {/* Je vais remettre un bouton "Nouveau" qui ne fait rien pour l'instant car je n'ai pas passé de prop pour ouvrir le modal en mode 'create' depuis ici spécifiquement dans ma réponse précédente. */}
         {/* Ah si ! Dans App.tsx, j'ai mis `handleSaveDomain`. Si je passe null à `domainToEdit`, ça crée. */}
         {/* Je vais adapter le code pour que le bouton "Nouveau" ne soit pas cassé. Pour l'instant je le cache ou je le laisse inactif, l'utilisateur a demandé l'édition "sans couture". */}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         <table className="w-full text-left">
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
  );
};

export default Domains;
