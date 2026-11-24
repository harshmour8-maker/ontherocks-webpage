const LOGO='/img/logo.png',WA='916003368214',
  CATALOG='https://wa.me/c/916003368214';
/* ===================== SETTINGS – edit these ===================== */
const CFG={
  API:'', // leave '' when the site and /api are on the same Vercel project. Otherwise e.g. 'https://ontherocks-api.vercel.app'
  // Paste the exact product page link from each app. While a link is empty, the logo opens a search for "On The Rocks ice cubes" in that app.
  STORES:{
    blinkit:'https://blinkit.com/prn/x/prid/603558',
    bigbasket:'https://www.bigbasket.com/pd/40346833/on-the-rocks-premium-ice-cubes-1-kg/',
    flipkart:'https://www.flipkart.com/rocks-premium-ice-cubes-regular/p/itm5a0b9d0d23024?pid=ICCHB8YR6DEQNSJA&lid=LSTICCHB8YR6DEQNSJAJCYYGW&marketplace=HYPERLOCAL'
  }
};
/* ================================================================= */
const STORE_SEARCH={
  blinkit:'https://blinkit.com/s/?q=on%20the%20rocks%20ice%20cubes',
  bigbasket:'https://www.bigbasket.com/ps/?q=on%20the%20rocks%20ice%20cubes',
  flipkart:'https://www.flipkart.com/search?q=on%20the%20rocks%20ice%20cubes'
};
document.querySelectorAll('a[data-store]').forEach(a=>a.href=CFG.STORES[a.dataset.store]||STORE_SEARCH[a.dataset.store]);
const P=[
 {id:'cube',n:'The Cube',s:'5 × 5 × 5 cm',p:25,i:'/img/cube.webp'},
 {id:'globe',n:'The Globe',s:'55 mm Sphere',p:40,i:'/img/globe.webp'},
 {id:'pillar',n:'The Pillar',s:'4 × 4 × 12 cm',p:30,i:'/img/pillar.webp'},
 {id:'diamond',n:'The Diamond',s:'Diamond-Cut Ice',p:50,i:'/img/diamond.webp'},
 {id:'stamp',n:'Branded Ice',s:'Your Logo In The Ice',p:50,i:'/img/stamp.webp'},
 {id:'infused',n:'Infused Ice',s:'Flowers, Fruit, Herbs',p:0,i:'/img/infused.webp'},
 {id:'punch',n:'Punch Block',s:'Any Size You Like',p:0,i:'/img/punch.webp'}
];
const HERO={id:'otr1kg',n:'On The Rocks 1 kg',s:'Premium Ice Cubes',p:80};
let DELIVERY={freeFrom:299,fee:99},AREA={name:'Guwahati',lat:26.1445,lng:91.7362,km:20};
/* free from ₹299; below that a flat ₹99 */
const fee=sub=>sub>0&&sub<DELIVERY.freeFrom?DELIVERY.fee:0;
const packsForFree=()=>Math.ceil(DELIVERY.freeFrom/HERO.p);
let cart={};try{cart=JSON.parse(localStorage.getItem('otrcart')||'{}')}catch(e){}
/* $ returns a harmless stand-in when a page doesn't have that element, so one script serves every page */
const $=s=>document.querySelector(s)||document.createElement('div'),R=n=>'₹'+n.toLocaleString('en-IN');
const find=id=>id===HERO.id?HERO:P.find(x=>x.id===id);
document.querySelectorAll('img.logo').forEach(i=>{if(!i.getAttribute('src'))i.src=LOGO});
$('#grid').innerHTML=P.map(x=>`<div class="card"><div class="im"><img loading="lazy" alt="${x.n}" src="${x.i}"></div><div class="b"><h3>${x.n}</h3><div class="sz">${x.s}</div><div class="foot">${x.p?`<div class="price">${R(x.p)}</div><div class="ctl" data-ctl="${x.id}"><button class="btn" data-add="${x.id}">Add</button></div>`:`<div class="price" style="font-size:16px">On Request</div><button class="btn" data-quote="${x.n}">Get quote</button>`}</div></div></div>`).join('');
const wa=t=>`https://wa.me/${WA}?text=${encodeURIComponent(t)}`;
$('#bulkWa').href=wa('Hi On The Rocks, I would like a bulk quote.');$('#bulkWa').target='_blank';
$('#waL').href=wa('Hi On The Rocks!');
function save(){try{localStorage.setItem('otrcart',JSON.stringify(cart))}catch(e){}}
function render(){
  const ids=Object.keys(cart).filter(k=>cart[k]>0&&find(k));let t=0,c=0;
  $('#items').innerHTML=ids.length?ids.map(k=>{const x=find(k),q=cart[k];t+=x.p*q;c+=q;return `<div class="it"><div><b>${x.n}</b><small>${R(x.p)} each</small>${q>maxQty(k)?`<small class="warn">${maxQty(k)>0?'Only '+maxQty(k)+' left':'Sold out – please remove'}</small>`:''}</div><div class="qty"><button data-c="${k}" data-d="-1" aria-label="Less">−</button><span>${q}</span><button data-c="${k}" data-d="1" aria-label="More">+</button></div></div>`}).join(''):'<p class="empty">Your cart is empty.</p>';
  const dl=fee(t),gt=t+dl;$('#sub').textContent=R(t);$('#dlv').innerHTML=!ids.length?R(0):dl?R(dl):'<span class="free">FREE</span>';$('#tot').textContent=R(gt);const fh=$('#freeHint');fh.hidden=!ids.length;fh.classList.toggle('got',!dl);if(dl){fh.innerHTML=`<span>Add ${R(DELIVERY.freeFrom-t)} more for free delivery</span><button type="button" id="addFree" data-n="1">Add 1 Pack</button>`}else fh.textContent='🎉 You get free delivery';$('#cc').textContent=c;syncBar(c,gt);const over=ids.some(k=>cart[k]>maxQty(k));$('#place').disabled=$('#pay').disabled=!ids.length||over;$('#pay').textContent=ids.length?'Pay '+R(gt)+' securely':'Pay online';save();syncCards();
}
function add(id,q,from){const mx=maxQty(id);if(mx<=0){toast('Sorry, sold out');return}const want=(cart[id]||0)+q;if(want>mx)toast('Only '+mx+' left');cart[id]=Math.min(want,mx);render();if(from)fly(from);const cb=$('#cartBtn');cb.classList.remove('pop');void cb.offsetWidth;cb.classList.add('pop');}
const open=o=>{document.body.classList.toggle('open',o);if(o)drawSlots();if(o&&lineItems().length&&!PIN&&$('#locPanel').hidden)setTimeout(openMap,350)};
let hq=1;
document.addEventListener('click',e=>{
  const b=e.target.closest('button,a');if(!b)return;
  if(b.dataset.q){hq=Math.max(1,Math.min(hq+ +b.dataset.q,Math.max(1,maxQty(HERO.id))));$('#hq').textContent=hq}
  if(b.id==='qbAdd'){add(HERO.id,1,$('.qbuy img'));toast('1 kg pack added');return}
  if(b.id==='addFree'){add(HERO.id,+b.dataset.n);return}
  if(b.id==='addHero'){add(HERO.id,hq,$('.hp .pic img'));hq=1;$('#hq').textContent=1;open(true)}
  if(b.dataset.add){add(b.dataset.add,1,(b.closest('.card,.cut')||document).querySelector('.im img,.cpic img'));toast('Added '+find(b.dataset.add).n);const s=document.querySelector(`.ctl[data-ctl="${b.dataset.add}"] button[data-d="1"]`);if(s)s.focus({preventScroll:true})}
  if(b.dataset.c){const k=b.dataset.c,n=Math.max(0,cart[k]+ +b.dataset.d);if(n>maxQty(k))toast('Only '+maxQty(k)+' left');cart[k]=Math.min(n,maxQty(k));render()}
  if(b.id==='cartBtn')open(true);
  if(b.id==='cx')open(false);
  if(b.dataset.quote&&!document.getElementById('enq')){try{sessionStorage.setItem('otrQuote',b.dataset.quote)}catch(_){}location.href='/#quote';return}
  if(b.dataset.quote){const f=$('#enq');setProduct(b.dataset.quote);$('#quote').scrollIntoView({behavior:'smooth'});setTimeout(()=>f.elements.name.focus({preventScroll:true}),500)}
});
$('#shade').onclick=()=>open(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape')open(false)});
const err=m=>{$('#err').textContent=m};
document.addEventListener('input',e=>{if(e.target.closest&&e.target.closest('#co'))err('')});
const lineItems=()=>Object.keys(cart).filter(k=>cart[k]>0&&find(k)).map(k=>({id:k,qty:cart[k]}));
function customer(){
  const c={name:$('#nm').value.trim(),phone:$('#ph').value.trim(),email:$('#em').value.trim(),address:$('#ad').value.trim(),pincode:$('#pc').value.replace(/\D/g,'')};
  if(!slotOk())return null;
  if(!PIN){err('Select your delivery address on the map (step 2).');showMapNow();return null}
  if(!c.address){err('Add your flat or house number and a landmark (step 2).');$('#ad').focus();return null}
  if(!/^\d{6}$/.test(c.pincode)){err('Add your 6-digit PIN code (step 2).');$('#pc').focus();return null}
  if(!c.pincode.startsWith('781')){err(`Sorry, we deliver only within ${AREA.name}. Please use an address in ${AREA.name} (PIN codes starting 781).`);$('#pc').focus();return null}
  if(!c.name||!/^[+\d\s-]{10,15}$/.test(c.phone)){err('Add your name and a valid phone number (step 3).');$(c.name?'#ph':'#nm').focus();return null}
  if(c.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)){err("That email address doesn't look right.");return null}
  c.lat=PIN.lat;c.lng=PIN.lng;c.mapAddress=PIN.address;c.city=PIN.city||'-';
  err('');return c;
}
async function api(path,body){
  const r=await fetch(CFG.API+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error||'Something went wrong. Please try again.');
  return j;
}
const busy=on=>['#pay'].forEach(s=>$(s).classList.toggle('busy',on));
function done(v){if(v.orderUrl){cart={};save();location.href=v.orderUrl;return}const ref=v.invoiceNo||v.ref;
  cart={};render();
  $('#items').innerHTML=`<div class="done"><h3>Order placed!</h3><p>Payment received. Your invoice number is <b>${ref}</b>.</p>${v.invoiceUrl?`<a class="btn o" href="${v.invoiceUrl.replace(/^https?:\/\/[^/]+/,'')}" target="_blank" rel="noopener" style="text-align:center">View / download tax invoice</a>`:''}<p>We'll confirm your delivery time on WhatsApp shortly${$('#em').value.trim()?' and we have emailed you a receipt':''}.</p></div>`;
}
/* Pay online with Razorpay */
$('#pay').onclick=async()=>{
  const c=customer();if(!c)return;
  if(!c.email){err('Add your email so we can send your receipt (step 3).');$('#em').focus();return}
  if(!window.Razorpay){err('Payment is still loading. Check your connection and try again.');return}
  busy(true);
  try{
    const o=await api('create-order',{items:lineItems(),customer:c,slot:{date:SLOT.date,hour:SLOT.hour}});
    const rzp=new Razorpay({
      key:o.keyId,order_id:o.orderId,amount:o.amount,currency:'INR',
      name:'On The Rocks',description:'Order '+o.ref,
      prefill:{name:c.name,email:c.email,contact:c.phone},
      theme:{color:'#000000'},
      handler:async r=>{
        busy(true);
        try{const v=await api('verify-payment',r);done(v)}
        catch(e){err('Your payment went through but we could not confirm it automatically. Please WhatsApp us this payment ID: '+r.razorpay_payment_id)}
        finally{busy(false)}
      },
      modal:{ondismiss:()=>busy(false)}
    });
    rzp.on('payment.failed',e=>err('Payment failed: '+((e.error&&e.error.description)||'please try again.')));
    rzp.open();
  }catch(e){err(e.message);busy(false);if(/slot|delivery time/i.test(e.message)){SLOT=null;drawSlots()}}
};
/* Bulk enquiry form */
const enq=$('#enq'),enqMsg=(m,bad)=>{$('#enqMsg').textContent=m;$('#enqMsg').classList.toggle('bad',!!bad)};
enq.onsubmit=async e=>{
  e.preventDefault();
  const d=Object.fromEntries(new FormData(enq));
  if(!d.name.trim()||!/^[+\d\s-]{10,15}$/.test(d.phone.trim())||!d.city.trim()||!d.quantity.trim()){enqMsg('Add your name, a valid phone number, city and quantity.',1);return}
  if(d.email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())){enqMsg("That email address doesn't look right.",1);return}
  $('#enqBtn').classList.add('busy');enqMsg('Sending…');
  try{await api('enquiry',d);enq.reset();enqMsg("Thanks! We've got your enquiry and will get back to you with a quote shortly.")}
  catch(x){enqMsg(x.message+' Please WhatsApp us instead.',1)}
  finally{$('#enqBtn').classList.remove('busy')}
};
/* ---------- animation + mobile helpers ---------- */
function phone(){return matchMedia('(max-width:700px)').matches}
function syncBar(c,t){const m=$('#mbc');if(!m)return;m.textContent=c+(c===1?' Item':' Items');$('#mbt').textContent=R(t);document.body.classList.toggle('hasbar',c>0)}
let toastT;function toast(m){const el=$('#toast');el.textContent=m;el.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('on'),1600)}
$('#mbarBtn').onclick=()=>open(true);
const navEl=document.querySelector('nav');
const onScroll=()=>navEl.classList.toggle('scrolled',scrollY>20);addEventListener('scroll',onScroll,{passive:true});onScroll();
(function(){
  if(!('IntersectionObserver' in window))return;
  document.documentElement.classList.add('js');
  const groups=[['.claims div',.08],['.why .pts li',.08],['.pillars article',.08],['.artteaser figure',.08],['.cut',.06],['#store .head p',0],['.hp',0],['#artisanal .head p',0],['.artpanel .ahead',0],['.catprev',0],['#grid .card .b',0],['#artisanal .note',0],['.cities',0],['#quote',0],['.quotebox',0],['footer .cols > div',.1]];
  const els=[];
  groups.forEach(([sel,step])=>document.querySelectorAll(sel).forEach((el,i)=>{el.classList.add('rv');el.style.setProperty('--d',Math.min(i*step,.6)+'s');els.push(el)}));
  document.querySelectorAll('.pour img').forEach(el=>{el.classList.add('rv-img');els.push(el)});
  document.querySelectorAll('#grid .card').forEach((c,i)=>{const d=((i%(phone()?2:4))*.08)+'s';c.querySelectorAll('.im,.b').forEach(el=>{el.style.setProperty('--d',d);el.classList.add(el.classList.contains('im')?'rv-fade':'rv');els.push(el)})});
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{rootMargin:'0px 0px -8% 0px',threshold:.08});
  els.forEach(el=>io.observe(el));
})();

