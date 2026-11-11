import * as THREE from 'three';

export interface PropsMercado {
  barrisInstancias: THREE.InstancedMesh;
  caixasInstancias: THREE.InstancedMesh;
  toldosInstancias: THREE.InstancedMesh;
  sistemaPoeiraRua: THREE.Points;
}

/**
 * Cria props de mercado (barris, caixas, toldos de tecido) e partículas de poeira nas ruas (Seção 5.5).
 */
export function criarPropsEParticulasMercado(cena: THREE.Scene): PropsMercado {
  // 1. Barris instanciados (cilindros com anéis)
  const geoBarril = new THREE.CylinderGeometry(0.7, 0.8, 1.6, 8);
  const matBarril = new THREE.MeshStandardMaterial({
    color: '#7A5A2B',
    roughness: 0.85,
    metalness: 0.15,
  });
  const barrisInstancias = new THREE.InstancedMesh(geoBarril, matBarril, 120);
  barrisInstancias.name = 'props-barris';
  barrisInstancias.frustumCulled = false;
  barrisInstancias.castShadow = true;
  cena.add(barrisInstancias);

  // 2. Caixas de mercadoria instanciadas
  const geoCaixa = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const matCaixa = new THREE.MeshStandardMaterial({
    color: '#9C7A4A',
    roughness: 0.9,
    metalness: 0.05,
  });
  const caixasInstancias = new THREE.InstancedMesh(geoCaixa, matCaixa, 160);
  caixasInstancias.name = 'props-caixas';
  caixasInstancias.frustumCulled = false;
  caixasInstancias.castShadow = true;
  cena.add(caixasInstancias);

  // 3. Toldos de tecido
  const geoToldo = new THREE.ConeGeometry(2.4, 0.8, 4);
  geoToldo.rotateY(Math.PI * 0.25);
  const matToldo = new THREE.MeshStandardMaterial({
    color: '#8E1F1A',
    roughness: 0.7,
  });
  const toldosInstancias = new THREE.InstancedMesh(geoToldo, matToldo, 80);
  toldosInstancias.name = 'props-toldos';
  toldosInstancias.frustumCulled = false;
  cena.add(toldosInstancias);

  // 4. Partículas de poeira nas ruas movimentadas
  const qtdParticulas = 300;
  const geoParticulas = new THREE.BufferGeometry();
  const posicoes = new Float32Array(qtdParticulas * 3);
  for (let i = 0; i < qtdParticulas; i++) {
    const ang = Math.random() * Math.PI * 2;
    const raio = 30 + Math.random() * 90;
    posicoes[i * 3] = Math.cos(ang) * raio;
    posicoes[i * 3 + 1] = 0.4 + Math.random() * 2.5;
    posicoes[i * 3 + 2] = Math.sin(ang) * raio;
  }
  geoParticulas.setAttribute('position', new THREE.BufferAttribute(posicoes, 3));
  const matParticulas = new THREE.PointsMaterial({
    color: '#E8DCC0',
    size: 1.2,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const sistemaPoeiraRua = new THREE.Points(geoParticulas, matParticulas);
  sistemaPoeiraRua.name = 'particulas-poeira-ruas';
  cena.add(sistemaPoeiraRua);

  return {
    barrisInstancias,
    caixasInstancias,
    toldosInstancias,
    sistemaPoeiraRua,
  };
}
