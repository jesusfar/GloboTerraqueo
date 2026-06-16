/* =========================================================================
   Marvin · OVNI cartoon 3D que orbita el globo (esquivando cilindros)
   - Modelo procedural en three.js r171 (misma instancia que globe.gl)
   - initMarvin(THREE) lo invoca el módulo ESM una vez cargado three
   - Lee GLOBE / DATA / _faros / BASE_ALT / lastCylF del scope de app.js
   ========================================================================= */
(function () {
  let marvin = null;          // THREE.Group
  let started = false;
  let rafId = null;
  let lights = [];            // referencias a las luces para el titileo
  let bubble = null;          // globo de diálogo (DOM)
  let bubbleUntil = 0;        // timestamp hasta el que se muestra

  // --- parámetros de órbita ---
  const INC = 0.62;           // inclinación de la órbita (rad)
  const NODE = 0.6;           // nodo ascendente (rad)
  const OMEGA = 0.16;         // velocidad angular (rad/s)
  const CRUISE_ALT = 0.205;   // altitud de crucero (unidades de radio del globo)
  const HOP_ALT = 0.46;       // altitud al saltar un cilindro
  const HOP_RANGE = 0.34;     // distancia angular (rad) a la que empieza a esquivar
  let theta = 0;              // argumento orbital actual
  let curAlt = CRUISE_ALT;    // altitud suavizada

  // reutilizables (evita asignar memoria por frame)
  let V = null, Q = null, M = null, UP = null, tmpDir = null, tmpFwd = null, tmpPos = null, tmpNext = null;

  window.initMarvin = function (THREE) {
    // esperar a que el globo esté listo
    const ready = (typeof GLOBE !== 'undefined') && GLOBE && GLOBE.scene && GLOBE.scene();
    if (!ready) { setTimeout(() => window.initMarvin(THREE), 150); return; }
    if (started) return;
    started = true;

    V = new THREE.Vector3();
    Q = new THREE.Quaternion();
    M = new THREE.Matrix4();
    UP = new THREE.Vector3(0, 1, 0);
    tmpDir = new THREE.Vector3();
    tmpFwd = new THREE.Vector3();
    tmpPos = new THREE.Vector3();
    tmpNext = new THREE.Vector3();

    marvin = construirMarvin(THREE);
    GLOBE.scene().add(marvin);

    wireClick(THREE);
    crearBubble();

    // posición inicial
    actualizarOrbita(0, true);

    let last = performance.now();
    function loop(now) {
      if (document.hidden) { rafId = null; return; }   // pausa con pestaña oculta (coherente con el resto)
      rafId = requestAnimationFrame(loop);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1;                            // clamp tras un freeze
      theta += OMEGA * dt;
      actualizarOrbita(dt, false);
      titileo(now);
      seguirBubble(now);
    }
    rafId = requestAnimationFrame(loop);

    // reanudar al volver a la pestaña
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && rafId == null) { last = performance.now(); rafId = requestAnimationFrame(loop); }
    });
  };

  /* ---------------------------------------------------------------------
     Posición + orientación sobre la órbita, con evasión de cilindros
  --------------------------------------------------------------------- */
  function latLngOrbita(th) {
    // gran circunferencia inclinada (INC) con nodo NODE
    const lat = Math.asin(Math.sin(INC) * Math.sin(th)) * 180 / Math.PI;
    const lng = (NODE + Math.atan2(Math.cos(INC) * Math.sin(th), Math.cos(th))) * 180 / Math.PI;
    return [lat, lng];
  }

  function actualizarOrbita(dt, instant) {
    const [lat, lng] = latLngOrbita(theta);

    // --- evasión: ¿qué tan cerca está el cilindro más próximo? ---
    const faros = (typeof _faros !== 'undefined' && _faros) ? _faros : [];
    let proxim = 0;   // 0 lejos, 1 encima
    if (faros.length) {
      const c = GLOBE.getCoords(lat, lng, 0);
      const cl = Math.hypot(c.x, c.y, c.z) || 1;
      let bestDot = -2;
      for (const d of faros) {
        const p = GLOBE.getCoords(d.lat, d.lng, 0);
        const pl = Math.hypot(p.x, p.y, p.z) || 1;
        const dot = (c.x * p.x + c.y * p.y + c.z * p.z) / (cl * pl);
        if (dot > bestDot) bestDot = dot;
      }
      const ang = Math.acos(Math.max(-1, Math.min(1, bestDot)));   // distancia angular al más cercano
      if (ang < HOP_RANGE) proxim = 1 - (ang / HOP_RANGE);          // 0..1
    }
    const targetAlt = CRUISE_ALT + (HOP_ALT - CRUISE_ALT) * easeInOut(proxim);
    const k = instant ? 1 : Math.min(1, dt * 4.5);                  // suavizado de altitud
    curAlt += (targetAlt - curAlt) * k;

    // posición mundial
    const pos = GLOBE.getCoords(lat, lng, curAlt);
    tmpPos.set(pos.x, pos.y, pos.z);
    marvin.position.copy(tmpPos);

    // orientación: cúpula hacia afuera (radial) + leve bamboleo
    tmpDir.copy(tmpPos).normalize();                                // "arriba" radial
    Q.setFromUnitVectors(UP, tmpDir);
    marvin.quaternion.copy(Q);
    // giro lento del platillo sobre su propio eje + cabeceo sutil
    const spin = theta * 1.6;
    marvin.rotateY(spin);
    marvin.rotateZ(Math.sin(theta * 2.0) * 0.06);
  }

  function easeInOut(t) { return t * t * (3 - 2 * t); }

  /* ---------------------------------------------------------------------
     Construcción del modelo (THREE, +Y hacia arriba)
  --------------------------------------------------------------------- */
  function construirMarvin(THREE) {
    const g = new THREE.Group();
    g.scale.setScalar(1.15);

    const NAVY = 0x1d2b86, ORANGE = 0xffa31c, PURPLE = 0x6b2fd6, CYAN = 0x35e0ff;

    // DoubleSide: la LatheGeometry es una cáscara de una sola cara; sin esto se
    // descartan las caras traseras y el chasis se ve "transparente" por dentro.
    const matNavy = new THREE.MeshStandardMaterial({ color: NAVY, metalness: 0.35, roughness: 0.32, side: THREE.DoubleSide });
    const matOrange = new THREE.MeshStandardMaterial({ color: ORANGE, metalness: 0.45, roughness: 0.28, emissive: 0x4a2a00, emissiveIntensity: 0.5 });
    const matPurple = new THREE.MeshStandardMaterial({ color: PURPLE, metalness: 0.4, roughness: 0.3, emissive: 0x2a0d6b, emissiveIntensity: 0.5 });
    // cúpula de vidrio translúcida (orbe brillante)
    const matDome = new THREE.MeshStandardMaterial({ color: 0x46d4ff, metalness: 0.0, roughness: 0.06, transparent: true, opacity: 0.9, emissive: 0x1190ff, emissiveIntensity: 0.55 });
    const matGlow = new THREE.MeshStandardMaterial({ color: CYAN, emissive: CYAN, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0 });

    // --- cuerpo (perfil de platillo via LatheGeometry) ---
    // el centro se hunde en un cuenco poco profundo para que la cúpula asiente sin asomar navy
    const prof = [
      [0.0, 1.42], [1.0, 1.5], [1.8, 1.62], [2.4, 1.7], [3.5, 1.22], [4.5, 0.72],
      [5.15, 0.32], [5.4, 0.0], [5.2, -0.42], [4.45, -1.02], [3.25, -1.62],
      [1.95, -2.12], [0.85, -2.46], [0.0, -2.62]
    ].map(p => new THREE.Vector2(p[0], p[1]));
    const bodyGeo = new THREE.LatheGeometry(prof, 64);
    g.add(new THREE.Mesh(bodyGeo, matNavy));

    // --- banda naranja en el ecuador ---
    const orangeGeo = new THREE.TorusGeometry(5.32, 0.42, 20, 64);
    const orange = new THREE.Mesh(orangeGeo, matOrange);
    orange.rotation.x = Math.PI / 2;
    g.add(orange);

    // --- anillo púrpura bajo la cúpula ---
    const ringGeo = new THREE.TorusGeometry(2.5, 0.34, 18, 48);
    const ring = new THREE.Mesh(ringGeo, matPurple);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.78;
    g.add(ring);

    // --- cúpula de vidrio ---
    const domeGeo = new THREE.SphereGeometry(2.55, 40, 28, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, matDome);
    dome.position.y = 1.72;
    g.add(dome);
    // disco interior brillante (tapa el hueco de la semiesfera)
    const capGeo = new THREE.CircleGeometry(2.45, 36);
    const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: 0x2bb8ff, emissive: 0x1aa0ff, emissiveIntensity: 0.7, roughness: 0.2 }));
    cap.rotation.x = -Math.PI / 2;
    cap.position.y = 1.74;
    g.add(cap);

    // --- luces tipo ojo de buey (ventanas planas embutidas en el casco) ---
    // En vez de esferas que sobresalen (y asoman desde arriba), cada luz es una
    // lente cian achatada, hundida en su aro púrpura y orientada según la normal
    // del casco, para que se lea como ventana/porthole y no protruya.
    const N = 12, ringR = 4.52, ringY = 0.76;
    const nR = 0.479, nY = 0.878;                 // normal aproximada de la pendiente (radial, vertical)
    const socketGeo = new THREE.TorusGeometry(0.5, 0.16, 12, 22);
    const lensGeo = new THREE.SphereGeometry(0.46, 18, 14);
    const Z = new THREE.Vector3(0, 0, 1);
    lights = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const pos = new THREE.Vector3(ca * ringR, ringY, sa * ringR);
      const normal = new THREE.Vector3(ca * nR, nY, sa * nR).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(Z, normal);

      // aro púrpura, embutido a ras del casco
      const socket = new THREE.Mesh(socketGeo, matPurple);
      socket.position.copy(pos).addScaledVector(normal, -0.04);
      socket.quaternion.copy(q);
      socket.scale.set(1, 1, 0.7);
      g.add(socket);

      // lente cian achatada (apenas sobresale ~0.13): la mitad interior queda
      // dentro del casco opaco, así se ve como ventana iluminada, no como esfera
      const lens = new THREE.Mesh(lensGeo, matGlow.clone());
      lens.position.copy(pos).addScaledVector(normal, 0.02);
      lens.quaternion.copy(q);
      lens.scale.set(1, 1, 0.34);
      g.add(lens);
      lights.push(lens);
    }

    // --- glow inferior ---
    const glowGeo = new THREE.SphereGeometry(1.25, 24, 18);
    const glow = new THREE.Mesh(glowGeo, matGlow.clone());
    glow.scale.set(1, 0.5, 1);
    glow.position.y = -2.5;
    g.add(glow);
    lights.push(glow);

    g.renderOrder = 5;
    return g;
  }

  // titileo suave de las luces (no cada una idéntica)
  function titileo(now) {
    const t = now / 1000;
    for (let i = 0; i < lights.length; i++) {
      const m = lights[i].material;
      m.emissiveIntensity = 1.25 + Math.sin(t * 3 + i * 0.7) * 0.45;
    }
  }

  /* ---------------------------------------------------------------------
     Click -> diálogo
  --------------------------------------------------------------------- */
  function wireClick(THREE) {
    const dom = GLOBE.renderer().domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downX = 0, downY = 0;

    dom.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
    dom.addEventListener('pointerup', (e) => {
      // ignorar arrastres (rotación del globo)
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const rect = dom.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, GLOBE.camera());
      const hits = ray.intersectObject(marvin, true);
      if (hits.length) { e.stopPropagation(); mostrarBubble(now()); }
    });
  }

  function now() { return performance.now(); }

  /* ---------------------------------------------------------------------
     Globo de diálogo "Hola, soy Marvin"
  --------------------------------------------------------------------- */
  function crearBubble() {
    bubble = document.createElement('div');
    bubble.className = 'marvin-bubble';
    bubble.innerHTML = '<span class="mb-wave">👽</span><span class="mb-text">¡Hola, soy <b>Marvin</b>!</span><i class="mb-arrow"></i>';
    document.body.appendChild(bubble);
  }

  function mostrarBubble() {
    bubbleUntil = now() + 3600;
    bubble.classList.add('show');
    seguirBubble(now());
  }

  function seguirBubble(t) {
    if (!bubble) return;
    if (t > bubbleUntil) { bubble.classList.remove('show'); return; }
    if (!bubble.classList.contains('show')) return;

    // proyectar la posición de Marvin a pantalla
    const cam = GLOBE.camera();
    tmpPos.copy(marvin.position);
    V.copy(tmpPos).project(cam);
    const dom = GLOBE.renderer().domElement;
    const rect = dom.getBoundingClientRect();
    const x = rect.left + (V.x * 0.5 + 0.5) * rect.width;
    const y = rect.top + (-V.y * 0.5 + 0.5) * rect.height;

    // ocultar solo si Marvin está en el hemisferio opuesto a la cámara (detrás del globo).
    // 'facing' es robusto (1.0 de frente); evitamos V.z como proxy de oclusión porque
    // queda pegado a ~1.0 y puede invertirse, dejando el diálogo invisible de frente.
    const camPos = cam.position;
    const cl = Math.hypot(camPos.x, camPos.y, camPos.z) || 1;
    const ml = Math.hypot(tmpPos.x, tmpPos.y, tmpPos.z) || 1;
    const facing = (tmpPos.x * camPos.x + tmpPos.y * camPos.y + tmpPos.z * camPos.z) / (ml * cl);
    bubble.style.opacity = (facing > -0.1) ? '1' : '0';

    bubble.style.left = x + 'px';
    bubble.style.top = (y - 64) + 'px';   // por encima del platillo
  }
})();
