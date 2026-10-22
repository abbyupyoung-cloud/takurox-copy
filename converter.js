/* HTML 轉換器：貼上中文 HTML → 依各語系 PDF 原文產出英／越／印尼文 HTML（用 Claude 比對，不自行翻譯） */
(function(){
/* 每個 MAP 區塊在 PDF 的檔案頁（四語系版面相同；0 = 英文網站專用、PDF 無） */
const PG={
 brand:[2,2,2,2,2,2,2,2],
 overview:[2,3,4,5,6,7,8,9,9,10,10],
 awn:[4,3,3,3,3,3,3,3,4,4,4,4,4,0],
 awn118:[5,5,5,5,5,5,5,5,5,5],
 abn:[6,6,6,6,6,6,6,6,6],
 awd:[8,7,7,7,7,7,7,7,8,8],
 abd:[9,9,9,9,9,9,9,9],
 dryer:[0,0,10,10,11,11,11,11,11,11,11,11,11,12,12,12,12,12,12,12,12,12,12]
};
const COVER={zh:"TAKUROX 自設洗衣設備 On-Premises Laundry",en:"TAKUROX On-Premise Laundry Solutions",id:"TAKUROX On-Premises Laundry Solutions",vi:"TAKUROX Thiết bị giặt công nghiệp — Tài liệu giới thiệu"};
const LNAME={zh:"Chinese",en:"English",vi:"Vietnamese",id:"Indonesian"};
const OUT=[{k:"zh",tag:"中文（PDF 校正版）"},{k:"en",tag:"English"},{k:"th",tag:"ไทย"},{k:"vi",tag:"Tiếng Việt"},{k:"id",tag:"Bahasa Indonesia"}];
const printed=n=>{const a=2*n-3,b=2*n-2;return a<1?"封面":String(a).padStart(2,"0")+"/"+String(b).padStart(2,"0")};

function corpus(k){
  let s=`[PDF page 1] Cover\n${COVER[k]}\n\n`;
  for(const pid in MAP){MAP[pid].forEach((r,ri)=>{
    const pg=PG[pid][ri]; if(!pg) return;
    const b=blockOf(k,pid,r[COL[k]]); if(!b) return;
    s+=`[PDF page ${pg}] ${r[0]}\n${b.t}\n\n`;
  })}
  return s;
}
const CJK=/[㐀-鿿豈-﫿]/;
function decode(s){const t=document.createElement("textarea");t.innerHTML=s;return t.value}
function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function chunks(html){
  const parts=html.split(/(<[^>]*>)/); const list=[];
  parts.forEach((p,pi)=>{ if(p.startsWith("<")) return; const txt=decode(p).trim(); if(txt&&CJK.test(txt)) list.push({pi,txt,raw:p}); });
  return {parts,list};
}
function rebuild(parts,list,k,res){
  const out=parts.slice();
  list.forEach((c,ci)=>{
    const r=res[ci]; const v=r&&(k==="zh"?r.zh_pdf:r[k]);
    if(!v) return;
    const lead=c.raw.match(/^\s*/)[0], trail=c.raw.match(/\s*$/)[0];
    out[c.pi]=lead+esc(String(v))+trail;
  });
  return out.join("");
}

const sec=document.createElement("section");sec.className="page";sec.id="converter";
sec.innerHTML=`<h2>HTML 轉換器<small>貼中文 → 產出各語系</small></h2>
<p class="pagenote">在下面貼上後台「Code」分頁的中文 HTML，按「產生各語系 HTML」。Claude 會逐段找出對應的中文 PDF 段落，再從英／越／印尼文 PDF 取原文替換；PDF 找不到的段落保留中文並標紅，請自行處理。HTML 結構、class、圖片與 {loadmoduleid} 都不會動。</p>
<div class="block conv">
 <label for="zhin" class="fname">中文 HTML</label>
 <textarea id="zhin" spellcheck="false" placeholder="&lt;p class=&quot;title03&quot;&gt;懸吊式洗衣機&lt;/p&gt; …"></textarea>
 <div class="convbar"><button type="button" id="convgo" class="primary">產生各語系 HTML</button><button type="button" id="convstop" hidden>停止</button><span id="convmsg" class="note"></span></div>
 <div id="convout"></div>
</div>`;
main.prepend(sec);
const na=document.createElement("a");na.href="#converter";na.className="htmlnav";na.innerHTML="HTML 轉換器<span>新</span>";nav.prepend(na);

const ta=sec.querySelector("#zhin"),go=sec.querySelector("#convgo"),stop=sec.querySelector("#convstop"),msg=sec.querySelector("#convmsg"),out=sec.querySelector("#convout");
try{const d=localStorage.getItem("zhdraft");if(d)ta.value=d}catch(e){}
ta.addEventListener("input",()=>{try{localStorage.setItem("zhdraft",ta.value)}catch(e){}});

let samplePromise=window.claude?.use?window.claude.use("sample"):Promise.resolve(null);
let ctl=null;
stop.onclick=()=>ctl&&ctl.abort();

go.onclick=async()=>{
  const html=ta.value.trim(); out.innerHTML="";
  if(!html){msg.textContent="請先貼上中文 HTML。";return}
  const {parts,list}=chunks(html);
  if(!list.length){msg.textContent="沒有找到中文文字。";return}
  const sample=await samplePromise;
  if(!sample){msg.textContent="這個檢視無法呼叫 Claude（需在 claude.ai 開啟並允許），轉換器暫時不能用。";return}
  const numbered=list.map((c,i)=>`${i}. ${c.txt}`).join("\n");
  const prompt=`You are matching text on a Chinese product web page to TAKUROX's official printed catalogs, which exist in four languages with identical page layout.

TASK: For each numbered Chinese text chunk from the web page, find the passage in the CHINESE CATALOG that carries the same content (the web wording may differ slightly, be shorter, or combine sentences). Then copy the corresponding passage from each other-language catalog VERBATIM. Never translate or paraphrase yourself — every output string must be copied from the catalog text given below (you may trim it to just the sentences that correspond to the chunk, or join consecutive sentences from the same passage). Short labels (series names, tags, headings) map to the matching heading or name in that language's catalog.
If a chunk has no corresponding content in the Chinese catalog, set match "none" and all language fields to null. If one language's catalog lacks the passage, set that field to null.

Reply with ONLY a JSON array, one object per chunk, in chunk order:
[{"i":0,"match":"exact"|"close"|"none","page":<PDF page number of the Chinese match or null>,"zh_pdf":"<the Chinese catalog text you matched>","en":"...","vi":"...","id":"...","note":"<short note in Traditional Chinese when web text differs from the catalog, else empty>"}]
"exact" = same wording; "close" = same meaning, different wording.

WEB PAGE CHUNKS:
${numbered}

===== CHINESE CATALOG =====
${corpus("zh")}
===== ENGLISH CATALOG =====
${corpus("en")}
===== VIETNAMESE CATALOG =====
${corpus("vi")}
===== INDONESIAN CATALOG =====
${corpus("id")}`;
  go.disabled=true;stop.hidden=false;msg.textContent=`找到 ${list.length} 段中文，Claude 比對中…（約 30–90 秒）`;
  ctl=new AbortController();
  try{
    const res=await sample.json(prompt,{signal:ctl.signal,modelTier:"default"});
    if(!Array.isArray(res)) throw {code:"invalid_json"};
    const byI=[];res.forEach(r=>{if(r&&typeof r.i==="number")byI[r.i]=r});
    render(parts,list,byI);
    const miss=list.filter((c,i)=>!byI[i]||byI[i].match==="none").length;
    msg.textContent=`完成：${list.length} 段，${miss?miss+" 段 PDF 找不到對應（標紅）":"全部找到對應"}。`;
  }catch(e){
    const M={cancelled:"已停止。",not_granted:"沒有允許此頁使用 Claude，轉換器無法使用。",sampling_disabled:"這個帳號無法使用 Claude。",rate_limited:"呼叫太頻繁或已達用量上限，請稍後再試。",invalid_json:"Claude 回傳格式有誤，請再按一次；若一直失敗，請把 HTML 分成幾段貼。",prompt_too_large:"HTML 太長，請分成幾段貼。",refused:"Claude 拒絕了這次請求，請檢查貼上的內容。"};
    msg.textContent=M[e&&e.code]||"連線中斷，請再按一次。";
  }finally{go.disabled=false;stop.hidden=true}
};

function render(parts,list,res){
  out.innerHTML="";
  const card=document.createElement("div");card.className="block";
  OUT.forEach(L=>{
    const row=document.createElement("div");row.className="lrow";
    if(L.k==="th"){row.classList.add("isempty");row.innerHTML=`<div class="ltag">${L.tag}</div><div class="lbody"><p class="empty">尚無泰文 PDF</p></div>`;card.appendChild(row);return}
    const code=rebuild(parts,list,L.k,res);
    let fh=`<div class="fields">`;
    list.forEach((c,ci)=>{
      const r=res[ci]||{match:"none"}; const v=L.k==="zh"?r.zh_pdf:r[L.k];
      const st=r.match==="exact"?["ok","相符"]:r.match==="close"?["chg","近似"]:["chk","無對應"];
      const pg=r.page?`<span class="ref">PDF 第 ${r.page} 頁<small>型錄 ${printed(r.page)}</small></span>`:"";
      fh+=`<div class="frow${v?"":" miss"}"><div class="fmeta"><span class="chip ${v?st[0]:"chk"}">${v?st[1]:"未替換"}</span>${pg}${v?`<button type="button" class="fcopy">複製</button>`:""}</div><div class="ftext orig"></div><div class="ftext new"></div>${r.note&&L.k==="zh"?`<p class="note"></p>`:""}</div>`;
    });
    fh+=`</div>`;
    row.innerHTML=`<div class="ltag">${L.tag}</div><div class="lbody"><div class="lhead"><span class="chip pdf">HTML</span><span class="lw">${L.k==="zh"?"中文已換成 PDF 原文（想保留網站原文就不用貼這份）":"貼到後台對應語系分頁的「Code」"}</span><button type="button" class="hcopy">複製 HTML</button></div><div class="split"><pre class="txt code"></pre>${fh}</div></div>`;
    row.querySelector(".txt").textContent=code;
    row.querySelector(".hcopy").addEventListener("click",e=>copyText(code,e.currentTarget));
    const frows=row.querySelectorAll(".frow");
    list.forEach((c,ci)=>{
      const r=res[ci]||{}; const v=L.k==="zh"?r.zh_pdf:r[L.k]; const fr=frows[ci];
      fr.querySelector(".orig").textContent="網站："+c.txt;
      fr.querySelector(".new").textContent=v?String(v):"（PDF 無對應，保留中文）";
      const n=fr.querySelector(".note"); if(n) n.textContent=r.note;
      const b=fr.querySelector(".fcopy"); if(b) b.addEventListener("click",e=>copyText(String(v),e.currentTarget));
    });
    card.appendChild(row);
  });
  out.appendChild(card);
}
})();
