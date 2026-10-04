/* ふーです🐻。トーストに塗るのはメイプルシロップです。 — ルール（お題・ふーさんの答え・クイズ生成・得点）。ブラウザ / Node 共通 */
(function (root) {
  'use strict';
  // [お題, ふーさん🐻の答え（クイズのまぎらわしい選択肢にも使う）]
  var PROMPTS = [
    ['好きなおにぎりの具', '梅|ツナマヨ|鮭|昆布|明太子|おかか|いくら'],
    ['最近見た映画・ドラマ', 'アニメ映画|恋愛ドラマ|動物のドキュメンタリー|刑事ドラマ|ホラー映画|時代劇'],
    ['コンビニでつい買うもの', 'からあげ|プリン|アイス|おでん|チョコ|肉まん'],
    ['朝ごはんの定番', 'トースト|納豆ごはん|ヨーグルト|バナナ|目玉焼き|はちみつトースト'],
    ['子どものころの夢', 'パン屋さん|宇宙飛行士|サッカー選手|お花屋さん|学校の先生|はちみつ屋さん'],
    ['休みの日にすること', '昼寝|散歩|ゲーム|カフェめぐり|料理|大掃除'],
    ['好きな季節', '春|夏|秋|冬|梅雨|初夏'],
    ['好きな動物', 'クマ|ネコ|イヌ|ペンギン|カワウソ|パンダ'],
    ['カラオケの十八番', 'アニメの主題歌|昭和の歌謡曲|童謡|ロック|バラード|演歌'],
    ['よく使う絵文字', '😂|🥺|👍|🙏|✨|🐻'],
    ['苦手な食べ物', 'ピーマン|セロリ|パクチー|しいたけ|ゴーヤ|なす'],
    ['行ってみたい国', 'イタリア|フィンランド|カナダ|エジプト|アイスランド|ニュージーランド'],
    ['好きなパン', 'メロンパン|クロワッサン|カレーパン|あんぱん|食パン|チョココロネ'],
    ['ラーメンの好きな味', 'しょうゆ|みそ|とんこつ|しお|つけ麺|鶏白湯'],
    ['最近ハマっていること', '筋トレ|パズル|推し活|植物を育てること|お菓子づくり|はちみつ集め'],
    ['好きな色', '青|黄色|緑|ピンク|黒|オレンジ'],
    ['寝る前にすること', 'ストレッチ|スマホ|読書|日記|ホットミルク|明日の服を選ぶ'],
    ['好きなおでんの具', '大根|たまご|ちくわぶ|こんにゃく|もち巾着|はんぺん'],
    ['自分を動物にたとえると', 'ナマケモノ|リス|ウサギ|ライオン|コアラ|フクロウ'],
    ['好きなお寿司のネタ', 'サーモン|マグロ|えび|いくら|たまご|えんがわ'],
    ['雨の日の過ごし方', '映画を見る|二度寝|読書|部屋の片付け|ゲーム|雨音を聞く'],
    ['好きなアイスの味', 'バニラ|チョコミント|いちご|抹茶|ラムレーズン|はちみつ'],
    ['得意料理', 'カレー|卵焼き|からあげ|パスタ|お味噌汁|ホットケーキ'],
    ['旅行に必ず持っていくもの', 'モバイルバッテリー|まくら|お菓子|カメラ|本|ガイドブック'],
    ['好きなスポーツ', 'サッカー|野球|バスケ|卓球|水泳|相撲'],
    ['もらってうれしいプレゼント', '花束|手紙|お菓子|入浴剤|ぬいぐるみ|はちみつ'],
    ['好きな飲み物', '麦茶|コーヒー|ミルクティー|炭酸水|オレンジジュース|ほうじ茶'],
    ['スマホでよく見るもの', '動物の動画|料理動画|ニュース|天気予報|マンガ|地図'],
    ['ついやってしまうクセ', '髪をさわる|貧乏ゆすり|独り言|ペンを回す|鼻歌|夜ふかし'],
    ['好きな果物', 'いちご|もも|ぶどう|みかん|りんご|メロン'],
    ['学生時代の部活', '吹奏楽部|サッカー部|帰宅部|美術部|テニス部|茶道部'],
    ['好きな駄菓子', 'ラムネ|きなこ棒|酢こんぶ|ソースせんべい|ガム|グミ'],
    ['宝くじが当たったら買うもの', '家|車|島|世界一周旅行|一生分のお米|はちみつ工場'],
    ['好きな麺類', 'うどん|そば|パスタ|焼きそば|そうめん|ラーメン'],
    ['好きな天気', '晴れ|くもり|雨|雪|そよ風の日|雨上がり'],
    ['好きなお菓子', 'ポテトチップス|チョコレート|おせんべい|クッキー|グミ|わらび餅'],
    ['最近うれしかったこと', '新しい靴を買った|ネコになつかれた|早起きできた|友だちに会えた|おいしいパン屋を見つけた|はちみつをもらった'],
    ['好きな鍋料理', 'キムチ鍋|寄せ鍋|すき焼き|しゃぶしゃぶ|もつ鍋|豆乳鍋'],
    ['ストレス発散法', 'カラオケ|寝る|甘いもの|走る|お風呂|大声で歌う'],
    ['好きな言葉', '継続は力なり|果報は寝て待て|笑う門には福来る|一期一会|石の上にも三年|なんとかなる'],
    ['生まれ変わったらなりたいもの', '鳥|ネコ|雲|クマ|イルカ|大富豪'],
    ['好きなサンドイッチの具', 'たまご|ツナ|ハムチーズ|カツ|フルーツ|レタスとトマト'],
    ['好きな丼もの', '親子丼|牛丼|天丼|かつ丼|海鮮丼|ねぎとろ丼'],
    ['好きな乗り物', '電車|飛行機|自転車|船|観覧車|ロープウェイ']
  ].map(function (x) { return { q: x[0], a: x[1].split('|') }; });
  var GENERIC = ['ひみつ', 'カレー', 'ネコ', '青', 'ラーメン', '散歩', 'チョコ', 'おにぎり', '昼寝', 'いちご'];
  var MAX_ANS = 20;

  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function shuffle(a, r) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // 比較用：全角半角・大文字小文字・空白・句読点・「です」をそろえる
  function norm(s) {
    s = String(s || ''); try { s = s.normalize('NFKC'); } catch (e) {}
    return s.toLowerCase().replace(/(です|でした)[。！!]*$/, '').replace(/[\s。、，．,.!！?？「」『』~〜ー・]/g, '').replace(/[\u30a1-\u30f6]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  }
  function cleanAnswer(s) {
    s = String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();
    s = s.replace(/(です|でした)[。！!]*$/, '').replace(/^[「『]|[」』]$/g, '').trim();
    return Array.from(s).slice(0, MAX_ANS).join('');
  }
  function sentence(name, k, ans) { return name + 'です。' + PROMPTS[k].q + 'は' + ans + 'です。'; }
  function question(name, k) { return san(name) + 'の' + PROMPTS[k].q + 'は何だったでしょう？'; }
  function san(name) { return /さん/.test(name) ? name : name + 'さん'; }

  // ゲーム作成：お題カードを per 枚引く（重複なし）。1枚ごとに全員が席順にそのお題で自己紹介する
  function createGame(n, per, seed) {
    var r = rng(seed), ks = shuffle(PROMPTS.map(function (_, i) { return i; }), r), intros = [];
    per = Math.max(1, Math.min(per, PROMPTS.length));
    for (var round = 0; round < per; round++) for (var p = 0; p < n; p++) intros.push({ p: p, k: ks[round], text: null, cpu: false });
    return { n: n, per: per, seed: seed, intros: intros, cur: 0, quiz: null, qi: -1, scores: new Array(n).fill(0), rights: new Array(n).fill(0) };
  }
  function cpuAnswer(k, r, avoid) {
    var a = PROMPTS[k].a.filter(function (x) { return !avoid || avoid.indexOf(norm(x)) < 0; });
    if (!a.length) a = PROMPTS[k].a;
    return a[Math.floor(r() * a.length)];
  }
  // クイズ：記録された（人, お題）の答えからランダムに出題。選択肢＝正解＋まぎらわしい答え3つ
  // （①同じお題へのほかの人の本当の答え → ②そのお題のありがちな答え → ③ほかのお題の答え → ④予備リスト の順で、重複なしで補充）
  function buildQuiz(G, cap, seed) {
    var r = rng(seed ^ 0x5bd1e995), list = G.intros.filter(function (x) { return x.text; });
    shuffle(list, r);
    for (var i = 1; i < list.length; i++) if (list[i].p === list[i - 1].p) for (var j = i + 1; j < list.length; j++) if (list[j].p !== list[i - 1].p) { var t = list[i]; list[i] = list[j]; list[j] = t; break; }
    if (cap > 0) list = list.slice(0, cap);
    return list.map(function (it) {
      var used = [norm(it.text)], opts = [it.text];
      function add(x) { var nx = norm(x); if (!nx || used.indexOf(nx) >= 0 || opts.length >= 4) return false; used.push(nx); opts.push(x); return true; }
      function texts(f) { return shuffle(G.intros.filter(function (x) { return x.text && x !== it && f(x); }).map(function (x) { return x.text; }), r); }
      [texts(function (x) { return x.k === it.k; }), shuffle(PROMPTS[it.k].a.slice(), r), texts(function (x) { return x.k !== it.k; }), shuffle(GENERIC.slice(), r)]
        .forEach(function (pool) { for (var i = 0; i < pool.length && opts.length < 4; i++) add(pool[i]); });
      var order = shuffle([0, 1, 2, 3].slice(0, opts.length), r);
      return { p: it.p, k: it.k, choices: order.map(function (x) { return opts[x]; }), correct: order.indexOf(0) };
    });
  }
  // 早い順に正解 3点・2点・それ以外の正解 1点。不正解 0点（その問題は回答終了）
  var POINTS = [3, 2];
  function scoreAnswers(q, answers) {
    var ok = Object.keys(answers).map(Number).filter(function (p) { return answers[p].c === q.correct; }).sort(function (a, b) { return answers[a].at - answers[b].at; }), pts = {};
    Object.keys(answers).forEach(function (p) { pts[p] = 0; });
    ok.forEach(function (p, i) { pts[p] = POINTS[i] != null ? POINTS[i] : 1; });
    return pts;
  }
  function ranking(scores, rights) { return scores.map(function (_, i) { return i; }).sort(function (a, b) { return scores[b] - scores[a] || rights[b] - rights[a] || a - b; }); }

  var api = { PROMPTS: PROMPTS, GENERIC: GENERIC, MAX_ANS: MAX_ANS, POINTS: POINTS, rng: rng, shuffle: shuffle, norm: norm, cleanAnswer: cleanAnswer, sentence: sentence, question: question, san: san, createGame: createGame, cpuAnswer: cpuAnswer, buildQuiz: buildQuiz, scoreAnswers: scoreAnswers, ranking: ranking };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Oboe = api;
})(this);
