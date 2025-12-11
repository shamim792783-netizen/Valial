import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from './types';
import { streamChatResponse, generateImageResponse } from './services/geminiService';
import { ChatMessageBubble } from './components/ChatMessageBubble';
import { InputArea } from './components/InputArea';
import { Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (text: string, image?: string, mode: 'chat' | 'image-gen' = 'chat') => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      image,
      timestamp: Date.now(),
    };

    // Add user message to state
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Create a placeholder for the model response
    const modelMessageId = crypto.randomUUID();
    const modelPlaceholder: ChatMessage = {
      id: modelMessageId,
      role: 'model',
      text: '',
      isStreaming: true,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, modelPlaceholder]);

    try {
      if (mode === 'image-gen') {
        // Handle Image Generation
        const response = await generateImageResponse(text, image);
        
        setMessages((prev) => 
          prev.map((msg) => 
            msg.id === modelMessageId 
              ? { 
                  ...msg, 
                  text: response.text || (response.image ? "Here is your generated image." : "I couldn't generate an image."), 
                  image: response.image,
                  isStreaming: false 
                } 
              : msg
          )
        );
      } else {
        // Handle Standard Chat
        const history = messages; 

        await streamChatResponse(
          history,
          text,
          image,
          (streamedText) => {
            setMessages((prev) => 
              prev.map((msg) => 
                msg.id === modelMessageId 
                  ? { ...msg, text: streamedText } 
                  : msg
              )
            );
          }
        );

        // Finalize message state for chat
        setMessages((prev) => 
          prev.map((msg) => 
            msg.id === modelMessageId 
              ? { ...msg, isStreaming: false } 
              : msg
          )
        );
      }

    } catch (error) {
      console.error("Error generating response", error);
      setMessages((prev) => 
        prev.map((msg) => 
          msg.id === modelMessageId 
            ? { ...msg, text: "Sorry, I encountered an error processing your request.", isStreaming: false } 
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Gemini 2.5 Flash
            </h1>
          </div>
          <div className="text-xs font-medium px-2 py-1 bg-indigo-900/30 text-indigo-300 rounded border border-indigo-500/30">
            Preview
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full px-4 py-8 min-h-full flex flex-col">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-0 animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/5 flex items-center justify-center mb-6">
                <Sparkles className="text-indigo-400 w-10 h-10" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-2">How can I help you today?</h2>
              <p className="text-slate-400 max-w-md">
                I can analyze images, help with code, write stories, or generate images. 
                <br />
                <span className="text-indigo-400">Try toggling Image Generation Mode!</span>
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessageBubble key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} className="h-4" />
            </>
          )}
        </div>
      </main>

      {/* Input Area */}
      <div className="sticky bottom-0 z-20 pb-4 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent pt-10">
        <InputArea onSendMessage={handleSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default App;