
import React, { useRef } from 'react';
import { ImageIcon, Save, Upload, AlertTriangle, RotateCcw } from 'lucide-react';
import { Wine, Domain, Invoice, StockMovement } from '../types';
import { DEFAULT_LOGO_URL } from '../utils';

const SettingsView = ({
  wines,
  domains,
  invoices,
  stockMovements,
  facCount,
  proCount,
  logo,
  onLogoUpdate
}: {
  wines: Wine[],
  domains: Domain[],
  invoices: Invoice[],
  stockMovements: StockMovement[],
  facCount: number,
  proCount: number,
  logo: string,
  onLogoUpdate: (newLogo: string) => void
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
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
         <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
           <ImageIcon size={20} /> Personnalisation
         </h2>
         <div className="p-4 border border-gray-100 bg-gray-50 rounded-lg flex items-center gap-6">
            <div className="shrink-0 w-36 h-24 bg-white rounded-lg border border-gray-200 flex items-center justify-center p-2 overflow-hidden shadow-xs">
               <img 
                 src={logo && logo.length > 50 ? logo : DEFAULT_LOGO_URL} 
                 alt="Logo de l'entreprise" 
                 className="w-full h-full object-contain" 
               />
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
                   <button onClick={() => onLogoUpdate('')} className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium flex items-center gap-2">
                     <RotateCcw size={16} /> Réinitialiser (Défaut)
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
