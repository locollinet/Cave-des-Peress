import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase JSON / urlencoded limits for base64 PDF uploads
  app.use(express.json({ limit: '35mb' }));
  app.use(express.urlencoded({ extended: true, limit: '35mb' }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // POST /api/parse-invoice-pdf
  app.post("/api/parse-invoice-pdf", async (req, res) => {
    try {
      const { fileBase64, mimeType } = req.body;
      if (!fileBase64) {
        return res.status(400).json({ error: "Fichier manquant (base64 requis)" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Clé API Gemini non configurée sur le serveur" });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const effectiveMimeType = mimeType || "application/pdf";

      const prompt = `Tu es un expert comptable et sommelier spécialisé dans le traitement des factures et bons de livraison de vins/champagnes/spiritueux.
Analyse ce document (facture d'achat ou bon de livraison de fournisseur de vin) et extrais fidèlement :
1. Le nom du fournisseur / domaine / négociant (ex: "Domaine Leflaive", "Maison Joseph Drouhin", "SARL Vins Fins", etc.).
2. Le numéro de facture ou de document (ex: "FA-2024-00123", "BL-9921"). Si absent, laisse vide.
3. La date du document au format YYYY-MM-DD. Si absente, utilise la date du jour.
4. Les frais de port ou transport HT (number, 0 si non spécifié ou inclus).
5. La liste de toutes les lignes d'achat de vin / boisson :
   - rawText: Le texte brut de la désignation dans la facture (ex: "2022 Chassagne Montrachet 1er Cru Morgeot 75cl")
   - domainName: Le nom du producteur / domaine / château extrait de la ligne ou de l'en-tête (ex: "Domaine Ramonet")
   - wineName: Le nom précis de la cuvée / appellation / climat (sans le millésime ni le domaine, ex: "Chassagne-Montrachet 1er Cru Morgeot")
   - vintage: Le millésime (ex: "2022", "2020", "NV", "Sans Année")
   - format: Le format de conditionnement (ex: "Bouteille (75cl)", "Magnum (1.5L)", "Demi-bouteille (37.5cl)", "Jéroboam (3L)", etc.)
   - color: La couleur ("Rouge", "Blanc", "Rosé", "Effervescent", "Autre")
   - quantity: Le nombre total de bouteilles / unités achetées (nombre entier positif)
   - unitPriceHT: Le prix unitaire d'achat HT par bouteille/unité en euros (nombre positif)
   - vatRate: Le taux de TVA applicable en pourcentage (ex: 20 pour 20%, 5.5 pour 5.5%, etc.)
   - totalHT: Le montant total HT de la ligne (quantity * unitPriceHT)

Fais très attention à bien décomposer la désignation : sépare bien le domaine, le nom de la cuvée et le millésime pour faciliter le rapprochement automatique.
Sois précis sur les quantités et les prix unitaires.`;

      const requestConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            provider: { type: Type.STRING, description: "Nom du fournisseur ou domaine émetteur de la facture" },
            invoiceNumber: { type: Type.STRING, description: "Numéro de facture ou bon de livraison" },
            invoiceDate: { type: Type.STRING, description: "Date au format YYYY-MM-DD" },
            shippingCostHT: { type: Type.NUMBER, description: "Montant des frais de port HT en euros" },
            totalHT: { type: Type.NUMBER, description: "Total HT de la facture" },
            totalTTC: { type: Type.NUMBER, description: "Total TTC de la facture" },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  rawText: { type: Type.STRING, description: "Libellé brut de la ligne" },
                  domainName: { type: Type.STRING, description: "Nom du domaine ou producteur" },
                  wineName: { type: Type.STRING, description: "Nom de la cuvée ou appellation" },
                  vintage: { type: Type.STRING, description: "Millésime (ex: 2022 ou NV)" },
                  format: { type: Type.STRING, description: "Format (ex: Bouteille (75cl))" },
                  color: { type: Type.STRING, description: "Couleur (Rouge, Blanc, Rosé, Effervescent, Autre)" },
                  quantity: { type: Type.INTEGER, description: "Quantité reçue" },
                  unitPriceHT: { type: Type.NUMBER, description: "Prix unitaire d'achat HT" },
                  vatRate: { type: Type.NUMBER, description: "Taux de TVA en %" },
                  totalHT: { type: Type.NUMBER, description: "Total HT de la ligne" }
                },
                required: ["rawText", "domainName", "wineName", "quantity", "unitPriceHT"]
              }
            }
          },
          required: ["provider", "items"]
        }
      };

      const contents = {
        parts: [
          {
            inlineData: {
              mimeType: effectiveMimeType,
              data: fileBase64
            }
          },
          {
            text: prompt
          }
        ]
      };

      // Resilient execution with model fallback and exponential retry
      const modelsToTry = ["gemini-3.7-flash", "gemini-3.8-flash"];
      let lastError: any = null;
      let response: any = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        for (const modelName of modelsToTry) {
          try {
            console.log(`[Invoice AI] Tentative analyse avec ${modelName} (tour ${attempt}/3)...`);
            response = await ai.models.generateContent({
              model: modelName,
              contents,
              config: requestConfig
            });
            if (response && response.text) {
              console.log(`[Invoice AI] Succès avec ${modelName}`);
              break;
            }
          } catch (err: any) {
            lastError = err;
            const errMsg = err?.message || String(err);
            console.warn(`[Invoice AI] Échec ${modelName} (tour ${attempt}): ${errMsg.substring(0, 120)}`);
            // If 503 or 429, wait briefly and try next model
            await new Promise(resolve => setTimeout(resolve, 800));
          }
        }
        if (response && response.text) break;
        if (attempt < 3) {
          console.log(`[Invoice AI] Pause avant nouvelle tentative...`);
          await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
        }
      }

      if (!response || !response.text) {
        throw lastError || new Error("Le service d'analyse IA est temporairement indisponible. Veuillez réessayer dans quelques instants.");
      }

      const parsedData = JSON.parse(response.text || "{}");
      res.json({ success: true, data: parsedData });
    } catch (error: any) {
      console.error("Erreur lors de l'analyse de la facture PDF:", error);
      const isOverloaded = error?.message?.includes("503") || error?.message?.includes("high demand") || error?.message?.includes("UNAVAILABLE");
      const userMessage = isOverloaded
        ? "Le service d'intelligence artificielle est momentanément surchargé par un pic de demandes. Veuillez cliquer sur 'Réessayer l'analyse' dans quelques secondes."
        : (error.message || "Erreur lors de l'analyse IA de la facture");
      res.status(500).json({ error: userMessage, isTemporary: isOverloaded });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
