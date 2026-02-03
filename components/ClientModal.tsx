
import React, { useState, useEffect } from 'react';
import { User, X, Save, Phone, Mail, MapPin } from 'lucide-react';
import { Client } from '../types';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client; // Si undefined, mode création
  onSave: (client: Client) => void;
}

const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, client, onSave }) => {
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneLandline, setPhoneLandline] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (client) {
        setName(client.name);
        setContactName(client.contactName || '');
        setEmail(client.email || '');
        setPhone(client.phone || '');
        setPhoneLandline(client.phoneLandline || '');
        setAddress(client.address || '');
      } else {
        setName('');
        setContactName('');
        setEmail('');
        setPhone('');
        setPhoneLandline('');
        setAddress('');
      }
    }
  }, [isOpen, client]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) {
      alert("Nom et Adresse obligatoires");
      return;
    }
    
    const finalClient: Client = {
      id: client?.id || `cli_${Date.now()}`,
      name,
      contactName,
      email,
      phone,
      phoneLandline,
      address,
      externalStock: client?.externalStock || []
    };

    onSave(finalClient);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
             <User className="text-blue-600" size={20} />
             {client ? 'Modifier le Client' : 'Nouveau Client'}
          </h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Nom de l'établissement / Client</label>
            <input 
              type="text" 
              required 
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-lg text-gray-900" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Restaurant L'Ogre"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Contact</label>
                <div className="relative">
                   <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                   <input type="text" className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg outline-none" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Nom du contact" />
                </div>
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                <div className="relative">
                   <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                   <input type="email" className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg outline-none" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@test.com" />
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Mobile</label>
                <div className="relative">
                   <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                   <input type="text" className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg outline-none" value={phone} onChange={e => setPhone(e.target.value)} placeholder="06..." />
                </div>
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Fixe</label>
                <div className="relative">
                   <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                   <input type="text" className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg outline-none" value={phoneLandline} onChange={e => setPhoneLandline(e.target.value)} placeholder="03..." />
                </div>
             </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Adresse Complète</label>
            <div className="relative">
               <MapPin className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
               <textarea 
                 required
                 className="w-full pl-9 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all h-24 resize-none" 
                 value={address} 
                 onChange={(e) => setAddress(e.target.value)} 
                 placeholder="Rue, Code Postal, Ville..."
               />
            </div>
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

export default ClientModal;
