'use client';

import { useEffect, useRef, useState } from 'react';

const QUICK_PROMPTS = [
  'Quero um apartamento no Petrópolis',
  'Mostre imóveis até 700 mil',
  'Quero duas vagas no Menino Deus',
];

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function propertyValue(row, names) {
  for (const name of names) {
    const found = Object.entries(row || {}).find(([key]) => normalize(key) === normalize(name));
    if (found && found[1] !== null && found[1] !== undefined && found[1] !== '') return found[1];
  }
  return '';
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(number)
    : 'Valor sob consulta';
}

function listingLabel(row) {
  const district = propertyValue(row, ['bairro', 'neighborhood', 'district']) || 'Porto Alegre';
  const title = propertyValue(row, ['titulo', 'title', 'nome', 'name']) || `Imóvel em ${district}`;
  const price = propertyValue(row, ['valor_venda', 'preco_venda', 'valor_imovel', 'preco', 'price', 'valor']);
  return { district: String(district), title: String(title), price: money(price) };
}

function listingUrl(row) {
  const url = propertyValue(row, ['url_publica', 'link_publico', 'url', 'link']);
  return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : '';
}

export default function VoiceAssistant({ onSearch, listings = [] }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Olá. Posso ajudar a pesquisar imóveis por bairro, valor, dormitórios e vagas. Você pode falar ou escrever.' },
  ]);
  const recognitionRef = useRef(null);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  function say(text) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  }

  function addMessage(role, text) {
    setMessages((current) => [...current, { role, text }]);
  }

  async function askAssistant(rawText) {
    const text = String(rawText || '').trim();
    if (!text || busy) return;
    addMessage('user', text);
    setInput('');
    setBusy(true);
    const lower = normalize(text);
    if (lower.includes('financiamento') || lower.includes('consorcio')) {
      const answer = 'Posso ajudar a comparar cenários de financiamento e consórcio no cartão Planejador. Para buscar imóveis, diga também o bairro, tipo ou faixa de valor.';
      addMessage('assistant', answer);
      say(answer);
      setBusy(false);
      return;
    }
    if (lower.includes('media') || lower.includes('valor por metro') || lower.includes('dados')) {
      const answer = 'Os dados de mercado são agregados por bairro e período. Para consultar a média anual de vendas por metro quadrado, use o cartão Dados de Porto Alegre na página.';
      addMessage('assistant', answer);
      say(answer);
      setBusy(false);
      return;
    }
    const result = await onSearch(text);
    const answer = result?.message || 'Posso buscar por bairro, valor, dormitórios e vagas. Tente: apartamento no Petrópolis até 700 mil.';
    addMessage('assistant', answer);
    say(answer);
    setBusy(false);
  }

  function startListening() {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const answer = 'Seu navegador não oferece conversa por voz. Você pode escrever sua busca aqui.';
      addMessage('assistant', answer);
      say(answer);
      return;
    }
    recognitionRef.current?.abort();
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => askAssistant(event.results?.[0]?.[0]?.transcript || '');
    recognition.onerror = () => {
      setListening(false);
      const answer = 'Não consegui ouvir. Tente novamente ou escreva sua busca.';
      addMessage('assistant', answer);
      say(answer);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  }

  return (
    <aside className={`voice-assistant ${open ? 'is-open' : ''}`} aria-label="Assistente de voz do IPLICT">
      {!open && <button className="voice-assistant-launch" type="button" onClick={() => setOpen(true)}><span aria-hidden="true">◉</span> Conversar por voz</button>}
      {open && <div className="voice-assistant-panel">
        <div className="voice-assistant-header"><div><span className="eyebrow">ASSISTENTE IPLICT</span><strong>Vamos encontrar com calma.</strong></div><button type="button" className="voice-assistant-close" onClick={() => setOpen(false)} aria-label="Fechar assistente">×</button></div>
        <div className="voice-assistant-messages" aria-live="polite">
          {messages.map((message, index) => <div className={`voice-message ${message.role}`} key={`${message.role}-${index}`}>{message.text}</div>)}
        </div>
        {listings.length > 0 && <div className="voice-assistant-results"><span className="eyebrow">SUGESTÕES NA BUSCA</span>{listings.slice(0, 3).map((row, index) => { const item = listingLabel(row); const url = listingUrl(row); const content = <><span><strong>{item.title}</strong><small>{item.district}</small></span><b>{item.price}</b></>; return url ? <a className="voice-result" href={url} target="_blank" rel="noreferrer" key={`${item.title}-${index}`}>{content}</a> : <button className="voice-result" type="button" key={`${item.title}-${index}`} onClick={() => document.getElementById('jornadas')?.scrollIntoView({ behavior: 'smooth' })}>{content}</button>; })}</div>}
        <div className="voice-assistant-quick">{QUICK_PROMPTS.map((prompt) => <button key={prompt} type="button" onClick={() => askAssistant(prompt)}>{prompt}</button>)}</div>
        <form className="voice-assistant-form" onSubmit={(event) => { event.preventDefault(); askAssistant(input); }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Escreva o que procura" aria-label="Digite uma pergunta" /><button type="button" className={`voice-assistant-mic ${listening ? 'listening' : ''}`} onClick={startListening} aria-label={listening ? 'Parar de ouvir' : 'Falar com a assistente'}>{listening ? '●' : 'Falar'}</button><button type="submit" className="voice-assistant-send" disabled={busy || !input.trim()} aria-label="Enviar pergunta">↑</button></form>
        <p className="voice-assistant-note">Assistente virtual. Consulte os anúncios e confirme informações antes de decidir.</p>
      </div>}
    </aside>
  );
}
