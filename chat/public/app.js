// client-side app.js (ES module) using socket.io client
const socket = io();
const tokenKey = "chatroom_token";
let myProfile = null;
let state = { rooms: [], dms: [], users: [] };
let currentChannel = null; // { type:'room'|'dm', id }

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* refs */
const authModal = $("#authModal");
const loginBtn = $("#loginBtn");
const signupBtn = $("#signupBtn");
const emailInput = $("#authEmail");
const passInput = $("#authPassword");
const dnInput = $("#authDisplayName");
const logoutBtn = $("#logoutBtn");
const displayNameTxt = $("#displayName");
const userAvatar = $("#userAvatar");
const roomsList = $("#roomsList");
const dmList = $("#dmList");
const createRoomBtn = $("#createRoomBtn");
const newDmBtn = $("#newDmBtn");
const messagesWrap = $("#messages");
const messageForm = $("#messageForm");
const messageInput = $("#messageInput");
const sendBtn = $("#sendBtn");
const attachBtn = $("#attachBtn");
const imageInput = $("#imageInput");
const notify = $("#notifySound");
const settingsBtn = $("#settingsBtn");
const settingsModal = $("#settingsModal");
const settingsDisplayName = $("#settingsDisplayName");
const avatarFile = $("#avatarFile");
const avatarColor = $("#avatarColor");
const useColorBtn = $("#useColorBtn");
const bgTheme = $("#bgTheme");
const bgSolid = $("#bgSolid");
const settingsSave = $("#settingsSave");
const settingsClose = $("#settingsClose");
const inviteModal = $("#inviteModal");
const inviteEmail = $("#inviteEmail");
const inviteSend = $("#inviteSend");
const inviteCancel = $("#inviteCancel");

function q(path, body){ return fetch(path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)}).then(r=>r.json()); }
function setAvatarElement(div, profile){
  if(!div) return;
  if(profile?.avatarUrl){ div.style.backgroundImage = `url(${profile.avatarUrl})`; div.style.backgroundColor = "transparent"; }
  else { div.style.backgroundImage = ""; div.style.backgroundColor = profile?.color || "#5865F2"; }
}
function applyTheme(theme, solidColor){
  const app = document.getElementById("app");
  if(theme === "solid"){ app.dataset.bg = "solid"; document.documentElement.style.setProperty('--bg-1', solidColor || '#111'); }
  else { app.dataset.bg = theme; }
}

/* socket events */
socket.on("connect", ()=> {
  const token = localStorage.getItem(tokenKey);
  if(token) socket.emit("auth", token);
  else authModal.style.display = "flex";
});
socket.on("auth:ok", (d) => {
  myProfile = d.profile;
  setupAfterAuth();
});
socket.on("state", (d) => {
  state.rooms = d.rooms || [];
  state.dms = d.dms || [];
  state.users = d.users || state.users;
  renderRooms(); renderDms(); renderMembers(state.users || []);
});
socket.on("rooms:update", (rooms) => { state.rooms = rooms; renderRooms(); });
socket.on("message", (msg) => {
  if(currentChannel && currentChannel.type === msg.channelType && currentChannel.id === msg.channelId){
    renderMessage(msg.message);
  } else {
    try{ notify.play(); }catch{}
  }
});
socket.on("profile:update", (p)=> {
  if(myProfile && myProfile.uid === p.uid) { myProfile = p; setAvatarElement(userAvatar, p); displayNameTxt.textContent = p.displayName; }
});
socket.on("presence", (users)=> renderMembers(users));

/* auth REST flows */
async function signup(){
  const email = emailInput.value.trim(), pass = passInput.value, dn = dnInput.value.trim();
  if(!email||!pass) return alert("email & password required");
  const res = await q("/api/signup", { email, password: pass, displayName: dn });
  if(res.ok){ localStorage.setItem(tokenKey, res.token); socket.emit("auth", res.token); authModal.style.display="none"; setupAfterAuth(); }
  else alert(res.error || "signup failed");
}
async function login(){ 
  const email = emailInput.value.trim(), pass = passInput.value;
  if(!email||!pass) return alert("email & password required");
  const res = await q("/api/login", { email, password: pass });
  if(res.ok){ localStorage.setItem(tokenKey, res.token); socket.emit("auth", res.token); authModal.style.display="none"; setupAfterAuth(); }
  else alert(res.error || "login failed");
}
loginBtn.addEventListener("click", login);
signupBtn.addEventListener("click", signup);

