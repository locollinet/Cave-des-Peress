
import { Wine, WineColor, Domain, Invoice, Client, CartItem, Asset } from './types';

// Logo La Cave des Peress vectorisé (SVG) - Reproduction fidèle
export const DEFAULT_LOGO_URL = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMDAgMTAwIj48ZGVmcz48c3R5bGU+LnJlZHtmaWxsOiM3ZjFkMWQ7fS5ncmVye2ZpbGw6IzMzMzt9LmxpZ2h0e2ZpbGw6Izg4ODt9PC9zdHlsZT48L2RlZnM+PCEtLSBJY29uZSBUaXJlLWJvdWNob24gLS0+PHBhdGggZD0iTTUwIDIwIEw1MCA4MCIgc3Ryb2tlPSIjN2YxZDFkIiBzdHJva2Utd2lkdGg9IjgiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xMCA1MCBRMjAgMzUgMzAgNTAgVDUwIDUwIiBmaWxsPSJub25lIiBzdHJva2U9IiM3ZjFkMWQiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PCEtLSBUZXh0ZSAtLT48dGV4dCB4PSI3MCIgeT0iMjgiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE4IiBjbGFzcz0ibGlnaHQiPkxhPC90ZXh0Pjx0ZXh0IHg9IjcwIiB5PSI1NSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSJib2xkIiBmb250LXNpemU9IjMzIiBjbGFzcz0iZ3JleSI+Y2F2ZTwvdGV4dD48dGV4dCB4PSIxNTUiIHk9IjU1IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgY2xhc3M9ImxpZ2h0Ij5kZXM8L3RleHQ+PHRleHQgeD0iNzAiIHk9Ijg1IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC13ZWlnaHQ9ImJvbGQiIGZvbnQtc2l6ZT0iMzMiIGNsYXNzPSJyZWQiIGxldHRlci1zcGFjaW5nPSIxIj5QRVJFU1M8L3RleHQ+PC9zdmc+";

/**
 * Convertit un format de bouteille en équivalent bouteille (75cl) pour la ventilation des frais de port.
 */
export const getBottleEquivalent = (format: string): number => {
  if (!format) return 1;
  const f = format.toLowerCase();
  if (f.includes('demi') || f.includes('37.5')) return 0.5;
  if (f.includes('magnum') || f.includes('1.5')) return 2;
  if (f.includes('jéroboam') || f.includes('jeroboam') || f.includes('3l') || f.includes('5l')) return 4; // Confirmé par l'utilisateur: Jéroboam = 4
  if (f.includes('réhoboam') || f.includes('rehoboam') || f.includes('4.5')) return 6;
  if (f.includes('mathusalem') || f.includes('6l')) return 8;
  if (f.includes('salmanazar') || f.includes('9l')) return 12;
  if (f.includes('balthazar') || f.includes('12l')) return 16;
  if (f.includes('nabuchodonosor') || f.includes('15l')) return 20;
  return 1; // Défaut: Bouteille 75cl
};

/**
 * Arrondi sécurisé à 2 décimales pour éviter les erreurs de virgule flottante JS.
 */
export const roundCurrency = (value: number): number => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

/**
 * Génère un UUID V4 robuste (compatible avec Supabase) avec fallback si crypto.randomUUID n'est pas dispo.
 */
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback simple compatible UUID V4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Moteur de calcul centralisé pour les factures avec gestion Multi-TVA et Remise.
 */
