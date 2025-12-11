import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { GoogleGenAI, Modality } from '@google/genai';
import https from 'https';

// --- CONFIGURATION ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8448408284:AAGKzxxxV4w4mdHY_fvwRwjQd3q4QkZbdYs';
const API_KEY = process.env.API_KEY;

// --- MODELS ---
const MODEL_CHAT = 'gemini-3-pro-preview';
const MODEL_FAST = 'gemini-2.5-flash-lite';
const MODEL_IMAGE_GEN = 'gemini-3-pro-image-preview';
const MODEL_IMAGE_EDIT = 'gemini-2.5-flash-image';
const MODEL_VIDEO_GEN = 'veo-3.1-fast-generate-preview';
const MODEL_AUDIO_TRANSCRIPT = 'gemini-2.5-flash';
const MODEL_TTS = 'gemini-2.5-flash-preview-tts';
// Video understanding shares the pro model
const MODEL_MULTIMODAL = 'gemini-3-pro-preview';

const SYSTEM_INSTRUCTION = `You are Gobo Ai, a helpful, witty, and advanced AI assistant. 
You can analyze images, videos, and audio. You can also generate images and videos.
Format your responses using Markdown.`;

// --- INITIALIZATION ---
if (!API_KEY) {
  console.error("❌ ERROR: API_KEY is missing.");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Chat history (chatId -> Content[])
const chatHistory = new Map();

console.log("🚀 Gobo Ai is starting...");

// --- HELPER FUNCTIONS ---

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

const downloadFileAsBuffer = (url) => {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    });
};

const updateHistory = (chatId, role, parts) => {
  if (!chatHistory.has(chatId)) chatHistory.set(chatId, []);
  const history = chatHistory.get(chatId);
  history.push({ role, parts });
  if (history.length > 20) chatHistory.set(chatId, history.slice(-20));
};

// --- HANDLERS ---

// /start
bot.onText(/\/start/, (msg) => {
  chatHistory.delete(msg.chat.id);
  bot.sendMessage(msg.chat.id, 
    "🤖 *Hi, I'm Gobo Ai!* \n\n" +
    "Here's what I can do:\n" +
    "💬 *Chat*: Just type naturally (I use Google Maps too!)\n" +
    "🎨 *Image*: `/image <prompt>` (1K High Quality)\n" +
    "✏️ *Edit*: Reply to a photo with `/edit <prompt>`\n" +
    "🎬 *Video*: `/video <prompt>` (Veo)\n" +
    "🗣️ *Speak*: `/say <text>`\n" +
    "🧠 *Think*: `/think <complex query>`\n" +
    "⚡ *Fast*: `/fast <query>`\n\n" +
    "You can also send me **Photos**, **Videos**, or **Audio** to analyze!", 
    { parse_mode: 'Markdown' }
  );
});

// /image (Generation - Gemini 3 Pro Image)
bot.onText(/\/image (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const prompt = match[1];
  bot.sendChatAction(chatId, 'upload_photo');

  try {
    const response = await ai.models.generateContent({
      model: MODEL_IMAGE_GEN,
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: { aspectRatio: "1:1", imageSize: "1K" } // Defaulting to 1K as requested
      }
    });

    // Find image part
    let found = false;
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        const buffer = Buffer.from(part.inlineData.data, 'base64');
        await bot.sendPhoto(chatId, buffer, { caption: `🎨 ${prompt}` });
        found = true;
      }
    }
    if (!found) bot.sendMessage(chatId, "⚠️ Generation completed but no image returned.");
  } catch (err) {
    console.error("Image Gen Error:", err);
    bot.sendMessage(chatId, "❌ Failed to generate image.");
  }
});

// /edit (Image Editing - Gemini 2.5 Flash Image)
// Must be used as a reply to a photo
bot.onText(/\/edit (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const prompt = match[1];

  if (!msg.reply_to_message || !msg.reply_to_message.photo) {
    return bot.sendMessage(chatId, "⚠️ Please reply to a photo with the /edit command.");
  }

  bot.sendChatAction(chatId, 'upload_photo');

  try {
    // Get the photo from the replied message
    const photo = msg.reply_to_message.photo;
    const fileId = photo[photo.length - 1].file_id;
    const fileLink = await bot.getFileLink(fileId);
    const imageBase64 = await downloadFileAsBase64(fileLink);

    const response = await ai.models.generateContent({
      model: MODEL_IMAGE_EDIT,
      contents: {
        parts: [
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
            { text: prompt }
        ]
      },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });

    let found = false;
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        const buffer = Buffer.from(part.inlineData.data, 'base64');
        await bot.sendPhoto(chatId, buffer, { caption: `✏️ ${prompt}` });
        found = true;
      }
    }
    if (!found) bot.sendMessage(chatId, "⚠️ Could not edit the image.");
  } catch (err) {
    console.error("Edit Error:", err);
    bot.sendMessage(chatId, "❌ Failed to edit image.");
  }
});

