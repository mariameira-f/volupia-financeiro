
const SUPABASE_URL="https://ckrrogbcthkhxhdotmfy.supabase.co";
const SUPABASE_KEY=localStorage.getItem("sb_key")||"";
let sb=null,currentUser=null,currentProfile=null,allProfiles=[];
let valoresVisiveis=true;
const fmtBRL=v=>"R$ "+(+v).toLocaleString("pt-BR",{minimumFractionDigits:2});
const meses=["","Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const mesesFull=["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];


(async()=>{
  if(SUPABASE_KEY){
    document.getElementById("keyFieldWrap").style.display="none";
    sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
    try{
      const{data:{session}}=await sb.auth.getSession();
      if(session){
        currentUser=session.user;
        await loadProfile();
        showApp();
        return;
      }
    }catch(e){console.warn("Sessão expirada",e);}
    
    showLogin();
  }else{
    
    document.getElementById("keyFieldWrap").style.display="block";
    showLogin();
  }
})();

function showLogin(){document.getElementById("loginScreen").style.display="flex";document.getElementById("appWrap").style.display="none";}
function showApp(){document.getElementById("loginScreen").style.display="none";document.getElementById("appWrap").style.display="block";applyPermissions();loadAllData();}


document.getElementById("showSignupBtn").onclick=()=>{document.getElementById("signupBox").style.display=document.getElementById("signupBox").style.display==="none"?"block":"none";};

document.getElementById("loginForm").onsubmit=async e=>{
  e.preventDefault();
  const email=document.getElementById("loginEmail").value.trim();
  const pw=document.getElementById("loginPw").value;
  // Pegar key do campo ou do localStorage
  let key=SUPABASE_KEY;
  const keyField=document.getElementById("loginKey");
  if(keyField.value.trim())key=keyField.value.trim();
  if(!key){
    document.getElementById("loginMsg").innerHTML='<span style="color:#dc2626"><i class="fas fa-exclamation-circle"></i> Cole a Publishable Key do Supabase no campo acima.</span>';
    return;
  }
  // Salvar key
  localStorage.setItem("sb_key",key);
  sb=supabase.createClient(SUPABASE_URL,key);
  const btn=document.getElementById("loginBtn");btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>Entrando...';
  const{data,error}=await sb.auth.signInWithPassword({email,password:pw});
  btn.disabled=false;btn.innerHTML='<i class="fas fa-sign-in-alt"></i>Entrar';
  if(error){
    
    if(error.message.includes("Invalid API key")||error.message.includes("apikey")){
      localStorage.removeItem("sb_key");
      document.getElementById("keyFieldWrap").style.display="block";
      document.getElementById("loginKey").setAttribute("required","required");
      document.getElementById("loginMsg").innerHTML='<span style="color:#dc2626"><i class="fas fa-exclamation-circle"></i> API Key inválida. Verifique a Publishable Key (anon key) no Supabase e cole novamente.</span>';
    }else{
      document.getElementById("loginMsg").innerHTML='<span style="color:#dc2626"><i class="fas fa-exclamation-circle"></i> '+error.message+'</span>';
    }
    return;
  }
  currentUser=data.user;
  await loadProfile();
  showApp();
};

document.getElementById("signupForm").onsubmit=async e=>{
  e.preventDefault();
  let key=localStorage.getItem("sb_key");
  
  if(!key){
    const keyField=document.getElementById("loginKey");
    if(keyField&&keyField.value.trim())key=keyField.value.trim();
  }
  if(!key){document.getElementById("signupMsg").innerHTML='<span style="color:#dc2626">Cole a Publishable Key no campo acima antes de criar conta.</span>';return;}
  if(!sb)sb=supabase.createClient(SUPABASE_URL,key);
  localStorage.setItem("sb_key",key);
  const nome=document.getElementById("sigNome").value.trim();
  const apelido=document.getElementById("sigApelido").value.trim();
  const email=document.getElementById("sigEmail").value.trim();
  const pw=document.getElementById("sigPw").value;
  const perfil=document.getElementById("sigPerfil").value;
  const btn=document.getElementById("signupBtn");btn.disabled=true;
  const{data,error}=await sb.auth.signUp({email,password:pw,options:{data:{nome,apelido,perfil}}});
  btn.disabled=false;
  if(error){document.getElementById("signupMsg").innerHTML='<span style="color:#dc2626">'+error.message+'</span>';return;}
  document.getElementById("signupMsg").innerHTML='<span style="color:#059669">✅ Conta criada! Agora faça login acima.</span>';
  document.getElementById("signupBox").style.display="none";
};

async function doLogout(){if(!confirm("Sair?"))return;await sb.auth.signOut();location.reload();}

async function loadProfile(){
  const{data}=await sb.from("profiles").select("*").eq("id",currentUser.id).single();
  if(data)currentProfile=data;
  else currentProfile={id:currentUser.id,email:currentUser.email,nome:currentUser.email.split("@")[0],apelido:"",perfil:"bixo"};
  document.getElementById("barNome").textContent=currentProfile.apelido||currentProfile.nome;
  document.getElementById("barPerfil").textContent=currentProfile.perfil.charAt(0).toUpperCase()+currentProfile.perfil.slice(1);
}

async function editarMeuApelido(){
  const novo=prompt("Novo apelido (nome de república):",currentProfile.apelido||"");
  if(novo===null)return;
  await sb.from("profiles").update({apelido:novo,updated_at:new Date().toISOString()}).eq("id",currentProfile.id);
  currentProfile.apelido=novo;
  // Update in allProfiles too
  const p=allProfiles.find(x=>x.id===currentProfile.id);
  if(p)p.apelido=novo;
  document.getElementById("barNome").textContent=novo||currentProfile.nome;
  await audit("Alterar apelido","profiles",currentProfile.id,{apelido:novo});
  toast("Apelido atualizado!");
  loadPainel();
}


function applyPermissions(){
  const p=currentProfile.perfil;
  
  const allowed={
    "moradora":["painel","presidencia","joias","aniversario","mei","camisas","caixinha","carnaval","auditoria","admin"],
    "bixo":["painel","camisas"],
    "ex-aluna":["painel","aniversario","mei","camisas"],
    "agregada":["painel"]
  };
  const myTabs=allowed[p]||["painel"];
  // Desktop tabs: HIDE completely (not just disabled) for ex-alunas
  document.querySelectorAll(".main-tab[data-tab]").forEach(t=>{
    if(myTabs.includes(t.dataset.tab)){t.style.display="inline-flex";t.classList.remove("disabled");}
    else{t.style.display="none";}
  });
  
  document.querySelectorAll(".mob-nav-item[data-tab]").forEach(t=>{
    if(myTabs.includes(t.dataset.tab)){t.style.display="flex";}
    else{t.style.display="none";}
  });
  
  if(p!=="moradora"){
    document.getElementById("aniConfigCard").style.display="none";
    document.getElementById("meiConfigCard").style.display="none";
    const cc=document.getElementById("carnConfigCard");if(cc)cc.style.display="none";
  }else{
    document.getElementById("aniConfigCard").style.display="block";
    document.getElementById("meiConfigCard").style.display="block";
    const cc=document.getElementById("carnConfigCard");if(cc)cc.style.display="block";
  }
  
  if(p!=="moradora"){
    document.querySelectorAll('.cam-subtab[data-sub="todos"],.cam-subtab[data-sub="gestao"]').forEach(b=>b.style.display="none");
  }else{
    document.querySelectorAll('.cam-subtab[data-sub="todos"],.cam-subtab[data-sub="gestao"]').forEach(b=>b.style.display="inline-flex");
  }
}


function switchTab(t){
  document.querySelectorAll(".tab-section").forEach(s=>s.style.display="none");
  const el=document.getElementById("tab-"+t);if(el)el.style.display="block";
  document.querySelectorAll("[data-tab]").forEach(b=>{b.classList.toggle("active",b.dataset.tab===t);});
  // Load data for tab
  if(t==="presidencia")loadPresidencias();
  if(t==="joias")loadJoias();
  if(t==="aniversario")loadAniversario();
  if(t==="mei")loadMeiSetup();
  if(t==="camisas")loadCamisas();
  if(t==="caixinha")loadCaixinha();
  if(t==="carnaval")loadCarnaval();
  if(t==="auditoria")loadAuditoria();
  if(t==="admin")loadAdmin();
}

function camSubTab(sub){
  document.querySelectorAll(".cam-sub").forEach(d=>d.style.display="none");
  document.getElementById("camSub-"+sub).style.display="block";
  document.querySelectorAll(".cam-subtab").forEach(b=>{b.classList.remove("active");b.style.borderColor="#d6d3d1";b.style.color="#57534e";});
  const btn=document.querySelector('.cam-subtab[data-sub="'+sub+'"]');
  if(btn){btn.classList.add("active");btn.style.borderColor="var(--bordo)";btn.style.color="var(--bordo)";}
}


function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2500);}


function toggleVisibility(){
  valoresVisiveis=!valoresVisiveis;
  document.getElementById("visIcon").className=valoresVisiveis?"fas fa-eye":"fas fa-eye-slash";
  document.querySelectorAll(".val-hide").forEach(el=>{
    if(valoresVisiveis){el.classList.remove("blurred");}
    else{el.classList.add("blurred");}
  });
}


function abrirModal(title,html){
  document.getElementById("modalTitle").textContent=title;
  document.getElementById("modalBody").innerHTML=html;
  document.getElementById("modalOverlay").style.display="block";
}
function fecharModal(){document.getElementById("modalOverlay").style.display="none";}


async function audit(acao,tabela,registroId,detalhes){
  await sb.from("audit_log").insert({user_id:currentProfile.id,user_nome:currentProfile.apelido||currentProfile.nome,acao,tabela,registro_id:String(registroId||""),detalhes:detalhes||{}});
}


async function loadAllData(){
  const{data}=await sb.from("profiles").select("*").order("nome");
  allProfiles=data||[];
  loadPainel();
}


async function loadPainel(){
  const uid=currentProfile.id;
  const isExala=currentProfile.perfil==="ex-aluna";
  const isBixo=currentProfile.perfil==="bixo";

  // Show/hide cards based on profile
  document.getElementById("pnlMoradoraCards").style.display=isExala?"none":"grid";
  document.getElementById("pnlExalaCards").style.display=isExala?"block":"none";
  document.getElementById("pnlHistoricoWrap").style.display=isExala?"none":"block";

 
  let apelidoSection=document.getElementById("pnlApelidoEdit");
  if(!apelidoSection){
    apelidoSection=document.createElement("div");
    apelidoSection.id="pnlApelidoEdit";
    const painel=document.getElementById("tab-painel");
    painel.insertBefore(apelidoSection,painel.children[1]);
  }
  if(isBixo){
    apelidoSection.innerHTML=`<div class="card" style="margin-bottom:16px;border-left:4px solid var(--amber)">
      <div class="card-body" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div><span style="font-size:12px;color:#78716c">Seu apelido:</span> <strong style="font-size:14px">${currentProfile.apelido||"(sem apelido)"}</strong></div>
        <button class="btn btn-secondary btn-sm" onclick="editarMeuApelido()"><i class="fas fa-pen"></i>Alterar Apelido</button>
      </div>
    </div>`;
  }else{
    apelidoSection.innerHTML="";
  }

  if(isExala){

    const thisYear=new Date().getFullYear();
    const{data:meiData}=await sb.from("mei").select("*").eq("ano",thisYear).maybeSingle();
    if(meiData){
      const{data:parts}=await sb.from("mei_participantes").select("*").eq("mei_id",meiData.id);
      const confirmed=(parts||[]).filter(p=>p.opt_in);
      const myPart=(parts||[]).find(p=>p.ex_aluna_id===uid);
      const individual=confirmed.length>0?(parseFloat(meiData.valor_total)/confirmed.length):0;
      document.getElementById("pnlMeiPartic").textContent=confirmed.length;
      document.getElementById("pnlMeiCota").textContent=fmtBRL(individual);
      document.getElementById("pnlMeiTotal").textContent=fmtBRL(meiData.valor_total);
      if(myPart&&myPart.opt_in){
        document.getElementById("pnlMeiStatus").className="badge badge-"+(myPart.status==="pago"?"pago":"pendente");
        document.getElementById("pnlMeiStatus").textContent=myPart.status==="pago"?"✅ Pago":"Pendente";
        document.getElementById("pnlMeiSairBtn").style.display="inline-flex";
      }else if(myPart&&!myPart.opt_in){
        document.getElementById("pnlMeiStatus").className="badge";document.getElementById("pnlMeiStatus").style.background="#f5f5f4";
        document.getElementById("pnlMeiStatus").textContent="Não participa";
        document.getElementById("pnlMeiSairBtn").style.display="none";
      }else{
        document.getElementById("pnlMeiStatus").className="badge";document.getElementById("pnlMeiStatus").style.background="#f5f5f4";
        document.getElementById("pnlMeiStatus").textContent="Não cadastrada";
        document.getElementById("pnlMeiSairBtn").style.display="none";
      }
    }else{
      document.getElementById("pnlMeiPartic").textContent="0";
      document.getElementById("pnlMeiCota").textContent="—";
      document.getElementById("pnlMeiTotal").textContent="—";
      document.getElementById("pnlMeiStatus").textContent="MEI não configurado";
    }
    // Camisa debts
    const{data:camPedido}=await sb.from("camisas_pedidos").select("*").eq("user_id",uid).order("ano",{ascending:false}).limit(1);
    const camDiv=document.getElementById("pnlCamisaDivida");
    if(camPedido&&camPedido.length&&camPedido[0].status!=="pago"){
      const cp=camPedido[0];
      const vTotal=parseFloat(cp.valor_total)||0;
      const vPago=parseFloat(cp.valor_pago||0);
      const vFalta=Math.max(0,vTotal-vPago);
      const statusLabel=cp.status.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
      camDiv.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div><strong>Pedido ${cp.ano}</strong> — ${cp.total_camisas} camisa(s)</div>
        <div style="text-align:right">
          <div style="font-size:11px;color:#78716c">Total: <strong class="val-hide">${fmtBRL(vTotal)}</strong> · Pago: <strong class="val-hide" style="color:var(--verde)">${fmtBRL(vPago)}</strong></div>
          <div style="margin-top:4px"><span class="val-hide" style="font-size:18px;font-weight:800;color:var(--vermelho)">${fmtBRL(vFalta)}</span> <span class="badge badge-pendente">${statusLabel}</span></div>
        </div>
      </div>`;
    }else if(camPedido&&camPedido.length&&camPedido[0].status==="pago"){
      camDiv.innerHTML='<p style="color:var(--verde);font-size:13px;text-align:center;padding:16px;font-weight:700"><i class="fas fa-check-circle" style="margin-right:6px"></i>Pedido de camisa quitado!</p>';
    }else camDiv.innerHTML='<p style="color:#a8a29e;font-size:13px;text-align:center;padding:16px">Nenhum pedido de camisa</p>';
    return;
  }


  const{data:presData}=await sb.from("presidencias").select("*").order("ano",{ascending:false}).order("mes",{ascending:false}).limit(1);
  let presValor=0;
  if(presData&&presData.length){
    const pres=presData[0];
    const{data:lancs}=await sb.from("lancamentos").select("*,categorias_presidencia(nome)").eq("presidencia_id",pres.id).eq("status","incluido");
    if(lancs&&lancs.length){
      lancs.forEach(l=>{
        const val=parseFloat(l.valor)||0;
        const catNome=l.categorias_presidencia?.nome||"";
        const divisao=l.divisao_custom||{};
        if(catNome==="Saída Caixinha"||catNome==="Casa")return;
        // Acerto
        if(divisao&&divisao[uid]!==undefined){presValor+=parseFloat(divisao[uid]);return;}
        // Normal division
        let ids=[];
        if(divisao.pessoas&&divisao.pessoas.length)ids=divisao.pessoas;
        else if(divisao.dividir_entre){
          divisao.dividir_entre.forEach(g=>{allProfiles.filter(p=>p.perfil===g.replace(/s$/,"").replace("moradora","moradora")).forEach(p=>ids.push(p.id));});
        }else ids=allProfiles.filter(p=>p.perfil==="moradora").map(p=>p.id);
        ids=[...new Set(ids)];
        if(ids.includes(uid)&&ids.length>0)presValor+=val/ids.length;
      });
    }
  }
  document.getElementById("pnlSaldo").textContent=fmtBRL(presValor);

  // Historical debits
  const{data:debitos}=await sb.from("debitos_presidencia").select("*,presidencias(mes,ano)").eq("user_id",uid).order("created_at",{ascending:false});
  let divTotal=0;
  let histHtml="";
  if(debitos&&debitos.length){
    debitos.forEach(d=>{
      if(d.status!=="pago")divTotal+=parseFloat(d.valor);
      const badge=d.status==="pago"?"badge-pago":d.status==="parcial"?"badge-parcial":"badge-pendente";
      histHtml+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f5f5f4"><div><strong>${mesesFull[d.presidencias?.mes]||""} ${d.presidencias?.ano||""}</strong></div><div style="display:flex;align-items:center;gap:8px"><span class="val-hide" style="font-weight:700">${fmtBRL(d.valor)}</span><span class="badge ${badge}">${d.status}</span></div></div>`;
    });
  }else histHtml='<p style="color:#a8a29e;font-size:13px;text-align:center;padding:20px">Nenhum débito registrado</p>';
  document.getElementById("pnlHistorico").innerHTML=histHtml;
  document.getElementById("pnlDividas").textContent=fmtBRL(divTotal);

  // Joia
  if(currentProfile.perfil==="moradora"){
    const{data:joias}=await sb.from("joias").select("*,joias_pagamentos(*)").eq("moradora_id",uid);
    if(joias&&joias.length){
      const j=joias[joias.length-1];
      const pago=j.joias_pagamentos?j.joias_pagamentos.filter(p=>p.pago).reduce((s,p)=>s+parseFloat(p.valor),0):0;
      const falta=parseFloat(j.valor_integral)-pago;
      document.getElementById("pnlJoia").textContent=falta>0?fmtBRL(falta):"✅ Quitada";
    }else document.getElementById("pnlJoia").textContent="—";
  }else document.getElementById("pnlJoia").textContent="N/A";
}


