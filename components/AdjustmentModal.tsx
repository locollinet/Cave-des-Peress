import React, { useState } from 'react';
import { Wine } from '../types';
import { ADJUSTMENT_REASONS } from '../constants';

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  wine: Wine | null;
  onConfirm: (id: string, newStock: number, reason: string) => void;
}

const AdjustmentModal: React.FC<AdjustmentModalProps> = ({ 
  isOpen, 
  onClose, 
  wine, 
  onConfirm 
}) => {
  const [adjustmentQuantity, setAdjustmentQuantity] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState(ADJUSTMENT_REASONS[0]);

  if (!isOpen || !wine) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[200]">
       <div className="bg-white p-6 rounded-lg max-w-sm w-full mx-4 shadow-xl">
          <h2 className="text-xl font-bold mb-4">Ajuster {wine.name}</h2>
          <label className="block mb-4">
             Quantité (positive pour ajouter, négative pour retirer):
             <input 
                type="number" 
                className="border p-2 w-full rounded" 
                value={adjustmentQuantity} 
                onChange={(e) => setAdjustmentQuantity(Number(e.target.value))} 
                autoFocus
             />
          </label>
          <label className="block mb-4">
             Raison:
             <select 
                className="border p-2 w-full rounded" 
                value={adjustmentReason} 
                onChange={(e) => setAdjustmentReason(e.target.value)}
             >
                {ADJUSTMENT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
             </select>
          </label>
          <div className="flex justify-end gap-2">
             <button 
                onClick={onClose} 
                className="px-4 py-2 bg-gray-200 rounded"
             >
                Annuler
             </button>
             <button 
                onClick={() => {
                   onConfirm(wine.id, wine.stock + adjustmentQuantity, adjustmentReason);
                   onClose();
                }} 
                className="px-4 py-2 bg-red-800 text-white rounded"
             >
                Confirmer
             </button>
          </div>
       </div>
    </div>
  );
};

export default AdjustmentModal;