// /video (Veo Generation)
bot.onText(/\/video (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const prompt = match[1];
  bot.sendMessage(chatId, "🎬 Generating video with Veo... this may take a moment.");
  bot.sendChatAction(chatId, 'upload_video');

  try {
    let operation = await ai.models.generateVideos({
      model: MODEL_VIDEO_GEN,
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    // Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (videoUri) {
        // Fetch the video content
        const videoBuffer = await downloadFileAsBuffer(`${videoUri}&key=${API_KEY}`);
        await bot.sendVideo(chatId, videoBuffer, { caption: `🎬 ${prompt}` });
    } else {
        bot.sendMessage(chatId, "⚠️ Video generation failed (no URI).");
    }

  } catch (err) {
    console.error("Video Gen Error:", err);
    bot.sendMessage(chatId, "❌ Failed to generate video.");
  }
});

// /say (TTS)
bot.onText(/\/say (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[1];
    bot.sendChatAction(chatId, 'record_audio');

    try {
        const response = await ai.models.generateContent({
            model: MODEL_TTS,
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
            }
        });

        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (audioData) {
            const buffer = Buffer.from(audioData, 'base64');
            await bot.sendVoice(chatId, buffer);
        } else {
            bot.sendMessage(chatId, "⚠️ Could not generate audio.");
        }
    } catch (err) {
        console.error("TTS Error:", err);
        bot.sendMessage(chatId, "❌ TTS Failed.");
    }
});

// /fast (Low latency)
bot.onText(/\/fast (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match[1];
    bot.sendChatAction(chatId, 'typing');

    try {
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: query
        });
        bot.sendMessage(chatId, `⚡ ${response.text}`, { parse_mode: 'Markdown' });
    } catch (err) {
        bot.sendMessage(chatId, "❌ Error.");
    }
});

// /think (Thinking Mode)
bot.onText(/\/think (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match[1];
    bot.sendChatAction(chatId, 'typing');
    bot.sendMessage(chatId, "🧠 Thinking deeply...");

    try {
        const response = await ai.models.generateContent({
            model: MODEL_CHAT, // gemini-3-pro-preview
            contents: query,
            config: {
                thinkingConfig: { thinkingBudget: 32768 }
            }
        });
        
        // Split long messages
        const text = response.text || "No response.";
        if (text.length > 4000) {
            const chunks = text.match(/.{1,4000}/g);
            for (const chunk of chunks) await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' });
        } else {
            await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
        }
    } catch (err) {
        console.error("Thinking Error:", err);
        bot.sendMessage(chatId, "❌ Error during thinking process.");
    }
});


// GENERAL MESSAGE HANDLER (Text, Photo, Audio, Video)
bot.on('message', async (msg) => {
  if (msg.text && msg.text.startsWith('/')) return; // handled by onText

  const chatId = msg.chat.id;
  const parts = [];

  try {
    bot.sendChatAction(chatId, 'typing');

    // 1. Handle Photo (Image Analysis)
    if (msg.photo) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        const fileLink = await bot.getFileLink(fileId);
        const base64 = await downloadFileAsBase64(fileLink);
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: base64 } });
    }

    // 2. Handle Audio/Voice (Transcription)
    if (msg.voice || msg.audio) {
        const fileId = (msg.voice || msg.audio).file_id;
        const fileLink = await bot.getFileLink(fileId);
        const base64 = await downloadFileAsBase64(fileLink);
        // Using MODEL_AUDIO_TRANSCRIPT (Flash) specifically for this
        const resp = await ai.models.generateContent({
            model: MODEL_AUDIO_TRANSCRIPT,
            contents: { parts: [{ inlineData: { mimeType: 'audio/ogg', data: base64 } }, { text: "Transcribe this audio." }] }
        });
        return bot.sendMessage(chatId, `📝 *Transcription:*\n${resp.text}`, { parse_mode: 'Markdown' });
    }

    // 3. Handle Video (Video Understanding)
    if (msg.video) {
        bot.sendMessage(chatId, "👀 Analyzing video... (This might take a while)");
        const fileId = msg.video.file_id;
        // Note: Telegram Bot API limit for downloading files is 20MB. 
        // If file is too big, this might fail or requires local bot server.
        // Assuming small videos for this demo.
        const fileLink = await bot.getFileLink(fileId);
        const base64 = await downloadFileAsBase64(fileLink);
        
        const resp = await ai.models.generateContent({
            model: MODEL_MULTIMODAL,
            contents: { parts: [{ inlineData: { mimeType: 'video/mp4', data: base64 } }, { text: msg.caption || "Describe this video." }] }
        });
        return bot.sendMessage(chatId, resp.text, { parse_mode: 'Markdown' });
    }

    // 4. Handle Text (Chat with Maps)
    const text = msg.text || msg.caption;
    if (text) {
        parts.push({ text: text });
        
        // Get history
        const history = chatHistory.get(chatId) || [];
        
        // Add User message to history
        updateHistory(chatId, 'user', parts);
        
        // Construct request
        const response = await ai.models.generateContent({
            model: MODEL_CHAT,
            contents: [
                ...history, 
                { role: 'user', parts: parts }
            ],
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                tools: [{ googleMaps: {} }] // Maps Grounding
            }
        });

        const responseText = response.text || "I'm not sure what to say.";
        
        // Add Model message to history
        updateHistory(chatId, 'model', [{ text: responseText }]);

        // Send response
        if (responseText.length > 4000) {
            const chunks = responseText.match(/.{1,4000}/g);
            for (const chunk of chunks) await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' });
        } else {
            await bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
        }
        
        // Check for Maps grounding (URLs)
        if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            const chunks = response.candidates[0].groundingMetadata.groundingChunks;
            const links = chunks
                .filter(c => c.web?.uri || c.maps?.uri)
                .map(c => `• [${c.web?.title || 'Map Link'}](${c.web?.uri || c.maps?.uri})`)
                .join('\n');
                
            if (links) {
                bot.sendMessage(chatId, `📍 *Sources:*\n${links}`, { parse_mode: 'Markdown' });
            }
        }
    }

  } catch (error) {
    console.error("General Handler Error:", error);
    bot.sendMessage(chatId, "❌ An error occurred. If you sent a large media file, it might be too big for the bot to handle.");
  }
});
