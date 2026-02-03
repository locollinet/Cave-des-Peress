
import React, { useRef } from 'react';
import { ImageIcon, Save, Upload, AlertTriangle } from 'lucide-react';
import { Wine, Domain, Invoice, StockMovement } from '../types';

const SettingsView = ({
  wines,
  domains,
  invoices,
  stockMovements,
  facCount,
  proCount,
  logo,
  onLogoUpdate,
  isSimulation,
  onToggleSimulation
}: {
  wines: Wine[],
  domains: Domain[],
  invoices: Invoice[],
  stockMovements: StockMovement[],
  facCount: number,
  proCount: number,
  logo: string,
  onLogoUpdate: (newLogo: string) => void,
  isSimulation: boolean,
  onToggleSimulation: (val: boolean) => void
}) => {
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const handleFullBackup = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      wines,
      domains,
      invoices,
      stockMovements,
      facCount,
      proCount,
      logo
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `BACKUP_CAVE_PERESS_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 500000) {
        alert("L'image est trop volumineuse (Max 500Ko). Veuillez la réduire.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
         const result = e.target?.result as string;
         onLogoUpdate(result);
      }
      reader.readAsDataURL(file);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* SECTION SIMULATION MODE */}
      <div className={`rounded-xl shadow-sm border p-6 transition-colors ${isSimulation ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`}>
         <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isSimulation ? 'text-orange-800' : 'text-gray-800'}`}>
           <AlertTriangle size={20} /> Mode Simulation (Sandbox)
         </h2>
         <div className="flex items-center justify-between">
            <div className="mr-6">
               <p className={`text-sm mb-1 font-medium ${isSimulation ? 'text-orange-900' : 'text-gray-700'}`}>Activer le mode "Bac à sable"</p>
               <p className={`text-xs ${isSimulation ? 'text-orange-700' : 'text-gray-500'}`}>
                  Une fois activé, toutes les modifications (factures, stock, clients) seront <strong>simulées</strong>. 
                  Rien ne sera enregistré dans la base de données. Idéal pour tester sans risque.
               </p>
            </div>
            <button 
               onClick={() => onToggleSimulation(!isSimulation)}
               className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 ${isSimulation ? 'bg-orange-600' : 'bg-gray-200'}`}
            >
               <span className="sr-only">Toggle Simulation</span>
               <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isSimulation ? 'translate-x-5' : 'translate-x-0'}`}
               />
            </button>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
         <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
           <ImageIcon size={20} /> Personnalisation
         </h2>
         <div className="p-4 border border-gray-100 bg-gray-50 rounded-lg flex items-center gap-6">
            <div className="shrink-0 w-32 h-32 bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
               {logo ? (
                 <img src={logo} alt="Logo actuel" className="w-full h-full object-contain" />
               ) : (
                 <span className="text-xs text-gray-400 text-center px-2">Aucun logo personnalisé</span>
               )}
            </div>
            <div className="flex-1">
               <h4 className="font-semibold text-gray-900 mb-1">Logo de l'entreprise</h4>
               <p className="text-sm text-gray-500 mb-4">Ce logo apparaîtra en haut à gauche de toutes vos factures et devis. (Format conseillé: PNG transparent ou JPG, max 500Ko)</p>
               <input 
                  type="file" 
                  accept="image/png, image/jpeg"
                  ref={logoInputRef}
                  className="hidden"
                  onChange={handleLogoUpload}
               />
               <div className="flex gap-3">
                 <button onClick={() => logoInputRef.current?.click()} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium">
                   Choisir un fichier...
                 </button>
                 {logo && (
                   <button onClick={() => onLogoUpdate('')} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium">
                     Supprimer
                   </button>
                 )}
               </div>
            </div>
         </div>
      </div>

       <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
         <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
           <Save size={20} /> Sauvegarde Locale (Sécurité)
         </h2>
         <div className="p-4 border border-blue-100 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Export JSON</h4>
            <p className="text-sm text-blue-700 mb-4">Téléchargez une copie complète de vos données (stock, factures, clients) sur votre ordinateur pour archivage personnel.</p>
            <button onClick={handleFullBackup} className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2">
              <Upload size={16} className="rotate-180"/> Télécharger Sauvegarde (.json)
            </button>
         </div>
       </div>
    </div>
  );
};

export default SettingsView;