async function loadPresidencias(){
  const{data}=await sb.from("presidencias").select("*").order("ano",{ascending:false}).order("mes",{ascending:false});
  const sel=document.getElementById("presSelect");
  sel.innerHTML="<option value=''>Selecione...</option>";
  (data||[]).forEach(p=>{sel.innerHTML+=`<option value="${p.id}">${mesesFull[p.mes]} ${p.ano} ${p.status==="fechada"?"(fechada)":""}</option>`;});
  if(data&&data.length){sel.value=data[0].id;loadPresidencia();}
}

async function loadPresidencia(){
  const pid=document.getElementById("presSelect").value;
  if(!pid){document.getElementById("lancTbody").innerHTML='<tr><td colspan="7" style="text-align:center;color:#a8a29e;padding:30px">Selecione</td></tr>';return;}
  // Info
  const{data:pres}=await sb.from("presidencias").select("*").eq("id",pid).single();
  const presidente=allProfiles.find(p=>p.id===pres.presidente_id);
  document.getElementById("presNome").textContent=presidente?(presidente.apelido||presidente.nome):"Não definida";
  document.getElementById("presStatus").textContent=pres.status==="aberta"?"Aberta":"Fechada";
  document.getElementById("presStatus").className="badge "+(pres.status==="aberta"?"badge-parcial":"badge-pago");
  // Actions
  const isPresidente=pres.presidente_id===currentProfile.id;
  const isMoradora=currentProfile.perfil==="moradora";
  const canEdit=isMoradora;// moradoras can always interact
  let actHtml="";
  if(canEdit&&pres.status==="aberta"){
    actHtml+=`<button class="btn btn-success btn-sm" onclick="fecharPresidencia(${pres.id})"><i class="fas fa-lock"></i>Fechar</button>`;
  }
  if(canEdit&&pres.status==="fechada"){
    actHtml+=`<button class="btn btn-secondary btn-sm" onclick="reabrirPresidencia(${pres.id})"><i class="fas fa-pen"></i>Editar</button>`;
  }
  document.getElementById("presActions").innerHTML=actHtml;

  // Lançamentos
  const{data:lancs}=await sb.from("lancamentos").select("*,categorias_presidencia(nome,icone),profiles:created_by(apelido,nome)").eq("presidencia_id",pid).order("data",{ascending:false});
  const tbody=document.getElementById("lancTbody");
  if(!lancs||!lancs.length){tbody.innerHTML='<tr><td colspan="7" style="text-align:center;color:#a8a29e;padding:20px">Nenhum lançamento</td></tr>';await loadResumoPresidencia(pid);return;}
  tbody.innerHTML=lancs.map(l=>{
    const badge=l.status==="incluido"?"badge-pago":l.status==="rejeitado"?"badge-pendente":"badge-parcial";
    const criador=l.profiles?(l.profiles.apelido||l.profiles.nome):"—";
    const showActions=canEdit;// moradoras can always manage lancamentos
    return`<tr>
      <td>${new Date(l.data).toLocaleDateString("pt-BR")}</td>
      <td>${l.descricao}</td>
      <td>${l.categorias_presidencia?l.categorias_presidencia.icone+" "+l.categorias_presidencia.nome:"—"}</td>
      <td class="val-hide" style="font-weight:700">${fmtBRL(l.valor)}</td>
      <td><span class="badge ${badge}">${l.status}</span></td>
      <td style="font-size:11px;color:#78716c">${criador}</td>
      <td>${showActions?`<button class="btn btn-sm btn-secondary" onclick="abrirFormLanc(${l.id})" title="Editar"><i class="fas fa-pen"></i></button> <button class="btn btn-sm btn-success" onclick="incluirLanc(${l.id},'incluido')">✓</button><button class="btn btn-sm btn-danger" onclick="incluirLanc(${l.id},'rejeitado')" style="margin-left:4px">✗</button>`:""}</td>
    </tr>`;
  }).join("");

  // Resumo
  await loadResumoPresidencia(pid);
}

