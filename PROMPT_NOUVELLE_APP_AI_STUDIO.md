# 🍇 MASTER PROMPT — CRÉATION D'ATLAS VINS AVEC FIREBASE FIRESTORE (AI STUDIO)
> **Instructions d'utilisation** : Copiez l'intégralité du texte ci-dessous et collez-le dans le champ de prompt de votre nouveau projet dans Google AI Studio.

---

```markdown
# BRIEF TECHNIQUE & PRODUIT — ATLAS VINS & NÉGOCE (CAVISTE NOUVELLE GÉNÉRATION)

## 1. RÔLE & VISION PRODUIT
Tu es Principal Product Designer & Staff Fullstack Engineer d'élite, expert des applications SaaS de gestion commerciale, logistique et comptable dans le secteur des vins & spiritueux.
Tu conçois et codes de zéro l'application « Atlas Vins », un cockpit de gestion ultra-moderne, fluide et réactif destiné à un caviste indépendant et négociant en vins (boutique au comptoir, clients CHR / restauration avec stocks déportés en consignation, réceptions de commandes fournisseurs, facturation certifiée et états fiscaux/douaniers).

L'application doit être la plus moderne et désirable du marché viticole européen. Elle fonctionne en **Parallel Run direct** sur la base de données **Firebase Firestore** existante, garantissant zéro perte de données et une synchronisation en temps réel avec l'existant.

---

## 2. DIRECTION ARTISTIQUE & EXPÉRIENCE UTILISATEUR (LINEAR-STYLE LIGHT)
- **Esthétique générale** : Thème clair exécutif inspiré de Linear et Stripe.
  - Fond de page blanc pur (`#FFFFFF`) avec surfaces secondaires en calcaire grisé très léger (`#F8FAFC`).
  - Bordures discrètes et nettes de 1px (`#E2E8F0`).
  - Accentuation principale : Bordeaux grenat grand cru velouté (`#881337` / `#9F1239`), typographie en noir encre profond (`#0F172A`).
  - Pas d'accumulation de pilules de statuts colorées ou d'artifices criards : séparateurs typographiques discrets (`·`, `/`), badges épurés et aérés.
- **Typographie de précision** :
  - Interface et titres : `Plus Jakarta Sans` ou `Outfit` (sans-serif moderne, haute lisibilité).
  - Corps et formulaires : `Plus Jakarta Sans` (13px / 14px) avec labels subtils en majuscules discrètes (`text-[11px] font-semibold tracking-wider text-slate-500 uppercase`).
  - Montants financiers, quantités et dates : Police monospace avec chiffres tabulaires (`font-mono tabular-nums`) pour garantir l'alignement décimal vertical sans sautillement visuel.
- **Composants d'interaction avancés** :
  - **Tiroirs latéraux d'action (Slide-over / Sheet)** : Toute consultation ou modification d'une référence vin, client, réception ou facture s'ouvre dans un volet latéral fluide de 480px à 640px sans jamais quitter la liste principale.
  - **Palette de commande globale (⌘K / Ctrl+K)** : Raccourci universel ouvrant un modal de recherche instantanée (recherche transversale de cuvées, domaines, clients, factures, avec raccourcis directs comme « Nouvelle Vente », « Réceptionner Fournisseur »).
  - **Raccourcis clavier productivité** : `N` (Nouveau vin), `C` (Nouveau client), `V` (Aller à la caisse), `Esc` (Fermer volet).

---

## 3. CONNEXION BDD FIREBASE FIRESTORE & PARALLEL RUN
L'application doit se connecter à la base de données Firestore existante en respectant scrupuleusement la configuration du projet et la base nommée :

### Configuration Firebase SDK (`firebaseClient.ts`) :
```typescript
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0422209427",
  appId: "1:734700476874:web:fd7367139af165e6335733",
  apiKey: "AIzaSyBLgURAbyB7aV4PbDRs4NdMcfGf20Hb_GQ",
  authDomain: "gen-lang-client-0422209427.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-lacavedesperess-29bb28c7-efd7-417b-8c64-3aeaaa1d6f64",
  storageBucket: "gen-lang-client-0422209427.firebasestorage.app",
  messagingSenderId: "734700476874"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// CRUCIAL : Passage explicite du databaseId pour la base Firestore nommée
export const db = getFirestore(app, "ai-studio-lacavedesperess-29bb28c7-efd7-417b-8c64-3aeaaa1d6f64");
```