/* ---------- enquiry product dropdown ---------- */
(function(){
  const sel=$('#enq select[name=product]');
  const names=[HERO.n+' Pack'].concat(P.map(x=>x.n)).concat(['Mixed / Several Products','Something Else (Tell Us Below)']);
  sel.insertAdjacentHTML('beforeend',names.map(n=>`<option>${n}</option>`).join(''));
})();
function setProduct(n){const sel=$('#enq select[name=product]');const o=[...sel.options].find(o=>o.text===n||o.text===n+' pack');sel.value=o?o.text:'';
  if(!o&&n){const other=[...sel.options].find(o=>/^Something Else/.test(o.text));if(other)sel.value=other.text;const m=$('#enq textarea[name=message]');if(!m.value)m.value='Interested in: '+n}}
/* a "Get quote" tap on the Shop or Artisanal page lands here with the product chosen */
(function(){let q='';try{q=sessionStorage.getItem('otrQuote')||'';sessionStorage.removeItem('otrQuote')}catch(_){}if(q&&document.getElementById('enq')){setProduct(q);setTimeout(()=>{const f=$('#enq');document.getElementById('quote').scrollIntoView();f.elements.name.focus({preventScroll:true})},400)}})();

/* ---------- stock (from your Google Sheet, via /api/stock) ---------- */
let STOCK=null;
function maxQty(id){const s=STOCK&&STOCK[id];if(!s)return 1000;if(!s.available)return 0;return s.stock===null?1000:s.stock}
function applyStock(){
  document.querySelectorAll('#grid .ctl[data-ctl]').forEach(el=>{
    const id=el.dataset.ctl,m=maxQty(id),card=el.closest('.card');
    card.classList.toggle('soldout',m<=0);
    let so=card.querySelector('.so');if(m<=0&&!so)card.querySelector('.im').insertAdjacentHTML('beforeend','<span class="so">Sold out</span>');if(m>0&&so)so.remove();
    let l=card.querySelector('.b .left');if(!l){card.querySelector('.sz').insertAdjacentHTML('afterend','<p class="left"></p>');l=card.querySelector('.b .left')}
    l.textContent=m>0&&m<=10?'Only '+m+' left':'';
  });
  const hm=maxQty(HERO.id),hb=$('#addHero');
  hb.classList.toggle('sold',hm<=0);hb.textContent=hm<=0?'Sold out':'Add to cart';
  $('#heroLeft').textContent=hm>0&&hm<=10?'Only '+hm+' left':'';
  if(hq>Math.max(1,hm)){hq=Math.max(1,hm);$('#hq').textContent=hq}
  render();
}
fetch(CFG.API+'/api/stock').then(r=>r.ok?r.json():null).then(j=>{if(j&&j.items){STOCK=j.items;applyStock()}}).catch(()=>{});

