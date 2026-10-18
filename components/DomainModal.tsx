import React, { useState, useEffect } from 'react';
import { Globe, Save } from 'lucide-react';
import { Domain } from '../types';
import SlideOver from './SlideOver';

interface DomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain?: Domain; // Si undefined, mode création
  onSave: (domainData: Partial<Domain>) => void;
}

export const DomainModal: React.FC<DomainModalProps> = ({ isOpen, onClose, domain, onSave }) => {
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

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={domain ? 'Modifier le Domaine' : 'Nouveau Domaine'}
      subtitle={domain ? domain.name : 'Ajouter un producteur viticole au catalogue'}
      icon={<Globe className="text-rose-400" size={20} />}
      widthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">
            Nom du Domaine
          </label>
          <input 
            type="text" 
            required 
            className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all font-medium text-slate-100 placeholder-slate-500 text-sm" 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Domaine Leflaive"
          />
        </div>
        
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">
            Région Viticole
          </label>
          <input 
            type="text" 
            required
            placeholder="Ex: Bourgogne"
            className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all text-slate-100 placeholder-slate-500 text-sm" 
            value={region} 
            onChange={(e) => setRegion(e.target.value)} 
          />
        </div>
        
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">
            Coefficient Multiplicateur par Défaut
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">x</span>
            <input 
              type="number" 
              step="0.1" 
              required
              className="w-full pl-8 pr-3.5 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all font-mono font-bold text-base text-rose-300" 
              value={coefficient} 
              onChange={(e) => setCoefficient(e.target.value)} 
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Ce coefficient s'appliquera par défaut au calcul du prix de vente des cuvées de ce domaine.
          </p>
        </div>

        <div className="pt-6 border-t border-slate-800/80 flex gap-3">
          <button 
            type="button" 
            onClick={onClose} 
            className="flex-1 px-4 py-2.5 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors text-sm"
          >
            Annuler
          </button>
          <button 
            type="submit" 
            className="flex-1 px-4 py-2.5 bg-rose-900/90 hover:bg-rose-800 text-rose-100 border border-rose-700/50 rounded-lg font-semibold shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
          >
            <Save size={16} /> Enregistrer
          </button>
        </div>
      </form>
    </SlideOver>
  );
};

export default DomainModal;
