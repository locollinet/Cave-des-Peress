import React, { useState, useEffect } from 'react';
import { User, Save, Phone, Mail, MapPin } from 'lucide-react';
import { Client } from '../types';
import SlideOver from './SlideOver';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client; // Si undefined, mode création
  onSave: (client: Client) => void;
}

export const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, client, onSave }) => {
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

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={client ? 'Modifier le Client' : 'Nouveau Compte Client'}
      subtitle={client ? client.name : 'Création de fiche client / restaurateur'}
      icon={<User className="text-rose-400" size={20} />}
      widthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">
            Nom de l'établissement / Client
          </label>
          <input 
            type="text" 
            required 
            className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all font-semibold text-base text-slate-100 placeholder-slate-500" 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Restaurant L'Ogre ou M. Dupont"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">Contact</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                className="w-full pl-9 pr-3 py-2 bg-slate-800/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-rose-500" 
                value={contactName} 
                onChange={e => setContactName(e.target.value)} 
                placeholder="Nom du contact" 
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="email" 
                className="w-full pl-9 pr-3 py-2 bg-slate-800/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-rose-500" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="contact@cave.fr" 
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">Mobile</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                className="w-full pl-9 pr-3 py-2 bg-slate-800/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-rose-500 font-mono" 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                placeholder="06 12 34 56 78" 
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">Fixe</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                className="w-full pl-9 pr-3 py-2 bg-slate-800/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-rose-500 font-mono" 
                value={phoneLandline} 
                onChange={e => setPhoneLandline(e.target.value)} 
                placeholder="03 80 00 00 00" 
              />
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">
            Adresse de Facturation & Livraison
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
            <textarea 
              required
              className="w-full pl-9 pr-3.5 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-rose-500 outline-none transition-all h-24 resize-none" 
              value={address} 
              onChange={(e) => setAddress(e.target.value)} 
              placeholder="Numéro, Rue&#10;Code Postal, Ville"
            />
          </div>
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

export default ClientModal;
