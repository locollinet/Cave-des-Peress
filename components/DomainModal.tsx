
import React, { useState, useEffect } from 'react';
import { Globe, X, Save } from 'lucide-react';
import { Domain } from '../types';

interface DomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain?: Domain; // Si undefined, mode création
  onSave: (domainData: Partial<Domain>) => void;
}

const DomainModal: React.FC<DomainModalProps> = ({ isOpen, onClose, domain, onSave }) => {
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [coefficient, setCoefficient] = useState('1.5');

  useEffect(() => {
    if (isOpen) {
      if (domain) {
        setName(domain.name);
        setRegion(domain.region);
        setCoefficient(domain.coefficient.toString());
      } else {
        setName('');
        setRegion('');
        setCoefficient('1.5');
      }
    }
  }, [isOpen, domain]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !region) {
      alert("Nom et région obligatoires");
      return;
    }
    onSave({
      name,
      region,
      coefficient: parseFloat(coefficient)
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
             <Globe className="text-blue-600" size={20} />
             {domain ? 'Modifier le Domaine' : 'Nouveau Domaine'}
          </h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Nom du Domaine</label>
            <input 
              type="text" 
              required 
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-medium text-gray-900" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Domaine Leflaive"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Région</label>
            <input 
              type="text" 
              required
              placeholder="Ex: Bourgogne"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all" 
              value={region} 
              onChange={(e) => setRegion(e.target.value)} 
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Coefficient Multiplicateur</label>
            <div className="relative">
               <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">x</span>
               <input 
                 type="number" 
                 step="0.1" 
                 required
                 className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-mono font-bold text-lg text-blue-700" 
                 value={coefficient} 
                 onChange={(e) => setCoefficient(e.target.value)} 
               />
            </div>
            <p className="text-[10px] text-gray-400 mt-2 ml-1">Ce coefficient s'applique par défaut aux nouveaux vins créés pour ce domaine.</p>
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors">
              Annuler
            </button>
            <button type="submit" className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-transform active:scale-95">
               <Save size={18} /> Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DomainModal;
