
import React, { useState } from 'react';
import { FileClock, X, Save, Calendar, User, Euro } from 'lucide-react';
import { Invoice, CartItem, WineColor } from '../types';

interface HistoricalInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (invoice: Invoice) => void;
  existingClientNames: string[];
}

const HistoricalInvoiceModal: React.FC<HistoricalInvoiceModalProps> = ({ isOpen, onClose, onConfirm, existingClientNames }) => {
  const [clientName, setClientName] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [amountHT, setAmountHT] = useState('');
  const [vatRate, setVatRate] = useState(20);
  const [paymentMethod, setPaymentMethod] = useState('Virement');

  // Suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const filteredClients = existingClientNames.filter(name => name.toLowerCase().includes(clientName.toLowerCase())).slice(0, 5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !invoiceId || !amountHT) return;

    const totalHT = parseFloat(amountHT);
    const totalTVA = Math.round((totalHT * (vatRate / 100)) * 100) / 100;
    const totalTTC = Math.round((totalHT + totalTVA) * 100) / 100;

    // Formatage dates DD/MM/YYYY
    const [invY, invM, invD] = invoiceDate.split('-');
    const formattedInvDate = `${invD}/${invM}/${invY}`;
    
    const [payY, payM, payD] = paymentDate.split('-');
    const formattedPayDate = `${payD}/${payM}/${payY}`;

    // Création d'un item fictif pour la structure de données
    const dummyItem: CartItem = {
        id: `hist_item_${Date.now()}`,
        domainId: 'historical',
        name: 'Import Historique / Forfait',
        vintage: '',
        color: WineColor.Red,
        buyingPriceHT: 0,
        sellingPriceHT: totalHT,
        stock: 0,
        format: 'Unité',
        quantity: 1,
        isService: true, // Astuce pour éviter confusion stock si jamais
        fromExternalStock: false
    };

    const invoice: Invoice = {
        id: invoiceId,
        date: formattedInvDate,
        invoiceDate: formattedInvDate,
        clientName,
        items: [dummyItem],
        totalHT,
        totalTVA,
        totalTTC,
        discount: 0,
        status: 'Paid',
        type: 'Sale',
        paymentMethod,
        paymentDate: formattedPayDate
    };

    onConfirm(invoice);
    onClose();
    // Reset form simplified
    setInvoiceId('');
    setAmountHT('');
    setClientName('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-purple-100 flex justify-between items-center bg-purple-50">
          <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2">
            <FileClock size={20} /> Import Facture Historique
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full p-1">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 bg-yellow-50 text-yellow-800 text-xs border-b border-yellow-100">
           <strong>Attention :</strong> Cette fonction permet d'ajouter une ancienne facture pour la comptabilité et la TVA.<br/>
           Elle n'impactera <strong>pas</strong> le stock actuel. La facture sera marquée comme "Payée".
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
           <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Numéro Facture</label>
                 <input 
                    type="text" 
                    required 
                    placeholder="ex: FAC-2023-001"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-purple-500 outline-none"
                    value={invoiceId}
                    onChange={(e) => setInvoiceId(e.target.value)}
                 />
              </div>
              <div className="relative">
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Client</label>
                 <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                        type="text" 
                        required 
                        placeholder="Nom du client"
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        value={clientName}
                        onChange={(e) => { setClientName(e.target.value); setShowSuggestions(true); }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    />
                 </div>
                 {showSuggestions && filteredClients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 shadow-lg rounded-b-lg z-10 max-h-40 overflow-y-auto">
                        {filteredClients.map(name => (
                            <div 
                                key={name} 
                                className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                                onClick={() => setClientName(name)}
                            >
                                {name}
                            </div>
                        ))}
                    </div>
                 )}
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date Émission</label>
                 <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                        type="date" 
                        required 
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                    />
                 </div>
              </div>
              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date Paiement (TVA)</label>
                 <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                        type="date" 
                        required 
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-green-50"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                    />
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-3 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
               <div className="col-span-1">
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Montant HT</label>
                   <div className="relative">
                        <input 
                            type="number" 
                            step="0.01" 
                            required 
                            className="w-full pl-2 pr-6 py-2 border border-gray-300 rounded text-sm font-bold text-right focus:ring-2 focus:ring-purple-500 outline-none"
                            value={amountHT}
                            onChange={(e) => setAmountHT(e.target.value)}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                   </div>
               </div>
               <div className="col-span-1">
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Taux TVA</label>
                   <select 
                      className="w-full py-2 px-1 border border-gray-300 rounded text-sm bg-white outline-none"
                      value={vatRate}
                      onChange={(e) => setVatRate(parseFloat(e.target.value))}
                   >
                       <option value={20}>20%</option>
                       <option value={10}>10%</option>
                       <option value={5.5}>5.5%</option>
                       <option value={0}>0%</option>
                   </select>
               </div>
               <div className="col-span-1">
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total TTC</label>
                   <div className="py-2 px-2 text-right font-bold text-gray-900 text-sm">
                       {amountHT ? (parseFloat(amountHT) * (1 + vatRate/100)).toFixed(2) : '0.00'} €
                   </div>
               </div>
           </div>
           
           <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Moyen de paiement</label>
                <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm outline-none bg-white"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                >
                    <option value="Virement">Virement</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Espèces">Espèces</option>
                    <option value="CB">Carte Bancaire</option>
                </select>
           </div>

           <div className="pt-4 flex justify-end gap-3">
               <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">Annuler</button>
               <button type="submit" className="px-6 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
                   <Save size={16} /> Importer
               </button>
           </div>
        </form>
      </div>
    </div>
  );
};

export default HistoricalInvoiceModal;
