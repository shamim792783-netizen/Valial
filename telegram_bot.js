import TelegramBot from 'node-telegram-bot-api';
import { GoogleGenAI } from '@google/genai';
import https from 'https';

// --- CONFIGURATION ---
// In production, use process.env.TELEGRAM_TOKEN
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8448408284:AAGKzxxxV4w4mdHY_fvwRwjQd3q4QkZbdYs';
const API_KEY = process.env.API_KEY;

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

const SYSTEM_INSTRUCTION = `You are a helpful, witty, and concise AI assistant powered by Gemini 2.5. 
You can analyze images and answer questions about them. 
Format your responses using Markdown.`;

// --- INITIALIZATION ---
if (!API_KEY) {
  console.error("❌ ERROR: API_KEY is missing. Please set the API_KEY environment variable.");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Store chat history in memory (chatId -> Message[])
// In a real app, use a database (Redis/Postgres)
const chatHistory = new Map();

console.log("🚀 Telegram Bot is starting...");

// --- HELPER FUNCTIONS ---

/**
 * Downloads a file from a URL and returns it as a base64 string
 */
const downloadFileAsBase64 = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer.toString('base64'));
      });
      response.on('error', reject);
    }).on('error', reject);
  });
};

/**
 * Manages chat history window (keep last 20 turns)
 */
const updateHistory = (chatId, role, text, imageBase64 = null) => {
  if (!chatHistory.has(chatId)) {
    chatHistory.set(chatId, []);
  }
  const history = chatHistory.get(chatId);

  const parts = [];
  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64
      }
    });
  }
  if (text) {
    parts.push({ text: text });
  }

  history.push({ role, parts });

  // Limit history to last 20 messages to prevent token overflow
  if (history.length > 20) {
    chatHistory.set(chatId, history.slice(-20));
  }
};

/**
 * Maps internal history format to Gemini Content format
 */
const getGeminiHistory = (chatId) => {
  return chatHistory.get(chatId) || [];
};

// --- HANDLERS ---

// 1. Handle /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  chatHistory.delete(chatId); // Reset history
  bot.sendMessage(chatId, 
    "👋 *Hello! I am Gemini 2.5 Flash.* \n\n" +
    "I can:\n" +
    "✨ Chat with you\n" +
    "👁️ Analyze photos you send\n" +
    "🎨 Generate images using `/image <prompt>`\n\n" +
    "How can I help you today?", 
    { parse_mode: 'Markdown' }
  );
});

// 2. Handle /image command (Image Generation)
bot.onText(/\/image (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const prompt = match[1];

  try {
    bot.sendChatAction(chatId, 'upload_photo');

    const response = await ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });

    // Extract image from response
    let imageSent = false;
    const candidates = response.candidates;
    if (candidates && candidates[0].content && candidates[0].content.parts) {
        for (const part of candidates[0].content.parts) {
            if (part.inlineData) {
                const buffer = Buffer.from(part.inlineData.data, 'base64');
                await bot.sendPhoto(chatId, buffer, { caption: `🎨 ${prompt}` });
                imageSent = true;
            }
        }
    }

    if (!imageSent) {
        bot.sendMessage(chatId, "⚠️ I tried to generate an image but the model returned no image data.");
    }

  } catch (error) {
    console.error("Image Gen Error:", error);
    bot.sendMessage(chatId, "❌ Failed to generate image. Please try again.");
  }
});

// 3. Handle Text and Photos (General Chat)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  // Skip commands we already handled
  if (msg.text && msg.text.startsWith('/')) return;

  const text = msg.text || msg.caption || (msg.photo ? "Analyze this image" : "");
  
  if (!text && !msg.photo) return; // Ignore non-text/non-photo updates

  try {
    bot.sendChatAction(chatId, 'typing');

    let inputImageBase64 = null;

    // Handle Photo
    if (msg.photo) {
      // Get the largest photo
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      const fileLink = await bot.getFileLink(fileId);
      inputImageBase64 = await downloadFileAsBase64(fileLink);
    }

    // Prepare contents
    // We get current history, then append user's new message to the list sent to API
    const history = getGeminiHistory(chatId);
    
    const currentParts = [];
    if (inputImageBase64) {
      currentParts.push({
        inlineData: { mimeType: 'image/jpeg', data: inputImageBase64 }
      });
    }
    currentParts.push({ text: text });

    const contents = [
      ...history,
      { role: 'user', parts: currentParts }
    ];

    // Call Gemini
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      }
    });

    const responseText = result.response.text;

    // Update History
    updateHistory(chatId, 'user', text, inputImageBase64);
    updateHistory(chatId, 'model', responseText);

    // Send response to Telegram
    // Telegram has a 4096 char limit, simple split logic
    if (responseText.length > 4000) {
        const chunks = responseText.match(/.{1,4000}/g);
        for (const chunk of chunks) {
            await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' });
        }
    } else {
        await bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
    }

  } catch (error) {
    console.error("Chat Error:", error);
    bot.sendMessage(chatId, "❌ Sorry, I encountered an error. Please try again.");
  }
});
