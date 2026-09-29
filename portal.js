/* SV/BSC Scout · Kabine (Spielerseite über den Team-Link) – Abstimmen und Mannschaftskasse, ohne Anmeldung */
(function(){
  'use strict';
  const C=window.KAB_CFG||{}, $=s=>document.querySelector(s), app=$('#app');
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ls={get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} },del(k){ try{ localStorage.removeItem(k); }catch(e){} }};
  // Geteilter Bericht: …/b-<code> (PDF/Excel aus der App, ohne Anmeldung)
  const bm=location.pathname.match(/\/b-([A-Za-z0-9]{10,16})\/?$/);
  if(bm){ bericht(bm[1]); return; }
  async function bericht(tok){
    app.innerHTML='<div class="card empty"><h2>Lade Bericht …</h2></div>';
    try{ const r=await fetch(C.url+'/rest/v1/rpc/bericht_get',{method:'POST',headers:{'Content-Type':'application/json',apikey:C.anon,Authorization:'Bearer '+C.anon},body:JSON.stringify({p_token:tok})});
      const b=await r.json(); if(!r.ok||!b||!b.data)throw new Error('Der Link ist abgelaufen oder ungültig.');
      const s2=atob(b.data), u=new Uint8Array(s2.length); for(let i=0;i<s2.length;i++)u[i]=s2.charCodeAt(i); const url=URL.createObjectURL(new Blob([u],{type:b.mime})), pdf=/pdf/.test(b.mime);
      app.innerHTML=`<div class="card hero"><span class="pill">${pdf?'📄 PDF':'📊 Excel'}</span><h2 style="margin:12px 0 4px">${esc(b.name.replace(/\.(pdf|xlsx)$/,''))}</h2><small>SV/BSC Mörlenbach · erstellt ${esc(new Date(b.created_at).toLocaleDateString('de-DE'))}</small></div>
        <a class="pay" href="${url}" download="${esc(b.name)}">Herunterladen</a>${pdf?`<a class="btn2" style="display:block;text-align:center;text-decoration:none;color:inherit" href="${url}" target="_blank" rel="noopener">Im Browser öffnen</a>`:''}`;
    }catch(e){ app.innerHTML=`<div class="card err empty"><h2>Bericht nicht verfügbar</h2><p class="note">${esc(e.message)}</p></div>`; }
  }
  const hp=new URLSearchParams(location.hash.slice(1));
  // Link-Formen: …/team.html#k=<code>  oder kurz …/<code> (persönlicher Link)
  const seg=(location.pathname.split('/').pop()||''), pathKey=/^[A-Za-z0-9]{8,40}$/.test(seg)&&!/\.html?$/.test(seg)?seg:'';
  let KEY=hp.get('k')||pathKey||ls.get('kab_k')||''; if(hp.get('k')||pathKey)ls.set('kab_k',KEY);
  const FOCUS=hp.get('a')||null;
  let ME=null; try{ ME=JSON.parse(ls.get('kab_me')||'null'); }catch(e){}
  let S=null, view=FOCUS?'abst':(hp.get('v')==='kasse'?'kasse':(ls.get('kab_view')||'abst')), busy=false;
  const REASONS={arbeit:'Arbeit/Schicht',urlaub:'Urlaub',krank:'Krank',verletzt:'Verletzt',uni:'Schule/Uni',familie:'Familie',privat:'Privat'};
  const ART={training:'Training',spiel:'Spiel',event:'Event',sonstiges:'Termin'};
  const eur=v=>(Math.round((+v||0)*100)/100).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
  const wd=d=>{ try{ return new Date(d+'T12:00:00').toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'2-digit'}); }catch(e){ return d; } };
  const toast=t=>{ document.querySelectorAll('.toast').forEach(x=>x.remove()); const e=document.createElement('div'); e.className='toast'; e.textContent=t; document.body.appendChild(e); setTimeout(()=>e.remove(),2600); };
  async function rpc(fn,body){
    const r=await fetch(C.url+'/rest/v1/rpc/'+fn,{method:'POST',headers:{'Content-Type':'application/json',apikey:C.anon,Authorization:'Bearer '+C.anon},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>null); if(!r.ok)throw new Error((j&&j.message)||('Fehler '+r.status)); return j;
  }
  async function load(){
    if(!KEY||KEY.length<8){ app.innerHTML=`<div class="card empty"><h2>Link fehlt</h2><p class="note">Bitte den Kabinen-Link aus der WhatsApp-Gruppe öffnen.</p></div>`; return; }
    try{ S=await rpc('portal_state',{p_key:KEY}); if(S.ich){ ME={id:S.ich.id,name:S.ich.name||'Du',fest:true}; ls.set('kab_me',JSON.stringify(ME)); } render(); }
    catch(e){ app.innerHTML=`<div class="card err empty"><h2>Link ungültig</h2><p class="note">${esc(e.message)}</p></div>`; if(/ungültig|erneuert/.test(e.message))ls.del('kab_k'); }
  }
  function roster(){
    const m=new Map(); (S.polls||[]).forEach(p=>(p.teilnehmer||[]).forEach(t=>m.set(t.id,t.name)));
    ((S.kasse&&S.kasse.buchungen)||[]).forEach(b=>{ if(b.p&&b.name&&!m.has(b.p))m.set(b.p,b.name); });
    return [...m.entries()].map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name,'de'));
  }
  function meBtn(){ const b=$('#me'); if(!ME){ b.style.display='none'; return; } b.style.display=''; const ini=ME.name.split(' ').map(w=>w[0]).slice(0,2).join('');
    b.innerHTML=`<i>${esc(ini)}</i>${esc(ME.name.split(' ')[0])}`; b.onclick=()=>{ if(ME.fest){ toast('Das ist dein persönlicher Link, nur für dich.'); return; } if(confirm('Nicht '+ME.name+'? Namen neu wählen.')){ ME=null; ls.del('kab_me'); render(); } }; }
  function render(){
    meBtn();
    const R=roster();
    if(ME&&!R.some(x=>x.id===ME.id)&&R.length){ /* nicht mehr auf der Liste, trotzdem anzeigen */ }
    if(!ME){
      const tgt=target();
      app.innerHTML=`<div class="card"><h2>Wer bist du?</h2><p class="note">Tippe auf deinen <b>Vor- und Nachnamen</b> · das Handy merkt es sich. Danach reicht ein Klick: dabei oder nicht dabei.</p>
        <input class="search" id="q" type="search" placeholder="Name suchen …" autocomplete="off"><div class="pick" id="pk"></div></div>
        ${tgt?`<div class="card neu"><h2>Nicht in der Liste?</h2><p class="note">Dann trag dich mit Vor- und Nachnamen ein, beides ist Pflicht.</p>
          <div class="nm"><input class="txt" id="gV" placeholder="Vorname" autocomplete="given-name" maxlength="30"><input class="txt" id="gN" placeholder="Nachname" autocomplete="family-name" maxlength="40"></div>
          <button class="btn2 full" id="gGo">Eintragen</button></div>`:'<p class="note" style="text-align:center">Du fehlst? Kurz beim Trainer melden. Er setzt dich auf die Liste.</p>'}`;
      const gg=$('#gGo'); if(gg)gg.onclick=()=>gast(tgt.id,$('#gV').value,$('#gN').value);
      const draw=q=>{ const n=(q||'').toLowerCase(); $('#pk').innerHTML=R.filter(x=>!n||x.name.toLowerCase().includes(n)).map(x=>`<button data-id="${esc(x.id)}">${esc(x.name)}</button>`).join('')||'<p class="note">Kein Treffer.</p>';
        document.querySelectorAll('#pk [data-id]').forEach(b=>b.onclick=()=>{ ME={id:b.dataset.id,name:R.find(x=>x.id===b.dataset.id).name}; ls.set('kab_me',JSON.stringify(ME)); render(); }); };
      draw(''); $('#q').oninput=e=>draw(e.target.value); return;
    }
    app.innerHTML=`<div class="tabs"><button data-v="abst" class="${view==='abst'?'on':''}">Abstimmungen</button><button data-v="kasse" class="${view==='kasse'?'on':''}">Mannschaftskasse</button></div><div id="body"></div>`;
    document.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{ view=b.dataset.v; ls.set('kab_view',view); render(); });
    (view==='kasse'?kasse:polls)($('#body'));
  }
  // Abstimmung, in die man sich selbst einträgt: die aus dem Link, sonst die nächste offene
  function target(){ if(S.ich)return null; const open=(S.polls||[]).filter(p=>p.datum>=S.heute&&!p.geschlossen).sort((a,b)=>a.datum<b.datum?-1:1);
    return open.find(p=>p.id===FOCUS)||open[0]||null; }
  async function gast(poll,v,n){
    v=String(v||'').trim(); n=String(n||'').trim();
    if(v.length<2||n.length<2){ toast('Bitte Vor- und Nachname eintragen'); return; }
    if(busy)return; busy=true;
    try{ const r=await rpc('portal_gast',{p_key:KEY,p_poll:poll,p_vorname:v,p_nachname:n}); ME={id:r.id,name:r.name}; ls.set('kab_me',JSON.stringify(ME));
      toast(r.neu?'✓ Eingetragen: jetzt zu- oder absagen':'✓ Gefunden: '+r.name); busy=false; await load(); return; }
    catch(e){ toast('⚠️ '+e.message); }
    busy=false;
  }
  // ---------- Materialdienst und Urlaub ----------
  let ABW=null, abwOpen=false;
  const tm=d=>{ const x=String(d).split('-'); return (+x[2])+'.'+(+x[1])+'.'; };
  function mdHtml(){
    const L=(S.material||[]); if(!L.length)return '';
    const cur=L.find(m=>m.von<=S.heute&&S.heute<=m.bis), mine=L.find(m=>(m.spieler||[]).some(x=>x.id===ME.id));
    const nm=m=>(m.spieler||[]).map(x=>String(x.name||'').split(' ')[0]).join(' und ');
    if(mine&&mine===cur)return `<div class="card md du"><span class="pill">🧺 Materialdienst</span><b class="big2">Du bist dran</b><p class="note">Bis ${tm(cur.bis)}${(cur.spieler||[]).length>1?' zusammen mit '+esc((cur.spieler||[]).filter(x=>x.id!==ME.id).map(x=>x.name).join(', ')):''}: Bälle, Leibchen und Hütchen mitbringen und nach dem Training wieder einräumen.${cur.notiz?' '+esc(cur.notiz):''}</p></div>`;
    return `<div class="card md"><span class="pill">🧺 Materialdienst</span>${cur?`<b class="big2">${esc(nm(cur))}</b><p class="note">bis ${tm(cur.bis)}</p>`:''}${mine?`<p class="note"><b>Du bist ab ${tm(mine.von)} dran</b> (bis ${tm(mine.bis)}).</p>`:''}</div>`;
  }
  function urHtml(){
    const L=ABW||[], G={urlaub:'Urlaub',arbeit:'Arbeit',uni:'Schule/Uni',familie:'Familie',privat:'Privat'};
    const heute=S.heute, in7=new Date(new Date(heute+'T12:00:00').getTime()+7*864e5).toISOString().slice(0,10);
    return `<div class="card ur"><h2>🌴 Urlaub eintragen</h2><p class="note">Trag frühzeitig ein, wann du nicht kannst. Für alle Trainings in dem Zeitraum bist du dann automatisch abgemeldet und bekommst keine Erinnerungen.</p>
      ${L.map(a=>`<div class="row2"><div><b>${esc(G[a.grund]||a.grund)}</b><small>${esc(wd(a.von))} bis ${esc(wd(a.bis))}${a.notiz?' · '+esc(a.notiz):''}</small></div><button class="x" data-urx="${esc(a.id)}">Löschen</button></div>`).join('')}
      ${abwOpen?`<div class="two"><label>Von<input class="txt" type="date" id="urV" value="${heute}" min="${heute}"></label><label>Bis<input class="txt" type="date" id="urB" value="${in7}" min="${heute}"></label></div>
        <label>Grund<select class="txt" id="urG">${Object.entries(G).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>
        <input class="txt" id="urN" maxlength="200" placeholder="Notiz für den Trainer (optional)">
        <button class="btn2 full" id="urS" style="margin-top:10px">Eintragen</button>`:`<button class="btn2 full" id="urO" style="margin-top:10px">+ Zeitraum eintragen</button>`}</div>`;
  }
  async function abwLoad(){ try{ ABW=await rpc('portal_abwesend',{p_key:KEY,p_player:ME.id}); }catch(e){ ABW=[]; } }
  function urWire(){
    const o=$('#urO'); if(o)o.onclick=()=>{ abwOpen=true; render(); };
    const s=$('#urS'); if(s)s.onclick=async()=>{ if(busy)return; const v=$('#urV').value, b=$('#urB').value; if(!v||!b||b<v){ toast('Bitte einen gültigen Zeitraum wählen'); return; }
      busy=true; try{ const r=await rpc('portal_abwesend_set',{p_key:KEY,p_player:ME.id,p_von:v,p_bis:b,p_grund:$('#urG').value,p_notiz:$('#urN').value||null});
        abwOpen=false; busy=false; toast('✓ Eingetragen'+(r&&r.abgesagt?': für '+r.abgesagt+' Termin'+(r.abgesagt>1?'e':'')+' abgemeldet':'')); await abwLoad(); await load(); }catch(e){ busy=false; toast('⚠️ '+e.message); } };
    document.querySelectorAll('[data-urx]').forEach(b=>b.onclick=async()=>{ if(busy)return; busy=true;
      try{ await rpc('portal_abwesend_del',{p_key:KEY,p_player:ME.id,p_id:b.dataset.urx}); busy=false; toast('✓ Gelöscht'); await abwLoad(); await load(); }catch(e){ busy=false; toast('⚠️ '+e.message); } });
  }
  function polls(B){
    if(ABW===null){ ABW=[]; abwLoad().then(()=>{ if(view==='abst')render(); }); }
    const P=(S.polls||[]).filter(p=>p.datum>=S.heute).sort((a,b)=>(a.id===FOCUS?-1:b.id===FOCUS?1:0)||(a.datum<b.datum?-1:a.datum>b.datum?1:0));
    const wa=S.ich&&S.ich.whatsapp?`<div class="card wa"><b>WhatsApp-Erinnerungen</b><span>${S.ich.optout?'Aus: du bekommst keine Nachrichten.':'An: du bekommst den Link zum Training und ggf. eine Erinnerung.'}</span><button class="btn2" id="waT">${S.ich.optout?'Wieder einschalten':'Ausschalten'}</button></div>`:'';
    if(!P.length){ B.innerHTML=mdHtml()+'<div class="card empty"><h2>Gerade nichts offen</h2><p class="note">Sobald der Trainer eine Abstimmung anlegt, steht sie hier.</p></div>'+urHtml()+wa; waWire(); urWire(); return; }
    B.innerHTML=P.map(p=>{ const T=p.teilnehmer||[], V=new Map((p.votes||[]).map(v=>[v.p,v])), mine=V.get(ME.id), inL=T.some(t=>t.id===ME.id);
      const g={zu:[],vllt:[],ab:[],offen:[]}; T.forEach(t=>{ const v=V.get(t.id); (v?g[v.a]:g.offen).push(t.name); }); const n=T.length||1, pc=x=>Math.round(x/n*100);
      const closed=p.geschlossen;
      return `<div class="card" id="p-${esc(p.id)}">${mine?'<span class="done">✓ abgestimmt</span>':''}<span class="pill ${p.art==='spiel'?'spiel':''}">${esc(ART[p.art]||'Termin')}</span>
        <h2>${esc(p.titel)}</h2><div class="meta">${esc(wd(p.datum))}${p.zeit?' · '+esc(p.zeit)+' Uhr':''}${p.ort?' · '+esc(p.ort):''}</div>
        ${p.notiz?`<p class="note">${esc(p.notiz)}</p>`:''}${p.frist?`<p class="note">Bitte bis ${esc(new Date(p.frist).toLocaleString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}))} Uhr antworten.</p>`:''}
        ${closed?'<p class="note"><b>Abstimmung geschlossen.</b></p>':inL?`<div class="ans">${[['zu','👍','Bin dabei'],['ab','✋','Nicht dabei']].map(([a,i,t])=>`<button class="${a}${mine&&mine.a===a?' on':''}" data-poll="${esc(p.id)}" data-a="${a}"><span>${i}</span>${t}</button>`).join('')}</div>
          ${mine&&mine.a==='ab'&&!/vorab eingetragen/.test(mine.n||'')?`<div class="why">${Object.entries(REASONS).map(([k,t])=>`<button class="${mine.g===k?'on':''}" data-poll="${esc(p.id)}" data-g="${k}">${t}</button>`).join('')}</div><input class="txt" data-poll="${esc(p.id)}" data-n maxlength="200" placeholder="Kurzer Hinweis (optional)" value="${esc(mine.n||'')}">`:''}`:S.ich?'<p class="note">Du stehst bei diesem Termin nicht auf der Liste.</p>':`<p class="note">Du stehst bei diesem Termin noch nicht auf der Liste.</p><button class="btn2" data-self="${esc(p.id)}">Mich eintragen</button>`}
        ${mine&&mine.a==='ab'&&/vorab eingetragen/.test(mine.n||'')?'<span class="vorab">🌴 Automatisch abgemeldet, weil du Urlaub eingetragen hast</span>':''}
        ${inL&&!closed?'<p class="note">Du kannst deine Antwort bis zum Training jederzeit ändern.</p>':''}
        <div class="bar"><i class="ok" style="width:${pc(g.zu.length)}%"></i><i class="mid" style="width:${pc(g.vllt.length)}%"></i><i class="bad" style="width:${pc(g.ab.length)}%"></i></div>
        <div class="cnt"><span><b>${g.zu.length}</b> dabei</span>${g.vllt.length?`<span><b>${g.vllt.length}</b> vielleicht</span>`:''}<span><b>${g.ab.length}</b> nicht</span><span><b>${g.offen.length}</b> offen</span></div>
        <details><summary>Wer hat was gesagt?</summary>${[['zu','ok','Dabei'],['vllt','mid','Vielleicht'],['ab','bad','Nicht dabei'],['offen','','Noch keine Antwort']].map(([k,c,t])=>g[k].length?`<h3>${t}</h3><div class="who">${g[k].map(x=>`<span class="${c}">${esc(x)}</span>`).join('')}</div>`:'').join('')}</details></div>`; }).join('');
    B.insertAdjacentHTML('afterbegin',mdHtml()); B.insertAdjacentHTML('beforeend',urHtml()+wa); waWire(); urWire();
    B.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>vote(b.dataset.poll,b.dataset.a));
    B.querySelectorAll('[data-self]').forEach(b=>b.onclick=()=>{ const w=ME.name.trim().split(/\s+/); gast(b.dataset.self,w[0],w.slice(1).join(' ')); });
    B.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{ const p=S.polls.find(x=>x.id===b.dataset.poll), v=(p.votes||[]).find(x=>x.p===ME.id); vote(p.id,'ab',b.dataset.g,v&&v.n); });
    B.querySelectorAll('[data-n]').forEach(i=>{ let t=null; i.oninput=()=>{ clearTimeout(t); t=setTimeout(()=>{ const p=S.polls.find(x=>x.id===i.dataset.poll), v=(p.votes||[]).find(x=>x.p===ME.id); vote(p.id,'ab',v&&v.g,i.value,true); },900); }; });
    if(FOCUS){ const el=document.getElementById('p-'+FOCUS); if(el&&!window.__kabScrolled){ window.__kabScrolled=1; el.scrollIntoView({block:'start'}); } }
  }
  function waWire(){ const b=$('#waT'); if(!b)return; b.onclick=async()=>{ try{ const an=!!S.ich.optout; await rpc('portal_whatsapp',{p_key:KEY,p_an:an}); S.ich.optout=!an; toast(an?'✓ WhatsApp-Erinnerungen an':'✓ Keine WhatsApp-Nachrichten mehr'); render(); }catch(e){ toast('⚠️ '+e.message); } }; }
  async function vote(poll,a,g,n,quiet){
    if(busy)return; busy=true;
    try{ await rpc('portal_vote',{p_key:KEY,p_poll:poll,p_player:ME.id,p_antwort:a,p_grund:g||null,p_notiz:n||null});
      const p=S.polls.find(x=>x.id===poll); p.votes=(p.votes||[]).filter(v=>v.p!==ME.id).concat([{p:ME.id,a,g:a==='ab'?(g||null):null,n:n||null,at:new Date().toISOString()}]);
      if(!quiet){ toast(a==='zu'?'👍 Du bist dabei. Danke!':a==='ab'?(g?'✓ Gespeichert':'✓ Nicht dabei: tipp bitte kurz den Grund an'):'✓ Gespeichert'); render(); }
    }catch(e){ toast('⚠️ '+e.message); }
    busy=false;
  }
  function kasse(B){
    const K=S.kasse||{}, cfg=K.cfg||{}, L=K.buchungen||[];
    const bez=L.filter(b=>b.status==='bezahlt'), KT=K.konten||{bank:(+cfg.anfang||0)+bez.filter(b=>b.art!=='ausgabe').reduce((a,b)=>a+ +b.betrag,0)-bez.filter(b=>b.art==='ausgabe').reduce((a,b)=>a+ +b.betrag,0),paypal:0,bar:0};
    const stand=(+KT.bank||0)+(+KT.paypal||0)+(+KT.bar||0), KO=[['bank','🏦 Bankkonto'],['paypal','🅿️ PayPal'],['bar','💶 Bar']].filter(([k])=>k!=='bar'||+KT.bar), FIX={bank:'Überweisung',paypal:'PayPal',bar:'bar'};
    const face=i=>{ const [k,t]=KO[i%KO.length]; return `<span class="pill">${t} ⟲</span><div class="big">${eur(KT[k])}</div><small>Gesamt ${eur(stand)}${cfg.kassenwart?' · Kassenwart: '+esc(cfg.kassenwart):''}</small>`; };
    const offen=b=>b.status==='offen'||b.status==='gemeldet';
    const mine=L.filter(b=>b.p===ME.id), myOpen=mine.filter(b=>b.status==='offen'), myG=mine.filter(b=>b.status==='gemeldet'), sum=myOpen.reduce((a,b)=>a+ +b.betrag,0);
    const per=new Map(); L.filter(b=>b.p&&(b.art==='strafe'||b.art==='beitrag')).forEach(b=>{ const o=per.get(b.p)||{name:b.name||'?',off:0,bez:0}; if(offen(b))o.off+= +b.betrag; else if(b.status==='bezahlt')o.bez+= +b.betrag; per.set(b.p,o); });
    const P=[...per.values()].sort((a,b)=>b.off-a.off||b.bez-a.bez);
    const pay=cfg.paypal&&sum>0?`https://www.paypal.com/paypalme/${encodeURIComponent(cfg.paypal)}/${sum.toFixed(2)}EUR`:null;
    B.innerHTML=`<div class="flip" id="flip"><div class="flin"><div class="card hero fl-f">${face(0)}</div><div class="card hero fl-b"></div></div></div>
      ${C.kasse?`<a class="mklink" href="${esc(C.kasse.replace(/\/?$/,'/')+'#k='+encodeURIComponent(KEY))}"><span>🏆</span><b>Top-Supporter &amp; Kassen-Transparenz</b><i>→</i></a>`:''}
      <div class="card mine"><h2>Deine Strafen</h2>${mine.length?`<div class="grid2" style="margin-top:12px"><div class="stat"><span>Offen</span><b class="${sum?'mid':'ok'}">${eur(sum)}</b></div><div class="stat"><span>Bezahlt</span><b>${eur(mine.filter(b=>b.status==='bezahlt').reduce((a,b)=>a+ +b.betrag,0))}</b></div></div>
        ${pay?`<a class="pay" href="${esc(pay)}" target="_blank" rel="noopener">Mit PayPal bezahlen · ${eur(sum)}</a><p class="note">Bitte „Freunde &amp; Familie“ wählen, dann kostet es nichts.</p>`:''}
        ${sum&&cfg.iban?`<div class="iban"><span>Oder per Überweisung</span><b>${esc(cfg.iban.replace(/(.{4})/g,'$1 ').trim())}</b><small>${esc(cfg.kontoinhaber||'')} · Verwendungszweck: Mannschaftskasse ${esc(ME.name)}</small><button class="btn2" id="ibanCp">IBAN kopieren</button></div>`:''}
        ${sum?`<button class="btn2" id="paid">Ich habe bezahlt</button><div class="weg" id="weg" hidden><p class="note"><b>Wie hast du bezahlt?</b> Der Kassenwart schaut dann aufs richtige Konto.</p><div class="ans">${['paypal','bank','bar'].map(k=>`<button data-weg="${k}"><span>${{paypal:'🅿️',bank:'🏦',bar:'💶'}[k]}</span>${{paypal:'PayPal',bank:'Überweisung',bar:'Bar'}[k]}</button>`).join('')}</div></div>`:''}${myG.length?`<p class="note">⏳ ${myG.length} Posten als bezahlt gemeldet${myG[0].zahlweg?' ('+FIX[myG[0].zahlweg]+')':''} · zählt, sobald der Kassenwart den Eingang abhakt.</p>`:''}
        <h3>Deine Posten</h3>${mine.map(b=>`<div class="row"><b>${esc(b.titel)}</b><small>${esc(new Date(b.datum+'T12:00:00').toLocaleDateString('de-DE'))}</small><em>${eur(b.betrag)}</em><span class="st ${esc(b.status)}">${esc(b.status)}</span></div>`).join('')}`
        :'<p class="note">Weiße Weste, keine Strafen. 😇</p>'}${cfg.hinweis?`<p class="note">${esc(cfg.hinweis)}</p>`:''}</div>
      <div class="card"><h2>Alle Spieler</h2>${P.length?P.map(x=>`<div class="row"><b>${esc(x.name)}</b>${x.off?`<em class="mid">${eur(x.off)} offen</em>`:'<em class="ok">✓</em>'}<small>${eur(x.bez)} bezahlt</small></div>`).join(''):'<p class="note">Noch keine Einträge.</p>'}</div>
      ${(K.katalog||[]).length?`<div class="card"><h2>Strafenkatalog</h2>${K.katalog.map(k=>`<div class="row"><b>${esc(k.titel)}</b><em>${eur(k.betrag)}</em></div>`).join('')}</div>`:''}
      <div class="card"><h2>Letzte Buchungen</h2>${L.slice(0,40).map(b=>`<div class="row"><b>${b.art==='ausgabe'?'➖ ':b.art==='einzahlung'?'➕ ':''}${esc(b.p?b.name||'':b.titel)}</b><small>${b.p?esc(b.titel):''}</small><em class="${b.art==='ausgabe'?'bad':''}">${b.art==='ausgabe'?'−':''}${eur(b.betrag)}</em></div>`).join('')||'<p class="note">Noch keine Buchungen.</p>'}</div>`;
    const ic=$('#ibanCp'); if(ic)ic.onclick=async()=>{ try{ await navigator.clipboard.writeText(cfg.iban); toast('✓ IBAN kopiert'); }catch(e){ prompt('IBAN:',cfg.iban); } };
    const pd=$('#paid'); if(pd)pd.onclick=()=>{ pd.hidden=true; $('#weg').hidden=false; };
    document.querySelectorAll('[data-weg]').forEach(b=>b.onclick=async()=>{ if(busy)return; busy=true;
      try{ const n=await rpc('portal_bezahlt',{p_key:KEY,p_player:ME.id,p_weg:b.dataset.weg}); toast(`✓ ${n} Posten gemeldet (${FIX[b.dataset.weg]}): der Kassenwart hakt ab`); busy=false; await load(); }catch(e){ busy=false; toast('⚠️ '+e.message); } });
    let fi=0, fb=false; const fl=$('#flip'); if(fl&&KO.length>1)fl.onclick=()=>{ if(fb)return; fb=true; const inn=fl.querySelector('.flin'); fl.querySelector('.fl-b').innerHTML=face(fi+1); inn.classList.add('turn');
      setTimeout(()=>{ fi++; fl.querySelector('.fl-f').innerHTML=face(fi); inn.style.transition='none'; inn.classList.remove('turn'); void inn.offsetWidth; inn.style.transition=''; fb=false; },620); };
  }
  window.addEventListener('hashchange',()=>location.reload());
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&S)load(); });
  if(hp.get('b'))bestaetigen(hp.get('b')); else if(hp.get('m'))teamAbst(hp.get('m')); else load();

  /* A-Jugend: Spieler bestätigen sich selbst (…/team.html#b=<code>) oder lassen sich löschen. Nur Name, keine Kontaktdaten. */
  function bestaetigen(tok){
    const h=document.querySelector('header h1'), hs=document.querySelector('header p'), ft=document.querySelector('footer');
    if(h)h.textContent='SV/BSC Mörlenbach'; if(hs)hs.textContent='Bist du das?'; if(ft)ft.textContent='Nur Vor- und Nachname · keine Nummern, keine Fotos, keine Werbung';
    let I=null, fertig=null;
    async function laden(){
      if(!/^[A-Za-z0-9]{24,40}$/.test(tok)){ app.innerHTML='<div class="card err empty"><h2>Link ungültig</h2></div>'; return; }
      try{ I=await rpc('bestaetigung_info',{p_token:tok}); if(!I)throw new Error('Der Link ist abgelaufen oder ungültig. Bitte beim Trainer nachfragen.'); zeigen(); }
      catch(e){ app.innerHTML=`<div class="card err empty"><h2>Link nicht verfügbar</h2><p class="note">${esc(e.message)}</p></div>`; }
    }
    function zeigen(){
      if(fertig==='geloescht'){ app.innerHTML='<div class="card empty"><h2>Gelöscht</h2><p class="note">Dein Name ist aus der App entfernt. Danke für die Rückmeldung.</p></div>'; return; }
      const teams=(I.teams||[]).join(', ');
      app.innerHTML=`<div class="card hero"><span class="pill">${I.bestaetigt||fertig==='bestaetigt'?'✓ bestätigt':'unbestätigt'}</span><h2 style="margin:12px 0 4px">${esc(I.vorname)} ${esc(I.nachname)}</h2>
        <div class="meta">${teams?esc(teams)+' · ':''}SV/BSC Mörlenbach</div>
        <p class="note" style="line-height:1.55;margin-top:12px">Dein Trainer hat dich aus der Kaderliste bei fussball.de in die Vereins-App übernommen. Gespeichert ist nur dein Vor- und Nachname und in welcher Mannschaft du spielst. Keine Nummer, keine Mail, kein Foto.</p>
        ${I.bestaetigt||fertig==='bestaetigt'?'<p class="note"><b>Danke, du bist bestätigt.</b> Willst du doch nicht in der App stehen, kannst du dich hier jederzeit löschen lassen.</p>':''}
        <div class="ans">${I.bestaetigt||fertig==='bestaetigt'?'':`<button class="zu" data-b="ja"><span>👍</span>Ja, das bin ich</button>`}<button class="ab" data-b="loeschen"><span>🗑️</span>Bitte löschen</button></div>
        <div id="bq"></div></div>`;
      app.querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>{ if(b.dataset.b==='ja')return senden('ja');
        document.getElementById('bq').innerHTML=`<p class="note" style="margin-top:12px">Wirklich löschen? Dein Name, die Mannschaft und alles, was der Trainer zu dir eingetragen hat, werden entfernt.</p><div class="ans"><button class="ab" data-bj>Ja, löschen</button><button data-bn>Abbrechen</button></div>`;
        app.querySelector('[data-bj]').onclick=()=>senden('loeschen'); app.querySelector('[data-bn]').onclick=()=>{ document.getElementById('bq').innerHTML=''; }; });
    }
    async function senden(a){ if(busy)return; busy=true;
      try{ fertig=await rpc('bestaetigung_antwort',{p_token:tok,p_antwort:a}); busy=false; toast(fertig==='geloescht'?'✓ Gelöscht':'✓ Danke, bestätigt'); if(fertig==='bestaetigt')I.bestaetigt=true; zeigen(); }
      catch(e){ busy=false; toast('⚠️ '+e.message); }
    }
    laden();
  }

  /* Zweite und Jugend: Zu- und Absagen per Gruppenlink (…/team.html#m=<code>). Eltern tippen den Namen des Kindes. */
  function teamAbst(tok){
    const TG={krank:'Krank',verletzt:'Verletzt',urlaub:'Urlaub',schule:'Schule',privat:'Privat'};
    const TA={training:'Training',spiel:'Spiel',turnier:'Turnier',sonst:'Termin'};
    let T=null, offen=null, meine=[]; try{ meine=JSON.parse(ls.get('tp_kids')||'[]'); }catch(e){}
    const DS=`<details class="card" style="margin-top:14px"><summary style="cursor:pointer;font-weight:700">Datenschutz: was hier gespeichert wird</summary>
      <p class="note" style="line-height:1.55">Auf dieser Seite steht nur der Vorname und der erste Buchstabe des Nachnamens. Gespeichert wird nur, ob dein Kind kommt, und auf Wunsch ein kurzer Grund. Keine Telefonnummern, keine E-Mail-Adressen, keine Fotos, kein Konto, keine Werbung.</p>
      <p class="note" style="line-height:1.55">Sehen können das nur die Trainer und Betreuer der Mannschaft und der Vorstand. Nichts wird weitergegeben. Welches Kind deins ist, merkt sich nur dieses Handy.</p>
      <p class="note" style="line-height:1.55">Antworten werden nach 180 Tagen automatisch gelöscht. Sofort löschen lassen oder nicht mitmachen: kurz dem Trainer Bescheid sagen.</p></details>`;
    const h=document.querySelector('header h1'), hs=document.querySelector('header p'), ft=document.querySelector('footer');
    if(ft)ft.textContent='Nur für die Mannschaft · keine Anmeldung, keine Nummern, keine Werbung';
    async function laden(){
      if(!/^[A-Za-z0-9]{20,40}$/.test(tok)){ app.innerHTML='<div class="card err empty"><h2>Link ungültig</h2></div>'; return; }
      try{ T=await rpc('tp_state',{p_token:tok}); zeigen(); }
      catch(e){ app.innerHTML=`<div class="card err empty"><h2>Link nicht verfügbar</h2><p class="note">${esc(e.message)}</p><p class="note">Bitte beim Trainer den aktuellen Link erfragen.</p></div>`; }
    }
    function zeigen(){
      if(h)h.textContent=T.team.kurz; if(hs)hs.textContent=T.team.name+' · Zu- und Absagen';
      document.title=T.team.name+' · SV/BSC Mörlenbach';
      const K=T.kinder||[], A=T.antworten||[], mk=new Set(meine.filter(id=>K.some(k=>k.id===id)));
      if(!T.termine.length){ app.innerHTML='<div class="card empty"><h2>Gerade nichts offen</h2><p class="note">In den nächsten zwei Wochen steht kein Termin an.</p></div>'+DS; return; }
      app.innerHTML=`<p class="note" style="margin:0 0 12px">Tippe auf den Namen deines Kindes und sag zu oder ab. Das Handy merkt sich dein Kind.</p>`+T.termine.map(t=>{
        const R=A.filter(a=>a.termin===t.id), ja=R.filter(a=>a.antwort==='ja').length, nein=R.filter(a=>a.antwort==='nein').length, vl=R.filter(a=>a.antwort==='vielleicht').length;
        const an=id=>(R.find(a=>a.spieler===id)||{}).antwort||'';
        const kids=[...K].sort((a,b)=>(mk.has(b.id)-mk.has(a.id))||a.name.localeCompare(b.name,'de'));
        return `<div class="card"><span class="pill${t.art==='spiel'||t.art==='turnier'?' spiel':''}">${esc(TA[t.art]||'Termin')}</span>
          <h2>${esc(wd(t.datum))}${t.zeit?' · '+esc(t.zeit):''}</h2><div class="meta">${[t.gegner?(t.heim===false?'bei ':'gegen ')+t.gegner:'',t.titel,t.ort].filter(Boolean).map(esc).join(' · ')}</div>
          <div class="cnt"><span><b>${ja}</b> dabei</span><span><b>${nein}</b> nicht dabei</span>${vl?`<span><b>${vl}</b> vielleicht</span>`:''}<span><b>${K.length-R.length}</b> offen</span></div>
          <div class="who">${kids.map(k=>{ const a=an(k.id); return `<button data-t="${esc(t.id)}" data-k="${esc(k.id)}" style="padding:8px 11px;border-radius:999px;font-size:13.5px;font-weight:${mk.has(k.id)?800:600};border:1px solid ${mk.has(k.id)?'rgba(91,155,255,.6)':'var(--line)'}" class="${a==='ja'?'ok':a==='nein'?'bad':a?'mid':''}">${a==='ja'?'✓ ':a==='nein'?'✗ ':a?'? ':''}${esc(k.name)}</button>`; }).join('')}</div>
          ${offen&&offen.t===t.id?frage(t,K.find(k=>k.id===offen.k),R.find(a=>a.spieler===offen.k)):''}</div>`; }).join('')+DS;
      document.querySelectorAll('[data-t][data-k]').forEach(b=>b.onclick=()=>{ offen={t:b.dataset.t,k:b.dataset.k,a:null,g:null}; zeigen(); const q=document.getElementById('tpq'); if(q)q.scrollIntoView({behavior:'smooth',block:'nearest'}); });
      const q=document.getElementById('tpq'); if(!q)return;
      q.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{ offen.a=b.dataset.a; if(offen.a!=='nein'){ senden(); } else zeigen(); });
      q.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{ offen.g=b.dataset.g; senden(); });
      const x=q.querySelector('[data-x]'); if(x)x.onclick=()=>{ offen=null; zeigen(); };
    }
    function frage(t,k,alt){ if(!k)return '';
      return `<div id="tpq" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line)"><b style="font-size:16px">Kommt ${esc(k.name.split(' ')[0])}?</b>${alt?`<div class="note" style="margin-top:4px">Bisher: ${alt.antwort==='ja'?'dabei':alt.antwort==='nein'?'nicht dabei':'vielleicht'}</div>`:''}
        <div class="ans"><button class="zu${offen.a==='ja'?' on':''}" data-a="ja"><span>👍</span>Ja, dabei</button><button class="ab${offen.a==='nein'?' on':''}" data-a="nein"><span>👎</span>Nein</button></div>
        <div class="ans" style="grid-template-columns:1fr 1fr;margin-top:8px"><button class="vllt${offen.a==='vielleicht'?' on':''}" data-a="vielleicht" style="padding:10px">Weiß noch nicht</button><button data-x style="padding:10px">Abbrechen</button></div>
        ${offen.a==='nein'?`<div class="note">Warum? (hilft dem Trainer)</div><div class="why">${Object.entries(TG).map(([g,l])=>`<button data-g="${g}">${l}</button>`).join('')}<button data-g="ohne">Ohne Angabe</button></div>`:''}</div>`; }
    async function senden(){ if(busy)return; busy=true;
      try{ await rpc('tp_vote',{p_token:tok,p_termin:offen.t,p_spieler:offen.k,p_antwort:offen.a,p_grund:offen.a==='nein'?(offen.g||'ohne'):null});
        if(!meine.includes(offen.k)){ meine.push(offen.k); ls.set('tp_kids',JSON.stringify(meine.slice(-4))); }
        toast(offen.a==='ja'?'✓ Zugesagt, danke!':offen.a==='nein'?'✓ Abgesagt, danke für die Info':'✓ Gespeichert'); offen=null; busy=false; await laden(); }
      catch(e){ busy=false; toast('⚠️ '+e.message); }
    }
    laden();
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&T&&!offen)laden(); });
  }
})();
