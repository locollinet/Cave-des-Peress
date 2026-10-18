import React from 'react';
import { Menu, Plus, Wine, Users, Globe, Database, Search } from 'lucide-react';
import { Wine as WineType } from '../types';
import { formatCurrency } from '../utils';

interface TopbarProps {
  currentView: string;
  onOpenMobileMenu: () => void;
  onNewWine: () => void;
  onNewClient: () => void;
  onNewDomain: () => void;
  wines: WineType[];
  onOpenSearch?: () => void;
}

const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: "Tableau de Bord", subtitle: "Indicateurs d'activité & alertes de stock" },
  sales: { title: "Caisse & Vente", subtitle: "Catalogue viticole & émission de facture" },
  inventory: { title: "Stock & Inventaire", subtitle: "680 références de vins & coefficients CUMP" },
  purchases: { title: "Achats & Réception", subtitle: "Bons de livraison, factures fournisseurs & IA" },
  accounting: { title: "Factures & Devis", subtitle: "Suivi des règlements & historique comptable" },
  bilan: { title: "Bilan & Trésorerie", subtitle: "Comptabilité analytique & charges d'exploitation" },
  vat_report: { title: "TVA & Régie Douanière", subtitle: "Ventilation fiscale & balance DRM des matières" },
  stock_log: { title: "Journal des Mouvements", subtitle: "Traçabilité des entrées, sorties et ajustements" },
  clients: { title: "Clients & Dépôts", subtitle: "Fichier clients & stocks déportés chez les restaurateurs" },
  domains: { title: "Domaines Viticoles", subtitle: "203 vignerons & coefficients par défaut" },
  wine_menu: { title: "Carte des Vins", subtitle: "Visualisation & impression tarifaire" },
  projection: { title: "Stratégie & Analyse", subtitle: "Marges prévisionnelles & analyse de rotation" },
  mobile_inventory: { title: "Pointage Mobile au Chai", subtitle: "Saisie tactile plein écran pour smartphone" },
  settings: { title: "Paramètres", subtitle: "Configuration de la cave & numérotation" }
};

export const Topbar: React.FC<TopbarProps> = ({
  currentView,
  onOpenMobileMenu,
  onNewWine,
  onNewClient,
  onNewDomain,
  wines
}) => {
  const viewMeta = VIEW_TITLES[currentView] || { title: "La Cave des Pères", subtitle: "Gestion de cave & négoce" };

  const totalBottles = wines.reduce((acc, w) => acc + (w.stock || 0), 0);
  const totalStockValue = wines.reduce((acc, w) => acc + ((w.stock || 0) * (w.buyingPriceHT || 0)), 0);

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 px-4 md:px-6 py-3 flex items-center justify-between gap-4">
      {/* Left: Mobile Toggle & View Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm md:text-base font-semibold text-slate-100 tracking-tight truncate">
              {viewMeta.title}
            </h1>
            <span className="hidden sm:inline-block text-slate-600 font-mono text-xs">/</span>
            <span className="hidden sm:inline-block text-xs text-slate-400 truncate">
              {viewMeta.subtitle}
            </span>
          </div>
        </div>
      </div>

      {/* Center: Live KPI Strip (Desktop) */}
      <div className="hidden lg:flex items-center gap-5 text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-1.5 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/60">
          <span className="text-slate-500 font-sans">Stock cave:</span>
          <span className="text-slate-200 font-bold tabular-nums">{totalBottles.toLocaleString('fr-FR')}</span>
          <span className="text-[11px] text-slate-500 font-sans">btls</span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/60">
          <span className="text-slate-500 font-sans">Valeur HT:</span>
          <span className="text-emerald-400 font-bold tabular-nums">{formatCurrency(totalStockValue)}</span>
        </div>

        <div className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
          <span>Firebase Sync</span>
        </div>
      </div>

      {/* Right: Quick Action Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onNewWine}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-900/90 text-rose-100 hover:bg-rose-800 border border-rose-700/50 shadow-sm transition-all active:scale-95"
          title="Ajouter une cuvée"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Vin</span>
        </button>

        <button
          onClick={onNewClient}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60 transition-all active:scale-95"
          title="Ajouter un client"
        >
          <Users size={14} />
          <span className="hidden md:inline">Client</span>
        </button>

        <button
          onClick={onNewDomain}
          className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60 transition-all active:scale-95"
          title="Ajouter un domaine"
        >
          <Globe size={14} />
          <span>Domaine</span>
        </button>
      </div>
    </header>
  );
};

export default Topbar;