/* ---------- delivery location map (OpenStreetMap tiles, no key needed) ---------- */
let PIN=null;
const MAP=(function(){
  const el=$('#map'),tl=$('#tiles'),T=256;
  let z=12,cx=0,cy=0,imgs={},ptrs=new Map(),pinch=null,moved=false;
  const W=()=>T*Math.pow(2,z);
  const lx=(lng)=>(lng+180)/360*W();
  const ly=(lat)=>{const r=lat*Math.PI/180;return(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*W()};
  const center=()=>({lat:+(180/Math.PI*Math.atan(Math.sinh(Math.PI-2*Math.PI*cy/W()))).toFixed(6),lng:+(cx/W()*360-180).toFixed(6)});
  function set(lat,lng,zz){if(zz)z=zz;cx=lx(lng);cy=ly(lat);draw()}
  function draw(){
    const w=el.clientWidth,h=el.clientHeight;if(!w)return;
    const n=Math.pow(2,z);cy=Math.max(h/2,Math.min(W()-h/2,cy));
    const x0=Math.floor((cx-w/2)/T),x1=Math.floor((cx+w/2)/T),y0=Math.max(0,Math.floor((cy-h/2)/T)),y1=Math.min(n-1,Math.floor((cy+h/2)/T));
    const keep={};
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
      const k=z+'/'+x+'/'+y,wx=((x%n)+n)%n;let im=imgs[k];
      if(!im){im=new Image();im.alt='';im.draggable=false;im.src=`https://tile.openstreetmap.org/${z}/${wx}/${y}.png`;tl.appendChild(im);imgs[k]=im}
      im.style.transform=`translate(${Math.round(x*T-cx+w/2)}px,${Math.round(y*T-cy+h/2)}px)`;keep[k]=1;
    }
    for(const k in imgs)if(!keep[k]){imgs[k].remove();delete imgs[k]}
  }
  function zoom(d,px,py){
    const nz=Math.max(4,Math.min(19,z+d));if(nz===z)return;
    const w=el.clientWidth,h=el.clientHeight;px=px===undefined?w/2:px;py=py===undefined?h/2:py;
    const f=Math.pow(2,nz-z),ax=cx-w/2+px,ay=cy-h/2+py; // keep the point under the finger/cursor still
    cx=ax*f-(px-w/2);cy=ay*f-(py-h/2);z=nz;moved=true;draw();
  }
  el.addEventListener('pointerdown',e=>{if(e.target.closest('button,a'))return;el.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});el.parentElement.classList.add('drag');if(ptrs.size===2){const[a,b]=[...ptrs.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y)}});
  el.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;
    if(ptrs.size===1){cx-=e.clientX-p.x;cy-=e.clientY-p.y;moved=true;draw()}
    p.x=e.clientX;p.y=e.clientY;
    if(ptrs.size===2&&pinch){const[a,b]=[...ptrs.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(d/pinch>1.35){zoom(1);pinch=d}else if(d/pinch<.74){zoom(-1);pinch=d}}});
  const up=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;if(!ptrs.size)el.parentElement.classList.remove('drag')};
  el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
  let wl=0;el.addEventListener('wheel',e=>{e.preventDefault();const now=Date.now();if(now-wl<250)return;wl=now;const r=el.getBoundingClientRect();zoom(e.deltaY<0?1:-1,e.clientX-r.left,e.clientY-r.top)},{passive:false});
  el.addEventListener('dblclick',e=>{const r=el.getBoundingClientRect();zoom(1,e.clientX-r.left,e.clientY-r.top)});
  el.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>zoom(+b.dataset.zoom));
  addEventListener('resize',draw);
  return{set,draw,center,touched:()=>moved};
})();
const DEFAULT_CENTER={lat:26.1445,lng:91.7362}; // Guwahati
/* Google Maps key comes from Vercel (GOOGLE_MAPS_KEY) via /api/config. No key → free backup map. */
const CONFIG=fetch(CFG.API+'/api/config').then(r=>r.ok?r.json():{}).catch(()=>({}));
CONFIG.then(c=>{if(c.delivery)DELIVERY=c.delivery;if(c.area){AREA=c.area;$('#areaNote').textContent=`We currently deliver within ${AREA.name}.`}render()});
const kmTo=(a,b)=>{const r=x=>x*Math.PI/180,h=Math.sin(r(b.lat-a.lat)/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(r(b.lng-a.lng)/2)**2;return 12742*Math.asin(Math.sqrt(h))};
const inArea=p=>kmTo(AREA,p)<=AREA.km;
const LOC={engine:null};let GM=null;
const hint=(t,bad)=>{const e=$('#locHint');e.textContent=t;e.classList.toggle('hintbad',!!bad)};
function placeName(p){return fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${p.lat}&lon=${p.lng}`,{headers:{'Accept-Language':'en'}}).then(r=>r.ok?r.json():null).catch(()=>null)}
function cityFrom(comps){ // works for both Places (longText) and Geocoder (long_name) results
  const get=t=>{const c=(comps||[]).find(x=>(x.types||[]).includes(t));return c?(c.longText||c.long_name||''):''};
  const city=get('locality')||get('administrative_area_level_3')||get('administrative_area_level_2'),state=get('administrative_area_level_1');
  return [city,state].filter(Boolean).join(', ');
}
function loadGoogle(key){
  return new Promise((res,rej)=>{
    if(window.google&&google.maps&&google.maps.importLibrary)return res();
    window.otrGmReady=res;
    window.gm_authFailure=()=>{console.warn('Google Maps key was rejected – switching to the backup map.');useBackupMap()};
    const s=document.createElement('script');
    s.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&region=IN&language=en&callback=otrGmReady`;
    s.async=true;s.onerror=()=>rej(new Error('script failed to load'));document.head.appendChild(s);
    setTimeout(()=>rej(new Error('timed out')),12000);
  });
}
async function useGoogleMap(c,key){
  await loadGoogle(key);
  const [{Map},PLACES,{Geocoder}]=await Promise.all([google.maps.importLibrary('maps'),google.maps.importLibrary('places'),google.maps.importLibrary('geocoding')]);
  if(!GM){
    $('#map').hidden=true;$('#gmap').hidden=false;$('#gsearch').hidden=true;$('#osearch').hidden=false;
    const map=new Map($('#gmap'),{center:c,zoom:PIN?18:12,disableDefaultUI:true,zoomControl:true,gestureHandling:'greedy',clickableIcons:false});
    map.addListener('dragstart',()=>$('#mapwrap').classList.add('drag'));
    map.addListener('dragend',()=>$('#mapwrap').classList.remove('drag'));
    GM={map,geocoder:new Geocoder(),last:null,places:PLACES,token:null};
  }else{GM.map.setCenter(c);if(PIN)GM.map.setZoom(18)}
  LOC.engine='google';
  hint('Search your area above, or tap "Use my location". Then drag the map so the pin is on your gate.');
}
function useBackupMap(c){
  LOC.engine='osm';$('#gmap').hidden=true;$('#gsearch').hidden=true;$('#map').hidden=false;$('#osearch').hidden=false;
  c=c||PIN||{lat:AREA.lat,lng:AREA.lng};MAP.set(c.lat,c.lng,PIN?17:12);
  hint('Search your area above, or tap "Use my location". Then drag the map so the pin is on your gate.');
}
function mapCenter(){
  if(LOC.engine==='google'){const p=GM.map.getCenter();return{lat:+p.lat().toFixed(6),lng:+p.lng().toFixed(6)}}
  return MAP.center();
}
function moveMap(lat,lng){if(LOC.engine==='google'){GM.map.setCenter({lat,lng});GM.map.setZoom(18)}else MAP.set(lat,lng,17)}
async function describe(p){ // → {address, city} for the pinned spot
  if(LOC.engine==='google'){
    const L=GM.last;if(L&&Math.abs(L.lat-p.lat)<2e-4&&Math.abs(L.lng-p.lng)<2e-4)return L; // pin still on the searched place
    try{const {results}=await GM.geocoder.geocode({location:p});if(results&&results[0]){const pc=(results[0].address_components||[]).find(x=>(x.types||[]).includes('postal_code'));return{address:results[0].formatted_address,city:cityFrom(results[0].address_components),pin:pc?pc.long_name:''}}}catch(e){}
    return null;
  }
  if(OLAST&&Math.abs(OLAST.lat-p.lat)<2e-4&&Math.abs(OLAST.lng-p.lng)<2e-4)return OLAST;
  const g=await placeName(p);if(!g||!g.display_name)return null;
  const a=g.address||{};return{address:g.display_name,city:[a.city||a.town||a.village||a.county,a.state].filter(Boolean).join(', '),pin:a.postcode||''};
}
async function openMap(){
  $('#locOpen').hidden=true;$('#locOpen').classList.remove('need');$('#locPanel').hidden=false;$('#locDone').hidden=true;
  const c=PIN||{lat:AREA.lat,lng:AREA.lng},cfg=await CONFIG;
  if(cfg.googleMapsKey&&LOC.engine!=='osm'){try{await useGoogleMap(c,cfg.googleMapsKey);return}catch(e){console.warn('Google Maps unavailable, using the backup map:',e.message)}}
  useBackupMap(c);
}
/* free address search for the backup map (photon.komoot.io, OpenStreetMap data) */
let OLAST=null,oTimer,oCtl,oHits=[],oSel=-1;
function oParts(p){
  const street=p.street?(p.housenumber?p.housenumber+' ':'')+p.street:'';
  const parts=[p.name,street,p.district||p.locality,p.city||p.county,p.state,p.postcode].filter(Boolean);
  return parts.filter((x,i)=>parts.indexOf(x)===i);
}
const ex=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function oShow(html){const u=$('#ores');u.innerHTML=html;u.hidden=!html}
const AREAWORDS=/\b(guwahati|assam|india|kamrup|metro|781\d{3})\b/gi;
function box(){const dy=AREA.km/111,dx=AREA.km/(111*Math.cos(AREA.lat*Math.PI/180));return{north:AREA.lat+dy,south:AREA.lat-dy,east:AREA.lng+dx,west:AREA.lng-dx}}
async function gFind(q){ // Google Places suggestions (needs "Places API (New)" on the key)
  if(LOC.engine!=='google'||!GM||!GM.places||!GM.places.AutocompleteSuggestion)return[];
  try{
    if(!GM.token)GM.token=new GM.places.AutocompleteSessionToken();
    const {suggestions}=await GM.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({input:q,includedRegionCodes:['in'],locationRestriction:box(),sessionToken:GM.token});
    return (suggestions||[]).filter(s=>s.placePrediction).slice(0,6).map(s=>{const p=s.placePrediction;return{src:'g',pred:p,title:String(p.mainText||p.text),sub:String(p.secondaryText||'')}});
  }catch(e){console.warn('Google search unavailable:',e.message);return[]}
}
const kmFrom=(lat,lng)=>kmTo(AREA,{lat,lng});
function gHit(pl){ // Google Place → our result
  const loc=pl.location;if(!loc)return null;const lat=loc.lat(),lng=loc.lng();if(kmFrom(lat,lng)>AREA.km+2)return null;
  const comps=pl.addressComponents||[],pc=comps.find(x=>(x.types||[]).includes('postal_code'));
  const name=String(pl.displayName||'').trim(),addr=pl.formattedAddress||'';
  return{src:'gp',lat,lng,title:name||addr.split(',')[0],sub:addr,address:name&&!addr.startsWith(name)?name+', '+addr:addr,city:cityFrom(comps),pin:pc?(pc.longText||pc.long_name||''):''};
}
async function gText(q){ // Google text search – finds buildings the way the Google Maps app does
  if(LOC.engine!=='google'||!GM||!GM.places||!GM.places.Place||!GM.places.Place.searchByText)return[];
  try{
    const tq=/guwahati/i.test(q)?q:q+', Guwahati';
    const {places}=await GM.places.Place.searchByText({textQuery:tq,fields:['displayName','formattedAddress','location','addressComponents'],
      locationBias:{center:{lat:AREA.lat,lng:AREA.lng},radius:Math.min(50000,AREA.km*1000)},region:'in',maxResultCount:6});
    return (places||[]).map(gHit).filter(Boolean);
  }catch(e){console.warn('Google text search unavailable:',e.message);return[]}
}
async function gGeo(q){ // Google geocoder – street addresses and named buildings
  if(LOC.engine!=='google'||!GM||!GM.geocoder)return[];
  try{
    const b=box(),tq=/guwahati/i.test(q)?q:q+', Guwahati, Assam';
    const {results}=await GM.geocoder.geocode({address:tq,region:'in',bounds:{north:b.north,south:b.south,east:b.east,west:b.west},componentRestrictions:{country:'IN'}});
    return (results||[]).filter(r=>!(r.types||[]).some(t=>['locality','administrative_area_level_1','administrative_area_level_2','administrative_area_level_3','country'].includes(t))).map(r=>{
      const lat=r.geometry.location.lat(),lng=r.geometry.location.lng();if(kmFrom(lat,lng)>AREA.km+2)return null;
      const pc=(r.address_components||[]).find(x=>(x.types||[]).includes('postal_code'));
      return{src:'gp',lat,lng,title:r.formatted_address.split(',')[0],sub:r.formatted_address.split(',').slice(1).join(',').trim(),address:r.formatted_address,city:cityFrom(r.address_components),pin:pc?pc.long_name:''}}).filter(Boolean);
  }catch(e){return[]}
}
async function photon(q,signal){
  const b=box();
  const r=await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en&lat=${AREA.lat}&lon=${AREA.lng}&bbox=${b.west.toFixed(3)},${b.south.toFixed(3)},${b.east.toFixed(3)},${b.north.toFixed(3)}`,{signal});
  const j=await r.json();
  return (j.features||[]).filter(f=>f.geometry&&(!f.properties.countrycode||f.properties.countrycode==='IN')).map(f=>{const ps=oParts(f.properties),[lng,lat]=f.geometry.coordinates;
    return{src:'o',lat,lng,title:ps[0],sub:ps.slice(1).join(', '),address:ps.join(', '),city:[f.properties.city||f.properties.county,f.properties.state].filter(Boolean).join(', '),pin:f.properties.postcode||''}});
}
async function nomi(q,signal){
  const b=box();
  const r=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&countrycodes=in&bounded=1&viewbox=${b.west.toFixed(3)},${b.north.toFixed(3)},${b.east.toFixed(3)},${b.south.toFixed(3)}&q=${encodeURIComponent(q)}`,{signal,headers:{'Accept-Language':'en'}});
  const j=await r.json();
  return (j||[]).map(g=>{const a=g.address||{},parts=String(g.display_name||'').split(', ');
    return{src:'o',lat:+g.lat,lng:+g.lon,title:g.name||parts[0],sub:parts.slice(g.name?1:1).join(', '),address:g.display_name,city:[a.city||a.town||a.village||a.county,a.state].filter(Boolean).join(', '),pin:a.postcode||''}});
}
async function osmFind(q,signal){
  let hits=[];
  try{hits=await photon(q,signal)}catch(e){if(e.name==='AbortError')throw e}
  if(!hits.length){try{hits=await nomi(q,signal)}catch(e){if(e.name==='AbortError')throw e}}
  const seen=new Set();return hits.filter(h=>{const k=h.lat.toFixed(4)+','+h.lng.toFixed(4);if(seen.has(k))return false;seen.add(k);return true}).slice(0,6);
}
async function oSearch(q){
  if(oCtl)oCtl.abort();oCtl=new AbortController();const signal=oCtl.signal;
  try{
    let hits=await gFind(q),note='';
    if(!hits.length)hits=await gText(q);
    if(!hits.length)hits=await gGeo(q);
    if(!hits.length)hits=await osmFind(q,signal);
    if(signal.aborted)return;
    if(!hits.length){ // building not on the map: try the area name (drop words from the front: "shanti kunj kalipur" → "kalipur")
      const words=q.replace(AREAWORDS,' ').replace(/[,]/g,' ').split(/\s+/).filter(Boolean);
      for(let n=1;n<words.length&&!hits.length;n++){const sub=words.slice(n).join(' ');hits=await gFind(sub);if(!hits.length)hits=await osmFind(sub,signal);
        if(hits.length)note=`“${ex(words.slice(0,n).join(' '))}” isn't on the map yet. Pick the area, then drag the pin onto your building.`}
    }
    oHits=hits;oSel=-1;
    oShow((note?`<li class="msg">${note}</li>`:'')+(hits.length?hits.map((h,i)=>`<li role="option" data-i="${i}"><b>${ex(h.title)}</b><small>${ex(h.sub)}</small></li>`).join('')
      :'<li class="msg">No matches. Try your area or a nearby landmark, or tap “Use my location” and drag the pin.</li>'));
  }catch(e){if(e.name!=='AbortError')oShow('<li class="msg">Search isn’t available right now. Please drag the map or use your location.</li>')}
}
async function oPick(i){
  const h=oHits[i];if(!h)return;
  $('#oq').value=h.title;oShow('');$('#oq').blur();
  if(h.src==='g'){
    try{const place=h.pred.toPlace();await place.fetchFields({fields:['formattedAddress','location','addressComponents']});GM.token=null;
      if(!place.location)return;const lat=place.location.lat(),lng=place.location.lng();moveMap(lat,lng);
      const pc=(place.addressComponents||[]).find(x=>(x.types||[]).includes('postal_code'));
      GM.last={lat,lng,address:place.formattedAddress,city:cityFrom(place.addressComponents),pin:pc?(pc.longText||pc.long_name||''):''};
    }catch(e){hint('Could not open that place. Please drag the map to your building.',true);return}
  }else{
    moveMap(h.lat,h.lng);const c=mapCenter();
    const rec={lat:c.lat,lng:c.lng,address:h.address,city:h.city,pin:h.pin};
    if(LOC.engine==='google')GM.last=rec;else OLAST=rec;
  }
  hint('Now drag the map so the pin sits exactly on your gate or building, then confirm.');
}
$('#oq').addEventListener('input',()=>{clearTimeout(oTimer);const q=$('#oq').value.trim();if(q.length<3){oShow('');return}oTimer=setTimeout(()=>oSearch(q),350)});
$('#oq').addEventListener('keydown',e=>{
  const lis=[...$('#ores').querySelectorAll('li[data-i]')];
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!lis.length)return;oSel=(oSel+(e.key==='ArrowDown'?1:-1)+lis.length)%lis.length;lis.forEach((l,i)=>l.classList.toggle('on',i===oSel))}
  else if(e.key==='Enter'){e.preventDefault();if(lis.length)oPick(oSel>=0?oSel:0);else{const q=$('#oq').value.trim();if(q.length>=2){clearTimeout(oTimer);oSearch(q)}}}
  else if(e.key==='Escape'){e.stopPropagation();oShow('')}
});
$('#ores').addEventListener('click',e=>{const li=e.target.closest('li[data-i]');if(li)oPick(+li.dataset.i)});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#osearch'))oShow('')});

