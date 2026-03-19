
import React, { useState } from 'react';
import { X, Calendar, CreditCard, Hash } from 'lucide-react';

const PaymentModal = ({ 
  isOpen, 
  onClose, 
  onConfirm 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: (date: string, method: string, reference: string) => void 
}) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('Virement');
  const [reference, setReference] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(new Date(date).toLocaleDateString('fr-FR'), method, reference);
    setReference('');
    setMethod('Virement');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-800">Enregistrer un paiement</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Calendar size={14}/> Date de paiement
            </label>
            <input 
              type="date" 
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <CreditCard size={14}/> Moyen de paiement
            </label>
            <select 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="Virement">Virement Bancaire</option>
              <option value="Chèque">Chèque</option>
              <option value="Espèces">Espèces</option>
              <option value="Carte Bancaire">Carte Bancaire</option>
              <option value="Compensation">Compensation</option>
              <option value="Sortie Perso">Sortie Perso (Comptable)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Hash size={14}/> Référence (Optionnel)
            </label>
            <input 
              type="text" 
              placeholder={method === 'Chèque' ? "N° Bordereau / Chèque" : "ID Transaction"}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
            {method === 'Chèque' && <p className="text-xs text-orange-600 mt-1">Recommandé pour les chèques.</p>}
          </div>
          <div className="pt-2 flex justify-end gap-3">
             <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
             <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Confirmer Paiement</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;
