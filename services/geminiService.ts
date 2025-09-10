import { GoogleGenAI } from "@google/genai";

export const enhanceCodeWithAI = async (prompt: string, language: 'powershell' | 'python', apiKey: string): Promise<string> => {
    if (!apiKey) {
      throw new Error("Google Gemini API key is missing. Please import it via the settings menu.");
    }
    
    const ai = new GoogleGenAI({ apiKey });
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
