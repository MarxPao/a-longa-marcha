import React, { useEffect, useRef } from 'react';
import { MapView } from '../map';
import { useTerrenoFase0Store } from '../store';
import { PainelTerrenoFase0 } from '../ui';

/**
 * Camada de composição `app`: conecta `store`, `ui` e `map` sem violar o isolamento entre `ui` e `map`.
 */
export function App(): React.JSX.Element {
  const containerMapaRef = useRef<HTMLDivElement | null>(null);
  const mapViewRef = useRef<MapView | null>(null);
  const semente = useTerrenoFase0Store((s) => s.semente);
  const atualizarMetricasMalha = useTerrenoFase0Store((s) => s.atualizarMetricasMalha);

  useEffect(() => {
    const elemento = containerMapaRef.current;
    if (!elemento) return;

    const instancia = new MapView({
      container: elemento,
      sementeInicial: useTerrenoFase0Store.getState().semente,
      aoAtualizarTerreno: (metricas) => {
        atualizarMetricasMalha(metricas);
      },
    });
    mapViewRef.current = instancia;

    return () => {
      instancia.destruir();
      mapViewRef.current = null;
    };
  }, [atualizarMetricasMalha]);

  useEffect(() => {
    if (mapViewRef.current) {
      void mapViewRef.current.aplicarSemente(semente);
    }
  }, [semente]);

  return (
    <PainelTerrenoFase0>
      <div
        ref={containerMapaRef}
        data-testid="container-mapa-3d"
        style={{ width: '100%', height: '100%' }}
      />
    </PainelTerrenoFase0>
  );
}
