// game.js - simple platformer with left/right and Up-arrow jump + touch buttons
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  let DPR = window.devicePixelRatio || 1;
  function resize() {
    DPR = window.devicePixelRatio || 1;
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(240, window.innerHeight);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  window.addEventListener('resize', resize, {passive:true});
  resize();

  // world
  const groundY = () => canvas.height / DPR - 80; // ground position in CSS pixels

  // player start
  const start = { x: 120, y: null };

  // player
  const player = {
    x: start.x,
    y: 0,
    w: 36,
    h: 36,
    vx: 0,
    vy: 0,
    color: '#ffdd57',
    onGround: false
  };

  // spike (obstacle) - bigger and close to start
  const spike = {
    x: 300,
    w: 200,
    h: 90,
    color: '#ff4d4d'
  };

  const gravity = 1700;
  const moveSpeed = 320;
  const jumpSpeed = -620;

  const keys = { left:false, right:false };
  let gameOver = false, gameOverTimer = 0;

  function initPositions() {
    start.y = groundY() - 40;
    player.x = start.x;
    player.y = start.y;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
  }
  initPositions();

  // keyboard
  window.addEventListener('keydown', e => {
    if (gameOver) return;
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    if (e.key === 'ArrowUp') { if (player.onGround) { player.vy = jumpSpeed; player.onGround = false; } e.preventDefault(); }
  });
  window.addEventListener('keyup', e => { if (e.key === 'ArrowLeft') keys.left = false; if (e.key === 'ArrowRight') keys.right = false; });

  // touch / pointer controls
  function setupBtn(id, action) {
    const el = document.getElementById(id);
    if (!el) return;
    const down = (ev) => { ev.preventDefault(); if (gameOver) return; action(true); };
    const up = (ev) => { ev.preventDefault(); action(false); };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    el.addEventListener('touchstart', down, {passive:false});
    window.addEventListener('touchend', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('touchcancel', up);
  }
  setupBtn('leftBtn', v => keys.left = v);
  setupBtn('rightBtn', v => keys.right = v);
  const jumpBtn = document.getElementById('jumpBtn');
  if (jumpBtn) {
    jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (gameOver) return; if (player.onGround) { player.vy = jumpSpeed; player.onGround = false; } });
    jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); if (gameOver) return; if (player.onGround) { player.vy = jumpSpeed; player.onGround = false; } }, {passive:false});
  }

  let camX = 0;
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function checkSpikeCollision() {
    const gY = groundY();
    const spikeTop = gY - spike.h;
    const playerLeft = player.x - player.w/2;
    const playerRight = player.x + player.w/2;
    const spikeLeft = spike.x - spike.w/2;
    const spikeRight = spike.x + spike.w/2;
    const playerBottom = player.y + player.h;
    if (playerRight > spikeLeft && playerLeft < spikeRight && playerBottom > spikeTop) return true;
    return false;
  }

  function update(dt) {
    start.y = groundY() - 40;
    if (gameOver) {
      gameOverTimer -= dt;
      if (gameOverTimer <= 0) initPositions();
      return;
    }
    let ax = 0; if (keys.left) ax -= 1; if (keys.right) ax += 1; player.vx = ax * moveSpeed;
    player.vy += gravity * dt; player.x += player.vx * dt; player.y += player.vy * dt;
    const gY = groundY(); if (player.y + player.h > gY) { player.y = gY - player.h; player.vy = 0; player.onGround = true; }
    if (checkSpikeCollision()) { gameOver = true; gameOverTimer = 5.0; player.vx = 0; player.vy = 0; return; }
    if (player.x < 20) player.x = 20; if (player.x > 5000) player.x = 5000;
    const canvasW = canvas.width / DPR; camX = player.x - canvasW/2; if (camX < 0) camX = 0;
  }

  function render() {
    const w = canvas.width / DPR; const h = canvas.height / DPR; ctx.clearRect(0,0,w,h);
    const gY = groundY(); ctx.save(); ctx.translate(-camX,0);
    ctx.fillStyle = '#2b2b3f'; ctx.fillRect(0, gY, 6000, h - gY);
    for (let i=0;i<40;i++){ ctx.fillStyle = i%2 ? '#47506a' : '#3b3f58'; ctx.fillRect(200 + i*140, gY - (i%3?20:60), 100, (i%3?20:60)); }
    ctx.fillStyle = spike.color; const sx = spike.x, sw = spike.w, sh = spike.h; ctx.beginPath(); ctx.moveTo(sx - sw/2, gY); ctx.lineTo(sx, gY - sh); ctx.lineTo(sx + sw/2, gY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = player.color; ctx.fillRect(player.x - player.w/2, player.y, player.w, player.h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(player.x, gY + 6, player.w, 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore(); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(8,8,340,36); ctx.fillStyle = '#fff'; ctx.font = '14px system-ui, -apple-system'; ctx.fillText('← / → or touch • Up arrow to jump', 14, 32);
    if (gameOver) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0,0,w,h); ctx.fillStyle = '#ffdddd'; ctx.font = '48px system-ui, -apple-system'; ctx.textAlign='center'; ctx.fillText('GAME OVER', w/2, h/2 - 10); ctx.font = '20px system-ui, -apple-system'; ctx.fillStyle = '#fff'; const sec = Math.ceil(gameOverTimer); ctx.fillText('Respawning in ' + sec + '...', w/2, h/2 + 30); ctx.textAlign='start'; }
  }

  requestAnimationFrame(loop);
})();
