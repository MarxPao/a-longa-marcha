/**
 * Ganchos de eventos sonoros da campanha (Seção 9.1: "sem som na v1, com ganchos prontos no código").
 * Permite registrar ouvintes customizados para testes ou futura trilha sonora sem alterar componentes.
 */
export type TipoEventoSonoro =
  | 'fechar_turno'
  | 'promocao_cidade'
  | 'alerta_critico'
  | 'clique_selo'
  | 'conquista_desbloqueada';

type OuvinteSom = (evento: TipoEventoSonoro) => void;

const ouvintesRegistrados = new Set<OuvinteSom>();
const historicoEventosSonoros: TipoEventoSonoro[] = [];

export function emitirEventoSonoro(evento: TipoEventoSonoro): void {
  historicoEventosSonoros.push(evento);
  if (historicoEventosSonoros.length > 50) {
    historicoEventosSonoros.shift();
  }
  for (const fn of ouvintesRegistrados) {
    fn(evento);
  }
}

export function registrarOuvinteSonoro(fn: OuvinteSom): () => void {
  ouvintesRegistrados.add(fn);
  return () => ouvintesRegistrados.delete(fn);
}

export function obterHistoricoGanchosSonoros(): readonly TipoEventoSonoro[] {
  return historicoEventosSonoros;
}
