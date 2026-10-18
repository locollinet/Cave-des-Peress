# Modernisation & Migration Sécurisée — La Cave des Pères

Plan directeur d'architecture et de migration pour faire évoluer l'ERP caviste de Supabase vers Firebase Firestore, tout en préparant la refonte ergonomique « Sommelier Moderne » sans aucune perte de données ni interruption d'activité pour l'oncle.

---

> [!IMPORTANT]
> ### Arbitrages confirmés par l'utilisateur (Phase 1)
> 1. **Séquençage sécurisé (2 Phases)** : **Phase 1** dédiée à la migration intégrale des données vers Firebase Firestore à iso-fonctionnalités (zéro risque, zéro perte). Puis **Phase 2** dédiée à la modernisation ergonomique, au design sombre bordeaux/ardoise et au refactoring de l'architecture logicielle.
> 2. **Direction visuelle & ergonomique** : Ambiance **Sombre Premium (Bordeaux, Ardoise, Chêne, Or discret)** avec remplacement des modales intrusives par des **tiroirs latéraux (Slide-overs / Sheets)**, navigation épurée et barre de saisie rapide (Command Palette / Raccourcis).
> 3. **Cible matérielle mixte** : Optimisation hybride pour l'**écran de caisse/bureau** (densité, raccourcis clavier, double affichage) et pour le **smartphone/tablette tactile au chai** (zones tactiles larges $\ge 44\text{px}$, pointage des arrivages, inventaire rapide).

---

## 1. Vue d'ensemble & Enjeux Métier

### Ce que fait l'application
L'application est l'outil d'exploitation quotidien de la cave :
- **Catalogue & Régie viticole** : 677 références de vins réparties sur 203 domaines, avec appellations, millésimes, formats (75cl, Magnums), coefficients multiplicateurs et prix d'achat HT.
- **Gestion fine du Stock & CUMP** : 6 416 mouvements tracés. Chaque réception fournisseur calcule le Coût Unitaire Moyen Pondéré (CUMP/PMP) intégrant le prix d'achat HT et les frais d'approche/transport au prorata.
- **Conformité Douanière (DRM)** : Suivi en temps réel de la balance des matières par couleur (Rouge, Blanc, Rosé, Effervescent, Spiritueux) pour la Déclaration Récapitulative Mensuelle des douanes.
- **Cycle Commercial & Facturation** : Gestion des devis, factures pro-forma, factures validées/payées, règlements, avoirs et stocks déportés (consignations chez les restaurateurs).
- **Comptabilité analytique & Trésorerie** : Ventilation de TVA, charges courantes et amortissement des immobilisations.

### Utilisateurs cibles
- **L'Oncle (Maître de chai & gérant)** : A besoin de rapidité absolue au comptoir lors de l'encaissement et de simplicité tactile dans le chai pour valider les livraisons et ajuster les stocks.
- **L'Expert-comptable / Les Douanes** : Exigent une intégrité mathématique absolue sur les numéros de facture, la balance DRM et les valeurs de stock.

---

## 2. Expérience Utilisateur & Design System « Sommelier Moderne »

### Direction Artistique
- **Palette (Règle 60-30-10)** :
  - **60% Toile neutre sombre** : Fond ardoise profonde (`#0B0F17` / `#111827`) évitant la fatigue visuelle au chai et les reflets en boutique.
  - **30% Surfaces & Reliefs** : Panneaux et tiroirs en teinte lie-de-vin feutrée (`#1A1218`) et ardoise satinée (`#1E293B`) avec bordures capillaires 1px (`rgba(255,255,255,0.08)`).
  - **10% Accents signature** : Rouge Bordeaux Grand Cru (`#881337` / `#9F1239`) pour les actions primaires, Or ambré millésimé (`#D97706` / `#F59E0B`) pour les alertes de stock bas et sélections actives.
- **Typographie** :
  - Titres & Domaines : `Plus Jakarta Sans` ou `Outfit` (élégant, moderne, contemporain).
  - Corps de texte : `DM Sans` (haute lisibilité à petite taille sur écran tactile).
  - Valeurs comptables, stocks et CUMP : `JetBrains Mono` avec `font-variant-numeric: tabular-nums` pour un alignement vertical strict des décimales et des quantités.
- **Adieu aux modales intrusives (`alert`, `confirm`, `WineModal`)** :
  - Remplacement de toutes les fenêtres pop-up bloquantes par des **tiroirs latéraux (Slide-overs)** coulissant depuis la droite, permettant de garder un œil sur le tableau d'inventaire ou la facture en cours d'édition.
  - Remplacement des `window.confirm` par des toasts non-bloquants avec action d'annulation (« Annuler l'archivage »).

### Parcours utilisateur clés
1. **Au Chai (Smartphone / Tablette)** :
   - Mode « Inventaire Rapide » plein écran avec recherche floue instantanée.
   - Boutons larges de pointage `[ -1 ]` `[ +1 ]` `[ +6 (Carton) ]` `[ +12 ]`.
   - Rapprochement automatique des BL / Factures fournisseurs via l'IA Gemini déjà présente.
