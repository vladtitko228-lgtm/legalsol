/* Legal Solutions — Country code picker (shared)
   Used on: homepage modal, blog article modal.

   Init: <div class="ls-cp" data-default="+48">...HTML structure...</div>
   Then call: lsCountryPickerInit(rootElement)

   The container must have these children with data-cp-* attributes:
   - data-cp-trigger    (button)
   - data-cp-flag       (span — current flag)
   - data-cp-code       (span — current code)
   - data-cp-menu       (div — dropdown menu)
   - data-cp-search     (input — search box)
   - data-cp-list       (div — results list)
   - data-cp-hidden     (input — hidden field with code value)
*/
window._LS_COUNTRIES = [
  // Priority order for Legal Solutions clients
  {n:'Poland',c:'+48',f:'🇵🇱',s:'pl polska polonia poland'},
  {n:'Ukraine',c:'+380',f:'🇺🇦',s:'ua ukraine ukraina'},
  {n:'Russia',c:'+7',f:'🇷🇺',s:'ru russia rossiya'},
  {n:'Belarus',c:'+375',f:'🇧🇾',s:'by belarus belorussia'},
  {n:'Moldova',c:'+373',f:'🇲🇩',s:'md moldova'},
  {n:'Georgia',c:'+995',f:'🇬🇪',s:'ge georgia gruzia'},
  {n:'Azerbaijan',c:'+994',f:'🇦🇿',s:'az azerbaijan'},
  {n:'Armenia',c:'+374',f:'🇦🇲',s:'am armenia'},
  {n:'Kazakhstan',c:'+7',f:'🇰🇿',s:'kz kazakhstan'},
  {n:'Uzbekistan',c:'+998',f:'🇺🇿',s:'uz uzbekistan'},
  {n:'Kyrgyzstan',c:'+996',f:'🇰🇬',s:'kg kyrgyzstan kirgizia'},
  {n:'Tajikistan',c:'+992',f:'🇹🇯',s:'tj tajikistan'},
  {n:'Turkmenistan',c:'+993',f:'🇹🇲',s:'tm turkmenistan'},
  {n:'Turkey',c:'+90',f:'🇹🇷',s:'tr turkey turkiye'},
  {n:'India',c:'+91',f:'🇮🇳',s:'in india'},
  {n:'Pakistan',c:'+92',f:'🇵🇰',s:'pk pakistan'},
  {n:'Bangladesh',c:'+880',f:'🇧🇩',s:'bd bangladesh'},
  {n:'Sri Lanka',c:'+94',f:'🇱🇰',s:'lk sri lanka'},
  {n:'Nepal',c:'+977',f:'🇳🇵',s:'np nepal'},
  {n:'Indonesia',c:'+62',f:'🇮🇩',s:'id indonesia'},
  {n:'Philippines',c:'+63',f:'🇵🇭',s:'ph philippines'},
  {n:'Vietnam',c:'+84',f:'🇻🇳',s:'vn vietnam'},
  {n:'Thailand',c:'+66',f:'🇹🇭',s:'th thailand'},
  {n:'China',c:'+86',f:'🇨🇳',s:'cn china'},
  {n:'South Korea',c:'+82',f:'🇰🇷',s:'kr korea south'},
  {n:'Japan',c:'+81',f:'🇯🇵',s:'jp japan'},
  {n:'Malaysia',c:'+60',f:'🇲🇾',s:'my malaysia'},
  {n:'Singapore',c:'+65',f:'🇸🇬',s:'sg singapore'},
  // EU + Schengen
  {n:'Germany',c:'+49',f:'🇩🇪',s:'de germany deutschland'},
  {n:'United Kingdom',c:'+44',f:'🇬🇧',s:'uk united kingdom britain'},
  {n:'France',c:'+33',f:'🇫🇷',s:'fr france'},
  {n:'Italy',c:'+39',f:'🇮🇹',s:'it italy italia'},
  {n:'Spain',c:'+34',f:'🇪🇸',s:'es spain espana'},
  {n:'Portugal',c:'+351',f:'🇵🇹',s:'pt portugal'},
  {n:'Netherlands',c:'+31',f:'🇳🇱',s:'nl netherlands holland'},
  {n:'Belgium',c:'+32',f:'🇧🇪',s:'be belgium'},
  {n:'Austria',c:'+43',f:'🇦🇹',s:'at austria'},
  {n:'Switzerland',c:'+41',f:'🇨🇭',s:'ch switzerland'},
  {n:'Czech Republic',c:'+420',f:'🇨🇿',s:'cz czech czechia'},
  {n:'Slovakia',c:'+421',f:'🇸🇰',s:'sk slovakia'},
  {n:'Hungary',c:'+36',f:'🇭🇺',s:'hu hungary'},
  {n:'Romania',c:'+40',f:'🇷🇴',s:'ro romania'},
  {n:'Bulgaria',c:'+359',f:'🇧🇬',s:'bg bulgaria'},
  {n:'Greece',c:'+30',f:'🇬🇷',s:'gr greece'},
  {n:'Latvia',c:'+371',f:'🇱🇻',s:'lv latvia'},
  {n:'Lithuania',c:'+370',f:'🇱🇹',s:'lt lithuania'},
  {n:'Estonia',c:'+372',f:'🇪🇪',s:'ee estonia'},
  {n:'Finland',c:'+358',f:'🇫🇮',s:'fi finland'},
  {n:'Sweden',c:'+46',f:'🇸🇪',s:'se sweden'},
  {n:'Norway',c:'+47',f:'🇳🇴',s:'no norway'},
  {n:'Denmark',c:'+45',f:'🇩🇰',s:'dk denmark'},
  {n:'Ireland',c:'+353',f:'🇮🇪',s:'ie ireland'},
  {n:'Iceland',c:'+354',f:'🇮🇸',s:'is iceland'},
  {n:'Luxembourg',c:'+352',f:'🇱🇺',s:'lu luxembourg'},
  {n:'Malta',c:'+356',f:'🇲🇹',s:'mt malta'},
  {n:'Cyprus',c:'+357',f:'🇨🇾',s:'cy cyprus'},
  {n:'Slovenia',c:'+386',f:'🇸🇮',s:'si slovenia'},
  {n:'Croatia',c:'+385',f:'🇭🇷',s:'hr croatia'},
  {n:'Serbia',c:'+381',f:'🇷🇸',s:'rs serbia'},
  {n:'Bosnia and Herzegovina',c:'+387',f:'🇧🇦',s:'ba bosnia herzegovina'},
  {n:'Montenegro',c:'+382',f:'🇲🇪',s:'me montenegro'},
  {n:'North Macedonia',c:'+389',f:'🇲🇰',s:'mk north macedonia'},
  {n:'Albania',c:'+355',f:'🇦🇱',s:'al albania'},
  {n:'Kosovo',c:'+383',f:'🇽🇰',s:'xk kosovo'},
  // Americas
  {n:'United States',c:'+1',f:'🇺🇸',s:'us usa united states america'},
  {n:'Canada',c:'+1',f:'🇨🇦',s:'ca canada'},
  {n:'Mexico',c:'+52',f:'🇲🇽',s:'mx mexico'},
  {n:'Brazil',c:'+55',f:'🇧🇷',s:'br brazil brasil'},
  {n:'Argentina',c:'+54',f:'🇦🇷',s:'ar argentina'},
  {n:'Chile',c:'+56',f:'🇨🇱',s:'cl chile'},
  {n:'Colombia',c:'+57',f:'🇨🇴',s:'co colombia'},
  {n:'Peru',c:'+51',f:'🇵🇪',s:'pe peru'},
  {n:'Venezuela',c:'+58',f:'🇻🇪',s:'ve venezuela'},
  {n:'Ecuador',c:'+593',f:'🇪🇨',s:'ec ecuador'},
  {n:'Bolivia',c:'+591',f:'🇧🇴',s:'bo bolivia'},
  {n:'Paraguay',c:'+595',f:'🇵🇾',s:'py paraguay'},
  {n:'Uruguay',c:'+598',f:'🇺🇾',s:'uy uruguay'},
  {n:'Cuba',c:'+53',f:'🇨🇺',s:'cu cuba'},
  {n:'Dominican Republic',c:'+1',f:'🇩🇴',s:'do dominican'},
  {n:'Puerto Rico',c:'+1',f:'🇵🇷',s:'pr puerto rico'},
  {n:'Costa Rica',c:'+506',f:'🇨🇷',s:'cr costa rica'},
  {n:'Panama',c:'+507',f:'🇵🇦',s:'pa panama'},
  {n:'Guatemala',c:'+502',f:'🇬🇹',s:'gt guatemala'},
  {n:'Honduras',c:'+504',f:'🇭🇳',s:'hn honduras'},
  {n:'El Salvador',c:'+503',f:'🇸🇻',s:'sv el salvador'},
  {n:'Nicaragua',c:'+505',f:'🇳🇮',s:'ni nicaragua'},
  // Middle East
  {n:'Israel',c:'+972',f:'🇮🇱',s:'il israel'},
  {n:'United Arab Emirates',c:'+971',f:'🇦🇪',s:'ae uae emirates'},
  {n:'Saudi Arabia',c:'+966',f:'🇸🇦',s:'sa saudi arabia'},
  {n:'Qatar',c:'+974',f:'🇶🇦',s:'qa qatar'},
  {n:'Kuwait',c:'+965',f:'🇰🇼',s:'kw kuwait'},
  {n:'Bahrain',c:'+973',f:'🇧🇭',s:'bh bahrain'},
  {n:'Oman',c:'+968',f:'🇴🇲',s:'om oman'},
  {n:'Jordan',c:'+962',f:'🇯🇴',s:'jo jordan'},
  {n:'Lebanon',c:'+961',f:'🇱🇧',s:'lb lebanon'},
  {n:'Syria',c:'+963',f:'🇸🇾',s:'sy syria'},
  {n:'Iraq',c:'+964',f:'🇮🇶',s:'iq iraq'},
  {n:'Iran',c:'+98',f:'🇮🇷',s:'ir iran'},
  {n:'Yemen',c:'+967',f:'🇾🇪',s:'ye yemen'},
  {n:'Palestine',c:'+970',f:'🇵🇸',s:'ps palestine'},
  {n:'Afghanistan',c:'+93',f:'🇦🇫',s:'af afghanistan'},
  // Africa
  {n:'Egypt',c:'+20',f:'🇪🇬',s:'eg egypt'},
  {n:'Morocco',c:'+212',f:'🇲🇦',s:'ma morocco'},
  {n:'Algeria',c:'+213',f:'🇩🇿',s:'dz algeria'},
  {n:'Tunisia',c:'+216',f:'🇹🇳',s:'tn tunisia'},
  {n:'Libya',c:'+218',f:'🇱🇾',s:'ly libya'},
  {n:'Sudan',c:'+249',f:'🇸🇩',s:'sd sudan'},
  {n:'South Africa',c:'+27',f:'🇿🇦',s:'za south africa'},
  {n:'Nigeria',c:'+234',f:'🇳🇬',s:'ng nigeria'},
  {n:'Kenya',c:'+254',f:'🇰🇪',s:'ke kenya'},
  {n:'Ethiopia',c:'+251',f:'🇪🇹',s:'et ethiopia'},
  {n:'Ghana',c:'+233',f:'🇬🇭',s:'gh ghana'},
  {n:'Tanzania',c:'+255',f:'🇹🇿',s:'tz tanzania'},
  {n:'Uganda',c:'+256',f:'🇺🇬',s:'ug uganda'},
  {n:'Rwanda',c:'+250',f:'🇷🇼',s:'rw rwanda'},
  {n:'Senegal',c:'+221',f:'🇸🇳',s:'sn senegal'},
  {n:'Cote d Ivoire',c:'+225',f:'🇨🇮',s:'ci ivory coast'},
  {n:'Cameroon',c:'+237',f:'🇨🇲',s:'cm cameroon'},
  {n:'Angola',c:'+244',f:'🇦🇴',s:'ao angola'},
  {n:'Mozambique',c:'+258',f:'🇲🇿',s:'mz mozambique'},
  {n:'Zimbabwe',c:'+263',f:'🇿🇼',s:'zw zimbabwe'},
  {n:'Zambia',c:'+260',f:'🇿🇲',s:'zm zambia'},
  {n:'Madagascar',c:'+261',f:'🇲🇬',s:'mg madagascar'},
  // Oceania
  {n:'Australia',c:'+61',f:'🇦🇺',s:'au australia'},
  {n:'New Zealand',c:'+64',f:'🇳🇿',s:'nz new zealand'},
  {n:'Fiji',c:'+679',f:'🇫🇯',s:'fj fiji'},
  // Other
  {n:'Hong Kong',c:'+852',f:'🇭🇰',s:'hk hong kong'},
  {n:'Taiwan',c:'+886',f:'🇹🇼',s:'tw taiwan'},
  {n:'Macau',c:'+853',f:'🇲🇴',s:'mo macau'},
  {n:'Mongolia',c:'+976',f:'🇲🇳',s:'mn mongolia'},
  {n:'Myanmar',c:'+95',f:'🇲🇲',s:'mm myanmar burma'},
  {n:'Cambodia',c:'+855',f:'🇰🇭',s:'kh cambodia'},
  {n:'Laos',c:'+856',f:'🇱🇦',s:'la laos'},
  {n:'Brunei',c:'+673',f:'🇧🇳',s:'bn brunei'},
  {n:'Maldives',c:'+960',f:'🇲🇻',s:'mv maldives'},
  {n:'Bhutan',c:'+975',f:'🇧🇹',s:'bt bhutan'}
];

