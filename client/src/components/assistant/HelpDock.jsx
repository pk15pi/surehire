import React, { useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { MessageCircle, Phone, X, Send, Mail } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { STARTER_CHIPS } from './knowledgeBase';
import { match, getIntent } from './matcher';
import { telHref, mailHref, waHref, fillTemplate, CONTACT_EMAIL, CONTACT_PHONE, PHONE_DISPLAY, WHATSAPP_DISPLAY } from './config';
import WhatsAppIcon from './WhatsAppIcon';

const STORAGE_KEY = 'surehire_help_chat_v1';

const welcome = () => ({
  from: 'bot',
  text: 'Hi! I’m the SureHire help assistant. Ask me about jobs, resumes, hiring, or how to reach us.',
  chips: STARTER_CHIPS,
});

const fallback = () => ({
  from: 'bot',
  fallback: true,
  text: 'I couldn’t find an answer to that. Please contact us by phone, email or WhatsApp and our team will help.',
});

const answerFor = (intent) => ({
  from: 'bot',
  text: fillTemplate(intent.answer),
  actions: intent.actions || [],
  chips: (intent.followUps || []).slice(0, 3),
});

const loadMessages = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch { /* ignore */ }
  return [welcome()];
};

const dockBtn = 'w-12 h-12 rounded-full flex items-center justify-center shadow-md border transition focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 hover:-translate-y-0.5';

