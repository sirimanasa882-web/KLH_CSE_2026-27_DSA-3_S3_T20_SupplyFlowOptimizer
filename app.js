const STORAGE_KEY = "supplyflow_optimizer_v1";
const initialProducts = [
  {id:"p1",name:"Shipping Cartons",sku:"PKG-101",category:"Packaging",price:24,stock:180,reorder:50,demand:[120,135,142,150,148,160]},
  {id:"p2",name:"Protective Wrap",sku:"PKG-102",category:"Packaging",price:18.5,stock:32,reorder:40,demand:[80,82,91,95,104,110]},
  {id:"p3",name:"Barcode Labels",sku:"OPS-201",category:"Operations",price:3.5,stock:920,reorder:200,demand:[420,440,435,460,470,490]},
  {id:"p4",name:"Storage Bins",sku:"WH-301",category:"Warehouse",price:145,stock:24,reorder:30,demand:[24,28,26,31,34,38]},
  {id:"p5",name:"Packing Tape",sku:"PKG-103",category:"Packaging",price:42,stock:76,reorder:35,demand:[60,62,68,65,72,75]},
  {id:"p6",name:"Safety Gloves",sku:"SAFE-401",category:"Safety",price:65,stock:15,reorder:25,demand:[32,35,33,40,42,45]}
];
const initialOrders = [
  {id:"ORD-1001",customer:"Northstar Retail",date:"2026-10-07",items:[{productId:"p1",name:"Shipping Cartons",qty:20,price:24}],total:480,status:"Processing",stockAdjusted:false},
  {id:"ORD-1002",customer:"Metro Stores",date:"2026-10-08",items:[{productId:"p3",name:"Barcode Labels",qty:50,price:3.5}],total:175,status:"Shipped",stockAdjusted:false},
  {id:"ORD-1003",customer:"Greenfield Supplies",date:"2026-10-09",items:[{productId:"p5",name:"Packing Tape",qty:12,price:42}],total:504,status:"Pending",stockAdjusted:false},
  {id:"ORD-1004",customer:"Apex Distribution",date:"2026-10-09",items:[{productId:"p2",name:"Protective Wrap",qty:6,price:18.5}],total:111,status:"Delivered",stockAdjusted:false}
];
const deliveryStops = [
  {id:"d1",name:"Central Warehouse",area:"Starting point",x:0,y:0},
  {id:"d2",name:"Northstar Retail",area:"North district",x:4,y:7},
  {id:"d3",name:"Metro Stores",area:"East district",x:9,y:3},
  {id:"d4",name:"Greenfield Supplies",area:"South district",x:3,y:-5},
  {id:"d5",name:"Apex Distribution",area:"West district",x:-6,y:2},
  {id:"d6",name:"Harbor Outlet",area:"South-east district",x:8,y:-4}
];
let state = loadState();
let categoryChart = null, forecastChart = null, toastTimer = null;
let customerCart = {};