(function(){
  /* Auto-init all .ls-cp containers when DOM ready */
  function initAll(){
    document.querySelectorAll('.ls-cp:not([data-cp-inited])').forEach(initOne);
  }

  function initOne(root){
    if(!root)return;
    root.setAttribute('data-cp-inited','1');
    var trigger=root.querySelector('[data-cp-trigger]');
    var flagEl=root.querySelector('[data-cp-flag]');
    var codeEl=root.querySelector('[data-cp-code]');
    var menu=root.querySelector('[data-cp-menu]');
    var search=root.querySelector('[data-cp-search]');
    var list=root.querySelector('[data-cp-list]');
    var hidden=root.querySelector('[data-cp-hidden]');
    if(!trigger||!flagEl||!codeEl||!menu||!search||!list||!hidden)return;

    var defaultCode=root.getAttribute('data-default')||'+48';
    var current=hidden.value||defaultCode;

    // Set initial display from current code
    var initialItem=window._LS_COUNTRIES.find(function(x){return x.c===current;});
    if(initialItem){flagEl.textContent=initialItem.f;codeEl.textContent=initialItem.c;}

    function render(items){
      var html='';
      for(var i=0;i<items.length;i++){
        var it=items[i];
        var sel=(it.c===current && (!initialItem || it.n===initialItem.n))?' lscp-selected':'';
        html+='<div class="lscp-item'+sel+'" data-code="'+it.c+'" data-flag="'+it.f+'" data-name="'+it.n+'">'+
          '<span class="lscp-flag">'+it.f+'</span>'+
          '<span class="lscp-name">'+it.n+'</span>'+
          '<span class="lscp-code">'+it.c+'</span>'+
          '</div>';
      }
      list.innerHTML=html;
      list.querySelectorAll('.lscp-item').forEach(function(it){
        it.addEventListener('click',function(){
          var c=this.getAttribute('data-code'),f=this.getAttribute('data-flag'),n=this.getAttribute('data-name');
          hidden.value=c;
          flagEl.textContent=f;
          codeEl.textContent=c;
          initialItem={c:c,n:n,f:f};
          current=c;
          close();
          // Focus next input (the phone number) for UX
          var sib=root.parentElement?root.parentElement.querySelector('input[type="tel"]'):null;
          if(sib)sib.focus();
        });
      });
    }

    function open(){
      // Если триггер в нижней части viewport — открываем меню вверх
      var rect=trigger.getBoundingClientRect();
      var spaceBelow=window.innerHeight-rect.bottom;
      var spaceAbove=rect.top;
      if(spaceBelow<420 && spaceAbove>spaceBelow){
        menu.classList.add('lscp-up');
      }else{
        menu.classList.remove('lscp-up');
      }
      menu.classList.add('lscp-open');
      trigger.classList.add('lscp-open');
      trigger.setAttribute('aria-expanded','true');
      setTimeout(function(){search.focus();},60);
    }
    function close(){
      menu.classList.remove('lscp-open');
      trigger.classList.remove('lscp-open');
      trigger.setAttribute('aria-expanded','false');
      search.value='';
      render(window._LS_COUNTRIES);
    }
    function toggle(e){
      if(e){e.stopPropagation();e.preventDefault();}
      if(menu.classList.contains('lscp-open'))close();else open();
    }

    trigger.addEventListener('click',toggle);
    search.addEventListener('input',function(){
      var q=this.value.trim().toLowerCase();
      if(!q){render(window._LS_COUNTRIES);return;}
      var filtered=window._LS_COUNTRIES.filter(function(it){
        if(it.c.indexOf(q)!==-1)return true;
        if(it.n.toLowerCase().indexOf(q)!==-1)return true;
        if(it.s.indexOf(q)!==-1)return true;
        return false;
      });
      render(filtered);
    });

    document.addEventListener('click',function(e){
      if(!root.contains(e.target))close();
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape' && menu.classList.contains('lscp-open'))close();
    });

    render(window._LS_COUNTRIES);
  }

  /* Inject CSS once */
  if(!document.getElementById('ls-cp-styles')){
    var style=document.createElement('style');
    style.id='ls-cp-styles';
    style.textContent=
      '.ls-cp{position:relative;flex:0 0 130px;}'
      +'.ls-cp [data-cp-trigger]{display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;height:100%;background:rgba(255,255,255,.06);border:1px solid rgba(139,130,232,.25);border-radius:14px;padding:11px 11px 11px 13px;color:#fff;font-family:inherit;font-size:14px;cursor:pointer;transition:background .15s,border-color .15s;outline:none;}'
      +'.ls-cp [data-cp-trigger]:hover{background:rgba(139,130,232,.10);border-color:rgba(139,130,232,.45);}'
      +'.ls-cp [data-cp-trigger].lscp-open{border-color:#7F77DD;background:rgba(127,119,221,.10);}'
      +'.ls-cp [data-cp-flag]{font-size:18px;line-height:1;flex-shrink:0;}'
      +'.ls-cp [data-cp-code]{font-weight:600;flex:1;text-align:left;color:#fff;}'
      +'.ls-cp svg{flex-shrink:0;color:#7F77DD;transition:transform .25s ease;}'
      +'.ls-cp [data-cp-trigger].lscp-open svg{transform:rotate(180deg);}'
      +'.ls-cp [data-cp-menu]{position:absolute;top:calc(100% + 6px);left:0;width:320px;max-width:90vw;z-index:100;background:rgba(30,27,75,.97);backdrop-filter:blur(18px) saturate(140%);-webkit-backdrop-filter:blur(18px) saturate(140%);border:1px solid rgba(139,130,232,.35);border-radius:14px;padding:8px;box-shadow:0 16px 48px rgba(0,0,0,.5);opacity:0;visibility:hidden;transform:translateY(-8px) scale(.98);transform-origin:top left;transition:opacity .2s ease,transform .25s cubic-bezier(.34,1.56,.64,1),visibility .2s;}'
      +'.ls-cp [data-cp-menu].lscp-up{top:auto;bottom:calc(100% + 6px);transform-origin:bottom left;transform:translateY(8px) scale(.98);}'
      +'.ls-cp [data-cp-menu].lscp-open{opacity:1;visibility:visible;transform:translateY(0) scale(1);}'
      +'.ls-cp [data-cp-search]{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(139,130,232,.2);border-radius:10px;padding:9px 12px;color:#fff;font-size:13px;font-family:inherit;outline:none;margin-bottom:6px;box-sizing:border-box;}'
      +'.ls-cp [data-cp-search]::placeholder{color:rgba(255,255,255,.4);}'
      +'.ls-cp [data-cp-search]:focus{border-color:#7F77DD;background:rgba(127,119,221,.10);}'
      +'.ls-cp [data-cp-list]{max-height:min(380px,55vh);overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:1px;}'
      +'.ls-cp [data-cp-list]::-webkit-scrollbar{width:6px;}'
      +'.ls-cp [data-cp-list]::-webkit-scrollbar-thumb{background:rgba(139,130,232,.3);border-radius:3px;}'
      +'.ls-cp [data-cp-list]:empty::after{content:"No results";display:block;padding:14px;color:rgba(255,255,255,.5);font-size:13px;text-align:center;}'
      +'.lscp-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;color:rgba(255,255,255,.85);font-size:13px;cursor:pointer;transition:background .12s ease;user-select:none;-webkit-user-select:none;}'
      +'.lscp-item:hover{background:rgba(127,119,221,.18);color:#fff;}'
      +'.lscp-item.lscp-selected{background:linear-gradient(135deg,rgba(127,119,221,.28),rgba(83,74,183,.22));color:#fff;font-weight:600;box-shadow:inset 0 0 0 1px rgba(139,130,232,.4);}'
      +'.lscp-flag{font-size:18px;line-height:1;flex-shrink:0;}'
      +'.lscp-name{flex:1;color:rgba(255,255,255,.85);}'
      +'.lscp-item:hover .lscp-name{color:#fff;}'
      +'.lscp-code{flex-shrink:0;color:rgba(127,119,221,.95);font-weight:600;font-variant-numeric:tabular-nums;}'
      +'@media (max-width:480px){.ls-cp [data-cp-menu]{width:280px;}.ls-cp [data-cp-list]{max-height:240px;}}';
    document.head.appendChild(style);
  }

  /* Run init on DOM ready, and watch for dynamically added pickers */
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initAll);else initAll();
  // Re-init periodically (cheap) to catch DOM changes from JS-rendered modals
  setInterval(initAll,1500);
})();
