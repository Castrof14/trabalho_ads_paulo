/* =====================================================================
   people3d.js · personagens vivos para a demo 3D
   - bonecos low-poly articulados (quadril, joelhos, ombros, cotovelos, cabeça)
   - caminhada procedural, respiração, piscadas, expressões
   - roteiro por capítulo + reações ao estado da cena (raio, falta de energia, chuva…)
   - hover = nome · clique = reação + balão de fala
   Conecta-se via window.DEMO3D_EXT (gancho em demo3d.js).
   ===================================================================== */
(function () {
  'use strict';

  (window.DEMO3D_EXT = window.DEMO3D_EXT || []).push(function (api) {
    var THREE = api.THREE, scene = api.scene, camera = api.camera, R = api.R, S = api.S, V = api.V;
    var RM = api.reduceMotion;
    var TAU = Math.PI * 2;

    /* ---------------- estilos (balões e etiquetas) ---------------- */
    var css = document.createElement('style');
    css.textContent = [
      '.p3d-layer{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2}',
      '.p3d-b{position:absolute;left:0;top:0;will-change:transform;opacity:0;transition:opacity .25s}',
      '.p3d-b.on{opacity:1}',
      '.p3d-b>div{transform-origin:50% 100%;transform:translate(-50%,-100%) scale(.4);transition:transform .55s cubic-bezier(.34,1.56,.64,1);',
      '  background:#fff;color:#0a0a0a;font:500 21px/1.25 Inter,system-ui,sans-serif;letter-spacing:-.2px;padding:12px 18px;border-radius:18px;white-space:nowrap;',
      '  box-shadow:0 10px 40px -10px rgba(0,0,0,.6);margin-top:-14px;position:relative}',
      '.p3d-b.on>div{transform:translate(-50%,-100%) scale(1)}',
      '.p3d-b>div:after{content:"";position:absolute;left:50%;bottom:-7px;width:14px;height:14px;background:inherit;transform:translateX(-50%) rotate(45deg);border-radius:3px}',
      '.p3d-n{position:absolute;left:0;top:0;will-change:transform;opacity:0;transition:opacity .25s}',
      '.p3d-n.on{opacity:1}',
      '.p3d-n>div{transform:translate(-50%,-100%);margin-top:-10px;font:400 14px/1 "Geist Mono",ui-monospace,monospace;letter-spacing:1.6px;text-transform:uppercase;',
      '  color:#fff;padding:7px 12px;border-radius:999px;background:rgba(10,10,10,.7);border:1px solid var(--pc,#a0c3ec);backdrop-filter:blur(6px);white-space:nowrap}',
      '.p3d-n>div b{font-weight:400;color:var(--pc,#a0c3ec);margin-left:8px}',
      '.p3d-hint{position:absolute;left:50%;top:118px;transform:translateX(-50%);font:400 15px/1 "Geist Mono",ui-monospace,monospace;letter-spacing:1.8px;',
      '  text-transform:uppercase;color:#dadbdf;padding:9px 16px;border-radius:999px;background:rgba(10,10,10,.55);border:1px solid rgba(255,255,255,.16);',
      '  opacity:0;transition:opacity .8s;pointer-events:none}',
      '.p3d-hint.on{opacity:1}'
    ].join('\n');
    document.head.appendChild(css);
    var layer = document.createElement('div'); layer.className = 'p3d-layer';
    api.host.appendChild(layer);
    var hint = document.createElement('div'); hint.className = 'p3d-hint'; hint.textContent = 'clique nos personagens';
    layer.appendChild(hint);

    /* ---------------- geometrias compartilhadas ---------------- */
    var G = {
      head: new THREE.SphereGeometry(.2, 20, 16),
      hair: new THREE.SphereGeometry(.215, 20, 12, 0, TAU, 0, Math.PI * .55),
      bun: new THREE.SphereGeometry(.09, 12, 10),
      eye: new THREE.SphereGeometry(.028, 10, 8),
      brow: new THREE.BoxGeometry(.07, .014, .014),
      smile: new THREE.TorusGeometry(.055, .011, 6, 16, Math.PI),
      mouthO: new THREE.CircleGeometry(.03, 14),
      torso: new THREE.CylinderGeometry(.2, .17, .58, 14),
      shoulder: new THREE.SphereGeometry(.085, 10, 8),
      upper: new THREE.CylinderGeometry(.06, .055, .3, 8),
      lower: new THREE.CylinderGeometry(.052, .046, .28, 8),
      hand: new THREE.SphereGeometry(.06, 10, 8),
      thigh: new THREE.CylinderGeometry(.085, .07, .42, 8),
      shin: new THREE.CylinderGeometry(.065, .055, .42, 8),
      shoe: new THREE.BoxGeometry(.13, .08, .26),
      pelvis: new THREE.CylinderGeometry(.17, .15, .16, 12),
      cap: new THREE.CylinderGeometry(.215, .22, .09, 18),
      visor: new THREE.BoxGeometry(.3, .02, .16),
      helmet: new THREE.SphereGeometry(.235, 18, 10, 0, TAU, 0, Math.PI * .5),
      glasses: new THREE.TorusGeometry(.045, .008, 6, 14),
      bag: new THREE.BoxGeometry(.3, .36, .14),
      shadow: new THREE.CircleGeometry(.42, 20),
      phone: new THREE.BoxGeometry(.07, .13, .015),
      umbStick: new THREE.CylinderGeometry(.012, .012, .9, 6),
      umbTop: new THREE.ConeGeometry(.75, .32, 10, 1, true),
      tool: new THREE.BoxGeometry(.04, .26, .04),
      toolbox: new THREE.BoxGeometry(.38, .2, .18),
      stool: new THREE.CylinderGeometry(.2, .18, .08, 12),
      stoolLeg: new THREE.CylinderGeometry(.03, .03, .42, 6),
      ball: new THREE.IcosahedronGeometry(.16, 1)
    };
    var mBlack = new THREE.MeshBasicMaterial({ color: 0x111111 });
    var mWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var mShadow = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .32, depthWrite: false });
    var mStool = api.std(0x2a2e35, { roughness: .6 });
    var mPhone = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0xdfe8ff, emissiveIntensity: 0 });
    function std(c, o) { return api.std(c, o); }

    /* ---------------- boneco ---------------- */
    function mesh(g, m, p, x, y, z, shadow) {
      var o = new THREE.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0);
      if (shadow) o.castShadow = true;
      p.add(o); return o;
    }
    function pivot(p, x, y, z) { var g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; }

    function Person(o) {
      var P = this;
      P.name = o.name; P.role = o.role; P.color = o.shirt; P.lines = o.lines || ['Oi!'];
      P.sc = o.h || 1;
      var skin = std(o.skin || 0xe0b48f, { roughness: .7 });
      P.shirtM = std(o.shirt, { roughness: .75, emissive: o.shirt, emissiveIntensity: 0 });
      var pants = std(o.pants || 0x1f2430, { roughness: .8 });
      var hairM = std(o.hair || 0x2a1b12, { roughness: .9 });
      var shoeM = std(o.shoe || 0xf2f2f2, { roughness: .6 });

      var root = P.root = new THREE.Group(); scene.add(root);
      root.scale.setScalar(P.sc);
      P.shadow = mesh(G.shadow, mShadow, root, 0, .02, 0); P.shadow.rotation.x = -Math.PI / 2;
      var body = P.body = pivot(root, 0, 0, 0);
      var hips = P.hips = pivot(body, 0, .92, 0);
      mesh(G.pelvis, pants, hips, 0, -.02, 0);
      // pernas
      function leg(side) {
        var th = pivot(hips, side * .1, -.04, 0);
        mesh(G.thigh, pants, th, 0, -.21, 0, true);
        var kn = pivot(th, 0, -.42, 0);
        mesh(G.shin, pants, kn, 0, -.21, 0);
        var ft = pivot(kn, 0, -.42, 0);
        mesh(G.shoe, shoeM, ft, 0, -.02, .05);
        return { th: th, kn: kn, ft: ft };
      }
      P.lL = leg(1); P.lR = leg(-1);
      // tronco
      var spine = P.spine = pivot(hips, 0, .04, 0);
      P.torso = mesh(G.torso, P.shirtM, spine, 0, .3, 0, true);
      if (o.bag) mesh(G.bag, std(o.bag, { roughness: .8 }), spine, 0, .32, -.2);
      function arm(side) {
        var sh = pivot(spine, side * .25, .54, 0);
        mesh(G.shoulder, P.shirtM, sh, 0, 0, 0);
        mesh(G.upper, P.shirtM, sh, 0, -.15, 0);
        var el = pivot(sh, 0, -.3, 0);
        mesh(G.lower, skin, el, 0, -.14, 0);
        var hd = pivot(el, 0, -.3, 0);
        mesh(G.hand, skin, hd, 0, 0, 0);
        return { sh: sh, el: el, hd: hd };
      }
      P.aL = arm(1); P.aR = arm(-1);
      // cabeça
      var neck = P.neck = pivot(spine, 0, .66, 0);
      var head = P.head = pivot(neck, 0, .17, 0);
      P.headM = mesh(G.head, skin, head, 0, 0, 0, true);
      var hr = mesh(G.hair, hairM, head, 0, .02, -.012); hr.rotation.x = -.25;
      if (o.style === 'bun') mesh(G.bun, hairM, head, 0, .17, -.12);
      if (o.style === 'long') { var lh = mesh(G.torso, hairM, head, 0, -.1, -.1); lh.scale.set(.95, .55, .55); }
      if (o.style === 'cap') { mesh(G.cap, std(o.capC || 0x7c3aed), head, 0, .15, 0); mesh(G.visor, std(o.capC || 0x7c3aed), head, 0, .12, .2); }
      if (o.style === 'helmet') { mesh(G.helmet, std(0xffc285, { roughness: .4 }), head, 0, .03, 0); }
      // rosto
      var face = P.face = pivot(head, 0, 0, 0);
      P.eyeL = mesh(G.eye, mBlack, face, .075, .03, .18); P.eyeR = mesh(G.eye, mBlack, face, -.075, .03, .18);
      var gl = mesh(G.eye, mWhite, face, .085, .045, .2); gl.scale.setScalar(.35);
      gl = mesh(G.eye, mWhite, face, -.065, .045, .2); gl.scale.setScalar(.35);
      P.browL = mesh(G.brow, hairM, face, .075, .1, .18); P.browR = mesh(G.brow, hairM, face, -.075, .1, .18);
      P.smile = mesh(G.smile, mBlack, face, 0, -.055, .185); P.smile.rotation.z = Math.PI;
      P.mouthO = mesh(G.mouthO, mBlack, face, 0, -.075, .197); P.mouthO.visible = false;
      if (o.glasses) {
        var gm = new THREE.MeshBasicMaterial({ color: 0x222222 });
        mesh(G.glasses, gm, face, .075, .03, .195); mesh(G.glasses, gm, face, -.075, .03, .195);
      }
      // adereços
      P.phone = mesh(G.phone, mPhone, P.aR.hd, 0, -.03, .06); P.phone.visible = false;
      P.umb = pivot(P.aL.hd, 0, 0, 0); P.umb.visible = false;
      mesh(G.umbStick, std(0x222222), P.umb, 0, .42, 0);
      var ut = mesh(G.umbTop, std(o.umb || 0xff7a17, { side: THREE.DoubleSide, roughness: .5 }), P.umb, 0, .95, 0); ut.castShadow = true;
      if (o.tool) { P.tool = mesh(G.tool, std(0xdadbdf, { metalness: .7, roughness: .3 }), P.aR.hd, 0, -.08, .04); P.tool.visible = false; }
      if (o.toolbox) { P.toolbox = mesh(G.toolbox, std(0xff7a17), P.aL.hd, 0, -.14, 0); }

      // hit-test
      P.hit = [P.torso, P.headM];
      P.hit.forEach(function (m) { m.userData.person = P; });

      // estado
      P.pos = V(o.x, o.y || 0, o.z); P.heading = o.rot || 0; P.wantHeading = P.heading;
      P.floor = o.y || 0; P.speed = 0; P.walkPh = Math.random() * TAU;
      P.home = { x: o.x, z: o.z, rot: o.rot || 0, y: o.y || 0 };
      P.mode = o.mode || 'stand'; // stand | sit | walk | wander
      P.path = null; P.pi = 0; P.wait = Math.random() * 3;
      P.act = null; P.actT = 0; P.actDur = 0;
      P.blinkT = 1 + Math.random() * 3; P.blink = 0;
      P.expr = 'smile'; P.look = null; P.lookYaw = 0; P.lookPitch = 0;
      P.inside = (o.y || 0) > 0; P.flinch = 0;
      P.seed = Math.random() * 100; P.cool = 0; P.hover = 0; P.jumpY = 0;
      P.cur = {}; // ângulos atuais (suavizados)
      P.bubble = null; P.tag = null;
      root.position.copy(P.pos); root.rotation.y = P.heading;
    }

    /* ---------------- balões ---------------- */
    Person.prototype.say = function (txt, dur) {
      var P = this;
      if (!P.bubble) {
        P.bubble = document.createElement('div'); P.bubble.className = 'p3d-b';
        P.bubble.innerHTML = '<div></div>'; layer.appendChild(P.bubble);
      }
      P.bubble.firstChild.textContent = txt;
      P.bubble.classList.remove('on'); void P.bubble.offsetWidth; P.bubble.classList.add('on');
      P.sayT = dur || 3.2;
    };
    Person.prototype.hush = function () { if (this.bubble) this.bubble.classList.remove('on'); this.sayT = 0; };
    Person.prototype.do = function (act, dur, expr) {
      this.act = act; this.actT = 0; this.actDur = dur || 2; if (expr) this.expr = expr;
    };
    Person.prototype.goTo = function (pts, run, then) {
      this.path = pts.map(function (p) { return V(p[0], p[2] != null ? p[1] : 0, p[2] != null ? p[2] : p[1]); });
      this.pi = 0; this.run = !!run; this.then = then || null; this.mode = 'walk';
    };

    /* ---------------- elenco ---------------- */
    var people = [], byId = {};
    function cast(id, o) { var p = new Person(o); p.id = id; people.push(p); byId[id] = p; return p; }

    var labY = .4;
    function seat(x, z) { // banquinho no laboratório / secretaria (usuário senta em z+0.75, olhando para -z)
      var g = new THREE.Group(); g.position.set(x, labY, z + .78); scene.add(g);
      mesh(G.stool, mStool, g, 0, .46, 0);
      [[.12, .12], [-.12, .12], [.12, -.12], [-.12, -.12]].forEach(function (q) { mesh(G.stoolLeg, mStool, g, q[0], .21, q[1]); });
      return { x: x, z: z + .78 };
    }

    // laboratório (Bloco B) — PC 05 em x=-5, z=-2.4
    var labSeats = [[-12, -2.4], [-8.5, -2.4], [-5, -2.4], [-1.5, -2.4], [-10.25, .7], [-6.75, .7], [-3.25, .7], [-8.5, 3.8], [-1.5, 3.8]];
    var studentLook = [
      { shirt: 0xa0c3ec, hair: 0x1b120c, skin: 0xc68e62, style: 'cap', capC: 0xff7a17 },
      { shirt: 0xffc285, hair: 0x3a2416, skin: 0xf1c7a3, style: 'long' },
      { shirt: 0x6ee7b7, hair: 0x0f0b08, skin: 0x8d5b3c },
      { shirt: 0xc4b5fd, hair: 0x6b3f22, skin: 0xe8b996, style: 'bun', glasses: true },
      { shirt: 0xff7a17, hair: 0x151010, skin: 0xb07a52 },
      { shirt: 0xdadbdf, hair: 0x2a1b12, skin: 0xf5d2b5, style: 'long' },
      { shirt: 0x7c3aed, hair: 0x120d0a, skin: 0x7a4a2e, style: 'cap', capC: 0xa0c3ec },
      { shirt: 0xa0c3ec, hair: 0x5a3a20, skin: 0xe0b48f, glasses: true },
      { shirt: 0xffc285, hair: 0x1b120c, skin: 0xc68e62, style: 'bun' }
    ];
    var studentLines = ['Wi-Fi? Aqui é cabo, parceiro 😎', 'Videoaula em 1080p sem travar!', 'Full-duplex: mando e recebo junto!', 'Meu PC tem cabo próprio 🔌', 'Partiu pesquisa!', 'Nada de lag hoje 🚀'];
    labSeats.forEach(function (s, i) {
      var st = seat(s[0], s[1]);
      var lk = studentLook[i];
      cast(i === 2 ? 'pc05' : 'lab' + i, Object.assign({ name: i === 2 ? 'Aluno · PC 05' : 'Aluno', role: 'laboratório', x: st.x, z: st.z, y: labY, rot: Math.PI, mode: 'sit', h: .9 + Math.random() * .06,
        lines: studentLines, bag: i % 3 === 0 ? 0x2a2e35 : null }, lk));
    });

    // Bloco A
    var secSeat = seat(-68, -1.2);
    cast('sec', { name: 'Secretária', role: 'Bloco A', x: secSeat.x, z: secSeat.z, y: labY, rot: Math.PI, mode: 'sit', shirt: 0x6ee7b7, hair: 0x3a2416, skin: 0xe8b996, style: 'long', glasses: true,
      lines: ['Matrículas em dia ✔', 'O sistema da prefeitura nunca cai aqui', 'Nobreak é vida ⚡'] });
    cast('dir', { name: 'Diretora', role: 'Bloco A', x: -62, z: 3.6, y: labY, rot: .4, shirt: 0x7c3aed, pants: 0x2a1f3a, hair: 0x1b120c, skin: 0xb07a52, style: 'bun', h: 1.02,
      lines: ['Confiabilidade em 1º lugar!', 'E um roteador no pátio? Nem pensar 😅', '83 créditos, nenhum desperdiçado'] });

    // Bloco B · professora na sala de aula
    cast('prof', { name: 'Professora', role: 'sala de aula', x: 2.4, z: -3.4, y: labY, rot: Math.PI / 2, shirt: 0xff7a17, pants: 0x23272d, hair: 0x6b3f22, skin: 0xf1c7a3, style: 'long', glasses: true, h: 1.02,
      lines: ['Notebook no Wi-Fi da sala ✔', 'Half-duplex: um fala de cada vez!', 'Abram o livro na página 42 📚'] });

    // Bloco C · bibliotecária
    var libSeat = seat(34.8, -1.4);
    cast('lib', { name: 'Bibliotecária', role: 'Bloco C', x: libSeat.x, z: libSeat.z, y: labY, rot: Math.PI, mode: 'sit', shirt: 0xc4b5fd, hair: 0xb9b3ad, skin: 0xf5d2b5, style: 'bun', glasses: true,
      lines: ['Shhh… 🤫', 'Pesquisa estável, sem oscilação', '4 PCs no cabo, 1 AP pros professores'] });

    // técnico de rede
    cast('tec', { name: 'Técnico de rede', role: 'infraestrutura', x: -40, z: 7, rot: 0, shirt: 0xff7a17, pants: 0x1a2440, hair: 0x151010, skin: 0xc68e62, style: 'helmet', tool: true, toolbox: true, h: 1.04,
      lines: ['Fibra não conduz raio ⚡', 'Cobre até 100 m. Passou disso: fibra!', 'Conector limpo, sinal perfeito ✨'] });

    // pátio · alunos passeando + dupla com bola
    var patioLines = ['Bora pro intervalo! 🏃', 'Que sol hein ☀️', 'A rede aqui é top', 'Oiê! 👋'];
    cast('w1', { name: 'Aluna', role: 'pátio', x: -48, z: 11, shirt: 0xc4b5fd, hair: 0x0f0b08, skin: 0x8d5b3c, style: 'long', mode: 'wander', h: .9, bag: 0xff7a17, umb: 0xc4b5fd, lines: patioLines });
    cast('w2', { name: 'Aluno', role: 'pátio', x: -20, z: 12.5, shirt: 0xa0c3ec, hair: 0x2a1b12, skin: 0xe0b48f, mode: 'wander', h: .92, bag: 0x2a2e35, umb: 0xa0c3ec, lines: patioLines });
    cast('w3', { name: 'Aluno', role: 'pátio', x: 8, z: 11, shirt: 0x6ee7b7, hair: 0x1b120c, skin: 0xc68e62, style: 'cap', capC: 0x7c3aed, mode: 'wander', h: .9, umb: 0x6ee7b7, lines: patioLines });
    cast('b1', { name: 'Aluno', role: 'futebol', x: -33, z: 13, shirt: 0xffc285, hair: 0x151010, skin: 0x7a4a2e, h: .9, umb: 0xffc285, lines: ['Passa a bola! ⚽', 'Golaço!'] });
    cast('b2', { name: 'Aluna', role: 'futebol', x: -26, z: 16, shirt: 0xff7a17, hair: 0x3a2416, skin: 0xf1c7a3, style: 'bun', h: .9, umb: 0xff7a17, lines: ['Toma essa! ⚽', 'Defendi!'] });

    var patioIds = ['w1', 'w2', 'w3', 'b1', 'b2', 'tec'];
    var walkLoop = [[-50, 10], [-36, 13.5], [-22, 10.5], [-8, 13], [6, 10], [18, 12.5], [6, 14], [-12, 11], [-30, 14], [-44, 12]];

    // bola
    var ball = new THREE.Mesh(G.ball, std(0xffffff, { roughness: .5, flatShading: true })); ball.castShadow = true; scene.add(ball);
    var ballSh = mesh(G.shadow, mShadow, scene, 0, .02, 0); ballSh.rotation.x = -Math.PI / 2; ballSh.scale.setScalar(.4);
    var B = { from: 'b1', to: 'b2', t: 1, dur: 1.15, hold: .6, on: true };

    /* ---------------- confete ---------------- */
    var CN = 260, cGeo = new THREE.BufferGeometry(), cPos = new Float32Array(CN * 3), cCol = new Float32Array(CN * 3), cV = [], cLife = new Float32Array(CN);
    var pal = [0xff7a17, 0xffc285, 0xa0c3ec, 0xc4b5fd, 0x6ee7b7, 0xffffff].map(function (c) { return new THREE.Color(c); });
    for (var ci = 0; ci < CN; ci++) { cV.push(V(0, 0, 0)); var pc = pal[ci % pal.length]; cCol[ci * 3] = pc.r; cCol[ci * 3 + 1] = pc.g; cCol[ci * 3 + 2] = pc.b; cPos[ci * 3 + 1] = -99; }
    cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
    cGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3));
    var confetti = new THREE.Points(cGeo, new THREE.PointsMaterial({ size: .32, vertexColors: true, transparent: true, depthWrite: false }));
    confetti.frustumCulled = false; scene.add(confetti);
    var cNext = 0;
    function burst(p, n, power) {
      for (var i = 0; i < n; i++) {
        var k = cNext = (cNext + 1) % CN;
        cPos[k * 3] = p.x; cPos[k * 3 + 1] = p.y; cPos[k * 3 + 2] = p.z;
        var a = Math.random() * TAU, s = (power || 6) * (.4 + Math.random() * .6);
        cV[k].set(Math.cos(a) * s * .5, s * (.8 + Math.random() * .6), Math.sin(a) * s * .5);
        cLife[k] = 2.2 + Math.random() * 1.4;
      }
    }

    /* ---------------- roteiro por capítulo ---------------- */
    var gather = [[-40, 15], [-36, 17], [-32, 18.4], [-28, 18.4], [-24, 17], [-20, 15]];
    function resetAll() {
      people.forEach(function (p) {
        p.act = null; p.expr = 'smile'; p.look = null; p.hush(); p.umbOn = false; p.phoneOn = false; p.toolOn = false;
        p.script = null; p.flinch = 0;
      });
      B.on = true;
    }
    function homeStand(p, run) {
      var h = p.home;
      p.goTo([[h.x, h.y, h.z]], run, function () { p.mode = 'stand'; p.wantHeading = h.rot; });
    }
    function after(p, t, fn) { (p.timers = p.timers || []).push({ t: t, fn: fn }); }

    function onChapter(ch) {
      resetAll();
      people.forEach(function (p) { p.timers = []; });
      var tec = byId.tec, dir = byId.dir, sec = byId.sec, prof = byId.prof, lib = byId.lib, pc05 = byId.pc05;
      // modos base
      ['w1', 'w2', 'w3'].forEach(function (id) { var p = byId[id]; if (p.mode !== 'walk' || p.gathering) { p.gathering = false; p.mode = 'wander'; p.path = null; } });
      if (ch !== 10) { ['b1', 'b2'].forEach(function (id) { var p = byId[id]; if (p.gathering) { p.gathering = false; homeStand(p); } }); }
      if (ch !== 8 && ch !== 9 && ch !== 2 && ch !== 10) { tec.mode = 'wander'; tec.path = null; }

      switch (ch) {
        case 0:
          after(dir, .9, function () { dir.do('wave', 2.2); dir.say('Bem-vindos à nossa escola! 👋', 3.4); });
          after(byId.w2, 2.6, function () { byId.w2.do('wave', 1.8); });
          break;
        case 1:
          people.forEach(function (p, i) { if (p.mode !== 'sit') p.look = 'up'; });
          after(tec, .6, function () { tec.do('point', 3.5); tec.say('Olha a estrela estendida! ⭐', 3.4); });
          after(byId.w1, 1.4, function () { byId.w1.do('wow', 2.6, 'o'); });
          break;
        case 2:
          tec.goTo([[-38, 1.6]], true, function () { tec.mode = 'stand'; tec.wantHeading = 0; });
          after(tec, 2.4, function () { tec.do('thumbs', 3); tec.say('Fibra é vidro: não conduz raio ⚡', 3.6); });
          break;
        case 3:
          var w3 = byId.w3; w3.gathering = true; // passa pelo corredor coberto B → C
          w3.pos.set(14.3, 0, -1.2); w3.heading = w3.wantHeading = Math.PI / 2;
          w3.goTo([[17, .2], [22.5, .4], [25.5, 1.6]], false, function () { w3.mode = 'stand'; w3.look = 'cam'; w3.do('wave', 2); });
          after(w3, 1.6, function () { w3.say('Corredor coberto: cabo protegido ☂️', 3.6); });
          break;
        case 4:
          after(prof, .5, function () { prof.do('talk', 6); prof.say('Wi-Fi nas salas, cabo no lab!', 3.2); });
          after(byId.lab4, 2.2, function () { byId.lab4.do('raise', 2.6); byId.lab4.say('Professora, é full-duplex? ✋', 2.8); });
          after(prof, 5, function () { prof.do('thumbs', 2); prof.say('No cabo, sim! 👍', 2.4); });
          break;
        case 5:
          pc05.script = 'packet';
          after(pc05, .4, function () { pc05.say('Abrindo a videoaula… ▶️', 2.4); });
          break;
        case 6:
          sec.phoneOn = true;
          after(sec, .4, function () { sec.do('phone', 3.2, 'o'); sec.say('Alô, operadora?! 📞', 2.8); });
          after(sec, 3.8, function () { sec.phoneOn = false; sec.do('cheer', 2.2); sec.say('Ufa! O 4G assumiu 🙌', 3.2); });
          after(dir, 4.6, function () { dir.do('thumbs', 2.2); });
          break;
        case 7:
          after(sec, 1.2, function () { sec.do('thumbs', 2.6); sec.say('Nobreak segurou! ⚡', 3); });
          ['lab0', 'lab1', 'pc05', 'lab3', 'lab5', 'lab7'].forEach(function (id, i) {
            var p = byId[id];
            after(p, .3 + i * .18, function () { p.do(i % 2 ? 'scared' : 'shrug', 2.4, 'o'); p.phoneOn = true; });
          });
          after(byId.lab1, 1.1, function () { byId.lab1.say('Apagou tudo?! 😱', 2.6); });
          after(lib, .7, function () { lib.do('scared', 2.2, 'o'); lib.phoneOn = true; });
          break;
        case 8:
          tec.goTo([[R.breakAt.x - .4, 1.5]], true, function () { tec.mode = 'stand'; tec.wantHeading = Math.PI; tec.script = 'repair'; tec.toolOn = true; });
          after(tec, .3, function () { tec.say('Deixa comigo! 🔧', 2); });
          after(byId.lab3, 1, function () { byId.lab3.do('shrug', 2.4, 'o'); byId.lab3.say('Cadê a internet? 🤔', 2.6); });
          after(dir, 2.6, function () { dir.do('thumbs', 2); dir.say('Aqui no A segue on-line ✔', 2.8); });
          break;
        case 9:
          patioIds.forEach(function (id) { var p = byId[id]; p.umbOn = true; });
          B.on = false;
          tec.goTo([[-36, 2.2]], true, function () { tec.mode = 'stand'; tec.wantHeading = .2; tec.look = 'up'; });
          after(tec, 2.4, function () { tec.do('nope', 2.6); tec.say('Rádio na chuva? Oscila! 🌧️', 3.2); });
          after(byId.w2, 1.2, function () { byId.w2.say('Molhou tudo! ☔', 2.4); });
          break;
        case 10:
          B.on = false;
          ['w1', 'w2', 'w3', 'b1', 'b2', 'tec'].forEach(function (id, i) {
            var p = byId[id]; p.gathering = true;
            p.goTo([gather[i]], true, function () { p.mode = 'stand'; p.look = 'cam'; p.wantHeading = 0; });
          });
          after(byId.tec, 3.2, function () { finale = 1; });
          break;
      }
    }
    var finale = 0;
    api.onChapter.push(function (ch) { finale = 0; onChapter(ch); });

    /* ---------------- interação ---------------- */
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hitList = [];
    people.forEach(function (p) { hitList = hitList.concat(p.hit); });
    var hovered = null, downX = 0, downY = 0, canvas = api.canvas;
    function pick(e) {
      var r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      var h = ray.intersectObjects(hitList, false);
      return h.length ? h[0].object.userData.person : null;
    }
    canvas.addEventListener('pointermove', function (e) {
      if (api.isDragging()) return;
      var p = pick(e);
      if (p !== hovered) {
        if (hovered) hovered.hoverOn = false;
        hovered = p; if (p) p.hoverOn = true;
        canvas.style.cursor = p ? 'pointer' : '';
      }
    });
    canvas.addEventListener('pointerleave', function () { if (hovered) hovered.hoverOn = false; hovered = null; canvas.style.cursor = ''; });
    canvas.addEventListener('pointerdown', function (e) { downX = e.clientX; downY = e.clientY; });
    canvas.addEventListener('pointerup', function (e) {
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 6) return;
      var p = pick(e); if (!p) return;
      react(p);
    });
    var reacts = ['jump', 'dance', 'cheer', 'wave', 'spin'];
    function react(p) {
      var a = reacts[(p.rc = ((p.rc || Math.floor(Math.random() * 5)) + 1) % reacts.length)];
      p.do(a, a === 'dance' ? 2.6 : 1.8, a === 'jump' || a === 'spin' ? 'o' : 'smile');
      p.say(p.lines[(p.li = ((p.li || 0) + 1) % p.lines.length)], 2.8);
      p.look = 'cam';
      clearTimeout(p.lookTm); p.lookTm = setTimeout(function () { if (p.look === 'cam' && !p.gathering) p.look = null; }, 3200);
      if (a === 'cheer' || a === 'jump') burst(V(p.pos.x, p.pos.y + 2, p.pos.z), 30, 5);
      // quem está perto olha
      people.forEach(function (q) {
        if (q === p || q.mode === 'walk') return;
        if (q.pos.distanceTo(p.pos) < 7) { q.look = p; clearTimeout(q.lookTm); q.lookTm = setTimeout(function () { if (q.look === p) q.look = null; }, 2600); }
      });
    }

    /* ---------------- animação ---------------- */
    var tmp = V(0, 0, 0), camW = V(0, 0, 0);
    function angDiff(a, b) { var d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
    function sm(P, key, target, k) { var c = P.cur; if (c[key] == null) c[key] = target; c[key] += (target - c[key]) * k; return c[key]; }

    function brain(P, dt, t) {
      // timers do roteiro
      if (P.timers) for (var i = P.timers.length - 1; i >= 0; i--) { var tm = P.timers[i]; tm.t -= dt; if (tm.t <= 0) { P.timers.splice(i, 1); tm.fn(); } }
      if (P.sayT > 0) { P.sayT -= dt; if (P.sayT <= 0) P.hush(); }
      if (P.act) { P.actT += dt; if (P.actT >= P.actDur) { P.act = null; if (P.expr !== 'smile' && !P.keepExpr) P.expr = 'smile'; } }
      P.cool -= dt;

      // passear
      if (P.mode === 'wander' && !P.path) {
        P.wait -= dt;
        if (P.wait <= 0) {
          var j = Math.floor(Math.random() * walkLoop.length), q = walkLoop[j];
          P.goTo([[q[0] + (Math.random() - .5) * 4, q[1] + (Math.random() - .5) * 2.5]], false, function () { P.mode = 'wander'; P.path = null; P.wait = 1.5 + Math.random() * 4; if (Math.random() < .35) P.do('stretch', 2); });
        }
      }
      // caminhar
      if (P.path) {
        var tg = P.path[P.pi];
        tmp.set(tg.x - P.pos.x, 0, tg.z - P.pos.z);
        var d = tmp.length(), spd = P.run ? 4.2 : 1.5;
        if (P.umbOn) spd *= .8;
        if (d < .25) {
          P.pi++;
          if (P.pi >= P.path.length) { P.path = null; P.speed = 0; var fn = P.then; P.then = null; if (fn) fn(); else P.mode = 'stand'; }
        } else {
          P.wantHeading = Math.atan2(tmp.x, tmp.z);
          P.speed += (spd - P.speed) * Math.min(1, dt * 4);
          var turn = Math.abs(angDiff(P.heading, P.wantHeading));
          var mv = Math.min(d, P.speed * dt * Math.max(.25, 1 - turn / 1.6));
          P.pos.x += tmp.x / d * mv; P.pos.z += tmp.z / d * mv;
          P.pos.y += ((tg.y || 0) - P.pos.y) * Math.min(1, dt * 6);
        }
      } else P.speed += (0 - P.speed) * Math.min(1, dt * 6);

      // cumprimentos ao se cruzar (pátio)
      if (P.mode === 'walk' && P.cool <= 0 && !P.run) {
        for (var n = 0; n < people.length; n++) {
          var o = people[n];
          if (o === P || o.mode === 'sit' || o.cool > 0) continue;
          var dd = P.pos.distanceTo(o.pos);
          if (dd < 2.6 && dd > .4) {
            P.cool = o.cool = 9;
            P.look = o; o.look = P; P.do('wave', 1.6); o.do('wave', 1.6);
            if (Math.random() < .6) P.say(['Oi! 👋', 'E aí!', 'Bom dia!', 'Opa!'][Math.floor(Math.random() * 4)], 1.8);
            (function (a, b) { setTimeout(function () { if (a.look === b) a.look = null; if (b.look === a) b.look = null; }, 2200); })(P, o);
            break;
          }
        }
      }
      // separação simples
      for (var m = 0; m < people.length; m++) {
        var p2 = people[m]; if (p2 === P || P.mode === 'sit' || p2.mode === 'sit') continue;
        var dx = P.pos.x - p2.pos.x, dz = P.pos.z - p2.pos.z, dq = dx * dx + dz * dz;
        if (dq < .64 && dq > 1e-4) { var f = (.8 - Math.sqrt(dq)) * dt * 3; P.pos.x += dx * f; P.pos.z += dz * f; }
      }

      // roteiros especiais
      if (P.script === 'packet') {
        var u = ((api.getChT() - .8) / 6.5) % 1;
        if (api.getChT() > .8 && u > .93 && !P.cheered) { P.cheered = true; P.do('cheer', 1.6); P.say(['Carregou! 🎉', 'Sem travar! 🚀', 'TCP entregou tudo ✔'][Math.floor(Math.random() * 3)], 2.2); burst(V(P.pos.x, 2.6, P.pos.z), 24, 4); }
        if (u < .5) P.cheered = false;
      }
      if (P.script === 'repair' && Math.random() < dt * 4 && S.fiber > .3) { burst(V(R.breakAt.x, .6, R.breakAt.z), 2, 2.4); }

      // reações ao ambiente
      if (R.flash && R.flash.intensity > 1.2 && P.mode !== 'sit' && P.flinch <= 0 && !P.inside) {
        P.flinch = 2; if (P.id !== 'tec') P.do('scared', 1.1, 'o');
      }
      P.flinch -= dt;

      // piscar
      P.blinkT -= dt;
      if (P.blinkT <= 0) { P.blink = .14; P.blinkT = 2 + Math.random() * 4; }
      P.blink -= dt;
    }

    function pose(P, dt, t) {
      var k = 1 - Math.exp(-dt * 12), kf = 1 - Math.exp(-dt * 20);
      var a = P.act, at = P.actT, ap = P.actDur ? Math.min(1, at / P.actDur) : 0;
      var env = a ? Math.min(1, at * 4, (P.actDur - at) * 4) : 0; // entrada/saída do gesto
      var walk = Math.min(1, P.speed / 1.5), run = P.run && P.speed > 2;
      var sit = P.mode === 'sit';
      var ph = P.walkPh += dt * P.speed * (run ? 2.6 : 3.6);
      var br = RM ? 0 : Math.sin(t * 1.7 + P.seed) * .5 + .5; // respiração

      // alvos
      var J = {
        hipY: 0, lean: 0, twist: 0, roll: 0,
        lTh: 0, lKn: 0, rTh: 0, rKn: 0,
        lShX: .05, lShZ: .08, lEl: -.15, rShX: .05, rShZ: -.08, rEl: -.15,
        hdX: 0, hdY: 0, hdZ: 0, jump: 0, spin: 0
      };
      // caminhada / corrida
      if (walk > .02) {
        var s = Math.sin(ph), c = Math.cos(ph), amp = run ? .85 : .5;
        J.lTh = s * amp * walk; J.rTh = -s * amp * walk;
        J.lKn = Math.max(0, -c) * (run ? 1.3 : .8) * walk; J.rKn = Math.max(0, c) * (run ? 1.3 : .8) * walk;
        J.lShX = s * amp * .8 * walk; J.rShX = -s * amp * .8 * walk;
        J.lEl = J.rEl = -(run ? 1.3 : .35) * walk;
        J.hipY = Math.abs(c) * (run ? .09 : .045) * walk - .02 * walk;
        J.lean = (run ? .22 : .05) * walk; J.twist = s * .1 * walk;
      } else if (!sit) {
        // idle: respiração e troca de peso
        var wt = RM ? 0 : Math.sin(t * .45 + P.seed);
        J.roll = wt * .03; J.hipY = -br * .006; J.lShZ = .08 + br * .03; J.rShZ = -.08 - br * .03;
        J.hdY = RM ? 0 : Math.sin(t * .31 + P.seed * 3) * .35; J.hdX = Math.sin(t * .23 + P.seed) * .06;
      }
      if (sit) {
        J.hipY = -.43; J.lTh = J.rTh = 1.45; J.lKn = J.rKn = 1.5;
        // digitando
        J.lShX = J.rShX = -.75; J.lEl = J.rEl = -.95; J.lShZ = .12; J.rShZ = -.12;
        if (!RM) { J.lEl += Math.sin(t * 17 + P.seed) * .07; J.rEl += Math.sin(t * 19 + P.seed * 2) * .07; }
        J.lean = .18; J.hdX = .12; J.hdY = RM ? 0 : Math.sin(t * .4 + P.seed) * .15;
      }

      // gestos
      if (a) {
        var e = env, w;
        switch (a) {
          case 'wave':
            J.rShZ = lerp(J.rShZ, -2.7, e); J.rShX = lerp(J.rShX, -.2, e); J.rEl = lerp(J.rEl, -.5 + Math.sin(at * 14) * .45, e);
            J.hdZ = .08 * e; break;
          case 'raise':
            J.rShZ = lerp(J.rShZ, -2.95, e); J.rShX = lerp(J.rShX, 0, e); J.rEl = lerp(J.rEl, -.15, e); J.hdX = lerp(J.hdX, -.15, e); break;
          case 'point':
            J.rShX = lerp(J.rShX, -2.2, e); J.rShZ = lerp(J.rShZ, -.25, e); J.rEl = lerp(J.rEl, -.05, e); J.hdX = lerp(J.hdX, -.45, e); break;
          case 'cheer':
            J.lShZ = lerp(J.lShZ, 2.75, e); J.rShZ = lerp(J.rShZ, -2.75, e); J.lEl = J.rEl = lerp(-.15, -.3, e);
            if (!sit) J.jump = Math.max(0, Math.sin(at * 9)) * .32 * e;
            J.hdX = -.2 * e; break;
          case 'jump':
            w = Math.sin(Math.min(1, ap * 1.6) * Math.PI);
            if (!sit) { J.jump = w * .9; J.lTh = J.rTh = lerp(J.lTh, .7, w); J.lKn = J.rKn = lerp(0, 1.3, w); }
            J.lShZ = lerp(J.lShZ, 2.4, w); J.rShZ = lerp(J.rShZ, -2.4, w); break;
          case 'spin':
            J.spin = ease(ap) * TAU; if (!sit) J.jump = Math.sin(ap * Math.PI) * .45;
            J.lShZ = lerp(J.lShZ, 1.3, e); J.rShZ = lerp(J.rShZ, -1.3, e); break;
          case 'dance':
            var b = at * 7;
            J.roll = Math.sin(b) * .14 * e; J.twist = Math.sin(b * .5) * .35 * e;
            J.lShZ = lerp(J.lShZ, 1.2 + Math.sin(b) * .9, e); J.rShZ = lerp(J.rShZ, -1.2 + Math.sin(b) * .9, e);
            J.lEl = J.rEl = lerp(-.15, -1.4, e); J.hdZ = Math.sin(b) * .18 * e;
            if (!sit) { J.hipY = -Math.abs(Math.sin(b)) * .1 * e; J.lTh = Math.max(0, Math.sin(b)) * .5 * e; J.rTh = Math.max(0, -Math.sin(b)) * .5 * e; J.lKn = J.lTh * 1.4; J.rKn = J.rTh * 1.4; }
            break;
          case 'scared':
            J.lShX = lerp(J.lShX, -2.2, e); J.rShX = lerp(J.rShX, -2.2, e); J.lShZ = lerp(J.lShZ, .6, e); J.rShZ = lerp(J.rShZ, -.6, e);
            J.lEl = J.rEl = lerp(-.2, -2.1, e);
            if (!sit) { J.hipY = -.18 * e; J.lKn = J.rKn = .5 * e; J.lTh = J.rTh = .3 * e; }
            J.lean = .3 * e; J.roll = RM ? 0 : Math.sin(at * 40) * .03 * e; break;
          case 'shrug':
            J.lShZ = lerp(J.lShZ, .7, e); J.rShZ = lerp(J.rShZ, -.7, e); J.lEl = J.rEl = lerp(-.15, -1.5, e);
            J.lShX = J.rShX = lerp(J.lShX, -.3, e); J.hdZ = .22 * e; break;
          case 'thumbs':
            J.rShX = lerp(J.rShX, -1.2, e); J.rShZ = lerp(J.rShZ, -.2, e); J.rEl = lerp(J.rEl, -1.4, e); J.hdZ = -.08 * e; J.hdX = -.06 * e; break;
          case 'phone':
            J.rShX = lerp(J.rShX, -.5, e); J.rShZ = lerp(J.rShZ, -.55, e); J.rEl = lerp(J.rEl, -2.5, e); J.hdZ = -.15 * e;
            J.lShX = lerp(J.lShX, -.8, e); J.lEl = lerp(J.lEl, -1.2 + Math.sin(at * 5) * .3, e); break;
          case 'talk':
            J.lShX = lerp(J.lShX, -.7 + Math.sin(at * 3.1) * .35, e); J.rShX = lerp(J.rShX, -.6 + Math.sin(at * 2.6 + 1) * .4, e);
            J.lEl = lerp(J.lEl, -1 + Math.sin(at * 4) * .3, e); J.rEl = lerp(J.rEl, -1.1 + Math.cos(at * 3.7) * .3, e);
            J.lShZ = lerp(J.lShZ, .35, e); J.rShZ = lerp(J.rShZ, -.35, e); J.hdY = Math.sin(at * 1.4) * .4 * e; break;
          case 'wow':
            J.lShX = J.rShX = lerp(J.lShX, -1.6, e); J.lEl = J.rEl = lerp(J.lEl, -1.9, e); J.lShZ = lerp(J.lShZ, .25, e); J.rShZ = lerp(J.rShZ, -.25, e);
            J.hdX = -.4 * e; J.lean = -.12 * e; break;
          case 'nope':
            J.hdY = Math.sin(at * 9) * .45 * e; J.rShX = lerp(J.rShX, -1.4, e); J.rEl = lerp(J.rEl, -.4, e); J.rShZ = lerp(J.rShZ, -.1 + Math.sin(at * 9) * .2, e); break;
          case 'stretch':
            J.lShZ = lerp(J.lShZ, 2.9, e); J.rShZ = lerp(J.rShZ, -2.9, e); J.lEl = J.rEl = lerp(-.15, -.6, e); J.lean = -.15 * e; J.hdX = -.3 * e; break;
          case 'kick':
            w = Math.sin(ap * Math.PI);
            J.rTh = lerp(0, -.35, Math.min(1, ap * 3)) + w * 1.3 * (ap > .3 ? 1 : 0); J.rKn = (1 - w) * .4;
            J.lShZ = lerp(J.lShZ, .9, w); J.rShZ = lerp(J.rShZ, -.6, w); J.lean = -.1 * w; break;
        }
      }
      // roteiro de reparo: ajoelhado martelando
      if (P.script === 'repair' && !a) {
        J.hipY = -.42; J.rTh = 1.45; J.rKn = 1.55; J.lTh = .2; J.lKn = 2.3; J.lean = .55; J.hdX = .5;
        J.rShX = -1.2 + (RM ? 0 : Math.max(0, Math.sin(t * 7)) * -.9); J.rEl = -.5; J.lShX = -1.1; J.lEl = -.6;
      }
      // guarda-chuva
      if (P.umbOn) { J.lShX = lerp(J.lShX, -.9, 1); J.lShZ = .25; J.lEl = -1.75; }
      // celular aceso (lanterna) quando falta energia
      if (P.phoneOn && !a) { J.rShX = -1.25; J.rEl = -.9; J.rShZ = -.15; J.hdX = .25; }

      // olhar
      var ly = 0, lx = 0;
      if (P.look === 'up') lx = -.75;
      else if (P.look === 'cam' || P.hoverOn) { camW.copy(camera.position); ly = Math.atan2(camW.x - P.pos.x, camW.z - P.pos.z); lx = -Math.atan2(camW.y - P.pos.y - 1.6, Math.hypot(camW.x - P.pos.x, camW.z - P.pos.z)) * .6; ly = angDiff(P.heading, ly); }
      else if (P.look && P.look.pos) { ly = angDiff(P.heading, Math.atan2(P.look.pos.x - P.pos.x, P.look.pos.z - P.pos.z)); }
      ly = Math.max(-1.1, Math.min(1.1, ly));
      if (P.look || P.hoverOn) { J.hdY = ly * .75; J.hdX = lx; J.twist += ly * .3; }
      // virar o corpo para olhar quando o pescoço não alcança
      if ((P.look === 'cam' || (P.look && P.look.pos)) && P.mode === 'stand' && !P.path) {
        var want = P.look === 'cam' ? Math.atan2(camera.position.x - P.pos.x, camera.position.z - P.pos.z) : Math.atan2(P.look.pos.x - P.pos.x, P.look.pos.z - P.pos.z);
        P.wantHeading = want;
      }

      // final: festa
      if (finale && P.gathering && !a) {
        var fb = t * 6 + P.seed;
        J.jump = Math.max(0, Math.sin(fb)) * .35; J.lShZ = 2.5 + Math.sin(fb) * .3; J.rShZ = -2.5 - Math.sin(fb) * .3; J.lEl = J.rEl = -.3;
      }

      // aplicar (suavizado)
      var hs = sm(P, 'hipY', J.hipY, kf);
      P.jumpY += (J.jump - P.jumpY) * Math.min(1, dt * 18);
      P.hips.position.y = .92 + hs + P.jumpY;
      P.spine.rotation.x = sm(P, 'lean', J.lean, k); P.spine.rotation.y = sm(P, 'twist', J.twist, k); P.spine.rotation.z = sm(P, 'roll', J.roll, k);
      P.spine.scale.y = 1 + br * .012;
      P.lL.th.rotation.x = -sm(P, 'lTh', J.lTh, kf); P.lL.kn.rotation.x = sm(P, 'lKn', J.lKn, kf);
      P.lR.th.rotation.x = -sm(P, 'rTh', J.rTh, kf); P.lR.kn.rotation.x = sm(P, 'rKn', J.rKn, kf);
      P.lL.ft.rotation.x = -P.lL.kn.rotation.x * .3 - P.lL.th.rotation.x * .2; P.lR.ft.rotation.x = -P.lR.kn.rotation.x * .3 - P.lR.th.rotation.x * .2;
      P.aL.sh.rotation.x = sm(P, 'lShX', J.lShX, kf); P.aL.sh.rotation.z = sm(P, 'lShZ', J.lShZ, kf); P.aL.el.rotation.x = sm(P, 'lEl', J.lEl, kf);
      P.aR.sh.rotation.x = sm(P, 'rShX', J.rShX, kf); P.aR.sh.rotation.z = sm(P, 'rShZ', J.rShZ, kf); P.aR.el.rotation.x = sm(P, 'rEl', J.rEl, kf);
      P.head.rotation.x = sm(P, 'hdX', J.hdX, k); P.head.rotation.y = sm(P, 'hdY', J.hdY, k); P.head.rotation.z = sm(P, 'hdZ', J.hdZ, k);
      P.body.rotation.y = J.spin;

      // rosto
      var ex = P.expr;
      P.smile.visible = ex !== 'o'; P.mouthO.visible = ex === 'o';
      var talking = P.sayT > 0 && !RM;
      if (talking) { var mo = Math.abs(Math.sin(t * 13 + P.seed)); P.mouthO.visible = mo > .5; P.smile.visible = mo <= .5; }
      P.mouthO.scale.setScalar(ex === 'o' ? 1.2 : .8);
      var bl = P.blink > 0 ? .1 : (ex === 'o' ? 1.35 : 1);
      P.eyeL.scale.y = P.eyeR.scale.y = bl;
      var by = ex === 'o' ? .125 : .1; P.browL.position.y = P.browR.position.y = lerp(P.browL.position.y, by, k);
      P.browL.rotation.z = ex === 'o' ? -.25 : 0; P.browR.rotation.z = ex === 'o' ? .25 : 0;

      // adereços
      P.umb.visible = !!P.umbOn;
      if (P.umbOn) P.umb.rotation.set(-(P.aL.sh.rotation.x + P.aL.el.rotation.x + P.spine.rotation.x), 0, -P.aL.sh.rotation.z); P.phone.visible = !!P.phoneOn || a === 'phone';
      if (P.tool) P.tool.visible = !!P.toolOn;
      // destaque no hover
      P.hover += ((P.hoverOn ? 1 : 0) - P.hover) * Math.min(1, dt * 10);
      P.shirtM.emissiveIntensity = P.hover * .55;
    }

    function lerp(a, b, k) { return a + (b - a) * k; }
    function ease(k) { return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }

    // bola: passes entre b1 e b2
    function ballStep(dt) {
      var a = byId[B.from], b = byId[B.to];
      if (!B.on || a.gathering || b.gathering || a.mode === 'walk' || b.mode === 'walk') {
        ball.position.y += (.16 - ball.position.y) * Math.min(1, dt * 6);
        ballSh.position.set(ball.position.x, .02, ball.position.z); return;
      }
      a.wantHeading = Math.atan2(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
      b.wantHeading = Math.atan2(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
      if (B.t >= 1) {
        B.hold -= dt;
        var f0 = a.pos;
        ball.position.set(f0.x + Math.sin(a.heading) * .45, .16, f0.z + Math.cos(a.heading) * .45);
        if (B.hold <= 0) { B.t = 0; B.hold = .5 + Math.random() * .8; a.do('kick', .55); }
      } else {
        B.t = Math.min(1, B.t + dt / B.dur);
        if (B.t > .18) {
          var u = (B.t - .18) / .82, s = V(a.pos.x + Math.sin(a.heading) * .45, 0, a.pos.z + Math.cos(a.heading) * .45), e = V(b.pos.x + Math.sin(b.heading) * .45, 0, b.pos.z + Math.cos(b.heading) * .45);
          ball.position.set(lerp(s.x, e.x, u), .16 + Math.sin(u * Math.PI) * 2.2, lerp(s.z, e.z, u));
          ball.rotation.x += dt * 12; ball.rotation.z += dt * 7;
        }
        if (B.t >= 1) {
          if (Math.random() < .3) b.say(b.lines[Math.floor(Math.random() * b.lines.length)], 1.6);
          var tt = B.from; B.from = B.to; B.to = tt;
        }
      }
      ballSh.position.set(ball.position.x, .02, ball.position.z); ballSh.scale.setScalar(.4 / (1 + ball.position.y * .25));
    }

    function confettiStep(dt) {
      if (finale && Math.random() < dt * 5) burst(V(-30 + (Math.random() - .5) * 18, 8 + Math.random() * 4, 15 + (Math.random() - .5) * 6), 14, 4);
      var any = false;
      for (var i = 0; i < CN; i++) {
        if (cLife[i] <= 0) continue; any = true;
        cLife[i] -= dt; var v = cV[i];
        v.y -= 9.8 * dt * .55; v.multiplyScalar(1 - dt * 1.2);
        cPos[i * 3] += (v.x + Math.sin(cLife[i] * 6 + i) * .6) * dt; cPos[i * 3 + 1] += v.y * dt; cPos[i * 3 + 2] += v.z * dt;
        if (cLife[i] <= 0 || cPos[i * 3 + 1] < 0) { cLife[i] = 0; cPos[i * 3 + 1] = -99; }
      }
      if (any || finale) cGeo.attributes.position.needsUpdate = true;
    }

    var hintShown = false;
    api.updaters.push(function (dt, t) {
      for (var i = 0; i < people.length; i++) {
        var P = people[i];
        brain(P, dt, t);
        P.heading += angDiff(P.heading, P.wantHeading) * Math.min(1, dt * (P.path ? 7 : 4));
        P.root.position.copy(P.pos); P.root.rotation.y = P.heading;
        pose(P, dt, t);
      }
      var anyPh = false; for (var q = 0; q < people.length; q++) if (people[q].phoneOn) { anyPh = true; break; }
      mPhone.emissiveIntensity = anyPh ? 2.4 : .25;
      ballStep(dt);
      confettiStep(dt);
      if (!hintShown && api.getCh() === 0 && api.getChT() > 2.5) { hintShown = true; hint.classList.add('on'); setTimeout(function () { hint.classList.remove('on'); }, 4200); }
    });

    /* ---------------- projeção dos balões (após render) ---------------- */
    var pv = V(0, 0, 0);
    function project(el, p, y, sx) {
      pv.set(p.pos.x, p.pos.y + y * p.sc + p.jumpY * p.sc, p.pos.z).project(camera);
      if (pv.z > 1 || Math.abs(pv.x) > 1.1 || Math.abs(pv.y) > 1.1) { el.style.visibility = 'hidden'; return; }
      el.style.visibility = '';
      el.style.transform = 'translate3d(' + ((pv.x + 1) / 2 * api.W).toFixed(1) + 'px,' + ((1 - pv.y) / 2 * api.H).toFixed(1) + 'px,0)';
    }
    api.post.push(function () {
      if (hovered && canvas.style.cursor !== 'pointer') canvas.style.cursor = 'pointer';
      for (var i = 0; i < people.length; i++) {
        var P = people[i];
        if (P.bubble && P.bubble.classList.contains('on')) project(P.bubble, P, P.mode === 'sit' ? 1.75 : 2.15);
        if (P.hoverOn || (P.tag && P.tag.classList.contains('on'))) {
          if (!P.tag) {
            P.tag = document.createElement('div'); P.tag.className = 'p3d-n';
            P.tag.style.setProperty('--pc', '#' + P.color.toString(16).padStart(6, '0'));
            P.tag.innerHTML = '<div>' + P.name + '<b>' + P.role + '</b></div>'; layer.appendChild(P.tag);
          }
          P.tag.classList.toggle('on', !!P.hoverOn && !(P.sayT > 0));
          project(P.tag, P, P.mode === 'sit' ? 1.65 : 2.05);
        }
      }
    });

    // primeiro capítulo (a extensão pode carregar depois do setChapter inicial)
    onChapter(api.getCh());
  });
})();
