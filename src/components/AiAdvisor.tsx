import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot, Sparkles, AlertCircle, TrendingUp, Wallet, ArrowRight } from 'lucide-react';
import Markdown from 'react-markdown';

interface AiAdvisorProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: any[];
  transactions: any[];
}

export const AiAdvisor = ({ isOpen, onClose, accounts, transactions }: AiAdvisorProps) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Merhaba! Ben senin finansal danışmanıyım. Harcamalarını analiz edebilir, bütçe tavsiyeleri verebilir veya finansal hedeflerine ulaşmana yardımcı olabilirim. Sana nasıl yardımcı olabilirim?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Prepare context for the AI
      const context = {
        accounts: accounts.map(a => ({ name: a.name, balance: a.balance, currency: a.currency, type: a.type })),
        recentTransactions: transactions.slice(0, 10).map(t => ({ 
          amount: t.amount, 
          category: t.category, 
          date: t.date instanceof Date ? t.date.toLocaleDateString() : t.date 
        })),
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: `
            Kullanıcı Sorusu: ${userMessage}
            
            Finansal Durum:
            Hesaplar: ${JSON.stringify(context.accounts)}
            Son İşlemler: ${JSON.stringify(context.recentTransactions)}
            
            Lütfen bir finansal danışman gibi davran ve kullanıcıya yardımcı ol. Yanıtlarını Türkçe ve Markdown formatında ver.
          `
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API hatası');
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error: any) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Üzgünüm, bir hata oluştu: ${error.message}. Lütfen daha sonra tekrar dene.` 
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6 pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full sm:w-[450px] h-[80vh] sm:h-[600px] bg-card border-t sm:border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
            >
              {/* Header */}
              <div className="p-6 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                    <Bot className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Finansal Danışman</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Çevrimiçi</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-muted rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Messages */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth bg-background/50"
              >
                {messages.map((msg, i) => (
                  <div 
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl p-4 ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/10' 
                        : 'bg-muted text-foreground border border-border'
                    }`}>
                      <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : 'dark:prose-invert'}`}>
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-muted border border-border rounded-2xl p-4 flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-6 border-t border-border bg-card/50">
                <div className="relative">
                  <input 
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Bir soru sor..."
                    className="w-full bg-background border border-border rounded-2xl pl-4 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
                  />
                  <button 
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-xl transition-all shadow-lg shadow-primary/20"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                <p className="mt-3 text-[10px] text-muted-foreground text-center uppercase tracking-widest font-medium">
                  Gemini AI tarafından desteklenmektedir
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
