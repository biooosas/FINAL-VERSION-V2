// app.js
import { auth, db } from "./firebase.js";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from "firebase/auth";
import { 
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp 
} from "firebase/firestore";

// ========================
// AUTHENTICATION
// ========================
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const logoutBtn = document.getElementById("logout-btn");
const chatBox = document.getElementById("chat-box");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");

signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = e.target.email.value;
  const password = e.target.password.value;
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error("Signup error:", err.message);
  }
});

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = e.target.email.value;
  const password = e.target.password.value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error("Login error:", err.message);
  }
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
});

// ========================
// KEEP USER LOGGED IN
// ========================
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("User logged in:", user.email);
    loadMessages();
  } else {
    console.log("No user logged in");
  }
});

// ========================
// CHAT SYSTEM
// ========================
async function loadMessages() {
  const messagesRef = collection(db, "messages");
  const q = query(messagesRef, orderBy("timestamp", "asc"));

  onSnapshot(q, (snapshot) => {
    chatBox.innerHTML = "";
    snapshot.forEach((doc) => {
      const msg = doc.data();
      const div = document.createElement("div");
      div.textContent = `${msg.user}: ${msg.text}`;
      chatBox.appendChild(div);
    });
  });
}

messageForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value;
  if (!text.trim()) return;

  await addDoc(collection(db, "messages"), {
    text,
    user: auth.currentUser.email,
    timestamp: serverTimestamp()
  });

  messageInput.value = "";
});


// =================== SETTINGS ===================
async function loadUserSettings(uid) {
  const docRef = doc(db, "users", uid);
  const snap = await getDoc(docRef);

  if (snap.exists()) {
    const data = snap.data();
    document.body.style.background = pickBackground(data.background);
  }
}

function pickBackground(type) {
  switch (type) {
    case "black-gray": return "linear-gradient(90deg, black, gray, black)";
    case "black-red": return "linear-gradient(90deg, black, red, black)";
    case "black-blue": return "linear-gradient(90deg, black, blue, black)";
    case "black-green": return "linear-gradient(90deg, black, green, black)";
    case "black-purple": return "linear-gradient(90deg, black, purple, black)";
    default: return "black";
  }
}

// =================== CHAT HANDLING ===================

// Load all group chats
async function loadChats() {
  const q = query(collection(db, "chats"));
  const snap = await getDocs(q);

  const chatList = document.getElementById("chatList");
  chatList.innerHTML = "";
  snap.forEach((docSnap) => {
    const chat = docSnap.data();
    const btn = document.createElement("button");
    btn.innerText = chat.name;
    btn.onclick = () => openChat(docSnap.id, "group");
    chatList.appendChild(btn);
  });
}

// Open a chat (group or DM)
function openChat(chatId, type) {
  currentChatId = chatId;
  currentChatType = type;

  const chatWindow = document.getElementById("chatWindow");
  chatWindow.innerHTML = "";

  let msgsRef;
  if (type === "group") {
    msgsRef = collection(db, "chats", chatId, "messages");
  } else {
    msgsRef = collection(db, "dms", chatId, "messages");
  }

  const q = query(msgsRef, orderBy("timestamp"));
  onSnapshot(q, (snap) => {
    chatWindow.innerHTML = "";
    snap.forEach((m) => {
      const msg = m.data();
      const div = document.createElement("div");
      div.innerHTML = `<b>${msg.senderName}:</b> ${msg.text}`;
      chatWindow.appendChild(div);
    });
  });
}

// Send message
document.getElementById("sendBtn").addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user || !currentChatId) return;

  const text = document.getElementById("messageInput").value;
  if (!text) return;

  const msg = {
    senderId: user.uid,
    senderName: user.displayName || "Anon",
    text,
    timestamp: serverTimestamp(),
  };

  if (currentChatType === "group") {
    await addDoc(collection(db, "chats", currentChatId, "messages"), msg);
  } else {
    await addDoc(collection(db, "dms", currentChatId, "messages"), msg);
  }

  document.getElementById("messageInput").value = "";
});

// =================== CREATE GROUP CHAT ===================
document.getElementById("createGroupBtn").addEventListener("click", async () => {
  const name = prompt("Enter group chat name:");
  if (!name) return;

  await addDoc(collection(db, "chats"), {
    name,
    createdAt: serverTimestamp(),
  });

  loadChats();
});

// =================== USERS + DMs ===================
async function loadUsers() {
  const q = query(collection(db, "users"));
  const snap = await getDocs(q);

  const userList = document.getElementById("userList");
  userList.innerHTML = "";
  snap.forEach((docSnap) => {
    const u = docSnap.data();
    const user = auth.currentUser;
    if (user && u.email === user.email) return; // skip self

    const btn = document.createElement("button");
    btn.innerText = u.displayName || u.email;
    btn.onclick = () => startDM(user.uid, docSnap.id);
    userList.appendChild(btn);
  });
}

// Start a DM between two users
async function startDM(uid1, uid2) {
  const id = [uid1, uid2].sort().join("_"); // unique DM id
  const ref = doc(db, "dms", id);

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      users: [uid1, uid2],
      createdAt: serverTimestamp(),
    });
  }

  openChat(id, "dm");
}
