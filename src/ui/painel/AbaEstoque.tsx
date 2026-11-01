import React, { useState } from 'react';
import type { ItemDeLista } from '../../domain';
import { useCampanhaStore } from '../../store';

interface Props {
  projetoId: string;
}

export function AbaEstoque({ projetoId }: Props): React.JSX.Element {
  const dump = useCampanhaStore((s) => s.dump);
  const criarEntidade = useCampanhaStore((s) => s.criarEntidade);

  const [modalNovoItem, setModalNovoItem] = useState(false);
  const [itemIdSelecionado, setItemIdSelecionado] = useState<string>('');
  const [quantidadeNecessaria, setQuantidadeNecessaria] = useState('10');
  const [copiado, setCopiado] = useState(false);

  // Itens na BOM do projeto
  const itensDeLista = dump.itensDeLista.filter((i) => i.projetoId === projetoId);

  // Calcula saldos totais disponíveis por item somando todos os armazéns
  const saldosPorItem = new Map<string, number>();
  for (const s of dump.saldos) {
    const atual = saldosPorItem.get(s.itemId) ?? 0;
    saldosPorItem.set(s.itemId, atual + s.quantidade);
  }

  // Identifica itens com compra sugerida (onde saldo disponível < quantidade necessária)
  const itensCompraSugerida = itensDeLista.filter((i) => {
    const saldoDisp = saldosPorItem.get(i.itemId) ?? 0;
    return saldoDisp < i.quantidade || i.status === 'falta';
  });

  const copiarListaCompra = () => {
    if (itensCompraSugerida.length === 0) return;
    const linhas = itensCompraSugerida.map((i) => {
      const item = dump.itens.find((it) => it.id === i.itemId);
      const saldoDisp = saldosPorItem.get(i.itemId) ?? 0;
      const faltam = Math.max(0, i.quantidade - saldoDisp);
      return `- ${item?.nome ?? 'Item'}: comprar ${faltam} ${item?.unidade ?? 'un'} (precisa de ${i.quantidade}, tem ${saldoDisp})`;
    });

    const texto = `Lista de Compra Sugerida — Projeto:\n${linhas.join('\n')}`;
    void navigator.clipboard?.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const salvarNovoItemBOM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemIdSelecionado) return;

    const qtd = Math.max(1, parseInt(quantidadeNecessaria || '1', 10));
    const saldoAtual = saldosPorItem.get(itemIdSelecionado) ?? 0;
    const statusInicial: ItemDeLista['status'] = saldoAtual >= qtd ? 'pronto' : 'falta';

    await criarEntidade<ItemDeLista>('itensDeLista', {
      projetoId,
      itemId: itemIdSelecionado,
      quantidade: qtd,
      status: statusInicial,
    });

    setModalNovoItem(false);
  };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
      data-testid="aba-estoque-conteudo"
    >
      {/* Cabeçalho da BOM e Botão de Adicionar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
            Lista de Materiais (BOM) ({itensDeLista.length})
          </span>
          <div style={{ fontSize: '0.74rem', color: 'var(--bronze)' }}>
            Cobertura: {itensDeLista.length - itensCompraSugerida.length} de {itensDeLista.length} itens cobertos
          </div>
        </div>

        <button
          type="button"
          className="botao-campanha botao-campanha-ouro"
          data-testid="botao-adicionar-item-bom"
          onClick={() => {
            setItemIdSelecionado(dump.itens[0]?.id ?? '');
            setModalNovoItem(true);
          }}
          style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}
        >
          + Adicionar Item
        </button>
      </div>

      {/* Lista de Compra Sugerida (Seção 6.5) */}
      {itensCompraSugerida.length > 0 && (
        <div
          style={{
            background: 'rgba(142, 31, 26, 0.05)',
            border: '1px solid var(--laca)',
            borderRadius: '4px',
            padding: '0.6rem',
          }}
          data-testid="bloco-compra-sugerida"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--laca)' }}>
              ⚠️ Compra Sugerida ({itensCompraSugerida.length} item(ns) em falta)
            </span>
            <button
              type="button"
              className="botao-campanha botao-campanha-ouro"
              style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}
              onClick={copiarListaCompra}
              data-testid="botao-copiar-compra-sugerida"
            >
              {copiado ? '✓ Copiado!' : '📋 Copiar Lista'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.4rem' }}>
            {itensCompraSugerida.map((i) => {
              const item = dump.itens.find((it) => it.id === i.itemId);
              const saldoDisp = saldosPorItem.get(i.itemId) ?? 0;
              const falta = Math.max(0, i.quantidade - saldoDisp);
              return (
                <div key={i.id} style={{ fontSize: '0.74rem', color: 'var(--laca)' }}>
                  • <strong>{item?.nome}</strong>: faltam {falta} {item?.unidade ?? 'un'}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista de Itens da BOM */}
      {itensDeLista.length === 0 ? (
        <p style={{ fontSize: '0.82rem', color: 'var(--bronze)', padding: '1rem', textAlign: 'center' }}>
          Nenhum insumo ou equipamento exigido por este projeto.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {itensDeLista.map((i) => {
            const item = dump.itens.find((it) => it.id === i.itemId);
            const saldoTotal = saldosPorItem.get(i.itemId) ?? 0;
            const coberto = saldoTotal >= i.quantidade;

            // Saldos específicos nos armazéns
            const saldosArmazens = dump.saldos.filter((s) => s.itemId === i.itemId);

            return (
              <div
                key={i.id}
                style={{
                  padding: '0.6rem',
                  backgroundColor: '#fffdf7',
                  border: '1px solid var(--pergaminho-escuro)',
                  borderRadius: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                }}
                data-testid={`item-bom-${i.id}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    📦 {item?.nome ?? 'Item'}
                  </span>
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.68rem',
                      background: coberto ? '#d1e7dd' : '#f8d7da',
                      color: coberto ? '#0f5132' : '#842029',
                    }}
                    data-testid={`status-cobertura-${i.id}`}
                  >
                    {coberto ? '✓ Coberto' : '⚠️ Em Falta'}
                  </span>
                </div>

                <div style={{ fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Necessário: {i.quantidade} {item?.unidade ?? 'un'}</span>
                  <span style={{ fontWeight: 600, color: coberto ? '#3E7C68' : 'var(--laca)' }}>
                    Disponível no Império: {saldoTotal} {item?.unidade ?? 'un'}
                  </span>
                </div>

                {/* Saldos por Armazém (Seção 6.5) */}
                {saldosArmazens.length > 0 && (
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: '#666',
                      borderTop: '1px solid #eee',
                      paddingTop: '0.3rem',
                      marginTop: '0.2rem',
                    }}
                  >
                    <span>Saldos por Armazém: </span>
                    {saldosArmazens.map((s, idx) => {
                      const armazem = dump.armazens.find((a) => a.id === s.armazemId);
                      return (
                        <span key={s.id}>
                          {armazem?.nome ?? 'Armazém'}: {s.quantidade} {item?.unidade ?? 'un'}
                          {idx < saldosArmazens.length - 1 ? ' · ' : ''}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Adicionar Item à BOM */}
      {modalNovoItem && (
        <div className="modal-overlay">
          <div className="modal-caixa" style={{ maxWidth: 420 }}>
            <div className="modal-cabecalho">
              <h3 className="modal-titulo">📦 Adicionar Item à BOM</h3>
              <button
                type="button"
                className="botao-campanha"
                onClick={() => setModalNovoItem(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={(e) => void salvarNovoItemBOM(e)}>
              <div className="modal-corpo">
                <div className="campo-form">
                  <label className="rotulo-form">Selecione o Insumo/Equipamento:</label>
                  <select
                    className="select-form"
                    value={itemIdSelecionado}
                    onChange={(e) => setItemIdSelecionado(e.target.value)}
                    data-testid="select-item-bom"
                    required
                  >
                    {dump.itens.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.nome} ({it.unidade})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="campo-form">
                  <label className="rotulo-form">Quantidade Necessária:</label>
                  <input
                    type="number"
                    min="1"
                    className="input-texto"
                    value={quantidadeNecessaria}
                    onChange={(e) => setQuantidadeNecessaria(e.target.value)}
                    data-testid="input-quantidade-bom"
                    required
                  />
                </div>
              </div>
              <div className="modal-rodape">
                <button
                  type="button"
                  className="botao-campanha"
                  onClick={() => setModalNovoItem(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="botao-campanha botao-campanha-jade"
                  data-testid="botao-confirmar-item-bom"
                >
                  Adicionar à Lista
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