/* restore session if token exists */
(async ()=>{
  const token = localStorage.getItem(tokenKey);
  if(token){
    const res = await q("/api/restore", { token });
    if(res.ok){ myProfile = res.profile; socket.emit("auth", token); setupAfterAuth(); }
    else { localStorage.removeItem(tokenKey); authModal.style.display="flex"; }
  } else { authModal.style.display="flex"; }
})();

function setupAfterAuth(){
  displayNameTxt.textContent = myProfile.displayName;
  setAvatarElement(userAvatar, myProfile);
  settingsDisplayName.value = myProfile.displayName;
  avatarColor.value = myProfile.color || "#5865F2";
  bgTheme.value = myProfile.theme || "black-gray";
  applyTheme(myProfile.theme, myProfile.bgSolid);
  authModal.style.display = "none";
}

/* UI render */
function renderRooms(){
  roomsList.innerHTML = "";
  state.rooms.forEach(r => {
    const div = document.createElement("div");
    div.className = "item" + (currentChannel && currentChannel.type==="room" && currentChannel.id===r.id ? " active": "");
    div.textContent = `# ${r.name}` + (r.isPrivate ? " 🔒":"");
    div.onclick = ()=> openRoom(r.id);
    roomsList.appendChild(div);
  });
}
function renderDms(){
  dmList.innerHTML = "";
  state.dms.forEach(d => {
    const otherUid = d.participants.find(p => p !== myProfile.uid);
    const other = state.users.find(u => u.uid === otherUid) || { displayName: otherUid };
    const div = document.createElement("div"); div.className="item"; div.textContent = `@ ${other.displayName || otherUid}`;
    div.onclick = ()=> openDm(d.id);
    dmList.appendChild(div);
  });
}
function renderMembers(users){
  const list = $("#membersList"); list.innerHTML = "";
  (users||[]).forEach(u=>{
    const row = document.createElement("div"); row.className = "user";
    const av = document.createElement("div"); av.className="avatar"; if(u.avatarUrl) av.style.backgroundImage = `url(${u.avatarUrl})`; else av.style.background = u.color || "#5865F2";
    const name = document.createElement("div"); name.className="name"; name.textContent = u.displayName || u.email;
    row.appendChild(av); row.appendChild(name); list.appendChild(row);
  });
}

/* open room/dm */
function openRoom(id){
  currentChannel = { type: "room", id };
  const r = state.rooms.find(x=>x.id===id);
  $("#channelTitle").textContent = `# ${r.name}`; $("#channelSubtitle").textContent = r.isPrivate ? "Private room":"Public room";
  $("#roomTypeBadge").textContent = r.isPrivate ? "PRIVATE":"PUBLIC"; $("#inviteBtn").style.display = r.isPrivate ? "inline-flex":"none";
  messagesWrap.innerHTML = "";
  (r.messages || []).forEach(renderMessage);
}
function openDm(id){
  currentChannel = { type: "dm", id };
  const t = state.dms.find(x=>x.id===id);
  $("#channelTitle").textContent = t ? `DM` : "Direct Message"; messagesWrap.innerHTML = "";
  (t.messages || []).forEach(renderMessage);
}

