const localToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const state={user:null,view:"passenger",routes:[],trips:[],bookings:[],buses:[],drivers:[],adminTab:"trips",authRole:"passenger",date:localToday(),source:"Mumbai",destination:"Pune",selectedTrip:null,selectedSeats:[],hold:null,driverWatch:null,liveTrip:null,liveLocation:null,map:null,busMarker:null,stream:null};
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const safe=(value)=>String(value??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const money=(value)=>`₹${Number(value||0).toLocaleString("en-IN")}`;
let toastTimer;

async function api(path,options={}){
  const headers={...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})};
  const response=await fetch(path,{...options,headers,credentials:"same-origin",cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||"The request could not be completed.");
  return data;
}
const post=(path,body)=>api(path,{method:"POST",body:JSON.stringify(body)});
const patch=(path,body)=>api(path,{method:"PATCH",body:JSON.stringify(body)});
function toast(message){const node=$("#toast");node.textContent=message;node.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove("show"),3200);}
function setShellUser(){
  const copy=$(".profile-copy");const avatar=$(".profile .avatar");
  if(!state.user){if(copy){copy.querySelector("strong").textContent="Signed out";copy.querySelector("span").textContent="SmartBus account";}if(avatar)avatar.textContent="SB";$(".avatar-small").textContent="";$("#login").hidden=false;$("#login-sidebar").hidden=false;$("#logout").hidden=true;$$("[data-view]").forEach((button)=>{button.hidden=button.dataset.view!=="passenger";});return;}
  $("#login").hidden=true;$("#login-sidebar").hidden=true;
  $("#logout").hidden=false;
  if(copy){copy.querySelector("strong").textContent=state.user.name;copy.querySelector("span").textContent=state.user.role[0].toUpperCase()+state.user.role.slice(1);}
  if(avatar)avatar.textContent=state.user.name.split(/\s+/).map((part)=>part[0]).join("").slice(0,2).toUpperCase();
  $(".avatar-small").textContent=avatar?.textContent||"";
  $$("[data-view]").forEach((button)=>{const view=button.dataset.view;button.hidden=state.user.role==="passenger"?!["passenger","tickets"].includes(view):state.user.role==="driver"?view!=="driver":false;});
}
function setAuthMode(register){
  state.authRegister=register;$$('.register-field').forEach((field)=>{field.hidden=!register;const input=field.querySelector("input");if(input)input.required=register;});
  $("#auth-roles").hidden=register;$("#dialog-title").textContent=register?"Create a passenger account":`Log in as ${state.authRole}`;$("#auth-description").textContent=register?"Sign up to reserve a seat and manage your tickets.":"Choose your account type, then enter your credentials.";$("#auth-submit").textContent=register?"Create account":"Log in";$("#auth-switch").textContent=register?"Already have an account? Sign in":"Create a passenger account";$("#auth-password").autocomplete=register?"new-password":"current-password";$$(`[data-auth-role]`).forEach((button)=>button.setAttribute("aria-pressed",String(button.dataset.authRole===state.authRole)));
}
function authDialog(register=true){
  const dialog=$("#booking-dialog");dialog.className="booking-dialog auth-dialog";
  dialog.innerHTML=`<div class="dialog-head"><div><span class="eyebrow">SmartBus</span><h2 id="dialog-title">Create a passenger account</h2><p id="auth-description">Sign up to reserve a seat and manage your tickets.</p></div></div><div class="dialog-body"><form id="auth-form" class="form-grid"><div class="auth-roles" id="auth-roles" role="group" aria-label="Log in as"><button type="button" data-auth-role="passenger" aria-pressed="true">Log in as Passenger</button><button type="button" data-auth-role="driver" aria-pressed="false">Log in as Driver</button><button type="button" data-auth-role="admin" aria-pressed="false">Log in as Admin</button></div><div class="field register-field"><label for="auth-name">Name</label><input id="auth-name" name="name" required maxlength="80" autocomplete="name"></div><div class="field register-field"><label for="auth-phone">Phone</label><input id="auth-phone" name="phone" maxlength="24" autocomplete="tel"></div><div class="field"><label for="auth-email">Email</label><input id="auth-email" name="email" type="email" required maxlength="254" autocomplete="email"></div><div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></div><p class="form-error" id="auth-error"></p><button class="primary-button" id="auth-submit">Create account</button><button class="text-button" id="auth-switch" type="button">Already have an account? Sign in</button></form></div>`;
  setAuthMode(register);dialog.oncancel=null;dialog.showModal();
}
function showTrip(trip){return {id:trip.id,operator:trip.bus_name,initials:(trip.bus_name||"SB").split(/\s+/).map((part)=>part[0]).join("").slice(0,2).toUpperCase(),vehicle:trip.bus_type,bus:trip.bus,from:trip.source,to:trip.destination,depart:trip.departure_time,arrive:trip.arrival_time,duration:"—",fare:trip.fare,remainingSeats:trip.remainingSeats,journeyDate:trip.journey_date,status:trip.status,stops:trip.stops||[],location:trip.location||null};}
function routeOptions(){return state.routes.map((route)=>route.source);}
function destinationOptions(){return [...new Set(state.routes.filter((item)=>item.source===state.source).map((route)=>route.destination))];}
async function loadRoutes(){state.routes=(await api("/api/routes")).routes;}
async function loadTrips(){const params=new URLSearchParams({from:state.source,to:state.destination,date:state.date});state.trips=(await api(`/api/trips?${params}`)).trips.map(showTrip);}
function routeMapMarkup(id="route-map"){return `<div class="route-map real-map" id="${id}" aria-label="Interactive bus route map"><span class="map-loading">Loading map…</span></div>`;}
let leafletPromise;
function loadLeaflet(){
  if(window.L)return Promise.resolve(window.L);if(leafletPromise)return leafletPromise;
  leafletPromise=new Promise((resolve,reject)=>{
    if(!document.querySelector("#leaflet-css")){const css=document.createElement("link");css.id="leaflet-css";css.rel="stylesheet";css.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.append(css);}
    const script=document.createElement("script");script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";script.onload=()=>resolve(window.L);script.onerror=()=>reject(new Error("The map library could not be loaded."));document.head.append(script);
  });return leafletPromise;
}
async function mountMap(elementId,trip,location){
  const node=$(`#${elementId}`);if(!node||!trip)return;
  try{
    const L=await loadLeaflet();if(!node.isConnected)return;
    if(state.map){state.map.remove();state.map=null;state.busMarker=null;}
    node.innerHTML="";const points=trip.stops.map((stop)=>[Number(stop.latitude),Number(stop.longitude)]);
    const center=points.length?points[Math.floor(points.length/2)]:[19.076,72.8777];
    state.map=L.map(node,{scrollWheelZoom:false}).setView(center,8);
    const tileUrl=document.body.dataset.mapTiles||"https://tile.openstreetmap.org/{z}/{x}/{y}.png";const attribution=document.body.dataset.mapAttribution||'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>';
    L.tileLayer(tileUrl,{maxZoom:19,attribution}).addTo(state.map);
    if(points.length){L.polyline(points,{color:"#267253",weight:4,opacity:.82}).addTo(state.map);trip.stops.forEach((stop,index)=>L.circleMarker([stop.latitude,stop.longitude],{radius:5,color:"#fff",weight:2,fillColor:"#397d62",fillOpacity:1}).bindTooltip(`${index+1}. ${safe(stop.stop_name)}`).addTo(state.map));state.map.fitBounds(points,{padding:[24,24]});}
    if(location?.latitude!=null){state.busMarker=L.circleMarker([location.latitude,location.longitude],{radius:9,color:"#fff",weight:3,fillColor:"#e2a550",fillOpacity:1}).bindTooltip(`Bus · GPS ±${Math.round(location.accuracy)} m`).addTo(state.map);if(!points.length)state.map.setView([location.latitude,location.longitude],13);}
    setTimeout(()=>state.map?.invalidateSize(),80);
  }catch{node.innerHTML='<div class="map-error">Map tiles unavailable. Location coordinates remain available below.</div>';}
}
function closeStream(){state.stream?.close();state.stream=null;state.liveTrip=null;}
function streamTrip(trip){
  if(!trip||state.liveTrip===trip.id)return;closeStream();state.liveTrip=trip.id;
  state.stream=new EventSource(`/api/trips/${encodeURIComponent(trip.id)}/location/stream`);
  state.stream.onmessage=(event)=>{try{const packet=JSON.parse(event.data);state.liveLocation=packet.location;const node=$("#gps-status");if(node)node.textContent=`GPS fix · ${new Date(packet.location.recorded_at).toLocaleTimeString()} · ±${Math.round(packet.location.accuracy)} m`;if(state.map&&state.busMarker)state.busMarker.setLatLng([packet.location.latitude,packet.location.longitude]);else if(state.map)state.busMarker=window.L.circleMarker([packet.location.latitude,packet.location.longitude],{radius:9,color:"#fff",weight:3,fillColor:"#e2a550",fillOpacity:1}).addTo(state.map);}catch{}};
  state.stream.addEventListener("status",()=>{closeStream();const node=$("#gps-status");if(node)node.textContent="Trip ended · live sharing stopped";});
  state.stream.onerror=()=>{const node=$("#gps-status");if(node)node.textContent="Reconnecting to the live location feed…";};
}
function renderPassenger(){
  const sources=[...new Set(state.routes.map((route)=>route.source))];const destinations=destinationOptions();
  const trip=state.trips[0];const active=state.trips.find((item)=>item.status==="active");const mapMarkup=active?`<div class="route-map no-map"><span>Live bus location is shown below.</span></div>`:trip?routeMapMarkup():`<div class="route-map no-map"><span>No trips on this route and date.</span></div>`;
  return `<div class="page"><div class="hero-row"><div class="intro-panel"><span class="eyebrow">A better way to get there</span><h1 class="page-heading">The road ahead,<br>without the guesswork.</h1><p class="page-subtitle">Find your bus, follow its journey, and save your seat before you leave.</p><form class="route-search" id="search-form"><div class="field"><label for="source">From</label><select id="source" name="source">${sources.map((city)=>`<option ${city===state.source?"selected":""}>${safe(city)}</option>`).join("")}</select></div><div class="field"><label for="destination">To</label><select id="destination" name="destination">${destinations.map((city)=>`<option ${city===state.destination?"selected":""}>${safe(city)}</option>`).join("")}</select></div><div class="field"><label for="journey-date">Journey date</label><input id="journey-date" name="date" type="date" min="${localToday()}" value="${safe(state.date)}"></div><button class="primary-button search-button" type="submit">Find buses</button></form></div>${mapMarkup}</div><div class="section-row"><div><h2 class="section-title">Buses on this route</h2><div class="section-caption">${safe(state.source)} to ${safe(state.destination)} · ${new Date(`${state.date}T12:00:00`).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}</div></div></div><div class="trip-list">${state.trips.length?state.trips.map((item)=>`<article class="trip-row"><div class="trip-operator"><div class="operator-mark">${safe(item.initials)}</div><div><strong>${safe(item.operator)}</strong><span>${safe(item.vehicle)} · ${safe(item.bus)}</span></div></div><div class="trip-time"><strong>${safe(item.depart)} <span class="time-route"><i></i>${safe(item.arrive)}</span></strong><span>${safe(item.from)} → ${safe(item.to)} · ${safe(item.journeyDate)}</span></div><div class="trip-class"><strong>${item.remainingSeats} seats left</strong>${item.status==="active"?'<span class="badge">Live GPS</span>':"Scheduled"}</div><div class="trip-price"><strong>${money(item.fare)}</strong><span>per passenger</span></div><button class="primary-button small-button" data-book="${safe(item.id)}" ${item.remainingSeats<1?"disabled":""}>Choose seat</button></article>`).join(""):`<div class="no-results"><strong>No trips for this date</strong>Try another date or ask the operator to schedule service.</div>`}</div>${active?`<div class="two-column"><section class="panel"><div class="panel-heading"><h3>Live bus location</h3><span class="live-label"><i></i> Active trip</span></div>${routeMapMarkup("live-map")}<p id="gps-status" class="section-caption">Waiting for the next location update…</p></section><section class="panel"><div class="panel-heading"><h3>Current service</h3><span>${safe(active.operator)}</span></div><div class="activity-row"><div class="activity-icon">⌖</div><div class="activity-copy"><strong>${safe(active.bus)}</strong><span>${safe(active.from)} → ${safe(active.to)}</span></div></div><div class="notice-banner">The last GPS update is treated as stale after two minutes.</div></section></div>`:""}<div class="stats-strip"><div class="stat-item"><div class="stat-symbol">⌖</div><div><strong>Driver GPS tracking</strong><span>Active trips only</span></div></div><div class="stat-item"><div class="stat-symbol">▣</div><div><strong>Seats held for checkout</strong><span>10 minute reservation</span></div></div><div class="stat-item"><div class="stat-symbol">✓</div><div><strong>Digital ticket</strong><span>Available after payment</span></div></div></div></div>`;
}
async function openPassenger(){
  await loadRoutes();if(!state.routes.some((route)=>route.source===state.source)){state.source=state.routes[0]?.source||"";state.destination=state.routes[0]?.destination||"";}
  await loadTrips();$("#app-view").innerHTML=renderPassenger();const active=state.trips.find((trip)=>trip.status==="active");if(active){const detailed=await api(`/api/trips/${encodeURIComponent(active.id)}`);active.stops=detailed.trip.stops;await mountMap("live-map",active,active.location);streamTrip(active);}else if(state.trips[0])await mountMap("route-map",state.trips[0]);
}
async function renderTickets(){
  const {bookings}=await api("/api/bookings");state.bookings=bookings;
  $("#app-view").innerHTML=`<div class="page"><div class="role-header"><div><span class="eyebrow">Your journeys</span><h1 class="page-heading">My tickets</h1><p class="page-subtitle">Confirmed bookings and current payment status.</p></div><button class="quiet-button" data-view="passenger">Find a bus</button></div>${bookings.length?`<div class="trip-list">${bookings.map((b)=>`<article class="trip-row"><div class="trip-operator"><div class="operator-mark">${safe(b.source?.slice(0,2).toUpperCase())}</div><div><strong>${safe(b.source)} → ${safe(b.destination)}</strong><span>${safe(b.journey_date)} · ${safe(b.bus)}</span></div></div><div class="trip-time"><strong>${safe(b.departure_time)}</strong><span>${safe(b.passenger_name)}</span></div><div class="trip-class"><strong>${safe((b.seats||[]).join(", ")||"Payment pending")}</strong>Seats</div><div class="trip-price"><strong>${money(b.total_paise/100)}</strong><span>${safe(b.reference)}</span></div><button class="primary-button small-button" data-ticket="${safe(b.id)}" ${b.status!=="confirmed"?"disabled":""}>${b.status==="confirmed"?"View ticket":"Payment pending"}</button></article>`).join("")}</div>`:`<div class="no-results"><strong>No tickets yet</strong>Your confirmed trips will show up here.</div>`}</div>`;
}
function driverMapTrip(trip){return {...trip,from:trip.source,to:trip.destination,depart:trip.departure_time,arrive:trip.arrival_time,bus:trip.registration_number,vehicle:trip.bus_type,operator:trip.bus_name,fare:trip.fare_paise/100,journeyDate:trip.journey_date};}
async function renderDriver(){
  const {trips}=await api("/api/driver/trips");state.trips=trips.map(driverMapTrip);let trip=state.trips.find((item)=>item.status==="active")||state.trips[0];
  if(!trip){$("#app-view").innerHTML=`<div class="page"><div class="role-header"><div><span class="eyebrow">Driver workspace</span><h1 class="page-heading">Your assigned trips</h1></div></div><div class="no-results"><strong>No scheduled trip assigned</strong>Ask the operator to assign a trip to your driver account.</div></div>`;return;}
  const details=(await api(`/api/trips/${encodeURIComponent(trip.id)}`)).trip;trip.stops=details.stops;
  const locationResult=await api(`/api/trips/${encodeURIComponent(trip.id)}/location`);state.liveLocation=locationResult.location;
  const active=trip.status==="active";
  $("#app-view").innerHTML=`<div class="page"><div class="role-header"><div><span class="eyebrow">Driver workspace · ${safe(trip.journeyDate)}</span><h1 class="page-heading">Assigned service</h1><p class="page-subtitle">Start the assigned trip to enable location sharing.</p></div></div><section class="driver-hero"><div><span class="driver-kicker">${active?"TRIP IN PROGRESS":"ASSIGNED TRIP"}</span><h2>${safe(trip.from)} to ${safe(trip.to)}</h2><p>${safe(trip.depart)} departure · ${safe(trip.vehicle)} · ${safe(trip.id)}</p>${active?`<button class="danger-button" id="end-trip" data-trip-id="${safe(trip.id)}">End trip</button><button class="quiet-button" id="resume-gps" data-trip-id="${safe(trip.id)}">Resume GPS updates</button>`:`<button class="primary-button" id="start-trip" data-trip-id="${safe(trip.id)}">Start trip & share location</button>`}</div><div class="driver-id"><span>Assigned vehicle</span><strong>${safe(trip.bus)}</strong><small>${safe(trip.from)} → ${safe(trip.to)}</small><div class="driver-live"><i></i>${active?(state.liveLocation?`GPS updated ${safe(new Date(state.liveLocation.recorded_at).toLocaleTimeString())}`:"Trip active · GPS not connected"):"Ready for departure"}</div></div></section><div class="driver-columns"><section class="panel"><div class="panel-heading"><h3>Route stops</h3><span>${trip.stops.length} stops</span></div><div class="stop-list">${trip.stops.map((stop,index)=>`<div class="stop"><div class="stop-marker">${index+1}</div><div><strong>${safe(stop.stop_name)}</strong><small>${safe(stop.latitude)}, ${safe(stop.longitude)}</small></div></div>`).join("")}</div></section><section class="panel"><div class="panel-heading"><h3>Bus location</h3><span>${state.liveLocation?`±${Math.round(state.liveLocation.accuracy)} m`:"No current fix"}</span></div>${routeMapMarkup("driver-map")}<p id="gps-status" class="section-caption">${state.liveLocation?`Last update ${safe(new Date(state.liveLocation.recorded_at).toLocaleString())}`:"No location update received yet."}</p><div class="notice-banner">If GPS permission is denied or accuracy is poor, trip location won’t be published. This map shows reported coordinates on OpenStreetMap.</div></section></div></div>`;
  await mountMap("driver-map",trip,state.liveLocation);
  if(active&&!state.driverWatch)$("#gps-status").textContent=`Trip active. Tap “Resume GPS updates” after a page reload.`;
}
async function getAdminData(){
  const results=await Promise.all([api("/api/admin/trips"),api("/api/admin/buses"),api("/api/routes"),api("/api/admin/drivers"),api("/api/bookings")]);
  state.trips=results[0].trips;state.buses=results[1].buses;state.routes=results[2].routes;state.drivers=results[3].drivers;state.bookings=results[4].bookings;
}
function renderAdminTable(){
  if(state.adminTab==="trips")return `<div class="table-wrap"><table class="data-table"><thead><tr><th>TRIP</th><th>ROUTE</th><th>DATE / TIME</th><th>BUS</th><th>DRIVER</th><th>FARE</th><th>STATUS</th><th></th></tr></thead><tbody>${state.trips.map((t)=>`<tr><td>${safe(t.id)}</td><td>${safe(t.source)} → ${safe(t.destination)}</td><td>${safe(t.journey_date)} · ${safe(t.departure_time)}</td><td>${safe(t.registration_number)}</td><td>${safe(t.driver_name||"Unassigned")}</td><td>${money(t.fare_paise/100)}</td><td><span class="badge">${safe(t.status)}</span></td><td><button class="table-action" data-edit-trip="${safe(t.id)}">Edit</button> <button class="table-action danger" data-delete-trip="${safe(t.id)}">Remove</button></td></tr>`).join("")||'<tr><td colspan="8" class="table-empty">No trips scheduled.</td></tr>'}</tbody></table></div>`;
  if(state.adminTab==="buses")return `<div class="section-row"><h3 class="section-title">Fleet</h3><button class="primary-button small-button" data-add="bus">Add bus</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>REGISTRATION</th><th>NAME</th><th>TYPE</th><th>CAPACITY</th><th></th></tr></thead><tbody>${state.buses.map((b)=>`<tr><td>${safe(b.registration_number)}</td><td>${safe(b.bus_name)}</td><td>${safe(b.bus_type)}</td><td>${b.capacity}</td><td><button class="table-action" data-edit-bus="${b.id}">Edit</button> <button class="table-action danger" data-delete-bus="${b.id}">Remove</button></td></tr>`).join("")}</tbody></table></div>`;
  if(state.adminTab==="routes")return `<div class="section-row"><h3 class="section-title">Routes and stops</h3><button class="primary-button small-button" data-add="route">Add route</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>ROUTE</th><th>FROM</th><th>TO</th><th>STOPS</th><th></th></tr></thead><tbody>${state.routes.map((r)=>`<tr><td>${safe(r.route_name)}</td><td>${safe(r.source)}</td><td>${safe(r.destination)}</td><td>${r.stop_count}</td><td><button class="table-action" data-edit-route="${r.id}">Edit</button> <button class="table-action danger" data-delete-route="${r.id}">Remove</button></td></tr>`).join("")}</tbody></table></div>`;
  if(state.adminTab==="drivers")return `<div class="section-row"><h3 class="section-title">Drivers</h3><button class="primary-button small-button" data-add="driver">Add driver</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>NAME</th><th>EMAIL</th><th>PHONE</th><th></th></tr></thead><tbody>${state.drivers.map((d)=>`<tr><td>${safe(d.name)}</td><td>${safe(d.email)}</td><td>${safe(d.phone)}</td><td><button class="table-action danger" data-delete-driver="${d.id}">Remove</button></td></tr>`).join("")}</tbody></table></div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>REFERENCE</th><th>PASSENGER</th><th>TRIP</th><th>SEATS</th><th>AMOUNT</th><th>STATUS / PAYMENT</th><th></th></tr></thead><tbody>${state.bookings.map((b)=>`<tr><td>${safe(b.reference)}</td><td>${safe(b.passenger_name)}</td><td>${safe(b.source)} → ${safe(b.destination)}</td><td>${safe((b.seats||[]).join(", "))}</td><td>${money(b.total_paise/100)}</td><td>${safe(b.status)} / ${safe(b.payment_status||"unpaid")}</td><td>${b.payment_status==="refund_pending"?`<button class="table-action" data-retry-refund="${safe(b.id)}">Retry refund</button>`:""}</td></tr>`).join("")||'<tr><td colspan="7" class="table-empty">No bookings yet.</td></tr>'}</tbody></table></div>`;
}
async function renderAdmin(){
  await getAdminData();const revenue=state.bookings.filter((b)=>b.status==="confirmed").reduce((sum,b)=>sum+b.total_paise,0);
  $("#app-view").innerHTML=`<div class="page"><div class="role-header"><div><span class="eyebrow">Network overview</span><h1 class="page-heading">Operator desk</h1><p class="page-subtitle">Manage the fleet, routes, drivers, trips, and bookings.</p></div><button class="primary-button" data-add="trip">+ Add trip</button></div><div class="admin-summary"><div class="admin-card"><div class="admin-card-top"><span>Scheduled trips</span></div><strong>${state.trips.filter((t)=>t.status==="scheduled").length}</strong></div><div class="admin-card"><div class="admin-card-top"><span>Active vehicles</span></div><strong>${state.trips.filter((t)=>t.status==="active").length}</strong></div><div class="admin-card"><div class="admin-card-top"><span>Confirmed bookings</span></div><strong>${state.bookings.filter((b)=>b.status==="confirmed").length}</strong><small>${money(revenue/100)} paid</small></div></div><div class="admin-tabs">${["trips","buses","routes","drivers","bookings"].map((tab)=>`<button class="admin-tab ${tab===state.adminTab?"selected":""}" data-admin-tab="${tab}">${tab[0].toUpperCase()+tab.slice(1)}</button>`).join("")}</div><section class="panel">${renderAdminTable()}</section><div class="notice-banner">Changes are stored on the server. Payment settings are required before accepting real payments.</div></div>`;
}
async function render(){
  setShellUser();closeStream();if(state.map){state.map.remove();state.map=null;state.busMarker=null;}
  try{
    if(state.view==="passenger")await openPassenger();else if(state.view==="tickets")await renderTickets();else if(state.view==="driver")await renderDriver();else if(state.view==="admin")await renderAdmin();
  }catch(error){$("#app-view").innerHTML=`<div class="page"><div class="no-results"><strong>Couldn’t load this view</strong>${safe(error.message)}<p><button class="quiet-button" id="retry-view">Try again</button></p></div></div>`;}
}
function setView(view){
  if(!state.user){if(view==="passenger")return;toast("Create an account to continue.");authDialog();return;}
  const allowed=state.user.role==="admin"||state.user.role==="driver"&&view==="driver"||state.user.role==="passenger"&&["passenger","tickets"].includes(view);
  if(!allowed){toast("That area isn’t available for your account.");return;}
  state.view=view;$$(".nav-link").forEach((button)=>button.classList.toggle("active",button.dataset.view===view));
  const names={passenger:"Explore trips",tickets:"My tickets",driver:"Driver panel",admin:"Operator desk"};$("#crumb-current").textContent=names[view];render();
}
async function showBooking(tripId){
  if(!state.user){authDialog();return;}
  const trip=state.trips.find((item)=>item.id===tripId)||showTrip((await api(`/api/trips/${encodeURIComponent(tripId)}`)).trip);
  state.selectedTrip=trip;state.selectedSeats=[];state.hold=null;
  const {seats}=await api(`/api/trips/${encodeURIComponent(tripId)}/seats`);
  const dialog=$("#booking-dialog");dialog.className="booking-dialog";
  dialog.innerHTML=`<div class="dialog-head"><div><span class="eyebrow">Choose your seats</span><h2 id="dialog-title">${safe(trip.from)} to ${safe(trip.to)}</h2><p>${safe(trip.journeyDate)} · ${safe(trip.depart)} · ${safe(trip.operator)}</p></div><button class="close-dialog" data-close-dialog aria-label="Close">×</button></div><div class="dialog-body"><div class="seat-layout"><div class="seat-side"><div class="seat-top"><span>Seat map</span><span>Front ↑</span></div><div class="seat-grid">${seats.map((seat)=>`<button type="button" class="seat ${seat.status==="booked"||seat.status==="unavailable"?"booked":""}" data-seat="${safe(seat.number)}" aria-label="Seat ${safe(seat.number)}, ${safe(seat.status)}" ${seat.status==="booked"||seat.status==="unavailable"?"disabled":""}>${safe(seat.number.slice(1))}</button>`).join("")}</div><div class="seat-legend"><span><i class="legend-dot"></i>Available</span><span><i class="legend-dot selected"></i>Selected</span><span><i class="legend-dot booked"></i>Booked or held</span></div></div><aside class="booking-summary"><h3>Passenger details</h3><div class="field"><label for="passenger-name">Full name</label><input id="passenger-name" maxlength="80" required value="${safe(state.user.name)}"></div><div class="field" style="margin-top:10px"><label for="passenger-phone">Phone</label><input id="passenger-phone" maxlength="24" required value="${safe(state.user.phone||"")}"></div><div class="summary-rule"></div><div class="summary-line"><span>Fare per seat</span><strong>${money(trip.fare)}</strong></div><div class="summary-line"><span>Seats</span><strong id="summary-seats">0</strong></div><div class="summary-line summary-total"><span>Total</span><strong id="summary-total">${money(0)}</strong></div></aside></div></div><div class="dialog-foot"><span class="selected-note" id="selected-note">Choose seats to hold them for 10 minutes.</span><button class="primary-button" id="confirm-booking" disabled>Continue to payment</button></div>`;
  dialog.showModal();
}
function updateSeatSummary(){const trip=state.selectedTrip;$("#summary-seats").textContent=String(state.selectedSeats.length);$("#summary-total").textContent=money(state.selectedSeats.length*trip.fare);$("#confirm-booking").disabled=!state.selectedSeats.length;$("#selected-note").textContent=state.selectedSeats.length?`${state.selectedSeats.join(", ")} · selected`:"Choose seats to hold them for 10 minutes.";}
async function checkout(){
  const trip=state.selectedTrip;const passengerName=$("#passenger-name").value.trim(),passengerPhone=$("#passenger-phone").value.trim();
  if(!passengerName||!passengerPhone){toast("Enter the passenger’s name and phone.");return;}
  const button=$("#confirm-booking");button.disabled=true;button.textContent="Holding seats…";
  try{
    const held=await post("/api/bookings/hold-seats",{tripId:trip.id,seats:state.selectedSeats,passengerName,passengerPhone});state.hold=held;
    const {booking}=await post("/api/bookings",{holdToken:held.holdToken,passengerName,passengerPhone});
    const order=await post("/api/payments/create-order",{bookingId:booking.id});
    if(order.gateway!=="dummy")throw new Error("The dummy payment gateway is unavailable.");
    if(!window.confirm(`Dummy payment · ${money(order.amount/100)}\n\nThis is a simulation. No real payment will be collected. Complete the payment?`)){button.disabled=false;button.textContent="Payment cancelled · retry";return;}
    button.textContent="Confirming dummy payment…";
    const verified=await post("/api/payments/verify",{orderId:order.orderId});
    $("#booking-dialog").close();await render();showTicket(verified.bookingId);
  }catch(error){button.disabled=false;button.textContent="Retry checkout";toast(error.message);}
}
async function showTicket(bookingId){
  const {booking}=await api(`/api/bookings/${encodeURIComponent(bookingId)}`);const dialog=$("#booking-dialog");dialog.className="booking-dialog";
  dialog.innerHTML=`<div class="dialog-head"><div><span class="eyebrow">Booking confirmed</span><h2 id="dialog-title">Your ticket is ready.</h2><p>Payment status: ${safe(booking.paymentStatus)}</p></div><button class="close-dialog" data-close-dialog aria-label="Close">×</button></div><div class="dialog-body"><article class="ticket-card"><div class="ticket-top"><div><span class="ticket-label">BOOKING REFERENCE</span><strong class="ticket-reference">${safe(booking.reference)}</strong></div><span class="badge">Confirmed</span></div><div class="ticket-route"><div class="ticket-city"><strong>${safe(booking.source)}</strong><span>Boarding</span></div><div class="ticket-dash"></div><div class="ticket-city"><strong>${safe(booking.destination)}</strong><span>Destination</span></div></div><div class="ticket-details"><div><span>Journey date</span><strong>${safe(booking.journey_date)}</strong></div><div><span>Departure</span><strong>${safe(booking.departure_time)}</strong></div><div><span>Bus</span><strong>${safe(booking.bus)}</strong></div><div><span>Seats</span><strong>${safe(booking.seats.join(", "))}</strong></div><div><span>Passenger</span><strong>${safe(booking.passenger_name)}</strong></div><div><span>Paid</span><strong>${money(booking.total_paise/100)}</strong></div></div><div class="ticket-foot">Present this ticket and a valid ID at boarding.</div></article><div class="ticket-actions"><button class="primary-button" data-print-ticket>Print / save PDF</button><button class="quiet-button" data-close-dialog>Done</button></div></div>`;dialog.showModal();
}
function startGps(tripId){
  if(!navigator.geolocation){toast("This browser does not support GPS.");return;}
  if(state.driverWatch!==null)navigator.geolocation.clearWatch(state.driverWatch);
  let lastPost=0;
  state.driverWatch=navigator.geolocation.watchPosition(async(position)=>{
    const now=Date.now();if(now-lastPost<5000)return;lastPost=now;
    try{await post(`/api/driver/trips/${encodeURIComponent(tripId)}/location`,{latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy});const node=$("#gps-status");if(node)node.textContent=`GPS updated ${new Date().toLocaleTimeString()} · ±${Math.round(position.coords.accuracy)} m`;}catch(error){toast(error.message);}
  },(error)=>{const messages={1:"GPS permission denied. Enable location access to share your trip.",2:"GPS is unavailable. Move to a place with a clearer signal.",3:"GPS timed out. The trip remains active, but no location was sent."};toast(messages[error.code]||"Could not read GPS.");const node=$("#gps-status");if(node)node.textContent="No fresh GPS fix. Trip remains active.";},{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
}
function addForm(kind,item){
  const dialog=$("#booking-dialog");dialog.className="booking-dialog";
  const title={trip:item?"Edit trip":"Add a trip",bus:item?"Edit bus":"Add a bus",route:item?"Edit route":"Add a route",driver:"Add a driver"}[kind];
  const dateDefault=localToday();let fields="";
  if(kind==="trip")fields=`<div class="field"><label>Route</label><select name="routeId" required>${state.routes.map((r)=>`<option value="${r.id}" ${item?.route_id===r.id?"selected":""}>${safe(r.source)} → ${safe(r.destination)}</option>`).join("")}</select></div><div class="field"><label>Bus</label><select name="busId" required>${state.buses.map((b)=>`<option value="${b.id}" ${item?.bus_id===b.id?"selected":""}>${safe(b.registration_number)} · ${safe(b.bus_name)}</option>`).join("")}</select></div><div class="field"><label>Driver</label><select name="driverId"><option value="">Unassigned</option>${state.drivers.map((d)=>`<option value="${d.id}" ${item?.driver_id===d.id?"selected":""}>${safe(d.name)}</option>`).join("")}</select></div><div class="field"><label>Date</label><input name="date" type="date" min="${dateDefault}" value="${safe(item?.journey_date||dateDefault)}" required></div><div class="field"><label>Departure</label><input name="departure" type="time" value="${safe(item?.departure_time||"08:15")}" required></div><div class="field"><label>Arrival</label><input name="arrival" type="time" value="${safe(item?.arrival_time||"11:45")}" required></div><div class="field"><label>Fare (₹)</label><input name="fare" type="number" min="1" max="50000" value="${item?item.fare_paise/100:680}" required></div>`;
  if(kind==="bus")fields=`<div class="field"><label>Registration number</label><input name="registrationNumber" maxlength="16" value="${safe(item?.registration_number||"")}" required></div><div class="field"><label>Bus name</label><input name="name" maxlength="80" value="${safe(item?.bus_name||"")}" required></div><div class="field"><label>Type</label><input name="type" maxlength="50" value="${safe(item?.bus_type||"AC Coach")}" required></div><div class="field"><label>Capacity</label><input name="capacity" type="number" min="1" max="100" value="${item?.capacity||36}" required></div>`;
  if(kind==="route")fields=`<div class="field"><label>Route name</label><input name="name" maxlength="100" value="${safe(item?.route_name||"")}" required></div><div class="field"><label>Source</label><input name="source" maxlength="80" value="${safe(item?.source||"")}" required></div><div class="field"><label>Destination</label><input name="destination" maxlength="80" value="${safe(item?.destination||"")}" required></div><div class="field route-stops-field"><label>Stops (one per line: name, latitude, longitude)</label><textarea name="stops" rows="5" placeholder="Mumbai Central, 18.9690, 72.8205&#10;Pune Central, 18.5204, 73.8567" required>${safe(item?.stops?.map((stop)=>`${stop.stop_name}, ${stop.latitude}, ${stop.longitude}`).join("`n")||"")}</textarea></div>`;
  if(kind==="driver")fields=`<div class="field"><label>Name</label><input name="name" maxlength="80" required></div><div class="field"><label>Email</label><input name="email" type="email" maxlength="254" required></div><div class="field"><label>Phone</label><input name="phone" maxlength="24"></div><div class="field"><label>Initial password (12+ characters)</label><input name="password" type="password" minlength="12" maxlength="128" required></div>`;
  dialog.innerHTML=`<div class="dialog-head"><div><span class="eyebrow">Operator tools</span><h2 id="dialog-title">${title}</h2></div><button class="close-dialog" data-close-dialog aria-label="Close">×</button></div><div class="dialog-body"><form id="admin-form" class="form-grid">${fields}<p id="admin-error" class="form-error"></p></form></div><div class="dialog-foot"><span class="selected-note">Validated and saved on the server</span><button class="primary-button" id="save-admin" data-kind="${kind}" data-id="${item?.id||""}">Save</button></div>`;dialog.showModal();
}
async function saveAdmin(kind,id){
  const form=$("#admin-form"),data=new FormData(form);let body=Object.fromEntries(data.entries());
  try{
    if(kind==="trip"){body={...body,busId:Number(body.busId),routeId:Number(body.routeId),driverId:body.driverId?Number(body.driverId):null,fare:Number(body.fare)};if(id)await patch(`/api/admin/trips/${encodeURIComponent(id)}`,body);else await post("/api/admin/trips",body);}
    else if(kind==="bus"){body={...body,capacity:Number(body.capacity)};if(id)await patch(`/api/admin/buses/${id}`,body);else await post("/api/admin/buses",body);}
    else if(kind==="driver")await post("/api/admin/drivers",body);
    else if(kind==="route"){
      body.stops=body.stops.split(/\r?\n/).filter(Boolean).map((line)=>{const [name,latitude,longitude]=line.split(",").map((part)=>part.trim());return{name,latitude:Number(latitude),longitude:Number(longitude)};});
      if(id){await patch(`/api/routes/${id}`,body);toast("Route details updated. Stops stay as saved.");}else await post("/api/routes",body);
    }
    $("#booking-dialog").close();await renderAdmin();toast("Saved.");
  }catch(error){$("#admin-error").textContent=error.message;}
}
async function removeResource(kind,id){
  if(!confirm(`Remove this ${kind}? This cannot be undone.`))return;
  try{await api(`/api/${kind==="trip"?"admin/trips":kind==="bus"?"admin/buses":kind==="driver"?"admin/drivers":"routes"}/${encodeURIComponent(id)}`,{method:"DELETE"});await renderAdmin();toast(`${kind[0].toUpperCase()+kind.slice(1)} removed.`);}catch(error){toast(error.message);}
}
async function exportBookings(){
  try{const {bookings}=await api("/api/bookings");const rows=[["reference","passenger","trip","date","seats","amount","status"],...bookings.map((b)=>[b.reference,b.passenger_name,`${b.source}-${b.destination}`,b.journey_date,(b.seats||[]).join("|"),b.total_paise/100,b.status])];const csv=rows.map((row)=>row.map((v)=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\r\n");const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));link.download="smartbus-bookings.csv";link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}catch(error){toast(error.message);}
}

document.addEventListener("click",async(event)=>{
  if(event.target.closest("#login, #login-sidebar")){authDialog(false);return;}
  if(event.target.closest("#logout")){if(state.driverWatch!==null)navigator.geolocation.clearWatch(state.driverWatch);state.driverWatch=null;closeStream();await post("/api/auth/logout",{}).catch(()=>{});state.user=null;state.view="passenger";$$('[data-view]').forEach((button)=>button.hidden=true);await render();return;}
  const view=event.target.closest("[data-view]");if(view){setView(view.dataset.view);return;}
  const authRole=event.target.closest("[data-auth-role]");if(authRole){state.authRole=authRole.dataset.authRole;setAuthMode(false);return;}
  if(event.target.closest("#auth-switch")){setAuthMode(!state.authRegister);return;}
  const book=event.target.closest("[data-book]");if(book){try{await showBooking(book.dataset.book);}catch(error){toast(error.message);}return;}
  const seat=event.target.closest("[data-seat]");if(seat){const number=seat.dataset.seat;state.selectedSeats=state.selectedSeats.includes(number)?state.selectedSeats.filter((s)=>s!==number):[...state.selectedSeats,number];seat.classList.toggle("selected",state.selectedSeats.includes(number));updateSeatSummary();return;}
  if(event.target.closest("#confirm-booking")){checkout();return;}
  const tab=event.target.closest("[data-admin-tab]");if(tab){state.adminTab=tab.dataset.adminTab;renderAdmin();return;}
  const add=event.target.closest("[data-add]");if(add){addForm(add.dataset.add);return;}
  const editBus=event.target.closest("[data-edit-bus]");if(editBus){addForm("bus",state.buses.find((b)=>String(b.id)===editBus.dataset.editBus));return;}
  const editRoute=event.target.closest("[data-edit-route]");if(editRoute){const r=state.routes.find((x)=>String(x.id)===editRoute.dataset.editRoute);addForm("route",r);return;}
  const editTrip=event.target.closest("[data-edit-trip]");if(editTrip){addForm("trip",state.trips.find((x)=>x.id===editTrip.dataset.editTrip));return;}
  if(event.target.closest("#save-admin")){const button=event.target.closest("#save-admin");saveAdmin(button.dataset.kind,button.dataset.id);return;}
  const deleteTrip=event.target.closest("[data-delete-trip]");if(deleteTrip){removeResource("trip",deleteTrip.dataset.deleteTrip);return;}
  const deleteBus=event.target.closest("[data-delete-bus]");if(deleteBus){removeResource("bus",deleteBus.dataset.deleteBus);return;}
  const deleteRoute=event.target.closest("[data-delete-route]");if(deleteRoute){removeResource("route",deleteRoute.dataset.deleteRoute);return;}const deleteDriver=event.target.closest("[data-delete-driver]");if(deleteDriver){removeResource("driver",deleteDriver.dataset.deleteDriver);return;}
  const retryRefund=event.target.closest("[data-retry-refund]");if(retryRefund){try{await post(`/api/admin/refunds/${encodeURIComponent(retryRefund.dataset.retryRefund)}/retry`,{});await renderAdmin();toast("Refund request submitted.");}catch(error){toast(error.message);}return;}
  if(event.target.closest("#export-report")){exportBookings();return;}
  const start=event.target.closest("#start-trip");if(start){const id=start.dataset.tripId;try{await post(`/api/driver/trips/${encodeURIComponent(id)}/start`,{});toast("Trip started. Requesting GPS permission.");await renderDriver();startGps(id);}catch(error){toast(error.message);}return;}
  const resume=event.target.closest("#resume-gps");if(resume){startGps(resume.dataset.tripId);toast("Requesting GPS permission.");return;}
  const end=event.target.closest("#end-trip");if(end){if(state.driverWatch!==null)navigator.geolocation.clearWatch(state.driverWatch);state.driverWatch=null;try{await post(`/api/driver/trips/${encodeURIComponent(end.dataset.tripId)}/end`,{});toast("Trip ended and location sharing stopped.");await renderDriver();}catch(error){toast(error.message);}return;}
  if(event.target.closest("[data-print-ticket]")){window.print();return;}
  const ticket=event.target.closest("[data-ticket]");if(ticket){try{await showTicket(ticket.dataset.ticket);}catch(error){toast(error.message);}return;}
  if(event.target.closest("[data-close-dialog]")){state.hold=null;$("#booking-dialog").close();return;}
  if(event.target.closest("#retry-view")){render();return;}
});
document.addEventListener("submit",async(event)=>{
  if(event.target.id==="auth-form"){
    event.preventDefault();const data=Object.fromEntries(new FormData(event.target).entries());if(!state.authRegister)data.role=state.authRole;const submit=$("#auth-submit");submit.disabled=true;
    try{const result=await post(state.authRegister?"/api/auth/register":"/api/auth/login",data);state.user=result.user;state.view=state.user.role==="admin"?"admin":state.user.role==="driver"?"driver":"passenger";$("#booking-dialog").close();setShellUser();const title={passenger:"Explore trips",driver:"Driver panel",admin:"Operator desk"};$("#crumb-current").textContent=title[state.user.role];await render();}
    catch(error){$("#auth-error").textContent=error.message;submit.disabled=false;}return;
  }
  if(event.target.id==="search-form"){
    event.preventDefault();const data=new FormData(event.target);state.source=String(data.get("source"));state.destination=String(data.get("destination"));state.date=String(data.get("date"));try{await openPassenger();}catch(error){toast(error.message);}return;
  }
});
window.addEventListener("storage",()=>{});
async function boot(){
  $("#today-label").textContent=new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
  try{state.user=(await api("/api/auth/me")).user;}catch{state.user=null;}
  if(!state.user){state.view="passenger";$("#crumb-current").textContent="Explore trips";await render();return;}
  setShellUser();state.view=state.user.role==="admin"?"admin":state.user.role==="driver"?"driver":"passenger";
  const names={passenger:"Explore trips",driver:"Driver panel",admin:"Operator desk"};$("#crumb-current").textContent=names[state.user.role];await render();
}
boot();
