import { GoogleGenAI, Content, Part } from "@google/genai";
import { ChatMessage } from "../types";
import { GEMINI_MODEL, GEMINI_IMAGE_MODEL, SYSTEM_INSTRUCTION } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const mapMessagesToContent = (messages: ChatMessage[]): Content[] => {
  return messages.map((msg) => {
    const parts: Part[] = [];
    
    if (msg.image) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg', // Assuming jpeg for simplicity in this demo
          data: msg.image
        }
      });
    }
    
    if (msg.text) {
      parts.push({ text: msg.text });
    }

    return {
      role: msg.role,
      parts: parts
    };
  });
};

export const streamChatResponse = async (
  history: ChatMessage[],
  newMessageText: string,
  newImageBase64?: string,
  onChunk?: (text: string) => void
): Promise<string> => {
  
  // Prepare history excluding the current message being sent (it's added below)
  const previousContent = mapMessagesToContent(history);

  const currentParts: Part[] = [];
  if (newImageBase64) {
    currentParts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: newImageBase64
      }
    });
  }
  currentParts.push({ text: newMessageText });

  const contents: Content[] = [
    ...previousContent,
    { role: 'user', parts: currentParts }
  ];

  try {
    const responseStream = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      }
    });

    let fullText = '';
    for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
            fullText += text;
            if (onChunk) onChunk(fullText);
        }
    }
    return fullText;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateImageResponse = async (
  prompt: string,
  inputImageBase64?: string
): Promise<{ text: string; image?: string }> => {
  const parts: Part[] = [];

  // If input image is provided, we are editing/using it as reference
  if (inputImageBase64) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: inputImageBase64
      }
    });
  }
  
  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: {
        parts: parts
      },
      // Note: responseMimeType is not supported for nano banana series
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        }
      }
    });

    let generatedText = '';
    let generatedImage: string | undefined = undefined;

    // The response candidates content parts may contain text and/or images
    const candidateContent = response.candidates?.[0]?.content;
    
    if (candidateContent && candidateContent.parts) {
      for (const part of candidateContent.parts) {
        if (part.inlineData) {
          generatedImage = part.inlineData.data;
        } else if (part.text) {
          generatedText += part.text;
        }
      }
    }

    return { text: generatedText, image: generatedImage };

  } catch (error) {
    console.error("Gemini Image Gen Error:", error);
    throw error;
  }
};