function showMapNow(){
  if($('#locPanel').hidden)openMap();
  $('#loc').classList.add('need');setTimeout(()=>$('#loc').classList.remove('need'),2400);
  setTimeout(()=>$('#stepAddr').scrollIntoView({block:'start',behavior:'smooth'}),60);
}
$('#locOpen').onclick=openMap;
$('#locEdit').onclick=openMap;
$('#locMe').onclick=()=>{
  if(!navigator.geolocation){hint('Your browser can’t share location. Please search or drag the map instead.');return}
  $('#locMe').textContent='Finding you…';
  navigator.geolocation.getCurrentPosition(p=>{moveMap(p.coords.latitude,p.coords.longitude);$('#locMe').textContent='◎ Use my location';hint('Found you! Drag the map to fine-tune, then confirm.')},
    ()=>{$('#locMe').textContent='◎ Use my location';hint('Couldn’t get your location (permission off?). Please search or drag the map instead.')},{enableHighAccuracy:true,timeout:12000});
};
$('#locOk').onclick=async()=>{
  const p=mapCenter();
  if(!PIN&&kmTo(AREA,p)<0.05){hint('Search your area or tap "Use my location" first, then drag the pin onto your building.',true);return}
  if(!inArea(p)){hint(`Sorry, we deliver only within ${AREA.name} right now. Please move the pin to an address in ${AREA.name}.`,true);return}
  $('#locOk').textContent='Saving…';
  const d=await describe(p);$('#locOk').textContent='Confirm this location';
  PIN={lat:p.lat,lng:p.lng,address:d&&d.address?d.address:`Pinned location (${p.lat}, ${p.lng})`,city:d&&d.city?d.city:''};
  $('#ct').value=PIN.city;$('#locTxt').textContent=PIN.address;
  {const z=(d&&d.pin)||((PIN.address.match(/\b78\d{4}\b/)||[])[0]);if(z&&!$('#pc').value)$('#pc').value=z}
  $('#locPanel').hidden=true;$('#locDone').hidden=false;err('');
  if(!$('#ad').value.trim())$('#ad').focus({preventScroll:true});
};

