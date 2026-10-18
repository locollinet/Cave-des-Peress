import React, { useState } from 'react';
import { Wine } from '../types';
import { ADJUSTMENT_REASONS } from '../constants';
import SlideOver from './SlideOver';
import { Scale, Check } from 'lucide-react';

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  wine: Wine | null;
  onConfirm: (id: string, newStock: number, reason: string) => void;
}

export const AdjustmentModal: React.FC<AdjustmentModalProps> = ({ 
  isOpen, 
  onClose, 
  wine, 
  onConfirm 
}) => {
  const [adjustmentQuantity, setAdjustmentQuantity] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState(ADJUSTMENT_REASONS[0]);

  if (!wine) return null;

  const currentStock = wine.stock || 0;
  const targetStock = currentStock + adjustmentQuantity;

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title="Ajustement de Stock"
      subtitle={`${wine.name} (${wine.vintage || 'NV'})`}
      icon={<Scale className="text-amber-400" size={20} />}
      widthClass="max-w-md"
    >
      <div className="space-y-5">
        {/* Résumé stock actuel */}
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
          <div>
            <span className="text-[11px] text-slate-400 font-sans block">Stock Actuel</span>
            <span className="text-xl font-bold font-mono text-slate-200 tabular-nums">{currentStock}</span>
            <span className="text-xs text-slate-500 ml-1">btls</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-sans block">Nouveau Stock</span>
            <span className={`text-xl font-bold font-mono tabular-nums ${targetStock < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {targetStock}
            </span>
            <span className="text-xs text-slate-500 ml-1">btls</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">
            Variation (+ pour ajout, - pour retrait)
          </label>
          <div className="relative">
            <input 
              type="number" 
              className="w-full px-4 py-3 bg-slate-800/90 border border-slate-700/80 rounded-lg text-lg font-mono font-bold text-slate-100 outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500" 
              value={adjustmentQuantity} 
              onChange={(e) => setAdjustmentQuantity(Number(e.target.value))} 
              autoFocus
            />
          </div>
          {/* Raccourcis rapides */}
          <div className="flex gap-2 mt-2">
            {[-12, -6, -1, 1, 6, 12].map(delta => (
              <button
                key={delta}
                type="button"
                onClick={() => setAdjustmentQuantity(prev => prev + delta)}
                className="px-2.5 py-1 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">
            Motif de Régularisation
          </label>
          <select 
            className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500" 
            value={adjustmentReason} 
            onChange={(e) => setAdjustmentReason(e.target.value)}
          >
            {ADJUSTMENT_REASONS.map(r => <option key={r} value={r} className="bg-slate-900 text-slate-200">{r}</option>)}
          </select>
        </div>

        <div className="pt-6 border-t border-slate-800/80 flex gap-3">
          <button 
            type="button"
            onClick={onClose} 
            className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium text-sm transition-colors"
          >
            Annuler
          </button>
          <button 
            type="button"
            onClick={() => {
              onConfirm(wine.id, targetStock, adjustmentReason);
              onClose();
            }} 
            className="flex-1 px-4 py-2.5 bg-rose-900/90 hover:bg-rose-800 text-rose-100 border border-rose-700/50 rounded-lg font-semibold shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
          >
            <Check size={16} /> Valider l'Ajustement
          </button>
        </div>
      </div>
    </SlideOver>
  );
};

export default AdjustmentModal;
