import * as THREE from 'three';

/**
 * Cria textura procedural de ruído perlin/simplex 2D para microvariação de relevo e desgaste.
 */
export function criarTexturaRuidoProcedural(tamanho = 256): THREE.DataTexture {
  const data = new Uint8Array(tamanho * tamanho * 4);
  let p = 0;
  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      const nx = x / tamanho;
      const ny = y / tamanho;
      const val = Math.floor(
        (Math.sin(nx * 24.0) * Math.cos(ny * 24.0) * 0.5 + 0.5) * 255
      );
      data[p] = val; // R
      data[p + 1] = val; // G
      data[p + 2] = val; // B
      data[p + 3] = 255; // A
      p += 4;
    }
  }
  const tex = new THREE.DataTexture(data, tamanho, tamanho, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Cria textura procedural de normais para solo de pergaminho/terra.
 */
export function criarNormalMapProcedural(tamanho = 256): THREE.DataTexture {
  const data = new Uint8Array(tamanho * tamanho * 4);
  let p = 0;
  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      const dx = Math.sin((x / tamanho) * Math.PI * 8.0) * 0.15;
      const dy = Math.cos((y / tamanho) * Math.PI * 8.0) * 0.15;
      const nx = Math.floor((dx + 1.0) * 0.5 * 255);
      const ny = Math.floor((dy + 1.0) * 0.5 * 255);
      const nz = 255;

      data[p] = nx;
      data[p + 1] = ny;
      data[p + 2] = nz;
      data[p + 3] = 255;
      p += 4;
    }
  }
  const tex = new THREE.DataTexture(data, tamanho, tamanho, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Cria textura procedural de paralelepípedo para ruas pavimentadas (Seção 5.3).
 */
export function criarTexturaPavimentoRuas(tamanho = 256): THREE.DataTexture {
  const data = new Uint8Array(tamanho * tamanho * 4);
  let p = 0;
  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      const gradeX = x % 16;
      const gradeY = y % 8;
      const borda = gradeX === 0 || gradeY === 0;
      const corBase = borda ? 55 : 120 + Math.floor(Math.random() * 25);

      data[p] = corBase;
      data[p + 1] = Math.floor(corBase * 0.95);
      data[p + 2] = Math.floor(corBase * 0.85);
      data[p + 3] = 255;
      p += 4;
    }
  }
  const tex = new THREE.DataTexture(data, tamanho, tamanho, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 16);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Modifica o shader de um material standard para suportar variação HSL por instância
 * e animação de vento suave no vertex shader (Seção 5.3 & 5.5).
 */
