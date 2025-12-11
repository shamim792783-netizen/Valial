import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, Sparkles } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] md:max-w-[85%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser 
            ? 'bg-indigo-600' 
            : message.image && !isUser ? 'bg-purple-600' : 'bg-emerald-600'
        }`}>
          {isUser ? <User size={16} className="text-white" /> : (
            message.image && !isUser ? <Sparkles size={16} className="text-white" /> : <Bot size={16} className="text-white" />
          )}
        </div>

        {/* Bubble Content */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full min-w-0`}>
          <div className={`rounded-2xl px-5 py-3 shadow-sm w-full ${
            isUser 
              ? 'bg-indigo-600 text-white rounded-tr-sm' 
              : message.image ? 'bg-slate-800 text-slate-100 border border-purple-500/30 rounded-tl-sm' : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-sm'
          }`}>
            
            {/* Image attachment */}
            {message.image && (
              <div className={`mb-3 overflow-hidden rounded-lg border ${isUser ? 'border-white/20' : 'border-slate-600'} ${isUser ? 'max-w-[300px]' : 'w-full max-w-md'}`}>
                <img 
                  src={`data:image/jpeg;base64,${message.image}`} 
                  alt={isUser ? "User upload" : "Generated image"} 
                  className="w-full h-auto object-cover"
                />
              </div>
            )}

            {/* Text Content */}
            {(message.text || message.isStreaming) && (
              <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert text-white' : 'prose-invert text-slate-100'} break-words overflow-hidden`}>
                 {message.text ? (
                   <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Ensure links open in new tab
                        a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all" />,
                        // Style code blocks specifically
                        pre: ({node, ...props}) => (
                            <div className="overflow-x-auto my-2 rounded-lg border border-slate-700/50 bg-slate-900/50">
                                <pre {...props} className="p-3 m-0 bg-transparent" />
                            </div>
                        ),
                        code: ({node, ...props}) => {
                            // Helper to check if it's inline code by lack of specific props usually passed to block code
                            // @ts-ignore
                            const isInline = !props.className && !String(props.children).includes('\n');
                            return (
                                <code 
                                    {...props} 
                                    className={`${props.className || ''} ${isInline ? 'bg-slate-700/50 rounded px-1 py-0.5 text-xs font-mono' : 'text-xs font-mono'}`} 
                                />
                            )
                        }
                      }}
                   >
                     {message.text}
                   </ReactMarkdown>
                 ) : (
                   message.isStreaming && <span className="animate-pulse">Thinking...</span>
                 )}
              </div>
            )}
          </div>
          
          {/* Timestamp */}
          <div className="text-xs text-slate-500 mt-1 px-1">
             {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
};