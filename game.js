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

  // player
  const player = {
    x: 120,
    y: groundY() - 40,
    w: 36,
    h: 36,
    vx: 0,
    vy: 0,
    color: '#ffdd57',
    onGround: false
  };

  const gravity = 1700; // px/s^2
  const moveSpeed = 320; // px/s
  const jumpSpeed = -620; // px/s (negative = up)

  const keys = { left:false, right:false, jump:false };

  // keyboard
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    if (e.key === 'ArrowUp') {
      if (player.onGround) {
        player.vy = jumpSpeed;
        player.onGround = false;
      }
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
  });

  // touch / pointer controls for iPad
  function setupBtn(id, action) {
    const el = document.getElementById(id);
    if (!el) return;
    const down = (ev) => { ev.preventDefault(); action(true); };
    const up = (ev) => { ev.preventDefault(); action(false); };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    el.addEventListener('touchstart', down, {passive:false});
    window.addEventListener('touchend', up);
    // also cancel on pointercancel / leave
    el.addEventListener('pointercancel', up);
    el.addEventListener('touchcancel', up);
  }

  setupBtn('leftBtn', v => keys.left = v);
  setupBtn('rightBtn', v => keys.right = v);
  // jump button triggers a one-time jump on press
  const jumpBtn = document.getElementById('jumpBtn');
  if (jumpBtn) {
    jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (player.onGround) { player.vy = jumpSpeed; player.onGround = false; } });
    jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); if (player.onGround) { player.vy = jumpSpeed; player.onGround = false; } }, {passive:false});
  }

  // simple camera follow horizontally
  let camX = 0;

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    // horizontal acceleration / movement
    let ax = 0;
    if (keys.left) ax -= 1;
    if (keys.right) ax += 1;
    // immediate vx control (no inertia) for simple feel
    player.vx = ax * moveSpeed;

    // gravity
    player.vy += gravity * dt;

    // integrate
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // ground collision
    const gY = groundY();
    if (player.y + player.h > gY) {
      player.y = gY - player.h;
      player.vy = 0;
      player.onGround = true;
    }

    // keep player in bounds horizontally
    if (player.x < 20) player.x = 20;
    if (player.x > 5000) player.x = 5000; // big level width

    // camera follows player
    const canvasW = canvas.width / DPR;
    camX = player.x - canvasW / 2;
    if (camX < 0) camX = 0;
  }

  function render() {
    const w = canvas.width / DPR;
    const h = canvas.height / DPR;
    // sky background already set by CSS but clear anyway
    ctx.clearRect(0,0,w,h);

    // draw simple repeating ground
    const gY = groundY();

    // parallax background
    ctx.fillStyle = '#7ec8ff';
    ctx.fillRect(0,0,w,h);

    // draw some platforms / ground tiles across a long level
    ctx.save();
    ctx.translate(-camX,0);

    // ground
    ctx.fillStyle = '#2b2b3f';
    ctx.fillRect(0, gY, 6000, h - gY);

    // decorative rectangles
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = i % 2 ? '#47506a' : '#3b3f58';
      ctx.fillRect(200 + i*140, gY - (i%3?20:60), 100, (i%3?20:60));
    }

    // player
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x - player.w/2, player.y, player.w, player.h);

    // simple shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(player.x, gY + 6, player.w, 6, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();

    // HUD - show controls hints
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(8,8,220,36);
    ctx.fillStyle = '#fff';
    ctx.font = '14px system-ui, -apple-system';
    ctx.fillText('← / → or touch • Up arrow to jump', 14, 32);
  }

  requestAnimationFrame(loop);
})();