function loadState(){
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if(saved){const parsed=JSON.parse(saved);if(Array.isArray(parsed.products)&&Array.isArray(parsed.orders))return parsed;}
  } catch(e) { console.warn("Could not load saved data",e); }
  return {products:structuredClone(initialProducts),orders:structuredClone(initialOrders)};
}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function escapeHTML(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function money(value){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(value)||0);}
function number(value){return new Intl.NumberFormat("en-IN").format(Number(value)||0);}
function statusClass(status){return String(status).toLowerCase();}
function productById(id){return state.products.find(p=>p.id===id);}
function isLow(p){return p.stock<=p.reorder;}
function showToast(message){const el=document.getElementById("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2800);}
function todayISO(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function alerts(){
  const low=state.products.filter(isLow).map(p=>({type:"low",title:`Low stock: ${p.name}`,detail:`${number(p.stock)} units remaining; reorder level is ${number(p.reorder)}.`}));
  const open=state.orders.filter(o=>["Pending","Processing"].includes(o.status)).map(o=>({type:"order",title:`Order ${o.id} needs follow-up`,detail:`${o.customer} · current status: ${o.status}.`}));
  return [...low,...open];
}
function alertMarkup(items){
  if(!items.length)return '<div class="empty-small">All clear — no alerts to show.</div>';
  return items.map(a=>`<div class="alert-item"><div class="alert-symbol ${a.type==="low"?"red":""}">${a.type==="low"?"!":"↗"}</div><div class="alert-copy"><strong>${escapeHTML(a.title)}</strong><p>${escapeHTML(a.detail)}</p></div></div>`).join("");
}
function renderDashboard(){
  document.getElementById("metric-skus").textContent=number(state.products.length);
  document.getElementById("metric-units").textContent=number(state.products.reduce((s,p)=>s+p.stock,0));
  document.getElementById("metric-orders").textContent=number(state.orders.filter(o=>["Pending","Processing","Shipped"].includes(o.status)).length);
  document.getElementById("metric-low").textContent=number(state.products.filter(isLow).length);
  document.getElementById("dashboard-alerts").innerHTML=alertMarkup(alerts().slice(0,4));
  const recent=[...state.orders].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,5);
  document.getElementById("recent-orders").innerHTML=recent.length?recent.map(o=>`<tr><td><strong>${escapeHTML(o.id)}</strong></td><td>${escapeHTML(o.customer)}</td><td>${o.items.reduce((s,i)=>s+i.qty,0)}</td><td>${money(o.total)}</td><td><span class="pill ${statusClass(o.status)}">${escapeHTML(o.status)}</span></td></tr>`).join(""):'<tr><td colspan="5">No orders yet.</td></tr>';
  const categories={};state.products.forEach(p=>categories[p.category]=(categories[p.category]||0)+p.stock);
  if(categoryChart)categoryChart.destroy();
  categoryChart=new Chart(document.getElementById("category-chart"),{type:"doughnut",data:{labels:Object.keys(categories),datasets:[{data:Object.values(categories),backgroundColor:["#4263eb","#8d7bea","#35b995","#f0ad58","#ed7384","#54a7dc"],borderWidth:0,hoverOffset:5}]},options:{responsive:true,maintainAspectRatio:false,cutout:"67%",plugins:{legend:{position:"bottom",labels:{usePointStyle:true,pointStyle:"circle",padding:17,boxWidth:7,font:{size:10}}}}}});
}
function renderInventory(){
  const query=document.getElementById("inventory-search").value.toLowerCase().trim(),filter=document.getElementById("inventory-filter").value;
  const list=state.products.filter(p=>(`${p.name} ${p.sku} ${p.category}`).toLowerCase().includes(query)&&(filter==="all"||(filter==="low"&&isLow(p))||(filter==="healthy"&&!isLow(p))));
  document.getElementById("inventory-table").innerHTML=list.length?list.map(p=>`<tr><td><span class="product-name">${escapeHTML(p.name)}</span></td><td>${escapeHTML(p.sku)}</td><td>${escapeHTML(p.category)}</td><td>${money(p.price)}</td><td><strong>${number(p.stock)}</strong></td><td>${number(p.reorder)}</td><td><span class="pill ${isLow(p)?"low":"healthy"}">${isLow(p)?"Low stock":"Healthy"}</span></td><td><button class="action-btn" data-edit-product="${p.id}">Edit</button><button class="action-btn danger" data-delete-product="${p.id}">Delete</button></td></tr>`).join(""):'<tr><td colspan="8">No products match your search.</td></tr>';
  document.getElementById("inventory-count").textContent=`Showing ${list.length} of ${state.products.length} products`;
}
function renderOrders(){
  const q=document.getElementById("order-search").value.toLowerCase().trim(),filter=document.getElementById("order-filter").value;
  const list=[...state.orders].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).filter(o=>(`${o.id} ${o.customer}`).toLowerCase().includes(q)&&(filter==="all"||o.status===filter));
  document.getElementById("orders-table").innerHTML=list.length?list.map(o=>`<tr><td><strong>${escapeHTML(o.id)}</strong></td><td>${escapeHTML(o.customer)}</td><td>${escapeHTML(o.date)}</td><td>${o.items.reduce((s,i)=>s+i.qty,0)}</td><td>${money(o.total)}</td><td><span class="pill ${statusClass(o.status)}">${escapeHTML(o.status)}</span></td><td><select aria-label="Update ${escapeHTML(o.id)} status" data-order-status="${o.id}">${["Pending","Processing","Shipped","Delivered","Cancelled"].map(s=>`<option ${o.status===s?"selected":""}>${s}</option>`).join("")}</select></td></tr>`).join(""):'<tr><td colspan="7">No orders match your search.</td></tr>';
  document.getElementById("orders-count").textContent=`Showing ${list.length} of ${state.orders.length} orders`;
}

function productEmoji(category){
 const c=String(category).toLowerCase();if(c.includes("pack"))return "📦";if(c.includes("warehouse"))return "🗃️";if(c.includes("safety"))return "🦺";if(c.includes("operation"))return "🏷️";return "📦";
}
function renderCustomerPortal(){
 const catSelect=document.getElementById("customer-category");if(!catSelect)return;
 const currentCat=catSelect.value||"all",cats=[...new Set(state.products.map(p=>p.category))].sort();
 catSelect.innerHTML='<option value="all">All categories</option>'+cats.map(c=>`<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
 if(cats.includes(currentCat)||currentCat==="all")catSelect.value=currentCat;
 const q=(document.getElementById("customer-search")?.value||"").toLowerCase().trim(),cat=catSelect.value;
 const products=state.products.filter(p=>(`${p.name} ${p.sku} ${p.category}`).toLowerCase().includes(q)&&(cat==="all"||p.category===cat));
 document.getElementById("customer-products").innerHTML=products.length?products.map(p=>`<article class="customer-product"><div class="product-emoji">${productEmoji(p.category)}</div><h3>${escapeHTML(p.name)}</h3><span class="category">${escapeHTML(p.category)} · ${escapeHTML(p.sku)}</span><div class="customer-price">${money(p.price)}</div><div class="available ${p.stock<=p.reorder?"low-available":""}">${p.stock>0?`${number(p.stock)} available`:"Currently out of stock"}</div><div class="add-cart-row"><input type="number" min="1" max="${p.stock}" value="1" aria-label="Quantity for ${escapeHTML(p.name)}" id="cust-qty-${p.id}" ${p.stock<=0?"disabled":""}><button class="button button-primary" data-add-cart="${p.id}" ${p.stock<=0?"disabled":""}>Add to cart</button></div></article>`).join(""):'<div class="empty-small">No products match your search.</div>';
 for(const [id,qty] of Object.entries(customerCart)){const p=productById(id);if(!p||p.stock<=0)delete customerCart[id];else if(qty>p.stock)customerCart[id]=p.stock;}
 const entries=Object.entries(customerCart).filter(([id,qty])=>productById(id)&&qty>0);
 const totalQty=entries.reduce((s,[id,qty])=>s+qty,0),total=entries.reduce((s,[id,qty])=>s+productById(id).price*qty,0);
 document.getElementById("cart-count").textContent=`${totalQty} item${totalQty===1?"":"s"}`;document.getElementById("cart-total").textContent=money(total);
 document.getElementById("customer-cart").innerHTML=entries.length?entries.map(([id,qty])=>{const p=productById(id);return `<div class="cart-line"><div><strong>${escapeHTML(p.name)}</strong><small>${money(p.price)} each · ${money(p.price*qty)}</small></div><div class="cart-line-actions"><button data-cart-minus="${id}" aria-label="Remove one">−</button><span>${qty}</span><button data-cart-plus="${id}" aria-label="Add one" ${qty>=p.stock?"disabled":""}>＋</button><button data-cart-remove="${id}" aria-label="Remove product">×</button></div></div>`;}).join(""):'<div class="empty-small">Your cart is empty. Add a product to begin.</div>';
 document.getElementById("checkout-btn").disabled=!entries.length;
}
function addCustomerCart(id){
 const p=productById(id);if(!p||p.stock<1){showToast("This product is out of stock.");return;}
 const qty=Number(document.getElementById(`cust-qty-${id}`)?.value||1);
 if(!Number.isInteger(qty)||qty<1){showToast("Enter a valid quantity.");return;}
 if((customerCart[id]||0)+qty>p.stock){showToast(`Only ${p.stock} units are available. Your cart already has ${customerCart[id]||0}.`);return;}
 customerCart[id]=(customerCart[id]||0)+qty;renderCustomerPortal();showToast(`${p.name} added to cart.`);
}
function openCheckout(){
 const entries=Object.entries(customerCart).filter(([id,qty])=>productById(id)&&qty>0);
 if(!entries.length){showToast("Add at least one product to your cart.");return;}
 if(entries.some(([id,qty])=>qty>productById(id).stock)){showToast("Cart quantity exceeds stock. Review your cart.");renderCustomerPortal();return;}
 const total=entries.reduce((s,[id,qty])=>s+productById(id).price*qty,0);
 document.getElementById("checkout-items-count").textContent=entries.reduce((s,[id,qty])=>s+qty,0);document.getElementById("checkout-total").textContent=money(total);document.getElementById("checkout-backdrop").hidden=false;
}
function closeCheckout(){document.getElementById("checkout-backdrop").hidden=true;}

function renderRoutes(){
  document.getElementById("route-stop-list").innerHTML=deliveryStops.map((s,i)=>`<label class="stop-item"><input type="checkbox" value="${s.id}" ${i<4?"checked":""}><span class="stop-num">${i+1}</span><span class="stop-details"><strong>${escapeHTML(s.name)}</strong><small>${escapeHTML(s.area)}</small></span></label>`).join("");
}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function routeDistance(route){let total=0;for(let i=1;i<route.length;i++)total+=distance(route[i-1],route[i]);return total;}
function renderForecast(){
  const products=state.products;
  document.getElementById("forecast-table").innerHTML=products.map(p=>{const forecast=Math.max(0,Math.ceil(p.demand.slice(-3).reduce((a,b)=>a+b,0)/Math.max(1,p.demand.slice(-3).length)));const reorder=Math.max(0,forecast-p.stock);return `<tr><td><span class="product-name">${escapeHTML(p.name)}</span><span class="subline">${escapeHTML(p.sku)}</span></td><td>${number(p.stock)}</td><td>${number(forecast)}</td><td><strong>${number(reorder)}</strong></td><td><span class="pill ${reorder>0?"pending":"healthy"}">${reorder>0?"Consider reorder":"Stock sufficient"}</span></td></tr>`;}).join("");
  const first=products[0];const history=first?first.demand:[];
  const labels=["Apr","May","Jun","Jul","Aug","Sep","Oct (forecast)"];
  const forecast=history.length?Math.ceil(history.slice(-3).reduce((a,b)=>a+b,0)/Math.min(3,history.length)):0;
  const chartData=history.slice(-6).concat(forecast);
  if(forecastChart)forecastChart.destroy();
  forecastChart=new Chart(document.getElementById("forecast-chart"),{type:"line",data:{labels:labels.slice(-chartData.length),datasets:[{label:first?`${first.name} demand`:"Demand",data:chartData,borderColor:"#4263eb",backgroundColor:"#4263eb20",fill:true,tension:.3,pointRadius:4,pointBackgroundColor:"#4263eb"}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:"#edf0f5"},ticks:{font:{size:10}}},x:{grid:{display:false},ticks:{font:{size:10}}}}}});
}
function renderReports(){
  const stockValue=state.products.reduce((s,p)=>s+p.stock*p.price,0);
  const delivered=state.orders.filter(o=>o.status==="Delivered").length;
  const orderValue=state.orders.filter(o=>o.status!=="Cancelled").reduce((s,o)=>s+o.total,0);
  document.getElementById("report-value").textContent=money(stockValue);
  document.getElementById("report-delivered").textContent=number(delivered);
  document.getElementById("report-order-value").textContent=money(orderValue);
  const a=alerts();document.getElementById("all-alerts").innerHTML=alertMarkup(a);document.getElementById("alert-count-tag").textContent=`${a.length} ALERT${a.length===1?"":"S"}`;
}
function renderAll(){renderDashboard();renderInventory();renderOrders();renderRoutes();renderForecast();renderReports();renderCustomerPortal();}
const pageMeta={dashboard:["OVERVIEW","Dashboard"],inventory:["OPERATIONS","Inventory"],orders:["OPERATIONS","Orders"],customer:["CUSTOMER EXPERIENCE","Customer Portal"],routes:["LOGISTICS","Route Optimizer"],forecast:["PLANNING","Demand Forecast"],reports:["INSIGHTS","Reports & Alerts"]};
function goToPage(page){
  if(!pageMeta[page])return;
  document.querySelectorAll(".page").forEach(el=>el.classList.toggle("active",el.id===`page-${page}`));
  document.querySelectorAll(".nav-item").forEach(el=>el.classList.toggle("active",el.dataset.page===page));
  document.getElementById("page-eyebrow").textContent=pageMeta[page][0];document.getElementById("page-title").textContent=pageMeta[page][1];
  if(page==="dashboard")renderDashboard();if(page==="inventory")renderInventory();if(page==="orders")renderOrders();if(page==="customer")renderCustomerPortal();if(page==="forecast")renderForecast();if(page==="reports")renderReports();
}
function openProductModal(product=null){
  document.getElementById("product-form").reset();document.getElementById("product-id").value=product?.id||"";
  document.getElementById("modal-title").textContent=product?"Edit product":"Add product";
  document.getElementById("modal-subtitle").textContent=product?"Update product details and stock level.":"Enter the details below.";
  if(product){document.getElementById("product-name").value=product.name;document.getElementById("product-sku").value=product.sku;document.getElementById("product-category").value=product.category;document.getElementById("product-price").value=product.price;document.getElementById("product-stock").value=product.stock;document.getElementById("product-reorder").value=product.reorder;}
  document.getElementById("modal-backdrop").hidden=false;document.getElementById("product-name").focus();
}
function closeProductModal(){document.getElementById("modal-backdrop").hidden=true;}
function nextOrderId(){const max=state.orders.reduce((m,o)=>Math.max(m,Number(o.id.replace(/\D/g,""))||1000),1000);return `ORD-${max+1}`;}
function updateOrderPrice(){const p=productById(document.getElementById("order-product").value);document.getElementById("order-unit-price").value=p?money(p.price):"—";document.getElementById("order-total-preview").textContent=money((p?.price||0)*(Number(document.getElementById("order-quantity").value)||0));}
function openOrderModal(){
  if(!state.products.length){showToast("Add a product before creating an order.");goToPage("inventory");return;}
  const select=document.getElementById("order-product");
  select.innerHTML=state.products.filter(p=>p.stock>0).map(p=>`<option value="${p.id}">${escapeHTML(p.name)} — ${number(p.stock)} available</option>`).join("");
  if(!select.options.length){showToast("No stock is available to order.");return;}
  document.getElementById("order-form").reset();select.value=state.products.find(p=>p.stock>0).id;document.getElementById("order-quantity").max=productById(select.value).stock;updateOrderPrice();
  document.getElementById("order-modal-backdrop").hidden=false;
}
function closeOrderModal(){document.getElementById("order-modal-backdrop").hidden=true;}
function downloadCSV(filename,rows){
  const csv=rows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);showToast("CSV export downloaded.");
}
function exportInventory(){downloadCSV("supplyflow-inventory.csv",[["Product","SKU","Category","Unit Price INR","Stock","Reorder Level","Status"],...state.products.map(p=>[p.name,p.sku,p.category,p.price,p.stock,p.reorder,isLow(p)?"Low stock":"Healthy"])]);}
function exportOrders(){downloadCSV("supplyflow-orders.csv",[["Order ID","Customer","Date","Items","Total INR","Status"],...state.orders.map(o=>[o.id,o.customer,o.date,o.items.map(i=>`${i.name} x${i.qty}`).join("; "),o.total,o.status])]);}

document.getElementById("today-label").textContent=new Intl.DateTimeFormat("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(new Date());
document.getElementById("nav").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)goToPage(b.dataset.page);});
document.addEventListener("click",e=>{const go=e.target.closest("[data-go]");if(go)goToPage(go.dataset.go);
  const edit=e.target.closest("[data-edit-product]");if(edit){const p=productById(edit.dataset.editProduct);if(p)openProductModal(p);}
  const del=e.target.closest("[data-delete-product]");if(del){const p=productById(del.dataset.deleteProduct);if(!p)return;const used=state.orders.some(o=>o.status!=="Cancelled"&&o.items.some(i=>i.productId===p.id));if(used){showToast("Cannot delete: this product is used by an active order.");return;}if(confirm(`Delete ${p.name}?`)){state.products=state.products.filter(x=>x.id!==p.id);saveState();renderAll();showToast("Product deleted.");}}
});
document.getElementById("inventory-search").addEventListener("input",renderInventory);
document.getElementById("inventory-filter").addEventListener("change",renderInventory);
document.getElementById("order-search").addEventListener("input",renderOrders);
document.getElementById("order-filter").addEventListener("change",renderOrders);
document.getElementById("add-product-btn").addEventListener("click",()=>openProductModal());
document.getElementById("modal-close").addEventListener("click",closeProductModal);
document.getElementById("product-cancel").addEventListener("click",closeProductModal);
document.getElementById("modal-backdrop").addEventListener("click",e=>{if(e.target.id==="modal-backdrop")closeProductModal();});
document.getElementById("product-form").addEventListener("submit",e=>{
  e.preventDefault();const id=document.getElementById("product-id").value,sku=document.getElementById("product-sku").value.trim();
  if(state.products.some(p=>p.sku.toLowerCase()===sku.toLowerCase()&&p.id!==id)){showToast("That SKU already exists. Please use a unique SKU.");return;}
  const p={id:id||`p${Date.now()}`,name:document.getElementById("product-name").value.trim(),sku,category:document.getElementById("product-category").value.trim(),price:Number(document.getElementById("product-price").value),stock:Number(document.getElementById("product-stock").value),reorder:Number(document.getElementById("product-reorder").value),demand:productById(id)?.demand||[20,22,24,26,28,30]};
  if(!p.name||!p.sku||!p.category||p.price<0||p.stock<0||p.reorder<0){showToast("Please enter valid product details.");return;}
  const idx=state.products.findIndex(x=>x.id===id);if(idx>=0)state.products[idx]=p;else state.products.push(p);
  saveState();closeProductModal();renderAll();showToast(idx>=0?"Product updated successfully.":"Product added successfully.");
});
document.getElementById("add-order-btn").addEventListener("click",openOrderModal);
document.getElementById("order-modal-close").addEventListener("click",closeOrderModal);
document.getElementById("order-cancel").addEventListener("click",closeOrderModal);
document.getElementById("order-modal-backdrop").addEventListener("click",e=>{if(e.target.id==="order-modal-backdrop")closeOrderModal();});
document.getElementById("order-product").addEventListener("change",()=>{const p=productById(document.getElementById("order-product").value);document.getElementById("order-quantity").max=p?.stock||1;updateOrderPrice();});
document.getElementById("order-quantity").addEventListener("input",updateOrderPrice);
document.getElementById("order-form").addEventListener("submit",e=>{
  e.preventDefault();const p=productById(document.getElementById("order-product").value),qty=Number(document.getElementById("order-quantity").value),customer=document.getElementById("order-customer").value.trim();
  if(!p||!customer||!Number.isInteger(qty)||qty<1){showToast("Enter a customer and valid quantity.");return;}
  if(qty>p.stock){showToast(`Only ${p.stock} units are available.`);return;}
  p.stock-=qty;state.orders.push({id:nextOrderId(),customer,date:todayISO(),items:[{productId:p.id,name:p.name,qty,price:p.price}],total:qty*p.price,status:"Pending",stockAdjusted:true});
  saveState();closeOrderModal();renderAll();showToast("Order created and stock updated.");
});
document.getElementById("orders-table").addEventListener("change",e=>{
  const sel=e.target.closest("[data-order-status]");if(!sel)return;const o=state.orders.find(x=>x.id===sel.dataset.orderStatus);if(!o)return;const next=sel.value,prev=o.status;
  if(prev==="Cancelled"&&next!=="Cancelled"&&o.stockAdjusted){const item=o.items[0],p=productById(item.productId);if(!p||p.stock<item.qty){showToast("Cannot reopen: insufficient stock.");sel.value=prev;return;}p.stock-=item.qty;}
  if(next==="Cancelled"&&prev!=="Cancelled"&&o.stockAdjusted){const item=o.items[0],p=productById(item.productId);if(p)p.stock+=item.qty;}
  o.status=next;saveState();renderAll();showToast(`Order ${o.id} updated to ${next}.`);
});
document.getElementById("optimize-route").addEventListener("click",()=>{
  const ids=[...document.querySelectorAll("#route-stop-list input:checked")].map(x=>x.value);
  if(ids.length<2){showToast("Select at least two stops.");return;}
  const selected=ids.map(id=>deliveryStops.find(s=>s.id===id)),start=selected.find(s=>s.id==="d1")||selected[0];
  const remaining=selected.filter(s=>s.id!==start.id),optimized=[start];let current=start;
  while(remaining.length){let bestIndex=0,bestDistance=Infinity;remaining.forEach((s,i)=>{const d=distance(current,s);if(d<bestDistance){bestDistance=d;bestIndex=i;}});current=remaining.splice(bestIndex,1)[0];optimized.push(current);}
  const original=[start,...selected.filter(s=>s.id!==start.id)];
  const oldD=routeDistance(original),newD=routeDistance(optimized),saved=oldD?Math.max(0,(oldD-newD)/oldD*100):0;
  document.getElementById("route-empty").hidden=true;const out=document.getElementById("route-output");out.hidden=false;
  out.innerHTML=`<div class="route-summary"><div class="route-stat"><span>Original distance units</span><strong>${oldD.toFixed(1)}</strong></div><div class="route-stat improved"><span>Suggested distance units</span><strong>${newD.toFixed(1)}</strong></div><div class="route-stat improved"><span>Estimated reduction</span><strong>${saved.toFixed(1)}%</strong></div><div class="route-stat"><span>Stops included</span><strong>${optimized.length}</strong></div></div><h4 style="font-size:12px;margin:0 0 11px">Suggested delivery sequence</h4><div class="route-sequence">${optimized.map((s,i)=>`<div class="route-stop-result"><span class="stop-num">${i+1}</span><div><strong>${escapeHTML(s.name)}</strong><small>${i===0?"Start point":escapeHTML(s.area)}</small></div></div>`).join("")}</div><p class="helper-text">Distance is calculated from fictional x/y coordinates. The percentage compares the selected original sequence with the suggested sequence; real-world driving distances may differ.</p>`;
});
document.getElementById("run-forecast").addEventListener("click",()=>{renderForecast();showToast("Forecast recalculated using the latest product data.");});
document.getElementById("export-inventory").addEventListener("click",exportInventory);
document.getElementById("export-orders").addEventListener("click",exportOrders);

document.getElementById("customer-search").addEventListener("input",renderCustomerPortal);
document.getElementById("customer-category").addEventListener("change",renderCustomerPortal);
document.getElementById("customer-products").addEventListener("click",e=>{const b=e.target.closest("[data-add-cart]");if(b)addCustomerCart(b.dataset.addCart);});
document.getElementById("customer-cart").addEventListener("click",e=>{
 const minus=e.target.closest("[data-cart-minus]"),plus=e.target.closest("[data-cart-plus]"),remove=e.target.closest("[data-cart-remove]");
 if(minus){const id=minus.dataset.cartMinus;customerCart[id]=(customerCart[id]||0)-1;if(customerCart[id]<=0)delete customerCart[id];renderCustomerPortal();}
 if(plus){const id=plus.dataset.cartPlus,p=productById(id);if(p&&(customerCart[id]||0)<p.stock)customerCart[id]=(customerCart[id]||0)+1;else showToast("No more stock available.");renderCustomerPortal();}
 if(remove){delete customerCart[remove.dataset.cartRemove];renderCustomerPortal();}
});
document.getElementById("checkout-btn").addEventListener("click",openCheckout);
document.getElementById("checkout-close").addEventListener("click",closeCheckout);
document.getElementById("checkout-cancel").addEventListener("click",closeCheckout);
document.getElementById("checkout-backdrop").addEventListener("click",e=>{if(e.target.id==="checkout-backdrop")closeCheckout();});
document.getElementById("checkout-form").addEventListener("submit",e=>{
 e.preventDefault();const customer=document.getElementById("checkout-customer").value.trim(),address=document.getElementById("checkout-address").value.trim(),contact=document.getElementById("checkout-contact").value.trim();
 const entries=Object.entries(customerCart).filter(([id,qty])=>productById(id)&&qty>0);
 if(!customer||!address||!entries.length){showToast("Enter customer name, delivery address and add products.");return;}
 if(entries.some(([id,qty])=>qty>productById(id).stock)){showToast("Stock changed; review your cart.");renderCustomerPortal();return;}
 const items=entries.map(([id,qty])=>{const p=productById(id);return {productId:id,name:p.name,qty,price:p.price};});
 items.forEach(i=>{productById(i.productId).stock-=i.qty;});
 const total=items.reduce((s,i)=>s+i.qty*i.price,0);
 const order={id:nextOrderId(),customer,date:todayISO(),items,total,status:"Pending",stockAdjusted:true,deliveryAddress:address,contact,source:"Customer Portal"};
 state.orders.push(order);customerCart={};saveState();closeCheckout();document.getElementById("checkout-form").reset();renderAll();goToPage("orders");showToast(`Order ${order.id} placed successfully! It is now visible in Orders.`);
});

document.getElementById("reset-demo").addEventListener("click",()=>{if(confirm("Reset all products and orders to the original demo data? Your browser-saved changes will be removed.")){state={products:structuredClone(initialProducts),orders:structuredClone(initialOrders)};customerCart={};saveState();renderAll();goToPage("dashboard");document.getElementById("route-output").hidden=true;document.getElementById("route-empty").hidden=false;showToast("Demo data has been reset.");}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeProductModal();closeOrderModal();}});
saveState();renderAll();