export function customizarShaderPbrInstanciado(
  material: THREE.MeshStandardMaterial,
  opcoes?: { vento?: boolean; emissivoJanela?: boolean }
): void {
  material.onBeforeCompile = (shader) => {
    if (opcoes?.vento) {
      shader.vertexShader = `
        uniform float tempoAnimacao;
        ${shader.vertexShader}
      `;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        // Balanço suave de vento proporcional à altura Y
        float alturaFator = clamp(position.y * 0.15, 0.0, 1.0);
        transformed.x += sin(tempoAnimacao * 2.2 + position.z * 0.5) * 0.35 * alturaFator;
        transformed.z += cos(tempoAnimacao * 1.8 + position.x * 0.5) * 0.25 * alturaFator;
        `
      );
    }

    if (opcoes?.emissivoJanela) {
      shader.fragmentShader = `
        uniform float intensidadeEmissivaJanelas;
        ${shader.fragmentShader}
      `;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `
        #include <emissivemap_fragment>
        totalEmissiveRadiance *= (1.0 + intensidadeEmissivaJanelas * 2.0);
        `
      );
    }
  };
}

/**
 * Cria material avançado de terreno estilo Total War: Three Kingdoms com splatting procedural:
 * - Penhascos rochosos calcários verticais baseados na inclinação (slope = 1.0 - normal.y);
 * - Planícies e vales em tons dourados de outono e pergaminho;
 * - Talhões agrícolas em faixas (crop furrows);
 * - Areia nas margens do rio;
 * - Degradação em tinta sumi-ê nas bordas do mapa de campanha.
 */
export function criarMaterialTerrenoTotalWar(opcoes?: {
  raioMapa?: number;
}): THREE.MeshStandardMaterial {
  const texRuido = criarTexturaRuidoProcedural(512);
  const texNormal = criarNormalMapProcedural(512);
  texRuido.repeat.set(32, 32);
  texNormal.repeat.set(32, 32);

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.05,
    roughnessMap: texRuido,
    normalMap: texNormal,
    normalScale: new THREE.Vector2(0.4, 0.4),
  });

  const rMapa = opcoes?.raioMapa ?? 840;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRaioMapa = { value: rMapa };
    shader.uniforms.uTempo = { value: 0 };

    shader.vertexShader = `
      varying vec3 vPosicaoMundo;
      varying vec3 vNormalMundo;
      ${shader.vertexShader}
    `;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      vPosicaoMundo = (modelMatrix * vec4(position, 1.0)).xyz;
      vNormalMundo = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      `
    );

    shader.fragmentShader = `
      uniform float uRaioMapa;
      uniform float uTempo;
      varying vec3 vPosicaoMundo;
      varying vec3 vNormalMundo;
      ${shader.fragmentShader}
    `;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>

      // 1. Inclinação (slope) no espaço de mundo
      float normalY = clamp(vNormalMundo.y, 0.0, 1.0);
      float slope = 1.0 - normalY;

      // 2. Rocha calcária escarpada dos picos de Karst (estrias verticais)
      float estriaVertical = sin(vPosicaoMundo.y * 1.8 + sin(vPosicaoMundo.x * 0.15 + vPosicaoMundo.z * 0.15) * 2.0) * 0.5 + 0.5;
      vec3 corRochaBase = vec3(0.55, 0.52, 0.48); // Calcário cinza-arenoso
      vec3 corRochaEscura = vec3(0.32, 0.29, 0.26); // Fendas de sombra
      vec3 corRocha = mix(corRochaBase, corRochaEscura, estriaVertical * 0.65);

      // Fator de rocha suave com início em inclinações > 22°
      float fatorRocha = smoothstep(0.18, 0.42, slope);

      // 3. Talhões agrícolas / campos cultivados em vales suaves (Golden crops)
      float sulcoAgricola = sin(vPosicaoMundo.x * 0.45 + vPosicaoMundo.z * 0.25) * 0.5 + 0.5;
      vec3 corCampoDourado = vec3(0.78, 0.66, 0.35); // Trigo dourado / outono
      vec3 corCampoVerde = vec3(0.52, 0.60, 0.34); // Pasto de outono

      // Aplica agricultura preferencialmente em áreas planas de altitude baixa/média
      float ehPlano = 1.0 - smoothstep(0.04, 0.16, slope);
      float emAltitudeAgricola = smoothstep(0.1, 1.2, vPosicaoMundo.y) * (1.0 - smoothstep(4.0, 9.0, vPosicaoMundo.y));
      float fatorCampo = ehPlano * emAltitudeAgricola * smoothstep(0.4, 0.7, sulcoAgricola);

      // 4. Areia nas margens de rio e depressões baixas
      vec3 corAreiaPraia = vec3(0.82, 0.74, 0.58);
      float fatorAreia = (1.0 - smoothstep(0.0, 0.65, vPosicaoMundo.y)) * (1.0 - smoothstep(0.15, 0.35, slope));

      // 5. Composição do solo
      vec3 corFinalSolo = diffuseColor.rgb;
      corFinalSolo = mix(corFinalSolo, corCampoDourado, fatorCampo * 0.65);
      corFinalSolo = mix(corFinalSolo, corAreiaPraia, fatorAreia * 0.85);
      corFinalSolo = mix(corFinalSolo, corRocha, fatorRocha);

      // 6. Vinheta de tinta sumi-ê nas bordas do mapa de campanha
      float distOrigem = length(vPosicaoMundo.xz);
      float tBorda = smoothstep(uRaioMapa * 0.85, uRaioMapa * 1.15, distOrigem);
      vec3 corTinta = vec3(0.12, 0.11, 0.09);
      corFinalSolo = mix(corFinalSolo, corTinta, tBorda * 0.85);

      diffuseColor.rgb = corFinalSolo;
      `
    );
  };

  return material;
}


/**
 * Garante que uma BufferGeometry possua o atributo 'color'.
 * Se ausente, preenche com branco puro [1.0, 1.0, 1.0] para que shaders com vertexColors
 * nunca multipliquem o albedo por zero (Seção 2 - Passo Zero).
 */
export function garantirAtributoCorGeometria(geometria: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geometria.getAttribute('color')) {
    const pos = geometria.getAttribute('position');
    if (pos) {
      const cores = new Float32Array(pos.count * 3).fill(1.0);
      geometria.setAttribute('color', new THREE.BufferAttribute(cores, 3));
    }
  }
  return geometria;
}

/**
 * Aplica uma cor de vértice uniforme a uma geometria (garantindo albedo mínimo #2A2420).
 */
export function colorirGeometriaModular(
  geo: THREE.BufferGeometry,
  corHex: string
): THREE.BufferGeometry {
  const naoIndexada = geo.index ? geo.toNonIndexed() : geo.clone();
  const pos = naoIndexada.attributes.position;
  if (!pos) return naoIndexada;

  const c = new THREE.Color(corHex);
  // Albedo mínimo de segurança para que nada fique preto (Seção 4: mínimo #2A2420)
  c.r = Math.max(0.165, c.r);
  c.g = Math.max(0.141, c.g);
  c.b = Math.max(0.125, c.b);

  const cores = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    cores[i * 3] = c.r;
    cores[i * 3 + 1] = c.g;
    cores[i * 3 + 2] = c.b;
  }
  naoIndexada.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  return naoIndexada;
}

/**
 * Estrutura da Folha de Texturas (Trim Sheet) canônica PBR para edifícios (Seção 4 - H1).
 * Faixas verticais (1024x1024):
 * 1. Madeira escura (#56402E) [y: 0..255]
 * 2. Reboco claro / calcário (#D8CEBC) [y: 256..511]
 * 3. Telha cerâmica cinza-azulada (#2F353B) [y: 512..767]
 * 4. Pedra de cantaria (#8A8275) [y: 768..895]
 * 5. Tecidos e toldos (laca, jade, palha) [y: 896..1023]
 */
export interface TrimSheetEdificios {
  albedo: THREE.DataTexture;
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
}

let trimSheetCache: TrimSheetEdificios | null = null;

export function obterTrimSheetCanonica(tamanho = 1024): TrimSheetEdificios {
  if (trimSheetCache) return trimSheetCache;

  const dataAlbedo = new Uint8Array(tamanho * tamanho * 4);
  const dataNormal = new Uint8Array(tamanho * tamanho * 4);
  const dataRoughness = new Uint8Array(tamanho * tamanho * 4);

  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      const idx = (y * tamanho + x) * 4;
      let r = 200, g = 200, b = 200;
      let nx = 128, ny = 128, nz = 255;
      let rough = 210;

      if (y < 256) {
        // Faixa 1: Madeira Escura Han (#56402E -> 86, 64, 46) com veios orgânicos
        const fibra = Math.sin(y * 0.8 + Math.sin(x * 0.05) * 4.0) * 0.5 + 0.5;
        const ruido = Math.sin(x * 0.4 + y * 0.1) * 0.5 + 0.5;
        const delta = (fibra * 0.6 + ruido * 0.4 - 0.5) * 24; // variação albedo > ±6%
        r = Math.max(42, Math.min(125, Math.floor(86 + delta)));
        g = Math.max(36, Math.min(100, Math.floor(64 + delta * 0.8)));
        b = Math.max(32, Math.min(80, Math.floor(46 + delta * 0.6)));

        nx = Math.floor(128 + (fibra - 0.5) * 35);
        ny = Math.floor(128 + (ruido - 0.5) * 25);
        rough = Math.floor(200 + (1.0 - fibra) * 35);
      } else if (y < 512) {
        // Faixa 2: Reboco Claro / Taipa (#D8CEBC -> 216, 206, 188) com micro-relevo
        const grao = Math.sin(x * 1.5) * Math.cos(y * 1.5) * 0.5 + 0.5;
        const espatula = Math.sin(x * 0.08 + y * 0.06) * 0.5 + 0.5;
        const delta = (grao * 0.5 + espatula * 0.5 - 0.5) * 28;
        r = Math.max(160, Math.min(240, Math.floor(216 + delta)));
        g = Math.max(150, Math.min(230, Math.floor(206 + delta)));
        b = Math.max(135, Math.min(215, Math.floor(188 + delta)));

        nx = Math.floor(128 + (grao - 0.5) * 20);
        ny = Math.floor(128 + (espatula - 0.5) * 30);
        rough = 225;
      } else if (y < 768) {
        // Faixa 3: Telha Cinza-Azulada (#2F353B -> 47, 53, 59) canaletas arqueadas
        const posCanaleta = (x % 32) / 32;
        const arqueado = Math.sin(posCanaleta * Math.PI);
        const sobreposicao = (y % 64) < 6 ? 0.7 : 1.0;
        const delta = (arqueado - 0.5) * 16;
        r = Math.max(42, Math.min(80, Math.floor((47 + delta) * sobreposicao)));
        g = Math.max(36, Math.min(90, Math.floor((53 + delta) * sobreposicao)));
        b = Math.max(32, Math.min(100, Math.floor((59 + delta * 1.2) * sobreposicao)));

        const normalArco = Math.cos(posCanaleta * Math.PI);
        nx = Math.floor(128 + normalArco * 80);
        ny = sobreposicao < 1.0 ? 80 : 128;
        rough = Math.floor(185 + (1.0 - arqueado) * 30);
      } else if (y < 896) {
        // Faixa 4: Pedra de Cantaria de Base (#8A8275 -> 138, 130, 117)
        const blocoX = x % 64;
        const blocoY = (y - 768) % 32;
        const ehJunta = blocoX < 3 || blocoY < 3;
        const relevo = Math.sin(x * 0.2) * Math.cos(y * 0.2) * 0.5 + 0.5;
        const baseCor = ehJunta ? 85 : 138 + (relevo - 0.5) * 22;
        r = Math.max(42, Math.floor(baseCor));
        g = Math.max(36, Math.floor(baseCor * 0.94));
        b = Math.max(32, Math.floor(baseCor * 0.85));

        nx = ehJunta ? (blocoX < 3 ? 80 : 175) : Math.floor(128 + (relevo - 0.5) * 30);
        ny = ehJunta ? (blocoY < 3 ? 80 : 175) : 128;
        rough = ehJunta ? 240 : 210;
      } else {
        // Faixa 5: Tecidos e Lona tradicional
        const faixa = Math.floor((x / tamanho) * 3);
        const trama = ((x + y) % 4 === 0) ? 0.9 : 1.0;
        if (faixa === 0) {
          r = Math.floor(142 * trama);
          g = Math.floor(31 * trama);
          b = Math.floor(26 * trama);
        } else if (faixa === 1) {
          r = Math.floor(62 * trama);
          g = Math.floor(124 * trama);
          b = Math.floor(104 * trama);
        } else {
          r = Math.floor(217 * trama);
          g = Math.floor(201 * trama);
          b = Math.floor(165 * trama);
        }
        rough = 235;
      }

      // Piso de segurança de albedo mínimo (#2A2420: R:42, G:36, B:32)
      dataAlbedo[idx] = Math.max(42, r);
      dataAlbedo[idx + 1] = Math.max(36, g);
      dataAlbedo[idx + 2] = Math.max(32, b);
      dataAlbedo[idx + 3] = 255;

      dataNormal[idx] = nx;
      dataNormal[idx + 1] = ny;
      dataNormal[idx + 2] = nz;
      dataNormal[idx + 3] = 255;

      dataRoughness[idx] = rough;
      dataRoughness[idx + 1] = rough;
      dataRoughness[idx + 2] = rough;
      dataRoughness[idx + 3] = 255;
    }
  }

  const texAlbedo = new THREE.DataTexture(dataAlbedo, tamanho, tamanho, THREE.RGBAFormat);
  texAlbedo.wrapS = THREE.RepeatWrapping;
  texAlbedo.wrapT = THREE.RepeatWrapping;
  texAlbedo.colorSpace = THREE.SRGBColorSpace;
  texAlbedo.needsUpdate = true;

  const texNormal = new THREE.DataTexture(dataNormal, tamanho, tamanho, THREE.RGBAFormat);
  texNormal.wrapS = THREE.RepeatWrapping;
  texNormal.wrapT = THREE.RepeatWrapping;
  texNormal.needsUpdate = true;

  const texRoughness = new THREE.DataTexture(dataRoughness, tamanho, tamanho, THREE.RGBAFormat);
  texRoughness.wrapS = THREE.RepeatWrapping;
  texRoughness.wrapT = THREE.RepeatWrapping;
  texRoughness.needsUpdate = true;

  trimSheetCache = { albedo: texAlbedo, normal: texNormal, roughness: texRoughness };
  return trimSheetCache;
}

/**
 * Aplica desgaste em cor de vértice, sombra de contato no solo e pátina no telhado (Seção 4 - H1).
 */
export function aplicarDesgasteEContatoGeometria(
  geo: THREE.BufferGeometry
): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  const corAttr = geo.getAttribute('color');
  if (!pos || !corAttr) return geo;

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const alturaTotal = Math.max(0.1, maxY - minY);

  // Albedo mínimo absoluto (#2A2420: 0.165, 0.141, 0.125)
  const minR = 0.165;
  const minG = 0.141;
  const minB = 0.125;

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const yRel = (y - minY) / alturaTotal;

    let r = corAttr.getX(i);
    let g = corAttr.getY(i);
    let b = corAttr.getZ(i);

    // 1. Sombra de contato no solo: para y <= 0.6u escurece suavemente até a base
    if (y - minY < 0.6) {
      const fatorContato = Math.max(0.0, (y - minY) / 0.6);
      const escurecimento = 0.72 + 0.28 * fatorContato;
      r *= escurecimento;
      g *= escurecimento;
      b *= escurecimento;
    }

    // 2. Pátina sutil nos topos de cumeeira (yRel > 0.8)
    if (yRel > 0.8) {
      const fatorPatina = (yRel - 0.8) / 0.2;
      r = r * (1.0 - fatorPatina * 0.08) + 0.24 * (fatorPatina * 0.08);
      g = g * (1.0 - fatorPatina * 0.08) + 0.48 * (fatorPatina * 0.08);
      b = b * (1.0 - fatorPatina * 0.08) + 0.40 * (fatorPatina * 0.08);
    }

    corAttr.setXYZ(
      i,
      Math.max(minR, r),
      Math.max(minG, g),
      Math.max(minB, b)
    );
  }

  corAttr.needsUpdate = true;
  return geo;
}

/**
 * Cria o material canônico unificado para todos os edifícios e assentamentos do mapa (Seção 2, 4 e H1).
 * Usado tanto pelas cidades quanto pelo mercado da metrópole (eliminando caminhos duplicados).
 */
export function obterMaterialEdificiosCampanha(opcoes?: {
  roughness?: number;
}): THREE.MeshStandardMaterial {
  const trim = obterTrimSheetCanonica();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: opcoes?.roughness ?? 0.85,
    metalness: 0.0, // Estritamente 0 para reboco, madeira, telha e pedra (Seção 2)
    roughnessMap: trim.roughness,
    normalMap: trim.normal,
    normalScale: new THREE.Vector2(0.35, 0.35),
  });

  material.onBeforeCompile = (shader) => {
    // Injeta piso estrito de albedo mínimo #2A2420
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      // Piso mínimo estrito #2A2420 (Seção 4: nenhum albedo de edifício abaixo de #2A2420)
      diffuseColor.rgb = max(diffuseColor.rgb, vec3(0.165, 0.141, 0.125));
      `
    );
  };

  return material;
}

export function criarMaterialAguaRio(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#226572'),
    roughness: 0.15,
    metalness: 0.25,
    transparent: true,
    opacity: 0.88,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTempoAgua = { value: 0 };
    shader.vertexShader = `
      uniform float uTempoAgua;
      ${shader.vertexShader}
    `;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      // Ondulação suave da correnteza
      transformed.y += sin(position.x * 0.3 + position.z * 0.2 + uTempoAgua * 2.0) * 0.08;
      `
    );
  };

  return material;
}


