import React, { useMemo, useState } from 'react';
import type {
  Armazem,
  Fornecedor,
  Item,
  ItemDeLista,
  UUID,
} from '../domain';
import { useCampanhaStore } from '../store';
import { formatarData, formatarMoeda } from './formatadores';

export function TelaEstoqueGlobal(): React.JSX.Element | null {
  const modalAberto = useCampanhaStore((s) => s.modalAberto);
  const fecharModal = useCampanhaStore((s) => s.fecharModal);
  const dump = useCampanhaStore((s) => s.dump);
  const semanaAtual = useCampanhaStore((s) => s.semanaAtual);
  const criarEntidade = useCampanhaStore((s) => s.criarEntidade);
  const registrarMovimentoEstoque = useCampanhaStore(
    (s) => s.registrarMovimentoEstoque
  );

  const [abaAtiva, setAbaAtiva] = useState<
    'saldos_movimentos' | 'cadastros' | 'bom_compras'
  >('saldos_movimentos');

  // Estado: Novo Fornecedor
  const [nomeFornecedor, setNomeFornecedor] = useState('');
  const [contatoFornecedor, setContatoFornecedor] = useState('');
  const [prazoFornecedor, setPrazoFornecedor] = useState('7');

  // Estado: Novo Armazém
  const [nomeArmazem, setNomeArmazem] = useState('');
  const [localArmazem, setLocalArmazem] = useState('');

  // Estado: Novo Item
  const [nomeItem, setNomeItem] = useState('');
  const [unidadeItem, setUnidadeItem] = useState('un');
  const [custoItemReais, setCustoItemReais] = useState('50');
  const [estoqueMinimoItem, setEstoqueMinimoItem] = useState('5');
  const [fornecedorItemId, setFornecedorItemId] = useState<UUID>('');
  const [tipoItem, setTipoItem] = useState<'insumo' | 'equipamento'>('insumo');

  // Estado: Novo Movimento
  const [movItemId, setMovItemId] = useState<UUID>('');
  const [movArmazemId, setMovArmazemId] = useState<UUID>('');
  const [movTipo, setMovTipo] = useState<'entrada' | 'saida' | 'ajuste'>('entrada');
  const [movQuantidade, setMovQuantidade] = useState('10');

  // Estado: Novo Item de Lista (BOM)
  const [bomProjetoId, setBomProjetoId] = useState<UUID>('');
  const [bomItemId, setBomItemId] = useState<UUID>('');
  const [bomQuantidade, setBomQuantidade] = useState('5');

  const [erroOperacao, setErroOperacao] = useState<string | null>(null);
  const [sucessoOperacao, setSucessoOperacao] = useState<string | null>(null);

  const estaAberto = modalAberto === 'estoqueGlobal';

  const fornecedoresAtivos = useMemo(
    () => dump.fornecedores.filter((f) => f.arquivadoEm === null),
    [dump.fornecedores]
  );
  const armazensAtivos = useMemo(
    () => dump.armazens.filter((a) => a.arquivadoEm === null),
    [dump.armazens]
  );
  const itensAtivos = useMemo(
    () => dump.itens.filter((i) => i.arquivadoEm === null),
    [dump.itens]
  );
  const projetosAtivos = useMemo(
    () => dump.projetos.filter((p) => p.arquivadoEm === null),
    [dump.projetos]
  );

  // Mapa de saldo total por itemId
  const saldoTotalPorItem = useMemo(() => {
    const mapa = new Map<UUID, number>();
    for (const s of dump.saldos) {
      if (s.arquivadoEm === null) {
        mapa.set(s.itemId, (mapa.get(s.itemId) ?? 0) + s.quantidade);
      }
    }
    return mapa;
  }, [dump.saldos]);

  // Compra sugerida consolidada (faltas na BOM + abaixo do estoque mínimo)
  const listaCompraSugerida = useMemo(() => {
    const demandaBomPorItem = new Map<UUID, number>();
    for (const il of dump.itensDeLista) {
      if (il.arquivadoEm === null && il.status !== 'pronto') {
        demandaBomPorItem.set(
          il.itemId,
          (demandaBomPorItem.get(il.itemId) ?? 0) + il.quantidade
        );
      }
    }

    const fornecedoresMap = new Map(fornecedoresAtivos.map((f) => [f.id, f]));

    const sugestoes: Array<{
      item: Item;
      fornecedor: Fornecedor | undefined;
      saldoDisponivel: number;
      necessarioTotal: number;
      quantidadeComprar: number;
      custoTotalCentavos: number;
    }> = [];

    for (const item of itensAtivos) {
      const saldoDisp = saldoTotalPorItem.get(item.id) ?? 0;
      const demandaBom = demandaBomPorItem.get(item.id) ?? 0;
      const alvo = Math.max(item.estoqueMinimo, demandaBom);

      if (saldoDisp < alvo) {
        const qtdComprar = alvo - saldoDisp;
        sugestoes.push({
          item,
          fornecedor: item.fornecedorId
            ? fornecedoresMap.get(item.fornecedorId)
            : undefined,
          saldoDisponivel: saldoDisp,
          necessarioTotal: alvo,
          quantidadeComprar: qtdComprar,
          custoTotalCentavos: Math.round(qtdComprar * item.custoUnitarioCentavos),
        });
      }
    }

    return sugestoes;
  }, [itensAtivos, dump.itensDeLista, saldoTotalPorItem, fornecedoresAtivos]);

  if (!estaAberto) return null;

  const handleCriarFornecedor = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroOperacao(null);
    if (!nomeFornecedor.trim()) return;

    const criado = await criarEntidade<Fornecedor>('fornecedores', {
      nome: nomeFornecedor.trim(),
      contato: contatoFornecedor.trim(),
      prazoEntregaDias: Math.max(0, parseInt(prazoFornecedor || '7', 10)),
      observacoes: '',
    });
    setNomeFornecedor('');
    setContatoFornecedor('');
    setSucessoOperacao(`Fornecedor "${criado.nome}" cadastrado.`);
  };

  const handleCriarArmazem = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroOperacao(null);
    if (!nomeArmazem.trim()) return;

    const criado = await criarEntidade<Armazem>('armazens', {
      nome: nomeArmazem.trim(),
      local: localArmazem.trim() || 'Sede Central',
      observacoes: '',
    });
    setNomeArmazem('');
    setLocalArmazem('');
    setSucessoOperacao(`Armazém "${criado.nome}" cadastrado.`);
  };

  const handleCriarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroOperacao(null);
    if (!nomeItem.trim()) return;

    const criado = await criarEntidade<Item>('itens', {
      nome: nomeItem.trim(),
      unidade: unidadeItem.trim() || 'un',
      custoUnitarioCentavos: Math.max(
        0,
        Math.round((parseFloat(custoItemReais) || 0) * 100)
      ),
      estoqueMinimo: Math.max(0, parseFloat(estoqueMinimoItem) || 0),
      fornecedorId: fornecedorItemId || null,
      tipo: tipoItem,
    });
    setNomeItem('');
    setSucessoOperacao(`Item "${criado.nome}" adicionado ao catálogo.`);
  };

  const handleRegistrarMovimento = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroOperacao(null);
    setSucessoOperacao(null);

    const itemAlvo = movItemId || itensAtivos[0]?.id;
    const armazemAlvo = movArmazemId || armazensAtivos[0]?.id;

    if (!itemAlvo || !armazemAlvo) {
      setErroOperacao('Selecione um item e um armazém válidos.');
      return;
    }

    const qtd = parseFloat(movQuantidade);
    if (isNaN(qtd) || qtd < 0) {
      setErroOperacao('Informe uma quantidade válida.');
      return;
    }

    const res = await registrarMovimentoEstoque({
      itemId: itemAlvo,
      armazemId: armazemAlvo,
      tipo: movTipo,
      quantidade: qtd,
      data: semanaAtual,
      projetoId: null,
    });

    if (!res.ok) {
      setErroOperacao(res.erro ?? 'Falha ao registrar movimento.');
    } else {
      setSucessoOperacao(`Movimento (${movTipo}: ${qtd}) registrado com sucesso.`);
    }
  };

  const handleAdicionarBom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroOperacao(null);
    const projId = bomProjetoId || projetosAtivos[0]?.id;
    const itemId = bomItemId || itensAtivos[0]?.id;
    if (!projId || !itemId) return;

    const qtd = Math.max(1, parseFloat(bomQuantidade) || 1);
    const disp = saldoTotalPorItem.get(itemId) ?? 0;

    await criarEntidade<ItemDeLista>('itensDeLista', {
      projetoId: projId,
      itemId,
      quantidade: qtd,
      status: disp >= qtd ? 'pronto' : 'falta',
    });

    setSucessoOperacao('Material adicionado à Lista de Materiais (BOM) da cidade.');
  };

  return (
    <div
      data-testid="modal-estoque-global"
      className="modal-overlay"
      onClick={fecharModal}
      style={{ zIndex: 85 }}
    >
      <div
        className="pergaminho-painel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '94vw',
          maxWidth: 1180,
          height: '86vh',
          borderRadius: 8,
          border: '2px solid var(--ouro)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.65)',
        }}
      >
        {/* Cabeçalho */}
        <header
          style={{
            padding: '0.85rem 1.25rem',
            background: 'var(--pergaminho-escuro)',
            borderBottom: '2px solid var(--bronze)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: 'var(--fonte-titulo)',
                fontSize: '1.2rem',
                margin: 0,
              }}
            >
              📦 Arsenal, Armazéns e Suprimentos do Império
            </h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--bronze)' }}>
              Fornecedores · Saldos por Armazém · Movimentações · Cobertura da BOM e Compra Sugerida
            </span>
          </div>

          <button
            type="button"
            data-testid="botao-fechar-estoque-global"
            className="botao-campanha"
            onClick={fecharModal}
          >
            ✕ Fechar
          </button>
        </header>

        {/* Abas de Navegação do Estoque */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(0,0,0,0.06)',
            borderBottom: '1px solid var(--bronze)',
            padding: '0 1rem',
            gap: '0.5rem',
          }}
        >
          <button
            type="button"
            data-testid="aba-estoque-saldos"
            className={`aba-item ${abaAtiva === 'saldos_movimentos' ? 'aba-ativa' : ''}`}
            onClick={() => setAbaAtiva('saldos_movimentos')}
          >
            📊 Saldos &amp; Movimentos
          </button>
          <button
            type="button"
            data-testid="aba-estoque-cadastros"
            className={`aba-item ${abaAtiva === 'cadastros' ? 'aba-ativa' : ''}`}
            onClick={() => setAbaAtiva('cadastros')}
          >
            🏛️ Fornecedores, Armazéns &amp; Itens
          </button>
          <button
            type="button"
            data-testid="aba-estoque-bom"
            className={`aba-item ${abaAtiva === 'bom_compras' ? 'aba-ativa' : ''}`}
            onClick={() => setAbaAtiva('bom_compras')}
          >
            🛒 Lista de Materiais (BOM) &amp; Compra Sugerida ({listaCompraSugerida.length})
          </button>
        </div>

        {erroOperacao && (
          <div
            data-testid="alerta-erro-estoque"
            style={{
              background: '#8E1F1A',
              color: '#FFF',
              padding: '0.5rem 1.2rem',
              fontSize: '0.82rem',
              fontWeight: 700,
            }}
          >
            ⚠️ {erroOperacao}
          </div>
        )}

        {sucessoOperacao && !erroOperacao && (
          <div
            data-testid="alerta-sucesso-estoque"
            style={{
              background: '#3E7C68',
              color: '#FFF',
              padding: '0.45rem 1.2rem',
              fontSize: '0.8rem',
            }}
          >
            ✓ {sucessoOperacao}
          </div>
        )}

        {/* Conteúdo das Abas */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
          {abaAtiva === 'saldos_movimentos' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '360px 1fr',
                gap: '1.25rem',
              }}
            >
              {/* Formulário de Registro de Movimento */}
              <form
                onSubmit={(e) => void handleRegistrarMovimento(e)}
                style={{
                  background: 'rgba(255,255,255,0.45)',
                  border: '1px solid var(--bronze)',
                  borderRadius: 6,
                  padding: '0.9rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.55rem',
                  alignSelf: 'start',
                }}
              >
                <strong style={{ fontSize: '0.9rem' }}>
                  🔄 Registrar Movimento de Estoque
                </strong>

                <label style={{ fontSize: '0.78rem' }}>
                  Item:
                  <select
                    data-testid="select-movimento-item"
                    className="input-texto"
                    value={movItemId}
                    onChange={(e) => setMovItemId(e.target.value)}
                    style={{ width: '100%', marginTop: '0.2rem' }}
                  >
                    <option value="">Selecione o item...</option>
                    {itensAtivos.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.nome} ({it.unidade})
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ fontSize: '0.78rem' }}>
                  Armazém:
                  <select
                    data-testid="select-movimento-armazem"
                    className="input-texto"
                    value={movArmazemId}
                    onChange={(e) => setMovArmazemId(e.target.value)}
                    style={{ width: '100%', marginTop: '0.2rem' }}
                  >
                    <option value="">Selecione o armazém...</option>
                    {armazensAtivos.map((ar) => (
                      <option key={ar.id} value={ar.id}>
                        {ar.nome} ({ar.local})
                      </option>
                    ))}
                  </select>
                </label>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <label style={{ flex: 1, fontSize: '0.78rem' }}>
                    Operação:
                    <select
                      data-testid="select-movimento-tipo"
                      className="input-texto"
                      value={movTipo}
                      onChange={(e) =>
                        setMovTipo(e.target.value as 'entrada' | 'saida' | 'ajuste')
                      }
                      style={{ width: '100%', marginTop: '0.2rem' }}
                    >
                      <option value="entrada">Entrada (+)</option>
                      <option value="saida">Saída (-)</option>
                      <option value="ajuste">Ajuste (=)</option>
                    </select>
                  </label>

                  <label style={{ width: 110, fontSize: '0.78rem' }}>
                    Quantidade:
                    <input
                      type="number"
                      data-testid="input-movimento-quantidade"
                      className="input-texto"
                      value={movQuantidade}
                      onChange={(e) => setMovQuantidade(e.target.value)}
                      style={{ width: '100%', marginTop: '0.2rem' }}
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  data-testid="botao-registrar-movimento"
                  className="botao-campanha botao-campanha-ouro"
                >
                  Confirmar Movimentação
                </button>
              </form>

              {/* Tabela de Saldos por Item e Histórico */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.45)',
                    border: '1px solid var(--bronze)',
                    borderRadius: 6,
                    padding: '0.9rem',
                  }}
                >
                  <strong style={{ fontSize: '0.9rem' }}>
                    📦 Saldos Consolidados ({itensAtivos.length} itens)
                  </strong>
                  <table
                    data-testid="tabela-saldos-estoque"
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      marginTop: '0.5rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          borderBottom: '1px solid var(--bronze)',
                          textAlign: 'left',
                        }}
                      >
                        <th style={{ padding: '0.35rem' }}>Item</th>
                        <th style={{ padding: '0.35rem' }}>Saldo Total</th>
                        <th style={{ padding: '0.35rem' }}>Estoque Mín.</th>
                        <th style={{ padding: '0.35rem' }}>Custo Unit.</th>
                        <th style={{ padding: '0.35rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensAtivos.map((it) => {
                        const total = saldoTotalPorItem.get(it.id) ?? 0;
                        const abaixoMinimo = total < it.estoqueMinimo;
                        return (
                          <tr
                            key={it.id}
                            data-testid={`linha-saldo-item-${it.id}`}
                            style={{
                              borderBottom: '1px solid rgba(122,90,43,0.15)',
                            }}
                          >
                            <td style={{ padding: '0.35rem', fontWeight: 600 }}>
                              {it.nome}
                            </td>
                            <td
                              data-testid={`valor-saldo-item-${it.id}`}
                              style={{ padding: '0.35rem', fontWeight: 700 }}
                            >
                              {total} {it.unidade}
                            </td>
                            <td style={{ padding: '0.35rem' }}>
                              {it.estoqueMinimo} {it.unidade}
                            </td>
                            <td style={{ padding: '0.35rem' }}>
                              {formatarMoeda(it.custoUnitarioCentavos)}
                            </td>
                            <td style={{ padding: '0.35rem' }}>
                              <span
                                style={{
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: 3,
                                  fontSize: '0.7rem',
                                  background: abaixoMinimo ? '#8E1F1A' : '#3E7C68',
                                  color: '#FFF',
                                }}
                              >
                                {abaixoMinimo ? '⚠️ Abaixo do Mínimo' : '✓ Normal'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Últimos Movimentos */}
                <div
                  style={{
                    background: 'rgba(255,255,255,0.45)',
                    border: '1px solid var(--bronze)',
                    borderRadius: 6,
                    padding: '0.9rem',
                  }}
                >
                  <strong style={{ fontSize: '0.88rem' }}>
                    📜 Últimas Movimentações ({dump.movimentos.length})
                  </strong>
                  <div
                    data-testid="lista-movimentos-estoque"
                    style={{
                      marginTop: '0.45rem',
                      maxHeight: 190,
                      overflowY: 'auto',
                      fontSize: '0.78rem',
                    }}
                  >
                    {dump.movimentos
                      .filter((m) => m.arquivadoEm === null)
                      .slice(-12)
                      .reverse()
                      .map((m) => {
                        const it = itensAtivos.find((i) => i.id === m.itemId);
                        const ar = armazensAtivos.find((a) => a.id === m.armazemId);
                        return (
                          <div
                            key={m.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '0.25rem 0',
                              borderBottom: '1px dashed rgba(122,90,43,0.2)',
                            }}
                          >
                            <span>
                              <strong>{m.tipo.toUpperCase()}</strong> · {m.quantidade}{' '}
                              {it?.unidade ?? 'un'} de <strong>{it?.nome ?? 'Item'}</strong>{' '}
                              em {ar?.nome ?? 'Armazém'}
                            </span>
                            <span>{formatarData(m.data)}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {abaAtiva === 'cadastros' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
              }}
            >
              {/* Coluna 1: Fornecedores */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.45)',
                  border: '1px solid var(--bronze)',
                  borderRadius: 6,
                  padding: '0.85rem',
                }}
              >
                <strong style={{ fontSize: '0.9rem' }}>
                  🤝 Fornecedores ({fornecedoresAtivos.length})
                </strong>
                <form
                  onSubmit={(e) => void handleCriarFornecedor(e)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                    marginTop: '0.5rem',
                    marginBottom: '0.8rem',
                  }}
                >
                  <input
                    type="text"
                    data-testid="input-nome-fornecedor"
                    className="input-texto"
                    placeholder="Nome do fornecedor"
                    value={nomeFornecedor}
                    onChange={(e) => setNomeFornecedor(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      type="text"
                      data-testid="input-contato-fornecedor"
                      className="input-texto"
                      placeholder="Contato"
                      value={contatoFornecedor}
                      onChange={(e) => setContatoFornecedor(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number"
                      data-testid="input-prazo-fornecedor"
                      className="input-texto"
                      placeholder="Prazo (d)"
                      value={prazoFornecedor}
                      onChange={(e) => setPrazoFornecedor(e.target.value)}
                      style={{ width: 80 }}
                    />
                  </div>
                  <button
                    type="submit"
                    data-testid="botao-criar-fornecedor"
                    className="botao-campanha botao-campanha-ouro"
                  >
                    + Cadastrar Fornecedor
                  </button>
                </form>

                <div style={{ fontSize: '0.78rem' }}>
                  {fornecedoresAtivos.map((f) => (
                    <div
                      key={f.id}
                      style={{
                        padding: '0.3rem 0',
                        borderBottom: '1px solid rgba(122,90,43,0.15)',
                      }}
                    >
                      <strong>{f.nome}</strong> · Entrega: {f.prazoEntregaDias}d
                    </div>
                  ))}
                </div>
              </div>

              {/* Coluna 2: Armazéns */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.45)',
                  border: '1px solid var(--bronze)',
                  borderRadius: 6,
                  padding: '0.85rem',
                }}
              >
                <strong style={{ fontSize: '0.9rem' }}>
                  🏯 Armazéns ({armazensAtivos.length})
                </strong>
                <form
                  onSubmit={(e) => void handleCriarArmazem(e)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                    marginTop: '0.5rem',
                    marginBottom: '0.8rem',
                  }}
                >
                  <input
                    type="text"
                    data-testid="input-nome-armazem"
                    className="input-texto"
                    placeholder="Nome do armazém"
                    value={nomeArmazem}
                    onChange={(e) => setNomeArmazem(e.target.value)}
                  />
                  <input
                    type="text"
                    data-testid="input-local-armazem"
                    className="input-texto"
                    placeholder="Localização / Província"
                    value={localArmazem}
                    onChange={(e) => setLocalArmazem(e.target.value)}
                  />
                  <button
                    type="submit"
                    data-testid="botao-criar-armazem"
                    className="botao-campanha botao-campanha-ouro"
                  >
                    + Cadastrar Armazém
                  </button>
                </form>

                <div style={{ fontSize: '0.78rem' }}>
                  {armazensAtivos.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: '0.3rem 0',
                        borderBottom: '1px solid rgba(122,90,43,0.15)',
                      }}
                    >
                      <strong>{a.nome}</strong> ({a.local})
                    </div>
                  ))}
                </div>
              </div>

              {/* Coluna 3: Catálogo de Itens */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.45)',
                  border: '1px solid var(--bronze)',
                  borderRadius: 6,
                  padding: '0.85rem',
                }}
              >
                <strong style={{ fontSize: '0.9rem' }}>
                  🔩 Catálogo de Itens ({itensAtivos.length})
                </strong>
                <form
                  onSubmit={(e) => void handleCriarItem(e)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                    marginTop: '0.5rem',
                    marginBottom: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      type="text"
                      data-testid="input-nome-item"
                      className="input-texto"
                      placeholder="Nome do item"
                      value={nomeItem}
                      onChange={(e) => setNomeItem(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="text"
                      data-testid="input-unidade-item"
                      className="input-texto"
                      placeholder="Un."
                      value={unidadeItem}
                      onChange={(e) => setUnidadeItem(e.target.value)}
                      style={{ width: 65 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      type="number"
                      data-testid="input-custo-item"
                      className="input-texto"
                      placeholder="Custo R$"
                      value={custoItemReais}
                      onChange={(e) => setCustoItemReais(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number"
                      data-testid="input-minimo-item"
                      className="input-texto"
                      placeholder="Mínimo"
                      value={estoqueMinimoItem}
                      onChange={(e) => setEstoqueMinimoItem(e.target.value)}
                      style={{ width: 85 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <select
                      data-testid="select-fornecedor-item"
                      className="input-texto"
                      value={fornecedorItemId}
                      onChange={(e) => setFornecedorItemId(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">Sem fornecedor fixo</option>
                      {fornecedoresAtivos.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nome}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input-texto"
                      value={tipoItem}
                      onChange={(e) =>
                        setTipoItem(e.target.value as 'insumo' | 'equipamento')
                      }
                      style={{ width: 110 }}
                    >
                      <option value="insumo">Insumo</option>
                      <option value="equipamento">Equipamento</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    data-testid="botao-criar-item"
                    className="botao-campanha botao-campanha-ouro"
                  >
                    + Cadastrar Item
                  </button>
                </form>

                <div style={{ fontSize: '0.78rem', maxHeight: 160, overflowY: 'auto' }}>
                  {itensAtivos.map((it) => (
                    <div
                      key={it.id}
                      style={{
                        padding: '0.3rem 0',
                        borderBottom: '1px solid rgba(122,90,43,0.15)',
                      }}
                    >
                      <strong>{it.nome}</strong> ({it.unidade}) ·{' '}
                      {formatarMoeda(it.custoUnitarioCentavos)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {abaAtiva === 'bom_compras' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1.25rem',
              }}
            >
              {/* Esquerda: Lista de Materiais (BOM) por Cidade */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.45)',
                  border: '1px solid var(--bronze)',
                  borderRadius: 6,
                  padding: '0.9rem',
                }}
              >
                <strong style={{ fontSize: '0.9rem' }}>
                  📋 Lista de Materiais (BOM) das Cidades
                </strong>

                <form
                  onSubmit={(e) => void handleAdicionarBom(e)}
                  style={{
                    display: 'flex',
                    gap: '0.4rem',
                    marginTop: '0.5rem',
                    marginBottom: '0.8rem',
                  }}
                >
                  <select
                    data-testid="select-bom-projeto"
                    className="input-texto"
                    value={bomProjetoId}
                    onChange={(e) => setBomProjetoId(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">Cidade...</option>
                    {projetosAtivos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>

                  <select
                    data-testid="select-bom-item"
                    className="input-texto"
                    value={bomItemId}
                    onChange={(e) => setBomItemId(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">Item...</option>
                    {itensAtivos.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.nome}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    data-testid="input-bom-quantidade"
                    className="input-texto"
                    value={bomQuantidade}
                    onChange={(e) => setBomQuantidade(e.target.value)}
                    style={{ width: 70 }}
                  />

                  <button
                    type="submit"
                    data-testid="botao-adicionar-bom-global"
                    className="botao-campanha botao-campanha-ouro"
                  >
                    + BOM
                  </button>
                </form>

                <div style={{ fontSize: '0.8rem' }}>
                  {dump.itensDeLista
                    .filter((il) => il.arquivadoEm === null)
                    .map((il) => {
                      const proj = projetosAtivos.find((p) => p.id === il.projetoId);
                      const it = itensAtivos.find((i) => i.id === il.itemId);
                      const coberto = il.status !== 'falta';
                      return (
                        <div
                          key={il.id}
                          data-testid={`item-bom-global-${il.id}`}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.35rem 0',
                            borderBottom: '1px solid rgba(122,90,43,0.15)',
                          }}
                        >
                          <span>
                            <strong>{proj?.nome ?? 'Cidade'}</strong>: precisa de{' '}
                            <strong>
                              {il.quantidade} {it?.unidade ?? 'un'}
                            </strong>{' '}
                            de {it?.nome ?? 'Item'}
                          </span>
                          <span
                            data-testid={`status-bom-global-${il.id}`}
                            style={{
                              padding: '0.1rem 0.4rem',
                              borderRadius: 3,
                              fontSize: '0.7rem',
                              background: coberto ? '#3E7C68' : '#8E1F1A',
                              color: '#FFF',
                            }}
                          >
                            {coberto ? '✓ Coberto' : '⚠️ Em Falta'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Direita: Compra Sugerida Consolidada por Fornecedor */}
              <div
                data-testid="secao-compra-sugerida-global"
                style={{
                  background: 'rgba(255,255,255,0.45)',
                  border: '1px solid var(--bronze)',
                  borderRadius: 6,
                  padding: '0.9rem',
                }}
              >
                <strong style={{ fontSize: '0.9rem' }}>
                  🛒 Compra Sugerida Consolidada ({listaCompraSugerida.length})
                </strong>

                {listaCompraSugerida.length === 0 ? (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      fontSize: '0.82rem',
                      color: '#3E7C68',
                      fontWeight: 600,
                    }}
                  >
                    ✓ Todos os estoques mínimos e listas de materiais estão cobertos!
                  </div>
                ) : (
                  <div
                    data-testid="lista-compra-sugerida-itens"
                    style={{
                      marginTop: '0.6rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    {listaCompraSugerida.map((sug) => (
                      <div
                        key={sug.item.id}
                        data-testid={`compra-sugerida-item-${sug.item.id}`}
                        style={{
                          padding: '0.55rem 0.7rem',
                          background: 'rgba(142, 31, 26, 0.08)',
                          borderLeft: '4px solid #8E1F1A',
                          borderRadius: 4,
                          fontSize: '0.8rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontWeight: 700,
                          }}
                        >
                          <span>
                            Comprar {sug.quantidadeComprar} {sug.item.unidade} de{' '}
                            {sug.item.nome}
                          </span>
                          <span>{formatarMoeda(sug.custoTotalCentavos)}</span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: '#5A554E',
                            marginTop: '0.2rem',
                          }}
                        >
                          Disponível: {sug.saldoDisponivel} · Necessário:{' '}
                          {sug.necessarioTotal} · Fornecedor:{' '}
                          <strong>
                            {sug.fornecedor
                              ? `${sug.fornecedor.nome} (${sug.fornecedor.prazoEntregaDias}d)`
                              : 'Não vinculado'}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
