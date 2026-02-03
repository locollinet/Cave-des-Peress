
import { Wine, WineColor, Domain, Invoice, Client } from './types';

// Logo La Cave des Peress encodé en Base64 pour être stocké directement dans le code (fonctionne hors ligne)
export const DEFAULT_LOGO_URL = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MDAgMTUwIj48ZGVmcz48c3R5bGU+LnRleHR7Zm9udC1mYW1pbHk6J0hlbHZldGljYSBOZXVlJyxIZWx2ZXRpY2EsQXJpYWwsc2Fucy1zZXJpZn0ucmVke2ZpbGw6IzdmMWQxZDt9LmRhcmt7ZmlsbDojMWYyOTM3O308L3N0eWxlPjwvZGVmcz48cGF0aCBkPSJNMjAgNzUgUTMwIDYwIDQwIDc1IFQ2MCA3NSBUODAgNzUgTDEwNSA3NSBNMTA1IDQ1IEwxMDUgMTA1IiBzdHJva2U9IiM3ZjFkMWQiIHN0cm9rZS13aWR0aD0iNiIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHRleHQgeD0iMTIwIiB5PSI0NSIgY2xhc3M9InRleHQgZGFyayIgZm9udC1zaXplPSIyNCIgZm9udC13ZWlnaHQ9IjMwMCI+TGE8L3RleHQ+PHRleHQgeD0iMTIwIiB5PSI3OCIgY2xhc3M9InRleHQgZGFyayIgZm9udC1zaXplPSI0MiIgZm9udC13ZWlnaHQ9IjgwMCI+Y2F2ZTwvdGV4dD48dGV4dCB4PSIyMjUiIHk9Ijc4IiBjbGFzcz0idGV4dCBkYXJrIiBmb250LXNpemU9IjI0IiBmb250LXdlaWdodD0iMzAwIj5kZXM8L3RleHQ+PHRleHQgeD0iMTIwIiB5PSIxMTUiIGNsYXNzPSJ0ZXh0IHJlZCIgZm9udC1zaXplPSI0MiIgZm9udC13ZWlnaHQ9IjgwMCIgbGV0dGVyLXNwYWNpbmc9IjEiPlBFUkVTUzwvdGV4dD48L3N2Zz4=";

export const formatCurrency = (value: number) => 
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);

