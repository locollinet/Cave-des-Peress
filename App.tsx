
import React, { useState } from 'react';
import { useAppController } from './hooks';
import { Domain, Wine, Client } from './types';
import { Menu } from 'lucide-react';

// Components
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Cart from './components/Cart';
import Purchases from './components/Purchases';
import Accounting from './components/Accounting';
import WineMenu from './components/WineMenu';
import SettingsView from './components/SettingsView';
import Clients from './components/Clients';
import Domains from './components/Domains';
import GeneralAccounting from './components/GeneralAccounting';
import VatReport from './components/VatReport'; // NEW
import MobileInventory from './components/MobileInventory';
import StrategicAnalysis from './components/StrategicAnalysis';
import { StockLog } from './components/StockLog';
import DomainModal from './components/DomainModal';
import WineModal from './components/WineModal';
import ClientModal from './components/ClientModal';
import AdjustmentModal from './components/AdjustmentModal';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data, actions } = useAppController();
  
  // --- ÉTATS POUR LE TRANSFERT (Inventaire -> Vente/Achat) ---
  const [transferSelection, setTransferSelection] = useState<string[]>([]);

  // --- ÉTATS GLOBAUX POUR LES MODALES ---
  
  // Domaine
  const [domainToEdit, setDomainToEdit] = useState<Domain | null>(null);
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false);

  // Vin
  const [wineToEdit, setWineToEdit] = useState<Wine | null>(null);
  const [wineInitialData, setWineInitialData] = useState<Partial<Wine> | undefined>(undefined);
  const [isWineModalOpen, setIsWineModalOpen] = useState(false);

  // Client
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  // Ajustement Stock
  const [wineToAdjust, setWineToAdjust] = useState<Wine | null>(null);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);


  // --- HANDLERS D'OUVERTURE ---

  const handleEditDomain = (domainId: string) => {
    const domain = data.domains.find(d => d.id === domainId);
    if (domain) {
      setDomainToEdit(domain);
      setIsDomainModalOpen(true);
    } else if (domainId === 'new') {
        // Cas création explicite
        setDomainToEdit(null);
        setIsDomainModalOpen(true);
    }
  };

  const handleEditWine = (wineId: string | null, initialData?: Partial<Wine>) => {
    if (wineId) {
        const wine = data.wines.find(w => w.id === wineId);
        if (wine) {
            setWineToEdit(wine);
            setWineInitialData(undefined);
            setIsWineModalOpen(true);
        } else {
            alert("Cette référence n'existe plus dans le catalogue.");
        }
    } else {
        // Mode Création (ou duplication si initialData fourni)
        setWineToEdit(null);
        setWineInitialData(initialData);
        setIsWineModalOpen(true);
    }
  };

  const handleEditClient = (clientId: string | null) => {
      if (clientId) {
          const client = data.clients.find(c => c.id === clientId);
          if (client) {
              setClientToEdit(client);
              setIsClientModalOpen(true);
          }
      } else {
          setClientToEdit(null);
          setIsClientModalOpen(true);
      }
  };

  // --- HANDLERS DE SAUVEGARDE (Intermédiaires vers actions) ---

  const handleSaveDomain = (domainData: Partial<Domain>) => {
    if (domainToEdit) {
      actions.handleUpdateDomain(domainToEdit.id, domainData);
    } else {
      actions.handleAddDomain({
        id: `d_${Date.now()}`,
        name: domainData.name!,
        region: domainData.region!,
        coefficient: domainData.coefficient!,
        isArchived: false
      });
    }
  };

  const handleSaveWine = (wineData: Wine, domainName?: string, domainCoef?: number, domainRegion?: string) => {
      if (wineToEdit) {
          // Update
          actions.handleUpdateProduct(wineData); // Le modal renvoie l'objet complet avec ID
      } else {
          // Create
          actions.handleAddProduct(wineData, domainName, domainCoef, domainRegion);
      }
  };

  const handleSaveClient = (clientData: Client) => {
      if (clientToEdit) {
          actions.handleClientUpdate(clientData);
      } else {
          actions.handleAddClient(clientData);
      }
  };

  // --- HANDLER TRANSFERT INVENTAIRE ---
  const handleTransferTo = (wineIds: string[], destination: 'sales' | 'purchases') => {
    setTransferSelection(wineIds);
    setCurrentView(destination);
  };

  const clearTransferSelection = () => {
    setTransferSelection([]);
  };

  const totalBottles = data.wines.reduce((acc, w) => acc + (w.stock || 0), 0);

  return (
    <div className="flex min-h-screen bg-ivory-100 flex-col md:flex-row text-slate-800">
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        logo={data.logo}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        totalBottles={totalBottles}
      />

      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-lin-200 p-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-700 hover:text-slate-900 focus:outline-none">
            <Menu size={24} />
          </button>
          <span className="font-serif font-bold text-bordeaux-950 truncate">La Cave des Pères</span>
        </div>
      </div>

      <main className="md:ml-64 flex-1 p-3 md:p-6 overflow-x-hidden print:ml-0 print:p-0 relative">
        {currentView !== 'sales' && (
          <header className="flex justify-between items-center mb-4 md:mb-6 print:hidden">
            <div>
              <h2 className="font-serif text-xl md:text-2xl font-bold text-bordeaux-950">
                {currentView === 'dashboard' && 'Vue d\'ensemble de la Cave'}
                {currentView === 'projection' && 'Pilotage & Analyse Stratégique'}
                {currentView === 'inventory' && 'Gestion & Inventaire des Vins'}
                {currentView === 'mobile_inventory' && ''} 
                {currentView === 'purchases' && 'Achats & Réception de Cuvées'}
                {currentView === 'domains' && 'Domaines Viticoles & Terroirs'}
                {currentView === 'clients' && 'Comptes Clients & Stocks Déportés'}
                {currentView === 'accounting' && 'Facturation & Devis'}
                {currentView === 'bilan' && 'Bilan d\'Exploitation & Trésorerie'}
                {currentView === 'vat_report' && 'Bilan TVA & Déclarations Douanières'}
                {currentView === 'wine_menu' && 'Carte des Vins'}
                {currentView === 'stock_log' && 'Journal des Mouvements de Stock'}
                {currentView === 'settings' && 'Paramètres'}
              </h2>
            </div>
          </header>
        )}

        {currentView === 'dashboard' && (
          <Dashboard 
            wines={data.wines} 
            domains={data.domains}
            invoices={data.invoices} 
            movements={data.stockMovements} 
            clients={data.clients} 
            expenses={data.expenses} // Passed to fix the overhead calculation
          />
        )}
        {currentView === 'stock_log' && (
          <StockLog 
            movements={data.stockMovements}
            wines={data.wines}
            domains={data.domains}
          />
        )}
        {currentView === 'projection' && (
          <StrategicAnalysis
            wines={data.wines}
            invoices={data.invoices}
            movements={data.stockMovements}
            clients={data.clients}
            expenses={data.expenses}
            domains={data.domains}
            selectedYear="all"
          />
        )}
        {currentView === 'inventory' && (
          <Inventory 
            wines={data.wines} 
            domains={data.domains} 
            clients={data.clients}
            invoices={data.invoices} 
            stockMovements={data.stockMovements} 
            facCount={data.facCount} 
            proCount={data.proCount}
            onStockUpdate={actions.handleStockUpdate} 
            onAddProduct={actions.handleAddProduct}
            onUpdateProduct={actions.handleUpdateProduct}
            onDeleteProduct={actions.handleDeleteProduct}
            onUpdateDomain={actions.handleUpdateDomain}
            onToggleArchive={actions.handleToggleArchive}
            onRestoreBackup={() => {}} 
            onResetData={() => {}} 
            onEditDomain={handleEditDomain} 
            onEditWine={handleEditWine}
            onTransferTo={handleTransferTo}
            onConfirmPurchase={actions.handleReception}
          />
        )}
        {currentView === 'mobile_inventory' && (
          <MobileInventory 
            wines={data.wines} 
            domains={data.domains}
            onStockUpdate={actions.handleStockUpdate}
            onOpenAdjustmentModal={(wine) => { setWineToAdjust(wine); setIsAdjustmentModalOpen(true); }}
            onAddProduct={actions.handleAddProduct}
            onExit={() => setCurrentView('dashboard')}
            onEditDomain={handleEditDomain} 
            onEditWine={handleEditWine}
          />
        )}
        {currentView === 'purchases' && (
          <Purchases 
            wines={data.wines} 
            domains={data.domains} 
            stockMovements={data.stockMovements}
            invoices={data.invoices}
            initialSelection={transferSelection}
            onClearInitialSelection={clearTransferSelection}
            onConfirmPurchase={actions.handleReception}
            onCancelPurchase={actions.handleCancelReception}
            onDeleteInvoice={actions.handleDeleteInvoice}
            onUpdatePurchaseItem={actions.handleUpdateReceptionItem}
            onUpdateShippingCost={actions.handleUpdateReceptionShippingCost}
            onEditDomain={handleEditDomain}
            onEditWine={handleEditWine}
            onUpdatePayment={actions.handleUpdatePurchasePayment}
            onAddDomain={actions.handleAddDomain}
            onAddProduct={actions.handleAddProduct}
          />
        )}
        {currentView === 'domains' && (
          <Domains 
            domains={data.domains} 
            onAddDomain={actions.handleAddDomain}
            onUpdateDomain={actions.handleUpdateDomain}
            onDeleteDomain={actions.handleDeleteDomain}
            onEditDomain={handleEditDomain} 
          />
        )}
        {currentView === 'sales' && (
          <Cart 
             wines={data.wines} 
             domains={data.domains} 
             clients={data.clients} 
             initialSelection={transferSelection}
             onClearInitialSelection={clearTransferSelection}
             onCreateInvoice={(clientName, items, type, shipping) => {
                actions.handleCreateInvoice(clientName, items, type, undefined, shipping);
                setCurrentView('accounting');
             }}
             onEditDomain={handleEditDomain}
             onEditWine={handleEditWine}
             onEditClient={handleEditClient}
          />
        )}
        {currentView === 'clients' && (
          <Clients 
            clients={data.clients} 
            wines={data.wines} 
            domains={data.domains} 
            invoices={data.invoices}
            logo={data.logo}
            onUpdateClient={actions.handleClientUpdate}
            onAddClient={actions.handleAddClient}
            onDeleteClient={actions.handleDeleteClient}
            onCreateInvoice={(name, items, type, clientId) => {
               actions.handleCreateInvoice(name, items, type, clientId);
               setCurrentView('accounting');
            }}
            onStockTransfer={actions.handleStockTransfer}
            onBulkStockTransfer={actions.handleBulkStockTransfer}
            onEditDomain={handleEditDomain}
            onEditWine={handleEditWine}
            onEditClient={handleEditClient}
          />
        )}
        {currentView === 'accounting' && (
          <Accounting 
            invoices={data.invoices}
            clients={data.clients}
            wines={data.wines}
            domains={data.domains}
            stockMovements={data.stockMovements}
            onUpdateStatus={actions.handleInvoiceStatusUpdate}
            onUpdateInvoice={actions.handleUpdateInvoice}
            onRenumberInvoice={actions.handleRenumberInvoice}
            onDeleteInvoice={actions.handleDeleteInvoice}
            logo={data.logo} 
            onEditClient={handleEditClient}
            onEditWine={handleEditWine}
            onImportHistoricalInvoice={actions.handleImportHistoricalInvoice}
          />
        )}
        {currentView === 'bilan' && (
          <GeneralAccounting 
            defaultTab="report"
            expenses={data.expenses}
            categories={data.expenseCategories}
            assets={data.assets}
            invoices={data.invoices}
            stockMovements={data.stockMovements}
            onAddExpense={actions.handleAddExpense}
            onDeleteExpense={actions.handleDeleteExpense}
            onAddCategory={actions.handleAddCategory}
            onDeleteCategory={actions.handleDeleteCategory}
            onAddAsset={actions.handleAddAsset}
            onDeleteAsset={actions.handleDeleteAsset}
          />
        )}
        {currentView === 'vat_report' && (
          <VatReport 
            invoices={data.invoices}
            expenses={data.expenses}
            wines={data.wines}
            domains={data.domains}
          />
        )}
        {currentView === 'wine_menu' && <WineMenu wines={data.wines} domains={data.domains} isEmbedded={true} logo={data.logo} onUpdateWine={actions.handleUpdateProduct} onEditWine={() => handleEditWine(null)} />}
        {currentView === 'settings' && (
          <SettingsView
            wines={data.wines} domains={data.domains} invoices={data.invoices} stockMovements={data.stockMovements} facCount={data.facCount} proCount={data.proCount}
            logo={data.logo} 
            onLogoUpdate={actions.setLogo}
          />
        )}

        {/* --- MODALES GLOBALES --- */}
        
        <DomainModal 
          isOpen={isDomainModalOpen}
          onClose={() => setIsDomainModalOpen(false)}
          domain={domainToEdit || undefined}
          onSave={handleSaveDomain}
        />

        <WineModal
          isOpen={isWineModalOpen}
          onClose={() => setIsWineModalOpen(false)}
          wine={wineToEdit || undefined}
          initialData={wineInitialData}
          wines={data.wines}
          domains={data.domains}
          invoices={data.invoices}
          clients={data.clients}
          onSave={handleSaveWine}
        />

        <ClientModal
          isOpen={isClientModalOpen}
          onClose={() => setIsClientModalOpen(false)}
          client={clientToEdit || undefined}
          onSave={handleSaveClient}
        />

        <AdjustmentModal 
          isOpen={isAdjustmentModalOpen}
          onClose={() => setIsAdjustmentModalOpen(false)}
          wine={wineToAdjust}
          onConfirm={actions.handleStockUpdate}
        />

      </main>
    </div>
  );
}

export default App;
