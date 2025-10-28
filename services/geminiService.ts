/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const PROMPTS: Record<string, string> = {
    'Kiez-König': 'Reimagine the person in this photo as a powerful Hamburg pimp from the 1980s, the "Kiez-König". The image should be a photorealistic portrait. They are wearing a black leather jacket over an open-collared shirt, heavy gold chains, and have a confident, intimidating expression. The background is a dimly lit, smoky bar on the Reeperbahn. The aesthetic must feel like a gritty 1980s film photograph.',
    'Luden-Larry': 'Reimagine the person in this photo as a flashy Hamburg pimp from the 1980s, "Luden-Larry". They are wearing a garish, brightly colored silk shirt, a white blazer, and gold-rimmed aviator sunglasses. They are leaning against a classic 80s sports car. The background is filled with the bright neon signs of the Reeperbahn at night. The style should be vibrant and slightly over-saturated, like a high-flash 80s photo.',
    'Gold-Zahn Günther': 'Reimagine the person in this photo as a tough, street-level Hamburg pimp from the 1980s, "Gold-Zahn Günther". They have a mullet hairstyle and a prominent gold tooth. They are wearing a cheap-looking tracksuit and a scowl. The photo must have a raw, candid feel, as if taken on a gritty side street off the Reeperbahn. The lighting is harsh and the colors are slightly faded.',
    'Disco Dieter': 'Reimagine the person in this photo as a stylish Hamburg pimp from the 1980s, "Disco Dieter". They are inside a pulsating 80s disco, with a disco ball and colorful lights in the background. They are wearing a shiny shirt, tight pants, and have perfectly coiffed hair. They are holding a cocktail and have a suave look. The image must capture the dynamic, colorful atmosphere of an 80s nightclub.',
    'Porsche-Paul': 'Reimagine the person in this photo as a wealthy Hamburg pimp from the 1980s, "Porsche-Paul". They are standing proudly next to a white Porsche 911. They are wearing an expensive suit with the jacket open, revealing a flamboyant shirt. Their expression is one of smug success. The scene is set on a Hamburg street at dusk, with the car\'s headlights on. The photo style should be sharp and glossy, like from a car magazine of the era.'
};


/**
 * Processes the Gemini API response, extracting the image or throwing an error if none is found.
 * @param response The response from the generateContent call.
 * @returns A data URL string for the generated image.
 */
function processGeminiResponse(response: GenerateContentResponse): string {
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        return `data:${mimeType};base64,${data}`;
    }

    const textResponse = response.text;
    console.error("API did not return an image. Response:", textResponse);
    throw new Error(`The AI model responded with text instead of an image: "${textResponse || 'No text response received.'}"`);
}

/**
 * A wrapper for the Gemini API call that includes a retry mechanism for internal server errors.
 * @param imagePart The image part of the request payload.
 * @param textPart The text part of the request payload.
 * @returns The GenerateContentResponse from the API.
 */
async function callGeminiWithRetry(imagePart: object, textPart: object): Promise<GenerateContentResponse> {
    const maxRetries = 3;
    const initialDelay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [imagePart, textPart] },
            });
        } catch (error) {
            console.error(`Error calling Gemini API (Attempt ${attempt}/${maxRetries}):`, error);
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            const isInternalError = errorMessage.includes('"code":500') || errorMessage.includes('INTERNAL');

            if (isInternalError && attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt - 1);
                console.log(`Internal error detected. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error; // Re-throw if not a retriable error or if max retries are reached.
        }
    }
    // This should be unreachable due to the loop and throw logic above.
    throw new Error("Gemini API call failed after all retries.");
}


/**
 * Generates an 80s pimp-styled image from a source image and an archetype name.
 * @param imageDataUrl A data URL string of the source image (e.g., 'data:image/png;base64,...').
 * @param pimpName The name of the pimp archetype (e.g., 'Kiez-König').
 * @returns A promise that resolves to a base64-encoded image data URL of the generated image.
 */
export async function generatePimpImage(imageDataUrl: string, pimpName: string): Promise<string> {
    const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
        throw new Error("Invalid image data URL format. Expected 'data:image/...;base64,...'");
    }
    const [, mimeType, base64Data] = match;

    const prompt = PROMPTS[pimpName];
    if (!prompt) {
        throw new Error(`No prompt found for archetype: ${pimpName}`);
    }

    const imagePart = {
        inlineData: { mimeType, data: base64Data },
    };
    const textPart = { text: prompt };

    try {
        console.log(`Attempting generation for ${pimpName}...`);
        const response = await callGeminiWithRetry(imagePart, textPart);
        return processGeminiResponse(response);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error(`An unrecoverable error occurred during image generation for ${pimpName}.`, error);
        throw new Error(`The AI model failed to generate an image. Details: ${errorMessage}`);
    }
}