### Collections Firestore exactes et typages :
1. **`/wines/{wineId}`** :
   - `id`: string
   - `domainId`: string (ID du domaine associé)
   - `name`: string (Nom du vin / cuvée)
   - `vintage`: string (Millésime, ex: "2020", "2022", "NV")
   - `color`: string ('Rouge' | 'Blanc' | 'Rosé' | 'Effervescent' | 'Spiritueux' | 'Bière / Cidre' | 'Autre')
   - `buyingPriceHT`: number (Prix d'achat HT unitaire)
   - `sellingPriceHT`: number (Prix de vente HT calculé ou surchargé)
   - `coefficient`: number (Coefficient spécifique surchargé)
   - `stock`: number (Quantité physique en cave)
   - `region`: string
   - `subRegion`: string (Terroir / appellation, ex: "Côte de Nuits")
   - `format`: string (Défaut: "Bouteille (75cl)")
   - `isArchived`: boolean
   - `isPreSale`: boolean
2. **`/domains/{domainId}`** :
   - `id`: string
   - `name`: string (Nom du domaine / vigneron)
   - `region`: string
   - `coefficient`: number (Coefficient multiplicateur par défaut du domaine, ex: 1.8)
   - `isArchived`: boolean
3. **`/clients/{clientId}`** :
   - `id`: string
   - `name`: string (Nom du client / restaurant CHR)
   - `contactName`: string (Contact sommelier / directeur)
   - `email`: string
   - `phone`: string
   - `phoneLandline`: string
   - `address`: string
   - `externalStock`: array `[{ wineId: string, quantity: number, sellingPriceHT?: number }]` (Stock déporté en consignation)
4. **`/invoices/{invoiceId}`** :
   - `id`: string (Numéro de facture ou pro forma, ex: "FAC-2026-0042")
   - `date`: string (Date de création)
   - `invoiceDate`: string (Date de facture définitive)
   - `clientName`: string
   - `clientId`: string
   - `clientAddress`: string
   - `items`: array `[{ id, name, vintage, color, quantity, sellingPriceHT, vatRate, isGift, fromExternalStock, isService }]`
   - `totalHT`: number
   - `totalTVA`: number
   - `totalTTC`: number
   - `discount`: number
   - `shippingCost`: number
   - `status`: string ('ProForma' | 'Validated' | 'Paid' | 'Cancelled')
   - `type`: string ('Sale' | 'Purchase')
   - `paymentMethod`: string ('Virement' | 'CB' | 'Espèces' | 'Chèque' | 'Sortie Perso')
   - `paymentDate`: string
   - `paymentReference`: string
5. **`/stock_movements/{movementId}`** :
   - `id`: string
   - `date`: string
   - `wineId`: string
   - `wineName`: string
   - `type`: string ('IN' | 'OUT' | 'ADJUST' | 'TRANSFER')
   - `quantity`: number
   - `reason`: string
   - `price`: number (Prix unitaire d'achat HT si type IN)
   - `vatRate`: number (Taux de TVA à l'achat, ex: 20)
   - `tva`: number (Montant de TVA du mouvement)
   - `provider`: string (Domaine / fournisseur)
   - `reference`: string (Numéro facture fournisseur)
   - `paymentStatus`: string ('Paid' | 'Pending')
   - `paymentDate`: string
   - `paymentMethod`: string
   - `shippingCost`: number
   - `impactStock`: boolean (true par défaut)
   - `isArchived`: boolean
6. **`/expenses/{expenseId}`** :
   - `id`, `date`, `provider`, `category`, `description`, `amountHT`, `amountTVA`, `amountTTC`, `paymentMethod`, `assetId`
7. **`/expense_categories/{categoryId}`** :
   - `id`, `label`
8. **`/assets/{assetId}`** :
   - `id`, `name`, `category`, `purchaseDate`, `amountHT`, `vatAmount`, `durationYears`, `startDepreciationDate`, `description`, `isArchived`

---

## 4. ARCHITECTURE FONCTIONNELLE EN 5 ESPACES DE TRAVAIL UNIFIÉS

### 1. COCKPIT (EXECUTIVE DASHBOARD)
- **Cartes métriques de premier plan** :
  - Chiffre d'affaires HT & TTC du mois (avec comparatif vs mois précédent).
  - Valeur totale du stock immobilisé (au coût d'achat HT / CUMP).
  - Marge brute commerciale globale et taux de marque moyen.
  - Factures impayées & relances (montant en attente d'encaissement).
- **Radar des alertes prioritaires** :
  - Cuvées en rupture ou sous le seuil critique (ex: < 6 bouteilles).
  - Vins dormants (stock > 0 sans aucune sortie depuis plus de 180 jours).
- **Synthèse DRM douanière express** :
  - Histogramme compact des flux d'entrées et sorties du mois en cours par couleur.

### 2. CAVE & APPROVISIONNEMENTS (CATALOGUE & LOGISTIQUE)
- **Catalogue dynamique des Vins** :
  - Liste dense et élégante avec pagination/tri instantané (Nom, Domaine, Millésime, Région, Couleur, Stock, Prix d'achat HT, Coefficient, Prix de vente HT/TTC).
  - Filtres segmentés par couleur (Rouge, Blanc, Rosé, Effervescent, Spiritueux, Bière/Cidre) et par niveau de stock (Disponible, Stock faible, Épuisé, Archivé).
  - Volet latéral rétractable pour la création et l'édition rapide : calcul automatique du prix de vente HT = `prixAchatHT * (vinCoef || domaineCoef || 1.8)` et du TTC (+20%).
- **Réceptions Fournisseurs & Commandes d'achats** :
  - Formulaire de réception rapide par lot : sélection du fournisseur/domaine, numéro de facture/BL, allocation des frais de port HT, ventilation de la TVA (20 %, 5.5 %, 10 %).
  - Option d'impact immédiat sur le stock ou d'enregistrement purement comptable (`impactStock = false`).
  - Suivi du statut de paiement de la facture fournisseur (En attente, Payée avec date et moyen).
- **Journal d'Audit des Mouvements de Stock** :
  - Historique complet, traçable et filtrable par type (`IN`, `OUT`, `ADJUST`, `TRANSFER`), vin, et date.
  - Outil d'ajustement rapide d'inventaire avec motif obligatoire (Casse, Dégustation client, Sortie personnelle, Écart d'inventaire).

### 3. COMPTOIR & CLIENTS CHR (CAISSE & STOCKS DÉPORTÉS)
- **Point de Vente & Caisse Rapide** :
  - Interface optimisée pour la rapidité au comptoir : recherche par nom ou code, ajout en un clic.
  - Possibilité de déduire la vente soit du **stock de la cave**, soit du **stock déporté chez le client**.
  - Possibilité d'ajouter des lignes de services libres (ex: frais de livraison, animation dégustation, coffret cadeau).
  - Validation instantanée : encaissement (CB, Chèque, Espèces, Virement) générant directement une Facture ou une Pro Forma selon le besoin.
- **Gestionnaire Dédié des Partenaires & Restauration (CHR)** :
  - Vue détaillée par établissement partenaire (Restaurant, Bar à vin, Hôtel).
  - **Module de Stock Déporté (Consignation / Dépôt-Vente)** :
    - Visualisation claire des bouteilles actuellement en dépôt physique chez le restaurateur.
    - Action **« Déposer du stock »** : transfère des bouteilles du stock cave vers le stock déporté du client avec mise à jour automatique des inventaires.
    - Action **« Retour en cave »** : réintègre les bouteilles non vendues en cave.
    - Action magique **« Facturer la consommation »** : sélection en quelques clics des bouteilles consommées par le restaurant, avec calcul immédiat du montant et génération de la facture de vente correspondante !

### 4. FACTURATION & CRÉANCES
- **Gestionnaire du cycle de vie des factures** :
  - Onglets de filtrage : Toutes, Pro Forma (devis/brouillons), Validées (en attente de règlement), Payées, Annulées.
  - Actions en un clic : « Valider la Pro Forma en Facture définitive », « Marquer comme Payée » (avec saisie de la date, moyen de paiement et référence bancaire), « Renuméroter », « Annuler ».
  - Impression et aperçu PDF professionnel conforme aux standards français (mentions légales, taux de TVA ventilés, coordonnées émetteur/client, totaux HT/TVA/TTC en euros).

### 5. FINANCES, FISCALITÉ & DOUANES
- **Bilan TVA Mensuel Automatisé** :
  - Tableau ventilé mois par mois sur l'année sélectionnée.
  - Calcul rigoureux :
    - TVA Collectée sur les ventes encaissées.
    - TVA Déductible sur les achats de vins (factures fournisseurs).
    - TVA Déductible sur les frais généraux (dépenses d'exploitation).
    - Solde net de TVA mensuel (TVA nette à décaisser ou Crédit de TVA).
    - Export des justificatifs de calcul.
- **Tableau Officiel DRM (Déclaration Récapitulative Mensuelle)** :
  - Matrice des flux conforme aux déclarations de douane : ventilation stricte par catégorie fiscale / couleur (`Rouge`, `Blanc`, `Rosé`, `Effervescent`, `Spiritueux`, `Bière / Cidre`).
  - Colonnes officielles : Stock initial, Entrées (Achats `IN`), Sorties (Ventes `OUT`), Ajustements (+/-), Stock final théorique et Balance nette.
- **Comptabilité & Immobilisations** :
  - Suivi des charges d'exploitation par catégorie (Loyer, Assurances, Transport, Énergie, etc.).
  - Registre des immobilisations et tableau d'amortissement linéaire des actifs (matériel, véhicule, agencement cave).

---

## 5. RÈGLES MÉTIER ET PRÉCISION DE CALCUL
- **Format monétaire français** : Tout montant affiché doit être formaté à la française avec espaces insécables et virgule (ex: `1 250,50 €`).
- **Calcul des marges** :
  - Taux de marque = `(Prix Vente HT - Prix Achat HT) / Prix Vente HT * 100`
  - Coefficient multiplicateur = `Prix Vente HT / Prix Achat HT`
- **Résilience aux valeurs nulles / NaN** : Tous les calculs doivent être protégés par des valeurs de repli sûres (`Number(val) || 0`, `Number.isNaN`).

---

## 6. STACK TECHNIQUE RECOMMANDÉE
- React 18 / 19 avec TypeScript en mode strict.
- Firebase SDK officiel (`firebase/app`, `firebase/firestore`).
- Tailwind CSS pour un styling soigné, zéro CSS inline, composants responsifs.
- Lucide React pour les icônes.
- Composants modulaires, hooks découplés pour la gestion des données, state unifié et réactif.
```
