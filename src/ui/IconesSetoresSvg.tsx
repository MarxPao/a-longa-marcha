import React from 'react';

export interface PropsIconeSetor {
  iconeOuNome: string;
  cor?: string;
  tamanho?: number;
}

/**
 * Ícones SVG originais para os 9 setores imperiais da Tabela 4.2 e formas de saúde da Seção 6.8.
 * Licença: Autoria original do projeto A Longa Marcha (MIT / Uso Privado). Zero assets de terceiros.
 */
export function IconeSetorSvg({
  iconeOuNome,
  cor = 'currentColor',
  tamanho = 16,
}: PropsIconeSetor): React.JSX.Element {
  const chave = iconeOuNome.toLowerCase();

  if (chave.includes('agric') || chave.includes('espiga') || chave.includes('🌾')) {
    // Espiga com folha
    return (
      <svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 24 24"
        fill="none"
        stroke={cor}
        strokeWidth="2"
        data-testid="svg-icone-setor"
        aria-hidden="true"
      >
        <path d="M12 20V4" />
        <path d="M12 6C9 6 7 8 7 11C10 11 12 9 12 6Z" />
        <path d="M12 10C15 10 17 12 17 15C14 15 12 13 12 10Z" />
        <path d="M12 14C9 14 7 16 7 19C10 19 12 17 12 14Z" />
      </svg>
    );
  }

  if (chave.includes('aliment') || chave.includes('caldeir') || chave.includes('🍲')) {
    // Caldeirão sobre o fogo
    return (
      <svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 24 24"
        fill="none"
        stroke={cor}
        strokeWidth="2"
        data-testid="svg-icone-setor"
        aria-hidden="true"
      >
        <path d="M5 9H19V13C19 16.5 16 18 12 18C8 18 5 16.5 5 13V9Z" />
        <path d="M8 21L10 19M16 21L14 19M12 22V19" />
      </svg>
    );
  }

  if (chave.includes('bebida') || chave.includes('jarro') || chave.includes('🍶')) {
    // Jarro selado
    return (
      <svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 24 24"
        fill="none"
        stroke={cor}
        strokeWidth="2"
        data-testid="svg-icone-setor"
        aria-hidden="true"
      >
        <path d="M9 4H15L14 8C17 10 18 13 17 18C16 20 14 21 12 21C10 21 8 20 7 18C6 13 7 10 10 8L9 4Z" />
        <path d="M8 4H16" />
      </svg>
    );
  }

  if (chave.includes('quim') || chave.includes('quím') || chave.includes('alquim') || chave.includes('⚗')) {
    // Espiral de alquimia
    return (
      <svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 24 24"
        fill="none"
        stroke={cor}
        strokeWidth="2"
        data-testid="svg-icone-setor"
        aria-hidden="true"
      >
        <path d="M12 12C12 10.5 13.5 9.5 15 10.5C17 12 16 15.5 13 16.5C9.5 17.5 6.5 14.5 7.5 10.5C8.5 6 13.5 4 17.5 6.5" />
      </svg>
    );
  }

  if (chave.includes('automa') || chave.includes('engrenagem') || chave.includes('⚙')) {
    // Engrenagem com flecha
    return (
      <svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 24 24"
        fill="none"
        stroke={cor}
        strokeWidth="2"
        data-testid="svg-icone-setor"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="5" />
        <path d="M12 3V5M12 19V21M3 12H5M19 12H21" />
        <path d="M10 12H14M12 10L14 12L12 14" />
      </svg>
    );
  }

  if (chave.includes('rob') || chave.includes('braco') || chave.includes('braço') || chave.includes('🦾')) {
    // Braço articulado
    return (
      <svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 24 24"
        fill="none"
        stroke={cor}
        strokeWidth="2"
        data-testid="svg-icone-setor"
        aria-hidden="true"
      >
        <path d="M5 20H13M9 20V14L14 8L18 10" />
        <circle cx="9" cy="14" r="2" />
        <circle cx="14" cy="8" r="2" />
      </svg>
    );
  }

  if (chave.includes('educ') || chave.includes('pergaminho') || chave.includes('📜')) {
    // Pergaminho aberto
    return (
      <svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 24 24"
        fill="none"
        stroke={cor}
        strokeWidth="2"
        data-testid="svg-icone-setor"
        aria-hidden="true"
      >
        <path d="M6 4H18V18C18 19.5 16.5 20 15 20H7C5.5 20 4 19 4 17V6C4 4.8 4.8 4 6 4Z" />
        <path d="M8 9H15M8 13H14" />
      </svg>
    );
  }

  if (chave.includes('prof') || chave.includes('codigo') || chave.includes('código') || chave.includes('🏯')) {
    // Selo com chaves de código
    return (
      <svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 24 24"
        fill="none"
        stroke={cor}
        strokeWidth="2"
        data-testid="svg-icone-setor"
        aria-hidden="true"
      >
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M10 9L7 12L10 15M14 9L17 12L14 15" />
      </svg>
    );
  }

  // Comércio / Balança (padrão)
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke={cor}
      strokeWidth="2"
      data-testid="svg-icone-setor"
      aria-hidden="true"
    >
      <path d="M12 4V20M6 8H18M5 8L3 14H7L5 8ZM19 8L17 14H21L19 8Z" />
      <path d="M8 20H16" />
    </svg>
  );
}

/**
 * Ícone redundante de forma para Saúde (Seção 4.4 e 6.8: "Cor nunca sozinha").
 */
export function IconeFormaSaudeSvg({
  pontuacao,
  tamanho = 15,
}: {
  pontuacao: number;
  tamanho?: number;
}): React.JSX.Element {
  if (pontuacao >= 70) {
    // Bandeira erguida (Saudável)
    return (
      <svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 20 20"
        fill="none"
        data-testid="icone-forma-saude-erguida"
        aria-label="Forma: Bandeira erguida (Saudável)"
      >
        <path d="M4 18V3" stroke="#3E7C68" strokeWidth="2" />
        <path d="M4 3L16 6L4 10V3Z" fill="#3E7C68" />
      </svg>
    );
  }

  if (pontuacao >= 40) {
    // Bandeira caída (Atenção)
    return (
      <svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 20 20"
        fill="none"
        data-testid="icone-forma-saude-caida"
        aria-label="Forma: Bandeira caída (Atenção)"
      >
        <path d="M4 18V4" stroke="#D09B2C" strokeWidth="2" />
        <path d="M4 6L14 13L4 14V6Z" fill="#D09B2C" />
      </svg>
    );
  }

  // Fumaça e sino de alarme (Crítico)
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 20 20"
      fill="none"
      data-testid="icone-forma-saude-fumaca"
      aria-label="Forma: Fumaça de alerta (Crítico)"
    >
      <path
        d="M6 16C5 13 8 11 7 8C6 5 10 3 11 2M12 17C11 14 14 12 13 9C12 6 15 4 15 3"
        stroke="#8E1F1A"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