async function loadResumoPresidencia(pid){
  // Get included lancamentos
  const{data:lancs}=await sb.from("lancamentos").select("*,categorias_presidencia(nome)").eq("presidencia_id",pid).eq("status","incluido");
  const tbody=document.getElementById("resumoTbody");
  if(!lancs||!lancs.length){tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:#a8a29e;padding:20px">Inclua lançamentos para ver o resumo</td></tr>';return;}
  // Get moradoras for division
  const moradoras=allProfiles.filter(p=>p.perfil==="moradora");
  const totais={};
  allProfiles.forEach(m=>{totais[m.id]=0;});
  let totalGeral=0;
  lancs.forEach(l=>{
    const val=parseFloat(l.valor)||0;
    const catNome=l.categorias_presidencia?.nome||"";
    const divisao=l.divisao_custom||{};
    totalGeral+=val;
    // Check for acerto (custom division with + and -)
    if(divisao&&Object.keys(divisao).length&&!divisao.dividir_entre&&!divisao.pessoas){
      Object.entries(divisao).forEach(([uid,v])=>{if(totais[uid]!==undefined)totais[uid]+=parseFloat(v);});
      return;
    }
    // Get list of people to split among
    let ids=[];
    if(divisao.pessoas&&divisao.pessoas.length){
      ids=divisao.pessoas;
    }else if(divisao.dividir_entre){
      const grupos=divisao.dividir_entre;
      let participantes=[];
      if(grupos.includes("moradoras"))participantes.push(...allProfiles.filter(p=>p.perfil==="moradora"));
      if(grupos.includes("bixos"))participantes.push(...allProfiles.filter(p=>p.perfil==="bixo"));
      if(grupos.includes("agregadas"))participantes.push(...allProfiles.filter(p=>p.perfil==="agregada"));
      ids=[...new Set(participantes.map(p=>p.id))];
    }else{
      ids=moradoras.map(p=>p.id);// default: all moradoras
    }
    if(catNome==="Saída Caixinha"||catNome==="Casa")return;// Not divided per person
    if(!ids.length)return;
    const perPerson=val/ids.length;
    ids.forEach(id=>{if(totais[id]===undefined)totais[id]=0;totais[id]+=perPerson;});
  });
  // Build table
  const rows=Object.entries(totais).filter(([_,v])=>Math.abs(v)>0.01).map(([uid,val])=>{
    const p=allProfiles.find(x=>x.id===uid)||{};
    const badge=p.perfil==="moradora"?"badge-moradora":p.perfil==="bixo"?"badge-bixo":p.perfil==="agregada"?"badge-parcial":"badge-exaluna";
    return{uid,val,p,badge};
  });
  // Load debitos for this presidencia to show payments
  const{data:debitos}=await sb.from("debitos_presidencia").select("*").eq("presidencia_id",pid);
  const debitoMap={};(debitos||[]).forEach(d=>{debitoMap[d.user_id]=d;});

  if(rows.length){
    tbody.innerHTML=rows.map(r=>{
      const deb=debitoMap[r.uid];
      const pago=deb?parseFloat(deb.valor_pago||0):0;
      const falta=Math.max(0,Math.abs(r.val)-pago);
      const debId=deb?deb.id:null;
      return`<tr>
        <td><strong>${r.p.apelido||r.p.nome||"—"}</strong></td>
        <td><span class="badge ${r.badge}">${r.p.perfil||""}</span></td>
        <td class="val-hide" style="font-weight:700;color:${r.val>0?"var(--vermelho)":"var(--verde)"}">${r.val>0?fmtBRL(r.val):"-"+fmtBRL(Math.abs(r.val))}</td>
        <td class="val-hide" style="color:var(--verde);font-weight:600">${fmtBRL(pago)}</td>
        <td class="val-hide" style="font-weight:700;color:${falta>0.01?"var(--vermelho)":"var(--verde)"}">${falta>0.01?fmtBRL(falta):"✅"}</td>
        <td>${r.val>0&&falta>0.01?`<button class="btn btn-success btn-sm" onclick="pagarResumo('${r.uid}',${pid},${Math.abs(r.val)},${pago}${debId?","+debId:""})"><i class="fas fa-dollar-sign"></i>Pagar</button>`:""}</td>
      </tr>`;
    }).join("");
  }else tbody.innerHTML='<tr><td colspan="6" style="text-align:center;color:#a8a29e;padding:20px">Nenhum valor a dividir</td></tr>';
}

async function pagarResumo(uid,pid,valorDevido,valorPago,debId){
  const falta=Math.max(0,valorDevido-valorPago);
  const v=prompt(`Valor pago?\n\nDevido: ${fmtBRL(valorDevido)}\nJá pago: ${fmtBRL(valorPago)}\nFalta: ${fmtBRL(falta)}`,falta.toFixed(2));
  if(!v)return;const val=parseFloat(v);if(isNaN(val)||val<=0)return;
  const nP=valorPago+val;const nF=Math.max(0,valorDevido-nP);
  const st=nF<=0.01?"pago":"parcial";
  if(debId){
    await sb.from("debitos_presidencia").update({valor:valorDevido,valor_pago:nP,status:st,data_pagamento:new Date().toISOString(),marcado_por:currentProfile.id}).eq("id",debId);
  }else{
    await sb.from("debitos_presidencia").insert({presidencia_id:pid,user_id:uid,valor:valorDevido,valor_pago:nP,status:st,data_pagamento:new Date().toISOString(),marcado_por:currentProfile.id});
  }
  await audit("Pagamento presidência","debitos_presidencia","",{uid,valor:val,total_pago:nP});
  toast(st==="pago"?`Quitado!`:`Pago ${fmtBRL(val)}. Falta ${fmtBRL(nF)}`);
  loadPresidencia();
}

async function exportarResumoPDF(){
  const pid=document.getElementById("presSelect").value;
  if(!pid){alert("Selecione uma presidência.");return;}
  const{data:pres}=await sb.from("presidencias").select("*").eq("id",pid).single();
  const presidente=allProfiles.find(p=>p.id===pres.presidente_id);
  const{data:lancs}=await sb.from("lancamentos").select("*,categorias_presidencia(nome)").eq("presidencia_id",pid).eq("status","incluido");
  if(!lancs||!lancs.length){alert("Nenhum lançamento incluído.");return;}

  // Calculate per person: track positives and negatives separately
  const pessoas={};// {uid: {nome, apelido, perfil, debitos:[], creditos:[], total:0}}
  allProfiles.forEach(p=>{pessoas[p.id]={nome:p.nome,apelido:p.apelido,perfil:p.perfil,debitos:[],creditos:[],total:0};});

  lancs.forEach(l=>{
    const val=parseFloat(l.valor)||0;
    const catNome=l.categorias_presidencia?.nome||"";
    const divisao=l.divisao_custom||{};
    if(catNome==="Saída Caixinha"||catNome==="Casa")return;

    // Acerto (custom with uid keys)
    if(divisao&&Object.keys(divisao).length&&!divisao.pessoas&&!divisao.dividir_entre){
      Object.entries(divisao).forEach(([uid,v])=>{
        if(!pessoas[uid])return;
        const fv=parseFloat(v);
        if(fv>0){pessoas[uid].debitos.push({desc:l.descricao,val:fv});pessoas[uid].total+=fv;}
        else{pessoas[uid].creditos.push({desc:l.descricao,val:Math.abs(fv)});pessoas[uid].total+=fv;}
      });
      return;
    }

    // Normal division
    let ids=[];
    if(divisao.pessoas&&divisao.pessoas.length)ids=divisao.pessoas;
    else if(divisao.dividir_entre){
      divisao.dividir_entre.forEach(g=>{allProfiles.filter(p=>p.perfil===(g==="moradoras"?"moradora":g==="bixos"?"bixo":g==="agregadas"?"agregada":"")).forEach(p=>ids.push(p.id));});
    }else ids=allProfiles.filter(p=>p.perfil==="moradora").map(p=>p.id);
    ids=[...new Set(ids)];
    if(!ids.length)return;
    const perPerson=val/ids.length;
    ids.forEach(uid=>{
      if(!pessoas[uid])return;
      pessoas[uid].debitos.push({desc:l.descricao+` (÷${ids.length})`,val:perPerson});
      pessoas[uid].total+=perPerson;
    });
  });

  // Build PDF
  const mesNome=mesesFull[pres.mes]||"";
  let h=`<html><head><meta charset="utf-8"><title>Presidência ${mesNome} ${pres.ano}</title>
  <style>
    body{font-family:'Open Sans',Arial,sans-serif;font-size:11px;padding:24px;color:#1e1b18}
    h1{font-size:18px;color:#62162f;margin:0 0 4px}
    h2{font-size:14px;color:#62162f;margin:20px 0 8px;border-bottom:2px solid #62162f;padding-bottom:4px}
    .info{font-size:11px;color:#666;margin:0 0 16px}
    table{width:100%;border-collapse:collapse;margin-bottom:12px}
    th,td{border:1px solid #ddd;padding:5px 8px;text-align:left;font-size:10px}
    th{background:#62162f;color:#fff;text-transform:uppercase;font-size:9px}
    .pos{color:#059669;font-weight:700}
    .neg{color:#dc2626;font-weight:700}
    .total-row{background:#fafaf9;font-weight:800;font-size:12px}
    .section{page-break-inside:avoid;margin-bottom:16px;border:1px solid #e5e5e5;border-radius:8px;padding:12px}
    .section-title{font-size:12px;font-weight:700;margin:0 0 8px;color:#62162f}
  </style></head><body>`;
  h+=`<div style="text-align:center;margin-bottom:20px"><span style="font-size:24px">🐇</span><h1>Volúpia — Presidência de ${mesNome} ${pres.ano}</h1><p class="info">Presidente: ${presidente?(presidente.apelido||presidente.nome):"—"} · Gerado em ${new Date().toLocaleDateString("pt-BR")}</p></div>`;

  // Summary table
  h+=`<h2>Resumo Geral</h2><table><thead><tr><th>Pessoa</th><th>Perfil</th><th>Total Débitos</th><th>Total Créditos</th><th>Saldo</th></tr></thead><tbody>`;
  const pessoasArr=Object.entries(pessoas).filter(([_,p])=>Math.abs(p.total)>0.01).sort((a,b)=>b[1].total-a[1].total);
  pessoasArr.forEach(([uid,p])=>{
    const totalDeb=p.debitos.reduce((s,d)=>s+d.val,0);
    const totalCred=p.creditos.reduce((s,d)=>s+d.val,0);
    h+=`<tr><td><strong>${p.apelido||p.nome}</strong></td><td>${p.perfil}</td><td class="neg">${fmtBRL(totalDeb)}</td><td class="pos">${totalCred>0?"-"+fmtBRL(totalCred):"—"}</td><td class="${p.total>0?"neg":"pos"}" style="font-size:12px">${p.total>0?fmtBRL(p.total):"-"+fmtBRL(Math.abs(p.total))}</td></tr>`;
  });
  h+=`</tbody></table>`;

  // Detail per person
  h+=`<h2>Detalhamento por Pessoa</h2>`;
  pessoasArr.forEach(([uid,p])=>{
    h+=`<div class="section"><div class="section-title">${p.apelido||p.nome} (${p.perfil})</div>`;
    if(p.debitos.length){
      h+=`<table><thead><tr><th>Débito</th><th style="text-align:right">Valor</th></tr></thead><tbody>`;
      p.debitos.forEach(d=>{h+=`<tr><td>${d.desc}</td><td style="text-align:right" class="neg">${fmtBRL(d.val)}</td></tr>`;});
      h+=`<tr class="total-row"><td>Total Débitos</td><td style="text-align:right" class="neg">${fmtBRL(p.debitos.reduce((s,d)=>s+d.val,0))}</td></tr></tbody></table>`;
    }
    if(p.creditos.length){
      h+=`<table><thead><tr><th>Crédito</th><th style="text-align:right">Valor</th></tr></thead><tbody>`;
      p.creditos.forEach(d=>{h+=`<tr><td>${d.desc}</td><td style="text-align:right" class="pos">-${fmtBRL(d.val)}</td></tr>`;});
      h+=`<tr class="total-row"><td>Total Créditos</td><td style="text-align:right" class="pos">-${fmtBRL(p.creditos.reduce((s,d)=>s+d.val,0))}</td></tr></tbody></table>`;
    }
    h+=`<div style="text-align:right;font-size:13px;font-weight:800;margin-top:6px;color:${p.total>0?"#dc2626":"#059669"}">SALDO: ${p.total>0?"":"-"}${fmtBRL(Math.abs(p.total))}</div></div>`;
  });

  h+=`</body></html>`;
  const w=window.open("","_blank");w.document.write(h);w.document.close();setTimeout(()=>w.print(),500);
}

async function criarPresidencia(){
  const moradoras=allProfiles.filter(p=>p.perfil==="moradora");
  const opts=moradoras.map(m=>`<option value="${m.id}">${m.apelido||m.nome}</option>`).join("");
  const mesOpts=mesesFull.slice(1).map((m,i)=>`<option value="${i+1}" ${i+1===new Date().getMonth()+1?"selected":""}>${m}</option>`).join("");
  abrirModal("Nova Presidência",`
    <div style="display:grid;gap:12px">
      <div><label>Mês</label><select id="mPresMes">${mesOpts}</select></div>
      <div><label>Ano</label><input type="number" id="mPresAno" value="${new Date().getFullYear()}"></div>
      <div><label>Presidente do Mês</label><select id="mPresidente">${opts}</select></div>
      <button class="btn btn-primary" style="width:100%;justify-content:center" onclick="salvarNovaPresidencia()"><i class="fas fa-save"></i>Criar</button>
    </div>
  `);
}

async function salvarNovaPresidencia(){
  const mes=parseInt(document.getElementById("mPresMes").value);
  const ano=parseInt(document.getElementById("mPresAno").value);
  const presId=document.getElementById("mPresidente").value;
  const{error}=await sb.from("presidencias").insert({mes,ano,presidente_id:presId});
  if(error){alert("Erro: "+error.message);return;}
  await audit("Criar Presidência","presidencias","",{mes,ano});
  fecharModal();toast("Presidência criada!");loadPresidencias();
}

function abrirFormLanc(editId){
  const moradoras=allProfiles.filter(p=>p.perfil==="moradora");
  const bixos=allProfiles.filter(p=>p.perfil==="bixo");
  const agregadas=allProfiles.filter(p=>p.perfil==="agregada");
  const pessoasOpts=`<option value="">— Selecione —</option><option value="Casa">🏠 Casa</option><option value="Caixinha">💰 Caixinha</option>`+
    [{label:"Moradoras",items:moradoras},{label:"Bixos",items:bixos},{label:"Agregadas",items:agregadas}].map(g=>g.items.length?`<optgroup label="${g.label}">${g.items.map(p=>`<option value="${p.id}">${p.apelido||p.nome}</option>`).join("")}</optgroup>`:"").join("");
  const allPeople=[...moradoras,...bixos,...agregadas];
  const acertoOpts=allPeople.map(p=>`<option value="${p.id}">${p.apelido||p.nome}</option>`).join("");
  const mkCheck=(p,checked)=>`<label style="display:flex;align-items:center;gap:4px;font-size:11px;text-transform:none;font-weight:500;cursor:pointer;padding:3px 0"><input type="checkbox" class="divPerson" value="${p.id}" ${checked?"checked":""}> ${p.apelido||p.nome}</label>`;
  let divChecks="";
  if(moradoras.length)divChecks+=`<div style="margin-bottom:6px"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><strong style="font-size:10px;color:#78716c;text-transform:uppercase">Moradoras</strong><button type="button" class="btn btn-sm btn-secondary" style="padding:2px 6px;font-size:9px" onclick="toggleDivGroup('moradora')">Todas</button></div>${moradoras.map(m=>mkCheck(m,true)).join("")}</div>`;
  if(bixos.length)divChecks+=`<div style="margin-bottom:6px"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><strong style="font-size:10px;color:#78716c;text-transform:uppercase">Bixos</strong><button type="button" class="btn btn-sm btn-secondary" style="padding:2px 6px;font-size:9px" onclick="toggleDivGroup('bixo')">Todas</button></div>${bixos.map(m=>mkCheck(m,false)).join("")}</div>`;
  if(agregadas.length)divChecks+=`<div><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><strong style="font-size:10px;color:#78716c;text-transform:uppercase">Agregadas</strong><button type="button" class="btn btn-sm btn-secondary" style="padding:2px 6px;font-size:9px" onclick="toggleDivGroup('agregada')">Todas</button></div>${agregadas.map(m=>mkCheck(m,false)).join("")}</div>`;
  sb.from("categorias_presidencia").select("*").order("nome").then(({data})=>{
    const cats=(data||[]).filter(c=>c.nome!=="Acerto");
    const catOpts=cats.map(c=>`<option value="${c.id}">${c.icone} ${c.nome}</option>`).join("");
    abrirModal(editId?"Editar Lançamento":"Novo Lançamento",`
      <div style="display:grid;gap:10px">
        <input type="hidden" id="mLancEditId" value="${editId||""}">
        <div><label>Data</label><input type="date" id="mLancData" value="${new Date().toISOString().split("T")[0]}"></div>
        <div><label>Descrição</label><input type="text" id="mLancDesc" placeholder="Descrição" required></div>
        <div><label>Valor (R$)</label><input type="number" id="mLancValor" step="0.01" placeholder="0.00" required></div>
        <div><label>Categoria</label><select id="mLancCat">${catOpts}</select></div>
        <div><label>Quem pagou</label><select id="mLancQuem">${pessoasOpts}</select></div>
        <div style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:12px;padding:12px;max-height:250px;overflow-y:auto">
          <label style="margin-bottom:8px">Dividir entre</label>
          ${divChecks}
        </div>
        <button class="btn btn-primary" style="width:100%;justify-content:center" onclick="salvarLanc()"><i class="fas fa-save"></i>Salvar</button>
        <hr style="border:none;border-top:1px solid #e7e5e4;margin:4px 0">
        <p style="font-size:11px;font-weight:700;color:#78716c;margin:0"><i class="fas fa-exchange-alt" style="margin-right:4px"></i>Acerto entre pessoas</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label>Deve</label><select id="acertoDeve"><option value="">—</option>${acertoOpts}</select></div>
          <div><label>Recebe</label><select id="acertoRecebe"><option value="">—</option>${acertoOpts}</select></div>
        </div>
        <div><label>Valor (R$)</label><input type="number" id="acertoValor" step="0.01" placeholder="0.00"></div>
        <button class="btn btn-secondary" style="width:100%;justify-content:center" onclick="registrarAcerto()"><i class="fas fa-exchange-alt"></i>Registrar Acerto</button>
      </div>
    `);
    if(editId){sb.from("lancamentos").select("*").eq("id",editId).single().then(({data:l})=>{if(!l)return;document.getElementById("mLancData").value=l.data;document.getElementById("mLancDesc").value=l.descricao;document.getElementById("mLancValor").value=l.valor;if(l.categoria_id)document.getElementById("mLancCat").value=l.categoria_id;});}
  });
}

function toggleDivGroup(perfil){
  const people=allProfiles.filter(p=>p.perfil===perfil);
  const checks=document.querySelectorAll(".divPerson");
  const ids=people.map(p=>p.id);
  const relevant=[...checks].filter(c=>ids.includes(c.value));
  const allChecked=relevant.every(c=>c.checked);
  relevant.forEach(c=>c.checked=!allChecked);
}

async function registrarAcerto(){
  const pid=document.getElementById("presSelect").value;
  if(!pid){alert("Selecione uma presidência.");return;}
  const deveId=document.getElementById("acertoDeve").value;
  const recebeId=document.getElementById("acertoRecebe").value;
  const valor=parseFloat(document.getElementById("acertoValor").value);
  if(!deveId||!recebeId||!valor){alert("Preencha todos os campos.");return;}
  if(deveId===recebeId){alert("Pessoas diferentes.");return;}
  const deveP=allProfiles.find(p=>p.id===deveId);
  const recebeP=allProfiles.find(p=>p.id===recebeId);
  await sb.from("lancamentos").insert({presidencia_id:parseInt(pid),data:new Date().toISOString().split("T")[0],descricao:`Acerto: ${deveP.apelido||deveP.nome} → ${recebeP.apelido||recebeP.nome}`,valor,categoria_id:null,quem_pagou:recebeP.apelido||recebeP.nome,status:"incluido",divisao_custom:{[deveId]:valor,[recebeId]:-valor},created_by:currentProfile.id});
  await audit("Acerto","lancamentos","",{deve:deveId,recebe:recebeId,valor});
  fecharModal();toast("Acerto registrado!");loadPresidencia();
}

async function salvarLanc(){
  const pid=document.getElementById("presSelect").value;
  if(!pid){alert("Selecione uma presidência.");return;}
  const editId=document.getElementById("mLancEditId")?.value;
  const quemSel=document.getElementById("mLancQuem");
  const quemNome=quemSel.options[quemSel.selectedIndex]?quemSel.options[quemSel.selectedIndex].text:"";
  const selectedIds=[...document.querySelectorAll(".divPerson:checked")].map(c=>c.value);
  const obj={
    presidencia_id:parseInt(pid),
    data:document.getElementById("mLancData").value,
    descricao:document.getElementById("mLancDesc").value,
    valor:Number(document.getElementById("mLancValor").value),
    categoria_id:parseInt(document.getElementById("mLancCat").value),
    quem_pagou:quemNome,
    divisao_custom:{pessoas:selectedIds},
    created_by:currentProfile.id
  };
  if(editId){
    await sb.from("lancamentos").update(obj).eq("id",parseInt(editId));
    await audit("Editar lançamento","lancamentos",editId,{descricao:obj.descricao,valor:obj.valor});
    fecharModal();toast("Lançamento atualizado!");
  }else{
    obj.status="pendente";
    const{error}=await sb.from("lancamentos").insert(obj);
    if(error){alert("Erro: "+error.message);return;}
    await audit("Novo lançamento","lancamentos","",{descricao:obj.descricao,valor:obj.valor});
    fecharModal();toast("Lançamento adicionado!");
  }
  loadPresidencia();
}

async function incluirLanc(id,status){
  await sb.from("lancamentos").update({status}).eq("id",id);
  await audit("Alterar status lançamento","lancamentos",id,{status});
  toast("Status atualizado!");loadPresidencia();
}

async function fecharPresidencia(pid){
  if(!confirm("Fechar esta presidência?"))return;
  await sb.from("presidencias").update({status:"fechada"}).eq("id",pid);
  await audit("Fechar presidência","presidencias",pid,{});
  toast("Presidência fechada!");loadPresidencia();
}

async function reabrirPresidencia(pid){
  if(!confirm("Reabrir esta presidência para edição?"))return;
  await sb.from("presidencias").update({status:"aberta"}).eq("id",pid);
  await audit("Reabrir presidência","presidencias",pid,{});
  toast("Presidência reaberta!");loadPresidencia();
}

async function marcarDebPago(id){
  await sb.from("debitos_presidencia").update({status:"pago",data_pagamento:new Date().toISOString(),marcado_por:currentProfile.id}).eq("id",id);
  await audit("Marcar débito pago","debitos_presidencia",id,{});
  toast("Marcado como pago!");loadPresidencia();
}

// ============================================================
// JOIAS
// ============================================================
async function loadJoias(){
  const{data}=await sb.from("joias").select("*,profiles:moradora_id(nome,apelido),joias_pagamentos(*)").order("ano",{ascending:false});
  const tbody=document.getElementById("joiasTbody");
  if(!data||!data.length){tbody.innerHTML='<tr><td colspan="7" style="text-align:center;color:#a8a29e;padding:30px">Nenhuma joia registrada</td></tr>';return;}
  tbody.innerHTML=data.map(j=>{
    const p=j.profiles||{};
    const pagamentos=(j.joias_pagamentos||[]).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    const totalPago=pagamentos.filter(pg=>pg.pago).reduce((s,pg)=>s+parseFloat(pg.valor),0);
    const falta=Math.max(0,parseFloat(j.valor_integral)-totalPago);
    // Build registro entries
    const registros=pagamentos.filter(pg=>pg.pago).map(pg=>{
      const dt=pg.data_pagamento?new Date(pg.data_pagamento).toLocaleDateString("pt-BR"):"—";
      return`<span style="display:inline-block;background:#d1fae5;padding:2px 8px;border-radius:6px;font-size:10px;margin:2px;color:#065f46;font-weight:600">${dt}: ${fmtBRL(pg.valor)}</span>`;
    }).join("");
    const pendentes=pagamentos.filter(pg=>!pg.pago);

    return`<tr>
      <td style="font-weight:700">${j.ano}</td>
      <td><strong>${p.apelido||p.nome||"—"}</strong></td>
      <td class="val-hide" style="font-weight:700">${fmtBRL(j.valor_integral)}</td>
      <td class="val-hide" style="font-weight:700;color:var(--verde)">${fmtBRL(totalPago)}</td>
      <td class="val-hide" style="font-weight:800;color:${falta>0.01?"var(--vermelho)":"var(--verde)"}"> ${falta>0.01?fmtBRL(falta):"✅ Quitada"}</td>
      <td>${registros||'<span style="color:#a8a29e;font-size:11px">Nenhum pagamento</span>'}</td>
      <td style="white-space:nowrap">${falta>0.01?`<button class="btn btn-success btn-sm" onclick="pagarJoia(${j.id})"><i class="fas fa-dollar-sign"></i>Registrar Pagamento</button>`:""}</td>
    </tr>`;
  }).join("");
}

async function pagarJoia(joiaId){
  const{data:joia}=await sb.from("joias").select("*").eq("id",joiaId).single();
  if(!joia)return;
  const{data:pagos}=await sb.from("joias_pagamentos").select("valor").eq("joia_id",joiaId).eq("pago",true);
  const totalPago=(pagos||[]).reduce((s,p)=>s+parseFloat(p.valor),0);
  const falta=parseFloat(joia.valor_integral)-totalPago;

  const tipo=prompt("Tipo de entrada:\n1 = Dinheiro\n2 = Produto doado para a casa\n\nDigite 1 ou 2:","1");
  if(!tipo)return;
  let obs="";
  if(tipo==="2"){
    obs=prompt("Descreva o produto:");
    if(!obs)return;
  }
  const valorStr=prompt(`Valor da entrada?\n\nTotal da joia: ${fmtBRL(joia.valor_integral)}\nJá pago: ${fmtBRL(totalPago)}\nFalta: ${fmtBRL(falta)}`,falta.toFixed(2));
  if(!valorStr)return;
  // Keep exact value as string to avoid rounding
  const valorNum=Number(valorStr.replace(",","."));
  if(isNaN(valorNum)||valorNum<=0){alert("Valor inválido.");return;}

  const dataPag=prompt("Data (DD/MM/AAAA):",new Date().toLocaleDateString("pt-BR"));
  let dataISO=new Date().toISOString().split("T")[0];
  if(dataPag){const pts=dataPag.split("/");if(pts.length===3)dataISO=`${pts[2]}-${pts[1].padStart(2,"0")}-${pts[0].padStart(2,"0")}`;}

  const{error}=await sb.from("joias_pagamentos").insert({joia_id:joiaId,mes:new Date().getMonth()+1,valor:valorNum,pago:true,data_pagamento:dataISO,marcado_por:currentProfile.id});
  if(error){alert("Erro ao salvar: "+error.message);return;}
  const tipoLabel=tipo==="2"?"Produto: "+obs:"Dinheiro";
  await audit("Pagamento joia","joias",joiaId,{tipo:tipoLabel,valor:valorNum,obs,data:dataISO});
  toast(`${fmtBRL(valorNum)} registrado!${obs?" ("+obs+")":""}`);
  loadJoias();
}

async function novaJoia(){
  const moradoras=allProfiles.filter(p=>p.perfil==="moradora");
  const opts=moradoras.map(m=>`<option value="${m.id}">${m.apelido||m.nome}</option>`).join("");
  const{data:cfg}=await sb.from("config").select("salario_minimo").eq("id",1).single();
  const metade=cfg?(parseFloat(cfg.salario_minimo)/2).toFixed(2):"706.00";
  abrirModal("Registrar Joia",`
    <div style="display:grid;gap:10px">
      <div><label>Moradora</label><select id="mJoiaMor">${opts}</select></div>
      <div><label>Ano</label><input type="number" id="mJoiaAno" value="${new Date().getFullYear()}"></div>
      <div><label>Valor Total da Joia (½ salário mínimo)</label><input type="number" id="mJoiaValor" step="0.01" value="${metade}"></div>
      <button class="btn btn-primary" style="width:100%;justify-content:center" onclick="salvarJoia()"><i class="fas fa-save"></i>Salvar</button>
    </div>
  `);
}

async function salvarJoia(){
  const morId=document.getElementById("mJoiaMor").value;
  const ano=parseInt(document.getElementById("mJoiaAno").value);
  const valor=parseFloat(document.getElementById("mJoiaValor").value);
  const{error}=await sb.from("joias").insert({moradora_id:morId,ano,valor_integral:valor,data_transicao:new Date().toISOString().split("T")[0]});
  if(error){alert("Erro: "+error.message);return;}
  await audit("Registrar joia","joias","",{moradora:morId,valor,ano});
  fecharModal();toast(`Joia de ${fmtBRL(valor)} registrada!`);loadJoias();
}

// ============================================================
// ANIVERSÁRIO
// ============================================================
let aniAnoAtual=null;

async function loadAniversario(){
  const isMoradora=currentProfile.perfil==="moradora";
  // Load all aniversario years and render tabs
  const{data:anis}=await sb.from("aniversario").select("ano").order("ano",{ascending:false});
  const thisYear=new Date().getFullYear();
  const anos=(anis||[]).map(a=>a.ano);
  if(!anos.includes(thisYear)&&isMoradora)anos.unshift(thisYear);
  anos.sort((a,b)=>b-a);
  if(!aniAnoAtual)aniAnoAtual=anos[0]||thisYear;
  document.getElementById("aniYearTabs").innerHTML=anos.map(a=>`<button class="btn btn-sm ${a===aniAnoAtual?"btn-primary":"btn-secondary"}" onclick="selectAniAno(${a})">${a}</button>`).join("");
  document.getElementById("aniAno").value=aniAnoAtual;
  // Buttons visibility
  const addBtn=document.getElementById("aniAddContribBtn");if(addBtn)addBtn.style.display=isMoradora?"inline-flex":"none";
  document.getElementById("aniConfigCard").style.display=isMoradora?"block":"none";
  await loadAniversarioData();
}

function selectAniAno(ano){aniAnoAtual=ano;document.getElementById("aniAno").value=ano;document.querySelectorAll("#aniYearTabs button").forEach(b=>{b.className="btn btn-sm "+(parseInt(b.textContent)===ano?"btn-primary":"btn-secondary");});loadAniversarioData();}

async function criarAniAno(){
  const ano=parseInt(prompt("Ano:",new Date().getFullYear()));if(!ano)return;
  const{error}=await sb.from("aniversario").upsert({ano,meta:0},{onConflict:"ano"});
  if(error){alert(error.message);return;}
  aniAnoAtual=ano;toast("Ano "+ano+" criado!");loadAniversario();
}

async function loadAniversarioData(){
  const ano=aniAnoAtual;
  const isMoradora=currentProfile.perfil==="moradora";
  const{data}=await sb.from("aniversario").select("*").eq("ano",ano).maybeSingle();
  if(!data){
    document.getElementById("aniMeta").textContent="—";document.getElementById("aniArrecadado").textContent="—";
    document.getElementById("aniGasto").textContent="—";document.getElementById("aniSaldo").textContent="—";
    document.getElementById("aniBar").style.width="0%";document.getElementById("aniPct").textContent="0%";
    document.getElementById("aniContribTbody").innerHTML='<tr><td colspan="6" style="text-align:center;color:#a8a29e;padding:20px">Crie o aniversário primeiro</td></tr>';
    document.getElementById("aniGastosTbody").innerHTML='<tr><td colspan="4" style="text-align:center;color:#a8a29e;padding:20px">—</td></tr>';
    return;
  }
  // Fill config
  document.getElementById("aniMetaInput").value=data.meta||"";
  document.getElementById("aniOrcamento").value=data.orcamento_url||"";
  document.getElementById("aniMeta").textContent=fmtBRL(data.meta||0);
  // Show orçamento link for everyone
  let orcLink=document.getElementById("aniOrcLink");
  if(!orcLink){orcLink=document.createElement("div");orcLink.id="aniOrcLink";document.getElementById("tab-aniversario").querySelector(".card").before(orcLink);}
  if(data.orcamento_url){orcLink.innerHTML=`<div class="card" style="margin-bottom:14px;border-left:4px solid var(--amber)"><div class="card-body"><a href="${data.orcamento_url}" target="_blank" style="color:var(--bordo);font-weight:700;font-size:13px;text-decoration:none"><i class="fas fa-file-pdf" style="margin-right:6px"></i>Ver Planilha de Orçamento</a></div></div>`;}
  else orcLink.innerHTML="";

  // Contribuições
  const{data:contribs}=await sb.from("aniversario_contribuicoes").select("*,profiles:ex_aluna_id(nome,apelido)").eq("aniversario_id",data.id);
  let arrecadado=parseFloat(data.credito_anterior||0);
  const tbody=document.getElementById("aniContribTbody");
  if(contribs&&contribs.length){
    // Get latest parcela date for each contrib
    const contribIds=contribs.map(c=>c.id);
    const{data:parcelas}=await sb.from("aniversario_parcelas").select("contribuicao_id,data_pagamento").in("contribuicao_id",contribIds).order("data_pagamento",{ascending:false});
    const ultimaData={};
    (parcelas||[]).forEach(p=>{if(!ultimaData[p.contribuicao_id])ultimaData[p.contribuicao_id]=p.data_pagamento;});
    tbody.innerHTML=contribs.map(c=>{
      arrecadado+=parseFloat(c.valor_pago);
      const falta=parseFloat(c.valor_total)-parseFloat(c.valor_pago);
      const badge=c.status==="pago"?"badge-pago":parseFloat(c.valor_pago)>0?"badge-parcial":"badge-pendente";
      const statusTxt=c.status==="pago"?"Pago":parseFloat(c.valor_pago)>0?"Parcial":"Pendente";
      const p=c.profiles||{};
      const dtPag=ultimaData[c.id]?new Date(ultimaData[c.id]).toLocaleDateString("pt-BR"):"—";
      let actions="";
      if(isMoradora){
        if(c.status!=="pago")actions+=`<button class="btn btn-success btn-sm" onclick="pagarAniContrib(${c.id},${parseFloat(c.valor_total)},${parseFloat(c.valor_pago)})"><i class="fas fa-dollar-sign"></i></button> `;
        actions+=`<button class="btn btn-sm btn-secondary" onclick="editAniContrib(${c.id},${parseFloat(c.valor_total)},${parseFloat(c.valor_pago)})"><i class="fas fa-pen"></i></button> `;
        actions+=`<button class="btn btn-sm btn-danger" onclick="delAniContrib(${c.id})"><i class="fas fa-trash"></i></button>`;
      }
      return`<tr><td><strong>${p.apelido||p.nome||"—"}</strong></td><td class="val-hide">${fmtBRL(c.valor_total)}</td><td class="val-hide" style="color:var(--verde)">${fmtBRL(c.valor_pago)}</td><td class="val-hide" style="font-weight:700;color:${falta>0?"var(--vermelho)":"var(--verde)"}">${fmtBRL(falta)}</td><td style="font-size:11px">${dtPag}</td><td><span class="badge ${badge}">${statusTxt}</span></td><td style="white-space:nowrap">${actions}</td></tr>`;
    }).join("");
  }else tbody.innerHTML='<tr><td colspan="6" style="text-align:center;color:#a8a29e;padding:20px">Nenhuma contribuição</td></tr>';
  document.getElementById("aniArrecadado").textContent=fmtBRL(arrecadado);

  // Gastos
  const{data:gastos}=await sb.from("aniversario_gastos").select("*").eq("aniversario_id",data.id).order("data",{ascending:false});
  let totalGasto=0;
  const gtbody=document.getElementById("aniGastosTbody");
  const isGastosVisivel=data.gastos_visivel||false;
  const gastosCard=document.getElementById("aniGastosCard");
  // Exalas only see if gastos_visivel=true
  if(!isMoradora&&!isGastosVisivel){gastosCard.style.display="none";}
  else{gastosCard.style.display="block";}
  // Actions for moradoras
  const gActions=document.getElementById("aniGastosActions");
  if(isMoradora){
    gActions.innerHTML=`<button class="btn btn-sm ${isGastosVisivel?"btn-danger":"btn-success"}" onclick="toggleGastosVisivel(${data.id},${!isGastosVisivel})"><i class="fas fa-${isGastosVisivel?"eye-slash":"eye"}"></i>${isGastosVisivel?"Ocultar p/ Exalas":"Liberar p/ Exalas"}</button><button class="btn btn-primary btn-sm" onclick="addGastoAniversario(${data.id})"><i class="fas fa-plus"></i>Lançar</button>`;
  }else gActions.innerHTML="";

  if(gastos&&gastos.length){
    gtbody.innerHTML=gastos.map(g=>{
      totalGasto+=parseFloat(g.valor);
      return`<tr><td>${new Date(g.data).toLocaleDateString("pt-BR")}</td><td>${g.descricao}</td><td class="val-hide" style="font-weight:700;color:var(--vermelho)">${fmtBRL(g.valor)}</td><td>${isMoradora?`<button class="btn btn-sm btn-secondary" onclick="editGasto(${g.id},'${g.descricao.replace(/'/g,"\\'")}',${g.valor})"><i class="fas fa-pen"></i></button> <button class="btn btn-sm btn-danger" onclick="delGasto(${g.id})"><i class="fas fa-trash"></i></button>`:""}</td></tr>`;
    }).join("");
  }else gtbody.innerHTML='<tr><td colspan="4" style="text-align:center;color:#a8a29e;padding:20px">Nenhum gasto registrado</td></tr>';
  document.getElementById("aniGasto").textContent=fmtBRL(totalGasto);

  // Saldo
  const saldo=arrecadado-totalGasto;
  const saldoEl=document.getElementById("aniSaldo");
  saldoEl.textContent=(saldo>=0?"+":"−")+" "+fmtBRL(Math.abs(saldo));
  saldoEl.style.color=saldo>=0?"var(--verde)":"var(--vermelho)";

  // Progresso
  const meta=parseFloat(data.meta)||0;
  const pct=meta>0?Math.min(100,Math.round(arrecadado/meta*100)):0;
  document.getElementById("aniBar").style.width=pct+"%";
  document.getElementById("aniPct").textContent=pct+"%";
}

