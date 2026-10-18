# 🍷 PROTOCOLE DE PARALLEL RUN — FIREBASE FIRESTORE & NOUVELLE APP ATLAS

Ce guide résume la stratégie opérationnelle pour faire tourner votre **nouvelle application « Atlas Vins »** en parallèle de l'application existante sur votre base **Firebase Firestore**, en toute sécurité.

---

## 1. Principe du Parallel Run sur Firestore
Le **Parallel Run** permet d'exécuter la nouvelle application Atlas Vins connectée directement à votre base Firestore :
- **Base cible** : Votre base de données Firestore nommée :
  `ai-studio-lacavedesperess-29bb28c7-efd7-417b-8c64-3aeaaa1d6f64`
- **Projet Cloud** : `gen-lang-client-0422209427`
- **Temps réel natif** : Grâce aux snapshots Firestore (`onSnapshot`), toute modification (vente, réception, ajustement) est répercutée en temps réel.

---

## 2. Configuration Firebase Firestore

Voici le bloc de connexion prêt à l'emploi utilisé par l'application :

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

// CRITIQUE : Utilisation explicite du databaseId pour la base Firestore nommée
export const db = getFirestore(app, "ai-studio-lacavedesperess-29bb28c7-efd7-417b-8c64-3aeaaa1d6f64");
```

---

## 3. Matrice des Collections Firestore Partagées

| Collection Firestore | Description & Rôle | Règles de Synchronisation |
| :--- | :--- | :--- |
| **`/wines/{wineId}`** | Références de vins, stock physique, millésime, formats, prix achat/vente. | Mise à jour atomique du champ `stock` lors des ventes et réceptions. |
| **`/domains/{domainId}`** | Domaines viticoles, régions et coefficients par défaut. | Référentiel partagé. |
| **`/clients/{clientId}`** | Clients particuliers et comptes pro CHR avec `externalStock`. | Gestion du stock en consignation / dépôt-vente. |
| **`/invoices/{invoiceId}`** | Factures et devis Pro Forma avec items, montants HT/TVA/TTC. | Écriture sous identifiant unique (`FAC-YYYY-XXXX`). |
| **`/stock_movements/{id}`** | Journal d'audit des mouvements (`IN`, `OUT`, `ADJUST`, `TRANSFER`). | Historique immuable partagé. |
| **`/expenses/{expenseId}`** | Dépenses d'exploitation et charges. | Pris en compte dans le Bilan TVA. |
| **`/assets/{assetId}`** | Immobilisations et investissements amortissables. | Calcul des amortissements linéaires. |
| **`/expense_categories`** | Libellés des catégories de dépenses. | Liste partagée. |

---

## 4. Règles de Sécurité (`firestore.rules`)
Les règles autorisent la lecture et l'écriture sur l'ensemble de ces collections pour les utilisateurs de l'application :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /wines/{wineId} { allow read, write: if true; }
    match /domains/{domainId} { allow read, write: if true; }
    match /clients/{clientId} { allow read, write: if true; }
    match /invoices/{invoiceId} { allow read, write: if true; }
    match /stock_movements/{movementId} { allow read, write: if true; }
    match /expenses/{expenseId} { allow read, write: if true; }
    match /expense_categories/{categoryId} { allow read, write: if true; }
    match /assets/{assetId} { allow read, write: if true; }
    match /{document=**} { allow read, write: if false; }
  }
}
```

---

## 5. Déroulement Recommandé de la Transition

1. **Étape 1 : Création du nouveau projet AI Studio**
   - Ouvrez un nouveau projet dans AI Studio.
   - Collez le prompt du fichier `PROMPT_NOUVELLE_APP_AI_STUDIO.md`.
2. **Étape 2 : Vérification immédiate**
   - Lancez la nouvelle application et vérifiez que votre catalogue de vins, domaines, clients et factures se charge directement depuis votre base Firestore `ai-studio-lacavedesperess-29bb28c7-efd7-417b-8c64-3aeaaa1d6f64`.
3. **Étape 3 : Validation du confort Linear**
   - Votre oncle bénéficie immédiatement de la caisse moderne, des slide-overs et de la facturation en 1 clic des stocks déportés.