/* ---------- richer motion ---------- */
const calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
// headings rise out of a mask, line by line, as they scroll in
(function(){
  if(!('IntersectionObserver' in window))return;
  const hs=[...document.querySelectorAll('main h2, section h2, .pour h2')].filter(h=>!h.closest('#cart'));
  hs.forEach(h=>{h.innerHTML=h.innerHTML.split(/<br\s*\/?>/i).map(l=>`<span class="ln"><span>${l}</span></span>`).join('');h.classList.add('mask')});
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.3});
  hs.forEach(h=>io.observe(h));
})();
// gentle parallax on the big photos
(function(){
  if(calm)return;
  const items=[[$('#hero .pack'),-.12],[$('.pour img'),.1],[$('.hp .pic img'),-.05]].filter(x=>x[0]);let tick=false;
  function run(){tick=false;const vh=innerHeight;items.forEach(([el,k])=>{const r=el.getBoundingClientRect();if(r.bottom<0||r.top>vh)return;el.style.translate=`0 ${((r.top+r.height/2-vh/2)*k).toFixed(1)}px`})}
  addEventListener('scroll',()=>{if(!tick){tick=true;requestAnimationFrame(run)}},{passive:true});run();
})();
// 3D tilt on artisanal cards (mouse only)
(function(){
  if(calm||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
  document.querySelectorAll('#grid .card').forEach(c=>{
    c.addEventListener('mousemove',e=>{const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;c.style.transform=`perspective(900px) rotateY(${x*8}deg) rotateX(${-y*8}deg) translateY(-4px)`;c.style.zIndex=2});
    c.addEventListener('mouseleave',()=>{c.style.transform='';c.style.zIndex=''});
  });
})();
// product photo flies into the cart
function fly(img){
  if(calm||!img||!img.animate)return;
  const a=img.getBoundingClientRect(),t=$('#mbarBtn').getBoundingClientRect();
  if(!a.width)return;
  const f=img.cloneNode();f.className='flyer';f.removeAttribute('loading');const s=Math.min(a.width,a.height,160);
  Object.assign(f.style,{left:(a.left+a.width/2-s/2)+'px',top:(a.top+a.height/2-s/2)+'px',width:s+'px',height:s+'px'});
  document.body.appendChild(f);
  const dx=t.left+t.width/2-(a.left+a.width/2),dy=t.top+t.height/2-(a.top+a.height/2);
  f.animate([{transform:'translate(0,0) scale(1) rotate(0)',opacity:1},{transform:`translate(${dx*.5}px,${dy*.5-60}px) scale(.55) rotate(-8deg)`,opacity:1,offset:.6},{transform:`translate(${dx}px,${dy}px) scale(.12) rotate(-14deg)`,opacity:.3}],{duration:750,easing:'cubic-bezier(.5,0,.3,1)'}).onfinish=()=>f.remove();
}

/* ---------- artisanal: Add button or − n + stepper, always in step with the cart ---------- */
function syncCards(){if(typeof packCard==='function')packCard();
  document.querySelectorAll('.ctl[data-ctl]').forEach(el=>{
    const id=el.dataset.ctl,m=maxQty(id),q=cart[id]||0,key=m<=0?'sold':q>0?q+'/'+m:'add';
    if(el.dataset.k===key)return;el.dataset.k=key;
    const had=el.contains(document.activeElement)&&document.activeElement.dataset.d;
    el.innerHTML=m<=0?'<button class="btn sold" type="button" disabled>Sold out</button>'
      :q>0?`<div class="qty step" role="group" aria-label="${find(id).n} in cart"><button type="button" data-c="${id}" data-d="-1" aria-label="Remove one">−</button><span aria-live="polite">${q}</span><button type="button" data-c="${id}" data-d="1" aria-label="Add one"${q>=m?' disabled':''}>+</button></div>`
      :`<button class="btn" type="button" data-add="${id}">Add</button>`;
    if(had){const b=el.querySelector(`[data-d="${had}"]`)||el.querySelector('button');if(b)b.focus({preventScroll:true})}
  });
}

/* ---------- delivery slots: pick a day, then a 1-hour window (India time) ---------- */
let SLOTR={startHour:10,endHour:22,leadMinutes:60,days:7},SLOT=null,SLOTDAY=null;
const ISTMS=5.5*3600e3;
const ymdIST=ms=>new Date(ms+ISTMS).toISOString().slice(0,10);
const slotStartMs=(ymd,h)=>{const [y,m,d]=ymd.split('-').map(Number);return Date.UTC(y,m-1,d,h)-ISTMS};
const h12=h=>{const x=h%24;return x%12||12},ap=h=>(h%24)<12?'am':'pm';
const slotText=h=>ap(h)===ap(h+1)?`${h12(h)}–${h12(h+1)} ${ap(h)}`:`${h12(h)} ${ap(h)}–${h12(h+1)} ${ap(h+1)}`;
const dayFmt=(ms,o)=>new Date(ms).toLocaleDateString('en-IN',Object.assign({timeZone:'Asia/Kolkata'},o));
/* Days shown as a grid (no sideways scrolling). Only times at least SLOT_LEAD_MINUTES away are listed. */
function slotDays(){
  const now=Date.now(),soonest=now+SLOTR.leadMinutes*6e4,out=[];
  for(let i=0;out.length<SLOTR.days&&i<=SLOTR.days+1;i++){
    const ymd=ymdIST(now+i*864e5),hours=[];
    for(let h=SLOTR.startHour;h<SLOTR.endHour;h++)if(slotStartMs(ymd,h)>=soonest)hours.push(h);
    if(hours.length)out.push({ymd,hours,rel:i});
  }
  return out;
}
let SLOTGONE=false,SLOTOPEN=true,DAYKEY='',HOURKEY='';
const dayName=ymd=>dayFmt(slotStartMs(ymd,12),{weekday:'short',day:'numeric',month:'short'});
function drawSlots(){
  const days=slotDays(),dsel=$('#slotDaySel'),tsel=$('#slotTimeSel');
  if(!days.length){DAYKEY=HOURKEY='';dsel.innerHTML='';tsel.innerHTML='';dsel.disabled=tsel.disabled=true;$('#slotHint').textContent='No delivery slots are open right now. Please order on WhatsApp.';return}
  dsel.disabled=tsel.disabled=false;
  if(SLOT&&!days.some(d=>d.ymd===SLOT.date&&d.hours.includes(SLOT.hour))){SLOT=null;SLOTGONE=true}
  if(!days.some(d=>d.ymd===SLOTDAY))SLOTDAY=SLOT?SLOT.date:days[0].ymd;
  const dk=days.map(d=>d.ymd+d.rel).join();
  if(dk!==DAYKEY){DAYKEY=dk;dsel.innerHTML=days.map(d=>{const ms=slotStartMs(d.ymd,12);const top=d.rel===0?'Today':d.rel===1?'Tomorrow':dayFmt(ms,{weekday:'long'});
    return `<option value="${d.ymd}">${top}, ${dayFmt(ms,{day:'numeric',month:'short'})}</option>`}).join('')}
  dsel.value=SLOTDAY;
  const day=days.find(d=>d.ymd===SLOTDAY),hk=SLOTDAY+':'+day.hours.join();
  if(hk!==HOURKEY){HOURKEY=hk;tsel.innerHTML='<option value="">Select a time</option>'+day.hours.map(hh=>`<option value="${hh}">${slotText(hh)}</option>`).join('')}
  tsel.value=SLOT&&SLOT.date===SLOTDAY?String(SLOT.hour):'';
  $('#slotHint').textContent=SLOTGONE?'Your earlier time has passed. Please choose another.':SLOT?`We'll deliver on ${SLOT.label}.`:'Choose a 1-hour window. We deliver within it.';
  $('#slotHint').classList.toggle('hintbad',SLOTGONE);
  $('#stepSlot').classList.toggle('done',!!SLOT);
}
function slotOk(){
  drawSlots();
  if(SLOT)return true;
  err(SLOTGONE?'Your delivery time has passed. Please choose another slot (step 1).':'Choose a delivery day and time (step 1).');
  $('#stepSlot').classList.add('need');setTimeout(()=>$('#stepSlot').classList.remove('need'),2400);
  $('#stepSlot').scrollIntoView({block:'start',behavior:'smooth'});
  return false;
}
$('#slotDaySel').addEventListener('change',e=>{SLOTDAY=e.target.value;if(SLOT&&SLOT.date!==SLOTDAY)SLOT=null;SLOTGONE=false;drawSlots()});
$('#slotTimeSel').addEventListener('change',e=>{const v=e.target.value;if(v===''){SLOT=null;drawSlots();return}const hh=+v;
  if(!slotDays().some(d=>d.ymd===SLOTDAY&&d.hours.includes(hh))){SLOT=null;drawSlots();err('That time has passed. Please choose another slot.');return}
  SLOTGONE=false;SLOT={date:SLOTDAY,hour:hh,label:`${dayName(SLOTDAY)}, ${slotText(hh)}`};drawSlots();
  if($('#err').textContent.includes('step 1'))err('')});
function qbNote(){const h=x=>x===12?'12 pm':x===0||x===24?'12 am':x>12?`${x-12} pm`:`${x} am`;$('#qbNote').textContent=`Delivered across ${AREA.name}, ${h(SLOTR.startHour)}–${h(SLOTR.endHour)}`}
CONFIG.then(c=>{if(c.slots){SLOTR=c.slots;drawSlots()}if(c.area)AREA=c.area;packCard();qbNote()});
/* keep the slot list current: past slots disappear even if the phone was asleep or the page came back from history */
setInterval(drawSlots,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)drawSlots()});
addEventListener('pageshow',drawSlots);addEventListener('focus',drawSlots);
drawSlots();