export const calculateInvoiceTotals = (items: CartItem[], shippingCost: number = 0, discount: number = 0) => {
  // 1. Calculer les bases HT par taux de TVA
  const breakdown: Record<number, { base: number, amount: number }> = {};
  let rawTotalHT = 0;

  // Items
  items.forEach(item => {
    const price = item.isGift ? 0 : item.sellingPriceHT;
    const lineTotalHT = roundCurrency(price * item.quantity);
    const rate = item.vatRate !== undefined ? item.vatRate : 20.0;

    if (!breakdown[rate]) breakdown[rate] = { base: 0, amount: 0 };
    breakdown[rate].base += lineTotalHT;
    
    rawTotalHT += lineTotalHT;
  });

  // Shipping (Considéré comme du service standard à 20% ou taux max, ici on fixe à 20% par défaut)
  if (shippingCost > 0) {
      const shippingRate = 20;
      if (!breakdown[shippingRate]) breakdown[shippingRate] = { base: 0, amount: 0 };
      breakdown[shippingRate].base += shippingCost;
      rawTotalHT += shippingCost;
  }

  // 2. Appliquer la remise (Discount)
  // La remise réduit la base imposable. On calcule un ratio de réduction.
  // Ratio = (TotalHT_Avant - Remise) / TotalHT_Avant
  
  let finalTotalHT = 0;
  let finalTotalTVA = 0;
  
  // Protection division par zéro
  const discountRatio = rawTotalHT > 0 ? (rawTotalHT - discount) / rawTotalHT : 1;
  const safeDiscountRatio = Math.max(0, discountRatio); // Pas de ratio négatif

  // 3. Recalculer les bases et TVA par taux après remise
  const finalBreakdown: Record<string, { base: number, amount: number }> = {};

  Object.keys(breakdown).forEach(rateStr => {
      const rate = parseFloat(rateStr);
      const originalBase = breakdown[rate].base;
      
      // La base réduite par le ratio de remise
      const discountedBase = roundCurrency(originalBase * safeDiscountRatio);
      
      // La TVA sur cette base réduite
      const tvaAmount = roundCurrency(discountedBase * (rate / 100));

      finalBreakdown[rateStr] = {
          base: discountedBase,
          amount: tvaAmount
      };

      finalTotalHT += discountedBase;
      finalTotalTVA += tvaAmount;
  });

  // Ajustement pour correspondre exactement au Total HT affiché (Raw - Discount) pour éviter les écarts d'arrondi
  // On force le Total HT final à être exactement (TotalBrut + Port - Remise)
  const targetTotalHT = Math.max(0, roundCurrency(rawTotalHT - discount));
  
  // S'il y a un petit écart d'arrondi sur la somme des bases, on l'absorbe sur le taux majoritaire (souvent 20%)
  if (finalTotalHT !== targetTotalHT && finalTotalHT > 0) {
      const diff = roundCurrency(targetTotalHT - finalTotalHT);
      // On cherche le taux à 20% ou le premier taux dispo
      const targetRate = finalBreakdown['20'] ? '20' : Object.keys(finalBreakdown)[0];
      if (targetRate) {
          finalBreakdown[targetRate].base = roundCurrency(finalBreakdown[targetRate].base + diff);
          // On recalcule la TVA de cette ligne pour être précis
          const newTva = roundCurrency(finalBreakdown[targetRate].base * (parseFloat(targetRate) / 100));
          const tvaDiff = newTva - finalBreakdown[targetRate].amount;
          finalBreakdown[targetRate].amount = newTva;
          finalTotalTVA = roundCurrency(finalTotalTVA + tvaDiff);
          finalTotalHT = targetTotalHT;
      }
  }

  const totalTTC = roundCurrency(finalTotalHT + finalTotalTVA);

  return {
    totalHT: finalTotalHT,
    shippingCost: roundCurrency(shippingCost),
    totalTVA: finalTotalTVA,
    totalTTC,
    vatBreakdown: finalBreakdown
  };
};

/**
 * Vérifie si une facture est de type "Purchase" (Rétro-documentation), de manière insensible à la casse.
 */
export const isPurchaseInvoice = (invoice: Invoice): boolean => {
  return invoice.type?.toLowerCase() === 'purchase';
};

/**
 * Parse une date de manière robuste, qu'elle soit au format DD/MM/YYYY ou YYYY-MM-DD
 */
