(() => {
  "use strict";
  const DATA_KEY = "pocket.transactions.v1";
  const THEME_KEY = "pocket.theme.v1";
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const categories = {
    income: ["Gaji", "Uang bulanan", "Bonus", "Freelance", "Investasi", "Lainnya"],
    expense: ["Makanan", "Transportasi", "Kuliah", "Belanja", "Tagihan", "Hiburan", "Kesehatan", "Tempat tinggal", "Lainnya"]
  };
  const icons = {"Gaji":"💼","Uang bulanan":"💵","Bonus":"🎁","Freelance":"💻","Investasi":"📈","Makanan":"🍜","Transportasi":"🚌","Kuliah":"🎓","Belanja":"🛍️","Tagihan":"🧾","Hiburan":"🎮","Kesehatan":"💊","Tempat tinggal":"🏠","Lainnya":"◈"};
  const colors = ["#5965e9","#16a879","#f2a64a","#e56872","#8c63d9","#39a6b7","#e17da8","#81924b","#7c849a"];
  let transactions = load();
  let currentType = "income";
  let editingId = null;
  let currentView = "overview";
  let toastTimer;
  const dialog = $("#transactionDialog");

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DATA_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter(t => t && typeof t.id === "string" && typeof t.name === "string" && Number.isFinite(Number(t.amount))) : [];
    } catch { return []; }
  }
  function save() { localStorage.setItem(DATA_KEY, JSON.stringify(transactions)); }
  function uid() { return crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function esc(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
  function rupiah(value, compact = false) {
    const n = Number(value) || 0;
    if (compact && n >= 1_000_000_000) return `Rp${(n/1_000_000_000).toLocaleString("id-ID",{maximumFractionDigits:1})} M`;
    if (compact && n >= 1_000_000) return `Rp${(n/1_000_000).toLocaleString("id-ID",{maximumFractionDigits:1})} jt`;
    if (compact && n >= 100_000) return `Rp${Math.round(n/1000).toLocaleString("id-ID")} rb`;
    return "Rp" + new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(n);
  }
  function dateText(value, options={day:"numeric",month:"short",year:"numeric"}) {
    if (!value) return "—";
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("id-ID",options).format(d);
  }
  function monthKey(date) { return date.slice(0,7); }
  function currentMonth() { return today().slice(0,7); }
  function monthOptions(select, selected = currentMonth()) {
    const months = new Set([currentMonth(), ...transactions.map(t => monthKey(t.date || today()))]);
    for (let i=0; i<12; i++) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-i); months.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); }
    const sorted = [...months].sort((a,b)=>b.localeCompare(a));
    select.innerHTML = `<option value="all">Semua bulan</option>` + sorted.map(m => `<option value="${m}">${esc(dateText(`${m}-01`,{month:"long",year:"numeric"}))}</option>`).join("");
    select.value = sorted.includes(selected) ? selected : (selected === "all" ? "all" : currentMonth());
  }
  function showToast(msg) { const el=$("#toast"); el.textContent=msg; el.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2300); }
  function total(type, month = null) { return transactions.filter(t=>t.type===type && (!month || monthKey(t.date)===month)).reduce((s,t)=>s+Number(t.amount),0); }
  function categoryName(t) { return t.category || "Lainnya"; }
  function categoryIcon(t) { return icons[categoryName(t)] || "◈"; }

  function updateSummary() {
    const income = total("income"), expense = total("expense");
    $("#balanceValue").textContent = rupiah(income-expense);
    $("#incomeValue").textContent = rupiah(income);
    $("#expenseValue").textContent = rupiah(expense);
  }
  function renderChart() {
    const month = $("#chartMonth").value || currentMonth();
    const expenses = transactions.filter(t=>t.type==="expense" && monthKey(t.date)===month);
    const grouped = {};
    expenses.forEach(t=>grouped[categoryName(t)] = (grouped[categoryName(t)] || 0) + Number(t.amount));
    const entries = Object.entries(grouped).sort((a,b)=>b[1]-a[1]);
    const sum = entries.reduce((s,e)=>s+e[1],0);
    $("#donutTotal").textContent = rupiah(sum, true);
    $("#chartEmpty").classList.toggle("hidden", sum > 0);
    $("#donut").classList.toggle("hidden", sum === 0);
    if (!sum) { $("#donut").style.background = "conic-gradient(var(--line) 0 100%)"; $("#legend").innerHTML = ""; return; }
    let start = 0;
    const slices = entries.map((entry,i) => {
      const end = start + entry[1]/sum*100;
      const slice = `${colors[i%colors.length]} ${start}% ${end}%`;
      start = end;
      return slice;
    });
    $("#donut").style.background = `conic-gradient(${slices.join(",")})`;
    $("#legend").innerHTML = entries.slice(0,6).map(([name,value],i)=>`<div class="legend-item"><span class="legend-dot" style="background:${colors[i%colors.length]}"></span><span class="legend-name">${esc(name)}</span><strong class="legend-value">${rupiah(value,true)}</strong></div>`).join("");
  }
  function renderRecent() {
    const list = [...transactions].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt).slice(0,5);
    $("#recentList").innerHTML = list.map(t=>`<div class="recent-item"><div class="category-icon">${categoryIcon(t)}</div><div class="recent-info"><div class="recent-title">${esc(t.name)}</div><div class="recent-sub">${esc(categoryName(t))} · ${dateText(t.date)}</div></div><div class="recent-amount ${t.type}">${t.type==="income"?"+":"−"}${rupiah(t.amount)}</div></div>`).join("");
    $("#recentEmpty").classList.toggle("hidden", list.length > 0);
    $("#recentList").classList.toggle("hidden", list.length === 0);
  }
  function getFiltered() {
    const q=$("#searchInput").value.trim().toLocaleLowerCase("id");
    const type=$("#typeFilter").value, month=$("#monthFilter").value;
    return [...transactions].filter(t=>(type==="all"||t.type===type)&&(month==="all"||monthKey(t.date)===month)&&(!q||`${t.name} ${t.category} ${t.note||""}`.toLocaleLowerCase("id").includes(q))).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  }
  function renderTable() {
    const list=getFiltered();
    $("#transactionRows").innerHTML=list.map(t=>`<tr><td><div class="transaction-name"><div class="category-icon">${categoryIcon(t)}</div><div><strong>${esc(t.name)}</strong><small>${esc(t.note||"")}</small></div></div></td><td><span class="table-category">${esc(categoryName(t))}</span></td><td>${dateText(t.date)}</td><td class="amount-cell ${t.type}">${t.type==="income"?"+":"−"}${rupiah(t.amount)}</td><td><div class="row-actions"><button data-action="edit" data-id="${esc(t.id)}" title="Edit" aria-label="Edit transaksi">✎</button><button data-action="delete" data-id="${esc(t.id)}" title="Hapus" aria-label="Hapus transaksi">⌫</button></div></td></tr>`).join("");
    $("#tableEmpty").classList.toggle("hidden",list.length>0);
    $(".table-wrap").classList.toggle("hidden",list.length===0);
    $("#transactionCount").textContent=`${list.length} transaksi ditampilkan`;
  }
  function render() {
    updateSummary(); monthOptions($("#monthFilter"), $("#monthFilter").value || "all"); monthOptions($("#chartMonth"), $("#chartMonth").value || currentMonth()); renderChart(); renderRecent(); renderTable();
  }
  function updateCategoryOptions(selected = null) {
    const select=$("#categoryInput");
    select.innerHTML=categories[currentType].map(c=>`<option>${esc(c)}</option>`).join("");
    if (selected && categories[currentType].includes(selected)) select.value=selected;
  }
  function setType(type) {
    currentType=type;
    $$(".type-option").forEach(b=>{b.classList.toggle("selected",b.dataset.type===type);b.classList.toggle("income-option",type==="income");b.classList.toggle("expense-option",type==="expense");});
    updateCategoryOptions();
  }
  function openDialog(t=null) {
    editingId=t?.id||null;
    $("#dialogTitle").textContent=t?"Edit transaksi":"Tambah transaksi";
    $("#saveBtn").textContent=t?"Simpan perubahan":"Simpan transaksi";
    $("#transactionForm").reset();
    setType(t?.type||"income");
    $("#nameInput").value=t?.name||"";
    $("#amountInput").value=t?.amount||"";
    updateCategoryOptions(t?.category||null);
    $("#dateInput").value=t?.date||today();
    $("#noteInput").value=t?.note||"";
    dialog.showModal();
    setTimeout(()=>$("#nameInput").focus(),20);
  }
  function closeDialog(){dialog.close();editingId=null;}
  $("#transactionForm").addEventListener("submit",e=>{
    e.preventDefault();
    const name=$("#nameInput").value.trim(), amount=Number($("#amountInput").value), date=$("#dateInput").value;
    if(!name||!Number.isFinite(amount)||amount<=0||!date){showToast("Periksa nama, jumlah, dan tanggal transaksi.");return;}
    const old=transactions.find(t=>t.id===editingId);
    const t={id:editingId||uid(),type:currentType,name,amount:Math.round(amount),category:$("#categoryInput").value,date,note:$("#noteInput").value.trim(),createdAt:old?.createdAt||Date.now(),updatedAt:Date.now()};
    if(old)transactions=transactions.map(x=>x.id===editingId?t:x);else transactions.push(t);
    save();closeDialog();render();showToast(old?"Transaksi berhasil diperbarui.":"Transaksi berhasil ditambahkan.");
  });
  $$(".type-option").forEach(b=>b.addEventListener("click",()=>setType(b.dataset.type)));
  $("#addBtn").addEventListener("click",()=>openDialog());
  $("#closeBtn").addEventListener("click",closeDialog);
  $("#cancelBtn").addEventListener("click",closeDialog);
  dialog.addEventListener("click",e=>{if(e.target===dialog)closeDialog();});
  $("#transactionRows").addEventListener("click",e=>{
    const btn=e.target.closest("button[data-action]");if(!btn)return;
    const t=transactions.find(x=>x.id===btn.dataset.id);if(!t)return;
    if(btn.dataset.action==="edit")openDialog(t);
    if(btn.dataset.action==="delete"&&confirm(`Hapus transaksi "${t.name}"?`)){transactions=transactions.filter(x=>x.id!==t.id);save();render();showToast("Transaksi dihapus.");}
  });
  $("#searchInput").addEventListener("input",renderTable);
  $("#typeFilter").addEventListener("change",renderTable);
  $("#monthFilter").addEventListener("change",renderTable);
  $("#chartMonth").addEventListener("change",renderChart);
  $("#clearBtn").addEventListener("click",()=>{
    if(!transactions.length){showToast("Belum ada data untuk dihapus.");return;}
    if(confirm("Hapus SEMUA transaksi? Tindakan ini tidak dapat dibatalkan.")){transactions=[];save();render();showToast("Semua transaksi telah dihapus.");}
  });
  function setView(view) {
    currentView=view;
    $$(".side-link").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    if(view==="transactions")$("#allTransactions").scrollIntoView({behavior:"smooth",block:"start"});
    else window.scrollTo({top:0,behavior:"smooth"});
  }
  $$(".side-link").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
  $("#viewAllBtn").addEventListener("click",()=>setView("transactions"));
  function setTheme(theme) {
    document.body.classList.toggle("dark",theme==="dark");
    $("#themeIcon").textContent=theme==="dark"?"☀":"☾";
    $("#themeText").textContent=theme==="dark"?"Mode terang":"Mode gelap";
    localStorage.setItem(THEME_KEY,theme);
  }
  $("#themeBtn").addEventListener("click",()=>setTheme(document.body.classList.contains("dark")?"light":"dark"));
  setTheme(localStorage.getItem(THEME_KEY)||"light");
  $("#dateLabel").textContent=new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date()).toLocaleUpperCase("id");
  render();
})();
