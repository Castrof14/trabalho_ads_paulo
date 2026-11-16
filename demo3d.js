/* =====================================================================
   Demo 3D — Projeto de Rede · Escola Municipal (3 blocos)
   Síntese visual de Atividade_Redes_Paulo em Three.js (r128).
   ===================================================================== */
(function () {
  'use strict';

  var W = 1920, H = 1080;
  var C = {
    fiber: 0xff7a17, copper: 0xa0c3ec, wifi: 0xc4b5fd, g4: 0xffc285,
    ok: 0x6ee7b7, bad: 0xff4d4d, white: 0xffffff, dusk: 0x7c3aed
  };

  /* ---------------- capítulos (fiéis ao PDF) ---------------- */
  var CH = [
    { ey: 'Visão geral', t: 'A rede da escola, em 3D.', s: 'CAN · três blocos no mesmo terreno · até 150 m · cliente-servidor',
      cam: [-30, 56, 112], tg: [-29, 7, -10] },
    { ey: 'Parte 2 · Topologia', t: 'Estrela estendida.', s: 'Física em árvore: A → B → C · cada bloco em estrela no seu switch',
      cam: [-18, 118, 34], tg: [-22, 0, -4] },
    { ey: 'Parte 4 · A ↔ B', t: 'Fibra óptica · 120 m.', s: 'Acima do limite de 100 m do cobre · full-duplex · imune a raios no pátio',
      cam: [-36, 27, 40], tg: [-33, 0, -6] },
    { ey: 'Parte 4 · B ↔ C', t: 'Cobre · 60 m coberto.', s: 'Dentro do limite de 100 m · corredor protegido de sol e chuva · mais barato',
      cam: [23, 2.6, 15], tg: [19, 3.9, -2] },
    { ey: 'Parte 3 · Bloco B', t: '21 PCs no cabo. Wi-Fi nas salas.', s: 'Cabo: ponto a ponto, full-duplex · Wi-Fi: multiponto, half-duplex',
      cam: [0, 27, 36], tg: [1, -2, 6] },
    { ey: 'Parte 7 · O caminho de uma mensagem', t: 'PC 05 → Internet.', s: 'HTTPS · IP endereça e roteia · TCP entrega em ordem, sem perdas',
      cam: [-34, 40, 72], tg: [-40, 12, -14] },
    { ey: 'Parte 6 · Teste de falha', t: 'Caiu a operadora? O 4G assume.', s: 'Link de reserva · 4 créditos · matrículas e diários continuam no ar',
      cam: [-70, 30, 40], tg: [-78, 12, -22] },
    { ey: 'Parte 6 · Teste de falha', t: 'Faltou energia? O nobreak segura.', s: 'Roteador e secretaria seguem ligados no Bloco A · 3 créditos',
      cam: [-20, 46, 66], tg: [-20, 0, -2] },
    { ey: 'Parte 6 · Teste de falha', t: 'Rompeu a fibra? Só A segue.', s: 'B e C ficam sem internet · a rede local entre eles continua funcionando',
      cam: [-30, 30, 50], tg: [-26, 1, -4] },
    { ey: 'Parte 9 · Decisão descartada', t: 'Rádio na chuva? Não.', s: 'Rádio: 6 créditos, oscila com chuva e vento · Fibra: 12 créditos, estável',
      cam: [-35, 17, 40], tg: [-34, 5, -4] },
    { ey: 'Síntese', t: '', s: '', cam: [-30, 50, 104], tg: [-30, -10, 16], final: true }
  ];

  /* ---------------- estado ---------------- */
  var host, canvas, hud, renderer, scene, camera, composer, bloomPass, clock;
  var ready = false, active = false, ch = 0, chT = 0, time = 0, raf = 0;
  var camPos, camTg, wantPos, wantTg, camVel, tgVel;
  var yawUser = 0, pitchUser = 0, yawVel = 0, pitchVel = 0, dragging = false;
  var hoverX = 0, hoverY = 0, hoverTX = 0, hoverTY = 0;
  var curFov = 40, fovVel = 0, baseBloom = .55;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var labels = [], updaters = [];
  var S = { power: 1, fiber: 1, op: 1, topo: 0, rain: 0, packet: 0, lab: 0, final: 0, bolt: 0 };
  var T = {};
  var M = {};             // materiais compartilhados
  var R = {};             // referências a objetos
  var stepsEl, stepKeys = [];

  /* ---------------- utilitários ---------------- */
  function V(x, y, z) { return new THREE.Vector3(x, y, z); }
  function std(c, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .82, metalness: .08 }, o || {})); }
  function glow(c, i) { return new THREE.MeshStandardMaterial({ color: 0x050505, emissive: c, emissiveIntensity: i || 1.6, roughness: .4 }); }
  function basic(c, o) { return new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {})); }
  function add(o, p) { (p || scene).add(o); return o; }
  function box(w, h, d, m, x, y, z, p, noShadow) {
    var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y + h / 2, z);
    if (!noShadow) { b.castShadow = true; b.receiveShadow = true; }
    return add(b, p);
  }
  function line(points, mat, p) {
    var g = new THREE.BufferGeometry().setFromPoints(points);
    var l = new THREE.Line(g, mat);
    if (mat.isLineDashedMaterial) l.computeLineDistances();
    return add(l, p);
  }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function ease(k) { return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
  function springVec(pos, vel, target, stiffness, damping, dt) {
    var fx = (target.x - pos.x) * stiffness, fy = (target.y - pos.y) * stiffness, fz = (target.z - pos.z) * stiffness;
    vel.x = (vel.x + fx * dt) * Math.exp(-damping * dt);
    vel.y = (vel.y + fy * dt) * Math.exp(-damping * dt);
    vel.z = (vel.z + fz * dt) * Math.exp(-damping * dt);
    pos.x += vel.x * dt; pos.y += vel.y * dt; pos.z += vel.z * dt;
  }

  function canvasTex(size, draw, rep) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    draw(c.getContext('2d'), size);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (rep) t.repeat.set(rep, rep);
    t.anisotropy = 4;
    return t;
  }

  /* ---------------- fluxo de pacotes ao longo de uma curva ---------------- */
  function Flow(curve, color, n, speed, reverse, size) {
    var geo = new THREE.SphereGeometry(size || .22, 10, 10), mat = basic(color, { transparent: true });
    var items = [];
    for (var i = 0; i < n; i++) { var m = add(new THREE.Mesh(geo, mat)); items.push({ m: m, ph: i / n }); }
    this.k = 1; this.mat = mat;
    this.update = function (dt, t, k) {
      for (var i = 0; i < items.length; i++) {
        var u = (items[i].ph + t * speed) % 1; if (reverse) u = 1 - u;
        items[i].m.position.copy(curve.getPointAt(u));
        var s = Math.max(.001, k * (.6 + .4 * Math.sin(u * Math.PI)));
        items[i].m.scale.setScalar(s);
        items[i].m.visible = k > .02;
      }
    };
  }

  /* ---------------- anéis de Wi-Fi ---------------- */
  function WifiRings(pos, radius, color) {
    var rings = [], geo = new THREE.RingGeometry(.92, 1, 64);
    for (var i = 0; i < 3; i++) {
      var m = new THREE.Mesh(geo, basic(color, { transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.copy(pos); add(m); rings.push(m);
    }
    var core = add(new THREE.Mesh(new THREE.CylinderGeometry(.55, .65, .18, 24), glow(color, 2.2)));
    core.position.copy(pos);
    this.update = function (dt, t, k, emph) {
      for (var i = 0; i < 3; i++) {
        var u = ((t * .42) + i / 3) % 1;
        rings[i].scale.setScalar(.4 + u * radius);
        rings[i].material.opacity = (1 - u) * .38 * k * (.55 + .45 * emph);
        rings[i].visible = k > .02;
      }
      core.material.emissiveIntensity = 2.2 * k + .05;
    };
  }

  /* ---------------- rótulos HTML projetados ---------------- */
  function label(text, pos, chs, kind) {
    var el = document.createElement('div');
    el.className = 'l3d' + (kind ? ' ' + kind : '');
    el.innerHTML = '<i></i><span>' + text + '</span>';
    host.querySelector('.d3-labels').appendChild(el);
    labels.push({ el: el, p: pos, chs: chs, sx: 0, sy: 0, hasPos: false, idx: labels.length });
  }

  /* =================================================================
     CENA
     ================================================================= */
  function buildScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    scene.fog = new THREE.FogExp2(0x0a0a0a, .0062);

    camera = new THREE.PerspectiveCamera(40, W / H, .5, 900);

    /* luzes */
    R.hemi = add(new THREE.HemisphereLight(0xa0c3ec, 0x0a0a0a, .28));
    var sun = new THREE.DirectionalLight(0xdfe8ff, .75);
    sun.position.set(-40, 90, 60); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera; sc.left = -120; sc.right = 90; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 260;
    sun.shadow.bias = -.0006; sun.shadow.radius = 3;
    add(sun); R.sun = sun;
    var rim = add(new THREE.DirectionalLight(0x7c3aed, .35)); rim.position.set(80, 30, -90);
    R.flash = add(new THREE.PointLight(0xc4d8ff, 0, 140, 1.6)); R.flash.position.set(-30, 30, 6);

    /* chão com grade */
    var gtex = canvasTex(512, function (g, s) {
      g.fillStyle = '#0c0d10'; g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1;
      for (var i = 0; i <= s; i += 64) { g.beginPath(); g.moveTo(i + .5, 0); g.lineTo(i + .5, s); g.stroke(); g.beginPath(); g.moveTo(0, i + .5); g.lineTo(s, i + .5); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.12)';
      for (var x = 0; x <= s; x += 64) for (var y = 0; y <= s; y += 64) g.fillRect(x - 1, y - 1, 2, 2);
    }, 60);
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), std(0x4a4f58, { map: gtex, roughness: .95 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; add(ground);

    /* pátio (concreto) entre A e B */
    var ptex = canvasTex(256, function (g, s) {
      g.fillStyle = '#131519'; g.fillRect(0, 0, s, s);
      for (var i = 0; i < 1400; i++) { g.fillStyle = 'rgba(255,255,255,' + (Math.random() * .035) + ')'; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
      g.strokeStyle = 'rgba(0,0,0,.5)'; g.strokeRect(0, 0, s, s);
    }, 1);
    ptex.repeat.set(8, 6);
    var patio = new THREE.Mesh(new THREE.PlaneGeometry(40, 34), std(0x6a6f78, { map: ptex, roughness: .9 }));
    patio.rotation.x = -Math.PI / 2; patio.position.set(-33.5, .02, 0); patio.receiveShadow = true; add(patio);

    /* mangueiras no pátio (citadas na Parte 8) */
    var trunk = std(0x3a2c20, { roughness: .9 }), leaf = std(0x1e3327, { roughness: .85, flatShading: true });
    var crowns = [];
    [[-49, 12], [-19, 13], [-44, -15], [-36, -18], [-27, -14], [-19, -17], [-46, -9]].forEach(function (p, i) {
      var t = add(new THREE.Mesh(new THREE.CylinderGeometry(.28, .4, 2.6, 7), trunk)); t.position.set(p[0], 1.3, p[1]); t.castShadow = true;
      var c = add(new THREE.Mesh(new THREE.IcosahedronGeometry(2.3 + (i % 3) * .4, 0), leaf)); c.position.set(p[0], 3.9, p[1]); c.rotation.set(i, i * 2, 0); c.castShadow = true; c.receiveShadow = true;
      crowns.push({ m: c, rx: i, ry: i * 2, ph: i * 1.1 });
    });
    updaters.push(function (dt, t) {
      if (reduceMotion) return;
      var wind = .025 + S.rain * .085;
      for (var i = 0; i < crowns.length; i++) {
        var cr = crowns[i];
        cr.m.rotation.z = Math.sin(t * (1.2 + S.rain * 2.2) + cr.ph) * wind;
        cr.m.rotation.x = cr.rx + Math.cos(t * .9 + cr.ph) * wind * .6;
      }
    });

    /* materiais compartilhados */
    M.floor = std(0x16181c, { roughness: .7, map: canvasTex(128, function (g, s) {
      g.fillStyle = '#17191d'; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(255,255,255,.05)';
      for (var i = 0; i <= s; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); }
    }, 6) });
    M.wall = std(0x23272d, { transparent: true, opacity: .5, roughness: .6 });
    M.edge = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .32 });
    M.desk = std(0x2a2e35, { roughness: .6 });
    M.body = std(0x0f1114, { roughness: .45, metalness: .55 });
    M.scrA = glow(C.copper, 1); M.scrB = glow(C.copper, 1); M.scrC = glow(C.copper, 1);
    M.nb = glow(C.wifi, 1.1);

    /* blocos */
    R.A = building(-62, 0, 16, 12, 6);
    R.B = building(0, 0, 26, 16, 6);
    R.C = building(34, 0, 12, 12, 6);
    M.edgeB = R.B.edge.material = M.edge.clone();
    M.edgeC = R.C.edge.material = M.edge.clone();

    /* luz interna de cada bloco */
    R.lA = add(new THREE.PointLight(0xa0c3ec, 1.1, 26, 2)); R.lA.position.set(-62, 5, 1);
    R.lB = add(new THREE.PointLight(0xa0c3ec, 1.3, 34, 2)); R.lB.position.set(0, 5, 1);
    R.lC = add(new THREE.PointLight(0xa0c3ec, 1.0, 24, 2)); R.lC.position.set(34, 5, 1);

    buildA(); buildB(); buildC();
    buildLinks();
    buildTopology();
    buildExtras();
  }

  function building(cx, cz, w, d, h) {
    var g = add(new THREE.Group());
    box(w + .6, .4, d + .6, M.floor, cx, 0, cz, g);
    // paredes (fundo, laterais, frente baixa = corte)
    box(w, h, .25, M.wall, cx, .4, cz - d / 2, g);
    box(.25, h, d, M.wall, cx - w / 2, .4, cz, g);
    box(.25, h, d, M.wall, cx + w / 2, .4, cz, g);
    box(w, 1.1, .25, M.wall, cx, .4, cz + d / 2, g);
    var e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), M.edge);
    e.position.set(cx, .4 + h / 2, cz); add(e, g);
    return { g: g, edge: e };
  }

  function rack(x, z, units) {
    box(1.5, 3.8, 1.1, M.body, x, .4, z);
    var leds = [];
    units.forEach(function (u, i) {
      var m = glow(u.c, 1.4);
      var b = box(1.15, .16, .04, m, x, .4 + 3.35 - i * .42, z + .57, null, true);
      for (var k = 0; k < 6; k++) {
        var dm = glow(u.c, 2.2);
        var d = box(.08, .08, .04, dm, x - .45 + k * .18, .4 + 3.25 - i * .42, z + .6, null, true);
        leds.push({ m: dm, ph: Math.random() * 10, sp: 3 + Math.random() * 9 });
      }
      u.mesh = b; u.mat = m;
    });
    updaters.push(function (dt, t) {
      for (var i = 0; i < leds.length; i++) leds[i].m.emissiveIntensity = (Math.sin(t * leds[i].sp + leds[i].ph) > .2 ? 2.4 : .25) * leds[i].k0;
    });
    leds.forEach(function (l) { l.k0 = 1; });
    return leds;
  }

  function pc(x, z, scr, rot) {
    var g = add(new THREE.Group());
    box(1.5, .08, .9, M.desk, 0, .78, 0, g);
    box(.08, .78, .08, M.desk, -.65, 0, -.35, g); box(.08, .78, .08, M.desk, .65, 0, -.35, g);
    box(.08, .78, .08, M.desk, -.65, 0, .35, g); box(.08, .78, .08, M.desk, .65, 0, .35, g);
    box(.1, .3, .1, M.body, 0, .86, -.2, g);
    box(.95, .6, .06, M.body, 0, 1.1, -.22, g);
    var s = box(.86, .5, .02, scr, 0, 1.15, -.18, g, true);
    g.position.set(x, .4, z); if (rot) g.rotation.y = rot;
    return { g: g, scr: s, top: V(x, 1.9, z) };
  }

  function notebook(x, z, mat) {
    var g = add(new THREE.Group());
    box(.9, .05, .6, M.body, 0, .82, 0, g);
    var s = box(.86, .5, .03, mat, 0, .86, -.28, g, true); s.rotation.x = -.25;
    box(1.4, .06, 1, M.desk, 0, .76, 0, g);
    g.position.set(x, .4, z);
    return { g: g, scr: s, p: V(x, 1.4, z) };
  }

  /* ---------------- Bloco A · administrativo ---------------- */
  function buildA() {
    R.rackA = V(-58, 0, -4.5);
    R.unitsA = [{ c: C.copper, n: 'roteador' }, { c: C.white, n: 'sw novo' }, { c: C.white, n: 'sw antigo' }, { c: C.copper }];
    rack(-58, -4.5, R.unitsA);
    // nobreak
    box(1.1, 1.6, 1, M.body, -56.1, .4, -4.5);
    M.ups = glow(C.ok, 1); box(.8, .12, .04, M.ups, -56.1, 1.7, -3.98, null, true);
    M.ups2 = glow(C.ok, 1); box(.8, .12, .04, M.ups2, -56.1, 1.45, -3.98, null, true);
    // secretaria (3), coordenação (2), direção (1), impressora
    [[-68, -1.2], [-66.2, -1.2], [-64.4, -1.2], [-68, 2.6], [-66.2, 2.6], [-61.5, 3]].forEach(function (p) { pc(p[0], p[1], M.scrA); });
    box(1, .9, .8, std(0x30343b), -58, .4, 3);
    M.prn = glow(C.ok, 1.2); box(.5, .06, .05, M.prn, -58, 1.15, 3.42, null, true);
    // mastro do 4G no telhado
    var mast = add(new THREE.Mesh(new THREE.CylinderGeometry(.12, .16, 5, 8), M.body)); mast.position.set(-67, 8.9, -5); mast.castShadow = true;
    M.g4mast = glow(C.g4, .6);
    box(.5, .9, .3, M.g4mast, -67, 11.1, -5, null, true);
  }

  /* ---------------- Bloco B · laboratório + salas ---------------- */
  function buildB() {
    R.rackB = V(-9, 0, -6.6);
    R.unitsB = [{ c: C.copper, n: 'sw 24' }, { c: C.copper }, { c: C.wifi, n: 'sw aux' }, { c: C.fiber, n: 'conversor' }];
    rack(-9, -6.6, R.unitsB);
    // laboratório: 21 PCs (3 × 7)
    R.lab = []; M.cable = new THREE.LineBasicMaterial({ color: C.copper, transparent: true, opacity: .22 });
    for (var r = 0; r < 3; r++) for (var k = 0; k < 7; k++) {
      var x = -12 + k * 1.75, z = -2.4 + r * 3.1;
      var isP5 = (r === 0 && k === 4);
      var mat = isP5 ? (M.scrP5 = glow(C.copper, 1.3)) : M.scrB;
      var p = pc(x, z, mat); R.lab.push(p);
      line([V(-9, .55, -6), V(-9, .48, -5.4), V(x, .48, -5.4), V(x, .48, z - .5), V(x, 1.2, z - .5)], M.cable);
      if (isP5) R.pc05 = V(x, 1.5, z - .2);
    }
    // salas de aula: divisórias 2 × 2
    box(.2, 4.2, 15.6, M.wall, 1.2, .4, 0);
    box(11.6, 4.2, .2, M.wall, 7.1, .4, 0);
    box(.2, 4.2, 15.6, M.wall, 7.1, .4, 0);
    R.nbB = [];
    [[4.1, -4.6], [4.1, -2.2], [10.1, -4.6], [10.1, -2.2], [4.1, 2.4], [4.1, 4.8], [10.1, 2.4], [10.1, 4.8]].forEach(function (p) { R.nbB.push(notebook(p[0], p[1], M.nb.clone())); });
    // APs
    R.ap1 = V(7.1, 5.9, -3.6); R.ap2 = V(7.1, 5.9, 3.6);
    var w1 = new WifiRings(R.ap1, 8, C.wifi), w2 = new WifiRings(R.ap2, 8, C.wifi);
    R.wifi = [w1, w2];
    var cm = new THREE.LineBasicMaterial({ color: C.wifi, transparent: true, opacity: .35 });
    line([V(-9, 4.2, -6.6), V(-9, 5.95, -6.6), V(7.1, 5.95, -6.6), R.ap1, R.ap2], cm);
    // half-duplex: um notebook por vez “fala” com o AP
    R.hd = [];
    [[R.ap1, R.nbB.slice(0, 4)], [R.ap2, R.nbB.slice(4)]].forEach(function (pair) {
      var lm = new THREE.LineDashedMaterial({ color: C.wifi, dashSize: .35, gapSize: .25, transparent: true, opacity: 0 });
      var l = line([pair[0], pair[1][0].p], lm);
      R.hd.push({ ap: pair[0], nbs: pair[1], l: l, m: lm });
    });
  }

  /* ---------------- Bloco C · biblioteca + sala dos professores ---------------- */
  function buildC() {
    R.rackC = V(30.6, 0, -4.4);
    R.unitsC = [{ c: C.copper, n: 'sw 8' }, { c: C.wifi }];
    rack(30.6, -4.4, R.unitsC);
    [[33, -1.4], [34.8, -1.4], [36.6, -1.4], [38.4, -1.4]].forEach(function (p) { pc(p[0], p[1], M.scrC); });
    // estantes da biblioteca
    var bk = [0x7c3aed, 0xa0c3ec, 0xffc285, 0x6ee7b7, 0xdadbdf];
    for (var i = 0; i < 3; i++) {
      var x = 34 + i * 2.2;
      box(1.9, 2.6, .5, std(0x1d2026), x, .4, -5.4);
      for (var j = 0; j < 7; j++) box(.2, .55, .35, std(bk[(i + j) % 5], { roughness: .7 }), x - .75 + j * .25, .4 + .3 + (j % 3) * .8, -5.3, null, true);
    }
    box(11.6, 3.4, .2, M.wall, 34, .4, 1.6);
    R.nbC = [notebook(32.4, 4, M.nb.clone()), notebook(35.6, 4, M.nb.clone())];
    R.ap3 = V(37.5, 5.9, 3.8);
    R.wifi.push(new WifiRings(R.ap3, 6, C.wifi));
    line([V(30.6, 4.2, -4.4), V(30.6, 5.95, -4.4), V(37.5, 5.95, -4.4), R.ap3], new THREE.LineBasicMaterial({ color: C.wifi, transparent: true, opacity: .35 }));
  }

  /* ---------------- enlaces: fibra, cobre, operadora, 4G ---------------- */
  function buildLinks() {
    // Fibra A ↔ B (120 m) pelo pátio
    R.fiberCurve = new THREE.CatmullRomCurve3([
      V(-58, 3.3, -3.95), V(-57.4, .5, -3.6), V(-53, .32, -5), V(-44, .32, -3.6), V(-34, .32, -5.6),
      V(-24, .32, -4.6), V(-14, .32, -6.2), V(-10.2, .5, -6.2), V(-9, 2.1, -6.05)
    ], false, 'centripetal');
    M.fiber = glow(0xff5a00, .55);
    R.fiber = add(new THREE.Mesh(new THREE.TubeGeometry(R.fiberCurve, 200, .16, 10, false), M.fiber));
    R.fiberFlows = [new Flow(R.fiberCurve, 0xff7a17, 7, .16, false, .28), new Flow(R.fiberCurve, 0xffb070, 7, .16, true, .22)];

    // Cobre B ↔ C (60 m) sob o corredor coberto
    R.copperCurve = new THREE.CatmullRomCurve3([
      V(-9, 3.6, -6.05), V(-9, 4.6, -7.2), V(2, 4.6, -7.4), V(12.6, 4.4, -3), V(14, 3.9, 0), V(20.5, 3.6, 0),
      V(27, 3.9, 0), V(28.6, 4.3, -3.5), V(30.6, 3.6, -3.85)
    ], false, 'centripetal');
    M.copper = glow(0x5f95d6, .7);
    add(new THREE.Mesh(new THREE.TubeGeometry(R.copperCurve, 180, .12, 8, false), M.copper));
    R.copperFlows = [new Flow(R.copperCurve, 0xffffff, 5, .2, false, .26), new Flow(R.copperCurve, C.copper, 5, .2, true, .26)];

    // corredor coberto
    var roof = std(0x15171b, { roughness: .7, transparent: true, opacity: .82 });
    box(14.6, .25, 4.6, roof, 20.5, 4.35, 0);
    [[13.6, -2], [13.6, 2], [20.5, -2], [20.5, 2], [27.4, -2], [27.4, 2]].forEach(function (p) {
      var c = add(new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 4, 8), M.body)); c.position.set(p[0], 2.4, p[1]); c.castShadow = true;
    });
    var re = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(14.6, .25, 4.6)), M.edge);
    re.position.set(20.5, 4.47, 0); add(re);

    // Internet (operadora) e link do roteador
    R.net = V(-82, 22, -40);
    var netGroup = add(new THREE.Group()); netGroup.position.copy(R.net);
    var globe = add(new THREE.Mesh(new THREE.IcosahedronGeometry(5, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: .55 })), netGroup);
    var core = add(new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 2), glow(C.copper, .9)), netGroup);
    var haloRing = add(new THREE.Mesh(new THREE.TorusGeometry(6.8, .05, 8, 64), basic(C.copper, { transparent: true, opacity: .35 })), netGroup);
    haloRing.rotation.x = Math.PI / 2.4; haloRing.rotation.y = .3;
    var orbit = add(new THREE.Group(), netGroup);
    for (var i = 0; i < 18; i++) {
      var d = add(new THREE.Mesh(new THREE.SphereGeometry(.18, 8, 8), basic(0xffffff)), orbit);
      var a = i / 18 * Math.PI * 2, r = 7 + (i % 3);
      d.position.set(Math.cos(a) * r, Math.sin(a * 3) * 1.6, Math.sin(a) * r);
    }
    updaters.push(function (dt, t) {
      globe.rotation.y = t * .12; globe.rotation.x = t * .05;
      orbit.rotation.y = -t * .3; core.rotation.y = t * .2;
      haloRing.rotation.z = t * .15;
      if (!reduceMotion) netGroup.position.y = R.net.y + Math.sin(t * .9) * .65;
    });
    R.globe = globe;

    R.opCurve = new THREE.CatmullRomCurve3([V(-58, 3.75, -4.2), V(-58, 6.6, -4.6), V(-60, 12, -16), V(-70, 18, -31), V(-78.5, 21, -37.5)], false, 'centripetal');
    M.op = glow(0xdadbdf, .8);
    R.opTube = add(new THREE.Mesh(new THREE.TubeGeometry(R.opCurve, 120, .1, 8, false), M.op));
    R.opFlows = [new Flow(R.opCurve, 0xffffff, 5, .22, false, .22), new Flow(R.opCurve, C.copper, 5, .22, true, .22)];

    // torre do 4G
    var tx = -104, tz = -22;
    var tw = std(0x3a3f47, { metalness: .6, roughness: .4 });
    for (var k = 0; k < 4; k++) {
      var leg = add(new THREE.Mesh(new THREE.CylinderGeometry(.12, .2, 26, 6), tw));
      leg.position.set(tx + (k % 2 ? 1 : -1) * .9, 13, tz + (k < 2 ? 1 : -1) * .9); leg.rotation.z = (k % 2 ? -1 : 1) * .03; leg.castShadow = true;
    }
    for (var y = 3; y < 26; y += 3.2) box(2.1, .08, 2.1, tw, tx, y, tz, null, false);
    M.beacon = glow(C.bad, 2); var bc = add(new THREE.Mesh(new THREE.SphereGeometry(.35, 12, 12), M.beacon)); bc.position.set(tx, 26.4, tz);
    updaters.push(function (dt, t) { M.beacon.emissiveIntensity = (Math.sin(t * 3) > .6 ? 3 : .3); });
    R.g4Curve = new THREE.CatmullRomCurve3([V(-67, 11.6, -5), V(-84, 22, -12), V(tx, 26, tz), V(-96, 26, -34), V(-86, 23, -39)], false, 'centripetal');
    M.g4 = new THREE.LineDashedMaterial({ color: C.g4, dashSize: .9, gapSize: .7, transparent: true, opacity: .14 });
    line(R.g4Curve.getPoints(120), M.g4);
    R.g4Flows = [new Flow(R.g4Curve, C.g4, 6, .2, false, .3), new Flow(R.g4Curve, 0xffffff, 6, .2, true, .22)];
  }

  /* ---------------- sobreposição da topologia (estrela estendida) ---------------- */
  function buildTopology() {
    var g = R.topo = add(new THREE.Group());
    var mats = [];
    function m(c, o) { var x = basic(c, { transparent: true, opacity: 0, depthWrite: false }); x.base = o; mats.push(x); return x; }
    function lm(c, o) { var x = new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0 }); x.base = o; mats.push(x); return x; }
    var hubs = [V(-62, 16, 0), V(0, 16, 0), V(34, 16, 0)];
    var hm = m(0xffffff, 1), hringM = m(C.copper, .45);
    var hubMeshes = [], leafNodes = [];
    hubs.forEach(function (h, i) {
      var s = add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 24), hm), g); s.position.copy(h);
      var hr = add(new THREE.Mesh(new THREE.TorusGeometry(1.9, .05, 8, 40), hringM), g);
      hr.position.copy(h); hr.rotation.x = Math.PI / 2;
      hubMeshes.push({ s: s, r: hr, baseY: h.y, ph: i * 1.4 });
    });
    line([hubs[0], hubs[1]], lm(C.fiber, 1), g); line([hubs[1], hubs[2]], lm(C.copper, 1), g);
    var leaf = m(C.copper, .9), ll = lm(0xffffff, .35), vl = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: .5, gapSize: .5, transparent: true, opacity: 0 }); vl.base = .25; mats.push(vl);
    var counts = [7, 12, 6], spread = [7, 11, 6];
    hubs.forEach(function (h, i) {
      for (var k = 0; k < counts[i]; k++) {
        var a = (k / counts[i]) * Math.PI * 2, p = V(h.x + Math.cos(a) * spread[i], 11.5, h.z + Math.sin(a) * spread[i] * .7);
        var s = add(new THREE.Mesh(new THREE.SphereGeometry(.35, 12, 12), leaf), g); s.position.copy(p);
        leafNodes.push({ s: s, baseY: p.y, ph: i * 1.1 + k * .55, delay: (i * .12 + k * .025) });
        line([h, p], ll, g);
      }
      line([h, V(h.x, 6.6, h.z)], vl, g);
    });
    updaters.push(function (dt, t) {
      if (S.topo < .01) return;
      for (var i = 0; i < hubMeshes.length; i++) {
        var hmItem = hubMeshes[i], bob = reduceMotion ? 0 : Math.sin(t * 1.6 + hmItem.ph) * .35;
        hmItem.s.position.y = hmItem.baseY + bob;
        hmItem.r.position.y = hmItem.baseY + bob;
        hmItem.r.scale.setScalar(.85 + S.topo * .25 + (reduceMotion ? 0 : Math.sin(t * 2 + hmItem.ph) * .08));
        hmItem.s.scale.setScalar(.3 + .7 * S.topo);
      }
      for (var j = 0; j < leafNodes.length; j++) {
        var ln = leafNodes[j], localK = Math.max(0, Math.min(1, (S.topo - ln.delay * .4) * 1.3));
        ln.s.scale.setScalar(Math.max(.001, ease(localK)));
        ln.s.position.y = ln.baseY + (1 - localK) * -1.4 + (reduceMotion ? 0 : Math.sin(t * 2.1 + ln.ph) * .22);
      }
    });
    R.topoMats = mats;
  }

  /* ---------------- chuva, rádio, raio, pacote, faíscas ---------------- */
  function buildExtras() {
    // chuva sobre o pátio
    var n = 1800, pos = new Float32Array(n * 6), drop = [];
    for (var i = 0; i < n; i++) drop.push([-62 + Math.random() * 60, Math.random() * 45, -24 + Math.random() * 44]);
    var rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    M.rain = new THREE.LineBasicMaterial({ color: 0xa0c3ec, transparent: true, opacity: 0, depthWrite: false });
    R.rain = add(new THREE.LineSegments(rg, M.rain));
    function rainStep(dt) {
      var a = rg.attributes.position.array;
      for (var i = 0; i < n; i++) {
        var d = drop[i]; d[1] -= dt * 38; d[0] -= dt * 6;
        if (d[1] < 0) { d[1] = 45; d[0] = -62 + Math.random() * 60; }
        a[i * 6] = d[0]; a[i * 6 + 1] = d[1]; a[i * 6 + 2] = d[2]; a[i * 6 + 3] = d[0] + .25; a[i * 6 + 4] = d[1] + 1.5; a[i * 6 + 5] = d[2];
      }
      rg.attributes.position.needsUpdate = true;
    }
    rainStep(0);
    updaters.push(function (dt) { if (S.rain > .02) rainStep(dt); });

    // antenas de rádio (decisão descartada)
    R.radio = add(new THREE.Group());
    M.dish = std(0xdadbdf, { metalness: .3, roughness: .4, transparent: true, opacity: 0 });
    [[-54.6, -2, -Math.PI / 2], [-13.4, -2, Math.PI / 2]].forEach(function (d) {
      var pole = add(new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 3, 8), M.dish), R.radio); pole.position.set(d[0], 7.9, d[1]);
      var dish = add(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), M.dish), R.radio);
      dish.position.set(d[0], 9.3, d[1]); dish.rotation.z = d[2];
    });
    M.beam = basic(C.g4, { transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    var beam = add(new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 41, 16, 1, true), M.beam), R.radio);
    beam.rotation.z = Math.PI / 2; beam.position.set(-34, 9.3, -2);

    // raio
    M.bolt = new THREE.LineBasicMaterial({ color: 0xe6efff, transparent: true, opacity: 0 });
    R.boltLine = null;

    // pacote (Parte 7)
    var key = [R.pc05, V(R.pc05.x, .55, -2.9), V(R.pc05.x, .5, -5.4), V(-9, .55, -6), V(-9, 3.3, -6.1), V(-9, 2.1, -6.05)];
    var fp = R.fiberCurve.points.slice().reverse();
    var op = R.opCurve.points;
    var all = key.concat(fp.slice(1)).concat(op.slice(1));
    R.pkCurve = new THREE.CatmullRomCurve3(all, false, 'centripetal', .2);
    R.pkSteps = [
      { n: 'PC 05', p: R.pc05 }, { n: 'Cabo UTP', p: V(R.pc05.x, .5, -5.4) }, { n: 'Switch 24p · B', p: V(-9, 3.3, -6.1) },
      { n: 'Conversor', p: V(-10.2, .5, -6.2) }, { n: 'Fibra 120 m', p: V(-34, .32, -5.6) }, { n: 'Switch · A', p: V(-57.4, .5, -3.6) },
      { n: 'Roteador', p: V(-58, 6.6, -4.6) }, { n: 'Internet', p: V(-78.5, 21, -37.5) }
    ];
    // posição (u) de cada etapa na curva
    var samples = R.pkCurve.getSpacedPoints(600);
    R.pkSteps.forEach(function (s) {
      var best = 0, bd = 1e9;
      samples.forEach(function (q, i) { var d = q.distanceToSquared(s.p); if (d < bd) { bd = d; best = i; } });
      s.u = best / 600;
    });
    M.pk = basic(0xffffff);
    R.pk = add(new THREE.Mesh(new THREE.SphereGeometry(.55, 20, 20), M.pk));
    R.pkAura = add(new THREE.Mesh(new THREE.SphereGeometry(.95, 16, 16), basic(C.copper, { transparent: true, opacity: .28, depthWrite: false })));
    R.pkRingMat = basic(0xffffff, { transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    R.pkRing = add(new THREE.Mesh(new THREE.RingGeometry(.75, 1, 40), R.pkRingMat));
    R.pkRing.rotation.x = -Math.PI / 2; R.pkRingK = 1; R.pkLastStep = -1;
    R.pkTrail = [];
    for (var t = 0; t < 14; t++) {
      var tm = add(new THREE.Mesh(new THREE.SphereGeometry(.42 * (1 - t / 16), 12, 12), basic(C.copper, { transparent: true, opacity: .7 * (1 - t / 14) })));
      R.pkTrail.push(tm);
    }
    R.pkLight = add(new THREE.PointLight(0xffffff, 0, 16, 2));

    // motes flutuantes (atmosfera espacial Antigravity)
    var mn = 140, mpos = new Float32Array(mn * 3), mseed = [];
    var mtex = canvasTex(64, function (g, s) {
      var gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(.4, 'rgba(255,255,255,.35)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    });
    for (i = 0; i < mn; i++) {
      var mx = -110 + Math.random() * 170, my = 2 + Math.random() * 34, mz = -50 + Math.random() * 75;
      mpos[i * 3] = mx; mpos[i * 3 + 1] = my; mpos[i * 3 + 2] = mz;
      mseed.push({ x: mx, y: my, z: mz, sp: .25 + Math.random() * .55, ph: Math.random() * 10 });
    }
    var mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mpos, 3));
    M.motes = new THREE.PointsMaterial({ color: C.copper, size: .75, map: mtex, transparent: true, opacity: .38, depthWrite: false, blending: THREE.AdditiveBlending });
    R.motes = add(new THREE.Points(mg, M.motes));
    updaters.push(function (dt, t) {
      if (reduceMotion) return;
      var a = mg.attributes.position.array;
      for (var i = 0; i < mn; i++) {
        var s = mseed[i];
        a[i * 3] = s.x + Math.sin(t * s.sp + s.ph) * 1.4;
        a[i * 3 + 1] = s.y + Math.cos(t * s.sp * .8 + s.ph) * 1.1;
        a[i * 3 + 2] = s.z + Math.sin(t * s.sp * .6 + s.ph * 1.3) * 1.2;
      }
      mg.attributes.position.needsUpdate = true;
    });

    // faíscas no rompimento da fibra
    var sn = 160, sp = new Float32Array(sn * 3), sv = [];
    for (i = 0; i < sn; i++) sv.push({ v: V(0, 0, 0), life: 0 });
    var sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    M.spark = new THREE.PointsMaterial({ color: C.fiber, size: .32, transparent: true, opacity: 0, depthWrite: false });
    add(new THREE.Points(sg, M.spark));
    R.breakAt = R.fiberCurve.getPointAt(.5);
    updaters.push(function (dt) {
      var a = sg.attributes.position.array, on = (1 - S.fiber) > .3;
      for (var i = 0; i < sn; i++) {
        var p = sv[i];
        if (p.life <= 0 && on && Math.random() < .08) { p.life = .6 + Math.random() * .6; p.v.set((Math.random() - .5) * 6, 3 + Math.random() * 6, (Math.random() - .5) * 6); a[i * 3] = R.breakAt.x; a[i * 3 + 1] = R.breakAt.y + .2; a[i * 3 + 2] = R.breakAt.z; }
        if (p.life > 0) { p.life -= dt; p.v.y -= dt * 14; a[i * 3] += p.v.x * dt; a[i * 3 + 1] = Math.max(.05, a[i * 3 + 1] + p.v.y * dt); a[i * 3 + 2] += p.v.z * dt; }
        else { a[i * 3 + 1] = -10; }
      }
      sg.attributes.position.needsUpdate = true;
      M.spark.opacity = Math.max(0, 1 - S.fiber);
    });
    // marcação do corte na fibra
    M.cut = basic(C.bad, { transparent: true, opacity: 0, depthWrite: false });
    var cut = add(new THREE.Mesh(new THREE.TorusGeometry(1.2, .06, 8, 40), M.cut)); cut.position.copy(R.breakAt); cut.rotation.x = -Math.PI / 2;
    R.cut = cut;
  }

  function makeBolt() {
    if (R.boltLine) { scene.remove(R.boltLine); R.boltLine.geometry.dispose(); }
    var x = -30 + (Math.random() - .5) * 8, z = 6 + (Math.random() - .5) * 6, pts = [], y = 70;
    var px = x + (Math.random() - .5) * 12, pz = z + (Math.random() - .5) * 8;
    while (y > 0) { pts.push(V(px, y, pz)); y -= 3 + Math.random() * 5; px += (x - px) * .25 + (Math.random() - .5) * 4; pz += (z - pz) * .25 + (Math.random() - .5) * 3; }
    pts.push(V(x, .1, z));
    R.boltLine = line(pts, M.bolt);
    R.flash.position.set(x, 12, z);
  }

  /* ---------------- rótulos ---------------- */
  function buildLabels() {
    label('Bloco A · Admin', V(-62, 8.8, 0), [0, 1]);
    label('Bloco B · Lab + salas', V(0, 8.8, 0), [0, 1]);
    label('Bloco C · Biblioteca', V(34, 8.8, 0), [0, 1]);
    label('Fibra · 120 m · full-duplex', V(-34, 3.2, -5.6), [0, 2], 'fib');
    label('Cobre · 60 m', V(20.5, 6.4, 0), [0, 3], 'cu');
    label('Imune a raios', V(-46, 7, 5), [2], 'fib');
    label('Corredor coberto', V(20.5, 5.4, 2.4), [3]);
    label('Switch 24p · 21 PCs', V(-9, 5.6, -6.6), [4], 'cu');
    label('AP 1 · salas 1–2', V(7.1, 7.4, -3.6), [4], 'wf');
    label('AP 2 · salas 3–4', V(7.1, 7.4, 3.6), [4], 'wf');
    label('Internet · operadora', V(-82, 29.5, -40), [0, 5, 6]);
    label('PC 05', V(R.pc05.x, 3, R.pc05.z), [5], 'cu');
    label('Operadora caiu', V(-63, 18, -26), [6], 'bad');
    label('4G reserva · ativo', V(-104, 29.4, -22), [6], 'g4');
    label('Roteador', V(-58, 5.6, -4.5), [6]);
    label('Nobreak · ligado', V(-56.1, 3.4, -4.5), [7], 'ok');
    label('Sem energia', V(0, 8.8, 0), [7], 'bad');
    label('Sem energia', V(34, 8.8, 0), [7], 'bad');
    label('Bloco A · online', V(-62, 8.8, 0), [7, 8], 'ok');
    label('Fibra rompida', V(R.breakAt.x, 3.6, R.breakAt.z), [8], 'bad');
    label('B e C sem internet', V(0, 8.8, 0), [8], 'bad');
    label('Rádio · 6 créditos · oscila', V(-34, 12.4, -2), [9], 'g4');
    label('Fibra · 12 créditos · estável', V(-34, 2.6, -5.6), [9], 'fib');
  }

  /* =================================================================
     LOOP
     ================================================================= */
  function setTargets() {
    T = { power: 1, fiber: 1, op: 1, topo: 0, rain: 0, packet: 0, lab: 0, final: 0 };
    if (ch === 1) T.topo = 1;
    if (ch === 4) T.lab = 1;
    if (ch === 5) T.packet = 1;
    if (ch === 6) T.op = 0;
    if (ch === 7) T.power = 0;
    if (ch === 8) T.fiber = 0;
    if (ch === 9) T.rain = 1;
    if (ch === 10) T.final = 1;
  }

  var tmpC = new THREE.Color(), red = new THREE.Color(C.bad), cu = new THREE.Color(C.copper), fib = new THREE.Color(0xff5a00), wht = new THREE.Color(0xffffff);

  function frame() {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(clock.getDelta(), .05);
    time += dt; chT += dt;
    var k = 1 - Math.exp(-dt * 2.2);
    for (var key in T) S[key] += (T[key] - S[key]) * k;

    /* ---- efeitos de estado ---- */
    var pw = S.power, fb = S.fiber;
    var flick = fb < .5 ? (Math.random() < .5 ? .25 : 1) : 1;
    // telas: energia e internet
    M.scrB.emissiveIntensity = M.scrC.emissiveIntensity = 1.3 * pw + .02;
    tmpC.copy(cu).lerp(red, (1 - fb) * .85); M.scrB.emissive.copy(tmpC); M.scrC.emissive.copy(tmpC); M.scrP5.emissive.copy(tmpC);
    M.scrP5.emissiveIntensity = (1.3 + S.packet * 2.4) * pw + .02;
    R.lB.intensity = 1.3 * pw; R.lC.intensity = 1.0 * pw;
    M.edgeB.opacity = M.edgeC.opacity = .32 * (.35 + .65 * pw);
    R.nbB.concat(R.nbC).forEach(function (n) { n.scr.material.emissiveIntensity = 1.1 * pw + .02; });
    // fibra
    M.fiber.emissive.copy(fib).lerp(red, 1 - fb); M.fiber.emissiveIntensity = (.55 + S.rain * .2) * (fb > .5 ? 1 : flick) * (.3 + .7 * pw) + .2;
    R.fiberFlows.forEach(function (f) { f.update(dt, time, fb * pw); });
    R.cut.material.opacity = (1 - fb) * (.6 + .4 * Math.sin(time * 6)); R.cut.scale.setScalar(1 + .25 * Math.sin(time * 6));
    // cobre (rede local B–C segue sem internet, mas para sem energia)
    R.copperFlows.forEach(function (f) { f.update(dt, time, pw); });
    M.copper.emissiveIntensity = .7 * (.25 + .75 * pw);
    // racks de B e C
    [R.unitsB, R.unitsC].forEach(function (us) { us.forEach(function (u) { u.mat.emissiveIntensity = 1.4 * pw + .02; }); });
    // operadora × 4G
    var op = S.op;
    M.op.emissive.copy(wht).lerp(red, 1 - op); M.op.emissiveIntensity = .8 * (op > .5 ? 1 : (Math.random() < .5 ? .15 : .7));
    R.opFlows.forEach(function (f) { f.update(dt, time, op); });
    M.g4.opacity = .14 + .8 * (1 - op);
    R.g4Flows.forEach(function (f) { f.update(dt, time, 1 - op); });
    M.g4mast.emissiveIntensity = .6 + 2.6 * (1 - op) * (.6 + .4 * Math.sin(time * 5));
    // nobreak
    var ups = 1 + (1 - pw) * 2.4 * (.65 + .35 * Math.sin(time * 4));
    M.ups.emissiveIntensity = ups; M.ups2.emissiveIntensity = ups * .8;
    // Wi-Fi
    var emph = Math.max(S.lab, S.final);
    R.wifi.forEach(function (w) { w.update(dt, time, pw, emph); });
    R.hd.forEach(function (h, i) {
      var idx = Math.floor(time * 1.6 + i * .5) % h.nbs.length, nb = h.nbs[idx];
      h.l.geometry.setFromPoints([h.ap, nb.p]); h.l.computeLineDistances();
      h.m.opacity = .85 * S.lab * pw;
      h.nbs.forEach(function (n, j) { if (j === idx && S.lab > .2) n.scr.material.emissiveIntensity = 3 * pw; });
    });
    M.cable.opacity = .2 + .55 * S.lab;
    // topologia
    R.topoMats.forEach(function (m) { m.opacity = m.base * S.topo; });
    R.topo.visible = S.topo > .01;
    // chuva / rádio
    M.rain.opacity = .55 * S.rain; R.rain.visible = S.rain > .01;
    M.dish.opacity = S.rain; R.radio.visible = S.rain > .01;
    M.beam.opacity = S.rain * (Math.random() < .35 ? .02 : .1 + Math.random() * .25);
    // raio (capítulo da fibra)
    if (ch === 2) {
      S.bolt -= dt;
      if (S.bolt <= -1.8) { makeBolt(); S.bolt = .45; }
      var b = Math.max(0, S.bolt) / .45;
      M.bolt.opacity = b > 0 ? (Math.random() < .3 ? .2 : 1) * b : 0;
      R.flash.intensity = b * 7;
      R.hemi.intensity = .28 + b * .7;
    } else { M.bolt.opacity = 0; R.flash.intensity = 0; R.hemi.intensity = .28; }
    // pacote (Parte 7)
    var pkOn = S.packet > .05;
    R.pk.visible = pkOn; R.pkAura.visible = pkOn; R.pkTrail.forEach(function (m) { m.visible = pkOn; });
    if (pkOn) {
      var u = ((chT - .8) / 6.5) % 1; if (u < 0) u = 0;
      var e = ease(u);
      R.pk.position.copy(R.pkCurve.getPointAt(e)); R.pk.scale.setScalar(S.packet * (1 + .18 * Math.sin(time * 8)));
      R.pkAura.position.copy(R.pk.position); R.pkAura.scale.setScalar(S.packet * (1 + .32 * Math.sin(time * 5)));
      R.pkLight.position.copy(R.pk.position); R.pkLight.intensity = 4 * S.packet;
      R.pkTrail.forEach(function (m, i) { m.position.copy(R.pkCurve.getPointAt(Math.max(0, ease(Math.max(0, u - (i + 1) * .006))))); });
      var cur = 0; R.pkSteps.forEach(function (s, i) { if (e >= s.u - .004) cur = i; });
      if (cur !== R.pkLastStep) {
        R.pkLastStep = cur;
        R.pkRingK = 0;
        R.pkRing.position.copy(R.pkSteps[cur].p);
      }
      if (R.pkRingK < 1) {
        R.pkRingK = Math.min(1, R.pkRingK + dt * 1.9);
        var rk = ease(R.pkRingK);
        R.pkRing.visible = true;
        R.pkRing.scale.setScalar(.8 + rk * 3.8);
        R.pkRingMat.opacity = (1 - rk) * .8 * S.packet;
      } else { R.pkRing.visible = false; }
      if (stepsEl) {
        for (var i = 0; i < stepKeys.length; i++) stepKeys[i].className = i < cur ? 'done' : (i === cur ? 'on' : '');
      }
    } else { R.pkLight.intensity = 0; R.pkRing.visible = false; }
    // bloom dinâmico sutil
    if (bloomPass) {
      var targetBloom = baseBloom + (ch === 2 && R.flash.intensity > .5 ? .25 : 0);
      bloomPass.strength = lerp(bloomPass.strength, targetBloom, Math.min(1, dt * 4));
    }
    // atualizadores
    for (var j = 0; j < updaters.length; j++) updaters[j](dt, time);

    /* ---- câmera (spring physics + micro-parallax + FOV breathing) ---- */
    if (!camVel) camVel = V(0, 0, 0);
    if (!tgVel) tgVel = V(0, 0, 0);
    springVec(camPos, camVel, wantPos, 17, 7.6, dt);
    springVec(camTg, tgVel, wantTg, 19, 8.2, dt);

    hoverX = lerp(hoverX, reduceMotion ? 0 : hoverTX, Math.min(1, dt * 4.5));
    hoverY = lerp(hoverY, reduceMotion ? 0 : hoverTY, Math.min(1, dt * 4.5));

    if (!dragging) {
      yawUser += yawVel * dt * 60;
      pitchUser += pitchVel * dt * 60;
      yawVel *= Math.pow(.04, dt);
      pitchVel *= Math.pow(.04, dt);
      yawUser *= Math.pow(.22, dt);
      pitchUser *= Math.pow(.22, dt);
    }
    yawUser = Math.max(-1.6, Math.min(1.6, yawUser));
    pitchUser = Math.max(-.5, Math.min(.5, pitchUser));

    var speed = camVel.length();
    var targetFov = reduceMotion ? 40 : (40 + Math.min(4.2, speed * .038));
    var fovF = (targetFov - curFov) * 14;
    fovVel = (fovVel + fovF * dt) * Math.exp(-7 * dt);
    curFov += fovVel * dt;
    if (Math.abs(camera.fov - curFov) > .02) { camera.fov = curFov; camera.updateProjectionMatrix(); }

    var idleYaw = reduceMotion ? 0 : Math.sin(time * .16) * .045;
    var yaw = yawUser + hoverX * .055 + idleYaw + (CH[ch].final ? chT * .06 : 0);
    var rel = camPos.clone().sub(camTg);
    var rad = rel.length(), th = Math.atan2(rel.x, rel.z) + yaw, ph = Math.acos(Math.min(1, Math.max(-1, rel.y / rad)));
    ph = Math.min(1.45, Math.max(.12, ph - pitchUser - hoverY * .032));
    camera.position.set(camTg.x + rad * Math.sin(ph) * Math.sin(th), camTg.y + rad * Math.cos(ph), camTg.z + rad * Math.sin(ph) * Math.cos(th));
    camera.lookAt(camTg);

    /* ---- render ---- */
    if (composer) composer.render(); else renderer.render(scene, camera);

    /* ---- rótulos (interpolação suave + profundidade) ---- */
    var v = new THREE.Vector3(), lk = Math.min(1, dt * 16);
    for (var l = 0; l < labels.length; l++) {
      var L = labels[l], show = L.chs.indexOf(ch) >= 0;
      v.copy(L.p).project(camera);
      if (show && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05) {
        var tx = (v.x + 1) / 2 * W, ty = (1 - v.y) / 2 * H;
        if (!L.hasPos) { L.sx = tx; L.sy = ty; L.hasPos = true; }
        else { L.sx = lerp(L.sx, tx, lk); L.sy = lerp(L.sy, ty, lk); }
        var dist = camera.position.distanceTo(L.p);
        var sc = Math.max(.84, Math.min(1.06, 1.06 - (dist - 35) * .0016));
        L.el.style.transform = 'translate3d(' + L.sx.toFixed(1) + 'px,' + L.sy.toFixed(1) + 'px,0) scale(' + sc.toFixed(3) + ')';
        L.el.classList.add('on');
      } else {
        L.el.classList.remove('on');
        L.hasPos = false;
      }
    }
  }

  /* =================================================================
     HUD / capítulos
     ================================================================= */
  function setChapter(i, instant) {
    ch = Math.max(0, Math.min(CH.length - 1, i)); chT = 0;
    var c = CH[ch];
    wantPos = V(c.cam[0], c.cam[1], c.cam[2]); wantTg = V(c.tg[0], c.tg[1], c.tg[2]);
    if (instant) { camPos = wantPos.clone(); camTg = wantTg.clone(); camVel = V(0, 0, 0); tgVel = V(0, 0, 0); }
    setTargets(); if (instant) for (var k in T) S[k] = T[k];
    if (ch === 2) S.bolt = -1.2;
    R.pkLastStep = -1;
    baseBloom = (ch === 1 || ch === 5 || ch === 6 || ch === 10) ? .64 : .52;
    var visIdx = 0;
    for (var l = 0; l < labels.length; l++) {
      var L = labels[l];
      if (L.chs.indexOf(ch) >= 0) {
        L.el.style.transitionDelay = (instant ? 0 : (140 + visIdx * 75)) + 'ms';
        visIdx++;
      } else {
        L.el.style.transitionDelay = '0ms';
      }
    }
    var cap = host.querySelector('.d3-cap');
    cap.classList.remove('in');
    clearTimeout(setChapter.tm);
    setChapter.tm = setTimeout(function () {
      host.querySelector('.d3-ey').textContent = 'Demo 3D · ' + String(ch + 1).padStart(2, '0') + ' / ' + CH.length + ' · ' + c.ey;
      host.querySelector('.d3-t').textContent = c.t;
      host.querySelector('.d3-s').textContent = c.s;
      cap.classList.toggle('hide', !!c.final);
      cap.classList.add('in');
    }, instant ? 0 : 280);
    host.querySelector('.d3-steps').classList.toggle('on', ch === 5);
    host.querySelector('.d3-final').classList.toggle('on', !!c.final);
    [].forEach.call(host.querySelectorAll('.d3-dots button'), function (b, j) { b.classList.toggle('on', j === ch); b.classList.toggle('done', j < ch); });
  }

  function init() {
    host = document.querySelector('.slide.demo');
    if (!host) return false;
    if (!window.THREE) { host.querySelector('.d3-fallback').style.display = 'grid'; return false; }
    canvas = host.querySelector('canvas.d3');
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (e) { host.querySelector('.d3-fallback').style.display = 'grid'; return false; }
    renderer.setSize(W, H, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    fitDPR();
    buildScene();
    if (THREE.EffectComposer && THREE.UnrealBloomPass) {
      composer = new THREE.EffectComposer(renderer);
      composer.addPass(new THREE.RenderPass(scene, camera));
      bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(W, H), .52, .45, .62);
      composer.addPass(bloomPass);
      composer.setSize(W, H);
    }
    buildLabels();

    // lista de etapas da Parte 7
    stepsEl = host.querySelector('.d3-steps');
    stepsEl.innerHTML = R.pkSteps.map(function (s, i) { return '<li><b>' + String(i + 1).padStart(2, '0') + '</b>' + s.n + '</li>'; }).join('');
    stepKeys = [].slice.call(stepsEl.querySelectorAll('li'));

    // bolinhas de capítulo
    var dots = host.querySelector('.d3-dots');
    dots.innerHTML = CH.map(function (c, i) { return '<button title="' + (c.t || c.ey) + '">' + String(i + 1).padStart(2, '0') + '</button>'; }).join('');
    [].forEach.call(dots.querySelectorAll('button'), function (b, i) { b.addEventListener('click', function (e) { e.stopPropagation(); setChapter(i); }); });

    // arrastar para girar + micro-parallax no hover
    var lx = 0, ly = 0;
    canvas.addEventListener('pointerdown', function (e) { dragging = true; yawVel = 0; pitchVel = 0; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', function (e) {
      var rect = canvas.getBoundingClientRect();
      hoverTX = ((e.clientX - rect.left) / Math.max(1, rect.width) - .5) * 2;
      hoverTY = ((e.clientY - rect.top) / Math.max(1, rect.height) - .5) * 2;
      if (!dragging) return;
      var dy = -(e.clientX - lx) * .005, dp = (e.clientY - ly) * .003;
      yawUser += dy; pitchUser += dp;
      yawVel = dy * .45; pitchVel = dp * .45;
      lx = e.clientX; ly = e.clientY;
      yawUser = Math.max(-1.6, Math.min(1.6, yawUser)); pitchUser = Math.max(-.5, Math.min(.5, pitchUser));
    });
    canvas.addEventListener('pointerleave', function () { hoverTX = 0; hoverTY = 0; });
    canvas.addEventListener('pointerup', function () { dragging = false; });
    addEventListener('resize', fitDPR);

    clock = new THREE.Clock();
    ready = true;
    return true;
  }

  function fitDPR() {
    if (!renderer) return;
    var s = Math.min(innerWidth / W, innerHeight / H);
    var pr = Math.max(.6, Math.min(1.5, s * (devicePixelRatio || 1)));
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    if (composer) composer.setSize(W, H);
  }

  /* =================================================================
     API usada pela apresentação
     ================================================================= */
  window.DEMO3D = {
    enter: function (fromEnd, startAt) {
      if (!ready && !init()) return;
      active = true;
      var first = startAt != null ? startAt : (fromEnd ? CH.length - 1 : 0);
      if (!camPos) { camPos = V(-40, 140, 190); camTg = V(-30, 0, -8); }
      setChapter(first, startAt != null);
      clock.getDelta();
      cancelAnimationFrame(raf); frame();
    },
    leave: function () { active = false; cancelAnimationFrame(raf); },
    next: function () { if (!active || ch >= CH.length - 1) return false; setChapter(ch + 1); return true; },
    prev: function () { if (!active || ch <= 0) return false; setChapter(ch - 1); return true; },
    go: function (i) { setChapter(i); }
  };
})();
