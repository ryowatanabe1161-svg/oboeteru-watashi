/* ふーです🐻。トーストに塗るのはメイプルシロップです。 オンライン版
 * 構成：WebRTC（PeerJS）による P2P。ホストのブラウザが唯一の正（authoritative）。
 * 自己紹介の答えは「表示中の数秒だけ」参加者に送ります（あとから見返せない＝覚えるのがゲーム）。
 * クイズの正解は答え合わせのときだけ送ります。
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var O = window.Oboe;
  var Q = new URLSearchParams(location.search);
  var CFG = window.OB_CONFIG || {};
  var ICE = (CFG.iceServers && CFG.iceServers.length) ? CFG.iceServers : [{ urls: 'stun:stun.l.google.com:19302' }];
  if (Q.get('ice')) ICE = Q.get('ice').split(',').map(function (u) { return { urls: u }; }); // テスト・独自環境用
  var PEER_OPTS = Object.assign({ debug: 1, config: { iceServers: ICE } }, CFG.peer || {});
  var ID_PREFIX = 'oboeteru-watashi-jp-v1-';
  var CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var TURBO = Q.has('turbo');
  var T = TURBO
    ? { cpuWrite: [150, 300], ask: 4000, cpuAns: [150, 700], reveal: 1200, ready: 500, show: 900 }
    : { cpuWrite: [1800, 3600], ask: 15000, cpuAns: [1800, 7000], reveal: 4500, ready: 2500, show: 0 };
  var CPU_ACC = 0.65, MAXP = 8, HB_MS = 3000, LOST_MS = 10000, AUTO_SKIP_MS = 20000;
  var COLORS = ['#ff6b8b', '#4cc9f0', '#f4a300', '#52c48a', '#a78bfa', '#fb8500', '#06b6d4', '#e76f51'];
  var BEAR = '🐻', CPU_BASE = 'ふーさん' + BEAR, CPU_DEFAULT_RE = /^ふーさん🐻\d*$/;
  var LINES = {
    write: ['うーん、なににするクマ…', 'まよっちゃうクマ〜', 'ちょっと待ってクマ'],
    mine: ['えへへ、おぼえてほしいクマ', 'ちょっと照れるクマ…', 'ほんとうのことクマ！', 'ふーさんのこと、もっと知ってほしいクマ'],
    listen: ['へえ〜！おぼえたクマ', 'それいいクマね！', 'わかるクマ〜', 'メモしたいけどがまんクマ…', 'しっかり覚えたクマ！'],
    think: ['これだクマ！', 'たぶんこれクマ…', 'おぼえてるクマ！', 'うーん…えいっ！クマ'],
    right: ['やったクマ〜！', 'ちゃんとおぼえてたクマ！', 'ふーさんの記憶力クマ！'],
    wrong: ['わすれてたクマ…', 'あれれ？ちがったクマ〜', 'くやしいクマ…'],
    about: ['ふーさんのこと、おぼえてるクマ？', 'みんな覚えてるかなクマ？', 'ドキドキするクマ…'],
    nobody: ['みんな忘れちゃったクマ〜？しょんぼりクマ', 'ふーさん、影がうすいクマ…？']
  };
  var PER_OPTS = [{ v: 2, l: '2つ', s: '短め' }, { v: 3, l: '3つ', s: '標準' }, { v: 4, l: '4つ', s: 'じっくり' }];
  var SHOW_OPTS = [{ v: 3, l: '3秒', s: 'むずかしい' }, { v: 5, l: '5秒', s: '標準' }, { v: 8, l: '8秒', s: 'やさしい' }];
  var QUIZ_OPTS = [{ v: 0, l: 'ぜんぶ', s: '標準' }, { v: 8, l: '8問', s: '' }, { v: 12, l: '12問', s: '' }, { v: 16, l: '16問', s: '' }];
  var LS_ID = 'ob-online-client-id', LS_NAME = 'ob-online-name', LS_HOST = 'ob-online-host-room', SS_CLIENT = 'ob-online-joined', LS_VOICE = 'ob-online-voice';

  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) {} }
  function load(k, json) { try { var v = localStorage.getItem(k); return json ? JSON.parse(v) : v; } catch (e) { return null; } }
  function sstore(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function sload(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } }
  function rid(n) { var s = ''; for (var i = 0; i < n; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]; return s; }
  var myId = load(LS_ID) || (function () { var v = rid(16); store(LS_ID, v); return v; })();
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rand(a) { return a[0] + Math.random() * (a[1] - a[0]); }
  function cleanName(n) { return String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 8); }
  function genCode() { var c = ''; for (var i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return c; }
  function normCode(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/I/g, '1').slice(0, 4); }
  function inviteUrl(code) { var u = location.origin + location.pathname + '?room=' + code; if (Q.get('ice')) u += '&ice=' + encodeURIComponent(Q.get('ice')); return u; }
  function colorOf(i) { return COLORS[i % COLORS.length]; }

  // ---------- 汎用UI ----------
  function show(id) { ['title', 'lobby', 'game', 'end'].forEach(function (s) { $(s).classList.toggle('active', s === id); }); }
  function overlay(id, on) { $(id).classList.toggle('active', on); }
  var toastT;
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 3000); }
  function banner(msg) { var b = $('banner'); b.textContent = msg || ''; b.classList.toggle('show', !!msg); }
  function confirmBox(title, text, yes, cb) {
    $('cfTitle').textContent = title; $('cfText').textContent = text; $('cfYes').textContent = yes; $('cfNo').style.display = '';
    overlay('confirmModal', true);
    $('cfYes').onclick = function () { overlay('confirmModal', false); cb(); };
    $('cfNo').onclick = function () { overlay('confirmModal', false); };
  }
  function alertBox(msg) { confirmBox('お知らせ', msg, 'OK', function () {}); $('cfNo').style.display = 'none'; }
  function connecting(on, title, text, onCancel) {
    overlay('connecting', on);
    if (on) { $('connTitle').textContent = title || '接続中…'; $('connText').textContent = text || ''; $('connCancel').onclick = onCancel || function () { location.href = location.pathname; }; }
  }
  $('rulesBtn1').onclick = $('rulesBtn2').onclick = function () { overlay('rulesModal', true); };
  $('rulesClose').onclick = function () { overlay('rulesModal', false); };
  ['rulesModal', 'menuModal'].forEach(function (id) { $(id).addEventListener('click', function (e) { if (e.target === this) overlay(id, false); }); });

  // ---------- 読み上げ（speechSynthesis） ----------
  var voiceOn = load(LS_VOICE) === 'on';
  function voiceBtn() { $('voiceBtn').textContent = (voiceOn ? '🔊' : '🔇') + ' 読み上げ'; }
  $('voiceBtn').onclick = function () {
    if (!('speechSynthesis' in window)) { toast('この端末は読み上げに対応していません'); return; }
    voiceOn = !voiceOn; store(LS_VOICE, voiceOn ? 'on' : 'off'); voiceBtn(); toast(voiceOn ? '読み上げ ON' : '読み上げ OFF');
    if (!voiceOn) try { speechSynthesis.cancel(); } catch (e) {}
  };
  voiceBtn();
  function speak(text) {
    if (!voiceOn || !('speechSynthesis' in window)) return;
    try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(text.replace(/🐻/g, '')); u.lang = 'ja-JP'; u.rate = 1.05; speechSynthesis.speak(u); } catch (e) {}
  }

  // =====================================================================
  //  ホスト（authoritative）
  // =====================================================================
  var host = null;
  function hostId(code) { return ID_PREFIX + code; }
  function newRoom(name) {
    return { code: genCode(), phase: 'lobby', opts: { per: 3, show: 5, quiz: 0 }, nextSid: 2, gameNo: 0, seats: [{ sid: 1, name: name, kind: 'host', clientId: myId, connected: true }], pids: null, G: null, notice: null, lobbyReq: null };
  }
  function startHost(name, resumeRoom) {
    document.body.classList.add('is-host');
    host = { room: resumeRoom || newRoom(name), conns: {}, lastSeen: {}, tries: 0, opened: false };
    if (resumeRoom) host.room.seats.forEach(function (s) { if (s.kind === 'remote') s.connected = false; });
    connecting(true, resumeRoom ? '部屋を再開しています…' : '部屋を作っています…', 'シグナリングサーバーに接続中', function () { location.href = location.pathname; });
    openHostPeer();
    setInterval(hostHeartbeat, 2000);
    setInterval(hostTick, TURBO ? 40 : 100);
  }
  function openHostPeer() {
    var R = host.room, peer = new Peer(hostId(R.code), PEER_OPTS);
    host.peer = peer;
    peer.on('open', function () { host.opened = true; host.tries = 0; connecting(false); banner(''); hostRender(); saveHost(); });
    peer.on('connection', function (conn) {
      conn.on('data', function (msg) { hostOnMessage(conn, msg); });
      conn.on('close', function () { hostConnClosed(conn); });
      conn.on('error', function () { hostConnClosed(conn); });
    });
    peer.on('disconnected', function () { if (!peer.destroyed) setTimeout(function () { try { peer.reconnect(); } catch (e) {} }, 2000); });
    peer.on('error', function (e) {
      if (e.type === 'unavailable-id') {
        try { peer.destroy(); } catch (x) {}
        if (!host.opened && R.phase === 'lobby' && !host.resuming) { R.code = genCode(); openHostPeer(); return; }
        if (++host.tries > 25) { connecting(false); toast('部屋を再開できませんでした'); return; }
        connecting(true, '部屋を再開しています…', '少し時間がかかることがあります（' + host.tries + '）');
        setTimeout(openHostPeer, 3000);
      } else if (['network', 'server-error', 'socket-error', 'socket-closed'].indexOf(e.type) >= 0) {
        if (!host.opened) { connecting(true, 'サーバーに接続できません', '通信環境を確認してください。再試行しています…'); setTimeout(function () { try { peer.destroy(); } catch (x) {} openHostPeer(); }, 4000); }
        else banner('シグナリングサーバーとの接続が不安定です（ゲームは続行できます）');
      } else if (e.type === 'browser-incompatible') connecting(true, 'このブラウザは対応していません', 'Chrome / Safari の最新版でお試しください');
    });
  }
  function seatByClient(cid) { return host.room.seats.filter(function (s) { return s.clientId === cid; })[0]; }
  function seatBySid(sid) { return host.room.seats.filter(function (s) { return s.sid === sid; })[0]; }
  function seatOfP(i) { return seatBySid(host.room.pids[i]); }
  function hostOnMessage(conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    var R = host.room;
    if (msg.t === 'join') return hostJoin(conn, msg);
    var seat = conn.clientId && seatByClient(conn.clientId);
    if (!seat || host.conns[conn.clientId] !== conn) return;
    host.lastSeen[conn.clientId] = Date.now();
    if (msg.t === 'ping') return;
    if (msg.t === 'lobbyReq') return hostLobbyReq(seat);
    var p = R.pids ? R.pids.indexOf(seat.sid) : -1;
    if (msg.t === 'intro') { if (p >= 0 && msg.g === R.gameNo) { var r = hostIntro(p, msg.text, msg.cur, false); if (r) conn.send({ t: 'error', msg: r }); } return; }
    if (msg.t === 'ans') { if (p >= 0 && msg.g === R.gameNo) hostAnswer(p, +msg.c, msg.qi); return; }
    if (msg.t === 'leave') {
      if (R.phase === 'lobby') R.seats.splice(R.seats.indexOf(seat), 1); else { seat.connected = false; seat.left = true; }
      delete host.conns[conn.clientId]; try { conn.close(); } catch (e) {}
      if (R.phase !== 'lobby') toastAll(seat.name + 'が退出しました');
      hostBroadcast();
    }
  }
  function hostJoin(conn, msg) {
    var R = host.room, name = cleanName(msg.name), cid = String(msg.clientId || '').slice(0, 40);
    function reject(text) { conn.send({ t: 'reject', msg: text }); setTimeout(function () { try { conn.close(); } catch (e) {} }, 500); }
    if (!name || !cid) return reject('ニックネームを入力してください');
    if (cid === myId) return reject('ホストと同じ端末・ブラウザからは参加できません');
    var seat = seatByClient(cid);
    if (!seat) { seat = R.seats.filter(function (s) { return s.name === name && s.kind === 'remote' && !s.connected; })[0]; if (seat) seat.clientId = cid; }
    if (seat) {
      if (seat.kind !== 'remote') return reject('この名前は使えません');
      var old = host.conns[cid]; if (old && old !== conn) { try { old.close(); } catch (e) {} }
      seat.connected = true; seat.left = false;
    } else {
      if (R.phase !== 'lobby') return reject('この部屋はゲーム中です。前に参加していた人は、同じニックネームで入ると元の席に戻れます。');
      if (R.seats.length >= MAXP) return reject('満員です（最大' + MAXP + '人）');
      if (R.seats.some(function (s) { return s.name === name; })) return reject('その名前はすでに使われています。別のニックネームにしてください。');
      seat = { sid: R.nextSid++, name: name, kind: 'remote', clientId: cid, connected: true };
      R.seats.push(seat); renumberCpus();
    }
    conn.clientId = cid; host.conns[cid] = conn; host.lastSeen[cid] = Date.now();
    conn.send({ t: 'welcome', code: R.code, sid: seat.sid });
    hostBroadcast();
  }
  function hostConnClosed(conn) {
    if (!conn.clientId || host.conns[conn.clientId] !== conn) return;
    delete host.conns[conn.clientId];
    var seat = seatByClient(conn.clientId);
    if (seat && seat.connected) { seat.connected = false; seat.lostAt = Date.now(); hostBroadcast(); }
  }
  function hostHeartbeat() {
    if (!host) return;
    var now = Date.now();
    Object.keys(host.conns).forEach(function (cid) {
      var c = host.conns[cid];
      try { c.send({ t: 'hb' }); } catch (e) {}
      if (now - (host.lastSeen[cid] || 0) > LOST_MS) { try { c.close(); } catch (e) {} hostConnClosed(c); }
    });
  }
  function renumberCpus() {
    var cpus = host.room.seats.filter(function (s) { return s.kind === 'cpu' && CPU_DEFAULT_RE.test(s.name); });
    cpus.forEach(function (s, k) { s.name = cpus.length === 1 ? CPU_BASE : CPU_BASE + (k + 1); });
  }
  function toastAll(msg) { var R = host.room; R.notice = { id: (R.notice ? R.notice.id : 0) + 1, msg: msg, toast: true }; }
  function say(p, kind) { var G = host.room.G; G.lines.push({ id: ++G.lineId, p: p, text: pick(LINES[kind]) }); if (G.lines.length > 3) G.lines.shift(); }
  function isCpu(p) { var s = seatOfP(p); return s && s.kind === 'cpu'; }
  function isActive(p) { var s = seatOfP(p); return s && (s.kind !== 'remote' || s.connected); }

  // ---- 進行 ----
  function hostStartGame() {
    var R = host.room, n = R.seats.length;
    if (n < 2 || n > MAXP) return;
    renumberCpus();
    R.gameNo++; R.pids = R.seats.map(function (s) { return s.sid; }); R.lobbyReq = null;
    var G = R.G = O.createGame(n, R.opts.per, (Math.random() * 4294967296) >>> 0);
    G.lines = []; G.lineId = 0;
    R.phase = 'intro'; beginWrite();
    hostBroadcast();
  }
  function showMs() { return T.show || host.room.opts.show * 1000; }
  function beginWrite() {
    var G = host.room.G, it = G.intros[G.cur];
    G.sub = 'write'; G.writeStart = Date.now(); G.until = 0; G.lines = [];
    G.cpuAt = isCpu(it.p) ? Date.now() + rand(T.cpuWrite) : 0;
    if (G.cpuAt && Math.random() < 0.4) say(it.p, 'write');
  }
  // 自己紹介の答えを受け付ける
  function hostIntro(p, text, cur, byCpu) {
    var R = host.room, G = R.G;
    if (R.phase !== 'intro' || G.sub !== 'write' || cur !== G.cur) return null;
    var it = G.intros[G.cur]; if (it.p !== p) return 'あなたの番ではありません';
    var t = O.cleanAnswer(text); if (!t) return '答えを入力してください';
    it.text = t; it.cpu = !!byCpu; G.sub = 'show'; G.until = Date.now() + showMs(); G.lines = [];
    if (isCpu(p)) say(p, 'mine');
    else { var cpus = R.pids.map(function (_, i) { return i; }).filter(function (i) { return i !== p && isCpu(i); }); if (cpus.length && Math.random() < 0.6) say(pick(cpus), 'listen'); }
    hostBroadcast();
    return null;
  }
  function hostSkipWriter() {
    var R = host.room, G = R.G; if (R.phase !== 'intro' || G.sub !== 'write') return;
    var it = G.intros[G.cur];
    hostIntro(it.p, O.cpuAnswer(it.k, Math.random), G.cur, true);
    toastAll('🐻 ' + seatOfP(it.p).name + 'の代わりに、ふーさんが答えました');
    hostBroadcast();
  }
  function startQuiz() {
    var R = host.room, G = R.G;
    R.phase = 'quiz'; G.quiz = O.buildQuiz(G, R.opts.quiz, G.seed); G.qi = -1; G.qsub = 'ready'; G.until = Date.now() + T.ready; G.lines = [];
  }
  function nextQuestion() {
    var R = host.room, G = R.G;
    G.qi++; G.lines = [];
    if (G.qi >= G.quiz.length) { R.phase = 'end'; G.qsub = null; return; }
    var q = G.quiz[G.qi], now = Date.now();
    G.qsub = 'ask'; G.ans = {}; G.pts = null; G.until = now + T.ask; G.plan = {}; G.askStart = now;
    R.pids.forEach(function (_, p) {
      if (p === q.p || !isCpu(p)) return;
      var c = Math.random() < CPU_ACC ? q.correct : pick([0, 1, 2, 3].filter(function (x) { return x !== q.correct && x < q.choices.length; }));
      G.plan[p] = { at: now + rand(T.cpuAns), c: c };
    });
    if (isCpu(q.p)) say(q.p, 'about');
  }
  function eligible(p) { var q = host.room.G.quiz[host.room.G.qi]; return p !== q.p && isActive(p); }
  function hostAnswer(p, c, qi) {
    var R = host.room, G = R.G;
    if (R.phase !== 'quiz' || G.qsub !== 'ask' || qi !== G.qi || G.ans[p] || !eligible(p)) return;
    var q = G.quiz[G.qi]; if (!(c >= 0 && c < q.choices.length)) return;
    G.ans[p] = { c: c, at: Date.now() };
    if (isCpu(p) && Math.random() < 0.5) say(p, 'think');
    if (R.pids.every(function (_, i) { return !eligible(i) || G.ans[i]; })) reveal();
    hostBroadcast();
  }
  function reveal() {
    var R = host.room, G = R.G, q = G.quiz[G.qi];
    G.pts = O.scoreAnswers(q, G.ans);
    Object.keys(G.pts).forEach(function (p) { G.scores[p] += G.pts[p]; if (G.ans[p].c === q.correct) G.rights[p]++; });
    G.qsub = 'reveal'; G.until = Date.now() + T.reveal; G.lines = [];
    var cpus = Object.keys(G.ans).map(Number).filter(isCpu);
    if (cpus.length) { var c = pick(cpus); say(c, G.ans[c].c === q.correct ? 'right' : 'wrong'); }
    if (isCpu(q.p) && !Object.keys(G.ans).some(function (p) { return G.ans[p].c === q.correct; })) say(q.p, 'nobody');
  }
  function hostTick() {
    if (!host || !host.opened) return;
    var R = host.room, G = R.G, now = Date.now();
    if (R.phase === 'intro') {
      var it = G.intros[G.cur], s = seatOfP(it.p);
      if (G.sub === 'write') {
        if (s.kind === 'cpu' && G.cpuAt && now >= G.cpuAt) hostIntro(it.p, O.cpuAnswer(it.k, Math.random, G.intros.filter(function (x) { return x.text; }).map(function (x) { return O.norm(x.text); })), G.cur, true);
        else if (s.kind === 'remote' && !s.connected && now - Math.max(G.writeStart, s.lostAt || 0) > AUTO_SKIP_MS) hostSkipWriter();
      } else if (G.sub === 'show' && now >= G.until) {
        G.cur++;
        if (G.cur >= G.intros.length) startQuiz(); else beginWrite();
        hostBroadcast();
      }
    } else if (R.phase === 'quiz') {
      if (G.qsub === 'ready' && now >= G.until) { nextQuestion(); hostBroadcast(); }
      else if (G.qsub === 'ask') {
        Object.keys(G.plan).forEach(function (p) { var pl = G.plan[p]; if (!pl.done && now >= pl.at) { pl.done = true; hostAnswer(+p, pl.c, G.qi); } });
        if (G.qsub === 'ask' && (now >= G.until || R.pids.every(function (_, i) { return !eligible(i) || G.ans[i]; }))) { reveal(); hostBroadcast(); }
      } else if (G.qsub === 'reveal' && now >= G.until) { nextQuestion(); hostBroadcast(); }
    }
  }

  // ---- 各プレイヤー向けの「見せてよい情報だけ」のビュー ----
  function viewFor(sid) {
    var R = host.room, G = R.G, now = Date.now(), you = -1;
    R.seats.forEach(function (s, i) { if (s.sid === sid) you = i; });
    var v = {
      t: 'state', phase: R.phase, code: R.code, you: you, sid: sid, gameNo: R.gameNo, opts: { per: R.opts.per, show: R.opts.show, quiz: R.opts.quiz },
      seats: R.seats.map(function (s) { return { sid: s.sid, name: s.name, kind: s.kind, connected: s.kind !== 'remote' || s.connected }; }),
      notice: R.notice
    };
    if (sid === 1 && R.lobbyReq && R.phase !== 'lobby') v.lobbyReq = R.lobbyReq;
    if (R.phase === 'lobby' || !G) return v;
    v.pids = R.pids.slice();
    var g = v.g = { n: G.n, lines: G.lines.slice() };
    if (R.phase === 'intro') {
      var it = G.intros[G.cur];
      g.cur = G.cur; g.total = G.intros.length; g.sub = G.sub; g.p = it.p; g.k = it.k; g.round = Math.floor(G.cur / G.n) + 1; g.per = G.per;
      if (G.sub === 'show') { g.text = it.text; g.cpu = it.cpu; g.left = Math.max(0, G.until - now); g.ms = showMs(); }   // 答えは表示中だけ送る
    } else if (R.phase === 'quiz') {
      g.scores = G.scores.slice(); g.qsub = G.qsub; g.total = G.quiz.length; g.qi = G.qi; g.left = Math.max(0, G.until - now);
      g.ms = G.qsub === 'ask' ? T.ask : G.qsub === 'reveal' ? T.reveal : T.ready;
      if (G.qsub !== 'ready') {
        var q = G.quiz[G.qi]; g.q = { p: q.p, k: q.k, choices: q.choices.slice() };
        g.answered = Object.keys(G.ans).map(Number);
        var me = R.pids.indexOf(sid); if (me >= 0 && G.ans[me]) g.mine = G.ans[me].c;
        if (G.qsub === 'reveal') { g.correct = q.correct; g.ans = {}; Object.keys(G.ans).forEach(function (p) { g.ans[p] = { c: G.ans[p].c, pts: G.pts[p], at: G.ans[p].at - G.askStart }; }); }
      }
    } else if (R.phase === 'end') {
      g.scores = G.scores.slice(); g.rights = G.rights.slice(); g.total = G.quiz.length;
      g.intros = G.intros.map(function (x) { return { p: x.p, k: x.k, text: x.text, cpu: x.cpu }; });   // ゲーム終了後は答え合わせ用に公開
    }
    return v;
  }
  function hostToLobby(msg) {
    var R = host.room;
    R.phase = 'lobby'; R.G = null; R.pids = null; R.lobbyReq = null;
    R.seats = R.seats.filter(function (s) { if (s.kind === 'remote') { s.left = false; return !!s.connected; } return true; });
    renumberCpus();
    R.notice = { id: (R.notice ? R.notice.id : 0) + 1, msg: msg };
    hostBroadcast();
  }
  function hostLobbyReq(seat) {
    var R = host.room;
    if (seat.kind !== 'remote' || R.phase === 'lobby') return;
    if (R.lobbyReq && R.lobbyReq.sid === seat.sid && Date.now() - R.lobbyReq.at < 5000) return;
    R.lobbyReq = { sid: seat.sid, name: seat.name, at: Date.now() };
    hostBroadcast();
  }
  function hostBroadcast() {
    var R = host.room;
    R.seats.forEach(function (s) { if (s.kind !== 'remote') return; var c = host.conns[s.clientId]; if (c && c.open) { try { c.send(viewFor(s.sid)); } catch (e) {} } });
    hostRender(); saveHost();
  }
  function hostRender() { render(viewFor(1)); }
  function saveHost() { store(LS_HOST, { room: host.room, saved: Date.now() }); }

  // ---- ホストのロビー操作 ----
  $('addCpuBtn').onclick = function () {
    var R = host && host.room; if (!R || R.phase !== 'lobby' || R.seats.length >= MAXP) return;
    R.seats.push({ sid: R.nextSid++, name: CPU_BASE, kind: 'cpu', connected: true }); renumberCpus(); hostBroadcast();
  };
  $('seatList').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-sid]'); if (!b || !host) return;
    var R = host.room, seat = seatBySid(+b.dataset.sid);
    if (!seat || seat.kind === 'host' || R.phase !== 'lobby') return;
    var doRemove = function () {
      if (seat.kind === 'remote') { var c = host.conns[seat.clientId]; if (c) { try { c.send({ t: 'kicked' }); } catch (x) {} setTimeout(function () { try { c.close(); } catch (x) {} }, 300); delete host.conns[seat.clientId]; } }
      R.seats.splice(R.seats.indexOf(seat), 1); renumberCpus(); hostBroadcast();
    };
    if (seat.kind === 'remote' && seat.connected) confirmBox(seat.name + 'を外しますか？', '部屋から退出させます。', '外す', doRemove); else doRemove();
  });
  function optSeg(id, key, list) {
    $(id).addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !host || host.room.phase !== 'lobby') return;
      var v = +b.dataset.v; if (list.some(function (o) { return o.v === v; })) { host.room.opts[key] = v; hostBroadcast(); }
    });
  }
  optSeg('perSeg', 'per', PER_OPTS); optSeg('showSeg', 'show', SHOW_OPTS); optSeg('quizSeg', 'quiz', QUIZ_OPTS);
  $('startBtn').onclick = function () { if (host) hostStartGame(); };
  $('againBtn').onclick = function () { if (host && host.room.phase === 'end') hostStartGame(); };
  $('toLobbyBtn').onclick = function () { if (host && host.room.phase === 'end') hostToLobby('ロビーに戻りました'); };
  $('copyBtn').onclick = function () {
    var u = $('inviteUrl').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { toast('招待URLをコピーしました'); }, function () { toast('コピーできませんでした。URLを長押ししてコピーしてください'); });
  };
  $('shareBtn').onclick = function () {
    var u = $('inviteUrl').textContent;
    if (navigator.share) navigator.share({ title: 'ふーです🐻。トーストに塗るのはメイプルシロップです。', text: '自己紹介して、覚えて、クイズで勝負！', url: u }).catch(function () {}); else $('copyBtn').click();
  };

  // =====================================================================
  //  参加者（クライアント）
  // =====================================================================
  var client = null;
  function startClient(code, name) {
    document.body.classList.remove('is-host');
    client = { code: code, name: name, joined: false, lastMsg: Date.now(), everJoined: false };
    connecting(true, '部屋 ' + code + ' に接続中…', 'しばらくお待ちください', function () { leaveClient(true); });
    var peer = new Peer(PEER_OPTS);
    client.peer = peer;
    peer.on('open', function () { clientConnect(); });
    peer.on('disconnected', function () { if (!peer.destroyed) setTimeout(function () { try { peer.reconnect(); } catch (e) {} }, 2000); });
    peer.on('error', function (e) {
      if (e.type === 'peer-unavailable') { if (!client.everJoined) { connecting(false); toast('部屋が見つかりません。コードを確認してください。'); leaveClient(false); } else clientLost(); }
      else if (['network', 'server-error', 'socket-error', 'socket-closed'].indexOf(e.type) >= 0) { if (!client.everJoined) connecting(true, 'サーバーに接続できません', '通信環境を確認してください。再試行しています…'); }
      else if (e.type === 'browser-incompatible') connecting(true, 'このブラウザは対応していません', 'Chrome / Safari の最新版でお試しください');
    });
    clearInterval(client.hbTimer); client.hbTimer = setInterval(clientHeartbeat, HB_MS);
    setTimeout(function () { if (client && !client.everJoined && $('connecting').classList.contains('active')) $('connText').textContent = 'つながりにくいようです。コードが正しいか、ホストが部屋を開いているか確認してください。（通信環境によっては接続できない場合があります）'; }, 15000);
  }
  function clientConnect() {
    if (!client || !client.peer || client.peer.destroyed) return;
    if (client.conn) { try { client.conn.close(); } catch (e) {} }
    var conn = client.peer.connect(hostId(client.code), { reliable: true });
    client.conn = conn;
    conn.on('open', function () { conn.send({ t: 'join', name: client.name, clientId: myId }); });
    conn.on('data', function (m) { if (client && client.conn === conn) clientOnMessage(m); });
    conn.on('close', function () { if (client && client.conn === conn) clientLost(); });
    conn.on('error', function () { if (client && client.conn === conn) clientLost(); });
  }
  function clientOnMessage(m) {
    if (!m || typeof m !== 'object') return;
    client.lastMsg = Date.now();
    if (m.t === 'welcome') { client.joined = true; client.everJoined = true; connecting(false); banner(''); sstore(SS_CLIENT, { code: client.code, name: client.name }); }
    else if (m.t === 'state') render(m);
    else if (m.t === 'reject') { connecting(false); leaveClient(false); alertBox(m.msg); }
    else if (m.t === 'kicked') { sstore(SS_CLIENT, null); leaveClient(false); alertBox('ホストによって部屋から外されました。'); }
    else if (m.t === 'closed') { sstore(SS_CLIENT, null); leaveClient(false); alertBox('ホストが部屋を閉じました。'); }
    else if (m.t === 'error') { sentKey = ''; toast(m.msg); var b = $('ansGo'); if (b) { b.disabled = false; b.textContent = '決定！'; } }
  }
  function clientHeartbeat() {
    if (!client) return;
    if (client.conn && client.conn.open) { try { client.conn.send({ t: 'ping' }); } catch (e) {} }
    if (client.everJoined && Date.now() - client.lastMsg > LOST_MS) clientLost();
  }
  function clientLost() {
    if (!client || !client.everJoined) return;
    client.joined = false; banner('ホストとの接続が切れました。再接続しています…');
    clearTimeout(client.retryT);
    client.retryT = setTimeout(function () {
      if (!client) return; client.lastMsg = Date.now();
      if (client.peer.disconnected && !client.peer.destroyed) { try { client.peer.reconnect(); } catch (e) {} }
      clientConnect();
    }, 3000);
  }
  function leaveClient(sendLeave) {
    if (!client) return;
    if (sendLeave && client.conn && client.conn.open) { try { client.conn.send({ t: 'leave' }); } catch (e) {} }
    clearInterval(client.hbTimer); clearTimeout(client.retryT);
    var p = client.peer; client = null;
    setTimeout(function () { try { p.destroy(); } catch (e) {} }, 300);
    banner(''); connecting(false); show('title'); renderTitle();
  }
  function send(m) { if (client && client.conn && client.conn.open) client.conn.send(m); }

  // ---- 操作 ----
  var lastView = null, sentKey = '';
  function myP(v) { return v && v.pids ? v.pids.indexOf(v.sid) : -1; }
  function submitIntro() {
    var v = lastView, g = v && v.g; if (!g || v.phase !== 'intro' || g.sub !== 'write' || g.p !== myP(v)) return;
    var inp = $('ansIn'), t = O.cleanAnswer(inp ? inp.value : '');
    if (!t) { toast('答えを入力してください'); if (inp) inp.focus(); return; }
    var key = v.gameNo + ':i:' + g.cur; if (sentKey === key) return; sentKey = key;
    if (host) { var r = hostIntro(myP(v), t, g.cur, false); if (r) { sentKey = ''; toast(r); } }
    else { send({ t: 'intro', text: t, cur: g.cur, g: v.gameNo }); var b = $('ansGo'); if (b) { b.disabled = true; b.textContent = '送信中…'; } }
  }
  function answer(c) {
    var v = lastView, g = v && v.g; if (!g || v.phase !== 'quiz' || g.qsub !== 'ask' || g.mine != null || g.q.p === myP(v) || myP(v) < 0) return;
    var key = v.gameNo + ':q:' + g.qi; if (sentKey === key) return; sentKey = key;
    pendingChoice = { key: key, c: c };
    if (host) hostAnswer(myP(v), c, g.qi); else { send({ t: 'ans', c: c, qi: g.qi, g: v.gameNo }); renderGame(v); }
  }
  var pendingChoice = null;
  $('stage').addEventListener('click', function (e) {
    var c = e.target.closest('.choice[data-c]'); if (c && !c.disabled) return answer(+c.dataset.c);
    if (e.target.closest('#ansGo')) return submitIntro();
    if (e.target.closest('#ansRand')) { var v = lastView; if (v && v.g) { $('ansIn').value = O.cpuAnswer(v.g.k, Math.random); updCounter(); } return; }
    if (e.target.closest('#skipBtn') && host) confirmBox('ふーさんに代わりに答えてもらいますか？', '答えられない人の代わりに、ふーさん🐻がそれっぽい答えを入れます。', '代わりに答える', hostSkipWriter);
  });
  $('stage').addEventListener('keydown', function (e) { if (e.target.id === 'ansIn' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submitIntro(); } });
  $('stage').addEventListener('input', function (e) { if (e.target.id === 'ansIn') updCounter(); });
  function updCounter() { var i = $('ansIn'), c = $('ansCnt'); if (i && c) c.textContent = Array.from(i.value).length + ' / ' + O.MAX_ANS; }

  function leaveRoom() {
    if (host) {
      confirmBox('部屋を閉じますか？', '参加者全員の接続が切れ、ゲームは終了します。', '部屋を閉じる', function () {
        Object.keys(host.conns).forEach(function (cid) { try { host.conns[cid].send({ t: 'closed' }); } catch (e) {} });
        store(LS_HOST, null);
        setTimeout(function () { try { host.peer.destroy(); } catch (e) {} location.href = location.pathname; }, 400);
      });
    } else confirmBox('部屋を出ますか？', 'ゲーム中に出た場合も、同じニックネームで入り直せば元の席に戻れます。', '部屋を出る', function () { sstore(SS_CLIENT, null); leaveClient(true); });
  }
  $('leaveBtn1').onclick = $('leaveBtn2').onclick = leaveRoom;
  $('menuBtn').onclick = function () { overlay('menuModal', true); };
  function confirmAbort() {
    confirmBox('中断してロビーに戻りますか？', 'いまのゲームを終了して、全員をこの部屋のロビーに戻します。部屋コード・参加者・ふーさん🐻・設定はそのままです。', '中断してロビーへ', function () {
      if (host && host.room.phase !== 'lobby') hostToLobby('⏸️ ホストがゲームを中断しました');
    });
  }
  $('menuAbort').onclick = function () { overlay('menuModal', false); confirmAbort(); };
  $('menuReq').onclick = function () { overlay('menuModal', false); send({ t: 'lobbyReq' }); toast('ホストに「ロビーに戻りたい」と伝えました'); };
  $('menuLeave').onclick = function () { overlay('menuModal', false); leaveRoom(); };
  $('menuRules').onclick = function () { overlay('menuModal', false); overlay('rulesModal', true); };
  $('menuClose').onclick = function () { overlay('menuModal', false); };
  $('lobbyReqBar').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-lr]'); if (!b || !host) return;
    if (b.dataset.lr === 'no') { host.room.lobbyReq = null; hostBroadcast(); } else confirmAbort();
  });
  var seenNotice = null;
  function noticeUi(v) {
    if (seenNotice === null) seenNotice = v.notice ? v.notice.id : 0;
    else if (v.notice && v.notice.id !== seenNotice) { seenNotice = v.notice.id; if (v.notice.toast || !host) toast(v.notice.msg + (!v.notice.toast && v.phase === 'lobby' ? '。ロビーで次のゲームを待っています' : '')); }
    if (v.phase === 'lobby') overlay('menuModal', false);
    var bar = $('lobbyReqBar'), key = host && v.lobbyReq && v.phase !== 'lobby' ? v.lobbyReq.sid + ':' + v.lobbyReq.at : '';
    if (bar.dataset.key !== key) {
      bar.dataset.key = key;
      bar.innerHTML = key ? '<span>🙋 ' + esc(v.lobbyReq.name) + '「ロビーに戻りたい」</span><button data-lr="abort">中断してロビーへ</button><button data-lr="no" class="ghost">とじる</button>' : '';
      bar.classList.toggle('show', !!key);
    }
  }

  // =====================================================================
  //  描画（ホスト・参加者で共通。受け取ったビューだけを使う）
  // =====================================================================
  function seatOfView(v, i) { var sid = v.pids[i]; return v.seats.filter(function (s) { return s.sid === sid; })[0] || { name: '?', kind: 'remote', connected: false }; }
  function nameOf(v, i) { return seatOfView(v, i).name; }
  function av(v, i, big) { var s = seatOfView(v, i); return '<span class="av" style="background:' + colorOf(i) + '">' + (s.kind === 'cpu' ? BEAR : esc(Array.from(s.name)[0] || '?')) + '</span>'; }
  function render(v) {
    lastView = v; window.__ob.view = v;
    noticeUi(v);
    if (v.phase === 'lobby') { show('lobby'); renderLobby(v); stageKey = ''; return; }
    if (v.phase === 'end') { show('end'); renderEnd(v); return; }
    show('game'); renderGame(v);
  }
  function renderLobby(v) {
    var isHost = !!host;
    $('codeBig').textContent = v.code;
    var url = inviteUrl(v.code);
    $('inviteUrl').textContent = url;
    if ($('qr').dataset.url !== url) { try { var qr = qrcode(0, 'M'); qr.addData(url); qr.make(); $('qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (e) { $('qr').textContent = ''; } $('qr').dataset.url = url; }
    var n = v.seats.length;
    $('seatCount').textContent = n + ' / ' + MAXP + '人';
    $('seatList').innerHTML = v.seats.map(function (s, i) {
      var tags = (s.kind === 'host' ? '<span class="tagx host">ホスト</span>' : '') + (s.kind === 'cpu' ? '<span class="tagx cpu">' + BEAR + ' CPU</span>' : '') + (i === v.you ? '<span class="tagx you">あなた</span>' : '') + (s.kind === 'remote' && !s.connected ? '<span class="tagx off">切断</span>' : '');
      return '<div class="seat' + (s.connected ? '' : ' offline') + '"><span class="av" style="background:' + colorOf(i) + '">' + (s.kind === 'cpu' ? BEAR : i + 1) + '</span><span class="nm">' + esc(s.name) + '</span>' + tags + (isHost && s.kind !== 'host' ? '<button class="xbtn" data-sid="' + s.sid + '" aria-label="外す">×</button>' : '') + '</div>';
    }).join('');
    $('addCpuBtn').disabled = n >= MAXP;
    $('seatHint').textContent = n < 2 ? 'あと' + (2 - n) + '人必要です（ふーさん🐻を追加できます）' : n >= MAXP ? '満員です' : '2〜8人で遊べます';
    $('startBtn').disabled = n < 2;
    function seg(id, list, cur) {
      $(id).innerHTML = list.map(function (o) { return '<button data-v="' + o.v + '" class="' + (o.v === cur ? 'on' : '') + '"' + (isHost ? '' : ' disabled') + '>' + o.l + (o.s ? '<small>' + o.s + '</small>' : '') + '</button>'; }).join('');
      $(id).classList.toggle('ro', !isHost);
    }
    seg('perSeg', PER_OPTS, v.opts.per); seg('showSeg', SHOW_OPTS, v.opts.show); seg('quizSeg', QUIZ_OPTS, v.opts.quiz);
  }
  function renderPlayers(v) {
    var g = v.g, mk = {};
    if (v.phase === 'intro') mk[g.p] = g.sub === 'write' ? '✍️' : '💬';
    if (v.phase === 'quiz' && g.q) { mk[g.q.p] = '👀'; (g.answered || []).forEach(function (p) { if (!mk[p]) mk[p] = g.qsub === 'reveal' ? (g.ans[p].c === g.correct ? '⭕' : '❌') : '✅'; }); }
    $('players').innerHTML = v.pids.map(function (_, i) {
      var s = seatOfView(v, i);
      return '<div class="pc' + ((v.phase === 'intro' && g.p === i) || (g.q && g.q.p === i) ? ' cur' : '') + (s.connected ? '' : ' off') + '">' + av(v, i) + '<span>' + esc(s.name) + (i === myP(v) ? '（あなた）' : '') + '</span>' + (g.scores ? '<span class="sc">' + g.scores[i] + '点</span>' : '') + (mk[i] ? '<span class="mk">' + mk[i] + '</span>' : '') + '</div>';
    }).join('');
  }
  function linesHtml(v) { return (v.g.lines || []).map(function (l) { return '<div class="line">' + BEAR + ' ' + esc(nameOf(v, l.p)) + '「' + esc(l.text) + '」</div>'; }).join(''); }
  function timerHtml(g) { return g.left != null ? '<div class="timer"><i data-dl="' + (Date.now() + g.left) + '" data-ms="' + g.ms + '" style="width:' + (100 * g.left / g.ms) + '%"></i></div>' : ''; }
  var stageKey = '', spokenKey = '';
  function renderGame(v) {
    var g = v.g, me = myP(v), key, h = '';
    renderPlayers(v);
    if (v.phase === 'intro') {
      var nm = nameOf(v, g.p), q = O.PROMPTS[g.k].q;
      $('phLabel').textContent = '① 自己紹介 ' + (g.cur + 1) + ' / ' + g.total;
      key = v.gameNo + ':i:' + g.cur + ':' + g.sub;
      var promptCard = '<div class="prompt"><div class="pl">お題カード（' + g.round + '巡目 / ' + g.per + '）</div><div class="pq">' + esc(q) + '</div></div>';
      if (g.sub === 'write' && g.p === me) {
        h = promptCard + '<div class="card"><div class="big" style="font-size:17px;margin-bottom:6px">✍️ あなたの番！</div><div class="sent">' + esc(nm) + 'です。<br>' + esc(q) + 'は…<input class="in" id="ansIn" maxlength="40" placeholder="ここに答えを入力" autocomplete="off" enterkeyhint="done">…です。</div><div class="counter" id="ansCnt">0 / ' + O.MAX_ANS + '</div>' +
          '<div class="row" style="margin-top:8px"><button class="btn" id="ansRand" style="flex:.6">🎲 おまかせ</button><button class="btn main" id="ansGo">決定！</button></div><p class="hint">決定すると、みんなの画面に数秒だけ表示されます。声に出して言うのもおすすめ！</p></div>';
      } else if (g.sub === 'write') {
        var s = seatOfView(v, g.p);
        h = promptCard + '<div class="card"><div class="speaker">' + av(v, g.p) + '<span>' + esc(nm) + 'の番</span></div><div class="wait">' + (s.kind === 'cpu' ? '🐻💭' : '✍️') + '</div><div class="mid">' + esc(O.san(nm)) + 'が答えを考えています…<br>表示されるのは数秒だけ。よーく見ててね！</div>' +
          (host && s.kind === 'remote' ? '<button class="btn" id="skipBtn" style="margin-top:10px;font-size:13px">⏭️ ふーさんに代わりに答えてもらう' + (s.connected ? '' : '（切断中）') + '</button>' : '') + '</div>';
      } else {
        h = promptCard + '<div class="speaker">' + av(v, g.p) + '<span>' + esc(nm) + (g.p === me ? '（あなた）' : '') + '</span></div><div class="bubble">' + esc(nm) + 'です。<br>' + esc(q) + 'は<span class="ans">' + esc(g.text) + '</span>です。</div>' + timerHtml(g) +
          '<div class="mid">👀 おぼえてね！ もうすぐ消えます</div>';
        if (spokenKey !== key) { spokenKey = key; speak(O.sentence(nm, g.k, g.text)); }
      }
    } else {
      $('phLabel').textContent = '② クイズ ' + (g.qsub === 'ready' ? '' : (g.qi + 1) + ' / ' + g.total);
      if (g.qsub === 'ready') { key = v.gameNo + ':ready'; h = '<div style="flex:1"></div><div class="wait" style="font-size:64px">❓</div><div class="big" style="font-size:30px">クイズタイム！</div><div class="mid">さっきの自己紹介、おぼえてるかな？<br>早く正解するほど高得点！</div><div style="flex:1"></div>'; }
      else {
        var about = g.q.p === me, pend = pendingChoice && pendingChoice.key === v.gameNo + ':q:' + g.qi ? pendingChoice.c : null, mine = g.mine != null ? g.mine : pend;
        key = v.gameNo + ':q:' + g.qi + ':' + g.qsub + ':' + (mine != null ? mine : '');
        var qtext = O.question(nameOf(v, g.q.p), g.q.k);
        h = '<div class="card"><div class="speaker" style="margin-bottom:6px">' + av(v, g.q.p) + '<span style="font-size:13px;opacity:.7">Q' + (g.qi + 1) + '</span></div><div class="q">' + esc(qtext) + '</div></div>' + timerHtml(g);
        if (about && g.qsub === 'ask') h += '<div class="big" style="font-size:18px">🙈 あなたのことだよ！<br>みんな覚えてるかな？</div>';
        h += '<div class="choices">' + g.q.choices.map(function (c, i) {
          var cls = 'choice', who = '';
          if (g.qsub === 'reveal') { cls += i === g.correct ? ' ok' : ' ng'; who = '<div class="who">' + Object.keys(g.ans).filter(function (p) { return g.ans[p].c === i; }).map(function (p) { return '<span style="background:' + colorOf(+p) + '">' + (seatOfView(v, +p).kind === 'cpu' ? BEAR : esc(Array.from(nameOf(v, +p))[0])) + '</span>'; }).join('') + '</div>'; }
          if (mine === i) cls += ' mine';
          var dis = g.qsub !== 'ask' || about || mine != null || me < 0;
          return '<button class="' + cls + '" data-c="' + i + '"' + (dis ? ' disabled' : '') + '>' + esc(c) + who + '</button>';
        }).join('') + '</div>';
        if (g.qsub === 'ask') h += '<div class="answered" id="answered"></div>' + (mine != null ? '<div class="mid">ほかの人の回答を待っています…</div>' : '');
        else {
          var order = Object.keys(g.ans).map(Number).sort(function (a, b) { return g.ans[b].pts - g.ans[a].pts || g.ans[a].at - g.ans[b].at; });
          h += '<div class="card"><div class="lab">正解は「' + esc(g.q.choices[g.correct]) + '」</div>' + (order.length ? order.map(function (p) { var a = g.ans[p]; return '<div class="res">' + av(v, p) + '<span class="nm">' + esc(nameOf(v, p)) + '</span><span>' + (a.c === g.correct ? '⭕ ' + (a.at / 1000).toFixed(1) + '秒' : '❌') + '</span><span class="pt">+' + a.pts + '</span></div>'; }).join('') : '<div class="mid">だれも答えませんでした</div>') + '</div>';
        }
        if (g.qsub === 'ask' && spokenKey !== v.gameNo + ':q:' + g.qi) { spokenKey = v.gameNo + ':q:' + g.qi; speak(qtext); }
      }
    }
    h += '<div class="lines" id="lines"></div>';
    if (key !== stageKey) { stageKey = key; $('stage').innerHTML = h; var inp = $('ansIn'); if (inp) { sentKey = ''; setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 50); } }
    else { var tm = $('stage').querySelector('.timer i'), nt = h.match(/data-dl="(\d+)"/); if (tm && nt) tm.dataset.dl = nt[1]; }
    $('lines').innerHTML = linesHtml(v);
    var an = $('answered');
    if (an) an.innerHTML = (g.answered || []).length ? g.answered.map(function (p) { return '<span>✅ ' + esc(nameOf(v, p)) + '</span>'; }).join('') : '<span>だれが一番早いかな？</span>';
  }
  setInterval(function () {
    var t = document.querySelectorAll('.timer i[data-dl]');
    for (var i = 0; i < t.length; i++) t[i].style.width = Math.max(0, Math.min(100, 100 * (+t[i].dataset.dl - Date.now()) / +t[i].dataset.ms)) + '%';
  }, 200);
  var endKey = '';
  function renderEnd(v) {
    var g = v.g, order = O.ranking(g.scores, g.rights), me = myP(v), medals = ['🥇', '🥈', '🥉'];
    var top = order[0], tie = order.filter(function (i) { return g.scores[i] === g.scores[top]; });
    $('endTitle').textContent = '🏆 ' + (tie.length > 1 ? '同点優勝！' : top === me ? 'あなたの優勝！' : nameOf(v, top) + 'の優勝！');
    $('endSub').textContent = '全' + g.total + '問のクイズでした';
    var rank = 0;
    $('rankList').innerHTML = order.map(function (i, k) {
      if (k === 0 || g.scores[i] !== g.scores[order[k - 1]]) rank = k;
      return '<div class="rk' + (rank === 0 ? ' first' : '') + '"><span class="md">' + (medals[rank] || rank + 1) + '</span>' + av(v, i) + '<span class="nm">' + esc(nameOf(v, i)) + (i === me ? '（あなた）' : '') + '<small>正解 ' + g.rights[i] + '問</small></span><span class="sc">' + g.scores[i] + '点</span></div>';
    }).join('');
    $('introList').innerHTML = v.pids.map(function (_, p) {
      return g.intros.filter(function (x) { return x.p === p; }).map(function (x) { return '<div class="intro"><span style="color:' + colorOf(p) + '">●</span> ' + esc(nameOf(v, p)) + '：' + esc(O.PROMPTS[x.k].q) + 'は<b>' + esc(x.text) + '</b>' + (x.cpu && seatOfView(v, p).kind !== 'cpu' ? '（ふーさん代理）' : '') + '</div>'; }).join('');
    }).join('');
    var k = v.code + ':' + v.gameNo;
    if (k !== endKey) { endKey = k; window.scrollTo(0, 0); confetti(); }
    $('leaveBtn2').textContent = host ? '🚪 部屋を閉じる' : '🚪 部屋を出る';
  }
  function confetti() {
    var colors = ['#ffd166', '#ff8fab', '#8ecae6', '#7fd8be', '#b9a7ff'];
    for (var i = 0; i < 36; i++) {
      var c = document.createElement('div'); c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw'; c.style.background = colors[i % colors.length];
      c.style.animationDuration = (2.2 + Math.random() * 2.5) + 's'; c.style.animationDelay = (Math.random() * 1.2) + 's';
      document.body.appendChild(c); setTimeout(function (el) { el.remove(); }.bind(null, c), 6500);
    }
  }

  // =====================================================================
  //  タイトル
  // =====================================================================
  function renderTitle() {
    if (!$('nameIn').value) $('nameIn').value = load(LS_NAME) || '';
    var inv = normCode(Q.get('room'));
    $('inviteJoinBox').style.display = inv.length === 4 ? '' : 'none';
    $('invCode').textContent = inv;
    if (inv.length === 4) $('codeIn').value = inv;
    var saved = load(LS_HOST, true), ok = saved && saved.room && Date.now() - saved.saved < 12 * 3600 * 1000;
    $('resumeBtn').style.display = ok ? '' : 'none';
    if (ok) $('resumeBtn').textContent = '前回の部屋（' + saved.room.code + '）を再開する';
    var joined = sload(SS_CLIENT);
    $('rejoinBtn').style.display = joined ? '' : 'none';
    if (joined) $('rejoinBtn').textContent = '部屋 ' + joined.code + ' に戻る（' + joined.name + '）';
  }
  function getName() {
    var n = cleanName($('nameIn').value);
    if (!n) { toast('ニックネームを入力してください'); $('nameIn').focus(); return null; }
    store(LS_NAME, n); return n;
  }
  $('createBtn').onclick = function () { var n = getName(); if (n) { store(LS_HOST, null); startHost(n, null); } };
  $('resumeBtn').onclick = function () { var saved = load(LS_HOST, true); if (!saved) return; startHost(saved.room.seats[0].name, saved.room); host.resuming = true; };
  function join(code) {
    var n = getName(); if (!n) return;
    code = normCode(code);
    if (code.length !== 4) { toast('4文字の部屋コードを入力してください'); return; }
    startClient(code, n);
  }
  $('joinBtn').onclick = function () { join($('codeIn').value); };
  $('joinInvitedBtn').onclick = function () { join(Q.get('room')); };
  $('rejoinBtn').onclick = function () { var j = sload(SS_CLIENT); if (j) { $('nameIn').value = j.name; startClient(j.code, j.name); } };
  $('codeIn').addEventListener('input', function () { this.value = normCode(this.value); });
  if (location.protocol === 'file:') setTimeout(function () { toast('ファイルを直接開いています。招待URLは公開URL（https）でのみ使えます。'); }, 500);

  // テスト・デバッグ用
  window.__ob = { view: null, role: function () { return host ? 'host' : client ? 'client' : 'none'; }, hostRoom: function () { return host ? host.room : null; } };
  renderTitle();
})();
