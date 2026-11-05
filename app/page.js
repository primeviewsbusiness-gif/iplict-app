'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import VoiceAssistant from './components/VoiceAssistant';

const PropertyGallery = dynamic(() => import('./components/PropertyGallery'), {
  ssr: false,
  loading: () => <div className="property-gallery-loading" aria-label="Carregando galeria" />,
});

const neighborhoods = [
  'Auxiliadora', 'Bela Vista', 'Bom Fim', 'Centro Histórico', 'Cidade Baixa',
  'Jardim Botânico', 'Menino Deus', 'Moinhos de Vento', 'Petrópolis', 'Rio Branco',
  'Santana', 'Tristeza',
];

const inventoryItems = [
  ['matricula', 'Matrícula atualizada e conferida'],
  ['iptu', 'IPTU e situação cadastral'],
  ['condominio', 'Declaração de quitação condominial'],
  ['planta', 'Planta e área privativa conferidas'],
  ['documentos', 'Documentos pessoais e certidões'],
];
const triageQuestions = [
  { key: 'momento', question: 'Qual é o seu momento em relação ao imóvel?', options: ['Comprar nos próximos 60 dias', 'Avaliando para 3 a 12 meses', 'Planejando para 1 a 3 anos', 'Apenas pesquisando / Proprietário'] },
  { key: 'faixaValor', question: 'Qual faixa de valor melhor se encaixa no seu planejamento?', options: ['Até R$ 350 mil', 'R$ 350 mil a R$ 700 mil', 'R$ 700 mil a R$ 1.2 milhão', 'Acima de R$ 1.2 milhão'] },
  { key: 'pagamento', question: 'Como pretende estruturar o pagamento?', options: ['Recursos próprios / À vista', 'Financiamento Bancário (com ou sem FGTS)', 'Analisando opções de Consórcio'] },
  { key: 'localizacao', question: 'Qual região de Porto Alegre você está monitorando?', options: ['Menino Deus / Praia de Belas', 'Moinhos / Bela Vista / Petrópolis', 'Bom Fim / Cidade Baixa', 'Zona Sul', 'Outro bairro'] },
];
const ITBI_GENERAL_RATE = 0.03;
const ITBI_REDUCED_RATE = 0.005;
const POA_UFM_2026 = 6.0411;
const ITBI_REDUCED_CAP_UFM = 68000;

const money = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
}).format(value || 0);

const normalized = (value) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function valueFor(row, names) {
  if (!row || typeof row !== 'object') return undefined;
  const entries = Object.entries(row);
  for (const name of names) {
    const found = entries.find(([key]) => normalized(key) === normalized(name));
    if (found && found[1] !== null && found[1] !== undefined && found[1] !== '') return found[1];
  }
  return undefined;
}

function listingKey(row, fallback = '') {
  return String(valueFor(row, ['id', 'uuid', 'codigo', 'reference']) || `${valueFor(row, ['bairro', 'neighborhood']) || 'imovel'}-${valueFor(row, ['titulo', 'title', 'nome', 'name']) || fallback}`);
}

function listingImages(row) {
  const raw = valueFor(row, ['imagens', 'fotos', 'galeria', 'photos', 'gallery']);
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[,\n]/) : [];
  const cover = valueFor(row, ['foto_capa_url', 'imagem_capa', 'cover_url']);
  return [cover, ...list].filter((src, index, all) => src && all.indexOf(src) === index).slice(0, 30);
}

function numericValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let text = value.trim().replace(/[^\d,.-]/g, '');
  if (!text) return null;
  if (text.includes(',') && text.includes('.')) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.')
      ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (text.includes(',')) text = text.replace(',', '.');
  const result = Number(text);
  return Number.isFinite(result) ? result : null;
}

function formatMoneyInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(digits) / 100);
}

const MEDIA_LIMITS = { imageBytes: 15 * 1024 * 1024, videoBytes: 500 * 1024 * 1024, videoSeconds: 180 };

function validateSelectedFile(file, kind) {
  if (!file) return 'Nenhum arquivo selecionado.';
  const limit = kind === 'image' ? MEDIA_LIMITS.imageBytes : MEDIA_LIMITS.videoBytes;
  if (file.size > limit) return `${file.name} excede o limite de ${Math.round(limit / 1024 / 1024)} MB.`;
  if (kind === 'image' && !file.type.startsWith('image/')) return `${file.name} não é uma imagem válida.`;
  if (kind === 'video' && !file.type.startsWith('video/')) return `${file.name} não é um vídeo válido.`;
  return '';
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function Icon({ name, size = 22 }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  };
  if (name === 'home') return <svg {...common}><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></svg>;
  if (name === 'chart') return <svg {...common}><path d="M4 19V5m0 14h17" /><path d="m7 15 4-4 3 2 6-7" /></svg>;
  if (name === 'key') return <svg {...common}><circle cx="8" cy="15" r="5" /><path d="m11.5 11.5 8-8 2 2-2 2 2 2-3 3-2-2-2 2" /></svg>;
  if (name === 'arrow') return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}

function ScenarioResult({ result }) {
  if (!result) return null;
  return (
    <div className="scenario-result" aria-live="polite">
      <div className="result-heading"><span className="eyebrow">CENÁRIO ORIENTATIVO</span><span className="result-tag">Premissas editáveis</span></div>
      <p className="saving-line">Para formar a entrada em {result.monthsToBuy} meses, a meta é guardar <strong>{money(result.monthlySaving)}/mês</strong>.</p>
      <div className="comparison-grid">
        <div className="comparison-option"><span>Consórcio contemplado</span><strong>{money(result.consortiumPayment)}<small>/mês</small></strong><small>Custo estimado no prazo informado: {money(result.consortiumTotal)}</small></div>
        <div className="comparison-option finance-option"><span>Financiamento SBPE / MCMV</span><strong>{money(result.financePayment)}<small>/mês</small></strong><small>Total estimado das parcelas: {money(result.financeTotal)}</small></div>
      </div>
      <p className="disclaimer">Estimativa simplificada, sem seguros, indexadores, tarifas ou análise de crédito. Confira CET, saldo e regras no contrato; a simulação não garante contemplação nem aprovação.</p>
    </div>
  );
}

