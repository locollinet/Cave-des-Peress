# Diagnostic & Verrouillage du Design — La Cave des Pères

Analyse des causes de réapparition du visuel modifié lors des reconnexions à Google AI Studio, et stratégie pour figer définitivement la version souhaitée (Bandeau sombre avec bordeaux et blanc).

---

> [!IMPORTANT]
> ### Décision Utilisateur Confirmée
> - **Visuel cible définitif** : Conservation intégrale du design de référence avec le **bandeau sombre (slate-900), accents bordeaux (#881337 / red-900) et texte blanc**.
> - **Rejet formel de l'autre design** : Aucun passage au mode sombre intégral ("Dark mode exécutif type Linear / Atlas") ni altération de la disposition actuelle.
> - **Consigne de sécurité** : Zéro modification de code exécutée durant cette phase d'analyse.

---

## 1. Pourquoi le visuel modifié réapparaît-il à chaque reconnexion ?

L'analyse technique approfondie du workspace et de l'environnement Google AI Studio identifie **4 causes interdépendantes** :

### Cause 1 : Présence d'instructions système parasites dans le projet AI Studio (Cause Racine Principale)
Dans les paramètres du projet AI Studio (`additional_user_instructions`), des directives pour une application tierce (« Atlas — Démonstrateur APM ») avec pour consigne stricte :
> *"DIRECTION ARTISTIQUE (exigence forte) : Dark mode exécutif par défaut, esthétique premium type Linear / terminal financier : fonds profonds..."*

À chaque fois qu'une nouvelle session ou qu'une requête d'évolution est lancée dans AI Studio, l'IA reçoit ces instructions système en tâche de fond. Lors des précédentes évolutions, l'assistant a donc cru devoir aligner l'application sur ce style sombre exécutif, modifiant les composants visuels (`Sidebar.tsx`, `App.tsx`, `Dashboard.tsx`).

### Cause 2 : Gestion des snapshots et branches de session dans AI Studio
Dans AI Studio :
- Les modifications de code sont enregistrées dans le snapshot du conteneur lié à votre session.
- Si une évolution a été faite dans un chat précédent qui a touché aux fichiers de style, ce conteneur reste dans cet état modifié lors de votre reconnexion.
- Si vous changez de discussion ou rechargez l'espace, AI Studio recharge l'état du conteneur actif, qui contient encore les fragments du visuel modifié par l'évolution passée.

### Cause 3 : Dépendance au CDN Tailwind à la volée dans `index.html`
Le fichier `index.html` utilise :
```html
<script src="https://cdn.tailwindcss.com"></script>
```
Le script CDN analyse le DOM à la volée lors de chaque chargement dans le navigateur. De plus, une balise `<link rel="stylesheet" href="/index.css">` pointe vers un fichier inexistant. Selon la vitesse de résolution du CDN ou l'ordre d'injection des classes, le rendu visuel peut présenter des sautes ou des différences de style notables entre deux reconnexions.

### Cause 4 : Persistance du cache de compilation Vite (`.vite` & mémoire locale)
Le serveur de développement Vite tourne en continu avec `tsx server.ts`. Les modules compilés en cache dans `node_modules/.vite` conservent parfois des fragments de styles précédents jusqu'à ce qu'un redémarrage propre et un nettoyage soient effectués.

---

## 2. Plan d'Action pour Figer Définitivement le Bon Design

```
┌────────────────────────────────────────────────────────────────────────┐
│               ÉTAPE 1 : AUDIT VISUEL DES COMPOSANTS (Fait)             │
│  • Vérification Sidebar.tsx (bandeau slate-900, bordeaux, blanc)       │
│  • Vérification App.tsx (fond gray-50, structure classique)            │
│  • Vérification Dashboard.tsx (cartes blanches, contrastes clairs)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│            ÉTAPE 2 : NETTOYAGE DES INSTRUCTIONS ET DU SCOPE            │
│  • Neutralisation formelle des consignes parasites d'un autre projet   │
│  • Inscription explicite dans le référentiel du thème officiel         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│        ÉTAPE 3 : SÉCURISATION DU BUNDLE ET SUPPRESSION DES 404         │
│  • Retrait de l'appel /index.css orphelin dans index.html               │
│  • Stabilisation des classes Tailwind de la barre latérale et du header │
│  • Compilation de vérification et redémarrage propre du serveur dev    │
└────────────────────────────────────────────────────────────────────────┘
```

### Détail des actions à engager (sur validation uniquement) :
1. **Nettoyage de `index.html`** : Supprimer la ligne `<link rel="stylesheet" href="/index.css">` qui génère une erreur 404 au chargement et perturbe le rendu initial.
2. **Sanctuarisation de la charte dans `Sidebar.tsx` et `App.tsx`** :
   - Bandeau latéral : Fond ardoise foncé (`bg-slate-900`), délimitation nette (`border-slate-800`).
   - Éléments actifs : Fond bordeaux grand cru (`bg-red-900`), texte blanc éclatant (`text-white`), ombre subtile (`shadow-red-950/20`).
   - Éléments inactifs : Texte ardoise clair (`text-slate-400`), survol ardoise (`hover:bg-slate-800 hover:text-white`).
   - En-tête mobile et fond général : Fond clair reposant (`bg-gray-50` / `bg-white`).
3. **Mise à jour des métadonnées du projet** pour que toute future invite respecte ce design sans jamais réintroduire le dark mode exécutif.
