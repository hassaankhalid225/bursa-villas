/* Bursa Building Contracting — a modern villa from noon to night */
(function(){
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function build(canvas){
    var mini = canvas.getAttribute('data-scene') === 'mini';
    var renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    var scene = new THREE.Scene();
    var skyDay = new THREE.Color(0xBFD9E0), skyDusk = new THREE.Color(0x6E5E86), skyNight = new THREE.Color(0x141B2B);
    scene.background = skyDay.clone();
    scene.fog = new THREE.Fog(scene.background, 40, 95);
    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 300);

    var hemi = new THREE.HemisphereLight(0xffffff, 0xb59f7a, .65); scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xfff1d6, 1.2);
    sun.castShadow = true; sun.shadow.mapSize.set(2048,2048);
    var sc = sun.shadow.camera; sc.left=-26; sc.right=26; sc.top=26; sc.bottom=-26; sc.near=1; sc.far=90;
    sun.shadow.bias = -0.0006;
    scene.add(sun); scene.add(sun.target);

    var villa = new THREE.Group(); scene.add(villa);
    function mat(c, o){ o=o||{}; return new THREE.MeshStandardMaterial({color:c, roughness:o.r==null?.85:o.r, metalness:o.m||0}); }
    function box(w,h,d,x,y,z,m,parent){
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), m);
      mesh.position.set(x,y+h/2,z); mesh.castShadow = true; mesh.receiveShadow = true;
      (parent||villa).add(mesh); return mesh;
    }
    var sand = mat(0xD7C6A6), lawn = mat(0x7F9366), white = mat(0xF3F1EC,{r:.7}), stone = mat(0xC9B79A), dark = mat(0x2B2E2C,{r:.5}), wood = mat(0x8A6A4A,{r:.6});
    var glass = new THREE.MeshStandardMaterial({color:0x2D4046, roughness:.08, metalness:.4, emissive:0xFFB466, emissiveIntensity:0});
    var water = new THREE.MeshStandardMaterial({color:0x3FB7C9, roughness:.05, metalness:.1, emissive:0x2AD1FF, emissiveIntensity:0});

    var ground = new THREE.Mesh(new THREE.PlaneGeometry(200,200), sand); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
    var lawnM = new THREE.Mesh(new THREE.PlaneGeometry(34,26), lawn); lawnM.rotation.x=-Math.PI/2; lawnM.position.set(0,.02,1); lawnM.receiveShadow=true; villa.add(lawnM);

    // ground floor
    box(16,.4,10, 0,0,-2, stone);
    box(15,3.4,8.6, 0,.4,-2.3, white);
    box(9,2.8,.12, 1.8,.6,2.05, glass);
    box(.4,3.4,.4, -2.9,.4,2.1, white);
    // upper floor, cantilever
    box(11.5,3.2,9.4, -3.2,3.8,-1.8, white);
    box(7.2,2.4,.12, -3.8,4.2,2.96, glass);
    box(.12,2.4,5.2, 2.6,4.2,-1.4, glass);
    box(12.6,.35,10.4, -3.2,7,-1.8, dark);
    box(16.6,.3,10.8, .3,3.8-.3,-1.8, dark);
    // wooden screen
    for (var i=0;i<9;i++) box(.16,3,.16, -8.4+i*.35,3.9,3.05, wood);
    // terrace + side wing
    box(5,2.6,6, 9.4,.4,-3.8, white);
    box(1.8,2,.12, 9.4,.6,-.75, glass);
    // pool
    box(14,.5,5, 2,0,7, stone);
    var pool = new THREE.Mesh(new THREE.BoxGeometry(12.6,.1,3.8), water); pool.position.set(2,.48,7); villa.add(pool);
    // loungers
    for (var l=0;l<3;l++){ box(1,.35,2.2, -3.2+l*1.6,.02,6.6, white); box(1,.6,.5, -3.2+l*1.6,.37,5.75, white); }
    // boundary wall
    box(.4,2,24, -16.5,0,0, stone); box(33,2,.4, 0,0,-12.5, stone);

    // palms
    var trunkM = mat(0x8B7357), leafM = mat(0x3F6B4A,{r:.9});
    function palm(x,z,h,lean){
      var g = new THREE.Group(); g.position.set(x,0,z); g.rotation.z = lean; villa.add(g);
      var t = new THREE.Mesh(new THREE.CylinderGeometry(.18,.3,h,8), trunkM); t.position.y=h/2; t.castShadow=true; g.add(t);
      for (var k=0;k<8;k++){
        var leaf = new THREE.Mesh(new THREE.BoxGeometry(3.4,.06,.55), leafM);
        leaf.geometry.translate(1.7,0,0);
        leaf.position.y = h; leaf.rotation.y = k*Math.PI/4; leaf.rotation.z = -.45; leaf.castShadow = true; g.add(leaf);
      }
      return g;
    }
    var palms = [palm(-12,6,8,.08), palm(-10,9,6.5,-.12), palm(12.5,4,7.5,.1)];

    // night garden lights
    var lamps = [];
    [[-8,9],[0,10],[8,10.5],[12,8],[-13,2]].forEach(function(p){
      var m = new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.8,8), new THREE.MeshStandardMaterial({color:0x222222, emissive:0xFFC27A, emissiveIntensity:0}));
      m.position.set(p[0],.4,p[1]); villa.add(m); lamps.push(m.material);
    });
    var interior = new THREE.PointLight(0xFFB466, 0, 24, 2); interior.position.set(-2,3,0); scene.add(interior);
    var poolLight = new THREE.PointLight(0x2AD1FF, 0, 14, 2); poolLight.position.set(2,1,7); scene.add(poolLight);

    // time of day
    var input = document.querySelector('[data-tod]');
    var label = document.querySelector('[data-tod-label]');
    var manual = false, tod = mini ? .62 : .1;
    if (input) input.addEventListener('input', function(){ manual = true; tod = parseFloat(input.value); });
    function lerpColor(t){
      var c = new THREE.Color();
      if (t < .55) c.copy(skyDay).lerp(skyDusk, Math.max(0,(t-.2)/.35));
      else c.copy(skyDusk).lerp(skyNight, Math.min(1,(t-.55)/.35));
      return c;
    }
    function applyTod(t){
      var ang = .25 + t*1.5;
      sun.position.set(Math.cos(ang)*40, Math.max(Math.sin(Math.PI*(1-t*.92))*38, 3), 18);
      var dayness = Math.max(0, 1 - t*1.25);
      sun.intensity = .25 + dayness*1.15;
      sun.color.setHSL(.09, .6, .55 + dayness*.35);
      hemi.intensity = .2 + dayness*.5;
      var sky = lerpColor(t); scene.background.copy(sky); scene.fog.color.copy(sky);
      var night = Math.max(0, (t-.45)/.55);
      glass.emissiveIntensity = night*1.1;
      water.emissiveIntensity = night*.7;
      interior.intensity = night*1.6; poolLight.intensity = night*1.8;
      lamps.forEach(function(m){ m.emissiveIntensity = night*2; });
      if (label) label.textContent = t < .3 ? 'Midday' : t < .6 ? 'Golden hour' : t < .8 ? 'Dusk' : 'Night';
      if (input && !manual) input.value = t.toFixed(2);
    }

    // drag to orbit
    var yaw = -.5, targetYaw = -.5, dragging = false, lastX = 0;
    canvas.addEventListener('pointerdown', function(e){ dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', function(e){ if (!dragging) return; targetYaw += (e.clientX-lastX)*.006; lastX = e.clientX; });
    canvas.addEventListener('pointerup', function(){ dragging = false; });
    canvas.addEventListener('pointercancel', function(){ dragging = false; });

    function size(){
      var w = canvas.clientWidth||1, h = canvas.clientHeight||1;
      renderer.setSize(w,h,false); camera.aspect = w/h; camera.fov = w < 700 ? 46 : 32; camera.updateProjectionMatrix();
    }
    size();
    if (window.ResizeObserver) new ResizeObserver(size).observe(canvas); else window.addEventListener('resize', size);
    var visible = true;
    if (window.IntersectionObserver) new IntersectionObserver(function(en){ visible = en[0].isIntersecting; }).observe(canvas);

    var t0 = performance.now();
    function frame(now){
      requestAnimationFrame(frame);
      if (!visible) return;
      var t = (now - t0)/1000;
      if (!manual && !reduce && !mini) tod = (Math.sin(t*.12 - 1.4)+1)/2 * .95;
      applyTod(tod);
      if (!dragging && !reduce) targetYaw += .0012;
      yaw += (targetYaw - yaw)*.08;
      var r = mini ? 44 : 44;
      camera.position.set(Math.sin(yaw)*r, mini ? 14 : 16, Math.cos(yaw)*r);
      camera.lookAt(0, 2.6, 0);
      palms.forEach(function(p,i){ p.rotation.x = reduce ? 0 : Math.sin(t*.8+i)*.015; });
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }

  function boot(){
    document.querySelectorAll('canvas[data-scene]').forEach(function(c){
      try { if (!window.THREE) throw new Error('three missing'); build(c); }
      catch (err) { c.parentElement.classList.add('no-webgl'); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