export default function Page() {
  const [neighborhood, setNeighborhood] = useState('');
  const [buyerBusy, setBuyerBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [buyerMessage, setBuyerMessage] = useState('');
  const [listings, setListings] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [savedSearch, setSavedSearch] = useState(null);
  const [alertOptIn, setAlertOptIn] = useState(false);
  const [retentionNotice, setRetentionNotice] = useState('');
  const [buyerValue, setBuyerValue] = useState('480000');
  const [buyerFinancedValue, setBuyerFinancedValue] = useState('');
  const [buyerEligibleFinancing, setBuyerEligibleFinancing] = useState(false);
  const [buyerRegistryFee, setBuyerRegistryFee] = useState('');

  const [targetValue, setTargetValue] = useState('480000');
  const [availableCapital, setAvailableCapital] = useState('70000');
  const [planningMonths, setPlanningMonths] = useState('24');
  const purchasePrice = Math.max(0, numericValue(buyerValue) || 0);
  const amountFinanced = Math.min(purchasePrice, Math.max(0, numericValue(buyerFinancedValue) || 0));
  const reducedTaxBase = buyerEligibleFinancing
    ? Math.min(amountFinanced, ITBI_REDUCED_CAP_UFM * POA_UFM_2026)
    : 0;
  const buyerItbiEstimate = reducedTaxBase * ITBI_REDUCED_RATE
    + (purchasePrice - reducedTaxBase) * ITBI_GENERAL_RATE;
  const buyerRegistryEstimate = Math.max(0, numericValue(buyerRegistryFee) || 0);
  const buyerCostEstimate = buyerItbiEstimate + buyerRegistryEstimate;

  const [plannedEntryPercent, setPlannedEntryPercent] = useState('20');
  const [consortiumFee, setConsortiumFee] = useState('');
  const [consortiumTerm, setConsortiumTerm] = useState('');
  const [financeRate, setFinanceRate] = useState('');
  const [financeTerm, setFinanceTerm] = useState('');
  const [scenario, setScenario] = useState(null);
  const [scenarioError, setScenarioError] = useState('');

  const [ownerNeighborhood, setOwnerNeighborhood] = useState('');
  const [propertyArea, setPropertyArea] = useState('');
  const [ownerPropertyValue, setOwnerPropertyValue] = useState('');
  const [garageStatus, setGarageStatus] = useState('');
  const [inventory, setInventory] = useState({});
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadInstagram, setLeadInstagram] = useState('');
  const [leadFacebook, setLeadFacebook] = useState('');
  const [leadConsent, setLeadConsent] = useState(false);
  const [purchaseMethod, setPurchaseMethod] = useState('');
  const [creditApproval, setCreditApproval] = useState('');
  const [creditRange, setCreditRange] = useState('');
  const [leadMessage, setLeadMessage] = useState('');
  const [itbiBusy, setItbiBusy] = useState(false);
  const [itbiMessage, setItbiMessage] = useState('');
  const [itbiSummary, setItbiSummary] = useState(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizNotice, setQuizNotice] = useState('');
  const [quizConsent, setQuizConsent] = useState(false);
  const [reportUnlocked, setReportUnlocked] = useState(false);
  const [reportRows, setReportRows] = useState([]);
  const [reportMessage, setReportMessage] = useState('');
  const [reportRegistryFee, setReportRegistryFee] = useState('0');
  const [propertyStep, setPropertyStep] = useState(0);
  const [propertyMessage, setPropertyMessage] = useState('');
  const [propertyBusy, setPropertyBusy] = useState(false);
  const [brokerBusy, setBrokerBusy] = useState(false);
  const [brokerMessage, setBrokerMessage] = useState('');
  const [brokerDraft, setBrokerDraft] = useState({ nome: '', slug: '', creci: '', email: '', whatsapp: '', bio: '', bairros: '', instagram: '', facebook: '', linkedin: '', site_pessoal: '' });
  const [brokerQrFile, setBrokerQrFile] = useState(null);
  const [brokerPhotoFile, setBrokerPhotoFile] = useState(null);
  const [brokerVideoFile, setBrokerVideoFile] = useState(null);
  const [propertyMedia, setPropertyMedia] = useState({ fotos: [], videoVertical: null, videoHorizontal: null, matricula: null, iptu: null, condominio: null });
  const [mediaNotice, setMediaNotice] = useState('');
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [propertyDraft, setPropertyDraft] = useState({
    tipo: 'Apartamento', titulo: '', finalidade: 'Venda', cidade: 'Porto Alegre', bairro: '',
    area_privativa: '', area_total: '', dormitorios: '', suites: '', banheiros: '', vagas: '', tipo_vaga: '',
    preco_venda: '', condominio: '', iptu: '', descricao_publica: '', diferenciais: '',
    foto_capa_url: '', endereco_privado: '', mostrar_endereco: false, raio_mapa_metros: 500,
    links_anuncios: '', modalidade_anuncio: 'Padrão', anuncio_pago: false,
  });

  useEffect(() => {
    const previews = propertyMedia.fotos.map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));
    setPhotoPreviews(previews);
    return () => previews.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [propertyMedia.fotos]);

  useEffect(() => {
    try {
      setFavoriteIds(JSON.parse(window.localStorage.getItem('iplict:favorites') || '[]'));
      setSavedSearch(JSON.parse(window.localStorage.getItem('iplict:saved-search') || 'null'));
      setAlertOptIn(window.localStorage.getItem('iplict:alert-opt-in') === 'true');
    } catch { /* armazenamento local indisponível: manter a página utilizável. */ }
  }, []);

  function toggleFavorite(row, index) {
    const id = listingKey(row, index);
    setFavoriteIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      window.localStorage.setItem('iplict:favorites', JSON.stringify(next));
      return next;
    });
    setRetentionNotice('Preferência salva apenas neste navegador. Você poderá apagar quando quiser.');
  }

  function saveCurrentSearch() {
    const next = { neighborhood: neighborhood.trim(), savedAt: new Date().toISOString() };
    window.localStorage.setItem('iplict:saved-search', JSON.stringify(next));
    setSavedSearch(next);
    setRetentionNotice('Busca salva neste navegador. Para receber alertas, ative a opção abaixo — nenhum contato será enviado agora.');
  }

  function updateAlertOptIn(value) {
    setAlertOptIn(value);
    window.localStorage.setItem('iplict:alert-opt-in', String(value));
    setRetentionNotice(value ? 'Preferência de alerta registrada. O envio será ativado somente após você informar um canal e confirmar o consentimento.' : 'Alertas pausados neste navegador.');
  }

  function clearLocalPreferences() {
    window.localStorage.removeItem('iplict:favorites');
    window.localStorage.removeItem('iplict:saved-search');
    window.localStorage.removeItem('iplict:alert-opt-in');
    setFavoriteIds([]);
    setSavedSearch(null);
    setAlertOptIn(false);
    setRetentionNotice('Preferências locais apagadas deste navegador.');
  }

  function selectPropertyMedia(field, file, kind) {
    if (!file) return;
    const error = validateSelectedFile(file, kind);
    if (error) { setMediaNotice(error); return; }
    setMediaNotice('');
    setPropertyMedia((current) => ({ ...current, [field]: file }));
  }

  function selectPropertyPhotos(event) {
    const selected = Array.from(event.target.files || []);
    if (selected.length > 30) { setMediaNotice('Selecione no máximo 30 fotos.'); return; }
    const invalid = selected.map((file) => validateSelectedFile(file, 'image')).find(Boolean);
    if (invalid) { setMediaNotice(invalid); return; }
    setMediaNotice('');
    setPropertyMedia((current) => ({ ...current, fotos: selected }));
  }

  async function searchListings(event) {
    event.preventDefault();
    setBuyerBusy(true);
    setListings([]);
    setBuyerMessage('');
    if (!isSupabaseConfigured) {
      setBuyerMessage('A busca será ativada quando NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY estiverem configuradas.');
      setBuyerBusy(false);
      return;
    }
    const { data, error } = await supabase.from('imoveis_publico').select('*').limit(250);
    if (error) {
      setBuyerMessage('Não foi possível consultar a vitrine pública. Verifique a view, as permissões RLS e a conexão do Supabase.');
    } else {
      const search = normalized(neighborhood);
      const matches = (data ?? []).filter((row) => {
        const searchable = [
          valueFor(row, ['bairro', 'neighborhood', 'district']),
          valueFor(row, ['titulo', 'title', 'nome', 'name']),
          valueFor(row, ['descricao', 'description', 'endereco', 'address']),
        ].filter(Boolean).join(' ');
        return !search || normalized(searchable).includes(search);
      });
      setListings(matches.slice(0, 6));
      setBuyerMessage(matches.length
        ? `${matches.length} imóvel(is) encontrado(s) na amostra consultada.`
        : 'Nenhum imóvel correspondente na amostra. Confira o nome do bairro e a view imoveis_publico.');
    }
    setBuyerBusy(false);
  }

  async function searchListingsByAssistant(query) {
    if (!isSupabaseConfigured) {
      return { message: 'A busca pública será ativada quando o Supabase estiver configurado no ambiente do portal.' };
    }
    const text = normalized(query);
    const matchedNeighborhood = neighborhoods.find((name) => text.includes(normalized(name)));
    const maxMatch = text.match(/(?:ate|até)\s*r?\$?\s*([\d.,]+)\s*(milhao|milhões|milhoes|mil)?/i);
    let maxPrice = null;
    if (maxMatch) {
      const parsed = numericValue(maxMatch[1]);
      maxPrice = parsed ? parsed * (maxMatch[2] && normalized(maxMatch[2]).startsWith('mil') ? (normalized(maxMatch[2]).includes('milhao') ? 1000000 : 1000) : 1) : null;
    }
    const bedroomsMatch = text.match(/(\d+)\s*(?:dormitorio|dormitorios|quarto|quartos)/);
    const parkingMatch = text.match(/(\d+)\s*(?:vaga|vagas|garagem)/);
    const typeMatch = ['apartamento', 'casa', 'terreno', 'sala comercial', 'cobertura'].find((type) => text.includes(normalized(type)));
    const { data, error } = await supabase.from('imoveis_publico').select('*').limit(250);
    if (error) return { message: 'Não consegui consultar a vitrine pública agora. Tente novamente em instantes.' };
    const matches = (data || []).filter((row) => {
      const district = normalized(valueFor(row, ['bairro', 'neighborhood', 'district']));
      const title = normalized(valueFor(row, ['titulo', 'title', 'nome', 'name']));
      const description = normalized(valueFor(row, ['descricao', 'description']));
      const price = numericValue(valueFor(row, ['valor_venda', 'preco_venda', 'valor_imovel', 'preco', 'price', 'valor']));
      const bedrooms = numericValue(valueFor(row, ['dormitorios', 'quartos', 'bedrooms']));
      const parking = numericValue(valueFor(row, ['vagas', 'garagens', 'parking']));
      return (!matchedNeighborhood || district.includes(normalized(matchedNeighborhood)))
        && (!typeMatch || title.includes(typeMatch) || description.includes(typeMatch))
        && (!maxPrice || !price || price <= maxPrice)
        && (!bedroomsMatch || (bedrooms !== null && bedrooms >= Number(bedroomsMatch[1])))
        && (!parkingMatch || (parking !== null && parking >= Number(parkingMatch[1])));
    }).slice(0, 6);
    setListings(matches);
    if (matchedNeighborhood) setNeighborhood(matchedNeighborhood);
    const scope = matchedNeighborhood ? ` em ${matchedNeighborhood}` : '';
    return { message: matches.length ? `Encontrei ${matches.length} opção(ões)${scope}. Deixei as sugestões abaixo e também atualizei a busca.` : `Ainda não encontrei uma opção${scope} com esses critérios. Posso tentar outro bairro ou faixa de valor.` };
  }

  function updateProperty(field, value) {
    setPropertyDraft((current) => ({ ...current, [field]: value }));
    setPropertyMessage('');
  }

  function updateBroker(field, value) {
    setBrokerDraft((current) => ({ ...current, [field]: value }));
    setBrokerMessage('');
  }

  async function saveBroker(event) {
    event.preventDefault();
    if (!brokerDraft.nome.trim() || !brokerDraft.creci.trim() || !brokerDraft.email.trim() || !brokerDraft.whatsapp.trim()) {
      setBrokerMessage('Informe nome, CRECI, e-mail e WhatsApp para cadastrar a corretora.');
      return;
    }
    if (!isSupabaseConfigured) {
      setBrokerMessage('Perfil preenchido. Configure o Supabase para salvar a corretora na base.');
      return;
    }
    setBrokerBusy(true);
    setBrokerMessage('Salvando perfil…');
    const { error } = await supabase.from('corretores').insert({
      nome: brokerDraft.nome.trim(), slug: brokerDraft.slug.trim() || normalized(brokerDraft.nome).replace(/\s+/g, '-'),
      creci: brokerDraft.creci.trim() || null, email: brokerDraft.email.trim(), whatsapp: brokerDraft.whatsapp.trim(),
      bio: brokerDraft.bio.trim() || null, bairros: brokerDraft.bairros.trim() || null,
      instagram: brokerDraft.instagram.trim() || null, facebook: brokerDraft.facebook.trim() || null,
      linkedin: brokerDraft.linkedin.trim() || null, site_pessoal: brokerDraft.site_pessoal.trim() || null,
      qr_code_url: brokerQrFile?.name || null, foto_perfil_pendente: brokerPhotoFile?.name || null,
      video_apresentacao_pendente: brokerVideoFile?.name || null, status: 'pendente', ativo: true,
    });
    setBrokerBusy(false);
    setBrokerMessage(error ? 'Não foi possível salvar. Verifique a tabela corretores e as políticas RLS.' : 'Corretora cadastrada como perfil pendente de revisão.');
  }

  function validatePropertyStep() {
    if (propertyStep === 0 && (!propertyDraft.titulo.trim() || !propertyDraft.bairro.trim())) {
      setPropertyMessage('Informe pelo menos o título e o bairro para avançar.');
      return false;
    }
    if (propertyStep === 1 && (!propertyDraft.area_privativa || !propertyDraft.preco_venda)) {
      setPropertyMessage('Informe a área privativa e o preço de venda para avançar.');
      return false;
    }
    if (propertyStep === 2 && !propertyDraft.descricao_publica.trim()) {
      setPropertyMessage('Adicione uma descrição pública curta para avançar.');
      return false;
    }
    if (propertyStep === 3) {
      const links = propertyDraft.links_anuncios.split('\n').map((link) => link.trim()).filter(Boolean);
      if (links.length > 10) {
        setPropertyMessage('Você pode informar no máximo 10 links de anúncios.');
        return false;
      }
    }
    return true;
  }

  function nextPropertyStep() {
    if (validatePropertyStep()) setPropertyStep((step) => Math.min(3, step + 1));
  }

  async function savePropertyDraft(event) {
    event.preventDefault();
    if (!validatePropertyStep()) return;
    if (!isSupabaseConfigured) {
      setPropertyMessage('Rascunho preenchido. Configure o Supabase para salvar este imóvel na base.');
      return;
    }
    setPropertyBusy(true);
    setPropertyMessage('Salvando rascunho…');
    const payload = {
      ...propertyDraft,
      status: 'rascunho',
      valor_m2: numericValue(propertyDraft.preco_venda) && numericValue(propertyDraft.area_privativa)
        ? numericValue(propertyDraft.preco_venda) / numericValue(propertyDraft.area_privativa) : null,
      endereco_privado: propertyDraft.endereco_privado || null,
      mostrar_endereco: Boolean(propertyDraft.mostrar_endereco),
      raio_mapa_metros: 500,
      anuncio_prioridade: propertyDraft.modalidade_anuncio === 'Exclusividade' ? 'exclusivo' : (propertyDraft.anuncio_pago ? 'pago' : 'organico'),
      midia_pendente: {
        fotos: propertyMedia.fotos.length,
        video_vertical: Boolean(propertyMedia.videoVertical),
        video_horizontal: Boolean(propertyMedia.videoHorizontal),
        matricula: Boolean(propertyMedia.matricula),
        iptu: Boolean(propertyMedia.iptu),
        condominio: Boolean(propertyMedia.condominio),
      },
    };
    const { error } = await supabase.from('imoveis').insert(payload);
    setPropertyBusy(false);
    setPropertyMessage(error ? 'Não foi possível salvar. Verifique a tabela imoveis e as políticas RLS.' : 'Imóvel salvo como rascunho para sua revisão.');
    if (!error) {
      setPropertyStep(0);
      setPropertyDraft((current) => ({ ...current, titulo: '', bairro: '', area_privativa: '', preco_venda: '', descricao_publica: '' }));
    }
  }

  function startVoiceSearch() {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setBuyerMessage('Seu navegador não oferece busca por voz. Digite o bairro ou região para continuar.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setVoiceBusy(true);
    setBuyerMessage('Pode falar: tipo de imóvel, bairro e faixa de valor.');
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || '';
      const matchedNeighborhood = neighborhoods.find((name) => normalized(transcript).includes(normalized(name)));
      if (matchedNeighborhood) setNeighborhood(matchedNeighborhood);
      setBuyerMessage(transcript
        ? `Entendi: “${transcript}”.${matchedNeighborhood ? ` Bairro identificado: ${matchedNeighborhood}.` : ' Revise o bairro e clique em buscar.'}`
        : 'Não consegui entender. Tente falar novamente.');
    };
    recognition.onerror = () => setBuyerMessage('Não consegui ouvir sua busca. Tente novamente ou digite o bairro.');
    recognition.onend = () => setVoiceBusy(false);
    recognition.start();
  }

  function runScenario(event) {
    event.preventDefault();
    setScenario(null);
    setScenarioError('');
    const price = Number(targetValue);
    const capital = Number(availableCapital);
    const targetMonths = Number(planningMonths);
    const entryPercent = Number(plannedEntryPercent);
    const feePercent = Number(consortiumFee);
    const feeMonths = Number(consortiumTerm);
    const annualRate = Number(financeRate);
    const loanMonths = Number(financeTerm);
    if (consortiumFee === '' || financeRate === '' || [price, capital, targetMonths, entryPercent, feePercent, feeMonths, annualRate, loanMonths].some((n) => !Number.isFinite(n)) || price <= 0 || targetMonths < 1 || feeMonths < 1 || loanMonths < 1 || entryPercent < 0 || entryPercent > 100 || feePercent < 0 || annualRate < 0) {
      setScenarioError('Informe valores, taxas e prazos válidos das propostas para comparar os cenários.');
      return;
    }
    const desiredEntry = price * entryPercent / 100;
    const financedAmount = Math.max(0, price - Math.max(capital, desiredEntry));
    const monthlySaving = Math.max(0, desiredEntry - capital) / targetMonths;
    const consortiumPayment = financedAmount * (1 + feePercent / 100) / feeMonths;
    const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
    const financePayment = monthlyRate === 0
      ? financedAmount / loanMonths
      : financedAmount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -loanMonths));
    setScenario({
      monthsToBuy: targetMonths, monthlySaving, consortiumPayment,
      consortiumTotal: financedAmount * (1 + feePercent / 100),
      financePayment, financeTotal: financePayment * loanMonths,
    });
  }

  async function consultItbi(event) {
    event.preventDefault();
    setItbiBusy(true);
    setItbiSummary(null);
    setItbiMessage('');
    if (!isSupabaseConfigured) {
      setItbiMessage('Configure as variáveis públicas do Supabase para consultar a base real de ITBI de Porto Alegre.');
      setItbiBusy(false);
      return;
    }
    const { data, error } = await supabase.from('media_anual_vendas_m2').select('*').limit(500);
    if (error) {
      setItbiMessage('Não foi possível consultar a estatística agregada de ITBI. Verifique a view, as permissões RLS e a conexão.');
      setItbiBusy(false);
      return;
    }
    const search = normalized(ownerNeighborhood);
    const neighborhoodRows = (data ?? []).filter((row) => !search || normalized(valueFor(row, ['bairro', 'neighborhood', 'district']) ?? '').includes(search));
    const perSquareMeter = neighborhoodRows.map((row) => {
      const aggregated = numericValue(valueFor(row, ['valor_m2_mediano', 'valor_metro_quadrado']));
      if (aggregated > 0) return aggregated;
      const value = numericValue(valueFor(row, ['valor_transacao', 'valor_imovel', 'valor_declarado', 'valor_venal', 'preco', 'price', 'valor']));
      const area = numericValue(valueFor(row, ['area_m2', 'area_privativa', 'metragem', 'area', 'area_total']));
      return value > 0 && area > 0 ? value / area : null;
    }).filter((value) => value && Number.isFinite(value));
    const medianPerM2 = median(perSquareMeter);
    const area = numericValue(propertyArea);
    setItbiSummary({
      sampleSize: (data ?? []).length, neighborhoodCount: neighborhoodRows.length,
      medianPerM2, estimatedReference: medianPerM2 && area > 0 ? medianPerM2 * area : null,
    });
    setItbiMessage('Consulta concluída com estatísticas agregadas por bairro.');
    setItbiBusy(false);
  }

  function openQuiz(event) {
    event?.preventDefault();
    setQuizOpen(true);
    setQuizStep(0);
    setQuizNotice('');
  }

  function chooseQuizAnswer(value) {
    const current = triageQuestions[quizStep];
    setQuizAnswers((answers) => ({ ...answers, [current.key]: value }));
    setQuizNotice('');
    if (quizStep < triageQuestions.length - 1) setQuizStep((step) => step + 1);
    else setQuizStep(triageQuestions.length);
  }

  async function releaseReport(event) {
    event.preventDefault();
    const contacts = [leadName, leadPhone, leadEmail, leadInstagram].map((value) => value.trim());
    const validContacts = contacts.filter((value, index) => {
      if (!value) return false;
      if (index === 2) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      return value.length >= 2;
    }).length;
    if (validContacts < 3) {
      setQuizNotice('Por favor, preencha pelo menos 3 opções de contato para liberar os dados.');
      return;
    }
    if (!quizConsent) {
      setQuizNotice('Marque o consentimento para receber o relatório e permitir o contato sobre esta pesquisa.');
      return;
    }
    if (!isSupabaseConfigured) {
      setQuizNotice('A conexão com o Supabase ainda não está configurada neste ambiente.');
      return;
    }
    setItbiBusy(true);
    setQuizNotice('Liberando o relatório…');
    const { error: leadError } = await supabase.from('leads_iplict').insert({
      nome_completo: contacts[0] || null,
      whatsapp_telefone: contacts[1] || null,
      email: contacts[2] || null,
      rede_social: contacts[3] || null,
      momento: quizAnswers.momento,
      faixa_valor: quizAnswers.faixaValor,
      estrutura_pagamento: quizAnswers.pagamento,
      localizacao_prioritaria: quizAnswers.localizacao,
      consentimento_lgpd: true,
      pediu_relatorio: true,
      origem: 'quiz_home',
    });
    if (leadError) {
      setItbiBusy(false);
      setQuizNotice('Não foi possível registrar seus dados agora. Tente novamente em instantes.');
      return;
    }
    const { data, error: reportError } = await supabase.from('relatorio_vendas_itbi_publico').select('bairro, area_privativa, valor_transacao, valor_metro_quadrado, data_transacao, ano_construcao').limit(80);
    if (reportError) {
      setItbiBusy(false);
      setQuizNotice('Seu pedido foi registrado, mas os dados comparativos estão temporariamente indisponíveis.');
      return;
    }
    setReportRows(data ?? []);
    setReportUnlocked(true);
    setQuizOpen(false);
    setReportMessage('Relatório liberado. Os valores abaixo são transações reais da base disponível e servem como referência, não como laudo.');
    setItbiBusy(false);
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="IPLICT, início"><span className="brand-mark">I</span><span className="brand-copy"><strong>IPLICT</strong><small>INTELIGÊNCIA IMOBILIÁRIA</small></span></a>
        <nav className="main-nav" aria-label="Navegação principal"><a href="#jornadas">Jornadas</a><a href="#dados">Dados de Porto Alegre</a></nav>
        <a className="topbar-cta" href="#jornadas">Começar agora <Icon name="arrow" size={16} /></a>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-copy">
          <div className="location-pill"><span className="location-dot" /> PORTO ALEGRE · RS</div>
          <h1>O próximo passo<br />do seu imóvel, <em>com clareza.</em></h1>
          <p>Inteligência imobiliária para planejar, comprar ou vender em Porto Alegre.</p>
          <a className="hero-link" href="#jornadas">Encontre seu caminho <Icon name="arrow" size={17} /></a>
        </div>
        <div className="hero-aside" aria-label="Proposta do IPLICT">
          <div className="aside-orbit orbit-one" /><div className="aside-orbit orbit-two" />
          <div className="hero-stat-card"><span className="stat-icon"><Icon name="chart" size={20} /></span><span className="eyebrow">DECISÃO COM CONTEXTO</span><strong>Dados locais.<br />Escolhas melhores.</strong><small>Uma experiência pensada para o mercado de Porto Alegre.</small></div>
          <span className="hero-coordinate">30°01′59″S&nbsp;&nbsp; 51°13′48″W</span>
        </div>
      </section>

      <section className="journeys-section" id="jornadas">
        <div className="section-heading"><div><span className="eyebrow">SUA JORNADA COMEÇA AQUI</span><h2>Em que momento você está?</h2></div><p>Escolha um perfil. A gente organiza o próximo passo.</p></div>
        <div className="journey-grid">
          <article className="journey-card buyer-card">
            <div className="card-topline"><span className="journey-number">01</span><span className="icon-bubble"><Icon name="home" /></span></div>
            <span className="card-kicker">COMPRADOR IMEDIATO</span><h3>Pronto para<br />encontrar seu lugar?</h3>
            <p className="card-description">Busque imóveis pelos bairros de Porto Alegre e veja os custos da compra antes de decidir.</p>
            <form onSubmit={searchListings} className="buyer-form">
              <label htmlFor="buyer-neighborhood">BAIRRO OU REGIÃO</label>
              <div className="search-field"><Icon name="search" size={19} /><input id="buyer-neighborhood" list="poa-neighborhoods" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Ex.: Menino Deus ou fale sua busca" /><button className={`voice-button ${voiceBusy ? 'listening' : ''}`} type="button" onClick={startVoiceSearch} aria-label="Buscar por voz" title="Buscar por voz">{voiceBusy ? '●' : '🎙'}</button><datalist id="poa-neighborhoods">{neighborhoods.map((name) => <option key={name} value={name} />)}</datalist></div>
              <button className="button button-dark" type="submit" disabled={buyerBusy}>{buyerBusy ? 'Buscando…' : 'Buscar oportunidades'} <Icon name="arrow" size={17} /></button>
            </form>
            <div className="cost-note"><span className="note-marker">i</span><span><strong>Compra sem surpresas</strong><br />Planeje impostos de transmissão e custos de cartório na sua conta final.</span></div>
            <div className="cost-estimator">
              <p className="cost-estimator-title">PRÉVIA DE CUSTOS · PORTO ALEGRE</p>
              <div className="field-pair">
                <label>VALOR DO IMÓVEL<input type="number" min="0" step="1000" value={buyerValue} onChange={(e) => setBuyerValue(e.target.value)} aria-label="Valor do imóvel para estimar custos de transmissão" /></label>
                <label>CARTÓRIO · ORÇAMENTO<input type="number" min="0" step="100" value={buyerRegistryFee} onChange={(e) => setBuyerRegistryFee(e.target.value)} placeholder="Informe o valor" aria-label="Custos de cartório informados" /></label>
              </div>
              <label className="reduced-rate-toggle"><input type="checkbox" checked={buyerEligibleFinancing} onChange={(e) => setBuyerEligibleFinancing(e.target.checked)} /> Considerar condição reduzida para imóvel financiado</label>
              {buyerEligibleFinancing && <label className="financed-amount-field">VALOR EFETIVAMENTE FINANCIADO<input type="number" min="0" max={purchasePrice} step="1000" value={buyerFinancedValue} onChange={(e) => setBuyerFinancedValue(e.target.value)} placeholder="Conforme contrato" /></label>}
              <div className="cost-breakdown">
                <div><span>Imposto de transmissão estimado</span><strong>{money(buyerItbiEstimate)}</strong></div>
                <div><span>Cartório {buyerRegistryEstimate ? 'informado' : '(não incluído)'}</span><strong>{buyerRegistryEstimate ? money(buyerRegistryEstimate) : '—'}</strong></div>
                <div className="cost-total"><span>Imposto + cartório informado</span><strong>{money(buyerCostEstimate)}</strong></div>
              </div>
              <p className="cost-disclaimer">Estimativa sobre o valor informado; a Prefeitura pode usar base venal maior. A condição reduzida exige critérios municipais e financiamento residencial com prazo mínimo de 5 anos. <a href="https://prefeitura.poa.br/carta-de-servicos/itbi-imposto-sobre-transmissao-de-bens-imoveis" target="_blank" rel="noreferrer">Regras municipais</a> · <a href="https://prefeitura.poa.br/smf/unidade-financeira-municipal-ufm" target="_blank" rel="noreferrer">UFM 2026</a> · <a href="https://www.tjrs.jus.br/novo/processos-e-servicos/servicos-extrajudiciais/tabela-de-emolumentos/" target="_blank" rel="noreferrer">Emolumentos 2026</a>.</p>
            </div>
            {buyerMessage && <p className="inline-message" role="status">{buyerMessage}</p>}
            <div className="retention-panel">
              <div><strong>Seu espaço de pesquisa</strong><span>{favoriteIds.length} favorito(s){savedSearch?.neighborhood ? ` · busca por ${savedSearch.neighborhood}` : ''}</span></div>
              <div className="retention-actions"><button type="button" className="text-button" onClick={saveCurrentSearch}>Salvar esta busca</button><label className="retention-toggle"><input type="checkbox" checked={alertOptIn} onChange={(e) => updateAlertOptIn(e.target.checked)} /> Quero ser avisado quando houver novidades compatíveis</label><button type="button" className="text-button muted" onClick={clearLocalPreferences}>Apagar preferências</button></div>
            </div>
            {retentionNotice && <p className="retention-notice" role="status">{retentionNotice}</p>}
            {listings.length > 0 && <div className="listing-results" aria-label="Imóveis encontrados">{listings.map((row, index) => {
              const district = valueFor(row, ['bairro', 'neighborhood', 'district']) || 'Porto Alegre';
              const title = valueFor(row, ['titulo', 'title', 'nome', 'name']) || `Imóvel em ${district}`;
              const price = numericValue(valueFor(row, ['valor_venda', 'preco_venda', 'valor_imovel', 'preco', 'price', 'valor']));
              const id = listingKey(row, index);
              const favorite = favoriteIds.includes(id);
              return <div className="listing-row" key={id}><span><strong>{String(title)}</strong><small>{String(district)}</small><PropertyGallery images={listingImages(row)} title={String(title)} /></span><div className="listing-actions">{price ? <b>{money(price)}</b> : null}<button type="button" className={`favorite-button ${favorite ? 'active' : ''}`} onClick={() => toggleFavorite(row, index)} aria-label={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} title={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}>{favorite ? '♥' : '♡'}</button></div></div>;
            })}</div>}
          </article>

          <article className="journey-card planner-card">
            <div className="card-topline"><span className="journey-number">02</span><span className="icon-bubble"><Icon name="chart" /></span></div>
            <span className="card-kicker">PLANEJADOR · 1 A 3 ANOS</span><h3>Prepare a compra<br />no seu ritmo.</h3>
            <p className="card-description">Compare consórcio contemplado e financiamento com os custos da proposta que você recebeu.</p>
            <form className="planner-form" onSubmit={runScenario}>
              <div className="field-pair">
                <label>VALOR DO IMÓVEL <span className="input-prefix">R$</span><input type="number" min="1" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} /></label>
                <label>RESERVA ATUAL <span className="input-prefix">R$</span><input type="number" min="0" value={availableCapital} onChange={(e) => setAvailableCapital(e.target.value)} /></label>
              </div>
              <div className="field-pair">
                <label>COMPRA EM<select value={planningMonths} onChange={(e) => setPlanningMonths(e.target.value)}><option value="12">12 meses</option><option value="24">24 meses</option><option value="36">36 meses</option></select></label>
                <label>ENTRADA PLANEJADA<input type="number" min="0" max="100" value={plannedEntryPercent} onChange={(e) => setPlannedEntryPercent(e.target.value)} /><span className="input-suffix">%</span></label>
              </div>
              <details className="assumptions"><summary>Adicionar custos das propostas</summary>
                <div className="field-pair assumptions-fields">
                  <label>TAXA TOTAL DO CONSÓRCIO<input type="number" min="0" step="0.1" value={consortiumFee} onChange={(e) => setConsortiumFee(e.target.value)} placeholder="Conforme contrato" /><span className="input-suffix">%</span></label>
                  <label>PRAZO RESTANTE<input type="number" min="1" value={consortiumTerm} onChange={(e) => setConsortiumTerm(e.target.value)} placeholder="Conforme contrato" /><span className="input-suffix">meses</span></label>
                  <label>CET EFETIVO DO FINANCIAMENTO<input type="number" min="0" step="0.1" value={financeRate} onChange={(e) => setFinanceRate(e.target.value)} placeholder="Conforme proposta" /><span className="input-suffix">% a.a.</span></label>
                  <label>PRAZO DO FINANCIAMENTO<input type="number" min="1" value={financeTerm} onChange={(e) => setFinanceTerm(e.target.value)} placeholder="Conforme proposta" /><span className="input-suffix">meses</span></label>
                </div>
              </details>
              <button className="button button-dark" type="submit">Comparar cenários <Icon name="arrow" size={17} /></button>
            </form>
            {scenarioError && <p className="inline-message" role="alert">{scenarioError}</p>}
            <ScenarioResult result={scenario} />
            <p className="micro-note">Elegibilidade MCMV e condições SBPE dependem da análise da instituição financeira.</p>
          </article>

          <article className="journey-card owner-card">
            <div className="card-topline"><span className="journey-number">03</span><span className="icon-bubble"><Icon name="key" /></span></div>
            <span className="card-kicker">PROPRIETÁRIO</span><h3>Venda com os<br />documentos em dia.</h3>
            <p className="card-description">Consulte a média anual de vendas por m² no bairro e registre o que você precisa pesquisar.</p>
            <form className="owner-form" onSubmit={openQuiz}>
              <div className="field-pair">
                <label>BAIRRO<input value={ownerNeighborhood} onChange={(e) => setOwnerNeighborhood(e.target.value)} placeholder="Ex.: Petrópolis" /></label>
                <label>ÁREA PRIVATIVA<input type="number" min="1" value={propertyArea} onChange={(e) => setPropertyArea(e.target.value)} placeholder="m²" /></label>
              </div>
              <label>VALOR DO IMÓVEL<input type="number" min="0" step="1000" value={ownerPropertyValue} onChange={(e) => setOwnerPropertyValue(e.target.value)} placeholder="R$ — opcional" /></label>
              <fieldset className="garage-audit"><legend>A VAGA ESTÁ IDENTIFICADA NA MATRÍCULA?</legend><div className="radio-row"><label><input type="radio" name="garage" value="sim" checked={garageStatus === 'sim'} onChange={(e) => setGarageStatus(e.target.value)} /> Sim</label><label><input type="radio" name="garage" value="nao" checked={garageStatus === 'nao'} onChange={(e) => setGarageStatus(e.target.value)} /> Não</label><label><input type="radio" name="garage" value="verificar" checked={garageStatus === 'verificar'} onChange={(e) => setGarageStatus(e.target.value)} /> Verificar</label></div></fieldset>
              <button className="button button-outline" type="submit">Liberar relatório comparativo <Icon name="arrow" size={17} /></button>
            </form>
            <p className="micro-note">Uma pesquisa curta ajuda a organizar o relatório para o seu momento. Sem pressão comercial.</p>
            <div className="inventory"><p className="inventory-title">CHECKLIST DE INVENTÁRIO <span>{Object.values(inventory).filter(Boolean).length}/{inventoryItems.length}</span></p>{inventoryItems.map(([key, label]) => <label className="check-item" key={key}><input type="checkbox" checked={Boolean(inventory[key])} onChange={(e) => setInventory((current) => ({ ...current, [key]: e.target.checked }))} /><span>{label}</span></label>)}</div>
          </article>
        </div>
      </section>

      {quizOpen && <div className="quiz-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setQuizOpen(false); }}>
        <section className="quiz-modal" role="dialog" aria-modal="true" aria-labelledby="quiz-title">
          <button className="quiz-close" type="button" onClick={() => setQuizOpen(false)} aria-label="Fechar pesquisa">×</button>
          <div className="quiz-progress"><span>Pesquisa breve</span><span>{quizStep < triageQuestions.length ? `${quizStep + 1} de 4` : 'Última etapa'}</span></div>
          <h2 id="quiz-title">{quizStep < triageQuestions.length ? 'Vamos entender seu momento.' : 'Só falta um contato.'}</h2>
          {quizStep < triageQuestions.length ? <>
            <p className="quiz-question">{triageQuestions[quizStep].question}</p>
            <div className="quiz-options">{triageQuestions[quizStep].options.map((option) => <button className={`quiz-option ${quizAnswers[triageQuestions[quizStep].key] === option ? 'selected' : ''}`} type="button" key={option} onClick={() => chooseQuizAnswer(option)}>{option}<span>→</span></button>)}</div>
            {quizStep === 2 && quizAnswers.pagamento === 'Financiamento Bancário (com ou sem FGTS)' && <p className="quiz-secondary-note">Se for útil para sua comparação, também podemos mostrar uma referência de consórcio — sem compromisso.</p>}
          </> : <form className="quiz-contact-form" onSubmit={releaseReport}>
            <p className="quiz-intro">Para onde devemos enviar o relatório comparativo do valor real dos imóveis vendidos? <strong>Preencha pelo menos 3 dos campos abaixo.</strong></p>
            {quizAnswers.pagamento === 'Financiamento Bancário (com ou sem FGTS)' && <p className="quiz-secondary-note">Se for útil para sua comparação, também podemos mostrar uma referência de consórcio — sem compromisso.</p>}
            <div className="quiz-contact-grid"><label>Nome completo<input value={leadName} onChange={(e) => setLeadName(e.target.value)} autoComplete="name" placeholder="Como podemos chamar você?" /></label><label>WhatsApp / telefone<input value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} autoComplete="tel" placeholder="(51) 99999-9999" /></label><label>E-mail<input type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} autoComplete="email" placeholder="voce@email.com" /></label><label>Rede social<input value={leadInstagram} onChange={(e) => setLeadInstagram(e.target.value)} placeholder="Instagram, LinkedIn ou @" /></label></div>
            <label className="quiz-consent"><input type="checkbox" checked={quizConsent} onChange={(e) => setQuizConsent(e.target.checked)} /> Aceito receber este relatório e ser contatado sobre a pesquisa solicitada, conforme a política de privacidade.</label>
            {quizNotice && <p className="quiz-notice" role="alert">{quizNotice}</p>}
            <div className="quiz-actions"><button className="button button-outline" type="button" onClick={() => setQuizStep((step) => Math.max(0, step - 1))}>Voltar</button><button className="button button-dark" type="submit" disabled={itbiBusy}>{itbiBusy ? 'Liberando…' : 'Liberar relatório'} <Icon name="arrow" size={17} /></button></div>
          </form>}
        </section>
      </div>}

      {reportUnlocked && <section className="report-section" id="relatorio" aria-labelledby="report-title">
        <div className="section-heading"><div><span className="eyebrow">RELATÓRIO LIBERADO</span><h2 id="report-title">Valores reais de transação em Porto Alegre</h2></div><p>{reportRows.length} registros disponíveis</p></div>
        <p className="report-message" role="status">{reportMessage}</p>
        <div className="report-controls"><label>Emolumentos de cartório por operação<input type="number" min="0" step="100" value={reportRegistryFee} onChange={(e) => setReportRegistryFee(e.target.value)} placeholder="Informe um orçamento" /></label><span>Simulação: imposto de transmissão de 3% + emolumentos informados.</span></div>
        {reportRows.length ? <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Bairro</th><th>Data</th><th>Área</th><th>Valor vendido</th><th>Valor/m²</th><th>Imposto 3%</th><th>Extras</th><th>Total custos</th></tr></thead><tbody>{reportRows.map((row, index) => { const transaction = numericValue(row.valor_transacao) || 0; const tax = transaction * ITBI_GENERAL_RATE; const extras = Math.max(0, numericValue(reportRegistryFee) || 0); return <tr key={row.id || `${row.bairro}-${index}`}><td>{row.bairro || 'Porto Alegre'}</td><td>{row.data_transacao ? new Date(row.data_transacao).toLocaleDateString('pt-BR') : '—'}</td><td>{row.area_privativa ? `${row.area_privativa} m²` : '—'}</td><td>{money(transaction)}</td><td>{money(numericValue(row.valor_metro_quadrado) || (transaction / (numericValue(row.area_privativa) || 1)))}</td><td>{money(tax)}</td><td>{extras ? money(extras) : 'Informe'}</td><td>{money(tax + extras)}</td></tr>; })}</tbody></table></div> : <p className="inline-message">A base não retornou transações para este relatório.</p>}
        <p className="report-disclaimer">Os valores são históricos e reais na base disponível. A simulação de custos é informativa; confirme a guia municipal e o orçamento do cartório antes de decidir.</p>
      </section>}

      <section className="property-section broker-section" id="cadastro-corretora" aria-labelledby="broker-title">
        <div className="section-heading"><div><span className="eyebrow">PRIMEIRA CORRETORA IPLICT</span><h2 id="broker-title">Comece pelo seu perfil.</h2></div><p>Você será a primeira corretora cadastrada no piloto.</p></div>
        <form className="property-grid" onSubmit={saveBroker}>
          <label>Nome completo<input value={brokerDraft.nome} onChange={(e) => updateBroker('nome', e.target.value)} placeholder="Seu nome profissional" /></label>
          <label>CRECI<input required value={brokerDraft.creci} onChange={(e) => updateBroker('creci', e.target.value)} placeholder="Ex.: 00000" /></label>
          <label>E-mail<input type="email" value={brokerDraft.email} onChange={(e) => updateBroker('email', e.target.value)} placeholder="voce@email.com" /></label>
          <label>WhatsApp<input value={brokerDraft.whatsapp} onChange={(e) => updateBroker('whatsapp', e.target.value)} placeholder="(51) 99999-9999" /></label>
          <label>Link público · opcional<input value={brokerDraft.slug} onChange={(e) => updateBroker('slug', e.target.value)} placeholder="seu-nome" /></label>
          <label>Bairros de atuação<input value={brokerDraft.bairros} onChange={(e) => updateBroker('bairros', e.target.value)} placeholder="Petrópolis, Bela Vista, Zona Sul" /></label>
          <label>Instagram<input value={brokerDraft.instagram} onChange={(e) => updateBroker('instagram', e.target.value)} placeholder="https://instagram.com/seu-perfil" /></label>
          <label>Facebook<input value={brokerDraft.facebook} onChange={(e) => updateBroker('facebook', e.target.value)} placeholder="https://facebook.com/seu-perfil" /></label>
          <label>LinkedIn<input value={brokerDraft.linkedin} onChange={(e) => updateBroker('linkedin', e.target.value)} placeholder="https://linkedin.com/in/seu-perfil" /></label>
          <label>Site pessoal · opcional<input value={brokerDraft.site_pessoal} onChange={(e) => updateBroker('site_pessoal', e.target.value)} placeholder="https://seusite.com.br" /></label>
          <label>Foto de perfil<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setBrokerPhotoFile(e.target.files?.[0] || null)} /><small className="field-help">Use uma imagem profissional, de preferência vertical.</small></label>
          <label>Vídeo curto de apresentação<input type="file" accept="video/*" onChange={(e) => setBrokerVideoFile(e.target.files?.[0] || null)} /><small className="field-help">Sugestão: até 60 segundos, vertical, falando quem você ajuda.</small></label>
          <label className="wide">QR Code do perfil · opcional<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setBrokerQrFile(e.target.files?.[0] || null)} /><small className="field-help">Se não tiver site, o IPLICT criará uma página pública com seu link.</small></label>
          <label className="wide">Apresentação pública<textarea value={brokerDraft.bio} onChange={(e) => updateBroker('bio', e.target.value)} placeholder="Como você ajuda compradores e proprietários?" rows="3" /></label>
          {brokerMessage && <p className="property-message wide" role="status">{brokerMessage}</p>}
          <button className="button button-dark wide" type="submit" disabled={brokerBusy}>{brokerBusy ? 'Salvando…' : 'Salvar meu perfil de corretora'} <Icon name="arrow" size={17} /></button>
        </form>
      </section>

      <section className="property-section" id="cadastro-imovel" aria-labelledby="property-title">
        <div className="section-heading"><div><span className="eyebrow">PRIMEIRO IMÓVEL DA CORRETORA</span><h2 id="property-title">Cadastre um imóvel em quatro passos.</h2></div><p>O cadastro começa como rascunho e só é publicado após sua revisão.</p></div>
        <form className="property-wizard" onSubmit={savePropertyDraft}>
          <div className="property-steps" role="tablist" aria-label="Etapas do cadastro">{['Identificação', 'Características', 'Diferenciais', 'Mídia e revisão'].map((label, index) => <button type="button" role="tab" aria-selected={propertyStep === index} className={propertyStep === index ? 'active' : ''} key={label} onClick={() => index <= propertyStep && setPropertyStep(index)}><b>0{index + 1}</b><span>{label}</span></button>)}</div>
          {propertyStep === 0 && <div className="property-grid">
            <label>Tipo de imóvel<select value={propertyDraft.tipo} onChange={(e) => updateProperty('tipo', e.target.value)}><option>Apartamento</option><option>Casa</option><option>Cobertura</option><option>Terreno</option><option>Sala comercial</option></select></label>
            <label>Finalidade<select value={propertyDraft.finalidade} onChange={(e) => updateProperty('finalidade', e.target.value)}><option>Venda</option><option>Aluguel</option></select></label>
            <label className="wide">Título do imóvel<input value={propertyDraft.titulo} onChange={(e) => updateProperty('titulo', e.target.value)} placeholder="Ex.: Apartamento iluminado próximo ao Parcão" /></label>
            <label>Cidade<input value={propertyDraft.cidade} onChange={(e) => updateProperty('cidade', e.target.value)} /></label>
            <label>Bairro<input value={propertyDraft.bairro} onChange={(e) => updateProperty('bairro', e.target.value)} placeholder="Ex.: Petrópolis" /></label>
            <label className="wide">Endereço completo <small className="field-help">Fica privado por padrão.</small><input value={propertyDraft.endereco_privado} onChange={(e) => updateProperty('endereco_privado', e.target.value)} placeholder="Rua, número e complemento" /></label>
            <label className="property-check wide"><input type="checkbox" checked={propertyDraft.mostrar_endereco} onChange={(e) => updateProperty('mostrar_endereco', e.target.checked)} /> Publicar o endereço completo no anúncio</label>
            <div className="map-preview wide"><div className="map-dot" /><div className="map-radius" /><strong>Mapa público aproximado</strong><span>Exibirá o bairro e um raio de 500 m ao redor do endereço real. O endereço exato permanece privado por padrão.</span></div>
          </div>}
          {propertyStep === 1 && <div className="property-grid">
            <label>Área privativa · m²<input type="number" min="1" value={propertyDraft.area_privativa} onChange={(e) => updateProperty('area_privativa', e.target.value)} placeholder="Ex.: 82" /></label>
            <label>Área total · m²<input type="number" min="1" value={propertyDraft.area_total} onChange={(e) => updateProperty('area_total', e.target.value)} /></label>
            <label>Dormitórios<input type="number" min="0" value={propertyDraft.dormitorios} onChange={(e) => updateProperty('dormitorios', e.target.value)} /></label>
            <label>Suítes<input type="number" min="0" value={propertyDraft.suites} onChange={(e) => updateProperty('suites', e.target.value)} /></label>
            <label>Banheiros<input type="number" min="0" value={propertyDraft.banheiros} onChange={(e) => updateProperty('banheiros', e.target.value)} /></label>
            <label>Vagas<input type="number" min="0" value={propertyDraft.vagas} onChange={(e) => updateProperty('vagas', e.target.value)} /></label>
            <label>Tipo de vaga<select value={propertyDraft.tipo_vaga} onChange={(e) => updateProperty('tipo_vaga', e.target.value)}><option value="">A confirmar</option><option>Escriturada</option><option>Coberta</option><option>Descoberta</option><option>Rotativa</option></select></label>
            <label>Preço de venda · R$<input inputMode="decimal" value={propertyDraft.preco_venda} onChange={(e) => updateProperty('preco_venda', formatMoneyInput(e.target.value))} placeholder="1.000.000,00" /></label>
            <label>Condomínio · R$/mês<input inputMode="decimal" value={propertyDraft.condominio} onChange={(e) => updateProperty('condominio', formatMoneyInput(e.target.value))} placeholder="1.250,00" /></label>
            <label>IPTU · R$/ano<input inputMode="decimal" value={propertyDraft.iptu} onChange={(e) => updateProperty('iptu', formatMoneyInput(e.target.value))} placeholder="5.000,00" /></label>
          </div>}
          {propertyStep === 2 && <div className="property-grid">
            <label className="wide">Descrição pública<textarea value={propertyDraft.descricao_publica} onChange={(e) => updateProperty('descricao_publica', e.target.value)} placeholder="Descreva o imóvel com clareza, sem promessas não verificadas." rows="5" /></label>
            <label className="wide">Diferenciais<textarea value={propertyDraft.diferenciais} onChange={(e) => updateProperty('diferenciais', e.target.value)} placeholder="Varanda, sol da manhã, elevador, proximidade de parque…" rows="3" /></label>
            <div className="property-note wide"><strong>Revisão IPLICT</strong><span>Não inclua matrícula, CPF, documentos do proprietário ou informações privadas na descrição pública.</span></div>
          </div>}
          {propertyStep === 3 && <div className="property-grid">
            <label className="wide">Até 30 fotos do imóvel<input type="file" accept="image/*" multiple onChange={selectPropertyPhotos} /><small className="field-help">Selecione duas principais: uma externa e uma interna. Os arquivos ficam apenas neste navegador até o upload ser ativado.</small></label>
            {photoPreviews.length > 0 && <div className="media-preview-grid wide">{photoPreviews.slice(0, 6).map((photo) => <div className="media-preview" key={`${photo.name}-${photo.url}`}><img src={photo.url} alt="Prévia local do imóvel" /><span>{photo.name}</span></div>)}{photoPreviews.length > 6 && <span className="media-count">+{photoPreviews.length - 6} fotos selecionadas</span>}</div>}
            <label>Vídeo vertical · 1<input type="file" accept="video/*" onChange={(e) => selectPropertyMedia('videoVertical', e.target.files?.[0], 'video')} /><small className="field-help">Até {MEDIA_LIMITS.videoSeconds} segundos e 500 MB.</small></label>
            <label>Vídeo horizontal · 1<input type="file" accept="video/*" onChange={(e) => selectPropertyMedia('videoHorizontal', e.target.files?.[0], 'video')} /><small className="field-help">Até {MEDIA_LIMITS.videoSeconds} segundos e 500 MB.</small></label>
            <label>Matrícula atualizada · obrigatória para publicar<input type="file" accept="application/pdf,image/*" onChange={(e) => setPropertyMedia((current) => ({ ...current, matricula: e.target.files?.[0] || null }))} /></label>
            <label>Cópia do IPTU<input type="file" accept="application/pdf,image/*" onChange={(e) => setPropertyMedia((current) => ({ ...current, iptu: e.target.files?.[0] || null }))} /></label>
            <label>Condomínio / quitação<input type="file" accept="application/pdf,image/*" onChange={(e) => setPropertyMedia((current) => ({ ...current, condominio: e.target.files?.[0] || null }))} /></label>
            <label className="wide">Até 10 links de anúncios sociais<textarea value={propertyDraft.links_anuncios} onChange={(e) => updateProperty('links_anuncios', e.target.value)} placeholder="Cole um link por linha: Instagram, Facebook, portal ou site da imobiliária." rows="4" /></label>
            <label>Modalidade<select value={propertyDraft.modalidade_anuncio} onChange={(e) => updateProperty('modalidade_anuncio', e.target.value)}><option>Padrão</option><option>Exclusividade</option></select></label>
            <label className="property-check"><input type="checkbox" checked={propertyDraft.anuncio_pago} onChange={(e) => updateProperty('anuncio_pago', e.target.checked)} /> Anúncio pago: priorizar na lista</label>
            {mediaNotice && <p className="property-message wide" role="alert">{mediaNotice}</p>}
            <div className="property-checklist wide"><strong>Regras de publicação e duplicidade</strong><span>✓ Duas fotos principais serão compartilhadas: externa e interna.</span><span>✓ Anúncios duplicados serão agrupados e mostrarão as imobiliárias participantes.</span><span>✓ Exclusividade aparece primeiro; anúncio pago pode receber prioridade conforme a regra comercial.</span><span>⚠ A matrícula é obrigatória para solicitar publicação; o imóvel permanece rascunho até a conferência.</span></div>
          </div>}
          {propertyMessage && <p className="property-message" role="status">{propertyMessage}</p>}
          <div className="property-actions"><button className="button button-outline" type="button" disabled={propertyStep === 0} onClick={() => setPropertyStep((step) => Math.max(0, step - 1))}>Voltar</button>{propertyStep < 3 ? <button className="button button-dark" type="button" onClick={nextPropertyStep}>Próxima etapa <Icon name="arrow" size={17} /></button> : <button className="button button-dark" type="submit" disabled={propertyBusy}>{propertyBusy ? 'Salvando…' : 'Salvar como rascunho'} <Icon name="arrow" size={17} /></button>}</div>
        </form>
      </section>

      <section className="data-strip" id="dados">
        <div className="data-icon"><Icon name="chart" size={24} /></div>
        <div className="data-copy"><span className="eyebrow">DADOS LOCAIS, COM TRANSPARÊNCIA</span><h2>Porto Alegre no centro da decisão.</h2><p>Referências de imóveis e transações exibidas somente quando a base estiver conectada e os dados disponíveis.</p></div>
        <div className={`connection-pill ${isSupabaseConfigured ? 'connected' : ''}`}><span />{isSupabaseConfigured ? 'Base conectada' : 'Base em preparação'}</div>
      </section>

      <VoiceAssistant onSearch={searchListingsByAssistant} listings={listings} />

      <footer className="footer">
        <a className="brand footer-brand" href="#inicio"><span className="brand-mark">I</span><span className="brand-copy"><strong>IPLICT</strong><small>PORTO ALEGRE</small></span></a>
        <p>Inteligência imobiliária para decisões melhores.</p><span>© {new Date().getFullYear()} IPLICT</span>
      </footer>
    </main>
  );
}
