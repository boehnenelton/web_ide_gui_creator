export const serviceDetails: { [key: string]: { name: string } } = {
  "openai": { "name": "OpenAI" },
  "google_gemini": { "name": "Google Gemini" },
  "anthropic": { "name": "Anthropic (Claude)" },
  "groq": { "name": "Groq" },
  "hugging_face": { "name": "Hugging Face" }
};

export const keyTemplate = {
  "format": "AIKeyVault-JSON",
  "version": "1.0.0",
  "description": "API Keys for the Cyberpunk GUI Builder application. Do not commit this file to public repositories.",
  "services": Object.fromEntries(
    Object.entries(serviceDetails).map(([key, value]) => [
      key,
      {
        "name": value.name,
        "keys": [""]
      }
    ])
  )
};
