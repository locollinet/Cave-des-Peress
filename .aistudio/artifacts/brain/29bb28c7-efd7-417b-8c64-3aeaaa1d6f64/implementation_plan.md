# Atlas Viticole — Refonte Nouvelle Génération & Master Prompt Parallel Run (Firebase Firestore)

Conception de la nouvelle application de gestion pour caviste indépendant et négociant (boutique, CHR, stocks déportés), intégrant une ergonomie claire ultra-moderne inspirée de Linear, connectée en parallel run à la base de données **Firebase Firestore** existante (`ai-studio-lacavedesperess-29bb28c7-efd7-417b-8c64-3aeaaa1d6f64`), accompagnée du Master Prompt clé en main pour instancier l'application depuis une feuille blanche dans AI Studio.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Choix confirmés et cadrage validé :**
> - **Métier cible** : Caviste indépendant & Négociant en vins (gestion comptoir boutique, CHR/restauration, stocks déportés en consignation, allocations et réceptions fournisseurs).
> - **Base de données cible** : **Firebase Firestore** sur la base de données nommée existante :
>   `ai-studio-lacavedesperess-29bb28c7-efd7-417b-8c64-3aeaaa1d6f64` (Projet `gen-lang-client-0422209427`).
> - **Gestion du Parallel Run** : Connexion directe aux collections Firestore existantes (`wines`, `domains`, `clients`, `invoices`, `stock_movements`, `expenses`, `assets`, `expense_categories`) avec typage strict en temps réel.
> - **Ligne esthétique & Ergonomie** : Interface claire et lumineuse (*Linear-inspired light mode*), densité maîtrisée, typographie `Plus Jakarta Sans` / `Outfit` + chiffres tabulaires `font-mono tabular-nums`, palette bordeaux grenat velouté (`#881337`), zéro fioriture ni badges superflus.

---

### 1. Overview & Architecture du Parallel Run Firestore

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PARALLEL RUN SUR FIREBASE FIRESTORE                  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              │                                         │
              ▼                                         ▼
   ┌───────────────────────┐               ┌────────────────────────┐
   │ ANCIENNE APPLICATION  │               │   NOUVELLE APP ATLAS   │
   │ (Discovery / Lecture) │               │   (Linear UX Moderne)  │
   └──────────┬────────────┘               └────────────┬───────────┘
              │                                         │
              └────────────────────┬────────────────────┘
                                   │ Connexion Firestore Directe
                                   ▼
              ┌─────────────────────────────────────────┐
              │           FIREBASE FIRESTORE            │
              │ ID: ai-studio-lacavedesperess-...       │
              ├─────────────────────────────────────────┤
              │ • /wines/{id}      • /invoices/{id}     │
              │ • /domains/{id}    • /stock_movements/  │
              │ • /clients/{id}    • /expenses/{id}     │
              │ • /assets/{id}     • /expense_categories│
              └─────────────────────────────────────────┘
```

---

### 2. Spécification des Collections Firestore
- `/wines` : `id`, `domainId`, `name`, `vintage`, `color`, `buyingPriceHT`, `sellingPriceHT`, `coefficient`, `stock`, `region`, `subRegion`, `format`, `isArchived`, `isPreSale`.
- `/domains` : `id`, `name`, `region`, `coefficient`, `isArchived`.
- `/clients` : `id`, `name`, `contactName`, `email`, `phone`, `phoneLandline`, `address`, `externalStock` (liste d'objets `[{ wineId, quantity, sellingPriceHT }]`).
- `/invoices` : `id`, `date`, `invoiceDate`, `clientName`, `clientId`, `clientAddress`, `items`, `totalHT`, `totalTVA`, `totalTTC`, `discount`, `shippingCost`, `status`, `type`, `paymentMethod`, `paymentDate`, `paymentReference`.
- `/stock_movements` : `id`, `date`, `wineId`, `wineName`, `type`, `quantity`, `reason`, `price`, `vatRate`, `tva`, `provider`, `reference`, `paymentStatus`, `paymentDate`, `paymentMethod`, `shippingCost`, `impactStock`, `isArchived`.
- `/expenses`, `/assets`, `/expense_categories` : Comptabilité et amortissements.

---

### 3. Fichiers Livrés dans le Workspace
- `PROMPT_NOUVELLE_APP_AI_STUDIO.md` : Master Prompt prêt pour un copier-coller direct dans une nouvelle session AI Studio.
- `GUIDE_PARALLEL_RUN.md` : Protocole de synchronisation Firestore en temps réel.
