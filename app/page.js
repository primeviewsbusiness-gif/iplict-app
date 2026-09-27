import React from 'react';

export default function Home() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '40px 20px', maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.8rem', color: '#0F172A', marginBottom: '10px' }}>IPLICT</h1>
        <p style={{ fontSize: '1.2rem', color: '#475569' }}>
          Portal Imobiliário Inteligente de Porto Alegre
        </p>
      </header>

      {/* Matriz de Triagem na 1ª Tela */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        
        {/* Perfil 1: Comprador Imediato */}
        <div style={{ border: '2px solid #2563EB', borderRadius: '12px', padding: '24px', backgroundColor: '#EFF6FF' }}>
          <span style={{ backgroundColor: '#2563EB', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
            COMPRADOR
          </span>
          <h3 style={{ marginTop: '12px', color: '#1E3A8A' }}>Quer comprar agora?</h3>
          <p style={{ color: '#1E40AF', fontSize: '0.95rem' }}>
            Busca instantânea por bairros de POA com transparência de custos de ITBI e cartório.
          </p>
          <input 
            type="text" 
            placeholder="Ex: Menino Deus, Sacada, Churrasqueira..." 
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #93C5FD', marginTop: '10px', boxSizing: 'border-box' }}
          />
        </div>

        {/* Perfil 2: Planejador de Longo Prazo */}
        <div style={{ border: '2px solid #059669', borderRadius: '12px', padding: '24px', backgroundColor: '#ECFDF5' }}>
          <span style={{ backgroundColor: '#059669', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
            PLANEJADOR
          </span>
          <h3 style={{ marginTop: '12px', color: '#065F46' }}>Planejando para 1 a 3 anos?</h3>
          <p style={{ color: '#047857', fontSize: '0.95rem' }}>
            Simulador híbrido: Compare a economia real entre Consórcio Contemplado vs. Financiamento SBPE/MCMV.
          </p>
          <button style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', backgroundColor: '#059669', color: '#fff', fontWeight: 'bold', marginTop: '10px', cursor: 'pointer' }}>
            Simular Economia
          </button>
        </div>

        {/* Perfil 3: Proprietário */}
        <div style={{ border: '2px solid #D97706', borderRadius: '12px', padding: '24px', backgroundColor: '#FFFBEB' }}>
          <span style={{ backgroundColor: '#D97706', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
            PROPRIETÁRIO
          </span>
          <h3 style={{ marginTop: '12px', color: '#92400E' }}>Quer vender seu imóvel?</h3>
          <p style={{ color: '#B45309', fontSize: '0.95rem' }}>
            Avaliação real com dados do ITBI de POA, auditoria de garagem e checklist digital de inventário.
          </p>
          <button style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', backgroundColor: '#D97706', color: '#fff', fontWeight: 'bold', marginTop: '10px', cursor: 'pointer' }}>
            Cadastrar Imóvel
          </button>
        </div>

      </div>

      <footer style={{ textAlign: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '20px', color: '#94A3B8', fontSize: '0.9rem' }}>
        IPLICT © 2026 — Inteligência Imobiliária & Buyer's Agent em Porto Alegre
      </footer>
    </div>
  );
}
