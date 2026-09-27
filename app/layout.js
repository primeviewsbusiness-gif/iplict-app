import React from 'react';

export const metadata = {
  title: 'IPLICT - Portal Imobiliário Inteligente | Porto Alegre',
  description: 'Plataforma imobiliária com inteligência de dados de ITBI real, transparência e triagem de perfil em Porto Alegre.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#F8FAFC', color: '#0F172A' }}>
        {children}
      </body>
    </html>
  );
}
