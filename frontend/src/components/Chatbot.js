import React, { useState, useEffect, useRef } from 'react';
import { FiMessageSquare, FiX, FiSend, FiMinimize2, FiMaximize2 } from 'react-icons/fi';
import { apiClient } from './api';
import '../styles.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AUTH_TOKEN_KEY } from './api';

const Chatbot = ({ activePage, selectedResumeId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am your AI Recruitment Assistant. I can help you analyze candidates, explain ATS scores, or suggest resume improvements. How can I assist you today?' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (text) => {
    const messageText = text || inputValue;
    if (!messageText.trim()) return;

    const newMessages = [...messages, { role: 'user', content: messageText }];
    setMessages(newMessages);
    setInputValue('');
    setIsTyping(true);

    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
      const url = `${baseUrl}/api/chat/stream`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          messages: newMessages,
          context: {
            page: activePage,
            resumeId: selectedResumeId
          }
        })
      });

      if (!response.ok) {
        throw new Error("Failed to connect to chat API");
      }

      setIsTyping(false); // Stop typing indicator once stream starts
      setMessages((prev) => [...prev, { role: 'assistant', content: "" }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        assistantMessage += chunk;
        
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: assistantMessage };
          return updated;
        });
      }
    } catch (error) {
      console.error("Chat error:", error);
      setIsTyping(false);
      setMessages([...newMessages, { role: 'assistant', content: "Sorry, I'm having trouble connecting to the AI provider." }]);
    }
  };

  const handleQuickAction = (action) => {
    handleSend(action);
  };

  if (!isOpen) {
    return (
      <button className="chatbot-fab" onClick={() => setIsOpen(true)}>
        <FiMessageSquare size={24} />
      </button>
    );
  }

  return (
    <div className={`chatbot-window ${isMinimized ? 'minimized' : ''}`}>
      <div className="chatbot-header" onClick={() => setIsMinimized(!isMinimized)}>
        <div className="chatbot-title">
          <div className="ai-avatar">
            <FiMessageSquare className="chatbot-icon" />
          </div>
          <div style={{display: 'flex', flexDirection: 'column'}}>
            <span>AI Assistant</span>
            <span style={{fontSize: '0.65rem', color: '#a5b4fc'}}>Smart Workflow Mode</span>
          </div>
        </div>
        <div className="chatbot-controls">
          <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
            {isMinimized ? <FiMaximize2 size={16} /> : <FiMinimize2 size={16} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
            <FiX size={18} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="chatbot-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                {msg.role === 'assistant' ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            ))}
            {isTyping && (
              <div className="chat-bubble assistant typing-indicator">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot-quick-actions" style={{
            display: 'flex', 
            overflowX: 'auto', 
            padding: '10px', 
            gap: '8px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            scrollbarWidth: 'none'
          }}>
            <button onClick={() => handleQuickAction("Show Top Candidates")}>🏆 Top Candidates</button>
            <button onClick={() => handleQuickAction("Explain ATS Score")}>📊 Explain Score</button>
            <button onClick={() => handleQuickAction("Compare Candidates")}>⚖️ Compare Resumes</button>
            <button onClick={() => handleQuickAction("Resume Improvement Tips")}>💡 Improve Resume</button>
            <button onClick={() => handleQuickAction("Missing Skills Analysis")}>🔍 Missing Skills</button>
            <button onClick={() => handleQuickAction("Why Candidate Rejected?")}>❌ Why Rejected?</button>
            <button onClick={() => handleQuickAction("Best Candidate for Role")}>🌟 Best Match</button>
            <button onClick={() => handleQuickAction("Dashboard Insights")}>📈 Dashboard Stats</button>
            <button onClick={() => handleQuickAction("Resume Format Analysis")}>📝 Format Check</button>
            <button onClick={() => handleQuickAction("Hiring Recommendations")}>🤝 Recommendations</button>
          </div>

          <div className="chatbot-input-area">
            <input
              type="text"
              placeholder="Ask me anything..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button className="send-btn" onClick={() => handleSend()}>
              <FiSend size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Chatbot;
