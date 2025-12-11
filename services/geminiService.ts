import { GoogleGenAI, Type } from "@google/genai";
import { Product, Sale } from "../types";

const apiKey = process.env.API_KEY || '';
// In a real app, we might handle missing keys more gracefully or via UI prompts
// For this demo, we assume the environment variable is injected.

const ai = new GoogleGenAI({ apiKey });

export const generateProductDescription = async (name: string, category: string): Promise<string> => {
  if (!apiKey) return "API Key missing. Cannot generate description.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Write a short, engaging, and sales-oriented product description (max 2 sentences) for a product named "${name}" in the category "${category}".`,
    });
    return response.text || "No description generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to generate description due to an error.";
  }
};

export const analyzeBusinessData = async (sales: Sale[], products: Product[]): Promise<string> => {
  if (!apiKey) return "API Key missing. Cannot analyze data.";

  // Summarize data to avoid token limits
  const totalRevenue = sales.reduce((acc, sale) => acc + sale.totalAmount, 0);
  const lowStockProducts = products.filter(p => p.stock <= p.minStockLevel).map(p => p.name);
  const recentSalesCount = sales.length;

  const prompt = `
    Analyze the following business snapshot and provide 3 brief, actionable insights (bullet points):
    - Total Revenue: $${totalRevenue.toFixed(2)}
    - Recent Transaction Count: ${recentSalesCount}
    - Products with Low Stock: ${lowStockProducts.join(', ') || 'None'}
    
    Focus on inventory health and sales performance.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Speed over deep thought for dashboard
      }
    });
    return response.text || "No insights available.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Unable to analyze business data at this time.";
  }
};

export const suggestRestock = async (products: Product[]): Promise<any[]> => {
    if (!apiKey) return [];

    const inventoryData = products.map(p => ({
        name: p.name,
        currentStock: p.stock,
        minLevel: p.minStockLevel,
        salesVelocity: 'Unknown' // In a real app, calculate this
    }));

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Given this inventory list: ${JSON.stringify(inventoryData)}. 
            Return a JSON array of objects with properties: "productName" and "suggestedAction" (e.g., "Restock Urgent", "Monitor", "OK"). 
            Only include items that need attention.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            productName: { type: Type.STRING },
                            suggestedAction: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        
        const text = response.text;
        if (!text) return [];
        return JSON.parse(text);
    } catch (e) {
        console.error("Restock Suggestion Error", e);
        return [];
    }
}
