
import React from 'react';
import { LayoutDashboard, Wine, FileText, ShoppingCart, BookOpen, Settings, Users, Globe, PackagePlus, X } from 'lucide-react';

const CorkscrewIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 2v20" />
    <path d="M8 8h8" />
    <path d="M8 4h8" />
    <path d="M12 22c-2.5-3-5-6-2-9s5-2 5-6" />
    <path d="M12 22c2.5-3 5-6 2-9s-5-2-5-6" />
    <path d="M7 21h10" />
  </svg>
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
  const navButtonClass = (view: string) => 
    `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === view ? 'bg-red-800 text-white shadow-lg shadow-red-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`;

  const handleNavClick = (view: string) => {
    onViewChange(view);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-64 bg-slate-900 text-white flex flex-col fixed h-full z-50 print:hidden
        transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-900 rounded-lg">
              <CorkscrewIcon className="w-6 h-6 text-red-100" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">La Cave des Peress</h1>
              <p className="text-xs text-slate-400">Pro Edition</p>
            </div>
          </div>
          {/* Close button for mobile */}
          <button 
            onClick={onCloseMobile}
            className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => handleNavClick('dashboard')} className={navButtonClass('dashboard')}>
            <LayoutDashboard size={20} /><span className="font-medium">Tableau de bord</span>
          </button>
          <button onClick={() => handleNavClick('inventory')} className={navButtonClass('inventory')}>
            <Wine size={20} /><span className="font-medium">Inventaire</span>
          </button>
          <button onClick={() => handleNavClick('purchases')} className={navButtonClass('purchases')}>
            <PackagePlus size={20} /><span className="font-medium">Achats / Stock</span>
          </button>
          <button onClick={() => handleNavClick('domains')} className={navButtonClass('domains')}>
            <Globe size={20} /><span className="font-medium">Domaines</span>
          </button>
          <button onClick={() => handleNavClick('sales')} className={navButtonClass('sales')}>
            <ShoppingCart size={20} /><span className="font-medium">Vente / Caisse</span>
          </button>
          <button onClick={() => handleNavClick('clients')} className={navButtonClass('clients')}>
            <Users size={20} /><span className="font-medium">Clients & Dépôts</span>
          </button>
          <button onClick={() => handleNavClick('accounting')} className={navButtonClass('accounting')}>
            <FileText size={20} /><span className="font-medium">Comptabilité</span>
          </button>
          <button onClick={() => handleNavClick('wine_menu')} className={navButtonClass('wine_menu')}>
            <BookOpen size={20} /><span className="font-medium">Carte des Vins</span>
          </button>
        </nav>
        
        <div className="p-4 border-t border-slate-800 space-y-2">
          <button onClick={() => handleNavClick('settings')} className={navButtonClass('settings')}>
            <Settings size={20} /><span className="font-medium">Paramètres</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;