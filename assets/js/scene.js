/* Bursa Building Contracting — a limestone villa from noon to night.
   Three.js r128 (global THREE). Time of day + scroll progress come from window.Bursa (main.js). */
(function(){
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = Math.min(window.innerWidth, screen.width || 9999) < 760 || window.matchMedia('(pointer: coarse)').matches;

  function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v){ var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function lerp(a, b, t){ return a + (b - a) * t; }
  function C(h){ return new THREE.Color(h).convertSRGBToLinear(); }

  /* ---------- time-of-day keyframes (linear colours) ---------- */
  var KEYS = [
    {t:0,   top:'#4F8DB8', hz:'#D4E4E8', bot:'#C8BBA0', sun:'#FFF1DA', sunI:2.3,  hs:'#BBD3E2', hg:'#B59A72', hi:.5, exp:.82},
    {t:.34, top:'#4E6E99', hz:'#F4B072', bot:'#9C7556', sun:'#FFAA55', sunI:2.2,  hs:'#9FB0C6', hg:'#9E7148', hi:.42, exp:.92},
    {t:.62, top:'#272A57', hz:'#C98BA0', bot:'#4A3D57', sun:'#FF8C72', sunI:.0,   hs:'#7569A2', hg:'#4D3B4D', hi:.5, exp:1.05},
    {t:1,   top:'#03081A', hz:'#1A2142', bot:'#090B16', sun:'#A9BCEB', sunI:.0,   hs:'#2E3A6A', hg:'#15141F', hi:.24, exp:1.18}
  ].map(function(k){ return {t:k.t, top:C(k.top), hz:C(k.hz), bot:C(k.bot), sun:C(k.sun), sunI:k.sunI, hs:C(k.hs), hg:C(k.hg), hi:k.hi, exp:k.exp}; });

  function sunState(t){
    // elevation (deg) and azimuth (rad, 0 = in front of the villa, + = west/right)
    var el = t < .34 ? lerp(64, 9, smooth(0, .34, t)) : t < .62 ? lerp(9, -7, (t - .34) / .28) : lerp(-7, -22, (t - .62) / .38);
    var az = t < .34 ? lerp(.3, 1.15, smooth(0, .34, t)) : lerp(1.15, 1.5, clamp((t - .34) / .4, 0, 1));
    var e = el * Math.PI / 180;
    return {el: el, dir: new THREE.Vector3(Math.sin(az) * Math.cos(e), Math.sin(e), Math.cos(az) * Math.cos(e)).normalize()};
  }
  var MOON = new THREE.Vector3(-.55, .5, .55).normalize();

  /* ---------- shaders ---------- */
  var SKY_VS = 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
  var SKY_FS = [
    'uniform vec3 uTop; uniform vec3 uHz; uniform vec3 uBot; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uMoonDir;',
    'uniform float uSunVis; uniform float uMoonVis; uniform float uGlow;',
    'varying vec3 vDir;',
    'void main(){',
    '  vec3 d = normalize(vDir); float h = d.y;',
    '  vec3 col = mix(uHz, uTop, pow(smoothstep(0.0, 0.7, h), 0.65));',
    '  col = mix(col, uBot, smoothstep(0.0, -0.08, h));',
    '  float s = max(dot(d, uSunDir), 0.0);',
    '  float az = max(dot(normalize(d.xz + 1e-4), normalize(uSunDir.xz + 1e-4)), 0.0);',
    '  col += uSunCol * pow(az, 3.0) * (1.0 - smoothstep(0.0, 0.35, abs(h))) * uGlow;',
    '  col += uSunCol * (pow(s, 8.0) * 0.4 + pow(s, 90.0) * 0.8) * uSunVis;',
    '  col += uSunCol * smoothstep(0.99935, 0.9997, s) * 5.0 * uSunVis;',
    '  float m = max(dot(d, uMoonDir), 0.0);',
    '  col += vec3(1.0, 0.96, 0.88) * smoothstep(0.99955, 0.99975, m) * 2.0 * uMoonVis + vec3(0.4, 0.45, 0.7) * pow(m, 30.0) * 0.12 * uMoonVis;',
    '  gl_FragColor = vec4(col, 1.0);',
    '  #include <tonemapping_fragment>',
    '  #include <encodings_fragment>',
    '}'].join('\n');
  var WATER_VS = 'varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  var WATER_FS = [
    'uniform float uTime; uniform float uNight; uniform float uAspect;',
    'uniform vec3 uSky; uniform vec3 uSkyTop; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uGlow; uniform vec3 uWarm;',
    'varying vec3 vW; varying vec2 vUv;',
    'float hgt(vec2 p){ return sin(p.x*1.9+uTime*1.2)*0.5 + sin(p.y*2.6-uTime*0.9)*0.4 + sin((p.x-p.y)*3.7+uTime*1.7)*0.22 + sin((p.x*0.7+p.y)*6.1-uTime*2.3)*0.1; }',
    'void main(){',
    '  vec2 p = vW.xz; float e = 0.04; float c0 = hgt(p);',
    '  vec3 n = normalize(vec3((c0 - hgt(p + vec2(e, 0.0))) * 0.8, 1.0, (c0 - hgt(p + vec2(0.0, e))) * 0.8));',
    '  vec3 V = normalize(cameraPosition - vW);',
    '  float fres = 0.04 + 0.96 * pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 5.0);',
    '  vec2 ed = min(vUv, 1.0 - vUv); float edge = smoothstep(0.0, 0.2, min(ed.x * uAspect, ed.y));',
    '  vec3 body = mix(uShallow, uDeep, edge);',
    '  vec2 q = p * 2.6; float ca = 0.0;',
    '  for (int i = 0; i < 3; i++){ q = vec2(q.x + sin(q.y * 1.3 + uTime * 0.7), q.y + cos(q.x * 1.1 - uTime * 0.6)); ca += abs(sin(q.x) + cos(q.y)); }',
    '  ca = pow(clamp(1.0 - ca / 3.4, 0.0, 1.0), 4.0);',
    '  body += ca * mix(vec3(0.6, 0.85, 0.8) * (1.0 - uNight), uGlow, uNight) * 0.28;',
    '  body = mix(body, uGlow * (0.45 + 0.55 * (1.0 - edge * 0.5)) + ca * uGlow * 0.7, uNight * 0.85);',
    '  vec3 R = reflect(-V, n);',
    '  vec3 refl = mix(uSky, uSkyTop, clamp(R.y * 1.4, 0.0, 1.0));',
    '  refl += uWarm * uNight * smoothstep(0.4, 0.0, R.y) * smoothstep(0.2, -0.6, R.z) * 1.4;',
    '  float spec = pow(max(dot(R, uSunDir), 0.0), 240.0) * 7.0;',
    '  vec3 col = mix(body, refl, fres * (1.0 - uNight * 0.4)) + spec * uSunCol;',
    '  gl_FragColor = vec4(col, 1.0);',
    '  #include <tonemapping_fragment>',
    '  #include <encodings_fragment>',
    '}'].join('\n');

  function glowTexture(){
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    var t = new THREE.CanvasTexture(c); return t;
  }

  /* ---------- geometry helpers ---------- */
  function flutedColumn(r, h){
    var g = new THREE.CylinderGeometry(r, r, h, 64, 1, false);
    var p = g.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), d = Math.sqrt(x * x + z * z);
      if (d < 1e-4) continue;
      var k = 1 - .07 * Math.pow(.5 + .5 * Math.cos(a * 20), 2);
      p.setX(i, x * k); p.setZ(i, z * k);
    }
    g.computeVertexNormals(); g.translate(0, h / 2, 0);
    return g;
  }
  function trunkGeo(h, lx, lz){
    var rings = 16, rad = 9, pos = [], idx = [];
    for (var i = 0; i <= rings; i++) {
      var t = i / rings, cx = lx * h * (t * t * .8 + t * .2), cz = lz * h * (t * t * .8 + t * .2), y = t * h;
      var r = (.3 - t * .13) * (1 + (i % 2) * .08) + .16 * Math.max(0, 1 - t * 7);
      for (var j = 0; j <= rad; j++) { var a = j / rad * Math.PI * 2; pos.push(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r); }
    }
    for (i = 0; i < rings; i++) for (j = 0; j < rad; j++) {
      var a0 = i * (rad + 1) + j, b0 = a0 + rad + 1;
      idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return {geo: g, top: new THREE.Vector3(lx * h, h, lz * h)};
  }
  function frondGeo(L, segs){
    var pos = [], idx = [];
    for (var i = 0; i <= segs; i++) {
      var t = i / segs, x = t * L, y = Math.sin(t * Math.PI * .7) * L * .2 - t * t * L * .4;
      var w = (Math.sin(Math.PI * Math.min(1, t * 1.08)) * .4 + .03) * L / 3.4 * (i % 2 ? 1 : .55);
      var fold = w * .5;
      pos.push(x, y, 0, x - w * .3, y + fold, w, x - w * .3, y + fold, -w);
    }
    for (i = 0; i < segs; i++) {
      var a = i * 3, b = (i + 1) * 3;
      idx.push(a, b, a + 1, b, b + 1, a + 1, a, a + 2, b, b, a + 2, b + 2);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  /* ======================================================================= */
  function build(canvas){
    var hero = canvas.getAttribute('data-scene') === 'hero';
    var preset = parseFloat(canvas.getAttribute('data-preset'));
    if (isNaN(preset)) preset = .36;
    var view = canvas.getAttribute('data-view') || 'three-quarter';
    var lite = small;
    var B = window.Bursa || (window.Bursa = {tod: .08, story: 0});

    var renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true, powerPreference: 'high-performance'});
    if (!renderer.getContext()) throw new Error('no gl');
    var maxDpr = small ? 1.4 : (hero ? 1.75 : 1.6);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    var shadows = !small;
    renderer.shadowMap.enabled = shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(34, 1, .1, 1600);
    scene.fog = new THREE.Fog(0xffffff, 110, 520);

    /* environment map for reflections (built once from a soft gradient sky) */
    var envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, vertexShader: SKY_VS,
      fragmentShader: 'varying vec3 vDir; void main(){ float h = normalize(vDir).y; vec3 c = mix(vec3(0.85,0.82,0.76), vec3(0.42,0.6,0.78), smoothstep(-0.05,0.6,h)); c = mix(c, vec3(0.45,0.38,0.3), smoothstep(0.0,-0.2,h)); gl_FragColor = vec4(c,1.0);\n#include <encodings_fragment>\n}'
    })));
    var pmrem = new THREE.PMREMGenerator(renderer);
    var envTex = pmrem.fromScene(envScene, .02).texture; pmrem.dispose();
    scene.environment = envTex;

    /* sky dome + stars */
    var skyU = {uTop:{value:new THREE.Color()}, uHz:{value:new THREE.Color()}, uBot:{value:new THREE.Color()}, uSunDir:{value:new THREE.Vector3(0,1,0)}, uSunCol:{value:new THREE.Color()}, uMoonDir:{value:MOON}, uSunVis:{value:1}, uMoonVis:{value:0}, uGlow:{value:0}};
    var sky = new THREE.Mesh(new THREE.SphereGeometry(800, 48, 24), new THREE.ShaderMaterial({uniforms: skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false}));
    sky.renderOrder = -10; scene.add(sky);
    var starN = lite ? 500 : 1300, sp = new Float32Array(starN * 3);
    for (var s = 0; s < starN; s++) {
      var u = Math.random() * Math.PI * 2, v = Math.random() * .95 + .04, r = Math.sqrt(1 - v * v);
      sp[s * 3] = Math.cos(u) * r * 700; sp[s * 3 + 1] = v * 700; sp[s * 3 + 2] = Math.sin(u) * r * 700;
    }
    var starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    var starMat = new THREE.PointsMaterial({color: 0xFFF6E6, size: small ? 1.6 : 1.9, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false});
    var stars = new THREE.Points(starGeo, starMat); stars.renderOrder = -9; sky.add(stars);

    /* lights */
    var hemi = new THREE.HemisphereLight(0xffffff, 0x888888, .7); scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.castShadow = shadows;
    if (shadows) {
      var sz = hero ? 2048 : 1024; sun.shadow.mapSize.set(sz, sz);
      var sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 180;
      sun.shadow.bias = -.0004; sun.shadow.normalBias = .03; sun.shadow.radius = 3;
    }
    sun.target.position.set(0, 0, 0);
    scene.add(sun); scene.add(sun.target);
    var interior = new THREE.PointLight(C('#FFB367'), 0, 18, 2); interior.position.set(-3, 3.9, -4.2); scene.add(interior);
    var interior2 = new THREE.PointLight(C('#FFB367'), 0, 12, 2); interior2.position.set(1.8, 3.4, -5); if (!lite) scene.add(interior2);
    var poolLight = new THREE.PointLight(C('#3FD6FF'), 0, 15, 2); poolLight.position.set(0, .9, 8.3); scene.add(poolLight);

    /* materials */
    var envMats = [];
    function M(hex, o){
      o = o || {};
      var m = new THREE.MeshStandardMaterial({color: C(hex), roughness: o.r == null ? .85 : o.r, metalness: o.m || 0, side: o.side || THREE.FrontSide});
      if (o.flat) m.flatShading = true;
      m.userData.env = o.env == null ? .55 : o.env; envMats.push(m);
      return m;
    }
    var lime = M('#ECE5D6', {r: .8}), limeWarm = M('#DECDB2', {r: .85}), limeDark = M('#CDBFA6', {r: .9}), ceiling = M('#F2EDE3', {r: .9});
    var paving = M('#D4C8B4', {r: .92}), sand = M('#CFB389', {r: 1, env: .3}), lawn = M('#7A9160', {r: 1, env: .25});
    var bronze = M('#4E3B2A', {r: .42, m: .65, env: 1}), brass = M('#B48F55', {r: .3, m: .9, env: 1.2});
    var trav = M('#D6C7AC', {r: .55}), linen = M('#E9E1D2', {r: .95}), walnut = M('#5A3D2A', {r: .6}), stonePanel = M('#B7A27F', {r: .7}), rug = M('#B9A07E', {r: 1});
    var timber = M('#6A4C36', {r: .7}), dark = M('#2A2B2A', {r: .5});
    var trunkM = M('#86705A', {r: .95, env: .3}), leafA = M('#4A6B3C', {r: .75, side: THREE.DoubleSide, env: .35}), leafB = M('#3B5A33', {r: .75, side: THREE.DoubleSide, env: .35});
    var shrubM = M('#5F7648', {r: .95, flat: true, env: .3}), shrubM2 = M('#7C8B5C', {r: .95, flat: true, env: .3}), olive = M('#8D9A7A', {r: .95, flat: true, env: .3});
    var glass = new THREE.MeshStandardMaterial({color: C('#22343A'), roughness: .04, metalness: .9, transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false});
    glass.userData.env = 1.5; envMats.push(glass);
    var winUpper = new THREE.MeshStandardMaterial({color: C('#2A3439'), roughness: .1, metalness: .8, emissive: C('#FFB46A'), emissiveIntensity: 0});
    winUpper.userData.env = 1.2; envMats.push(winUpper);
    var warmBasic = new THREE.MeshBasicMaterial({color: C('#FFD39A')});
    var pendantM = new THREE.MeshStandardMaterial({color: C('#F3E3C6'), emissive: C('#FFCB85'), emissiveIntensity: 0, roughness: .4});
    var lampM = new THREE.MeshStandardMaterial({color: C('#E8DECB'), emissive: C('#FFC27A'), emissiveIntensity: 0, roughness: .5});

    var world = new THREE.Group(); scene.add(world);
    function box(w, h, d, x, y, z, m, o){
      o = o || {};
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y + h / 2, z);
      mesh.castShadow = o.cast !== false; mesh.receiveShadow = true;
      (o.parent || world).add(mesh); return mesh;
    }

    /* ground, plot, distant dunes */
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), sand); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);
    var duneGeo = new THREE.SphereGeometry(1, 24, 12);
    [[-160, -230, 90, 12], [120, -260, 120, 16], [300, -120, 80, 10], [-320, -60, 110, 14], [40, -330, 140, 20], [260, 180, 90, 9], [-260, 220, 100, 11]].forEach(function(d){
      var m = new THREE.Mesh(duneGeo, sand); m.position.set(d[0], -2, d[1]); m.scale.set(d[2], d[3], d[2] * .5); m.rotation.y = d[0] * .01; world.add(m);
    });
    box(48, .3, 36, 0, 0, 2, paving, {cast: false});
    box(12, .06, 11, -16, .3, 13.5, lawn, {cast: false});
    box(10, .06, 9, 17.5, .3, 14, lawn, {cast: false});
    // boundary walls with brass caps
    box(48, 2.4, .5, 0, .3, -15.75, limeDark); box(.5, 2.4, 30, -23.75, .3, -1, limeDark); box(.5, 2.4, 30, 23.75, .3, -1, limeDark);
    box(48.4, .06, .56, 0, 2.7, -15.75, brass, {cast: false});

    /* villa */
    box(34, .6, 14.5, 1, .3, -3.25, limeDark);               // plinth, floor level 0.9
    box(18, .4, .7, -3, .3, 4.35, limeDark); box(18, .2, .7, -3, .3, 5.05, limeDark);   // steps to the pool
    var FL = .9;
    // living pavilion (hollow so the camera can enter)
    box(16, 3.8, .4, -3, FL, -8.8, lime);
    box(.4, 3.8, 10, -10.8, FL, -4, lime);
    box(.4, 3.8, 10, 4.8, FL, -4, lime);
    box(15.6, .02, 9.6, -3, FL, -4, trav, {cast: false});
    box(18.5, .5, 13.2, -3, 4.7, -2.9, ceiling);
    box(18.5, .07, .05, -3, 4.86, 3.52, brass, {cast: false});
    // glazing with bronze mullions
    var gl = new THREE.Mesh(new THREE.PlaneGeometry(15.2, 3.8), glass); gl.position.set(-3, FL + 1.9, 1); gl.renderOrder = 2; world.add(gl);
    for (var mx = 0; mx <= 7; mx++) box(.08, 3.8, .12, -10.6 + mx * 15.2 / 7, FL, 1, bronze, {cast: false});
    box(15.2, .1, .14, -3, FL + 3.7, 1, bronze, {cast: false}); box(15.2, .08, .14, -3, FL, 1, bronze, {cast: false});
    // fluted columns carrying the overhang
    var colGeo = flutedColumn(.3, 3.6);
    [-11.4, -5.2, 5.6].forEach(function(x){
      var c = new THREE.Mesh(colGeo, lime); c.position.set(x, FL + .1, 3.1); c.castShadow = true; c.receiveShadow = true; world.add(c);
      box(.8, .1, .8, x, FL, 3.1, limeDark); box(.8, .12, .8, x, 4.58, 3.1, limeDark, {cast: false});
    });
    // interior
    box(5.2, .02, 3.6, -4, FL + .02, -4.6, rug, {cast: false});
    box(3.8, .42, 1, -4, FL, -6.7, linen); box(3.8, .5, .28, -4, FL + .42, -7.1, linen); box(1, .42, 2.6, -6.4, FL, -5.6, linen);
    box(1.6, .34, .9, -4, FL, -4.6, walnut);
    box(5, 3.4, .1, -4, FL + .2, -8.55, stonePanel, {cast: false});
    for (var bl = 0; bl < 6; bl++) box(.03, 3.4, .03, -6.3 + bl * .92, FL + .2, -8.49, brass, {cast: false});
    box(2.8, .06, 1.1, 1.6, FL + .74, -5, walnut); box(.08, .74, .9, .4, FL, -5, dark); box(.08, .74, .9, 2.8, FL, -5, dark);
    var pendants = [];
    for (var pd = 0; pd < 3; pd++) {
      var pm = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 12), pendantM); pm.position.set(.8 + pd * .8, 3.25, -5); world.add(pm); pendants.push(pm.position.clone());
      box(.01, 1.2, .01, .8 + pd * .8, 3.4, -5, dark, {cast: false});
    }
    box(15, .06, .22, -3, 4.56, -8.45, warmBasic, {cast: false}); box(.22, .06, 9, -10.45, 4.56, -4, warmBasic, {cast: false});
    for (var st = 0; st < 11; st++) box(1.1, .08, .36, 4.0, FL + .3 + st * .34, -8.2 + st * .36, walnut);
    var pot = new THREE.Mesh(new THREE.CylinderGeometry(.35, .28, .7, 16), limeWarm); pot.position.set(-9.8, FL + .35, -.2); world.add(pot);
    var fol = new THREE.Mesh(new THREE.IcosahedronGeometry(.75, 1), shrubM); fol.position.set(-9.8, FL + 1.35, -.2); fol.scale.y = 1.3; world.add(fol);
    // upper volume with bronze fins and a glowing window band
    box(12, 3.4, 7.4, -3, 5.2, -4.3, lime);
    box(7.6, 2.3, .06, -4.6, 5.75, -.57, winUpper, {cast: false});
    for (var fn = 0; fn < 19; fn++) box(.08, 2.9, .38, -8.5 + fn * .42, 5.45, -.32, bronze);
    box(.35, 2.3, .06, 1.6, 5.75, -.57, winUpper, {cast: false});
    box(14.6, .45, 9.8, -3, 8.6, -4, lime);
    box(14.6, .06, .05, -3, 8.8, .92, brass, {cast: false});
    var bal = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1), glass); bal.position.set(3.7, 5.7, 3.6); world.add(bal);
    // stepped stair tower
    box(5, 6.2, 6, 7, FL, -6, limeWarm);
    box(5.4, .3, 6.4, 7, FL + 6.2, -6, limeDark);
    box(.35, 4.6, .06, 7, 1.6, -2.97, winUpper, {cast: false});
    // majlis wing with arched windows and a pergola
    box(7.5, 3.3, 6, 13.25, FL, -3, lime);
    box(8.3, .35, 6.8, 13.25, 4.2, -2.9, limeDark);
    box(8.3, .05, .05, 13.25, 4.4, .52, brass, {cast: false});
    var archShape = new THREE.Shape(); archShape.moveTo(-.65, 0); archShape.lineTo(.65, 0); archShape.lineTo(.65, 1.7); archShape.absarc(0, 1.7, .65, 0, Math.PI, false); archShape.lineTo(-.65, 0);
    var archGeo = new THREE.ShapeGeometry(archShape, 16);
    [10.9, 13.25, 15.6].forEach(function(x){
      var a = new THREE.Mesh(archGeo, winUpper); a.position.set(x, FL + .45, .02); world.add(a);
      var fr = new THREE.Mesh(new THREE.ShapeGeometry(archShape, 16), bronze); fr.scale.set(1.12, 1.06, 1); fr.position.set(x, FL + .4, .01); world.add(fr);
    });
    [10, 12.5, 15, 16.8].forEach(function(x){ box(.18, 3, .18, x, FL, 3.8, timber); });
    box(7.4, .2, .2, 13.4, FL + 3, 3.8, timber);
    for (var sl = 0; sl < (lite ? 9 : 16); sl++) box(.1, .14, 4.1, 9.8 + sl * 7.2 / ((lite ? 9 : 16) - 1), FL + 3.2, 1.9, timber);
    box(2.6, .45, 1.1, 13.3, FL, 1.8, linen); box(1.1, .4, 1.1, 11.2, FL, 2.2, linen);

    /* pool with animated water */
    box(19.2, .2, .6, 0, .3, 5.7, lime); box(19.2, .2, .6, 0, .3, 10.8, lime); box(.6, .2, 4.5, -9.3, .3, 8.25, lime); box(.6, .2, 4.5, 9.3, .3, 8.25, lime);
    var waterU = {uTime:{value:0}, uNight:{value:0}, uAspect:{value:4}, uSky:{value:new THREE.Color()}, uSkyTop:{value:new THREE.Color()}, uSunDir:{value:new THREE.Vector3()}, uSunCol:{value:new THREE.Color()},
      uDeep:{value:C('#1F7F98')}, uShallow:{value:C('#7FD6DD')}, uGlow:{value:C('#2FC9F2')}, uWarm:{value:C('#FFB66C')}};
    var water = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5), new THREE.ShaderMaterial({uniforms: waterU, vertexShader: WATER_VS, fragmentShader: WATER_FS}));
    water.rotation.x = -Math.PI / 2; water.position.set(0, .45, 8.25); water.receiveShadow = false; world.add(water);
    // loungers + parasol on the far side
    [-5.2, -2.8, -.4].forEach(function(x){
      box(.85, .3, 2, x, .3, 12.8, lime); box(.8, .12, 1.4, x, .6, 13.1, linen, {cast: false});
      var back = box(.8, .1, .8, x, .7, 12.1, linen); back.rotation.x = -.6;
    });
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 2.6, 8), bronze); pole.position.set(1.8, 1.6, 12.6); world.add(pole);
    var canopy = new THREE.Mesh(new THREE.ConeGeometry(1.7, .55, lite ? 8 : 12, 1, true), new THREE.MeshStandardMaterial({color: C('#EDE5D6'), roughness: 1, side: THREE.DoubleSide}));
    canopy.position.set(1.8, 2.75, 12.6); canopy.castShadow = true; world.add(canopy);

    /* landscaping */
    box(44, 1.1, .9, 0, .3, -14.9, shrubM);
    function shrub(x, z, s, m){
      var sh = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), m || shrubM); sh.position.set(x, .3 + s * .6, z); sh.scale.y = .75; sh.castShadow = true; sh.receiveShadow = true; world.add(sh);
    }
    function planter(x, z){ box(1.6, .7, 1.6, x, .3, z, limeWarm); shrub(x, z, .7, shrubM2); shrub(x + .3, z - .2, .5); }
    function oliveTree(x, z){
      var t = new THREE.Mesh(new THREE.CylinderGeometry(.12, .18, 1.8, 7), trunkM); t.position.set(x, 1.2, z); t.castShadow = true; world.add(t);
      [[0, 2.5, 0, 1.1], [.6, 2.2, .3, .8], [-.5, 2.3, -.2, .85]].forEach(function(c){
        var m = new THREE.Mesh(new THREE.IcosahedronGeometry(c[3], 1), olive); m.position.set(x + c[0], c[1], z + c[2]); m.scale.y = .8; m.castShadow = true; world.add(m);
      });
    }
    planter(-13, 3.4); planter(9.6, 4.6); planter(-11.2, 11.6); planter(11.2, 9.6);
    oliveTree(-19, -9); oliveTree(19.5, -11);
    if (!lite) { oliveTree(-6, -13); oliveTree(4, -13.2); }
    for (var sh = 0; sh < (lite ? 6 : 14); sh++) shrub(-22 + Math.random() * 10, 9 + Math.random() * 9, .4 + Math.random() * .5, sh % 3 ? shrubM : shrubM2);
    for (sh = 0; sh < (lite ? 4 : 10); sh++) shrub(13 + Math.random() * 9, 10.5 + Math.random() * 7.5, .4 + Math.random() * .45, sh % 2 ? shrubM : shrubM2);
    for (var ss = 0; ss < 7; ss++) box(1.5, .06, .7, 11.6 + (ss % 2) * .3, .3, 19 - ss * 1.15, limeWarm, {cast: false});

    /* glow sprites (cheap bloom) */
    var gTex = glowTexture(), glows = [];
    function glow(x, y, z, sx, sy, col, k){
      var m = new THREE.SpriteMaterial({map: gTex, color: C(col), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0});
      var sp = new THREE.Sprite(m); sp.position.set(x, y, z); sp.scale.set(sx, sy, 1); world.add(sp); glows.push({m: m, k: k}); return sp;
    }
    // lanterns
    var lanterns = [[-10, 11.6], [10, 11.6], [-10, 5.2], [10, 5.2], [-14, 17], [10.6, 18], [16, 9.5], [-6.5, 15.5], [3.5, 15.5]];
    if (lite) lanterns = lanterns.slice(0, 6);
    lanterns.forEach(function(p){
      var post = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, .8, 8), bronze); post.position.set(p[0], .7, p[1]); world.add(post);
      var lamp = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .26, 10), lampM); lamp.position.set(p[0], 1.2, p[1]); world.add(lamp);
      box(.34, .04, .34, p[0], 1.33, p[1], brass, {cast: false});
      glow(p[0], 1.2, p[1], 1.6, 1.6, '#FFC27A', .9);
    });
    pendants.forEach(function(p){ glow(p.x, p.y, p.z, 1.3, 1.3, '#FFD08A', .9); });
    glow(-3, 2.8, 1.8, 17, 5.5, '#FFB062', .32);      // glazing haze
    glow(-4.6, 6.9, .2, 9, 3.2, '#FFB062', .28);
    glow(13.25, 2.2, .6, 8, 3, '#FFB062', .3);
    glow(0, .7, 8.25, 20, 4, '#3FD6FF', .22);

    /* palms with swaying fronds */
    var palmDefs = [[-15, 8.5, 8.6, .05, .03], [-18.5, 4, 7.2, -.04, .05], [-12.6, 14, 6.4, .06, -.04], [12.6, 12.8, 7.8, -.05, .02], [19, 4, 9, .04, -.05], [20.6, 11.2, 6.6, .07, .03], [-20, -11.5, 9.4, -.03, .04], [17.5, -12, 8.2, .04, .03]];
    if (lite) palmDefs = [palmDefs[0], palmDefs[2], palmDefs[3], palmDefs[4]];
    var frondG = frondGeo(3.5, lite ? 8 : 12), fronds = [], crowns = [];
    palmDefs.forEach(function(d, pi){
      var tg = trunkGeo(d[2], d[3], d[4]);
      var tr = new THREE.Mesh(tg.geo, trunkM); tr.position.set(d[0], .3, d[1]); tr.castShadow = true; world.add(tr);
      var crown = new THREE.Group(); crown.position.copy(tg.top).add(tr.position); world.add(crown); crowns.push({g: crown, ph: pi * 1.7});
      var n = lite ? 9 : 13;
      for (var k = 0; k < n; k++) {
        var piv = new THREE.Group(); piv.rotation.y = k / n * Math.PI * 2 + (pi * .7);
        var f = new THREE.Mesh(frondG, k % 2 ? leafA : leafB);
        var tilt = (k % 3 === 0 ? .35 : k % 3 === 1 ? .05 : -.2) + (Math.random() - .5) * .15;
        f.rotation.z = tilt; f.rotation.x = (Math.random() - .5) * .3; f.castShadow = true;
        piv.add(f); crown.add(piv); fronds.push({m: f, base: tilt, ph: Math.random() * 6.28});
      }
      for (var cc = 0; cc < 3; cc++) { var nut = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6), timber); nut.position.set(Math.cos(cc * 2.1) * .2, -.25, Math.sin(cc * 2.1) * .2); crown.add(nut); }
      glow(d[0], 1.6, d[1], 1.2, 3.6, '#FFC98A', .55);   // uplight wash on the trunk
    });

    /* ---------- time of day ---------- */
    var cur = {top: new THREE.Color(), hz: new THREE.Color(), bot: new THREE.Color(), sun: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color()};
    var lastTod = -1;
    function applyTod(t){
      if (Math.abs(t - lastTod) < .0008) return;
      lastTod = t;
      var i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
      var a = KEYS[i], b = KEYS[i + 1], k = smooth(0, 1, (t - a.t) / (b.t - a.t));
      ['top', 'hz', 'bot', 'sun', 'hs', 'hg'].forEach(function(n){ cur[n].copy(a[n]).lerp(b[n], k); });
      var ss = sunState(t), above = smooth(-.03, .08, Math.sin(ss.el * Math.PI / 180));
      var moonVis = smooth(.64, .95, t), lights = smooth(.42, .82, t), dayness = 1 - smooth(.3, .75, t);
      skyU.uTop.value.copy(cur.top); skyU.uHz.value.copy(cur.hz); skyU.uBot.value.copy(cur.bot);
      skyU.uSunDir.value.copy(ss.dir); skyU.uSunCol.value.copy(cur.sun);
      skyU.uSunVis.value = smooth(-.12, .02, Math.sin(ss.el * Math.PI / 180)); skyU.uMoonVis.value = moonVis;
      skyU.uGlow.value = smooth(.12, .34, t) * (1 - smooth(.6, .85, t)) * .9;
      scene.fog.color.copy(cur.hz); scene.fog.near = lerp(110, 50, lights); scene.fog.far = lerp(520, 280, lights);
      // sun by day, moon by night (they cross at near-zero intensity, so no pop)
      var sunI = lerp(a.sunI, b.sunI, k) * above, moonI = .32 * moonVis;
      if (above > .001) { sun.position.copy(ss.dir).multiplyScalar(80); sun.color.copy(cur.sun); sun.intensity = sunI; }
      else { sun.position.copy(MOON).multiplyScalar(80); sun.color.copy(KEYS[3].sun); sun.intensity = moonI; }
      hemi.color.copy(cur.hs); hemi.groundColor.copy(cur.hg); hemi.intensity = lerp(a.hi, b.hi, k);
      renderer.toneMappingExposure = lerp(a.exp, b.exp, k);
      envMats.forEach(function(m){ m.envMapIntensity = m.userData.env * (.18 + .82 * dayness); });
      interior.intensity = lights * 2.5; interior2.intensity = lights * 1.6; poolLight.intensity = lights * 2.6;
      winUpper.emissiveIntensity = lights * 1.5;
      pendantM.emissiveIntensity = lights * 2.4; lampM.emissiveIntensity = lights * 2.6;
      warmBasic.color.copy(C('#FFD39A')).multiplyScalar(.15 + lights * 1.5);
      glass.opacity = lerp(.42, .16, lights); glass.color.copy(C('#22343A')).lerp(C('#3A2E28'), lights * .5);
      starMat.opacity = smooth(.6, .95, t);
      glows.forEach(function(g){ g.m.opacity = g.k * lights; });
      waterU.uNight.value = lights; waterU.uSky.value.copy(cur.hz); waterU.uSkyTop.value.copy(cur.top);
      waterU.uSunDir.value.copy(ss.dir); waterU.uSunCol.value.copy(cur.sun).multiplyScalar(above);
    }

    /* ---------- camera choreography ---------- */
    function V(x, y, z){ return new THREE.Vector3(x, y, z); }
    var POS = [V(30, 13, 38), V(6, 54, 30), V(17.5, 1.9, 8.6), V(1.6, 2.3, 7.8), V(-0.8, 2.4, -7.9)];
    var TGT = [V(-1.5, 3, 0), V(0, 0, 1.5), V(-6, 1.4, 7.4), V(-1.5, 2.2, -4), V(2.6, 1.9, 7)];
    var FOV = [32, 34, 40, 44, 52];
    var SHIFT = [12, 10, -4.5, 3, -2.5];
    var UP = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3();
    var posCurve = new THREE.CatmullRomCurve3(POS, false, 'centripetal'), tgtCurve = new THREE.CatmullRomCurve3(TGT, false, 'centripetal');
    var MINI = view === 'low' ? {p: V(30, 5, 24), t: V(-1, 3.2, 0), fov: 30} : {p: V(27, 12, 31), t: V(-1, 3, -1), fov: 34};
    var camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), camFov = 34, first = true;
    var wantP = new THREE.Vector3(), wantT = new THREE.Vector3(), off = new THREE.Vector3();
    var aspect = 1;
    function pose(p){
      if (!hero) { wantP.copy(MINI.p); wantT.copy(MINI.t); return MINI.fov; }
      var keys = B.keys || [0, .25, .5, .72, .93], n = keys.length, i = 0;
      while (i < n - 2 && p > keys[i + 1]) i++;
      var local = smooth(keys[i], keys[i + 1], p), uu = (i + local) / (n - 1);
      posCurve.getPoint(uu, wantP); tgtCurve.getPoint(uu, wantT);
      var fov = lerp(FOV[i], FOV[i + 1], local);
      if (wantP.y < 1.35) wantP.y = 1.35;
      if (aspect > 1.15) {
        var sh = lerp(SHIFT[i], SHIFT[i + 1], local) * Math.min(1, (aspect - 1.15) / .45);
        side.subVectors(wantT, wantP).cross(UP).setY(0).normalize().multiplyScalar(-sh);
        wantT.add(side); wantP.add(side.multiplyScalar(.35));
      }
      // portrait screens: pull exterior shots back and keep the villa in the upper half
      if (aspect < 1) {
        var ext = 1 - smooth(.35, .55, p);
        off.subVectors(wantP, wantT).multiplyScalar(1 + (1 - aspect) * .55 * ext);
        wantP.copy(wantT).add(off);
        wantT.y -= (1 - aspect) * 12 * ext * (1 - smooth(.15, .3, p) * .6);
      }
      return fov;
    }
    function fovFor(f){ return aspect < 1 ? Math.min(f * (1 + (1 - aspect) * .75), 68) : f; }

    /* ---------- drag to rotate (horizontal only, inertial) ---------- */
    var yaw = 0, vel = 0, dragging = false, lastX = 0, lastMove = 0, lastStory = 0, idle = 0;
    canvas.addEventListener('pointerdown', function(e){
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true; lastX = e.clientX; vel = 0; idle = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    });
    canvas.addEventListener('pointermove', function(e){
      if (!dragging) return;
      var dx = e.clientX - lastX; lastX = e.clientX;
      var d = dx * (small ? .008 : .005);
      yaw += d; vel = d; lastMove = performance.now();
    });
    function endDrag(){ if (!dragging) return; dragging = false; if (performance.now() - lastMove > 80) vel = 0; }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('lostpointercapture', endDrag);

    /* ---------- sizing, visibility, loop ---------- */
    var dprScale = 1;
    function size(){
      var w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
      var dpr = Math.min(window.devicePixelRatio || 1, maxDpr, 2) * dprScale;
      if (w * h * dpr * dpr > 3.6e6) dpr = Math.sqrt(3.6e6 / (w * h));
      renderer.setPixelRatio(Math.max(dpr, .75));
      renderer.setSize(w, h, false);
      aspect = w / h; camera.aspect = aspect; camera.updateProjectionMatrix();
    }
    size();
    if (window.ResizeObserver) new ResizeObserver(size).observe(canvas); else window.addEventListener('resize', size);

    var visible = true, running = false, raf = 0;
    if (window.IntersectionObserver) new IntersectionObserver(function(en){ visible = en[0].isIntersecting; if (visible) start(); }, {rootMargin: '80px'}).observe(canvas);
    document.addEventListener('visibilitychange', function(){ if (!document.hidden) start(); });
    canvas.addEventListener('webglcontextlost', function(e){ e.preventDefault(); running = false; cancelAnimationFrame(raf); canvas.parentElement.classList.add('no-webgl'); });

    var tPrev = performance.now(), clock = 0, slowFrames = 0, frames = 0;
    function frame(now){
      if (!visible || document.hidden) { running = false; return; }
      raf = requestAnimationFrame(frame);
      var dt = Math.min(.1, (now - tPrev) / 1000); tPrev = now;
      if (!reduce) clock += dt;
      // adaptive resolution: drop DPR once if the device struggles
      frames++; if (dt > 1 / 38) slowFrames++;
      if (frames === 120) { if (slowFrames > 60 && dprScale > .7) { dprScale = .7; size(); } frames = 0; slowFrames = 0; }

      var tod = hero ? (B.tod == null ? .08 : B.tod) : preset;
      applyTod(tod);
      waterU.uTime.value = clock;
      if (!reduce) {
        crowns.forEach(function(c){ c.g.rotation.z = Math.sin(clock * .6 + c.ph) * .035; c.g.rotation.x = Math.cos(clock * .45 + c.ph) * .025; });
        fronds.forEach(function(f){ f.m.rotation.z = f.base + Math.sin(clock * 1.3 + f.ph) * .045; });
      }
      // yaw: inertia, idle drift, and ease back home as the story scrolls on
      var p = hero ? (B.story || 0) : 0;
      if (!dragging) { yaw += vel; vel *= Math.pow(.9, dt * 60); if (Math.abs(vel) < 1e-5) vel = 0; idle += dt; }
      if (!reduce && !dragging && idle > 2.5 && (!hero || p < .02)) yaw += dt * (hero ? .035 : .05);
      var dp = Math.abs(p - lastStory); lastStory = p;
      if (hero && dp > 0) { yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw)); yaw *= Math.exp(-dp * 22); }

      var f = fovFor(pose(p));
      off.subVectors(wantP, wantT);
      var cy = Math.cos(yaw), sy = Math.sin(yaw), ox = off.x;
      off.x = ox * cy - off.z * sy; off.z = ox * sy + off.z * cy;
      wantP.copy(wantT).add(off);
      var k = (first || reduce) ? 1 : 1 - Math.exp(-dt * 7);
      camPos.lerp(wantP, k); camTgt.lerp(wantT, k); camFov = lerp(camFov, f, k); first = false;
      if (Math.abs(camera.fov - camFov) > .01) { camera.fov = camFov; camera.updateProjectionMatrix(); }
      camera.position.copy(camPos); camera.lookAt(camTgt);
      sky.position.copy(camera.position);
      // keep the shadow frustum centred on what the camera sees
      sun.target.position.set(clamp(camTgt.x, -12, 12), 0, clamp(camTgt.z, -8, 10));
      sun.position.add(sun.target.position);
      sun.target.updateMatrixWorld();
      renderer.render(scene, camera);
      sun.position.sub(sun.target.position);
    }
    function start(){ if (running || !visible || document.hidden) return; running = true; tPrev = performance.now(); raf = requestAnimationFrame(frame); }
    start();
    canvas.classList.add('is-ready');
  }

  function glOk(){
    try { var t = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (t.getContext('webgl') || t.getContext('experimental-webgl'))); }
    catch (e) { return false; }
  }
  function boot(){
    var ok = glOk();
    document.querySelectorAll('canvas[data-scene]').forEach(function(c){
      try { if (!window.THREE || !ok) throw new Error('webgl unavailable'); build(c); }
      catch (err) { c.parentElement.classList.add('no-webgl'); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