export const parseSmartDate = (dateStr: string | undefined): Date | null => {
  if (!dateStr) return null;

  // Si c'est déjà un format ISO YYYY-MM-DD
  if (dateStr.includes('-')) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  // Si c'est au format DD/MM/YYYY
  if (dateStr.includes('/')) {
    const [day, month, year] = dateStr.split('/').map(Number);
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
};

/**
 * Calcule l'échéancier complet d'amortissement d'une immobilisation.
 * Règle: Arrondi à l'entier, prorata temporis la première année (360j), 
 * et solde la dernière année pour garantir que Total == Prix d'achat.
 */
export const calculateAssetDepreciationSchedule = (asset: { purchaseDate: string, startDepreciationDate?: string, amountHT: number, durationYears: number }) => {
  const depreciationStartDate = new Date(asset.startDepreciationDate || asset.purchaseDate);
  const purchaseYear = depreciationStartDate.getFullYear();
  const duration = asset.durationYears || 1;
  const totalHT = asset.amountHT;
  
  const schedule: { year: number, amount: number }[] = [];

  // Calcul de l'annuité de base (arrondi à l'entier)
  const annualBase = Math.round(totalHT / duration);

  // Calcul du prorata de la première année (Standard 360 jours)
  const day = depreciationStartDate.getDate();
  const month = depreciationStartDate.getMonth(); // 0-11
  
  const remainingDaysInMonth = Math.max(0, 30 - day + 1);
  const remainingFullMonths = 11 - month;
  const daysFirstYear = (remainingFullMonths * 30) + remainingDaysInMonth;
  
  const year1Amount = Math.round(annualBase * (daysFirstYear / 360));

  let cumulative = 0;
  // On peut aller jusqu'à duration + 1 si achat en cours d'année
  for (let i = 0; i <= duration; i++) {
    const currentYear = purchaseYear + i;
    let currentAmount = 0;

    if (i === 0) {
      currentAmount = Math.min(year1Amount, totalHT);
    } else if (cumulative < totalHT) {
      // Si c'est la "dernière" année théorique ou si le reste est inférieur à une annuité de base
      if (i === duration || (totalHT - cumulative) < annualBase) {
        currentAmount = totalHT - cumulative;
      } else {
        currentAmount = annualBase;
      }
    }

    if (currentAmount > 0) {
      schedule.push({ year: currentYear, amount: currentAmount });
      cumulative += currentAmount;
    }
    
    if (cumulative >= totalHT) break;
  }

  return schedule;
};

/**
 * Calcule l'amortissement d'une immobilisation pour une année spécifique.
 */
export const calculateAssetDepreciationForYear = (asset: { purchaseDate: string, amountHT: number, durationYears: number }, targetYear: number): number => {
  const schedule = calculateAssetDepreciationSchedule(asset);
  const entry = schedule.find(s => s.year === targetYear);
  return entry ? entry.amount : 0;
};

export const formatCurrency = (value: number) => 
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);

/**
 * Extrait l'année d'une date au format DD/MM/YYYY ou YYYY-MM-DD
 */
export const parseYear = (dateStr: string | undefined): number => {
  if (!dateStr) return 0;
  if (dateStr.includes('/')) {
    return parseInt(dateStr.split('/').pop() || '0');
  }
  return new Date(dateStr).getFullYear();
};