const HelpDock = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { openSignIn } = useClerk();
  const { setShowRecruiterLogin, showRecruiterLogin, setShowScheduleCall } = useContext(AppContext);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(loadMessages);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const toggleRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
  }, [messages]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, typing, open]);

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); toggleRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Public pages only: hide on recruiter dashboard, admin, and while recruiter modal is open.
  if (location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/admin') || showRecruiterLogin) return null;

  const reply = (userText, botMsg) => {
    setMessages((m) => [...m, { from: 'user', text: userText }]);
    setTyping(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setMessages((m) => [...m, botMsg]);
      setTyping(false);
    }, 400);
  };

  const ask = (text) => {
    const q = text.trim();
    if (!q || typing) return;
    const { intent } = match(q);
    reply(q, intent ? answerFor(intent) : fallback());
  };

  const askIntent = (id) => {
    const intent = getIntent(id);
    if (intent && !typing) reply(intent.label || id, answerFor(intent));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    ask(input);
    setInput('');
  };

  const runAction = (a) => {
    if (a.type === 'route') navigate(a.to);
    else if (a.type === 'section') {
      const scroll = () => document.getElementById(a.id)?.scrollIntoView({ behavior: 'smooth' });
      // Jobs and FAQ have their own pages; other sections are on the home page
      const page = { 'job-list': '/jobs', faq: '/faq' }[a.id] || '/';
      if (location.pathname !== page) { navigate(page); setTimeout(scroll, 300); } else scroll();
    } else if (a.type === 'signIn') openSignIn();
    else if (a.type === 'recruiterLogin') { setOpen(false); setShowRecruiterLogin(true); }
    else if (a.type === 'scheduleCall') { setOpen(false); setShowScheduleCall(a.iAm ? { iAm: a.iAm } : true); }
  };

  const hrefFor = (a) => (a.type === 'tel' ? telHref : a.type === 'mailto' ? mailHref : a.type === 'whatsapp' ? waHref : '');

  const renderAction = (a, i) => {
    const cls = 'text-xs px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';
    if (['tel', 'mailto', 'whatsapp'].includes(a.type)) {
      const href = hrefFor(a);
      if (!href) return null;
      return (
        <a key={i} href={href} className={cls} {...(a.type === 'whatsapp' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {a.label}
        </a>
      );
    }
    return <button key={i} type="button" onClick={() => runAction(a)} className={cls}>{a.label}</button>;
  };

  return (
    <div className="fixed z-[9999] right-3 sm:right-5 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-[max(1.25rem,env(safe-area-inset-bottom))] print:hidden">
      {open && (
        <div
          id="surehire-help-panel"
          role="dialog"
          aria-modal="false"
          aria-label="SureHire help assistant"
          className="absolute bottom-full right-0 mb-3 w-[calc(100vw-1.5rem)] sm:w-96 max-h-[70vh] flex flex-col bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <div>
              <p className="font-semibold text-sm">SureHire Assistant</p>
              <p className="text-xs text-blue-100">Quick answers about jobs & hiring</p>
            </div>
            <button type="button" onClick={() => { setOpen(false); toggleRef.current?.focus(); }} aria-label="Close assistant"
              className="p-1 rounded-full hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <X size={18} />
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-gray-50 text-sm" aria-live="polite" aria-relevant="additions">
            {messages.map((m, idx) => (
              <div key={idx} className={m.from === 'user' ? 'flex justify-end' : 'flex flex-col items-start'}>
                <div className={`max-w-[85%] whitespace-pre-line px-3 py-2 rounded-2xl ${m.from === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'}`}>
                  {m.text}
                  {m.fallback && (
                    <span className="block mt-2 space-y-1">
                      {CONTACT_PHONE && <a href={telHref} className="flex items-center gap-1 text-blue-700 underline"><Phone size={14} aria-hidden="true" />{PHONE_DISPLAY}</a>}
                      <a href={mailHref} className="flex items-center gap-1 text-blue-700 underline"><Mail size={14} aria-hidden="true" />{CONTACT_EMAIL}</a>
                      {waHref && <a href={waHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-700 underline"><WhatsAppIcon className="w-3.5 h-3.5" />WhatsApp {WHATSAPP_DISPLAY}</a>}
                    </span>
                  )}
                </div>
                {m.from === 'bot' && m.actions?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">{m.actions.map(renderAction)}</div>
                )}
                {m.from === 'bot' && m.chips?.length > 0 && idx === messages.length - 1 && !typing && (
                  <div className="flex flex-wrap gap-2 mt-2" aria-label="Suggested questions">
                    {m.chips.map((id) => {
                      const it = getIntent(id);
                      return it ? (
                        <button key={id} type="button" onClick={() => askIntent(id)}
                          className="text-xs px-3 py-1.5 rounded-full border border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                          {it.label}
                        </button>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            ))}
            {typing && (
              <div className="flex items-center gap-1 px-3 py-2 bg-white border border-gray-200 rounded-2xl w-fit" aria-label="Assistant is typing" role="status">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:120ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:240ms]" />
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2 p-2 border-t border-gray-200 bg-white">
            <label htmlFor="surehire-help-input" className="sr-only">Type your question</label>
            <input id="surehire-help-input" ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} maxLength={300}
              placeholder="Type your question…" autoComplete="off"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-full focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
            <button type="submit" aria-label="Send message" disabled={!input.trim() || typing}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      <nav aria-label="Help and contact" className="flex flex-col items-end gap-3">
        <button ref={toggleRef} type="button" onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close AI assistant' : 'Open AI assistant'} aria-expanded={open} aria-controls="surehire-help-panel"
          title="Ask SureHire Assistant"
          className={`${dockBtn} bg-blue-600 border-blue-600 text-white hover:bg-blue-700`}>
          {open ? <X size={20} /> : <MessageCircle size={20} />}
        </button>
        {telHref && (
          <a href={telHref} aria-label={`Call SureHire at ${CONTACT_PHONE}`} title="Call us"
            className={`${dockBtn} bg-white border-gray-200 text-blue-600 hover:bg-gray-50`}>
            <Phone size={20} />
          </a>
        )}
        {waHref && (
          <a href={waHref} target="_blank" rel="noopener noreferrer" aria-label="Chat with SureHire on WhatsApp (opens in new tab)" title="WhatsApp us"
            className={`${dockBtn} bg-[#25D366] border-[#25D366] text-white hover:brightness-95`}>
            <WhatsAppIcon className="w-5 h-5" />
          </a>
        )}
      </nav>
    </div>
  );
};

export default HelpDock;
