/* Venice Projects — Three.js cosmos + scrollcraft */
(function(){
'use strict';

/* ---------- THREE.JS: drifting particle cosmos + connecting lines ---------- */
const canvasHolder = document.getElementById('cosmos');
const renderer = new THREE.WebGLRenderer({alpha:true, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
canvasHolder.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 1, 1200);
camera.position.z = 420;

// particles
const N = 1400;
const geo = new THREE.BufferGeometry();
const pos = new Float32Array(N*3);
const seed = new Float32Array(N);
for (let i=0;i<N;i++){
  pos[i*3]   = (Math.random()-0.5)*1400;
  pos[i*3+1] = (Math.random()-0.5)*900;
  pos[i*3+2] = (Math.random()-0.5)*800;
  seed[i] = Math.random()*Math.PI*2;
}
geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
const colors = [0x00e5ff, 0x00ff9c, 0xff2ec4, 0xffb020, 0x7a8699];
const mat = new THREE.PointsMaterial({size:2.6, vertexColors:false, transparent:true, opacity:.75, blending:THREE.AdditiveBlending, depthWrite:false, color:0x00e5ff});
const points = new THREE.Points(geo, mat);
scene.add(points);

// a slowly rotating wireframe icosahedron "core" behind the hero
const core = new THREE.Mesh(
  new THREE.IcosahedronGeometry(150, 1),
  new THREE.MeshBasicMaterial({color:0x00e5ff, wireframe:true, transparent:true, opacity:.07})
);
scene.add(core);

let mx=0, my=0, scrollY=0;
addEventListener('pointermove', e=>{ mx=(e.clientX/innerWidth-.5)*2; my=(e.clientY/innerHeight-.5)*2; }, {passive:true});
addEventListener('scroll', ()=>{ scrollY=window.scrollY; }, {passive:true});
addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
(function tick(){
  requestAnimationFrame(tick);
  const t = clock.getElapsedTime();
  const p = geo.attributes.position.array;
  for (let i=0;i<N;i++){
    p[i*3+1] += Math.sin(t*0.6 + seed[i])*0.14;
    p[i*3]   += Math.cos(t*0.4 + seed[i])*0.10;
  }
  geo.attributes.position.needsUpdate = true;
  points.rotation.y = t*0.02 + mx*0.08;
  points.rotation.x = my*0.05;
  core.rotation.y = t*0.06; core.rotation.x = t*0.03;
  // parallax scroll: camera drifts down through the field
  camera.position.y = -scrollY*0.06;
  camera.position.z = 420 - Math.min(scrollY*0.03, 120);
  renderer.render(scene, camera);
})();

/* ---------- SCROLLCRAFT: reveals + counters + progress ---------- */
const prog = document.getElementById('prog');
function onScroll(){
  const h = document.documentElement;
  const p = h.scrollTop/(h.scrollHeight-h.clientHeight);
  prog.style.width = (p*100)+'%';
}
addEventListener('scroll', onScroll, {passive:true}); onScroll();

const io = new IntersectionObserver(es=>{
  es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} });
},{threshold:.12});
document.querySelectorAll('.rv').forEach(el=>io.observe(el));

// counters
const cio = new IntersectionObserver(es=>{
  es.forEach(e=>{
    if(!e.isIntersecting) return;
    const el = e.target, target = +el.dataset.count, t0 = performance.now();
    (function step(now){
      const k = Math.min((now-t0)/1400, 1);
      el.textContent = Math.round(target*(1-Math.pow(1-k,3)));
      if(k<1) requestAnimationFrame(step);
    })(t0);
    cio.unobserve(el);
  });
},{threshold:.5});
document.querySelectorAll('[data-count]').forEach(el=>cio.observe(el));

/* ---------- CATALOG FIRST + SEARCH / FILTER ---------- */
const heroEl = document.querySelector('.hero');
const catalogEl = document.getElementById('all');
if (heroEl && catalogEl) heroEl.after(catalogEl);

function initCatalog(){
  const grid = document.getElementById('grid');
  const search = document.getElementById('cat-search');
  const chips = document.getElementById('cat-chips');
  const result = document.getElementById('cat-result');
  const count = document.getElementById('cat-count');
  if (!grid || !search || !chips) return;
  const cards = [...grid.querySelectorAll('.proj')];
  let active = 'all';

  function apply(){
    const q = search.value.trim().toLowerCase();
    let visible = 0;
    cards.forEach(card => {
      const tags = (card.dataset.tags || '').split(' ').filter(Boolean);
      const hay = `${card.dataset.name || ''} ${card.dataset.tags || ''} ${card.textContent || ''}`.toLowerCase();
      const ok = (!q || hay.includes(q)) && (active === 'all' || tags.includes(active));
      card.hidden = !ok;
      if (ok) visible += 1;
    });
    if (count) count.textContent = visible;
    if (result) {
      result.textContent = visible === cards.length
        ? `Showing all ${cards.length} live projects`
        : `${visible} of ${cards.length} projects${active === 'all' ? '' : ` · ${active}`}${q ? ` · “${search.value.trim()}”` : ''}`;
    }
  }

  chips.addEventListener('click', event => {
    const button = event.target.closest('.chip');
    if (!button) return;
    active = button.dataset.tag || 'all';
    chips.querySelectorAll('.chip').forEach(chip => chip.classList.toggle('on', chip === button));
    apply();
  });
  search.addEventListener('input', apply);
  apply();
}

