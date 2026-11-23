"use strict";
/*
  Crypts & Coins room server.
  - Serves the game (index.html) at "/".
  - Runs tiny two-player rooms over WebSocket at "/ws".
  The server never runs the game itself. The player who creates the room (the host)
  runs the dungeon in their browser; the server just passes messages between the two.
*/
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT) || 10000;
const INDEX = path.join(__dirname, "index.html");
const ROOM_IDLE_MS = 30 * 60 * 1000;    // keep an empty room 30 minutes so players can reconnect
const ROOM_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_ROOMS = 500;
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O, so codes are easy to read aloud

function gamePage() {
  // Tell the page that this server hosts rooms, so co-op connects back here.
  return fs.readFileSync(INDEX, "utf8").replace("<title>", '<meta name="cc-room-server" content="same">\n<title>');
}
let cachedPage = null;

const server = http.createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];
  if (url === "/healthz") { res.writeHead(200, { "Content-Type": "text/plain" }); res.end("ok"); return; }
  if (url === "/" || url === "/index.html") {
    try { if (!cachedPage || process.env.NODE_ENV !== "production") cachedPage = gamePage(); }
    catch (e) { res.writeHead(500); res.end("Game file missing"); return; }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
    res.end(cachedPage);
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 1024 * 1024 });
const rooms = new Map(); // code -> { code, tokens: [host, guest], socks: [ws|null, ws|null], names: [], created, emptySince }

function newCode() {
  for (let i = 0; i < 200; i++) {
    let c = "";
    for (let j = 0; j < 4; j++) c += LETTERS[crypto.randomInt(LETTERS.length)];
    if (!rooms.has(c)) return c;
  }
  return null;
}
const token = () => crypto.randomBytes(16).toString("hex");
const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };

function attach(ws, room, role) {
  const old = room.socks[role];
  if (old && old !== ws) { old.room = null; try { old.close(4000, "replaced"); } catch (e) {} }
  room.socks[role] = ws;
  room.emptySince = null;
  ws.room = room; ws.role = role;
}

function detach(ws) {
  const room = ws.room; if (!room) return;
  if (room.socks[ws.role] === ws) {
    room.socks[ws.role] = null;
    send(room.socks[1 - ws.role], { t: "peer", online: false });
    if (!room.socks[0] && !room.socks[1]) room.emptySince = Date.now();
  }
  ws.room = null;
}

wss.on("connection", (ws) => {
  ws.alive = true;
  ws.on("pong", () => { ws.alive = true; });
  ws.on("message", (raw) => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== "string") return;
    const name = typeof m.name === "string" ? m.name.slice(0, 20) : "";

    if (m.t === "ping") { send(ws, { t: "pong" }); return; }

    if (m.t === "create") {
      detach(ws);
      if (rooms.size >= MAX_ROOMS) { send(ws, { t: "error", why: "busy", msg: "The room server is full right now. Try again in a bit." }); return; }
      const code = newCode();
      if (!code) { send(ws, { t: "error", why: "busy", msg: "Couldn't make a room code. Try again." }); return; }
      const room = { code, tokens: [token(), token()], socks: [null, null], names: [name, ""], created: Date.now(), emptySince: null, guestJoined: false };
      rooms.set(code, room);
      attach(ws, room, 0);
      send(ws, { t: "created", code, token: room.tokens[0] });
      return;
    }

    if (m.t === "join") {
      const code = String(m.code || "").toUpperCase().replace(/[^A-Z]/g, "");
      const room = rooms.get(code);
      if (!room) { send(ws, { t: "error", why: "no-room", msg: `There's no room called ${code || "that"}. Check the code with your partner.` }); return; }
      if (room.guestJoined) { send(ws, { t: "error", why: "full", msg: "That room already has two players." }); return; }
      detach(ws);
      room.guestJoined = true;
      room.names[1] = name;
      attach(ws, room, 1);
      send(ws, { t: "joined", code, token: room.tokens[1], peerOnline: !!room.socks[0] });
      send(room.socks[0], { t: "peer", online: true, name });
      return;
    }

    if (m.t === "resume") {
      const room = rooms.get(String(m.code || ""));
      const role = room ? room.tokens.indexOf(String(m.token || "")) : -1;
      if (!room || role < 0) { send(ws, { t: "error", why: "gone", msg: "That room has closed." }); return; }
      detach(ws);
      attach(ws, room, role);
      send(ws, { t: "resumed", code: room.code, role, peerOnline: !!room.socks[1 - role], guestJoined: room.guestJoined, peerName: room.names[1 - role] });
      send(room.socks[1 - role], { t: "peer", online: true, name: room.names[role] });
      return;
    }

    if (m.t === "relay") {
      const room = ws.room; if (!room) return;
      send(room.socks[1 - ws.role], { t: "relay", data: m.data });
      return;
    }

    if (m.t === "leave") {
      const room = ws.room; if (!room) return;
      send(room.socks[1 - ws.role], { t: "peer", online: false, left: true });
      if (ws.role === 0) { send(room.socks[1], { t: "closed" }); rooms.delete(room.code); }
      else { room.socks[1] = null; room.guestJoined = false; room.names[1] = ""; room.tokens[1] = token(); }
      ws.room = null;
      return;
    }
  });
  ws.on("close", () => detach(ws));
  ws.on("error", () => {});
});

// Drop dead connections, and forget rooms nobody has used for a while.
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.alive) { try { ws.terminate(); } catch (e) {} return; }
    ws.alive = false;
    try { ws.ping(); } catch (e) {}
  });
  const now = Date.now();
  for (const [code, room] of rooms) {
    if ((room.emptySince && now - room.emptySince > ROOM_IDLE_MS) || now - room.created > ROOM_MAX_AGE_MS) {
      room.socks.forEach((s) => { if (s) try { s.close(4001, "room closed"); } catch (e) {} });
      rooms.delete(code);
    }
  }
}, 30000);

server.listen(PORT, () => console.log(`Crypts & Coins room server on port ${PORT}`));