async function salvarAniversario(){
  const ano=aniAnoAtual||parseInt(document.getElementById("aniAno").value);
  const meta=parseFloat(document.getElementById("aniMetaInput").value)||0;
  const orcamento=document.getElementById("aniOrcamento").value;
  const{error}=await sb.from("aniversario").upsert({ano,meta,orcamento_url:orcamento},{onConflict:"ano"});
  if(error){alert(error.message);return;}
  await audit("Salvar aniversário","aniversario","",{ano,meta});
  toast("Salvo!");loadAniversarioData();
}

function abrirRegistrarContrib(){
  const exalunas=allProfiles.filter(p=>p.perfil==="ex-aluna");
  const opts=exalunas.map(e=>`<option value="${e.id}">${e.apelido||e.nome}</option>`).join("");
  abrirModal("Registrar Contribuição",`<div style="display:grid;gap:12px">
    <div><label>Ex-Aluna</label><select id="mAniExala">${opts}</select></div>
    <div><label>Valor Total (R$)</label><input type="number" id="mAniValorTotal" step="0.01" placeholder="0.00"></div>
    <div><label>Valor já Pago (R$)</label><input type="number" id="mAniValorPago" step="0.01" value="0"></div>
    <button class="btn btn-primary" style="width:100%;justify-content:center" onclick="salvarContribAniversario()"><i class="fas fa-save"></i>Registrar</button>
  </div>`);
}

async function salvarContribAniversario(){
  const ano=aniAnoAtual;
  const{data:ani}=await sb.from("aniversario").select("id").eq("ano",ano).maybeSingle();
  if(!ani){alert("Crie o aniversário primeiro.");return;}
  const exId=document.getElementById("mAniExala").value;
  const vt=parseFloat(document.getElementById("mAniValorTotal").value)||0;
  const vp=parseFloat(document.getElementById("mAniValorPago").value)||0;
  if(!exId||!vt){alert("Preencha os campos.");return;}
  const status=vp>=vt?"pago":vp>0?"parcial":"pendente";
  const{error}=await sb.from("aniversario_contribuicoes").insert({aniversario_id:ani.id,ex_aluna_id:exId,valor_total:vt,valor_pago:vp,status});
  if(error){alert(error.message);return;}
  await audit("Contribuição aniversário","aniversario_contribuicoes","",{exala:exId,vt,vp});
  fecharModal();toast("Registrada!");loadAniversarioData();
}

async function pagarAniContrib(id,vTotal,vPagoAtual){
  const falta=Math.max(0,vTotal-vPagoAtual);
  const v=prompt(`Valor pago?\nTotal: ${fmtBRL(vTotal)}\nPago: ${fmtBRL(vPagoAtual)}\nFalta: ${fmtBRL(falta)}`,falta.toFixed(2));
  if(!v)return;const val=parseFloat(v);if(isNaN(val)||val<=0)return;
  const dataPag=prompt("Data do pagamento (DD/MM/AAAA):",new Date().toLocaleDateString("pt-BR"));
  let dataISO=new Date().toISOString().split("T")[0];
  if(dataPag){const p=dataPag.split("/");if(p.length===3)dataISO=`${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`;}
  const nP=vPagoAtual+val;const st=nP>=vTotal-0.01?"pago":"parcial";
  await sb.from("aniversario_contribuicoes").update({valor_pago:nP,status:st}).eq("id",id);
  await sb.from("aniversario_parcelas").insert({contribuicao_id:id,valor:val,pago:true,data_pagamento:dataISO,marcado_por:currentProfile.id});
  await audit("Pag. aniversário","aniversario_contribuicoes",id,{valor:val,data:dataISO});
  toast(st==="pago"?"Quitado!":`Pago ${fmtBRL(val)}`);
  loadAniversarioData();
}

function editAniContrib(id,vTotal,vPago){
  abrirModal("Editar Contribuição",`<div style="display:grid;gap:10px">
    <div><label>Valor Total (R$)</label><input type="number" id="mAniEditVT" step="0.01" value="${vTotal}"></div>
    <div><label>Valor Pago (R$)</label><input type="number" id="mAniEditVP" step="0.01" value="${vPago}"></div>
    <button class="btn btn-primary" style="width:100%;justify-content:center" onclick="salvarEditContrib(${id})"><i class="fas fa-save"></i>Salvar</button>
  </div>`);
}

async function salvarEditContrib(id){
  const vt=parseFloat(document.getElementById("mAniEditVT").value)||0;
  const vp=parseFloat(document.getElementById("mAniEditVP").value)||0;
  const st=vp>=vt-0.01?"pago":vp>0?"parcial":"pendente";
  await sb.from("aniversario_contribuicoes").update({valor_total:vt,valor_pago:vp,status:st}).eq("id",id);
  await audit("Edit contribuição","aniversario_contribuicoes",id,{vt,vp});
  fecharModal();toast("Atualizada!");loadAniversarioData();
}

async function delAniContrib(id){
  if(!confirm("Excluir esta contribuição?"))return;
  await sb.from("aniversario_parcelas").delete().eq("contribuicao_id",id);
  await sb.from("aniversario_contribuicoes").delete().eq("id",id);
  await audit("Excluir contribuição","aniversario_contribuicoes",id,{});
  toast("Excluída!");loadAniversarioData();
}

async function toggleGastosVisivel(aniId,visivel){
  await sb.from("aniversario").update({gastos_visivel:visivel}).eq("id",aniId);
  await audit(visivel?"Liberar gastos":"Ocultar gastos","aniversario",aniId,{});
  toast(visivel?"Gastos visíveis para ex-alunas!":"Gastos ocultos.");
  loadAniversarioData();
}

function addGastoAniversario(aniId){
  abrirModal("Lançar Gasto",`<div style="display:grid;gap:10px">
    <div><label>Descrição</label><input type="text" id="mGastoDesc" placeholder="O que foi gasto"></div>
    <div><label>Valor (R$)</label><input type="number" id="mGastoValor" step="0.01" placeholder="0.00"></div>
    <div><label>Data</label><input type="date" id="mGastoData" value="${new Date().toISOString().split("T")[0]}"></div>
    <button class="btn btn-primary" style="width:100%;justify-content:center" onclick="salvarGasto(${aniId})"><i class="fas fa-save"></i>Salvar</button>
  </div>`);
}

async function salvarGasto(aniId){
  const desc=document.getElementById("mGastoDesc").value.trim();
  const val=parseFloat(document.getElementById("mGastoValor").value)||0;
  const data=document.getElementById("mGastoData").value;
  if(!desc||!val){alert("Preencha.");return;}
  await sb.from("aniversario_gastos").insert({aniversario_id:aniId,descricao:desc,valor:val,data,created_by:currentProfile.id});
  await audit("Gasto aniversário","aniversario_gastos","",{desc,val});
  fecharModal();toast("Gasto lançado!");loadAniversarioData();
  // Check if saldo became positive → carry credit to next year
  await checkCreditoAniversario(aniId);
}

function editGasto(id,desc,val){
  abrirModal("Editar Gasto",`<div style="display:grid;gap:10px">
    <div><label>Descrição</label><input type="text" id="mGastoDescE" value="${desc}"></div>
    <div><label>Valor (R$)</label><input type="number" id="mGastoValorE" step="0.01" value="${val}"></div>
    <button class="btn btn-primary" style="width:100%;justify-content:center" onclick="salvarGastoEdit(${id})"><i class="fas fa-save"></i>Salvar</button>
  </div>`);
}

async function salvarGastoEdit(id){
  const desc=document.getElementById("mGastoDescE").value.trim();
  const val=parseFloat(document.getElementById("mGastoValorE").value)||0;
  await sb.from("aniversario_gastos").update({descricao:desc,valor:val}).eq("id",id);
  await audit("Edit gasto","aniversario_gastos",id,{desc,val});
  fecharModal();toast("Atualizado!");loadAniversarioData();
}

async function delGasto(id){
  if(!confirm("Remover?"))return;
  await sb.from("aniversario_gastos").delete().eq("id",id);
  toast("Removido!");loadAniversarioData();
}

async function checkCreditoAniversario(aniId){
  // Get current year's balance
  const{data:ani}=await sb.from("aniversario").select("*").eq("id",aniId).single();
  const{data:contribs}=await sb.from("aniversario_contribuicoes").select("valor_pago").eq("aniversario_id",aniId);
  const{data:gastos}=await sb.from("aniversario_gastos").select("valor").eq("aniversario_id",aniId);
  const arrecadado=parseFloat(ani.credito_anterior||0)+(contribs||[]).reduce((s,c)=>s+parseFloat(c.valor_pago),0);
  const gasto=(gastos||[]).reduce((s,g)=>s+parseFloat(g.valor),0);
  const saldo=arrecadado-gasto;
  if(saldo>0){
    // Create or update next year with credit
    const nextAno=ani.ano+1;
    const{data:next}=await sb.from("aniversario").select("id").eq("ano",nextAno).maybeSingle();
    if(next)await sb.from("aniversario").update({credito_anterior:saldo}).eq("id",next.id);
    else await sb.from("aniversario").insert({ano:nextAno,meta:0,credito_anterior:saldo});
  }
}

// ============================================================
// MEI
// ============================================================
let meiAnoAtual=null;

