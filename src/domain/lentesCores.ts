import type {
  Aplicacao,
  Cliente,
  ItemDeLista,
  LenteMapa,
  Ligacao,
  Projeto,
  UUID,
  VinculoCliente,
} from './entidades';

export const CORES_PALETA_MARCHA = {
  jade: '#3E7C68', // Saudável / Lucrativo / Baixo Risco / 100% Coberto
  ambar: '#D09B2C', // Atenção / Parcial / Médio Risco
  laca: '#8E1F1A', // Crítico / Prejuízo / Alto Risco / Falta
  ouro: '#B8923A', // Hub central / Conexão especial
  celeste: '#2B6CB0', // Tecnologia Aplicada (P&D)
  pedra: '#5A554E', // Ruínas / Isolado / Sem tecnologia
  neutroCinza: '#7B7468', // Neutro / Sem dados / Sem clientes / Sem BOM
};

export interface InfoResumoDerivadoLente {
  pontuacaoSaude?: number;
  liquidoMesCentavos?: number;
  horasRegistradasSemana?: number;
  concentracaoRisco?: number;
}

export interface DadosContextoLente {
  lente: LenteMapa;
  derivadosPorProjeto: Map<UUID, InfoResumoDerivadoLente>;
  ligacoes?: Ligacao[];
  clientes?: Cliente[];
  vinculosCliente?: VinculoCliente[];
  itensLista?: ItemDeLista[];
  aplicacoes?: Aplicacao[];
  horasRegistradasPorProjeto?: Map<UUID, number>;
  hoje?: string;
}

/**
 * Calcula a cor hexadecimal de uma cidade com base na lente ativa do mapa,
 * respeitando os princípios das Seções 4.6 e 6.7.
 */
export function calcularCorCidadePorLente(
  projeto: Projeto,
  contexto: DadosContextoLente
): string {
  const estaArquivado = projeto.arquivadoEm !== null;
  if (estaArquivado) {
    return CORES_PALETA_MARCHA.pedra;
  }

  const derivado = contexto.derivadosPorProjeto.get(projeto.id);

  switch (contexto.lente) {
    case 'padrao': {
      const saude = derivado?.pontuacaoSaude ?? 100;
      if (saude >= 70) return CORES_PALETA_MARCHA.jade;
      if (saude >= 40) return CORES_PALETA_MARCHA.ambar;
      return CORES_PALETA_MARCHA.laca;
    }

    case 'financas': {
      const liquido = derivado?.liquidoMesCentavos ?? 0;
      if (liquido > 0) return CORES_PALETA_MARCHA.jade;
      if (liquido === 0) return CORES_PALETA_MARCHA.ambar;
      return CORES_PALETA_MARCHA.laca;
    }

    case 'tempo': {
      const alvo = projeto.horasAlvoSemana;
      const registradas =
        contexto.horasRegistradasPorProjeto?.get(projeto.id) ??
        derivado?.horasRegistradasSemana ??
        0;

      if (alvo === 0) {
        return registradas > 0
          ? CORES_PALETA_MARCHA.jade
          : CORES_PALETA_MARCHA.neutroCinza;
      }
      if (registradas >= alvo) return CORES_PALETA_MARCHA.jade;
      if (registradas >= alvo * 0.5) return CORES_PALETA_MARCHA.ambar;
      if (registradas > 0) return CORES_PALETA_MARCHA.ouro;
      return CORES_PALETA_MARCHA.laca;
    }

    case 'rede': {
      const ligacoes = contexto.ligacoes ?? [];
      const conexoes = ligacoes.filter(
        (l) =>
          l.arquivadoEm === null &&
          (l.origemId === projeto.id || l.destinoId === projeto.id)
      ).length;

      if (conexoes >= 2) return CORES_PALETA_MARCHA.ouro;
      if (conexoes === 1) return CORES_PALETA_MARCHA.jade;
      return CORES_PALETA_MARCHA.pedra;
    }

    case 'risco': {
      let concentracao = derivado?.concentracaoRisco ?? 0;
      const vinculos = (contexto.vinculosCliente ?? []).filter(
        (v) => v.arquivadoEm === null && v.projetoId === projeto.id
      );
      if (vinculos.length === 1 && vinculos[0]!.receitaRecorrenteCentavos > 0) {
        concentracao = Math.max(concentracao, 1.0);
      } else if (vinculos.length > 1) {
        const total = vinculos.reduce((acc, v) => acc + v.receitaRecorrenteCentavos, 0);
        const maior = Math.max(...vinculos.map((v) => v.receitaRecorrenteCentavos));
        if (total > 0) {
          concentracao = Math.max(concentracao, maior / total);
        }
      }
      if (concentracao > 0.5) return CORES_PALETA_MARCHA.laca;
      if (concentracao > 0.25) return CORES_PALETA_MARCHA.ambar;
      return CORES_PALETA_MARCHA.jade;
    }

    case 'clientes': {
      const vinculos = (contexto.vinculosCliente ?? []).filter(
        (v) => v.arquivadoEm === null && v.projetoId === projeto.id
      );
      if (vinculos.length === 0) return CORES_PALETA_MARCHA.neutroCinza;

      const clientesMap = new Map((contexto.clientes ?? []).map((c) => [c.id, c]));
      const hoje = contexto.hoje ? new Date(contexto.hoje).getTime() : Date.now();

      let piorDiferencaDias = 0;
      let temClienteSemContato = false;

      for (const vinc of vinculos) {
        const cliente = clientesMap.get(vinc.clienteId);
        if (!cliente || !cliente.ultimoContato) {
          temClienteSemContato = true;
          break;
        }
        const dataContato = new Date(cliente.ultimoContato).getTime();
        const dias = Math.floor((hoje - dataContato) / (1000 * 60 * 60 * 24));
        if (dias > piorDiferencaDias) {
          piorDiferencaDias = dias;
        }
      }

      if (temClienteSemContato || piorDiferencaDias > 60) {
        return CORES_PALETA_MARCHA.laca;
      }
      if (piorDiferencaDias >= 30) {
        return CORES_PALETA_MARCHA.ambar;
      }
      return CORES_PALETA_MARCHA.jade;
    }

    case 'estoque': {
      const itensProjeto = (contexto.itensLista ?? []).filter(
        (i) => i.arquivadoEm === null && i.projetoId === projeto.id
      );
      if (itensProjeto.length === 0) return CORES_PALETA_MARCHA.neutroCinza;

      const temFalta = itensProjeto.some((i) => i.status === 'falta');
      return temFalta ? CORES_PALETA_MARCHA.laca : CORES_PALETA_MARCHA.jade;
    }

    case 'pd': {
      const temAplicacao = (contexto.aplicacoes ?? []).some(
        (a) => a.arquivadoEm === null && a.projetoId === projeto.id
      );
      return temAplicacao ? CORES_PALETA_MARCHA.celeste : CORES_PALETA_MARCHA.pedra;
    }

    default:
      return CORES_PALETA_MARCHA.jade;
  }
}
