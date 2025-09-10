import { GoogleGenAI } from "@google/genai";

// FIX: Removed apiKey parameter and now sourcing from environment variables per guidelines.
export const enhanceCodeWithAI = async (prompt: string, language: 'powershell' | 'python'): Promise<string> => {
    // FIX: API key must come from environment variables.
    if (!process.env.API_KEY) {
      throw new Error("Google Gemini API key is not configured. Please set the API_KEY environment variable.");
    }
    
    // FIX: Initialize with API key from environment variables.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const languageName = language.charAt(0).toUpperCase() + language.slice(1);

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: `You are a ${languageName} expert. Your task is to modify the given ${languageName} script based on the user's request. Only output the final, complete, raw code block without any markdown, explanations, or introductory text. Ensure the resulting script is valid and runnable.`,
            },
        });
        
        const text = response.text;
        
        const cleanedText = text.replace(new RegExp(`^\`\`\`${language}\\s*|\\\`\`\`\\s*$`, 'g'), '').trim();

        return cleanedText;
    } catch (error) {
        console.error(`Error generating ${languageName} code:`, error);
        throw new Error(`Failed to generate code from AI for ${languageName}. Please check the console for details.`);
    }
};
