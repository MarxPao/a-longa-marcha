export function formatarMoeda(centavos: number): string {
  const reais = centavos / 100;
  return reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatarHoras(horas: number): string {
  return `${horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
}

export function formatarPercentual(fator: number): string {
  const pct = Math.round(fator * 100);
  return `${pct}%`;
}

export function formatarData(dataIso: string): string {
  if (!dataIso) return '-';
  const partes = dataIso.slice(0, 10).split('-');
  if (partes.length !== 3) return dataIso;
  const [ano, mes, dia] = partes;
  const meses = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ];
  const mesNum = parseInt(mes ?? '1', 10) - 1;
  const mesNome = meses[mesNum] ?? mes;
  return `${dia} de ${mesNome}. de ${ano}`;
}

export interface InfoSaude {
  texto: 'Saudável' | 'Atenção' | 'Crítico';
  cor: string;
  icone: string;
  forma: string;
}

export function obterInfoSaude(saude: number): InfoSaude {
  if (saude >= 70) {
    return {
      texto: 'Saudável',
      cor: '#3E7C68', // --jade
      icone: '🛡️',
      forma: 'Bandeira erguida',
    };
  }
  if (saude >= 40) {
    return {
      texto: 'Atenção',
      cor: '#B8923A', // --ouro
      icone: '⚠️',
      forma: 'Bandeira caída',
    };
  }
  return {
    texto: 'Crítico',
    cor: '#8E1F1A', // --laca
    icone: '🔥',
    forma: 'Fumaça de alarme',
  };
}

export interface InfoFase {
  nivel: number;
  nome: string;
  icone: string;
}

export function obterInfoFase(fase: number): InfoFase {
  switch (fase) {
    case 1:
      return { nivel: 1, nome: 'Faísca', icone: '⛺' };
    case 2:
      return { nivel: 2, nome: 'Expedição', icone: '🪵' };
    case 3:
      return { nivel: 3, nome: 'Assentamento', icone: '🚩' };
    case 4:
      return { nivel: 4, nome: 'Vila', icone: '🏯' };
    case 5:
      return { nivel: 5, nome: 'Cidade', icone: '🏮' };
    case 6:
      return { nivel: 6, nome: 'Metrópole', icone: '👑' };
    case 7:
      return { nivel: 7, nome: 'Legado', icone: '✨' };
    case 0:
    default:
      return { nivel: 0, nome: 'Ruínas', icone: '🏚️' };
  }
}