export const getColorBadgeClass = (color: WineColor) => {
  switch (color) {
    case WineColor.Red: return 'bg-red-100 text-red-800 border-red-200';
    case WineColor.White: return 'bg-yellow-50 text-yellow-800 border-yellow-200';
    case WineColor.Rose: return 'bg-pink-100 text-pink-800 border-pink-200';
    case WineColor.Sparkling: return 'bg-slate-100 text-slate-800 border-slate-200';
    case WineColor.Liquor: return 'bg-purple-100 text-purple-800 border-purple-200';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const getSellingPrice = (wine: Wine, domain?: Domain) => {
  if (wine.sellingPriceHT && wine.sellingPriceHT > 0) {
    return wine.sellingPriceHT;
  }
  if (wine.coefficient && wine.coefficient > 0) {
    return wine.buyingPriceHT * wine.coefficient;
  }
  return wine.buyingPriceHT * (domain?.coefficient || 1.2);
};

export const printInvoice = (invoice: Invoice, clients: Client[], customLogo?: string) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Veuillez autoriser les pop-ups pour imprimer.");
    return;
  }

  // LOGIC: Retrieve address from client DB if invoice snapshot is empty
  let displayAddress = invoice.clientAddress;
  if (!displayAddress || displayAddress.trim() === '') {
      const client = clients.find(c => c.id === invoice.clientId) || clients.find(c => c.name.toLowerCase() === invoice.clientName.toLowerCase());
      if (client) {
          displayAddress = client.address || '';
      }
  }

  const title = invoice.status === 'ProForma' ? 'Pro Forma' : 'Facture';
  // Use custom logo from settings, or fallback to the hardcoded default
  const logoUrl = customLogo || DEFAULT_LOGO_URL;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title} - ${invoice.id}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Montserrat:wght@300;400;500;600&display=swap');
          @page { margin: 0; size: A4; }
          body { font-family: 'Montserrat', sans-serif; font-size: 12px; line-height: 1.5; color: #1f2937; background: white; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
          .page-container { padding: 40px 50px; max-width: 210mm; margin: 0 auto; min-height: 297mm; position: relative; box-sizing: border-box; }
          header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 60px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb; }
          .brand-section { display: flex; flex-direction: column; gap: 15px; }
          .logo-img { height: 80px; width: auto; object-fit: contain; margin-left: -10px; max-width: 200px; }
          .company-details { font-size: 11px; color: #4b5563; }
          .document-info { text-align: right; }
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
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          .items-table th { text-align: left; padding: 12px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; border-bottom: 2px solid #111; font-weight: 600; }
          .items-table td { padding: 14px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; font-size: 12px; }
          .items-table tr:last-child td { border-bottom: 1px solid #111; }
          .col-desc { width: 50%; }
          .col-qty { text-align: center; width: 10%; }
          .col-price { text-align: right; width: 20%; }
          .col-total { text-align: right; width: 20%; font-weight: 600; }
          .item-name { font-weight: 600; color: #111; display: block; }
          .item-meta { color: #6b7280; font-size: 11px; margin-top: 2px; }
          .footer-section { display: flex; justify-content: space-between; align-items: flex-start; }
          .bank-details { width: 45%; padding: 15px; background-color: #f9fafb; border-radius: 4px; font-size: 11px; color: #4b5563; }
          .rib-warning { color: #dc2626; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 8px; letter-spacing: 0.5px; }
          .totals-box { width: 40%; }
          .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
          .total-row.final { border-bottom: none; border-top: 2px solid #111; margin-top: 10px; padding-top: 15px; }
          .total-label { color: #6b7280; }
          .total-value { font-weight: 600; color: #111; }
          .final .total-label { font-family: 'Cormorant Garamond', serif; font-size: 18px; font-weight: 700; color: #111; }
          .final .total-value { font-family: 'Cormorant Garamond', serif; font-size: 24px; font-weight: 700; color: #111; }
          .legal-footer { position: absolute; bottom: 40px; left: 50px; right: 50px; text-align: center; font-size: 9px; color: #9ca3af; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          .stamp { position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-15deg); font-size: 80px; font-weight: 700; text-transform: uppercase; opacity: 0.15; z-index: 0; pointer-events: none; border: 5px solid; padding: 10px 40px; }
          .stamp-paid { color: #059669; border-color: #059669; }
          .stamp-cancelled { color: #dc2626; border-color: #dc2626; }
        </style>
      </head>
      <body>
        <div class="page-container">
          ${invoice.status === 'Paid' ? '<div class="stamp stamp-paid">PAYÉE</div>' : ''}
          ${invoice.status === 'Cancelled' ? '<div class="stamp stamp-cancelled">ANNULÉE</div>' : ''}
          <header>
            <div class="brand-section">
              <img src="${logoUrl}" alt="La Cave des Peress" class="logo-img" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" />
              <h1 style="display:none; font-family: 'Cormorant Garamond', serif; font-size: 28px; margin: 0; color: #7f1d1d;">La Cave des Peress</h1>
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
          <table class="items-table">
            <thead>
              <tr><th class="col-desc">Désignation</th><th class="col-qty">Qté</th><th class="col-price">Prix Unit. HT</th><th class="col-total">Total HT</th></tr>
            </thead>
            <tbody>
              ${invoice.items.map(item => `
                <tr>
                  <td>
                    <span class="item-name">${item.name} ${item.format && item.format !== 'Bouteille (75cl)' ? `(${item.format})` : ''}</span>
                    ${item.isService ? '' : item.vintage || item.color ? `<div class="item-meta">${item.color || ''} ${item.vintage ? ' • ' + item.vintage : ''}</div>` : ''}
                  </td>
                  <td class="col-qty">${item.quantity}</td>
                  <td class="col-price">${item.isGift ? 'Offert' : formatCurrency(item.sellingPriceHT).replace('€', '') + ' €'}</td>
                  <td class="col-total">${item.isGift ? 'Offert' : formatCurrency(item.sellingPriceHT * item.quantity).replace('€', '') + ' €'}</td>
                </tr>
              `).join('')}
               ${invoice.items.length < 5 ? Array.from({ length: 5 - invoice.items.length }).map(() => `<tr><td style="color: transparent;">.</td><td></td><td></td><td></td></tr>`).join('') : ''}
            </tbody>
          </table>
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
              <div class="total-row"><span class="total-label">Total HT</span><span class="total-value">${formatCurrency(invoice.totalHT)}</span></div>
              <div class="total-row"><span class="total-label">Frais de port HT</span><span class="total-value">${formatCurrency(invoice.shippingCost || 0)}</span></div>
              <div class="total-row"><span class="total-label">TVA (20%)</span><span class="total-value">${formatCurrency(invoice.totalTVA)}</span></div>
              <div class="total-row final"><span class="total-label">Net à Payer</span><span class="total-value">${formatCurrency(invoice.totalTTC)}</span></div>
            </div>
          </div>
          <div class="legal-footer">La Cave des Peress — EURL au capital de 5 000 € — 3 Rue du monument 21190 Puligny Montrachet<br>SIREN 751 886 649 — RCS Dijon — TVA Intracommunautaire : FR 37 751886649</div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
    </html>
  `;
  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

export const printWineMenu = (wines: Wine[], domains: Domain[], customLogo?: string) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Veuillez autoriser les pop-ups pour imprimer.");
    return;
  }
  
  // Logic to group wines by effective region (Wine override > Domain region)
  const grouped: Record<string, { domain: Domain, wines: Wine[] }[]> = {};
  
  // First, group wines by effective region and then by domain
  const winesGroupedByEffectiveRegion: Record<string, Record<string, Wine[]>> = {};

  wines.forEach(w => {
    if (w.isArchived) return;
    const domain = domains.find(d => d.id === w.domainId);
    if (!domain) return;
    
    // Effective Region Logic
    const region = w.region || domain.region || "Autre";
    
    if (!winesGroupedByEffectiveRegion[region]) winesGroupedByEffectiveRegion[region] = {};
    if (!winesGroupedByEffectiveRegion[region][domain.id]) winesGroupedByEffectiveRegion[region][domain.id] = [];
    
    winesGroupedByEffectiveRegion[region][domain.id].push(w);
  });

  // Reconstruct into the final structure sorted by region then domain name
  Object.keys(winesGroupedByEffectiveRegion).sort().forEach(region => {
      grouped[region] = [];
      const domainIds = Object.keys(winesGroupedByEffectiveRegion[region]);
      
      // Sort domains within the region
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
          body { font-family: 'Lato', sans-serif; padding: 0; margin: 0; color: #1a1a1a; background: white; }
          @page { margin: 1.5cm; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 3px double #333; padding-bottom: 20px; }
          .header h1 { font-family: 'Playfair Display', serif; font-size: 36px; margin: 0; font-style: italic; color: #1e293b; }
          .header p { text-transform: uppercase; letter-spacing: 4px; font-size: 12px; color: #64748b; margin-top: 10px; }
          .logo-img { display: block; margin: 0 auto 10px auto; max-height: 100px; width: auto; object-fit: contain; }
          .content { column-count: 2; column-gap: 40px; }
          .region-section { margin-bottom: 30px; break-inside: avoid; page-break-inside: avoid; }
          .region-title { font-family: 'Playfair Display', serif; font-size: 20px; color: #7f1d1d; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 2px; text-align: center; }
          .domain-block { margin-bottom: 20px; break-inside: avoid; page-break-inside: avoid; }
          .domain-name { font-weight: bold; font-size: 15px; margin-bottom: 2px; color: #0f172a; }
          .domain-sub { font-size: 10px; color: #64748b; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px; }
          .wine-item { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
          .wine-name { flex: 1; position: relative; overflow: hidden; }
          .wine-name span { background: white; padding-right: 5px; position: relative; z-index: 1; }
          .wine-name::after { content: " . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . "; position: absolute; left: 0; bottom: 3px; z-index: 0; color: #cbd5e1; white-space: nowrap; }
          .wine-meta { display: flex; gap: 10px; background: white; padding-left: 5px; position: relative; z-index: 1; }
          .wine-vintage { font-style: italic; color: #64748b; font-size: 12px; width: 35px; text-align: right; }
          .wine-price { font-weight: bold; width: 55px; text-align: right; }
          .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 40px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${logoUrl}" alt="Logo" class="logo-img" />
          <h1>La Cave des Peress</h1>
          <p>Carte des Vins</p>
        </div>
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
                     let price = w.sellingPriceHT;
                     if (!price || price <= 0) {
                        const coef = w.coefficient && w.coefficient > 0 ? w.coefficient : (domain.coefficient || 1.2);
                        price = w.buyingPriceHT * coef;
                     }
                     const formattedPrice = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
                     return `<div class="wine-item"><div class="wine-name"><span>${w.name} ${w.format && w.format !== 'Bouteille (75cl)' ? `(${w.format})` : ''}</span></div><div class="wine-meta"><span class="wine-vintage">${w.vintage}</span><span class="wine-price">${formattedPrice}</span></div></div>`;
                   }).join('')}
                </div>
              `}).join('')}
            </div>
          `).join('')}
        </div>
        <div class="footer"><p>3 Rue du monument 21190 Puligny Montrachet - Tél : +33 610847902</p><p>Tous nos prix sont affichés Hors Taxes (HT). L'abus d'alcool est dangereux pour la santé, à consommer avec modération.</p></div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
    </html>
  `;
  printWindow.document.write(htmlContent);
  printWindow.document.close();
};