async function loadMeiSetup(){
  // Load all MEI years and render tabs
  const{data:meis}=await sb.from("mei").select("ano").order("ano",{ascending:false});
  const tabsDiv=document.getElementById("meiYearTabs");
  const thisYear=new Date().getFullYear();
  const anos=(meis||[]).map(m=>m.ano);
  if(!anos.includes(thisYear))anos.unshift(thisYear);
  anos.sort((a,b)=>b-a);
  
  tabsDiv.innerHTML=anos.map(a=>`<button class="btn btn-sm ${a===meiAnoAtual?"btn-primary":"btn-secondary"}" onclick="selectMeiAno(${a})">${a}</button>`).join("");
  
  if(!meiAnoAtual)meiAnoAtual=anos[0]||thisYear;
  document.getElementById("meiAno").value=meiAnoAtual;
  document.getElementById("meiAnoLabel").textContent="— "+meiAnoAtual;
  
  loadMei();
}

function selectMeiAno(ano){
  meiAnoAtual=ano;
  document.getElementById("meiAno").value=ano;
  document.getElementById("meiAnoLabel").textContent="— "+ano;
  // Update tab buttons
  document.querySelectorAll("#meiYearTabs button").forEach(b=>{
    b.className="btn btn-sm "+(parseInt(b.textContent)===ano?"btn-primary":"btn-secondary");
  });
  loadMei();
}

async function criarMeiAno(){
  const ano=parseInt(prompt("Ano para criar MEI:",new Date().getFullYear()));
  if(!ano)return;
  const{data:existing}=await sb.from("mei").select("id").eq("ano",ano).maybeSingle();
  if(existing){toast("MEI desse ano já existe.");selectMeiAno(ano);return;}
  const valor=parseFloat(prompt("Valor total do MEI para "+ano+":","0"))||0;
  const{data:created,error}=await sb.from("mei").insert({ano,valor_total:valor}).select().single();
  if(error){alert("Erro: "+error.message);return;}
  // Auto-add all ex-alunas
  const exalunas=allProfiles.filter(p=>p.perfil==="ex-aluna");
  if(exalunas.length){
    await sb.from("mei_participantes").upsert(
      exalunas.map(e=>({mei_id:created.id,ex_aluna_id:e.id,opt_in:false,valor_individual:0,valor_pago:0})),
      {onConflict:"mei_id,ex_aluna_id"}
    );
  }
  await audit("Criar MEI","mei",created.id,{ano,valor});
  toast("MEI "+ano+" criado!");
  meiAnoAtual=ano;
  loadMeiSetup();
}

async function loadMei(){
  const ano=parseInt(document.getElementById("meiAno").value)||meiAnoAtual;
  const{data:mei,error:mErr}=await sb.from("mei").select("*").eq("ano",ano).maybeSingle();
  if(!mei||mErr){
    document.getElementById("meiValor").value="";
    document.getElementById("meiParticipantes").textContent="0";
    document.getElementById("meiIndividual").textContent="—";
    document.getElementById("meiTbody").innerHTML='<tr><td colspan="7" style="text-align:center;color:#a8a29e;padding:20px">MEI não configurado para '+ano+'. Clique "Novo Ano" ou defina o valor.</td></tr>';
    return;
  }
  document.getElementById("meiValor").value=mei.valor_total;
  const{data:parts}=await sb.from("mei_participantes").select("*,profiles:ex_aluna_id(nome,apelido,perfil)").eq("mei_id",mei.id);
  const confirmed=(parts||[]).filter(p=>p.opt_in);
  const valorTotal=parseFloat(mei.valor_total)||0;
  const individual=confirmed.length>0?(valorTotal/confirmed.length):0;
  document.getElementById("meiParticipantes").textContent=confirmed.length;
  document.getElementById("meiIndividual").textContent=confirmed.length>0?fmtBRL(individual):"—";
  const isMoradora=currentProfile.perfil==="moradora";
  const isExala=currentProfile.perfil==="ex-aluna";
  const tbody=document.getElementById("meiTbody");
  if(parts&&parts.length){
    tbody.innerHTML=parts.map(p=>{
      const pr=p.profiles||{};
      const isMe=p.ex_aluna_id===currentProfile.id;
      const meuValor=p.opt_in?individual:0;
      const pago=parseFloat(p.valor_pago||0);
      const falta=p.opt_in?Math.max(0,meuValor-pago):0;
      const statusCalc=!p.opt_in?"fora":falta<=0.01?"pago":pago>0?"parcial":"pendente";
      const badge=statusCalc==="pago"?"badge-pago":statusCalc==="parcial"?"badge-parcial":statusCalc==="pendente"?"badge-pendente":"";
      const statusLabel=statusCalc==="fora"?"Fora":statusCalc.charAt(0).toUpperCase()+statusCalc.slice(1);
      
      // Participation toggle
      let partCol="";
      if(p.opt_in){
        partCol=`<span class="dot dot-green"></span> <span style="font-size:11px">Participa</span>`;
        if(isMe)partCol+=` <button class="btn btn-sm btn-danger" onclick="meiOptOut(${p.id})" title="Sair" style="margin-left:4px"><i class="fas fa-sign-out-alt"></i></button>`;
        if(isMoradora)partCol+=` <button class="btn btn-sm btn-secondary" onclick="meiRemover(${p.id})" title="Remover" style="margin-left:4px"><i class="fas fa-user-minus"></i></button>`;
      }else{
        partCol=`<span class="dot dot-red"></span> <span style="font-size:11px">Fora</span>`;
        if(isMe)partCol+=` <button class="btn btn-sm btn-success" onclick="meiOptIn(${p.id})" style="margin-left:4px">Entrar</button>`;
        if(isMoradora)partCol+=` <button class="btn btn-sm btn-success" onclick="meiOptIn(${p.id})" title="Incluir" style="margin-left:4px"><i class="fas fa-user-plus"></i>Incluir</button>`;
      }
      
      let actions="";
      if(isMoradora&&p.opt_in&&statusCalc!=="pago"){
        actions=`<button class="btn btn-primary btn-sm" onclick="meiPagar(${p.id},${individual})"><i class="fas fa-dollar-sign"></i>Pagar</button>`;
      }
      
      return`<tr>
        <td><strong>${pr.apelido||pr.nome||"—"}</strong></td>
        <td>${partCol}</td>
        <td class="val-hide" style="font-weight:600">${p.opt_in?fmtBRL(individual):"—"}</td>
        <td class="val-hide" style="color:var(--verde)">${p.opt_in?fmtBRL(pago):"—"}</td>
        <td class="val-hide" style="color:${falta>0?"var(--vermelho)":"var(--verde)"};font-weight:700">${p.opt_in?fmtBRL(falta):"—"}</td>
        <td>${statusCalc!=="fora"?`<span class="badge ${badge}">${statusLabel}</span>`:'<span style="color:#a8a29e;font-size:11px">—</span>'}</td>
        <td>${actions}</td>
      </tr>`;
    }).join("");
  }else tbody.innerHTML='<tr><td colspan="7" style="text-align:center;color:#a8a29e;padding:20px">Salve o valor do MEI para listar as ex-alunas.</td></tr>';
}

async function salvarMei(){
  const ano=parseInt(document.getElementById("meiAno").value)||meiAnoAtual;
  const valor=parseFloat(document.getElementById("meiValor").value)||0;
  if(!valor){alert("Informe o valor total do MEI.");return;}
  const{data:existing}=await sb.from("mei").select("id").eq("ano",ano).maybeSingle();
  let meiId;
  if(existing){
    await sb.from("mei").update({valor_total:valor,updated_at:new Date().toISOString()}).eq("id",existing.id);
    meiId=existing.id;
  }else{
    const{data:created,error}=await sb.from("mei").insert({ano,valor_total:valor}).select().single();
    if(error){alert("Erro: "+error.message);return;}
    meiId=created.id;
  }
  // Always ensure ALL exalas are listed
  const exalunas=allProfiles.filter(p=>p.perfil==="ex-aluna");
  for(const ex of exalunas){
    const{data:ep}=await sb.from("mei_participantes").select("id").eq("mei_id",meiId).eq("ex_aluna_id",ex.id).maybeSingle();
    if(!ep)await sb.from("mei_participantes").insert({mei_id:meiId,ex_aluna_id:ex.id,opt_in:false,valor_individual:0,valor_pago:0});
  }
  await recalcMeiIndividual(meiId,valor);
  await audit("Salvar MEI","mei",meiId,{ano,valor});
  toast("MEI salvo! Valores recalculados.");loadMei();
}

async function recalcMeiIndividual(meiId,valorTotal){
  if(!valorTotal){
    const{data:mei}=await sb.from("mei").select("valor_total").eq("id",meiId).single();
    valorTotal=mei?parseFloat(mei.valor_total):0;
  }
  const{data:parts}=await sb.from("mei_participantes").select("id,opt_in").eq("mei_id",meiId);
  const confirmed=(parts||[]).filter(p=>p.opt_in);
  const individual=confirmed.length>0?(valorTotal/confirmed.length):0;
  for(const p of (parts||[])){
    await sb.from("mei_participantes").update({valor_individual:p.opt_in?individual:0}).eq("id",p.id);
  }
}

async function meiOptIn(partId){
  const{data:part}=await sb.from("mei_participantes").select("mei_id").eq("id",partId).single();
  await sb.from("mei_participantes").update({opt_in:true}).eq("id",partId);
  await recalcMeiIndividual(part.mei_id);
  await audit("Opt-in MEI","mei_participantes",partId,{});
  toast("Participação confirmada! Valores recalculados.");loadMei();
}

async function meiOptOut(partId){
  if(!confirm("Sair do MEI deste ano?"))return;
  const{data:part}=await sb.from("mei_participantes").select("mei_id").eq("id",partId).single();
  await sb.from("mei_participantes").update({opt_in:false,valor_individual:0}).eq("id",partId);
  await recalcMeiIndividual(part.mei_id);
  await audit("Opt-out MEI","mei_participantes",partId,{});
  toast("Saída registrada! Valores recalculados.");loadMei();
}

async function meiRemover(partId){
  if(!confirm("Remover esta ex-aluna do MEI?"))return;
  const{data:part}=await sb.from("mei_participantes").select("mei_id").eq("id",partId).single();
  await sb.from("mei_participantes").update({opt_in:false,valor_individual:0}).eq("id",partId);
  await recalcMeiIndividual(part.mei_id);
  await audit("Remover do MEI","mei_participantes",partId,{});
  toast("Removida! Valores recalculados.");loadMei();
}

async function meiAdicionarExala(){
  const ano=parseInt(document.getElementById("meiAno").value)||meiAnoAtual;
  const{data:mei}=await sb.from("mei").select("id").eq("ano",ano).maybeSingle();
  if(!mei){alert("Salve o MEI deste ano primeiro.");return;}
  // Get exalunas not yet in this MEI
  const{data:existentes}=await sb.from("mei_participantes").select("ex_aluna_id").eq("mei_id",mei.id);
  const idsExistentes=(existentes||[]).map(e=>e.ex_aluna_id);
  const disponiveis=allProfiles.filter(p=>p.perfil==="ex-aluna"&&!idsExistentes.includes(p.id));
  if(!disponiveis.length){
    // All already added, just show option to re-include someone
    toast("Todas as ex-alunas já estão cadastradas neste MEI.");return;
  }
  const opts=disponiveis.map(e=>`<option value="${e.id}">${e.apelido||e.nome}</option>`).join("");
  abrirModal("Adicionar Ex-Aluna ao MEI "+ano,`
    <div style="display:grid;gap:12px">
      <div><label>Ex-Aluna</label><select id="mMeiExala">${opts}</select></div>
      <div><label>Já participando?</label><select id="mMeiOptIn"><option value="true">Sim, incluir como participante</option><option value="false">Não, apenas cadastrar</option></select></div>
      <button class="btn btn-primary" style="width:100%;justify-content:center" onclick="salvarMeiExala(${mei.id})"><i class="fas fa-save"></i>Adicionar</button>
    </div>
  `);
}

async function salvarMeiExala(meiId){
  const exId=document.getElementById("mMeiExala").value;
  const optIn=document.getElementById("mMeiOptIn").value==="true";
  const{error}=await sb.from("mei_participantes").insert({mei_id:meiId,ex_aluna_id:exId,opt_in:optIn,valor_individual:0,valor_pago:0});
  if(error){alert("Erro: "+error.message);return;}
  if(optIn)await recalcMeiIndividual(meiId);
  await audit("Adicionar ex-aluna MEI","mei_participantes","",{exala:exId,optIn});
  fecharModal();toast("Ex-aluna adicionada!");loadMei();
}

async function meiPagar(partId,valorIndividual){
  const{data:p}=await sb.from("mei_participantes").select("*").eq("id",partId).single();
  const pago=parseFloat(p.valor_pago||0);
  const falta=Math.max(0,valorIndividual-pago);
  const valStr=prompt(`Valor a pagar?\n\nCota: ${fmtBRL(valorIndividual)}\nJá pago: ${fmtBRL(pago)}\nFalta: ${fmtBRL(falta)}`,falta.toFixed(2));
  if(!valStr)return;
  const val=parseFloat(valStr);
  if(isNaN(val)||val<=0){alert("Valor inválido.");return;}
  const novoPago=pago+val;
  const status=novoPago>=valorIndividual-0.01?"pago":"parcial";
  await sb.from("mei_participantes").update({valor_pago:novoPago,status}).eq("id",partId);
  await sb.from("mei_parcelas").insert({participante_id:partId,valor:val,pago:true,data_pagamento:new Date().toISOString().split("T")[0],marcado_por:currentProfile.id});
  await audit("Pagamento MEI","mei_participantes",partId,{valor:val,novo_total_pago:novoPago});
  if(status==="pago")toast("MEI quitado!");else toast(`Pagamento de ${fmtBRL(val)} registrado! Falta: ${fmtBRL(Math.max(0,valorIndividual-novoPago))}`);
  loadMei();
}

// ============================================================
// CAMISAS
// ============================================================
function formatSizeLabel(key){
  if(key.startsWith("af_"))return"👚 Fem. "+key.slice(3).replace(/_/g," ");
  if(key.startsWith("am_"))return"👕 Masc. "+key.slice(3).replace(/_/g," ");
  if(key.startsWith("inf_"))return"👶 Inf. "+key.slice(4).replace(/_/g," ");
  return key;
}

let camAnoAtual=null;

async function loadCamisas(){
  try{
    // Build year tabs from existing pedidos + configs
    const{data:pedAnos}=await sb.from("camisas_pedidos").select("ano");
    const{data:cfgAnos}=await sb.from("camisas_config").select("ano");
    const thisYear=new Date().getFullYear();
    const anos=[...new Set([thisYear,...(pedAnos||[]).map(p=>p.ano),...(cfgAnos||[]).map(c=>c.ano)])].sort((a,b)=>b-a);
    if(!camAnoAtual)camAnoAtual=anos[0]||thisYear;
    document.getElementById("camYearTabs").innerHTML=anos.map(a=>`<button class="btn btn-sm ${a===camAnoAtual?"btn-primary":"btn-secondary"}" onclick="selectCamAno(${a})">${a}</button>`).join("");
    await loadCamisasData();
  }catch(e){console.error("Erro camisas:",e);}
}

function selectCamAno(ano){
  camAnoAtual=ano;
  document.querySelectorAll("#camYearTabs button").forEach(b=>{b.className="btn btn-sm "+(parseInt(b.textContent)===ano?"btn-primary":"btn-secondary");});
  loadCamisasData();
}

async function loadCamisasData(){
  await loadCamisaPrecoInfo();
  buildCamisaForm();
  await checkCamisaLock();
  await loadMeuPedidoResumo();
  await loadCamisasTodos();
  if(currentProfile.perfil==="moradora")await loadCamisasGestao();
}

async function loadCamisaPrecoInfo(){
  const ano=camAnoAtual;
  const{data:cfg}=await sb.from("camisas_config").select("*").eq("ano",ano).maybeSingle();
  const el=document.getElementById("camPrecoInfo");
  if(!cfg||!cfg.valor_real_unitario){el.textContent="Preço ainda não definido";return;}
  const isExala=currentProfile.perfil==="ex-aluna";
  if(isExala){
    el.innerHTML=cfg.publicado?`<i class="fas fa-tag" style="color:var(--bordo);margin-right:6px"></i>Preço por camisa: <strong style="color:var(--bordo)">${fmtBRL(cfg.preco_exaluna||0)}</strong>`:'<i class="fas fa-clock" style="color:var(--amber);margin-right:6px"></i>Preço ainda não publicado';
  }else{
    el.innerHTML=`<i class="fas fa-tag" style="color:var(--bordo);margin-right:6px"></i>Valor real unitário: <strong>${fmtBRL(cfg.valor_real_unitario)}</strong> · Preço Ex-Aluna: <strong style="color:var(--bordo)">${fmtBRL(cfg.preco_exaluna||0)}</strong>`;
  }
}

async function checkCamisaLock(){
  const isExala=currentProfile.perfil==="ex-aluna";
  if(!isExala){document.getElementById("camLockBanner").style.display="none";document.getElementById("camPedidoCard").style.display="block";return;}
  const{data}=await sb.from("camisas_config").select("publicado").eq("ano",camAnoAtual).maybeSingle();
  const aberto=data&&data.publicado;
  document.getElementById("camLockBanner").style.display=aberto?"none":"block";
  document.getElementById("camPedidoCard").style.display=aberto?"block":"none";
}