2. **Au Comptoir (Ordinateur / Caisse)** :
   - Navigation clavier ultra-rapide (`Cmd+K` / `Ctrl+K` pour chercher un vin ou un client en 2 frappes).
   - Panier de vente fluide avec calcul automatique de la marge nette en direct selon le CUMP.
   - Émission du ticket / facture PDF en un clic.

---

## 3. Stratégie Technique de Migration : Garantie ZÉRO Perte

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ÉTAPE 1 : SNAPSHOT FROID (Local)                     │
│  Script d'extraction automatique Supabase -> Dumps JSON horodatés     │
│  • wines.json (677)           • domains.json (203)                     │
│  • invoices.json (211)        • clients.json (48)                      │
│  • stock_movements.json (6416)• expenses.json (268)                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 ÉTAPE 2 : PROVISIONING FIREBASE VIA AI STUDIO          │
│  • show_aistudio_ui(firebase_setup) -> Validation utilisateur UI       │
│  • rpc_action(fax, ProvisionFirebase) -> Instance Firestore Cloud      │
│  • Déploiement firestore.rules et initialisation SDK Firebase v11      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               ÉTAPE 3 : INJECTION & RÉCONCILIATION ID-A-ID             │
│  • Script de migration batch vers Firestore                            │
│  • Conservation stricte des IDs originaux (garantie intégrité liens)   │
│  • Parsing natif des JSON imbriqués (lignes de factures, stock client) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                ÉTAPE 4 : BASCULE INDOLORE DE LA COUCHE API             │
│  • Réécriture du Repository api.ts vers Firestore SDK                  │
│  • Zéro modification de signature : useWines, usePurchases, etc.       │
│  • Mise en place du cache IndexedDB offline natif Firestore            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                ÉTAPE 5 : AUDIT & CERTIFICATION DE CONFORMITÉ           │
│  • Contrôle volumétrique (677 = 677, 6416 = 6416)                      │
│  • Recalcul de contrôle CUMP sur 5 vins complexes                      │
│  • Rapprochement balance DRM mensuelle (Entrées / Sorties / Solde)     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Architecture des Données & Schéma Firestore

Les collections Firestore adopteront la structure normalisée suivante :

| Collection Firestore | Rôle & Cardinalité | Clé Document (`id`) | Particularité & Traitement |
| :--- | :--- | :--- | :--- |
| `wines` | 677 cuvées actives/archivées | ID Supabase d'origine | Stock, CUMP `buyingPriceHT`, millésime, format, région |
| `domains` | 203 producteurs viticoles | ID Supabase d'origine | Nom, région, coefficient multiplicateur par défaut |
| `clients` | 48 comptes clients & CHR | ID Supabase d'origine | Stock déporté converti en sous-tableau d'objets typés |
| `invoices` | 211 factures & devis | ID Supabase (ou numéro FA) | `items` convertis en Maps natives (plus de `JSON.parse`) |
| `stock_movements` | 6 416 entrées/sorties | ID Supabase d'origine | Dates ISO, prix d'achat, TVA, ventilation transport |
| `expenses` | 268 dépenses d'exploitation | ID Supabase d'origine | Fournisseurs, montants HT/TVA/TTC, catégorie |
| `expense_categories` | 27 catégories comptables | ID Supabase d'origine | Libellés officiels de dépenses |
| `assets` | 10 immobilisations | ID Supabase d'origine | Amortissements, durées, montants |

---

## 5. Plan d'Exécution Détaillé

### Phase 1 : Migration Backend & Données (Iso-fonctionnalités, 100% Automatisé)
1. **Sauvegarde complète** : Exécution d'un script Node.js dédié `scripts/backup-supabase.ts` extrayant l'ensemble des tables en fichiers `.json` sécurisés avec checksums.
2. **Provisionnement Firebase** : Déclenchement du flux UI officiel de setup Firebase, génération du `firebase-blueprint.json` et de `firestore.rules` étanches.
3. **Migration en lots (Batch Writes)** : Injection par paquets de 500 documents (limite Firestore) avec journalisation pas-à-pas.
4. **Adapter Firestore dans `api.ts`** :
   - Remplacement de `@supabase/supabase-js` par `firebase/firestore`.
   - Activation de la persistance locale (`persistentMultipleTabManager`) pour un usage hors-ligne fluide au chai sans connexion Internet.
5. **Script de vérification croisée** : Comparaison automatisée ligne à ligne entre Supabase et Firestore.

### Phase 2 : Refonte Ergonomique & Découpage Moderne (Inspiré de « premnord »)
1. **Éclatement du God Hook `hooks.ts` (1 575 lignes)** :
   - Découpage en micro-hooks spécialisés : `useWineInventory`, `usePointOfSale`, `useDrmReport`, `usePurchaseReception`.
2. **Système de Tiroirs Latéraux (Slide-overs)** :
   - Remplacement des 8 modales encombrantes par des panneaux rétractables animés (édition rapide de vin, fiche client, encaissement).
3. **Interface de Pointage Tactile pour le Chai** :
   - Vue optimisée pour smartphone avec grands boutons de comptage et scanner de référence.
4. **Command Palette (`Cmd+K`)** :
   - Recherche globale instantanée dans toute la cave depuis n'importe quel écran.
5. **Thème Sombre Exécutif Bordeaux & Ardoise** :
   - Application rigoureuse de la charte visuelle, typographies tabulaires et zéro élément parasite.
