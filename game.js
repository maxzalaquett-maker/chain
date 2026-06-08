(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const W = canvas.width, H = canvas.height;

  let audioCtx=null, musicStarted=false;
  function ac(){ if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); return audioCtx; }
  function tone(freq,dur,type='sine',vol=.04,slide=1){
    const c=ac(),t=c.currentTime,o=c.createOscillator(),g=c.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t); o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*slide),t+dur);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(t+dur);
  }
  const sfx={
    shoot(){tone(740,.05,'square',.03,.7);},
    slash(){tone(220,.08,'sawtooth',.05,2);},
    bomb(){tone(90,.28,'square',.06,.4); setTimeout(()=>tone(55,.22,'sawtooth',.05,.3),60);},
    hit(){tone(120,.1,'triangle',.05,.6);},
    bubble(){tone(520,.05,'sine',.025,1.4); tone(780,.08,'sine',.018,1.15);}
  };
  function startMusic(){
    if(musicStarted) return; musicStarted=true; ac();
    const bass=[110,123,98,82],lead=[330,392,440,392,523,392,330,294];
    let step=0;
    setInterval(()=>{
      if(state.mode!=='play') return;
      const sus=Math.min(1,state.distance/3600);
      tone(bass[step%4],0.45,'triangle',0.02+sus*.01,.98);
      if(step%2===0) tone(lead[step%lead.length]*(1+sus*.15),0.16,'sine',0.015+sus*.008,.98);
      if(step%4===1) tone(lead[(step+2)%lead.length]/2,0.09,'square',0.01,.9);
      step++;
    },320);
  }

  const sheet = new Image();
  sheet.src = 'assets/spritesheet.png';

  const S = {
    chainRight:[432,306,148,92], chainSwim:[35,94,112,115], chainDown:[170,108,115,94], chainLeft:[306,110,115,87],
    chainShoot:[33,305,163,94], chainSword:[212,306,159,95], chainBomb:[404,307,150,94],
    arrow:[626,88,75,28], slash:[641,184,72,78], bomb:[539,572,75,78], bombFly:[628,282,72,82], boom:[626,394,75,75],
    bubble:[74,596,49,51], bigBubble:[220,568,85,86], heart:[390,592,72,64],
    purple:[900,178,70,56], purple2:[989,177,70,58], blue:[887,360,77,63], blue2:[986,360,77,63],
    blobShot:[904,492,28,29], angler:[1200,104,267,196], anglerSmall:[1193,349,141,107], laser:[1220,595,238,40]
  };

  const keys = Object.create(null);
  addEventListener('keydown', e => {
    const k=e.key.toLowerCase();
    keys[k] = true;
    if (state.mode === 'title') start();
    else if ((state.mode === 'gameover' || state.mode === 'win') && k === ' ') start();
    if (k==='p' && state.mode==='play') state.paused=!state.paused;
  });
  addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

  const rand = (a,b)=>a+Math.random()*(b-a);
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const hit = (a,b)=>Math.abs(a.x-b.x)*2 < (a.w+b.w) && Math.abs(a.y-b.y)*2 < (a.h+b.h);

  const state = { mode:'title', paused:false, t:0, score:0, distance:0, level:1, boss:false, over:false, endT:0, endScore:0, endType:'' };
  const player = { x:140, y:230, w:58, h:58, hp:100, air:100, bombs:3, inv:0, slow:0, face:'right', action:0, actionType:'', fireCd:0, swordCd:0, bombCd:0 };
  let arrows=[], slashes=[], bombs=[], booms=[], enemies=[], shots=[], pickups=[], particles=[];
  let boss = null;

  function reset(){
    Object.assign(state,{mode:'play',paused:false,t:0,score:0,distance:0,level:1,boss:false,over:false,endT:0,endScore:0,endType:''});
    Object.assign(player,{x:140,y:230,hp:100,air:100,bombs:3,inv:0,slow:0,fireCd:0,swordCd:0,bombCd:0,action:0});
    arrows=[]; slashes=[]; bombs=[]; booms=[]; enemies=[]; shots=[]; pickups=[]; particles=[]; boss=null;
  }
  function start(){ reset(); startMusic(); }

  function drawSprite(name,x,y,w,h,flip=false){
    const r=S[name]; if(!r) return;
    ctx.save();
    if(flip){ ctx.translate(x+w/2,y-h/2); ctx.scale(-1,1); ctx.drawImage(sheet,...r,-w/2,-h/2,w,h); }
    else ctx.drawImage(sheet,...r,x-w/2,y-h/2,w,h);
    ctx.restore();
  }

  function spawn(){
    if (state.t%70===0 && !state.boss) enemies.push({type:Math.random()<.45?'blue':'purple', x:W+60, y:rand(80,H-80), w:54,h:44, hp:Math.random()<.45?2:1, vy:rand(-1.2,1.2), shoot:rand(30,120)});
    if (state.t%135===0) pickups.push({type:'bubble', x:W+50, y:rand(90,H-90), w:34,h:34, vx:-2.3, val:10});
    if (state.t%260===0) pickups.push({type:'bigBubble', x:rand(260,W-80), y:H+50, w:62,h:62, vx:-.6, vy:-2.2, val:30});
    if (state.t%420===0) pickups.push({type:'heart', x:W+40, y:rand(95,H-80), w:42,h:38, vx:-2.1});
    if (state.t%520===0) pickups.push({type:'bomb', x:W+40, y:rand(95,H-80), w:42,h:42, vx:-2.1});
    if (state.distance>3600 && !state.boss) {
      state.boss=true; enemies=[]; boss={x:W+170,y:H/2,w:168,h:118,hp:32,max:32,phase:0,cd:90,vy:1.1,inv:0};
    }
  }

  function damageEnemy(e,d){ e.hp-=d; particles.push({x:e.x,y:e.y,t:18}); sfx.hit(); if(e.hp<=0){ state.score+=e.type==='boss'?1000:100; e.dead=true; if(Math.random()<.16) pickups.push({type:'heart',x:e.x,y:e.y,w:40,h:36,vx:-1.5}); } }
  function endGame(type){ state.mode=type; state.endT=0; state.endScore=state.score; state.endType=type; }
  function hurt(d){ if(player.inv>0) return; player.hp-=d; player.inv=60; if(player.hp<=0) endGame('gameover'); }

  function update(){
    if(state.mode!=='play' || state.paused) return;
    state.t++; state.distance+=1.25; spawn();
    const speed = player.slow>0 ? 2.1 : 3.5;
    let dx=0,dy=0;
    if(keys.arrowleft||keys.a) dx--; if(keys.arrowright||keys.d) dx++; if(keys.arrowup||keys.w) dy--; if(keys.arrowdown||keys.s) dy++;
    player.x=clamp(player.x+dx*speed,35,W-40); player.y=clamp(player.y+dy*speed,38,H-35); if(dx<0) player.face='left'; if(dx>0) player.face='right';
    if(player.y<38) player.air=100; else player.air-=0.025; if(player.air<=0){ player.air=0; if(state.t%40===0) hurt(20); }
    ['inv','slow','fireCd','swordCd','bombCd','action'].forEach(k=>player[k]=Math.max(0,player[k]-1));
    if((keys.j||keys.z) && player.fireCd<=0){ arrows.push({x:player.x+34,y:player.y-18,w:42,h:14,vx:8}); player.fireCd=18; sfx.shoot(); player.action=12; player.actionType='shoot'; }
    if((keys.k||keys.x) && player.swordCd<=0){ slashes.push({x:player.x+50,y:player.y-12,w:55,h:62,t:12}); sfx.slash(); player.swordCd=30; player.action=15; player.actionType='sword'; }
    if((keys.l||keys.c) && player.bombCd<=0 && player.bombs>0){ bombs.push({x:player.x+38,y:player.y-18,w:34,h:34,vx:5,vy:-1,t:70}); player.bombs--; sfx.bomb(); player.bombCd=45; player.action=14; player.actionType='bomb'; }

    arrows.forEach(a=>a.x+=a.vx); arrows=arrows.filter(a=>a.x<W+80);
    slashes.forEach(s=>{s.t--; s.x=player.x+55; s.y=player.y-12}); slashes=slashes.filter(s=>s.t>0);
    bombs.forEach(b=>{b.x+=b.vx; b.y+=b.vy; b.vy+=.045; b.t--; if(b.t<=0){ b.dead=true; booms.push({x:b.x,y:b.y,w:92,h:92,t:16}); }}); bombs=bombs.filter(b=>!b.dead && b.x<W+60);
    booms.forEach(b=>b.t--); booms=booms.filter(b=>b.t>0);

    enemies.forEach(e=>{ e.x-= e.type==='blue'?2.0:1.45; e.y+=e.vy+Math.sin(state.t/25+e.x)*.5; if(e.y<60||e.y>H-55)e.vy*=-1; e.shoot--; if(e.type==='blue'&&e.shoot<0){ shots.push({x:e.x-30,y:e.y-15,w:22,h:22,vx:-4.2,slow:true}); e.shoot=rand(80,160); } if(hit(player,e)){ hurt(20); e.dead=true; }});
    enemies=enemies.filter(e=>!e.dead && e.x>-80);
    shots.forEach(s=>{s.x+=s.vx}); shots=shots.filter(s=>s.x>-40);
    pickups.forEach(p=>{p.x+=p.vx||0; p.y+=p.vy||0; if(p.type==='bigBubble') p.x+=Math.sin(state.t/20)*.4; if(hit(player,p)){ if(p.type==='bubble'||p.type==='bigBubble') player.air=clamp(player.air+p.val,0,100); sfx.bubble(); if(p.type==='heart') player.hp=clamp(player.hp+20,0,100); if(p.type==='bomb') player.bombs=clamp(player.bombs+1,0,9); p.dead=true; state.score+=25; }});
    pickups=pickups.filter(p=>!p.dead && p.x>-70 && p.y>-80);

    if(boss){
      boss.x=Math.max(W-145,boss.x-1.2); boss.y+=boss.vy; if(boss.y<115||boss.y>H-85) boss.vy*=-1; boss.cd--; if(boss.cd<0){
        if(Math.random()<.52) shots.push({x:boss.x-95,y:boss.y-40,w:26,h:26,vx:-5.3,slow:true});
        else shots.push({x:boss.x-100,y:boss.y-22,w:170,h:28,vx:-8,laser:true,life:28});
        boss.cd=rand(55,115);
      }
      if(hit(player,boss)) hurt(20);
      if(boss.hp<=0){ state.score+=1500; state.endScore=state.score; endGame('win'); }
    }
    shots.forEach(s=>{ if(s.life) s.life--; if(hit(player,s)){ hurt(s.laser?20:20); if(s.slow) player.slow=120; s.dead=true; }}); shots=shots.filter(s=>!s.dead && (!s.life || s.life>0));

    const targets = boss ? enemies.concat([{...boss,type:'boss'}]) : enemies;
    for (const a of arrows) for (const e of enemies) if(hit(a,e)){a.dead=true; damageEnemy(e,1)}
    for (const s of slashes) for (const e of enemies) if(hit(s,e)) damageEnemy(e,2);
    for (const b of booms) for (const e of enemies) if(hit(b,e)) damageEnemy(e,4);
    if(boss){
      for (const a of arrows) if(hit(a,boss)){a.dead=true; boss.hp-=1;}
      for (const s of slashes) if(hit(s,boss)) boss.hp-=.08;
      for (const b of booms) if(hit(b,boss)) boss.hp-=.35;
    }
    arrows=arrows.filter(a=>!a.dead); particles.forEach(p=>p.t--); particles=particles.filter(p=>p.t>0);
  }

  function bg(){
    let g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#064f80'); g.addColorStop(.45,'#063052'); g.addColorStop(1,'#02091d'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=.22; ctx.fillStyle='#7bd7ff'; for(let i=0;i<70;i++){ const x=(i*137-state.t*1.7)%1040-40, y=(i*71%500)+20; ctx.fillRect(x,y,2+(i%3),2+(i%3)); } ctx.globalAlpha=1;
    ctx.fillStyle='#07101b'; for(let x=-80+(-state.t*2%80);x<W+80;x+=80){ ctx.beginPath(); ctx.moveTo(x,H); ctx.lineTo(x+35,H-28-((x/80)%4)*8); ctx.lineTo(x+80,H); ctx.fill(); }
    ctx.fillStyle='#0b2b39'; for(let x=-120+(-state.t*.8%140);x<W+140;x+=140){ ctx.fillRect(x,H-62,10,62); ctx.fillRect(x+20,H-45,8,45); ctx.fillRect(x+38,H-72,12,72); }
  }
  function hud(){
    ctx.font='18px monospace'; ctx.fillStyle='#fff'; ctx.fillText('HP',18,28); bar(55,14,170,14,player.hp,'#e84855'); ctx.fillText('AIR',18,54); bar(55,40,170,14,player.air,'#64d8ff'); ctx.fillText('BOMBS '+player.bombs,250,28); ctx.fillText('SCORE '+state.score,250,54);
    if(boss){ ctx.fillText('ANGLER FISH',W-260,28); bar(W-260,40,220,14,100*boss.hp/boss.max,'#b25cff'); }
  }
  function bar(x,y,w,h,v,c){ ctx.fillStyle='#001427'; ctx.fillRect(x,y,w,h); ctx.strokeStyle='#fff'; ctx.strokeRect(x,y,w,h); ctx.fillStyle=c; ctx.fillRect(x+2,y+2,(w-4)*clamp(v,0,100)/100,h-4); }
  function render(){
    bg();
    if(state.mode==='title') return title();
    pickups.forEach(p=>drawSprite(p.type,p.x,p.y,p.type==='bigBubble'?62:40,p.type==='bigBubble'?62:40));
    enemies.forEach(e=>drawSprite(e.type==='blue'?'blue':'purple',e.x,e.y,e.w,e.h));
    if(boss) drawSprite('angler',boss.x,boss.y,190,140);
    arrows.forEach(a=>drawSprite('arrow',a.x,a.y,45,17)); slashes.forEach(s=>drawSprite('slash',s.x,s.y,55,62)); bombs.forEach(b=>drawSprite('bombFly',b.x,b.y,38,42)); booms.forEach(b=>drawSprite('boom',b.x,b.y,70,70));
    shots.forEach(s=> s.laser ? drawSprite('laser',s.x,s.y,170,28) : drawSprite('blobShot',s.x,s.y,24,24));
    let sprite = player.actionType==='shoot'&&player.action?'chainShoot':player.actionType==='sword'&&player.action?'chainSword':player.actionType==='bomb'&&player.action?'chainBomb':'chainRight';
    drawSprite(sprite,player.x,player.y,90,58,player.face==='left'); if(player.inv%8>3){ctx.globalAlpha=.45;ctx.fillStyle='#fff';ctx.fillRect(player.x-32,player.y-48,64,50);ctx.globalAlpha=1;}
    particles.forEach(p=>{ctx.strokeStyle='#fff';ctx.strokeRect(p.x-20,p.y-35,40,30)});
    hud();
    if(player.slow>0){ ctx.fillStyle='rgba(90,190,255,.18)'; ctx.fillRect(0,0,W,H); ctx.fillStyle='#9be5ff'; ctx.fillText('SLOWED!', W/2-45, 72); }
    if(state.paused) overlay('PAUSED','Press P to resume');
    if(state.mode==='gameover') gameOverScreen();
    if(state.mode==='win') victoryScreen();
  }

  function gameOverScreen(){
    state.endT++;
    ctx.fillStyle='rgba(0,0,0,.72)'; ctx.fillRect(0,0,W,H);
    const drop=Math.min(1,state.endT/55), shake=state.endT<70?Math.sin(state.endT*.9)*4:0;
    ctx.textAlign='center';
    ctx.font='56px monospace'; ctx.fillStyle='#ff4f66';
    ctx.fillText('GAME OVER',W/2+shake,60+drop*120);
    ctx.font='22px monospace'; ctx.fillStyle='#9be5ff';
    const shown=Math.floor(state.endScore*Math.min(1,Math.max(0,(state.endT-45)/70)));
    ctx.fillText('FINAL SCORE',W/2,H/2+32);
    ctx.font='48px monospace'; ctx.fillStyle='#fff'; ctx.fillText(String(shown).padStart(6,'0'),W/2,H/2+88);
    for(let i=0;i<10;i++){
      ctx.globalAlpha=.35; drawSprite('bubble',(i*97+state.endT*1.5)%W,H-20-((state.endT*2+i*43)%H),24+(i%3)*6,24+(i%3)*6); ctx.globalAlpha=1;
    }
    ctx.font='21px monospace'; ctx.fillStyle=(state.endT%60<36)?'#fff':'#78d8ff';
    ctx.fillText('PRESS SPACEBAR TO TRY AGAIN',W/2,H-70);
    ctx.textAlign='left';
  }
  function drawTrophy(x,y,scale=1){
    ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
    ctx.fillStyle='#f6c744'; ctx.fillRect(-28,-36,56,46); ctx.fillRect(-15,10,30,18); ctx.fillRect(-32,28,64,10);
    ctx.strokeStyle='#fff3a8'; ctx.lineWidth=4; ctx.strokeRect(-39,-27,12,22); ctx.strokeRect(27,-27,12,22);
    ctx.fillStyle='#3b2a12'; ctx.font='9px monospace'; ctx.textAlign='center';
    ctx.fillText('BEST LINK',0,-18); ctx.fillText('IN THE',0,-6); ctx.fillText('CHAIN',0,6);
    ctx.restore();
  }
  function victoryScreen(){
    state.endT++;
    ctx.fillStyle='rgba(0,18,38,.55)'; ctx.fillRect(0,0,W,H);
    const fishX=W-185, fishY=H/2-10;
    drawSprite('angler',fishX,fishY,220,162);
    const spit=Math.min(1,state.endT/95);
    const arc=Math.sin(spit*Math.PI)*95;
    const trophyX=fishX-65-spit*390;
    const trophyY=fishY-25-arc+Math.sin(state.endT*.18)*5;
    drawTrophy(trophyX,trophyY,1.15);
    ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.font='40px monospace';
    ctx.fillText('VICTORY!',W/2,76);
    ctx.font='20px monospace'; ctx.fillStyle='#fff8b5';
    ctx.fillText('The angler fish spits out your trophy...',W/2,112);
    ctx.font='23px monospace'; ctx.fillStyle='#ffffff';
    ctx.fillText('“Best link in the chain”',W/2,340);
    ctx.font='25px monospace'; ctx.fillText('SCORE '+String(state.endScore).padStart(6,'0'),W/2,390);
    ctx.font='21px monospace'; ctx.fillStyle=(state.endT%60<36)?'#fff':'#78d8ff';
    ctx.fillText('PRESS SPACEBAR TO START A NEW GAME',W/2,H-64);
    ctx.textAlign='left';
  }

  function title(){
    ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(0,0,W,H);
    ctx.font='42px monospace'; ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText("CHAIN'S UNDERWATER SHOOTOUT",W/2,100);
    drawSprite('chainShoot',260,245,145,90); drawSprite('purple',500,245,80,62); drawSprite('blue',600,245,82,66); drawSprite('angler',770,245,185,135);
    ctx.font='22px monospace'; ctx.fillText('WASD / ARROWS: SWIM',W/2,360); ctx.fillText('J/Z: ARROW   K/X: SWORD   L/C: BOMB',W/2,395); ctx.fillText('COLLECT BUBBLES FOR AIR. REACH THE SURFACE TO REFILL.',W/2,430);
    ctx.font='26px monospace'; ctx.fillText('PRESS ANY KEY TO START',W/2,485); ctx.textAlign='left';
  }
  function overlay(a,b){ ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(0,0,W,H); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='44px monospace'; ctx.fillText(a,W/2,H/2-20); ctx.font='22px monospace'; ctx.fillText(b,W/2,H/2+28); ctx.textAlign='left';  }
  function loop(){ update(); render(); requestAnimationFrame(loop); }
  sheet.onload=loop;
})();
