import React, { useState, useMemo } from 'react';
import { Search, Filter, Download, History, Calendar, ArrowUpCircle, ArrowDownCircle, AlertCircle, Info, Scale } from 'lucide-react';
import { StockMovement, Wine, WineColor, Domain } from '../types';
import * as XLSX from 'xlsx';

interface StockLogProps {
  movements: StockMovement[];
  wines: Wine[];
  domains: Domain[];
}

export const StockLog: React.FC<StockLogProps> = ({ movements, wines, domains }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().substring(0, 7)); // Current month YYYY-MM
  const [filterColor, setFilterColor] = useState<string>('all');
  const [selectedExportYear, setSelectedExportYear] = useState<number>(new Date().getFullYear());

  // Extract years dynamically from movements for the fiscal export dropdown
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    movements.forEach(m => {
      if (m.date) {
        const yr = new Date(m.date).getFullYear();
        if (!isNaN(yr)) {
          yearsSet.add(yr);
        }
      }
    });
    // Fallback: at least current calendar year of 2026 is always available
    yearsSet.add(new Date().getFullYear());
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [movements]);

  // Handle SheetJS Excel export organized perfectly by wine categories & reasons
  const handleExportExcel = (year: number) => {
    // 1. Get ONLY adjustments of stock for the selected fiscal year
    const yearAdjustments = movements.filter(m => {
      if (m.type !== 'ADJUST') return false;
      const mDate = new Date(m.date);
      return mDate.getFullYear() === year;
    });

    if (yearAdjustments.length === 0) {
      alert(`Aucun ajustement de stock (casse, dégustation, écart...) n'a été enregistré pour l'exercice fiscal ${year}.`);
      return;
    }

    // 2. Tab 1: Category of wine (Color) summarized grouping
    // Grouping by wine categories allows direct excise duty / tax reconciliations
    const byColorMap: { [key: string]: { qty: number; val: number; refs: string[] } } = {};
    yearAdjustments.forEach(m => {
      const wine = wines.find(w => w.id === m.wineId);
      const color = wine ? wine.color : 'Autre';
      const buyingPrice = wine ? wine.buyingPriceHT : 0;
      const valuation = m.quantity * buyingPrice;

      if (!byColorMap[color]) {
        byColorMap[color] = { qty: 0, val: 0, refs: [] };
      }
      byColorMap[color].qty += m.quantity;
      byColorMap[color].val += valuation;
      if (wine && !byColorMap[color].refs.includes(wine.name)) {
        byColorMap[color].refs.push(wine.name);
      }
    });

    const categorySummaryData = Object.entries(byColorMap).map(([color, stats]) => ({
      'Catégorie de Vin (Couleur)': color,
      'Total Bouteilles Ajustées': stats.qty,
      'Valorisation Financière HT (€)': Number(stats.val.toFixed(2)),
      'Références Principales Impactées': stats.refs.slice(0, 5).join(', ') + (stats.refs.length > 5 ? '...' : '')
    }));

    // Add total row at the bottom for easier accounting validation
    const totalColorQty = categorySummaryData.reduce((sum, item) => sum + item['Total Bouteilles Ajustées'], 0);
    const totalColorVal = categorySummaryData.reduce((sum, item) => sum + item['Valorisation Financière HT (€)'], 0);
    categorySummaryData.push({
      'Catégorie de Vin (Couleur)': 'TOTAL AUX COMPTES MATIÈRES',
      'Total Bouteilles Ajustées': totalColorQty,
      'Valorisation Financière HT (€)': Number(totalColorVal.toFixed(2)),
      'Références Principales Impactées': ''
    });

    // 3. Tab 2: Category of Reasons summarized grouping (Justifies losses like casse vs. tastings)
    const byReasonMap: { [key: string]: { qty: number; val: number; count: number } } = {};
    yearAdjustments.forEach(m => {
      const reason = m.reason || 'Correction de stock';
      const wine = wines.find(w => w.id === m.wineId);
      const buyingPrice = wine ? wine.buyingPriceHT : 0;
      const valuation = m.quantity * buyingPrice;

      if (!byReasonMap[reason]) {
        byReasonMap[reason] = { qty: 0, val: 0, count: 0 };
      }
      byReasonMap[reason].qty += m.quantity;
      byReasonMap[reason].val += valuation;
      byReasonMap[reason].count += 1;
    });

    const reasonSummaryData = Object.entries(byReasonMap).map(([reason, stats]) => ({
      'Motif d’Ajustement (Catégorie)': reason,
      'Nombre d’Écritures Comptabilisées': stats.count,
      'Total Flacons Impactés': stats.qty,
      'Impact Financier HT (€)': Number(stats.val.toFixed(2))
    }));

    const totalReasonQty = reasonSummaryData.reduce((sum, item) => sum + item['Total Flacons Impactés'], 0);
    const totalReasonVal = reasonSummaryData.reduce((sum, item) => sum + item['Impact Financier HT (€)'], 0);
    const totalReasonCount = reasonSummaryData.reduce((sum, item) => sum + item['Nombre d’Écritures Comptabilisées'], 0);
    reasonSummaryData.push({
      'Motif d’Ajustement (Catégorie)': 'TOTAL EXERCICE COMPTABLE',
      'Nombre d’Écritures Comptabilisées': totalReasonCount,
      'Total Flacons Impactés': totalReasonQty,
      'Impact Financier HT (€)': Number(totalReasonVal.toFixed(2))
    });

    // 4. Tab 3: Detailed chronological audit log of adjustments for full tracking
    const detailedData = yearAdjustments.map(m => {
      const wine = wines.find(w => w.id === m.wineId);
      const domain = wine ? domains.find(d => d.id === wine.domainId) : null;
      const buyingPrice = wine ? wine.buyingPriceHT : 0;
      const valuation = m.quantity * buyingPrice;

      return {
        'Date': new Date(m.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        'Heure': new Date(m.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        'ID Écriture': m.id,
        'Nom du Vin': m.wineName,
        'Domaine': domain ? domain.name : 'Catalogue Général / Inconnu',
        'Région': (wine?.region || domain?.region) || 'Autre',
        'Catégorie de Vin (Couleur)': wine ? wine.color : 'Inconnue',
        'Format': wine ? wine.format : 'Bouteille (75cl)',
        'Quantité Ajustée': m.quantity,
        'Prix de Revient unitaire HT (€)': buyingPrice,
        'Valorisation Ajustement HT (€)': Number(valuation.toFixed(2)),
        'Justification / Motif': m.reason || 'Correction manuelle'
      };
    });

    // Create a new empty workbook
    const wb = XLSX.utils.book_new();

    // Worksheets creation
    const wsColor = XLSX.utils.json_to_sheet(categorySummaryData);
    const wsReason = XLSX.utils.json_to_sheet(reasonSummaryData);
    const wsDetails = XLSX.utils.json_to_sheet(detailedData);

    // Append sheets
    XLSX.utils.book_append_sheet(wb, wsColor, '1. Synthèse par Couleur');
    XLSX.utils.book_append_sheet(wb, wsReason, '2. Synthèse par Motif');
    XLSX.utils.book_append_sheet(wb, wsDetails, '3. Journal Détail Écritures');

    // Automatically compute columns widths to avoid content wrapping or overflow in Excel
    [wsColor, wsReason, wsDetails].forEach(ws => {
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const colsWidths = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        let maxWidth = 15;
        for (let R = range.s.r; R <= range.e.r; ++R) {
          const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });
          const cell = ws[cell_ref];
          if (cell && cell.v) {
            maxWidth = Math.max(maxWidth, String(cell.v).length + 3);
          }
        }
        colsWidths.push({ wch: maxWidth });
      }
      ws['!cols'] = colsWidths;
    });

    // Save and download to file system
    XLSX.writeFile(wb, `Justificatif_Ajustements_Stock_${year}.xlsx`);
  };

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const movementDate = new Date(m.date);
      const movementMonth = movementDate.toISOString().substring(0, 7);
      
      const wine = wines.find(w => w.id === m.wineId);
      const matchesSearch = !searchTerm || 
        m.wineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.reason || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.provider || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.reference || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'all' || m.type === filterType;
      const matchesMonth = !filterMonth || movementMonth === filterMonth;
      const matchesColor = filterColor === 'all' || (wine && wine.color === filterColor);

      return matchesSearch && matchesType && matchesMonth && matchesColor;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [movements, searchTerm, filterType, filterMonth, filterColor, wines]);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'IN': return <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100 uppercase"><ArrowUpCircle size={12}/> Entrée</span>;
      case 'OUT': return <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 uppercase"><ArrowDownCircle size={12}/> Sortie</span>;
      case 'ADJUST': return <span className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100 uppercase"><AlertCircle size={12}/> Ajustement</span>;
      case 'TRANSFER': return <span className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase"><History size={12}/> Transfert</span>;
      default: return <span className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 uppercase">Transfert</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* --- FISCAL AUDIT EXPORT CARD --- */}
      <div className="bg-slate-900 text-white p-5 rounded-xl shadow-sm border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-400 font-serif italic text-sm font-bold uppercase tracking-wider">
            <Scale size={16} /> Contrôle Fiscal & Douanes l’État (Régie)
          </div>
          <h3 className="text-lg font-bold">Justificatif Annuel des Ajustements</h3>
          <p className="text-slate-300 text-xs max-w-2xl">
            Conformément aux obligations de la comptabilité matières des négociants en vins, exportez pour votre expert-comptable ou l'administration fiscale une extraction Excel officielle multi-onglets détaillant et synthétisant vos écarts de stock, casses, et dégustations par couleur et par motif.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3 w-full lg:w-auto shrink-0">
          <div className="flex-1 sm:flex-initial">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Exercice Fiscal</label>
            <select 
              value={selectedExportYear}
              onChange={(e) => setSelectedExportYear(Number(e.target.value))}
              className="w-full sm:w-auto px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-mono focus:ring-2 focus:ring-red-500 outline-none"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr}>Année {yr}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => handleExportExcel(selectedExportYear)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 hover:bg-red-700 bg-red-800 text-white text-sm font-bold rounded-lg shadow-sm transition-all cursor-pointer h-[38px]"
          >
            <Download size={16} /> Exporter en Excel
          </button>
        </div>
      </div>

      {/* --- FILTERS AREA --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Rechercher un vin / raison</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
              placeholder="Ex: Spiritueux, Inventaire..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Mois</label>
          <input 
            type="month" 
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-red-500"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Type de mouvement</label>
          <select 
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-red-500"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">Tous les types</option>
            <option value="IN">Entrées (Achats)</option>
            <option value="OUT">Sorties (Ventes)</option>
            <option value="ADJUST">Ajustements manuels</option>
            <option value="TRANSFER">Transferts (Dépôt/Retour)</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Couleur</label>
          <select 
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-red-500"
            value={filterColor}
            onChange={(e) => setFilterColor(e.target.value)}
          >
            <option value="all">Toutes les couleurs</option>
            {Object.values(WineColor).filter(v => isNaN(Number(v)) && v !== 'Autre').map(color => (
              <option key={color} value={color}>{color}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={() => {
            setSearchTerm(''); setFilterType('all'); setFilterColor('all'); 
            setFilterMonth(new Date().toISOString().substring(0, 7));
          }}
          className="px-4 py-2 text-slate-500 hover:text-red-700 text-sm font-medium transition-colors"
        >
          Réinitialiser
        </button>
      </div>

      {/* --- DATA GRID --- (Recipe 1 Style) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-serif italic text-xs uppercase tracking-wider">Date & Heure</th>
                <th className="px-6 py-4 font-serif italic text-xs uppercase tracking-wider">Vin / Référence</th>
                <th className="px-6 py-4 font-serif italic text-xs uppercase tracking-wider text-center">Type</th>
                <th className="px-6 py-4 font-serif italic text-xs uppercase tracking-wider text-right">Quantité (Cols)</th>
                <th className="px-6 py-4 font-serif italic text-xs uppercase tracking-wider">Raison / Commentaire</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMovements.map((move) => {
                const isPositive = move.type === 'IN' || (move.type === 'ADJUST' && move.quantity > 0);
                const isNeutral = move.type === 'TRANSFER';
                const quantityColor = isNeutral ? 'text-blue-600' : (isPositive ? 'text-green-600' : 'text-red-600');
                const quantityPrefix = isNeutral ? '±' : (isPositive ? '+' : '');
                
                return (
                  <tr key={move.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-mono text-slate-600">
                        {new Date(move.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {new Date(move.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{move.wineName}</div>
                      {move.provider && <div className="text-xs text-slate-400 italic">Preuve/Fournisseur : {move.provider}</div>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-block">{getTypeBadge(move.type)}</div>
                    </td>
                    <td className={`px-6 py-4 text-right font-mono font-bold text-lg ${quantityColor}`}>
                      {quantityPrefix}{move.quantity}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-500 max-w-xs truncate" title={move.reason}>
                        {move.reason || <span className="text-slate-300 italic">Sans motif</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Info size={32} className="opacity-20" />
                      <p>Aucun mouvement trouvé pour ces critères.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer info */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 font-medium">
          <div>Total Movements: {filteredMovements.length}</div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Entrée</div>
             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Sortie</div>
             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Ajustement</div>
          </div>
        </div>
      </div>
    </div>
  );
};