export const getColorBadgeClass = (color: WineColor) => {
  switch (color) {
    case WineColor.Red: return 'bg-red-100 text-red-800 border-red-200';
    case WineColor.White: return 'bg-yellow-50 text-yellow-800 border-yellow-200';
    case WineColor.Rose: return 'bg-pink-100 text-pink-800 border-pink-200';
    case WineColor.Sparkling: return 'bg-slate-100 text-slate-800 border-slate-200';
    case WineColor.Liquor: return 'bg-purple-100 text-purple-800 border-purple-200';
    case WineColor.Other: return 'bg-gray-100 text-gray-800 border-gray-200';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const getSmartCoefficient = (buyingPrice: number): number => {
  return buyingPrice < 70 ? 1.2 : 1.1;
};

export const getSellingPrice = (wine: Wine, domain?: Domain) => {
  if (wine.sellingPriceHT && wine.sellingPriceHT > 0) {
    return wine.sellingPriceHT;
  }
  if (wine.coefficient && wine.coefficient > 0) {
    return Math.ceil(wine.buyingPriceHT * wine.coefficient);
  }
  const baseCoef = domain?.coefficient || getSmartCoefficient(wine.buyingPriceHT);
  return Math.ceil(wine.buyingPriceHT * baseCoef);
};

export const printInvoice = (invoice: Invoice, clients: Client[], domains: any[], customLogo?: string) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Veuillez autoriser les pop-ups pour imprimer.");
    return;
  }

  let displayAddress = invoice.clientAddress;
  if (!displayAddress || displayAddress.trim() === '') {
      const client = clients.find(c => c.id === invoice.clientId) || clients.find(c => c.name.toLowerCase() === invoice.clientName.toLowerCase());
      if (client) {
          displayAddress = client.address || '';
      }
  }

  const title = invoice.status === 'ProForma' ? 'Devis / Pro Forma' : 'Facture';
  const logoUrl = customLogo && customLogo.length > 50 ? customLogo : DEFAULT_LOGO_URL;

  // Calculs avec la nouvelle logique
  const { totalHT, totalTVA, totalTTC, vatBreakdown, shippingCost } = calculateInvoiceTotals(
      invoice.items, 
      invoice.shippingCost || 0, 
      invoice.discount || 0
  );

  const hasMultipleVat = Object.keys(vatBreakdown).length > 0;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title} - ${invoice.id}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Montserrat:wght@300;400;500;600&display=swap');
          @page { margin: 1cm; size: A4; }
          body { font-family: 'Montserrat', sans-serif; font-size: 12px; line-height: 1.5; color: #1f2937; background: white; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
          
          /* LAYOUT PRINCIPAL pour éviter les superpositions et les lignes coupées */
          .page-container { 
              padding: 0 10px; 
              max-width: 210mm; 
              margin: 0 auto; 
              box-sizing: border-box;
              position: relative;
          }

          header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 60px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb; }
          .brand-section { display: flex; flex-direction: column; gap: 15px; width: 50%; }
          .logo-container { width: 100%; max-width: 300px; height: 100px; display: flex; align-items: center; overflow: visible; }
          .logo-img { max-width: 100%; max-height: 100%; object-fit: contain; object-position: left center; }
          .company-details { font-size: 11px; color: #4b5563; }
          .document-info { text-align: right; width: 45%; }
          .doc-title { font-family: 'Cormorant Garamond', serif; font-size: 36px; font-weight: 700; color: #111; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
          .doc-number { font-size: 14px; color: #6b7280; margin-top: 5px; }
          .meta-table { margin-top: 15px; margin-left: auto; border-collapse: collapse; }
          .meta-table td { padding: 2px 0 2px 15px; text-align: right; font-size: 12px; }
          .meta-label { color: #6b7280; }
          .meta-value { font-weight: 600; color: #111; }
          
          .address-section { display: flex; justify-content: flex-end; margin-bottom: 50px; }
          .client-box { width: 45%; padding: 0; }
          .client-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; display: inline-block; }
          .client-name { font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 700; color: #111; margin-bottom: 5px; }
          .client-address { font-size: 13px; color: #4b5563; white-space: pre-line; }
          
          .items-section { margin-bottom: 40px; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          .items-table tr { page-break-inside: avoid; break-inside: avoid; }
          .items-table th { text-align: left; padding: 12px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; border-bottom: 2px solid #111; font-weight: 600; }
          .items-table td { padding: 14px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; font-size: 12px; }
          .items-table tr:last-child td { border-bottom: 1px solid #111; }
          
          .col-desc { width: 45%; }
          .col-tva { width: 5%; text-align: center; font-size: 10px; color: #6b7280; }
          .col-qty { text-align: center; width: 10%; }
          .col-price { text-align: right; width: 20%; }
          .col-total { text-align: right; width: 20%; font-weight: 600; }
          .item-name { font-weight: 600; color: #111; display: block; }
          .item-meta { color: #6b7280; font-size: 11px; margin-top: 2px; }
          
          /* Footer Section qui contient Banque + Totaux */
          .footer-section { 
              display: flex; 
              justify-content: space-between; 
              align-items: flex-start; 
              margin-top: 20px;
              break-inside: avoid; /* Évite de couper le bloc */
              page-break-inside: avoid;
          }
          .bank-details { width: 45%; padding: 15px; background-color: #f9fafb; border-radius: 4px; font-size: 11px; color: #4b5563; }
          .rib-warning { color: #dc2626; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 8px; letter-spacing: 0.5px; }
          .totals-box { width: 45%; }
          .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
          .total-row.final { border-bottom: none; border-top: 2px solid #111; margin-top: 10px; padding-top: 15px; }
          .total-label { color: #6b7280; }
          .total-value { font-weight: 600; color: #111; }
          .final .total-label { font-family: 'Cormorant Garamond', serif; font-size: 18px; font-weight: 700; color: #111; }
          .final .total-value { font-family: 'Cormorant Garamond', serif; font-size: 24px; font-weight: 700; color: #111; }
          
          /* Legal Footer en bas du conteneur Flex */
          .legal-footer { 
              margin-top: 40px; 
              padding-top: 30px; 
              text-align: center; 
              font-size: 9px; 
              color: #9ca3af; 
              border-top: 1px solid #e5e7eb; 
          }
          
          .stamp { position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-15deg); font-size: 80px; font-weight: 700; text-transform: uppercase; opacity: 0.15; z-index: 0; pointer-events: none; border: 5px solid; padding: 10px 40px; }
          .stamp-paid { color: #059669; border-color: #059669; }
          .stamp-cancelled { color: #dc2626; border-color: #dc2626; }
          
          .vat-table { width: 100%; margin-top: 15px; font-size: 10px; border-collapse: collapse; }
          .vat-table th { text-align: right; color: #6b7280; font-weight: normal; border-bottom: 1px solid #eee; padding: 2px 0; }
          .vat-table td { text-align: right; color: #4b5563; padding: 2px 0; }
        </style>
      </head>
      <body>
        <div class="page-container">
          ${invoice.status === 'Paid' ? '<div class="stamp stamp-paid">PAYÉE</div>' : ''}
          ${invoice.status === 'Cancelled' ? '<div class="stamp stamp-cancelled">ANNULÉE</div>' : ''}
          
          <header>
            <div class="brand-section">
              <div class="logo-container">
                 <img src="${logoUrl}" alt="La Cave des Peress" class="logo-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                 <h1 style="display:none; font-family: 'Cormorant Garamond', serif; font-size: 28px; margin: 0; color: #7f1d1d;">La Cave des Peress</h1>
              </div>
              <div class="company-details"><strong>La Cave des Peress</strong><br>3 Rue du monument<br>21190 Puligny Montrachet<br>France<br><br>Tél : +33 6 10 84 79 02<br>Email : aurelio@cavedesperess.fr</div>
            </div>
            <div class="document-info">
              <h2 class="doc-title">${title}</h2>
              <div class="doc-number">${invoice.id}</div>
              <table class="meta-table">
                <tr><td class="meta-label">Date d'émission</td><td class="meta-value">${invoice.invoiceDate || invoice.date}</td></tr>
                ${invoice.status === 'ProForma' ? `<tr><td class="meta-label">Validité</td><td class="meta-value">30 jours</td></tr>` : ''}
                ${invoice.paymentDate ? `<tr><td class="meta-label">Date règlement</td><td class="meta-value">${invoice.paymentDate}</td></tr>` : ''}
              </table>
            </div>
          </header>

          <div class="address-section">
            <div class="client-box">
              <span class="client-label">Adresse de facturation</span>
              <div class="client-name">${invoice.clientName}</div>
              <div class="client-address">${displayAddress || ''}</div> 
            </div>
          </div>

          <div class="items-section">
            <table class="items-table">
              <thead>
                <tr><th class="col-desc">Désignation</th><th class="col-tva">TVA</th><th class="col-qty">Qté</th><th class="col-price">Prix Unit. HT</th><th class="col-total">Total HT</th></tr>
              </thead>
              <tbody>
                ${invoice.items.map(item => {
                   const lineTotal = roundCurrency(item.sellingPriceHT * item.quantity);
                   const vatRate = item.vatRate !== undefined ? item.vatRate : 20;
                   const domain = domains.find(d => d.id === item.domainId);
                   const domainName = domain ? domain.name : '';
                   return `
                  <tr>
                    <td>
                      <span class="item-name">${item.name} ${item.format && item.format !== 'Bouteille (75cl)' ? `(${item.format})` : ''}</span>
                      ${domainName ? `<div class="item-meta" style="font-size: 0.8em; color: #666;">${domainName}</div>` : ''}
                      ${item.isService ? '' : item.vintage || item.color ? `<div class="item-meta">${item.color || ''} ${item.vintage ? ' • ' + item.vintage : ''}</div>` : ''}
                    </td>
                    <td class="col-tva">${vatRate}%</td>
                    <td class="col-qty">${item.quantity}</td>
                    <td class="col-price">${item.isGift ? 'Offert' : formatCurrency(item.sellingPriceHT).replace('€', '') + ' €'}</td>
                    <td class="col-total">${item.isGift ? 'Offert' : formatCurrency(lineTotal).replace('€', '') + ' €'}</td>
                  </tr>
                `}).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer-section">
            <div class="bank-details">
              ${!invoice.paymentDate ? `
                <span class="rib-warning">Attention Nouveau RIB</span>
                <div style="margin-bottom: 8px;"><strong>Coordonnées bancaires</strong></div>
                <div style="display: grid; grid-template-columns: 80px auto; gap: 4px;">
                  <span>Banque :</span> <strong>Caisse d'Épargne</strong>
                  <span>IBAN :</span> <span style="font-family: monospace;">FR76 1213 5003 0008 0073 3282 269</span>
                  <span>BIC :</span> <span style="font-family: monospace;">CEPAFRRP213</span>
                </div>
              ` : `<div style="color: #059669; font-weight: 600;">✓ Règlement effectué par ${invoice.paymentMethod || 'virement'}.<br>Merci de votre confiance.</div>`}
            </div>
            
            <div class="totals-box">
              <div class="total-row"><span class="total-label">Total HT</span><span class="total-value">${formatCurrency(totalHT)}</span></div>
              ${shippingCost > 0 ? `<div class="total-row"><span class="total-label">Frais de port HT</span><span class="total-value">${formatCurrency(shippingCost)}</span></div>` : ''}
              <div class="total-row"><span class="total-label">Total TVA</span><span class="total-value">${formatCurrency(totalTVA)}</span></div>
              <div class="total-row final"><span class="total-label">Net à Payer</span><span class="total-value">${formatCurrency(totalTTC)}</span></div>
              
              ${hasMultipleVat ? `
                <table class="vat-table">
                    <tr><th>Taux</th><th>Base HT</th><th>Montant TVA</th></tr>
                    ${Object.entries(vatBreakdown).sort((a,b) => parseFloat(b[0]) - parseFloat(a[0])).map(([rate, data]) => `
                        <tr><td>${rate}%</td><td>${formatCurrency(data.base)}</td><td>${formatCurrency(data.amount)}</td></tr>
                    `).join('')}
                </table>
              ` : ''}
              <div style="margin-top: 10px; font-size: 11px; color: #4b5563; font-style: italic;">Livraison en droits acquittés</div>
            </div>
          </div>

          <div class="legal-footer">
             La Cave des Peress — EURL au capital de 5 000 € — 3 Rue du monument 21190 Puligny Montrachet<br>SIREN 751 886 649 — RCS Dijon — TVA Intracommunautaire : FR 37 751886649
          </div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
    </html>
  `;
  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

export const printWineMenu = (wines: Wine[], domains: Domain[], customLogo?: string) => {
  alert("Pour un export PDF parfait, pensez à DÉCOCHER l'option 'En-têtes et pieds de page' dans les paramètres d'impression de votre navigateur.");

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Veuillez autoriser les pop-ups pour imprimer.");
    return;
  }
  
  const grouped: Record<string, { domain: Domain, wines: Wine[] }[]> = {};
  const winesGroupedByEffectiveRegion: Record<string, Record<string, Wine[]>> = {};

  wines.forEach(w => {
    if (w.isArchived || w.stock <= 0) return;
    const domain = domains.find(d => d.id === w.domainId);
    if (!domain) return;
    
    const region = w.region || domain.region || "Autre";
    
    if (!winesGroupedByEffectiveRegion[region]) winesGroupedByEffectiveRegion[region] = {};
    if (!winesGroupedByEffectiveRegion[region][domain.id]) winesGroupedByEffectiveRegion[region][domain.id] = [];
    
    winesGroupedByEffectiveRegion[region][domain.id].push(w);
  });

  Object.keys(winesGroupedByEffectiveRegion).sort().forEach(region => {
      grouped[region] = [];
      const domainIds = Object.keys(winesGroupedByEffectiveRegion[region]);
      
      domainIds.sort((a, b) => {
        const dA = domains.find(d => d.id === a)?.name || "";
        const dB = domains.find(d => d.id === b)?.name || "";
        return dA.localeCompare(dB);
      });

      domainIds.forEach(dId => {
         const domain = domains.find(d => d.id === dId);
         if (domain) {
            grouped[region].push({
               domain: domain,
               wines: winesGroupedByEffectiveRegion[region][dId]
            });
         }
      });
  });

  const sortedRegions = Object.keys(grouped);
  const logoUrl = customLogo || DEFAULT_LOGO_URL;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Carte des Vins - La Cave des Peress</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Lato:wght@400;700&display=swap');
          @page { margin: 1cm; size: A4; }
          body { font-family: 'Lato', sans-serif; padding: 0; margin: 0; color: #1a1a1a; background: white; -webkit-print-color-adjust: exact; }
          
          /* Header */
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb; }
          .brand-section { display: flex; flex-direction: column; gap: 10px; width: 50%; }
          .logo-container { width: 100%; max-width: 200px; height: 80px; display: flex; align-items: center; }
          .logo-img { max-width: 100%; max-height: 100%; object-fit: contain; }
          .company-details { font-size: 10px; color: #4b5563; }
          .doc-info { text-align: right; width: 45%; }
          .doc-title { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 700; color: #111; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
          .doc-subtitle { font-size: 14px; color: #6b7280; margin-top: 5px; }

          /* Content */
          .content { column-count: 2; column-gap: 40px; }
          .region-section { margin-bottom: 30px; break-inside: avoid; }
          .region-title { font-family: 'Playfair Display', serif; font-size: 20px; color: #7f1d1d; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 2px; text-align: center; }
          .domain-block { margin-bottom: 20px; break-inside: avoid; }
          .domain-name { font-weight: bold; font-size: 15px; margin-bottom: 2px; color: #0f172a; }
          .domain-sub { font-size: 10px; color: #64748b; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px; }
          .wine-item { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px; font-size: 13px; break-inside: avoid; }
          .wine-name { flex: 1; position: relative; overflow: hidden; }
          .wine-name span { background: white; padding-right: 5px; position: relative; z-index: 1; }
          .wine-name::after { content: " . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . "; position: absolute; left: 0; bottom: 3px; z-index: 0; color: #cbd5e1; white-space: nowrap; }
          .wine-meta { display: flex; gap: 10px; background: white; padding-left: 5px; position: relative; z-index: 1; }
          .wine-vintage { font-style: italic; color: #64748b; font-size: 12px; width: 35px; text-align: right; }
          .wine-price { font-weight: bold; width: 55px; text-align: right; }
          
          /* Footer */
          .legal-footer { margin-top: 40px; padding-top: 20px; text-align: center; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="page-container" style="padding: 0 10px;">
          <header class="header">
            <div class="brand-section">
              <div class="logo-container">
                 <img src="${logoUrl}" alt="La Cave des Peress" class="logo-img" />
              </div>
              <div class="company-details"><strong>La Cave des Peress</strong><br>3 Rue du monument<br>21190 Puligny Montrachet<br>France<br>Tél : +33 6 10 84 79 02</div>
            </div>
            <div class="doc-info">
              <h2 class="doc-title">Carte des Vins</h2>
              <div class="doc-subtitle">Prix HT départ Cave</div>
            </div>
          </header>

          <div class="content">
            ${sortedRegions.map(region => `
              <div class="region-section">
                <div class="region-title">${region}</div>
                ${grouped[region].map(({ domain, wines }) => {
                   const effectiveSubRegion = wines[0].subRegion;
                   return `
                  <div class="domain-block">
                     <div class="domain-name">${domain.name}</div>
                     ${effectiveSubRegion ? `<div class="domain-sub">${effectiveSubRegion}</div>` : ''}
                     ${wines.map(w => {
                       const price = getSellingPrice(w, domain);
                       const formattedPrice = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
                       return `<div class="wine-item"><div class="wine-name"><span>${w.name} <span style="font-size: 10px; color: #64748b; font-style: italic; font-weight: normal;">(${w.color} - ${w.format})</span></span></div><div class="wine-meta"><span class="wine-vintage">${w.vintage}</span><span class="wine-price">${formattedPrice}</span></div></div>`;
                     }).join('')}
                  </div>
                `}).join('')}
              </div>
            `).join('')}
          </div>

          <div class="legal-footer">
             La Cave des Peress — EURL au capital de 5 000 € — 3 Rue du monument 21190 Puligny Montrachet<br>SIREN 751 886 649 — RCS Dijon — TVA Intracommunautaire : FR 37 751886649<br>L'abus d'alcool est dangereux pour la santé, à consommer avec modération.
          </div>
        </div>
        <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); }</script>
      </body>
    </html>
  `;
  printWindow.document.write(htmlContent);
  printWindow.document.close();
};