async function togglePedidoExala(abrir){
  const ano=camAnoAtual;
  const{data:ex}=await sb.from("camisas_config").select("id").eq("ano",ano).maybeSingle();
  if(ex)await sb.from("camisas_config").update({publicado:abrir,updated_at:new Date().toISOString()}).eq("id",ex.id);
  else await sb.from("camisas_config").insert({ano,publicado:abrir,valor_real_unitario:0});
  await audit(abrir?"Liberar pedidos":"Fechar pedidos","camisas_config","",{ano});
  toast(abrir?"Pedidos liberados!":"Pedidos fechados!");
}

async function meiSolicitarSaida(){
  if(!confirm("Deseja solicitar saída do MEI?"))return;
  const uid=currentProfile.id;const thisYear=new Date().getFullYear();
  const{data:mei}=await sb.from("mei").select("id,valor_total").eq("ano",thisYear).maybeSingle();
  if(!mei){toast("MEI não encontrado.");return;}
  await sb.from("mei_participantes").update({opt_in:false,valor_individual:0}).eq("mei_id",mei.id).eq("ex_aluna_id",uid);
  await recalcMeiIndividual(mei.id,parseFloat(mei.valor_total));
  await audit("Saída MEI","mei_participantes","",{ano:thisYear});
  toast("Saída registrada!");loadPainel();
}

function buildCamisaForm(){
  const cats=[
    {label:"👚 Adulto Feminino",prefix:"af",sizes:["P","M","G","GG","XG"]},
    {label:"👕 Adulto Masculino",prefix:"am",sizes:["P","M","G","GG","XG"]},
    {label:"👶 Infantil",prefix:"inf",sizes:["1_ano","2_anos","4_anos","6_anos","8_anos","10_anos","12_anos","14_anos"]}
  ];
  let html="";
  cats.forEach(cat=>{
    html+=`<div style="margin-bottom:16px"><h4 style="font-size:13px;font-weight:700;margin:0 0 8px">${cat.label}</h4><div style="display:flex;flex-wrap:wrap;gap:8px">`;
    cat.sizes.forEach(s=>{
      const key=cat.prefix+"_"+s;
      html+=`<div style="text-align:center;min-width:60px"><label style="font-size:10px;margin-bottom:2px">${s.replace(/_/g," ")}</label><input type="number" min="0" value="0" data-cam-size="${key}" class="cam-qty-input" style="width:60px;text-align:center;padding:6px 4px"></div>`;
    });
    html+=`</div></div>`;
  });
  document.getElementById("camPedidoForm").innerHTML=html;
}