/* ---------- BUILD GRID ---------- */
fetch('projects.json').then(r=>{
  if (r.status === 401 || r.status === 403) { location.href = '/login'; throw new Error('session expired'); }
  return r.json();
}).then(data=>{
  // Hero heading + stats already static; wire origin link
  const grid = document.getElementById('grid');
  data.projects.forEach((p, i)=>{
    const a = document.createElement('a');
    a.className = 'proj rv';
    a.href = p.url; a.target = '_blank'; a.rel = 'noopener';
    a.dataset.name = p.name.toLowerCase();
    a.dataset.tags = (p.tags || []).join(' ').toLowerCase();
    a.style.transitionDelay = (i%3*70)+'ms';
    const shot = p.shot
      ? `<div class="shot"><img loading="lazy" src="${p.shot}" alt="${p.name} screenshot" onerror="this.parentElement.classList.add('noimg');this.remove()"></div>`
      : `<div class="shot noimg"></div>`;
    a.innerHTML = `${p.top_pick?'<span class="pick">★ TOP PICK</span>':''}${(p.tags||[]).includes('byok')?'<span class="byok-badge">🔑 BYOK</span>':''}${shot}<div class="body"><h3>${p.name}</h3><p>${p.desc}</p><div class="tags">${(p.tags||[]).map(t=>`<span class="tag">${t}</span>`).join('')}</div></div><div class="go">↗</div>`;
    grid.appendChild(a);
    io.observe(a);
  });
  const grid2 = document.getElementById('grid2');
  if (grid2 && data.netlify_projects) {
    /* special highlighted apps get their own wide feature cards */
    const specials = data.netlify_projects.filter(p=>p.special);
    const normal = data.netlify_projects.filter(p=>!p.special);
    const sp = document.createElement('div');
    sp.className = 'special-row';
    specials.forEach((p, i)=>{
      const a = document.createElement('a');
      a.className = 'proj special rv';
      a.href = p.url; a.target = '_blank'; a.rel = 'noopener';
      a.dataset.name = p.name.toLowerCase();
      a.dataset.tags = (p.tags || []).join(' ').toLowerCase();
      a.style.transitionDelay = (i%3*70)+'ms';
      const shot = p.shot
        ? `<div class="shot"><img loading="lazy" src="${p.shot}" alt="${p.name} screenshot" onerror="this.parentElement.classList.add('noimg');this.remove()"></div>`
        : `<div class="shot noimg"></div>`;
      a.innerHTML = `${(p.tags||[]).includes('byok')?'<span class="byok-badge">🔑 BYOK</span>':''}<span class="pick">◆ FEATURED</span>${shot}<div class="body"><h3>${p.name}</h3><p>${p.desc}</p><div class="tags">${(p.tags||[]).map(t=>`<span class="tag">${t}</span>`).join('')}</div></div><div class="go">↗</div>`;
      sp.appendChild(a);
      io.observe(a);
    });
    grid2.parentNode.insertBefore(sp, grid2);
    data.netlify_projects = normal;
    normal.forEach((p, i)=>{
      const a = document.createElement('a');
      a.className = 'proj rv';
      a.href = p.url; a.target = '_blank'; a.rel = 'noopener';
      a.dataset.name = p.name.toLowerCase();
      a.dataset.tags = (p.tags || []).join(' ').toLowerCase();
      a.style.transitionDelay = (i%3*70)+'ms';
      const shot = p.shot
        ? `<div class="shot"><img loading="lazy" src="${p.shot}" alt="${p.name} screenshot" onerror="this.parentElement.classList.add('noimg');this.remove()"></div>`
        : `<div class="shot noimg"></div>`;
      a.innerHTML = `${p.top_pick?'<span class="pick">★ TOP PICK</span>':''}${(p.tags||[]).includes('byok')?'<span class="byok-badge">🔑 BYOK</span>':''}${shot}<div class="body"><h3>${p.name}</h3><p>${p.desc}</p><div class="tags">${(p.tags||[]).map(t=>`<span class="tag">${t}</span>`).join('')}</div></div><div class="go">↗</div>`;
      grid2.appendChild(a);
      io.observe(a);
    });
  }
  initCatalog();
}).catch(err=>console.error('grid load failed', err));

/* ---------- hero text scramble on load ---------- */
const h1 = document.querySelector('.hero h1 .grad');
const finalText = h1.textContent;
const glyphs = '!<>-_\\/[]{}—=+*^?#01';
let frame = 0;
const scramble = setInterval(()=>{
  frame++;
  h1.textContent = finalText.split('').map((c,i)=>{
    if (c===' ') return ' ';
    const reveal = i*2.2;
    if (frame > reveal + 6) return c;
    return glyphs[Math.floor(Math.random()*glyphs.length)];
  }).join('');
  if (frame > finalText.length*2.2 + 8){ clearInterval(scramble); h1.textContent = finalText; }
}, 34);
setTimeout(()=>{ clearInterval(scramble); h1.textContent = finalText; }, 1800);

})();
