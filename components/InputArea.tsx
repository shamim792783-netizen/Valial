import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, X, Loader2, Palette } from 'lucide-react';
import { resizeImage } from '../utils/imageUtils';

interface InputAreaProps {
  onSendMessage: (text: string, image?: string, mode?: 'chat' | 'image-gen') => void;
  isLoading: boolean;
}

export const InputArea: React.FC<InputAreaProps> = ({ onSendMessage, isLoading }) => {
  const [text, setText] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isImageGenMode, setIsImageGenMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [text]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await resizeImage(file);
        setImageBase64(base64);
        setPreviewUrl(URL.createObjectURL(file));
      } catch (err) {
        console.error("Failed to process image", err);
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearImage = () => {
    setImageBase64(null);
    setPreviewUrl(null);
  };

  const handleSend = () => {
    if ((!text.trim() && !imageBase64) || isLoading) return;
    
    onSendMessage(text, imageBase64 || undefined, isImageGenMode ? 'image-gen' : 'chat');
    setText('');
    clearImage();
    
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      {/* Mode Indicator/Toggle */}
      <div className="flex justify-center mb-2">
        <button
          onClick={() => setIsImageGenMode(!isImageGenMode)}
          disabled={isLoading}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
            isImageGenMode
              ? 'bg-purple-600/20 border-purple-500/50 text-purple-300'
              : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Palette size={14} className={isImageGenMode ? 'text-purple-400' : ''} />
          {isImageGenMode ? 'Image Generation Mode' : 'Switch to Image Generation'}
        </button>
      </div>

      {/* Image Preview */}
      {previewUrl && (
        <div className="relative inline-block mb-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <img src={previewUrl} alt="Preview" className="h-20 w-auto rounded-lg border border-slate-600 shadow-md" />
          <button
            onClick={clearImage}
            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className={`relative flex items-end gap-2 bg-slate-900/80 backdrop-blur-xl border rounded-2xl p-2 shadow-xl ring-1 transition-colors duration-300 ${
        isImageGenMode 
          ? 'border-purple-500/30 ring-purple-500/10' 
          : 'border-slate-700/50 ring-white/5'
      }`}>
        
        {/* Image Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className={`p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isImageGenMode 
              ? 'text-purple-300 hover:bg-purple-900/30 hover:text-purple-200' 
              : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800'
          }`}
          title={isImageGenMode ? "Upload image to edit" : "Upload image"}
        >
          <ImageIcon size={22} />
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleImageUpload}
        />

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isImageGenMode ? "Describe the image you want to generate..." : "Ask anything..."}
          className="flex-1 max-h-[150px] py-3 bg-transparent text-slate-200 placeholder-slate-500 text-base focus:outline-none resize-none overflow-y-auto"
          rows={1}
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={isLoading || (!text.trim() && !imageBase64)}
          className={`p-3 rounded-xl transition-all duration-200 ${
            isLoading || (!text.trim() && !imageBase64)
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
              : isImageGenMode
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
          }`}
        >
          {isLoading ? <Loader2 size={22} className="animate-spin" /> : <Send size={22} />}
        </button>
      </div>
      
      <div className="text-center mt-2 text-xs text-slate-600">
        {isImageGenMode 
          ? 'Using Gemini 2.5 Flash Image. Generates and edits images.' 
          : 'Powered by Gemini 2.5 Flash. AI can make mistakes.'}
      </div>
    </div>
  );
};