/* renderMessage */
function renderMessage(m){
  const wrap = document.createElement("div"); wrap.className = "msg";
  const av = document.createElement("div"); av.className = "avatar";
  av.style.background = "#5865F2";
  const bubble = document.createElement("div"); bubble.className = "bubble";
  const meta = document.createElement("div"); meta.className = "meta";
  const time = new Date(m.createdAt || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  meta.textContent = `${m.displayName || m.email || m.uid} • ${time}`;
  bubble.appendChild(meta);
  if(m.text){ const t = document.createElement("div"); t.textContent = m.text; bubble.appendChild(t); }
  if(m.imageUrl){ const img = document.createElement("img"); img.src = m.imageUrl; bubble.appendChild(img); }
  wrap.appendChild(av); wrap.appendChild(bubble); messagesWrap.appendChild(wrap); messagesWrap.scrollTop = messagesWrap.scrollHeight;
}

/* sending messages */
attachBtn.onclick = ()=> imageInput.click();
messageInput.addEventListener("keydown", (e)=> { if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); messageForm.requestSubmit(); }});
messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if(!currentChannel) return alert("Open a room or DM first");
  const text = messageInput.value.trim();
  if(!text && !imageInput.files.length) return;
  let imageUrl = null;
  if(imageInput.files.length){
    const f = imageInput.files[0];
    const base = await fileToDataUrl(f);
    const res = await q("/api/upload", { filename: f.name, dataBase64: base });
    imageUrl = res.url;
  }
  const token = localStorage.getItem(tokenKey);
  socket.emit("sendMessage", { token, channelType: currentChannel.type, channelId: currentChannel.id, text, imageUrl });
  messageInput.value = ""; imageInput.value = "";
});

/* create room, new dm, invites */
createRoomBtn.onclick = async ()=> {
  const name = prompt("Room name?"); if(!name) return;
  const isPrivate = confirm("Make private?");
  const token = localStorage.getItem(tokenKey);
  const res = await q("/api/rooms/create", { token, name, isPrivate });
  if(!res.ok) alert(res.error || "failed");
};
newDmBtn.onclick = async ()=> {
  const email = prompt("Start DM with email:"); if(!email) return;
  const token = localStorage.getItem(tokenKey);
  const res = await q("/api/dms/open", { token, otherEmail: email });
  if(!res.ok) return alert(res.error || "failed");
  const st = await q("/api/state", { token }); state.dms = st.dms; renderDms();
};

/* invites */
$("#inviteBtn").onclick = ()=> inviteModal.classList.remove("hidden");
$("#inviteCancel").onclick = ()=> inviteModal.classList.add("hidden");
inviteSend.onclick = async ()=> {
  const email = inviteEmail.value.trim(); if(!email) return alert("email");
  const token = localStorage.getItem(tokenKey);
  const res = await q("/api/rooms/invite", { token, roomId: currentChannel.id, email });
  if(!res.ok) alert(res.error || "failed"); else { inviteEmail.value=""; inviteModal.classList.add("hidden"); alert("Invited"); }
};

/* settings */
settingsBtn.onclick = ()=> settingsModal.classList.remove("hidden");
settingsClose.onclick = ()=> settingsModal.classList.add("hidden");
useColorBtn.onclick = ()=> { avatarFile.value=""; alert("Choose a color and Save"); };
settingsSave.onclick = async ()=> {
  const name = settingsDisplayName.value.trim();
  let avatarUrl=null;
  if(avatarFile.files.length){
    const f = avatarFile.files[0];
    const base = await fileToDataUrl(f);
    const res = await q("/api/upload", { filename: f.name, dataBase64: base });
    avatarUrl = res.url;
  }
  const color = avatarFile.files.length ? null : avatarColor.value;
  const theme = bgTheme.value;
  const token = localStorage.getItem(tokenKey);
  const res = await q("/api/profile/update", { token, displayName: name, avatarUrl, color, theme });
  if(res.ok){ myProfile = res.profile; setAvatarElement(userAvatar, myProfile); applyTheme(myProfile.theme, myProfile.bgSolid); settingsModal.classList.add("hidden"); }
  else alert(res.error || "failed");
};

/* logout */
logoutBtn.onclick = ()=> { localStorage.removeItem(tokenKey); location.reload(); };

function fileToDataUrl(file){ return new Promise(res=>{ const r = new FileReader(); r.onload = ()=> res(r.result); r.readAsDataURL(file); }); }
