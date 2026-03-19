
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Wine, FileText, ShoppingCart, BookOpen, Settings, Users, Globe, PackagePlus, LineChart, ScanBarcode, Landmark, Scale, X } from 'lucide-react';
import { DEFAULT_LOGO_URL } from '../utils';

const SectionTitle = ({ title }: { title: string }) => (
  <div className="px-4 mt-6 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 font-sans">
    {title}
  </div>
);

const Sidebar = ({ 
  currentView, 
  onViewChange,
  logo,
  isMobileOpen,
  onCloseMobile
}: { 
  currentView: string, 
  onViewChange: (view: string) => void,
  logo?: string,
  isMobileOpen?: boolean,
  onCloseMobile?: () => void
}) => {
  const [imgSrc, setImgSrc] = useState(DEFAULT_LOGO_URL);

  useEffect(() => {
    // Si un logo perso existe (et semble valide > 50 chars), on tente de l'utiliser
    if (logo && logo.length > 50) {
      setImgSrc(logo);
    } else {
      setImgSrc(DEFAULT_LOGO_URL);
    }
  }, [logo]);

  const navButtonClass = (view: string) => 
    `w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm ${currentView === view ? 'bg-red-900 text-white shadow-md shadow-red-950/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`;

  const handleNavClick = (view: string) => {
    onViewChange(view);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col h-full print:hidden border-r border-slate-800 transform transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="p-4 border-b border-slate-800 flex flex-col items-center gap-3 shrink-0 relative">
          {/* Mobile Close Button */}
          <button 
            onClick={onCloseMobile}
            className="md:hidden absolute top-4 right-4 text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>

          <div className="w-full flex justify-center px-2 mt-4 md:mt-0">
             <div className="bg-white rounded-lg shadow-sm p-2 w-full flex items-center justify-center min-h-[60px]">
                <img 
                  src={imgSrc} 
                  alt="Cave des Peress" 
                  className="max-w-full h-auto max-h-16 object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== DEFAULT_LOGO_URL) {
                      target.src = DEFAULT_LOGO_URL;
                    }
                  }}
                />
             </div>
          </div>
        </div>
        
        <nav className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar pb-24 md:pb-4">
          
          <SectionTitle title="Pilotage" />
          <button onClick={() => handleNavClick('dashboard')} className={navButtonClass('dashboard')}>
            <LayoutDashboard size={18} /><span className="font-medium">Vue d'ensemble</span>
          </button>
          <button onClick={() => handleNavClick('projection')} className={navButtonClass('projection')}>
            <LineChart size={18} /><span className="font-medium">Stratégie & Analyse</span>
          </button>

          <SectionTitle title="Stocks & Appro" />
          <button onClick={() => handleNavClick('inventory')} className={navButtonClass('inventory')}>
            <Wine size={18} /><span className="font-medium">Gestion du Stock</span>
          </button>
          <button onClick={() => handleNavClick('purchases')} className={navButtonClass('purchases')}>
            <PackagePlus size={18} /><span className="font-medium">Achats & Réception</span>
          </button>

          <SectionTitle title="Commerce & Clients" />
          <button onClick={() => handleNavClick('sales')} className={navButtonClass('sales')}>
            <ShoppingCart size={18} /><span className="font-medium">Point de Vente</span>
          </button>
          <button onClick={() => handleNavClick('clients')} className={navButtonClass('clients')}>
            <Users size={18} /><span className="font-medium">Clients & Stocks</span>
          </button>

          <SectionTitle title="Finance" />
          <button onClick={() => handleNavClick('accounting')} className={navButtonClass('accounting')}>
            <FileText size={18} /><span className="font-medium">Facturation</span>
          </button>
          <button onClick={() => handleNavClick('general_accounting')} className={navButtonClass('general_accounting')}>
            <Landmark size={18} /><span className="font-medium">Trésorerie & Frais</span>
          </button>
          <button onClick={() => handleNavClick('vat_report')} className={navButtonClass('vat_report')}>
            <Scale size={18} /><span className="font-medium">Bilan TVA</span>
          </button>

          <SectionTitle title="Catalogue" />
          <button onClick={() => handleNavClick('domains')} className={navButtonClass('domains')}>
            <Globe size={18} /><span className="font-medium">Domaines</span>
          </button>
          <button onClick={() => handleNavClick('wine_menu')} className={navButtonClass('wine_menu')}>
            <BookOpen size={18} /><span className="font-medium">Carte des Vins</span>
          </button>

          <SectionTitle title="Outils" />
          <button onClick={() => handleNavClick('mobile_inventory')} className={navButtonClass('mobile_inventory')}>
            <ScanBarcode size={18} /><span className="font-medium">Scanner Mobile</span>
          </button>
        </nav>
        
        <div className="p-4 border-t border-slate-800 space-y-2 shrink-0 bg-slate-900">
          <button onClick={() => handleNavClick('settings')} className={navButtonClass('settings')}>
            <Settings size={18} /><span className="font-medium">Paramètres</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
