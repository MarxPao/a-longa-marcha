import React, { useState } from 'react';

export interface PropsListaVirtualizada<T> {
  itens: T[];
  alturaItemPx?: number;
  alturaViewportPx?: number;
  overscan?: number;
  limiarAtivacao?: number;
  obterChave: (item: T, indice: number) => string;
  renderizarItem: (item: T, indice: number) => React.ReactNode;
  testId?: string;
}

/**
 * Componente de virtualização por janela (windowed virtualization) sem dependências externas.
 * Mantém o número de nós no DOM limitado à janela visível + overscan em listas longas (Seções 5.3, 6.5 e Fase 8).
 */
export function ListaVirtualizada<T>({
  itens,
  alturaItemPx = 64,
  alturaViewportPx = 320,
  overscan = 6,
  limiarAtivacao = 25,
  obterChave,
  renderizarItem,
  testId = 'lista-virtualizada',
}: PropsListaVirtualizada<T>): React.JSX.Element {
  const [scrollTop, setScrollTop] = useState(0);

  if (itens.length <= limiarAtivacao) {
    return (
      <div
        data-testid={testId}
        data-total-itens={itens.length}
        data-itens-renderizados={itens.length}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
      >
        {itens.map((item, idx) => (
          <React.Fragment key={obterChave(item, idx)}>
            {renderizarItem(item, idx)}
          </React.Fragment>
        ))}
      </div>
    );
  }

  const indiceInicial = Math.max(0, Math.floor(scrollTop / alturaItemPx) - overscan);
  const quantidadeVisivel = Math.ceil(alturaViewportPx / alturaItemPx) + overscan * 2;
  const indiceFinal = Math.min(itens.length, indiceInicial + quantidadeVisivel);
  const fatiaVisivel = itens.slice(indiceInicial, indiceFinal);
  const espacoTopo = indiceInicial * alturaItemPx;
  const espacoBase = Math.max(0, (itens.length - indiceFinal) * alturaItemPx);

  return (
    <div
      data-testid={testId}
      data-total-itens={itens.length}
      data-itens-renderizados={fatiaVisivel.length}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      style={{
        maxHeight: alturaViewportPx,
        overflowY: 'auto',
        position: 'relative',
      }}
    >
      {espacoTopo > 0 && <div style={{ height: espacoTopo }} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {fatiaVisivel.map((item, offset) => {
          const idxReal = indiceInicial + offset;
          return (
            <React.Fragment key={obterChave(item, idxReal)}>
              {renderizarItem(item, idxReal)}
            </React.Fragment>
          );
        })}
      </div>
      {espacoBase > 0 && <div style={{ height: espacoBase }} />}
    </div>
  );
}