async function loadMeuPedidoResumo(){
  const ano=camAnoAtual;
  const{data:pedidos}=await sb.from("camisas_pedidos").select("*").eq("user_id",currentProfile.id).eq("ano",ano).order("created_at",{ascending:false});
  const el=document.getElementById("camMeuPedidoResumo");
  const delBtn=document.getElementById("camDeleteMeuBtn");
  if(delBtn)delBtn.style.display="none";// Hide header delete - each pedido has its own
  if(!pedidos||!pedidos.length){
    el.innerHTML='<p style="color:#a8a29e;font-size:13px;text-align:center;padding:20px">Nenhum pedido feito. Use a aba "Novo Pedido".</p>';
    return;
  }
  let html="";
  pedidos.forEach(pedido=>{
    const det=pedido.tamanhos_detalhes||{};
    const vT=parseFloat(pedido.valor_total)||0,vP=parseFloat(pedido.valor_pago||0),vF=Math.max(0,vT-vP);
    const statusLabel=(pedido.status||"").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
    const badge=vF<=0.01&&vT>0?"badge-pago":vP>0?"badge-parcial":"badge-pendente";
    html+=`<div style="border:1px solid #e7e5e4;border-radius:12px;padding:14px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <strong style="font-size:14px">Pedido ${pedido.ano} — ${pedido.total_camisas} camisa(s)</strong>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="badge ${badge}" style="font-size:11px;padding:4px 10px">${statusLabel}</span>
          <button class="btn btn-danger btn-sm" onclick="excluirMeuPedido(${pedido.id})" title="Excluir"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
    html+=`<table class="tbl"><thead><tr><th>Item</th><th style="text-align:center">Qtd</th></tr></thead><tbody>`;
    Object.entries(det).forEach(([key,qty])=>{html+=`<tr><td>${formatSizeLabel(key)}</td><td style="text-align:center;font-weight:700">${qty}</td></tr>`;});
    html+=`</tbody></table>`;
    html+=`<div style="margin-top:10px;padding:10px;background:#fafaf9;border-radius:8px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:12px">
      <div>Total: <strong class="val-hide">${fmtBRL(vT)}</strong></div>
      <div>Pago: <strong class="val-hide" style="color:var(--verde)">${fmtBRL(vP)}</strong></div>
      <div>Falta: <strong class="val-hide" style="color:${vF>0.01?"var(--vermelho)":"var(--verde)"}">${fmtBRL(vF)}</strong></div>
    </div></div>`;
  });
  el.innerHTML=html;
}

async function salvarPedidoCamisa(){
  const ano=camAnoAtual;
  const tamanhos={};let total=0;
  document.querySelectorAll(".cam-qty-input").forEach(inp=>{
    const k=inp.dataset.camSize,q=parseInt(inp.value)||0;
    if(q>0){tamanhos[k]=q;total+=q;}
  });
  if(total===0){alert("Informe pelo menos 1 camisa.");return;}
  const isExala=currentProfile.perfil==="ex-aluna";
  const{data:cfg}=await sb.from("camisas_config").select("*").eq("ano",ano).maybeSingle();
  let vu=0;if(cfg)vu=isExala?parseFloat(cfg.preco_exaluna||cfg.valor_real_unitario||0):parseFloat(cfg.valor_real_unitario||0);
  const vt=total*vu;
  // Always create NEW pedido (allows multiple)
  const{error}=await sb.from("camisas_pedidos").insert({user_id:currentProfile.id,ano,total_camisas:total,valor_total:vt,tamanhos_detalhes:tamanhos,status:"aguardando"});
  if(error){
    // If unique constraint, update existing instead
    if(error.code==="23505"){
      const{data:ex}=await sb.from("camisas_pedidos").select("id").eq("user_id",currentProfile.id).eq("ano",ano).maybeSingle();
      if(ex)await sb.from("camisas_pedidos").update({total_camisas:total,valor_total:vt,tamanhos_detalhes:tamanhos,status:"aguardando"}).eq("id",ex.id);
    }else{alert(error.message);return;}
  }
  await audit("Pedido camisa","camisas_pedidos","",{total,vt});
  document.querySelectorAll(".cam-qty-input").forEach(inp=>inp.value="0");
  toast(`Pedido salvo! ${total} camisa(s)${vu>0?" — "+fmtBRL(vt):""}`);
  await loadMeuPedidoResumo();loadCamisasTodos();
}

async function excluirMeuPedido(pedidoId){
  if(!confirm("Excluir este pedido?"))return;
  if(pedidoId)await sb.from("camisas_pedidos").delete().eq("id",pedidoId);
  else await sb.from("camisas_pedidos").delete().eq("user_id",currentProfile.id).eq("ano",camAnoAtual);
  await audit("Excluir pedido","camisas_pedidos",pedidoId||"","");
  toast("Pedido excluído!");await loadMeuPedidoResumo();loadCamisasTodos();
}

async function loadCamisasTodos(){
  const ano=camAnoAtual;
  const{data}=await sb.from("camisas_pedidos").select("*,profiles:user_id(nome,apelido,perfil)").eq("ano",ano).order("created_at",{ascending:false});
  const{data:extras}=await sb.from("camisas_extras").select("*").eq("ano",ano);
  const tbody=document.getElementById("camTodosTbody");
  const isMor=currentProfile.perfil==="moradora";

  // Consolidate all sizes
  const totaisPorTam={};
  let totalGeral=0;

  let rows="";
  // Pedidos
  if(data&&data.length){
    data.forEach(d=>{
      const p=d.profiles||{};
      const vT=parseFloat(d.valor_total)||0,vP=parseFloat(d.valor_pago||0),vF=Math.max(0,vT-vP);
      const sc=vT<=0?"aguardando":vF<=0.01?"pago":vP>0?"parcial":d.status==="confirmado"?"confirmado":"aguardando";
      const badge=sc==="pago"?"badge-pago":sc==="parcial"?"badge-parcial":sc==="confirmado"?"badge-parcial":"badge-pendente";
      const pb=p.perfil==="moradora"?"badge-moradora":p.perfil==="bixo"?"badge-bixo":p.perfil==="agregada"?"badge-parcial":"badge-exaluna";
      const det=d.tamanhos_detalhes||{};
      Object.entries(det).forEach(([k,v])=>{totaisPorTam[k]=(totaisPorTam[k]||0)+v;totalGeral+=v;});
      const detHtml=Object.entries(det).map(([k,v])=>`<span style="display:inline-block;background:#f5f5f4;padding:2px 6px;border-radius:6px;font-size:10px;margin:1px">${formatSizeLabel(k)}: <b>${v}</b></span>`).join(" ");
      let act="";
      if(isMor){
        if(sc==="aguardando")act+=`<button class="btn btn-success btn-sm" onclick="confirmarPedido(${d.id})" title="Confirmar"><i class="fas fa-check"></i></button> `;
        if(sc!=="pago"&&vT>0)act+=`<button class="btn btn-primary btn-sm" onclick="registrarPagCamisa(${d.id},${vT},${vP})" title="Pagar"><i class="fas fa-dollar-sign"></i></button> `;
        act+=`<button class="btn btn-danger btn-sm" onclick="excluirPedido(${d.id})" title="Excluir"><i class="fas fa-trash"></i></button>`;
      }
      rows+=`<tr><td><strong>${p.apelido||p.nome||"—"}</strong></td><td><span class="badge ${pb}">${p.perfil||""}</span></td><td>${detHtml||"—"}</td><td style="font-weight:700;text-align:center">${d.total_camisas}</td><td class="val-hide" style="font-weight:700">${fmtBRL(vT)}</td><td class="val-hide" style="color:var(--verde)">${fmtBRL(vP)}</td><td class="val-hide" style="color:${vF>0.01?"var(--vermelho)":"var(--verde)"};font-weight:700">${fmtBRL(vF)}</td><td><span class="badge ${badge}">${sc.replace(/_/g," ")}</span></td><td>${act||"—"}</td></tr>`;
    });
  }
  // Extras rows
  if(extras&&extras.length){
    extras.forEach(e=>{
      const tam=e.tamanhos_detalhes||{};
      Object.entries(tam).forEach(([k,v])=>{totaisPorTam[k]=(totaisPorTam[k]||0)+v;totalGeral+=v;});
      const tamHtml=Object.keys(tam).length?Object.entries(tam).map(([k,v])=>`<span style="display:inline-block;background:#fef3c7;padding:2px 6px;border-radius:6px;font-size:10px;margin:1px">${formatSizeLabel(k)}: <b>${v}</b></span>`).join(" "):"—";
      rows+=`<tr style="background:#fffbeb"><td><strong>🎁 ${e.destinatario}</strong></td><td><span class="badge badge-parcial">extra</span></td><td>${tamHtml}</td><td style="font-weight:700;text-align:center">${e.quantidade}</td><td colspan="4" style="font-size:11px;color:#78716c;text-align:center">${(e.tipo_destinatario||"").replace(/_/g," ")}</td><td>—</td></tr>`;
    });
  }

  if(!rows){tbody.innerHTML='<tr><td colspan="9" style="text-align:center;color:#a8a29e;padding:20px">Nenhum pedido</td></tr>';return;}

  // Totals summary row
  const totalTamHtml=Object.entries(totaisPorTam).sort().map(([k,v])=>`<span style="display:inline-block;background:var(--bordo);color:#fff;padding:2px 8px;border-radius:6px;font-size:10px;margin:1px;font-weight:700">${formatSizeLabel(k)}: ${v}</span>`).join(" ");
  rows+=`<tr style="background:#fafaf9;border-top:2px solid var(--bordo)"><td colspan="2" style="font-weight:800;color:var(--bordo)">📊 TOTAL GERAL</td><td>${totalTamHtml}</td><td style="font-weight:800;text-align:center;color:var(--bordo);font-size:16px">${totalGeral}</td><td colspan="5"></td></tr>`;
  tbody.innerHTML=rows;
}

async function confirmarPedido(id){await sb.from("camisas_pedidos").update({status:"confirmado"}).eq("id",id);await audit("Confirmar","camisas_pedidos",id,{});toast("Confirmado!");loadCamisasTodos();}

async function registrarPagCamisa(id,vT,vP){
  const f=Math.max(0,vT-vP);const v=prompt(`Valor pago?\nTotal: ${fmtBRL(vT)}\nPago: ${fmtBRL(vP)}\nFalta: ${fmtBRL(f)}`,f.toFixed(2));
  if(!v)return;const val=parseFloat(v);if(isNaN(val)||val<=0)return;
  const nP=vP+val,nF=Math.max(0,vT-nP),st=nF<=0.01?"pago":"pendente_pagamento";
  await sb.from("camisas_pedidos").update({valor_pago:nP,status:st}).eq("id",id);
  await audit("Pagamento camisa","camisas_pedidos",id,{valor:val});
  toast(st==="pago"?`Quitado!`:`Pago ${fmtBRL(val)}. Falta ${fmtBRL(nF)}`);loadCamisasTodos();
}

async function excluirPedido(id){if(!confirm("Excluir este pedido?"))return;await sb.from("camisas_pedidos").delete().eq("id",id);await audit("Excluir pedido","camisas_pedidos",id,{});toast("Excluído!");loadCamisasTodos();}

async function exportarPedidosPDF(){
  const ano=camAnoAtual;
  const{data}=await sb.from("camisas_pedidos").select("*,profiles:user_id(nome,apelido,perfil)").eq("ano",ano);
  const{data:extras}=await sb.from("camisas_extras").select("*").eq("ano",ano);
  if((!data||!data.length)&&(!extras||!extras.length)){alert("Sem pedidos.");return;}
  // Collect all sizes
  const allSizes=new Set();
  (data||[]).forEach(d=>{Object.keys(d.tamanhos_detalhes||{}).forEach(k=>allSizes.add(k));});
  (extras||[]).forEach(e=>{Object.keys(e.tamanhos_detalhes||{}).forEach(k=>allSizes.add(k));});
  const sizes=[...allSizes].sort((a,b)=>{
    const order={"af":0,"am":1,"inf":2};
    const pa=a.substring(0,2),pb=b.substring(0,2);
    if(order[pa]!==order[pb])return(order[pa]||9)-(order[pb]||9);
    return a.localeCompare(b);
  });
  const sizeHeaders=sizes.map(s=>formatSizeLabel(s));
  const totals={};sizes.forEach(s=>{totals[s]=0;});

  let h=`<html><head><meta charset="utf-8"><title>Camisas ${ano}</title><style>body{font-family:'Open Sans',Arial,sans-serif;font-size:10px;padding:16px}h1{font-size:16px;color:#62162f}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #ccc;padding:4px 6px;text-align:center}th{background:#62162f;color:#fff;font-size:8px;text-transform:uppercase}.name{text-align:left;font-weight:700}.tot{background:#fafaf9;font-weight:800}.ext{background:#fffbeb}@media print{body{padding:8px}}</style></head><body>`;
  h+=`<div style="text-align:center"><span style="font-size:20px">🐇</span><h1>Volúpia — Camisas ${ano}</h1><p style="font-size:10px;color:#666">${new Date().toLocaleDateString("pt-BR")}</p></div>`;
  h+=`<table><thead><tr><th style="text-align:left">Pessoa</th><th>Perfil</th>${sizeHeaders.map(s=>`<th>${s}</th>`).join("")}<th>Total</th></tr></thead><tbody>`;
  // Pedidos
  (data||[]).forEach(d=>{
    const p=d.profiles||{};const det=d.tamanhos_detalhes||{};
    h+=`<tr><td class="name">${p.apelido||p.nome||"—"}</td><td>${p.perfil||""}</td>`;
    sizes.forEach(s=>{const v=det[s]||0;if(v)totals[s]+=v;h+=`<td>${v||""}</td>`;});
    h+=`<td style="font-weight:700">${d.total_camisas}</td></tr>`;
  });
  // Extras
  (extras||[]).forEach(e=>{
    const tam=e.tamanhos_detalhes||{};
    h+=`<tr class="ext"><td class="name">🎁 ${e.destinatario}</td><td>extra</td>`;
    sizes.forEach(s=>{const v=tam[s]||0;if(v)totals[s]+=v;h+=`<td>${v||""}</td>`;});
    h+=`<td style="font-weight:700">${e.quantidade}</td></tr>`;
  });
  // Totals row
  let grandTotal=0;
  h+=`<tr class="tot"><td class="name">TOTAL</td><td></td>`;
  sizes.forEach(s=>{grandTotal+=totals[s];h+=`<td>${totals[s]||""}</td>`;});
  h+=`<td style="font-size:14px;color:#62162f">${grandTotal}</td></tr>`;
  h+=`</tbody></table></body></html>`;
  const w=window.open("","_blank");w.document.write(h);w.document.close();setTimeout(()=>w.print(),500);
}

async function loadCamisasGestao(){
  const ano=camAnoAtual;
  const{data:cfg}=await sb.from("camisas_config").select("*").eq("ano",ano).maybeSingle();
  if(cfg){document.getElementById("camValorReal").value=cfg.valor_real_unitario||"";document.getElementById("camPrecoFinal").value=cfg.preco_exaluna||"";document.getElementById("camAcrescimo").value=cfg.acrescimo_exaluna?fmtBRL(cfg.acrescimo_exaluna):"";}
  const{data:extras}=await sb.from("camisas_extras").select("*").eq("ano",ano).order("created_at");
  const tbody=document.getElementById("camExtrasTbody");
  const te=(extras||[]).reduce((s,e)=>s+(e.quantidade||0),0);
  document.getElementById("camTotalExtras").value=te;
  if(!extras||!extras.length)tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:#a8a29e;padding:20px">Nenhuma extra</td></tr>';
  else tbody.innerHTML=extras.map(e=>{
    const tam=e.tamanhos_detalhes||{};
    const tamHtml=Object.keys(tam).length?Object.entries(tam).map(([k,v])=>`<span style="display:inline-block;background:#f5f5f4;padding:1px 5px;border-radius:5px;font-size:9px;margin:1px">${formatSizeLabel(k)}: <b>${v}</b></span>`).join(" "):"—";
    return`<tr><td>${e.destinatario}</td><td style="text-transform:capitalize;font-size:11px">${(e.tipo_destinatario||"").replace(/_/g," ")}</td><td>${tamHtml}</td><td style="font-weight:700;text-align:center">${e.quantidade}</td><td><button class="btn btn-danger btn-sm" onclick="delCamisaExtra(${e.id})"><i class="fas fa-trash"></i></button></td></tr>`;
  }).join("");
  const vr=parseFloat(document.getElementById("camValorReal").value)||0;
  document.getElementById("camCustoExtras").value=fmtBRL(te*vr);
}

function calcularPrecoCamisas(){
  const r=parseFloat(document.getElementById("camValorReal").value)||0;
  const te=parseInt(document.getElementById("camTotalExtras").value)||0;
  const ce=r*te;document.getElementById("camCustoExtras").value=fmtBRL(ce);
  const ne=parseInt(document.getElementById("camNExalunas").value)||1;
  const ac=ne>0?ce/ne:0;document.getElementById("camAcrescimo").value=fmtBRL(ac);
  document.getElementById("camPrecoFinal").value=(r+ac).toFixed(2);
  toast(`${fmtBRL(r)} + ${fmtBRL(ac)} = ${fmtBRL(r+ac)}`);
}

async function publicarPrecoCamisas(){
  const ano=camAnoAtual,vr=parseFloat(document.getElementById("camValorReal").value)||0,pf=parseFloat(document.getElementById("camPrecoFinal").value)||0;
  if(!vr||!pf){alert("Calcule primeiro.");return;}
  if(!confirm(`Publicar?\nReal: ${fmtBRL(vr)}\nEx-Aluna: ${fmtBRL(pf)}`))return;
  const ac=pf-vr;
  const{data:ex}=await sb.from("camisas_config").select("id").eq("ano",ano).maybeSingle();
  const obj={valor_real_unitario:vr,acrescimo_exaluna:ac,preco_exaluna:pf,publicado:true,updated_at:new Date().toISOString()};
  if(ex)await sb.from("camisas_config").update(obj).eq("id",ex.id);else await sb.from("camisas_config").insert({ano,...obj});
  const{data:peds}=await sb.from("camisas_pedidos").select("id,total_camisas,user_id").eq("ano",ano);
  for(const p of(peds||[])){const pr=allProfiles.find(x=>x.id===p.user_id);await sb.from("camisas_pedidos").update({valor_total:p.total_camisas*((pr&&pr.perfil==="ex-aluna")?pf:vr)}).eq("id",p.id);}
  await audit("Publicar preço","camisas_config","",{vr,pf});
  toast("Publicado!");loadCamisasTodos();loadCamisasGestao();loadCamisaPrecoInfo();
}

function addCamisaExtra(){
  let sizeFields="";
  const cats=[{label:"👚 Fem.",prefix:"af",sizes:["P","M","G","GG","XG"]},{label:"👕 Masc.",prefix:"am",sizes:["P","M","G","GG","XG"]},{label:"👶 Inf.",prefix:"inf",sizes:["1_ano","2_anos","4_anos","6_anos","8_anos","10_anos","12_anos","14_anos"]}];
  cats.forEach(cat=>{
    sizeFields+=`<div style="margin-top:8px"><strong style="font-size:10px;color:#78716c">${cat.label}</strong><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">`;
    cat.sizes.forEach(s=>{
      sizeFields+=`<div style="text-align:center"><label style="font-size:9px;margin:0">${s.replace(/_/g," ")}</label><input type="number" min="0" value="0" data-ext-size="${cat.prefix}_${s}" class="ext-size-input" style="width:45px;text-align:center;padding:3px;font-size:11px"></div>`;
    });
    sizeFields+=`</div></div>`;
  });
  abrirModal("Camisa Extra",`<div style="display:grid;gap:10px">
    <div><label>Destinatário</label><input type="text" id="mExtDest" placeholder="Nome da república / pessoa"></div>
    <div><label>Tipo</label><select id="mExtTipo"><option value="republica_amiga">República amiga</option><option value="amigo_da_rep">Amigo da rep</option><option value="outro">Outro</option></select></div>
    <div style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:10px;padding:10px">
      <label>Tamanhos</label>${sizeFields}
    </div>
    <button class="btn btn-primary" style="width:100%;justify-content:center" onclick="salvarCamisaExtra()"><i class="fas fa-save"></i>Salvar</button>
  </div>`);
}
async function salvarCamisaExtra(){
  const d=document.getElementById("mExtDest").value.trim();if(!d){alert("Destinatário.");return;}
  const tamanhos={};let qtd=0;
  document.querySelectorAll(".ext-size-input").forEach(inp=>{
    const v=parseInt(inp.value)||0;
    if(v>0){tamanhos[inp.dataset.extSize]=v;qtd+=v;}
  });
  if(qtd===0){alert("Informe pelo menos 1 tamanho.");return;}
  await sb.from("camisas_extras").insert({ano:camAnoAtual,destinatario:d,tipo_destinatario:document.getElementById("mExtTipo").value,quantidade:qtd,tamanhos_detalhes:tamanhos,created_by:currentProfile.id});
  fecharModal();toast(`${qtd} camisa(s) extra adicionada(s)!`);loadCamisasGestao();
}
async function delCamisaExtra(id){if(!confirm("Remover?"))return;await sb.from("camisas_extras").delete().eq("id",id);toast("Removida!");loadCamisasGestao();}

// ============================================================
// CAIXINHA
// ============================================================
async function loadCaixinha(){
  // Get all lancamentos with category Caixinha (out) or Entrada Caixinha (in)
  const{data:lancs}=await sb.from("lancamentos").select("*,categorias_presidencia(nome,icone)").in("status",["incluido","pendente"]).order("data",{ascending:false});
  const tbody=document.getElementById("cxTbody");
  let entradas=0,saidas=0;
  const rows=(lancs||[]).filter(l=>{
    const cat=l.categorias_presidencia?.nome||"";
    return cat==="Saída Caixinha"||cat==="Entrada Caixinha";
  });
  if(!rows.length){
    tbody.innerHTML='<tr><td colspan="4" style="text-align:center;color:#a8a29e;padding:20px">Nenhuma movimentação de caixinha</td></tr>';
    document.getElementById("cxEntradas").textContent="R$ 0,00";
    document.getElementById("cxSaidas").textContent="R$ 0,00";
    document.getElementById("cxSaldo").textContent="R$ 0,00";
    return;
  }
  tbody.innerHTML=rows.map(l=>{
    const cat=l.categorias_presidencia?.nome||"";
    const isEntrada=cat==="Entrada Caixinha";
    const val=parseFloat(l.valor)||0;
    if(isEntrada)entradas+=val;else saidas+=val;
    return`<tr>
      <td>${new Date(l.data).toLocaleDateString("pt-BR")}</td>
      <td>${l.descricao}</td>
      <td><span class="badge ${isEntrada?"badge-pago":"badge-pendente"}">${isEntrada?"Entrada":"Saída"}</span></td>
      <td class="val-hide" style="font-weight:700;color:${isEntrada?"var(--verde)":"var(--vermelho)"}">${isEntrada?"+":"−"} ${fmtBRL(val)}</td>
    </tr>`;
  }).join("");
  const saldo=entradas-saidas;
  document.getElementById("cxEntradas").textContent=fmtBRL(entradas);
  document.getElementById("cxSaidas").textContent=fmtBRL(saidas);
  const saldoEl=document.getElementById("cxSaldo");
  saldoEl.textContent=fmtBRL(Math.abs(saldo));
  saldoEl.style.color=saldo>=0?"var(--verde)":"var(--vermelho)";
}

// ============================================================
// CARNAVAL
// ============================================================
let carnAnoAtual=null;
let carnData=null;
let carnQuartos=[];

async function loadCarnaval(){
  const{data:carns}=await sb.from("carnaval").select("ano").order("ano",{ascending:false});
  const thisYear=new Date().getFullYear();
  const anos=(carns||[]).map(c=>c.ano);
  if(!anos.length)anos.push(thisYear);
  if(!carnAnoAtual)carnAnoAtual=anos[0];
  document.getElementById("carnYearTabs").innerHTML=anos.map(a=>`<button class="btn btn-sm ${a===carnAnoAtual?"btn-primary":"btn-secondary"}" onclick="selectCarnAno(${a})">${a}</button>`).join("");
  document.getElementById("carnAno").value=carnAnoAtual;
  await loadCarnavalData();
}
function selectCarnAno(ano){carnAnoAtual=ano;document.getElementById("carnAno").value=ano;document.querySelectorAll("#carnYearTabs button").forEach(b=>{b.className="btn btn-sm "+(parseInt(b.textContent)===ano?"btn-primary":"btn-secondary");});loadCarnavalData();}
async function criarCarnAno(){const ano=parseInt(prompt("Ano do Carnaval:",new Date().getFullYear()));if(!ano)return;const{data:ex}=await sb.from("carnaval").select("id").eq("ano",ano).maybeSingle();if(ex){toast("Já existe!");selectCarnAno(ano);return;}await sb.from("carnaval").insert({ano,created_by:currentProfile.id});await audit("Criar Carnaval","carnaval","",{ano});carnAnoAtual=ano;toast("Carnaval "+ano+" criado!");loadCarnaval();}

async function loadCarnavalData(){
  const ano=carnAnoAtual;
  const{data}=await sb.from("carnaval").select("*").eq("ano",ano).maybeSingle();
  carnData=data;
  if(!data){["carnReceita","carnGastos","carnSaldo","carnOcupacao"].forEach(id=>document.getElementById(id).textContent="—");document.getElementById("carnQuartosTbody").innerHTML='<tr><td colspan="9" style="text-align:center;color:#a8a29e;padding:20px">Crie o carnaval</td></tr>';document.getElementById("carnReservasTbody").innerHTML='<tr><td colspan="8" style="text-align:center;color:#a8a29e;padding:20px">—</td></tr>';document.getElementById("carnGastosTbody").innerHTML='<tr><td colspan="4" style="text-align:center;color:#a8a29e;padding:20px">—</td></tr>';return;}
  document.getElementById("carnValAgua").value=data.valor_agua_energia||"";
  document.getElementById("carnValFaxina").value=data.valor_faxina||"";
  document.getElementById("carnValPapel").value=data.valor_papel_higienico||"";
  document.getElementById("carnValOutros").value=data.valor_outros_gastos||"";
  document.getElementById("carnDescOutros").value=data.descricao_outros||"";
  document.getElementById("carnFecharBtn").innerHTML=data.status==="fechado"?'<i class="fas fa-lock-open"></i> Reabrir':'<i class="fas fa-lock"></i> Fechar Carnaval';
  const{data:quartos}=await sb.from("carnaval_quartos").select("*").eq("carnaval_id",data.id).order("nome");
  carnQuartos=quartos||[];
  const qIds=carnQuartos.map(q=>q.id);
  const{data:reservas}=qIds.length?await sb.from("carnaval_reservas").select("*,carnaval_quartos(nome)").in("quarto_id",qIds).order("created_at",{ascending:false}):{data:[]};
  const{data:gastos}=await sb.from("carnaval_gastos").select("*").eq("carnaval_id",data.id).order("created_at",{ascending:false});
  let receita=0;(reservas||[]).filter(r=>r.status!=="cancelado").forEach(r=>{receita+=parseFloat(r.valor)||0;});
  const gPrev=(parseFloat(data.valor_agua_energia)||0)+(parseFloat(data.valor_faxina)||0)+(parseFloat(data.valor_papel_higienico)||0)+(parseFloat(data.valor_outros_gastos)||0);
  const gEvent=(gastos||[]).reduce((s,g)=>s+parseFloat(g.valor),0);
  const totalG=gPrev+gEvent;const saldo=receita-totalG;
  document.getElementById("carnReceita").textContent=fmtBRL(receita);
  document.getElementById("carnGastos").textContent=fmtBRL(totalG);
  const se=document.getElementById("carnSaldo");se.textContent=fmtBRL(Math.abs(saldo));se.style.color=saldo>=0?"var(--verde)":"var(--vermelho)";
  let tV=0,tO=0;carnQuartos.forEach(q=>{tV+=(q.vagas_cama||0)+(q.vagas_colchao||0);(reservas||[]).filter(r=>r.quarto_id===q.id&&r.status!=="cancelado").forEach(r=>{if(r.tipo==="quarto_fechado")tO+=(q.vagas_cama||0)+(q.vagas_colchao||0);else tO++;});});
  document.getElementById("carnOcupacao").textContent=`${tO}/${tV}`;

  // Quartos
  const qt=document.getElementById("carnQuartosTbody");
  if(carnQuartos.length){qt.innerHTML=carnQuartos.map(q=>{const rQ=(reservas||[]).filter(r=>r.quarto_id===q.id&&r.status!=="cancelado");const oC=rQ.filter(r=>r.tipo==="cama").length;const oCo=rQ.filter(r=>r.tipo==="colchao").length;const iF=q.status==="fechado"||rQ.some(r=>r.tipo==="quarto_fechado");return`<tr><td><strong>${q.nome}</strong></td><td style="text-align:center">${q.vagas_cama||0}</td><td style="text-align:center">${q.vagas_colchao||0}</td><td class="val-hide">${fmtBRL(q.preco_cama||0)}</td><td class="val-hide">${fmtBRL(q.preco_colchao||0)}</td><td class="val-hide">${fmtBRL(q.preco_quarto_fechado||0)}</td><td><span class="badge ${iF?"badge-pendente":"badge-pago"}">${iF?"Fechado":"Disponível"}</span></td><td style="font-size:11px">${iF?"🔒 Fechado":`🛏️ ${oC}/${q.vagas_cama||0} · 🛌 ${oCo}/${q.vagas_colchao||0}`}</td><td style="white-space:nowrap"><button class="btn btn-sm btn-secondary" onclick="editQuarto(${q.id})"><i class="fas fa-pen"></i></button> <button class="btn btn-sm btn-danger" onclick="delQuarto(${q.id})"><i class="fas fa-trash"></i></button></td></tr>`;}).join("");}else qt.innerHTML='<tr><td colspan="9" style="text-align:center;color:#a8a29e;padding:20px">Adicione quartos</td></tr>';

  // Reservas
  const rt=document.getElementById("carnReservasTbody");
  if(reservas&&reservas.length){rt.innerHTML=reservas.map(r=>{const tL=r.tipo==="cama"?"🛏️ Cama":r.tipo==="colchao"?"🛌 Colchão":"🔒 Fechado";const vP=parseFloat(r.valor_pago||0);const f=Math.max(0,parseFloat(r.valor)-vP);const b=r.status==="cancelado"?"badge-pendente":f<=0.01?"badge-pago":vP>0?"badge-parcial":"badge-pendente";const sL=r.status==="cancelado"?"Cancelado":f<=0.01?"Pago":vP>0?"Parcial":"Reservado";return`<tr${r.status==="cancelado"?' style="opacity:.5"':""}><td><strong>${r.turista_nome}</strong></td><td style="font-size:11px">${r.turista_telefone||"—"}</td><td>${r.carnaval_quartos?.nome||"—"}</td><td>${tL}</td><td class="val-hide" style="font-weight:700">${fmtBRL(r.valor)}</td><td class="val-hide" style="color:var(--verde)">${fmtBRL(vP)}</td><td><span class="badge ${b}">${sL}</span></td><td style="white-space:nowrap">${r.status!=="cancelado"&&f>0.01?`<button class="btn btn-success btn-sm" onclick="pagarReserva(${r.id},${parseFloat(r.valor)},${vP})"><i class="fas fa-dollar-sign"></i></button> `:""} ${r.status!=="cancelado"?`<button class="btn btn-danger btn-sm" onclick="cancelarReserva(${r.id})"><i class="fas fa-times"></i></button>`:""}</td></tr>`;}).join("");}else rt.innerHTML='<tr><td colspan="8" style="text-align:center;color:#a8a29e;padding:20px">Nenhuma reserva</td></tr>';

  // Gastos
  const gt=document.getElementById("carnGastosTbody");
  const catL={agua_energia:"💧 Água/Energia",faxina:"🧹 Faxina",papel_higienico:"🧻 Papel Higiênico",outro:"📋 Outro"};
  if(gastos&&gastos.length){gt.innerHTML=gastos.map(g=>`<tr><td>${g.descricao}</td><td>${catL[g.categoria]||g.categoria}</td><td class="val-hide" style="font-weight:700;color:var(--vermelho)">${fmtBRL(g.valor)}</td><td><button class="btn btn-danger btn-sm" onclick="delGastoCarn(${g.id})"><i class="fas fa-trash"></i></button></td></tr>`).join("");}else gt.innerHTML='<tr><td colspan="4" style="text-align:center;color:#a8a29e;padding:20px">Nenhum gasto</td></tr>';
}

async function salvarCarnConfig(){if(!carnData){toast("Crie primeiro.");return;}await sb.from("carnaval").update({valor_agua_energia:parseFloat(document.getElementById("carnValAgua").value)||0,valor_faxina:parseFloat(document.getElementById("carnValFaxina").value)||0,valor_papel_higienico:parseFloat(document.getElementById("carnValPapel").value)||0,valor_outros_gastos:parseFloat(document.getElementById("carnValOutros").value)||0,descricao_outros:document.getElementById("carnDescOutros").value,updated_at:new Date().toISOString()}).eq("id",carnData.id);await audit("Config carnaval","carnaval",carnData.id,{});toast("Salvo!");loadCarnavalData();}

async function fecharCarn(){if(!carnData)return;const ns=carnData.status==="fechado"?"aberto":"fechado";if(ns==="fechado"&&!confirm("Fechar carnaval? Saldo vai pra caixa."))return;await sb.from("carnaval").update({status:ns}).eq("id",carnData.id);await audit(ns==="fechado"?"Fechar":"Reabrir"+" carnaval","carnaval",carnData.id,{});toast(ns==="fechado"?"Fechado!":"Reaberto!");loadCarnavalData();}

function addQuarto(){if(!carnData){toast("Crie primeiro.");return;}abrirModal("Adicionar Quarto",`<div style="display:grid;gap:10px"><div><label>Nome</label><input type="text" id="mQNome" placeholder="Suíte 1"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>Vagas Cama</label><input type="number" id="mQVCama" value="2" min="0"></div><div><label>Vagas Colchão</label><input type="number" id="mQVColchao" value="2" min="0"></div></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><div><label>R$ Cama</label><input type="number" id="mQPCama" step="0.01"></div><div><label>R$ Colchão</label><input type="number" id="mQPColchao" step="0.01"></div><div><label>R$ Fechar</label><input type="number" id="mQPFechado" step="0.01"></div></div><button class="btn btn-primary" style="width:100%;justify-content:center" onclick="salvarQuarto()"><i class="fas fa-save"></i>Salvar</button></div>`);}
async function salvarQuarto(){await sb.from("carnaval_quartos").insert({carnaval_id:carnData.id,nome:document.getElementById("mQNome").value,vagas_cama:parseInt(document.getElementById("mQVCama").value)||0,vagas_colchao:parseInt(document.getElementById("mQVColchao").value)||0,preco_cama:parseFloat(document.getElementById("mQPCama").value)||0,preco_colchao:parseFloat(document.getElementById("mQPColchao").value)||0,preco_quarto_fechado:parseFloat(document.getElementById("mQPFechado").value)||0});fecharModal();toast("Quarto adicionado!");loadCarnavalData();}
function editQuarto(qId){const q=carnQuartos.find(x=>x.id===qId);if(!q)return;abrirModal("Editar Quarto",`<div style="display:grid;gap:10px"><div><label>Nome</label><input type="text" id="mQNomeE" value="${q.nome}"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>Vagas Cama</label><input type="number" id="mQVCamaE" value="${q.vagas_cama||0}"></div><div><label>Vagas Colchão</label><input type="number" id="mQVColchaoE" value="${q.vagas_colchao||0}"></div></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><div><label>R$ Cama</label><input type="number" id="mQPCamaE" step="0.01" value="${q.preco_cama||0}"></div><div><label>R$ Colchão</label><input type="number" id="mQPColchaoE" step="0.01" value="${q.preco_colchao||0}"></div><div><label>R$ Fechar</label><input type="number" id="mQPFechadoE" step="0.01" value="${q.preco_quarto_fechado||0}"></div></div><button class="btn btn-primary" style="width:100%;justify-content:center" onclick="salvarQuartoEdit(${qId})"><i class="fas fa-save"></i>Salvar</button></div>`);}
async function salvarQuartoEdit(qId){await sb.from("carnaval_quartos").update({nome:document.getElementById("mQNomeE").value,vagas_cama:parseInt(document.getElementById("mQVCamaE").value)||0,vagas_colchao:parseInt(document.getElementById("mQVColchaoE").value)||0,preco_cama:parseFloat(document.getElementById("mQPCamaE").value)||0,preco_colchao:parseFloat(document.getElementById("mQPColchaoE").value)||0,preco_quarto_fechado:parseFloat(document.getElementById("mQPFechadoE").value)||0}).eq("id",qId);fecharModal();toast("Atualizado!");loadCarnavalData();}
async function delQuarto(qId){if(!confirm("Excluir quarto e reservas?"))return;await sb.from("carnaval_quartos").delete().eq("id",qId);toast("Excluído!");loadCarnavalData();}

function addReserva(){if(!carnQuartos.length){toast("Adicione quartos.");return;}const qO=carnQuartos.map(q=>`<option value="${q.id}">${q.nome} (🛏️${q.vagas_cama} 🛌${q.vagas_colchao})</option>`).join("");abrirModal("Nova Reserva",`<div style="display:grid;gap:10px"><div><label>Turista</label><input type="text" id="mRNome" placeholder="Nome"></div><div><label>Telefone</label><input type="tel" id="mRTel" placeholder="(31) 99999-9999"></div><div><label>Quarto</label><select id="mRQuarto" onchange="calcValorReserva()">${qO}</select></div><div><label>Tipo</label><select id="mRTipo" onchange="calcValorReserva()"><option value="cama">🛏️ Cama</option><option value="colchao">🛌 Colchão</option><option value="quarto_fechado">🔒 Fechar Quarto</option></select></div><div><label>Valor (R$)</label><input type="number" id="mRValor" step="0.01"></div><div><label>Obs</label><input type="text" id="mRObs"></div><button class="btn btn-primary" style="width:100%;justify-content:center" onclick="salvarReserva()"><i class="fas fa-save"></i>Reservar</button></div>`);calcValorReserva();}
function calcValorReserva(){const qId=parseInt(document.getElementById("mRQuarto").value);const t=document.getElementById("mRTipo").value;const q=carnQuartos.find(x=>x.id===qId);if(!q)return;document.getElementById("mRValor").value=(t==="cama"?q.preco_cama:t==="colchao"?q.preco_colchao:q.preco_quarto_fechado||0).toFixed(2);}
async function salvarReserva(){const n=document.getElementById("mRNome").value.trim();if(!n){alert("Nome.");return;}await sb.from("carnaval_reservas").insert({quarto_id:parseInt(document.getElementById("mRQuarto").value),turista_nome:n,turista_telefone:document.getElementById("mRTel").value,tipo:document.getElementById("mRTipo").value,valor:parseFloat(document.getElementById("mRValor").value)||0,observacoes:document.getElementById("mRObs").value,created_by:currentProfile.id});await audit("Reserva","carnaval_reservas","",{turista:n});fecharModal();toast("Reservado!");loadCarnavalData();}
async function pagarReserva(rId,vT,vP){const f=Math.max(0,vT-vP);const v=prompt(`Valor pago?\nTotal: ${fmtBRL(vT)}\nPago: ${fmtBRL(vP)}\nFalta: ${fmtBRL(f)}`,f.toFixed(2));if(!v)return;const val=parseFloat(v);if(isNaN(val)||val<=0)return;const nP=vP+val;await sb.from("carnaval_reservas").update({valor_pago:nP,status:nP>=vT-0.01?"pago":"reservado",data_pagamento:new Date().toISOString().split("T")[0]}).eq("id",rId);toast(nP>=vT-0.01?"Pago!":`Pago ${fmtBRL(val)}`);loadCarnavalData();}
async function cancelarReserva(rId){if(!confirm("Cancelar?"))return;await sb.from("carnaval_reservas").update({status:"cancelado"}).eq("id",rId);toast("Cancelada!");loadCarnavalData();}

function addGastoCarn(){if(!carnData){toast("Crie primeiro.");return;}abrirModal("Gasto Carnaval",`<div style="display:grid;gap:10px"><div><label>Descrição</label><input type="text" id="mGCDesc" placeholder="O quê"></div><div><label>Valor</label><input type="number" id="mGCValor" step="0.01"></div><div><label>Categoria</label><select id="mGCCat"><option value="agua_energia">💧 Água/Energia</option><option value="faxina">🧹 Faxina</option><option value="papel_higienico">🧻 Papel Higiênico</option><option value="outro">📋 Outro</option></select></div><button class="btn btn-primary" style="width:100%;justify-content:center" onclick="salvarGastoCarn()"><i class="fas fa-save"></i>Salvar</button></div>`);}
async function salvarGastoCarn(){const d=document.getElementById("mGCDesc").value.trim();const v=parseFloat(document.getElementById("mGCValor").value)||0;if(!d||!v){alert("Preencha.");return;}await sb.from("carnaval_gastos").insert({carnaval_id:carnData.id,descricao:d,valor:v,categoria:document.getElementById("mGCCat").value,created_by:currentProfile.id});fecharModal();toast("Gasto lançado!");loadCarnavalData();}
async function delGastoCarn(id){if(!confirm("Remover?"))return;await sb.from("carnaval_gastos").delete().eq("id",id);toast("Removido!");loadCarnavalData();}

// AUDITORIA
// ============================================================
const ADMIN_EMAIL="mariaed.meira@icloud.com";

async function loadAuditoria(){
  const btnLimpar=document.getElementById("btnLimparAudit");
  if(btnLimpar)btnLimpar.style.display=currentProfile.email===ADMIN_EMAIL?"inline-flex":"none";
  const{data}=await sb.from("audit_log").select("*").order("created_at",{ascending:false}).limit(200);
  const el=document.getElementById("auditList");
  if(!data||!data.length){el.innerHTML='<p style="color:#a8a29e;font-size:13px;text-align:center;padding:20px">Nenhum registro</p>';return;}
  el.innerHTML=data.map((a,i)=>{
    const dt=new Date(a.created_at);
    const det=a.detalhes||{};
    const hasDetails=Object.keys(det).length>0;
    let detHtml="";
    if(hasDetails){
      detHtml=`<div id="auditDet${i}" style="display:none;margin-top:6px;padding:8px 10px;background:#f5f3f0;border-radius:8px;font-size:10px;color:#57534e">`;
      Object.entries(det).forEach(([k,v])=>{
        let vStr=typeof v==="object"?JSON.stringify(v):String(v);
        if(vStr.length>100)vStr=vStr.substring(0,100)+"…";
        detHtml+=`<div style="margin-bottom:3px"><strong style="color:#78716c">${k}:</strong> ${vStr}</div>`;
      });
      detHtml+=`</div>`;
    }
    return`<div class="audit-row">
      <div style="display:flex;align-items:center;gap:6px">
        ${hasDetails?`<button onclick="document.getElementById('auditDet${i}').style.display=document.getElementById('auditDet${i}').style.display==='none'?'block':'none';this.querySelector('i').classList.toggle('fa-plus');this.querySelector('i').classList.toggle('fa-minus')" style="background:var(--bordo);color:#fff;border:none;width:20px;height:20px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-plus" style="font-size:9px"></i></button>`:`<span style="width:20px;display:inline-block"></span>`}
        <div style="flex:1">
          <strong>${a.user_nome||"—"}</strong>
          <span style="color:#78716c">${a.acao}</span>
          em <em>${a.tabela||""}</em>
          ${a.registro_id?`<span style="color:#a8a29e;font-size:9px">#${a.registro_id}</span>`:""}
        </div>
        <span style="color:#a8a29e;font-size:10px;white-space:nowrap">${dt.toLocaleDateString("pt-BR")} ${dt.toLocaleTimeString("pt-BR")}</span>
      </div>
      ${detHtml}
    </div>`;
  }).join("");
}

async function limparAuditoria(){
  if(currentProfile.email!==ADMIN_EMAIL){toast("Sem permissão.");return;}
  if(!confirm("Limpar todo o log de auditoria? Isso é irreversível."))return;
  const{error}=await sb.from("audit_log").delete().neq("id",0);
  if(error){alert("Erro: "+error.message);return;}
  toast("Log de auditoria limpo!");
  loadAuditoria();
}

// ============================================================
// ADMIN
// ============================================================
async function loadAdmin(){
  const{data:cfg}=await sb.from("config").select("*").eq("id",1).single();
  if(cfg){document.getElementById("cfgNomeRep").value=cfg.nome_republica;document.getElementById("cfgSalario").value=cfg.salario_minimo;}
  const tbody=document.getElementById("adminTbody");
  tbody.innerHTML=allProfiles.map(p=>{
    const badge=p.perfil==="moradora"?"badge-moradora":p.perfil==="bixo"?"badge-bixo":p.perfil==="agregada"?"badge-parcial":"badge-exaluna";
    const isMe=p.id===currentProfile.id;
    return`<tr>
      <td><strong>${p.nome}</strong></td>
      <td>${p.apelido||"—"}</td>
      <td style="font-size:11px;color:#78716c">${p.email}</td>
      <td><span class="badge ${badge}">${p.perfil}</span></td>
      <td style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
        <select onchange="mudarPerfil('${p.id}',this.value)" style="width:auto;padding:4px 8px;font-size:11px">
          <option value="bixo" ${p.perfil==="bixo"?"selected":""}>Bixo</option>
          <option value="moradora" ${p.perfil==="moradora"?"selected":""}>Moradora</option>
          <option value="ex-aluna" ${p.perfil==="ex-aluna"?"selected":""}>Ex-Aluna</option>
          <option value="agregada" ${p.perfil==="agregada"?"selected":""}>Agregada</option>
        </select>
        ${!isMe?`<button class="btn btn-danger btn-sm" onclick="excluirUsuario('${p.id}','${(p.apelido||p.nome).replace(/'/g,"")}')" title="Excluir usuária"><i class="fas fa-trash"></i></button>`:""}
      </td>
    </tr>`;
  }).join("");
}

async function excluirUsuario(uid,nome){
  if(!confirm(`Excluir a usuária "${nome}"?\n\nIsso remove o perfil e todos os dados associados do sistema.`))return;
  // Delete related data
  await sb.from("debitos_presidencia").delete().eq("user_id",uid);
  await sb.from("mei_participantes").delete().eq("ex_aluna_id",uid);
  await sb.from("aniversario_contribuicoes").delete().eq("ex_aluna_id",uid);
  await sb.from("camisas_pedidos").delete().eq("user_id",uid);
  await sb.from("joias").delete().eq("moradora_id",uid);
  // Delete profile
  await sb.from("profiles").delete().eq("id",uid);
  await audit("Excluir usuária","profiles",uid,{nome});
  // Remove from local list
  allProfiles=allProfiles.filter(p=>p.id!==uid);
  toast(`Usuária "${nome}" excluída!`);loadAdmin();
}

async function mudarPerfil(uid,novoPerfil){
  const old=allProfiles.find(p=>p.id===uid);
  if(!old)return;
  const oldPerfil=old.perfil;
  // Se bixo → moradora, perguntar novo apelido
  let novoApelido=null;
  if(oldPerfil==="bixo"&&novoPerfil==="moradora"){
    novoApelido=prompt(`${old.apelido||old.nome} está virando Moradora!\n\nNovo apelido (nome de república):`,old.apelido||"");
    if(novoApelido===null)return;// Cancelou
  }
  const updateData={perfil:novoPerfil,updated_at:new Date().toISOString()};
  if(novoApelido!==null)updateData.apelido=novoApelido;
  await sb.from("profiles").update(updateData).eq("id",uid);
  await audit("Mudar perfil","profiles",uid,{de:oldPerfil,para:novoPerfil,apelido:novoApelido});
  // Se bixo → moradora, disparar joia
  if(oldPerfil==="bixo"&&novoPerfil==="moradora"){
    const{data:cfg}=await sb.from("config").select("salario_minimo").eq("id",1).single();
    const valorJoia=cfg?parseFloat(cfg.salario_minimo)/2:706;
    const ano=new Date().getFullYear();
    const{data:joia}=await sb.from("joias").insert({moradora_id:uid,ano,valor_integral:valorJoia,data_transicao:new Date().toISOString().split("T")[0]}).select().single();
    if(joia){
      const parcVal=+(valorJoia/12).toFixed(2);
      const parcelas=[];for(let m=1;m<=12;m++)parcelas.push({joia_id:joia.id,mes:m,valor:parcVal});
      await sb.from("joias_pagamentos").insert(parcelas);
      await audit("Auto: Joia criada (bixo→moradora)","joias",joia.id,{valor:valorJoia});
      toast("Joia de entrada criada automaticamente!");
    }
  }
  old.perfil=novoPerfil;
  if(novoApelido!==null)old.apelido=novoApelido;
  // Se é a própria pessoa, atualizar header
  if(uid===currentProfile.id){
    currentProfile.perfil=novoPerfil;
    if(novoApelido!==null)currentProfile.apelido=novoApelido;
    document.getElementById("barNome").textContent=currentProfile.apelido||currentProfile.nome;
    document.getElementById("barPerfil").textContent=novoPerfil.charAt(0).toUpperCase()+novoPerfil.slice(1);
  }
  toast("Perfil atualizado!");loadAdmin();
}

async function salvarConfig(){
  const nome=document.getElementById("cfgNomeRep").value;
  const salario=parseFloat(document.getElementById("cfgSalario").value);
  await sb.from("config").update({nome_republica:nome,salario_minimo:salario}).eq("id",1);
  await audit("Salvar config","config","1",{nome,salario});
  toast("Configurações salvas!");
}
function abrirExAlunas() {
  alert("Abrir Ex-Alunas");
}
