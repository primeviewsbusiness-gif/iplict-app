'use client';

import React from 'react';

export default function Page() {
  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, sans-serif', padding: '40px 20px', maxWidth: '1000px', margin: '0 auto', backgroundColor: '#F8FAFC', minHeight: '100vh' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '3rem', color: '#0F172A', marginBottom: '10px', fontWeight: '800' }}>IPLICT</h1>
        <p style={{ fontSize: '1.25rem', color: '#475569', margin: 0 }}>
          Portal Imobiliário Inteligente de Porto Alegre
        </p>
      </header>

      {/* Matriz de Triagem de Intenção na 1ª Tela */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        
        {/* Perfil 1: Comprador Imediato */}
        <div style={{ border: '2px solid #2563EB', borderRadius: '12px', padding: '24px', backgroundColor: '#EFF6FF', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <span style={{ backgroundColor: '#2563EB', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '0.05em' }}>
            COMPRADOR
          </span>
          <h3 style={{ marginTop: '16px', color: '#1E3A8A', fontSize: '1.25rem' }}>Quer comprar agora?</h3>
          <p style={{ color: '#1E40AF', fontSize: '0.95rem', lineHeight: '1.5' }}>
            Busca instantânea por bairros de POA com transparência total de custos de ITBI e cartório.
          </p>
          <input 
            type="text" 
            placeholder="Ex: Menino Deus, Sacada, Churrasqueira..." 
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #93C5FD', marginTop: '12px', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>

        {/* Perfil 2: Planejador de Longo Prazo */}
        <div style={{ border: '2px solid #059669', borderRadius: '12px', padding: '24px', backgroundColor: '#ECFDF5', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <span style={{ backgroundColor: '#059669', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '0.05em' }}>
            PLANEJADOR
          </span>
          <h3 style={{ marginTop: '16px', color: '#065F46', fontSize: '1.25rem' }}>Planejando para 1 a 3 anos?</h3>
          <p style={{ color: '#047857', fontSize: '0.95rem', lineHeight: '1.5' }}>
            Simulador híbrido: Compare a economia real entre Consórcio Contemplado vs. Financiamento.
          </p>
          <button style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#059669', color: '#fff', fontWeight: 'bold', marginTop: '12px', cursor: 'pointer' }}>
            Simular Economia
          </button>
        </div>

        {/* Perfil 3: Proprietário */}
        <div style={{ border: '2px solid #D97706', borderRadius: '12px', padding: '24px', backgroundColor: '#FFFBEB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <span style={{ backgroundColor: '#D97706', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '0.05em' }}>
            PROPRIETÁRIO
          </span>
          <h3 style={{ marginTop: '16px', color: '#92400E', fontSize: '1.25rem' }}>Quer vender seu imóvel?</h3>
          <p style={{ color: '#B45309', fontSize: '0.95rem', lineHeight: '1.5' }}>
            Avaliação real com dados do ITBI de POA, auditoria de garagem e checklist digital.
          </p>
          <button style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#D97706', color: '#fff', fontWeight: 'bold', marginTop: '12px', cursor: 'pointer' }}>
            Cadastrar Imóvel
          </button>
        </div>

      </div>

      <footer style={{ textAlign: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '24px', color: '#94A3B8', fontSize: '0.875rem' }}>
        IPLICT © 2026 — Inteligência Imobiliária & Buyer's Agent em Porto Alegre
      </footer>
    </main>
  );
}