/* Home-screen app (no browser back button): open the catalog in the same window so Back works,
   and open the PDF in a viewer that can be closed instead of trapping the app on it. */
(function(){
  const app=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  if(!app)return;
  document.querySelectorAll('a[href="/catalog"]').forEach(a=>{a.removeAttribute('target');a.setAttribute('aria-label','Open the artisanal ice catalog')});
  document.querySelectorAll('a[href$=".pdf"]').forEach(a=>{a.removeAttribute('download');a.target='_blank';a.rel='noopener'});
})();

/* product card: delivery note and the free-delivery pack, from the live delivery rules */
function packCard(){
  const fee=`+ ${R(DELIVERY.fee)} delivery, free on orders of ${R(DELIVERY.freeFrom)} or more`;
  document.querySelectorAll('[data-fee]').forEach(e=>e.textContent=fee);
  const qb=$('#qbAdd'),out=maxQty(HERO.id)<=0;qb.disabled=out;qb.textContent=out?'Sold out':'Add';$('#qbPrice').textContent=R(HERO.p);
}
packCard();

/* Order on WhatsApp: same checks as paying online (email optional), then WhatsApp opens with the full order typed out. */
const WA_NUMBER='916003368214';
function waMessage(c){
  const items=lineItems().map(x=>{const p=find(x.id);return `• ${p.n} × ${x.qty} = ${R(p.p*x.qty)}`});
  const t=lineItems().reduce((a,x)=>a+find(x.id).p*x.qty,0),dl=fee(t);
  return ['Hi On The Rocks, I would like to order:',...items,'',
    `Items: ${R(t)}`,`Delivery: ${dl?R(dl):'Free'}`,`Total: ${R(t+dl)} (pay on delivery)`,'',
    `Delivery slot: ${SLOT.label}`,`Address: ${c.address}, PIN ${c.pincode}`,
    c.mapAddress&&!/^Pinned location/i.test(c.mapAddress)?`Area: ${c.mapAddress}`:'',`Map: https://maps.google.com/?q=${(+c.lat).toFixed(6)},${(+c.lng).toFixed(6)}`,'',
    `Name: ${c.name}`,`Phone: ${c.phone}`].filter((l,i,a)=>l!==''||a[i-1]!=='').join('\n');
}
$('#place').addEventListener('click',e=>{
  if(!lineItems().length){e.preventDefault();err('Your cart is empty.');return}
  const c=customer();
  if(!c){e.preventDefault();return}
  $('#place').href=`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMessage(c))}`;
});
render();
