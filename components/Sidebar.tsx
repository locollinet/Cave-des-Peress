import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Wine, FileText, ShoppingCart, BookOpen, Settings, 
  Users, Globe, PackagePlus, LineChart, ScanBarcode, Landmark, Scale, X, 
  History, Sparkles, CloudCheck, CheckCircle2
} from 'lucide-react';
import { DEFAULT_LOGO_URL } from '../utils';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  logo?: string;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  totalBottles?: number;
}

const SectionTitle = ({ title }: { title: string }) => (
  <div className="px-3 mt-5 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 font-sans">
    {title}
  </div>
);

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onViewChange,
  logo,
  isMobileOpen,
  onCloseMobile,
  totalBottles = 2916
}) => {
  const [imgSrc, setImgSrc] = useState(DEFAULT_LOGO_URL);

  useEffect(() => {
    if (logo && logo.length > 50) {
      setImgSrc(logo);
    } else {
      setImgSrc(DEFAULT_LOGO_URL);
    }
  }, [logo]);

  const navButtonClass = (view: string) => `
    w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs transition-all font-medium text-left
    ${currentView === view 
      ? 'bg-bordeaux-800 text-white shadow-sm font-semibold' 
      : 'text-slate-600 hover:bg-ivory-100 hover:text-bordeaux-900'
    }
  `;

  const handleNavClick = (view: string) => {
    onViewChange(view);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white text-slate-800 flex flex-col h-full print:hidden border-r border-lin-300 transform transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 shadow-xs font-sans`}>
        
        {/* LOGO & IDENTITÉ MAISON */}
        <div className="p-4 border-b border-lin-200 bg-ivory-50 flex flex-col items-center gap-2 shrink-0 relative">
          {/* Mobile Close Button */}
          <button 
            onClick={onCloseMobile}
            className="md:hidden absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-700"
          >
            <X size={20} />
          </button>

          <div className="w-full flex flex-col items-center text-center pt-1">
            <div className="w-12 h-12 rounded-xl bg-bordeaux-800 text-ivory-50 flex items-center justify-center shadow-sm mb-2">
              <Wine className="w-6 h-6 stroke-[1.5]" />
            </div>
            <h1 className="font-serif text-lg font-bold tracking-tight text-bordeaux-950">
              La Cave des Pères
            </h1>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">
              Maison de Vins & Négoce
            </p>
          </div>
        </div>

        {/* NAVIGATION VERTICALE */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto custom-scrollbar pb-24 md:pb-4 space-y-0.5">
          
          <SectionTitle title="Exploitation & Caisse" />
          <button onClick={() => handleNavClick('sales')} className={navButtonClass('sales')}>
            <ShoppingCart size={16} />
            <span>Point de Vente & Caisse</span>
          </button>
          <button onClick={() => handleNavClick('inventory')} className={navButtonClass('inventory')}>
            <Wine size={16} />
            <span>Inventaire de Cave</span>
          </button>
          <button onClick={() => handleNavClick('purchases')} className={navButtonClass('purchases')}>
            <PackagePlus size={16} />
            <span>Achats & Réceptions</span>
          </button>
          <button onClick={() => handleNavClick('stock_log')} className={navButtonClass('stock_log')}>
            <History size={16} />
            <span>Journal de Stock</span>
          </button>

          <SectionTitle title="Pilotage & Clients" />
          <button onClick={() => handleNavClick('dashboard')} className={navButtonClass('dashboard')}>
            <LayoutDashboard size={16} />
            <span>Vue d'ensemble</span>
          </button>
          <button onClick={() => handleNavClick('clients')} className={navButtonClass('clients')}>
            <Users size={16} />
            <span>Clients & Dépôts</span>
          </button>
          <button onClick={() => handleNavClick('domains')} className={navButtonClass('domains')}>
            <Globe size={16} />
            <span>Domaines & Terroirs</span>
          </button>
          <button onClick={() => handleNavClick('wine_menu')} className={navButtonClass('wine_menu')}>
            <BookOpen size={16} />
            <span>Carte des Vins</span>
          </button>

          <SectionTitle title="Comptabilité & Régie" />
          <button onClick={() => handleNavClick('accounting')} className={navButtonClass('accounting')}>
            <FileText size={16} />
            <span>Facturation & Devis</span>
          </button>
          <button onClick={() => handleNavClick('vat_report')} className={navButtonClass('vat_report')}>
            <Scale size={16} />
            <span>Bilan TVA & Douanes</span>
          </button>
          <button onClick={() => handleNavClick('bilan')} className={navButtonClass('bilan')}>
            <Landmark size={16} />
            <span>Bilan d'Exploitation</span>
          </button>
          <button onClick={() => handleNavClick('projection')} className={navButtonClass('projection')}>
            <LineChart size={16} />
            <span>Analyse Stratégique</span>
          </button>

          <SectionTitle title="Outils Mobiles" />
          <button onClick={() => handleNavClick('mobile_inventory')} className={navButtonClass('mobile_inventory')}>
            <ScanBarcode size={16} />
            <span>Pointage Chai Mobile</span>
          </button>
        </nav>
        
        {/* PIED DE NAVIGATION & STATUT CLOUD */}
        <div className="p-3 border-t border-lin-200 shrink-0 bg-ivory-50 space-y-2">
          <button onClick={() => handleNavClick('settings')} className={navButtonClass('settings')}>
            <Settings size={16} />
            <span>Paramètres de la Cave</span>
          </button>

          <div className="pt-1 flex items-center justify-between px-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5 font-medium text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Firebase Connecté
            </span>
            <span className="font-mono text-slate-400">v2.1</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
