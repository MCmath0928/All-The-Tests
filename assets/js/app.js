/* ==========================================================================
   All The Tests — 应用层：路由 / 检索 / 分类 / 答题器 / 结果页 / 记录
   ========================================================================== */
(function () {
  'use strict';

  var A = window.ATT;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = A.esc, safe = A.safe;

  /* ====================== 索引 ====================== */
  var TESTS = [], INDEX = {}, DUP = [];
  A.tests.forEach(function (t) {
    if (INDEX[t.id]) { DUP.push(t.id); return; }
    INDEX[t.id] = t; TESTS.push(t);
  });
  var CATS = {}, CATORDER = A.cats.map(function (c) { return c.id; });
  A.cats.forEach(function (c) { CATS[c.id] = c; });

  /* 英文源站条目的中文替代登记表（见 registry.js 的 A.enOnlyNotes） */
  Object.keys(A.enOnlyNotes || {}).forEach(function (id) {
    var t = INDEX[id]; if (!t) return;
    var n = A.enOnlyNotes[id];
    t.enOnly = true;
    t.enOnlyTitle = n.title;
    t.enOnlyNote = n.note;
    t.zhAlt = n.alt || [];
  });

  TESTS.forEach(function (t) {
    if (!CATS[t.cat]) { t.cat = 'fun'; }
    t._n = A.itemCount(t);
    t._acc = A.access(t);
  });
  function byCat(id) { return TESTS.filter(function (t) { return t.cat === id; }); }
  function byAccess(m) { return TESTS.filter(function (t) { return t._acc.mode === m; }).length; }

  /* ====================== 本地记录 ====================== */
  var LS_KEY = 'att.history.v1', LS_THEME = 'att.theme.v1';
  function history() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { return []; } }
  function pushHistory(rec) {
    var h = history(); h.unshift(rec); if (h.length > 80) h = h.slice(0, 80);
    try { localStorage.setItem(LS_KEY, JSON.stringify(h)); } catch (e) {}
  }
  function clearHistory() { try { localStorage.removeItem(LS_KEY); } catch (e) {} }

  /* ====================== 主题 ====================== */
  function initTheme() {
    var saved = null; try { saved = localStorage.getItem(LS_THEME); } catch (e) {}
    var dark = saved ? saved === 'dark' : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', cur);
    try { localStorage.setItem(LS_THEME, cur); } catch (e) {}
  }

  /* ====================== 通用片段 ====================== */
  function catOf(t) { return CATS[t.cat] || { cn:'其他', emoji:'📄', en:'' }; }

  function accPills(t) {
    var a = t._acc, m = A.MODE_TEXT[a.mode] || A.MODE_TEXT.builtin, h = [];
    h.push('<span class="pill ' + m.pill + '">' + esc(m.label) + '</span>');
    h.push('<span class="pill ' + (a.cn ? 'ok' : 'bad') + '">' + (a.cn ? '中国可访问' : '大陆访问不稳定') + '</span>');
    h.push('<span class="pill ' + (a.free ? 'ok' : 'warn') + '">' + (a.free ? '免费' : '非全免费') + '</span>');
    return h.join('');
  }

  function miniDots(t) {
    var a = t._acc;
    return '<span class="dots" title="绿=中国可访问 · 蓝=免费 · 灰=不可用">' +
      '<i class="dot ' + (a.cn ? 'ok' : 'bad') + '"></i>' +
      '<i class="dot ' + (a.free ? 'ok' : 'bad') + '"></i>' +
      '<i class="dot ' + (a.hasBuiltin ? 'ok' : '') + '"></i></span>';
  }

  function testCard(t) {
    var c = catOf(t);
    var bits = [];
    bits.push(c.emoji + ' ' + esc(c.cn));
    if (t._n) bits.push(t._n + ' 题');
    if (t.minutes) bits.push('约 ' + t.minutes + ' 分钟');
    var langPill = t.zhFrom === 'en'
      ? '<span class="pill info" title="站内中文题本译自英文原版，中译可能小部分破坏原意">中译</span>'
      : (t.enOnly ? '<span class="pill warn" title="源站只有英文界面，站内暂无同量表中文自建版">英文源站</span>' : '');
    return '<a class="t-card" href="#/test/' + esc(t.id) + '">' +
      '<span class="marker"></span>' +
      '<h3>' + esc(t.cn) + '</h3>' +
      '<div class="en-name">' + esc(t.en || '') + '</div>' +
      '<p class="desc">' + safe(t.desc || '') + '</p>' +
      '<div class="t-foot">' + langPill + accPills(t) +
      '<span class="pill">' + bits.join(' · ') + '</span></div>' +
      '</a>';
  }

  function sectionHead(h2, hint) {
    return '<div class="section-head"><h2>' + h2 + '</h2>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>';
  }

  /* ====================== 首页 ====================== */
  function viewHome() {
    var total = TESTS.length;
    var builtin = byAccess('builtin') + byAccess('both');
    var link = byAccess('link');
    var ref = byAccess('ref');
    var items = TESTS.reduce(function (s, t) { return s + t._n; }, 0);

    var featured = ['phq-9','gad-7','ipip-bigfive-50','jung-16-type','ecr-r','sd3','asrs-v11','riasec-onet',
                    'rosenberg','swls','isi','fun-social-battery','enneagram-free','dass-21'];
    var feat = featured.map(function (id) { return INDEX[id]; }).filter(Boolean);

    var h = '';
    h += '<section class="hero">' +
      '<h1>把全网的心理测试，<span class="grad">收进一个地方</span></h1>' +
      '<p class="lead">正式量表与娱乐测试一并收录，去重、分类、标注出处。<b>源站在中国大陆可访问且免费的，直接给你网址；不可访问或不免费的，我们按公开量表题本自建可交互测试页。</b>纯静态、无账号、无追踪，所有作答都留在你的浏览器里。</p>' +
      '<div class="hero-actions">' +
        '<a class="btn primary" href="#/cats">按分类浏览 →</a>' +
        '<button class="btn" id="btn-random" type="button">🎲 随便来一个</button>' +
        '<a class="btn" href="#/dedup">去重说明</a>' +
      '</div>' +
      '<div class="stats">' +
        stat(total, '收录测试条目') +
        stat(builtin, '站内可做（自建）') +
        stat(link, '可跳转的免费源站') +
        stat(ref, '版权受限·仅说明') +
        stat(items, '自建量表题目总数') +
        stat(Object.keys(A.sources).length, '登记来源站点') +
      '</div>' +
    '</section>';

    h += sectionHead('🏷️ 按类别浏览', '共 ' + A.cats.length + ' 个类别');
    h += '<div class="cat-grid">';
    A.cats.forEach(function (c) {
      var list = byCat(c.id);
      var b = list.filter(function (t) { return t._acc.hasBuiltin; }).length;
      h += '<a class="cat-card" href="#/cat/' + c.id + '">' +
        '<div class="cc-top"><span class="emoji">' + c.emoji + '</span>' +
        '<div><h3>' + esc(c.cn) + '</h3><span class="en">' + esc(c.en) + '</span></div></div>' +
        '<p>' + esc(c.desc) + '</p>' +
        '<div class="bar"><i style="width:' + Math.min(100, list.length * 6) + '%"></i></div>' +
        '<div class="cc-foot"><span class="pill">' + list.length + ' 个测试</span>' +
        '<span class="pill accent">' + b + ' 个站内可做</span></div>' +
        '</a>';
    });
    h += '</div>';

    h += sectionHead('⭐ 先从这些开始', '最常用、最有信息量的入口');
    h += '<div class="test-grid">' + feat.map(testCard).join('') + '</div>';

    h += sectionHead('📌 收录规则', '三条判定标准');
    h += '<div class="test-grid">' +
      card('① 可访问 + 免费 → 贴网址', 'ok', '源站在中国大陆常规网络环境下可直接打开，且完成测试不需要付费。这类条目我们只做外链，不再重复造轮子。') +
      card('② 不可访问 / 不免费 → 自建', 'warn', '源站打不开，或完整结果要付费、要注册、要资质。这类条目我们按公开量表题本自建站内测试页，题目、计分与结果解读全部可查。') +
      card('③ 版权 / 资质受限 → 说明性收录', '', '如 MBTI 官方版、韦氏智力测验、MMPI 等，题目受版权保护或必须由持证人员施测。我们不伪造，只标注出处、获取途径与免费替代方案。') +
    '</div>';

    return h;
  }
  function stat(n, label) { return '<div class="stat"><b>' + n + '</b><span>' + esc(label) + '</span></div>'; }
  function card(title, kind, txt) {
    return '<div class="card" style="padding:16px">' +
      '<h3 style="font-size:15px"><span class="pill ' + kind + '" style="margin-right:6px">●</span>' + esc(title) + '</h3>' +
      '<p class="small" style="color:var(--text-2);margin:0">' + esc(txt) + '</p></div>';
  }

  /* ====================== 分类页 ====================== */
  function viewCats() {
    var h = '<div class="page-head"><h1>全部分类</h1><p>' + A.cats.length + ' 个类别覆盖 ' + TESTS.length + ' 个测试。每个类别里的条目都标注了「中国可访问性 / 是否免费 / 是否提供站内自建版」，用卡片左下角的三个圆点可以一眼看出：<span class="dots"><i class="dot ok"></i></span> 可访问 · <span class="dots"><i class="dot ok"></i></span> 免费 · <span class="dots"><i class="dot ok"></i></span> 站内可做。</p></div>';
    h += '<div class="cat-grid">';
    A.cats.forEach(function (c) {
      var list = byCat(c.id);
      var b = list.filter(function (t) { return t._acc.hasBuiltin; }).length;
      h += '<a class="cat-card" href="#/cat/' + c.id + '">' +
        '<div class="cc-top"><span class="emoji">' + c.emoji + '</span>' +
        '<div><h3>' + esc(c.cn) + '</h3><span class="en">' + esc(c.en) + '</span></div></div>' +
        '<p>' + esc(c.desc) + '</p>' +
        '<div class="bar"><i style="width:' + Math.min(100, list.length * 6) + '%"></i></div>' +
        '<div class="cc-foot"><span class="pill">' + list.length + ' 个</span><span class="pill accent">' + b + ' 个站内可做</span></div>' +
        '</a>';
    });
    h += '</div>';
    return h;
  }

  function viewCat(id) {
    var c = CATS[id];
    if (!c) return notFound('没有这个分类');
    var list = byCat(id);
    var h = '<div class="page-head"><div class="crumbs"><a href="#/">首页</a> / <a href="#/cats">分类</a> / ' + esc(c.cn) + '</div>' +
      '<h1>' + c.emoji + ' ' + esc(c.cn) + '</h1><p>' + esc(c.desc) + '</p></div>';
    h += '<div class="filters" data-cat="' + esc(id) + '">' +
      '<label>筛选</label>' +
      '<button class="chip on" data-f="all">全部 ' + list.length + '</button>' +
      '<button class="chip" data-f="builtin">站内可做 ' + list.filter(function (t) { return t._acc.hasBuiltin; }).length + '</button>' +
      '<button class="chip" data-f="link">免费外链 ' + list.filter(function (t) { return t._acc.mode === 'link'; }).length + '</button>' +
      '<button class="chip" data-f="ref">版权受限 ' + list.filter(function (t) { return t._acc.mode === 'ref'; }).length + '</button>' +
      '<span style="flex:1"></span>' +
      '<label for="sort-' + esc(id) + '">排序</label>' +
      '<select class="chip" id="sort-' + esc(id) + '">' +
        '<option value="default">默认（推荐顺序）</option>' +
        '<option value="time">用时从短到长</option>' +
        '<option value="items">题量从小到大</option>' +
        '<option value="name">按名称</option>' +
      '</select>' +
      '<span class="hint muted small" id="cat-count"></span>' +
      '</div>';
    h += '<div class="test-grid" id="cat-grid">' + list.map(testCard).join('') + '</div>';
    setTimeout(function () { bindCatFilters(id); }, 0);
    return h;
  }

  function bindCatFilters(id) {
    var bar = $('.filters[data-cat="' + id + '"]'); if (!bar) return;
    var list = byCat(id), filter = 'all', sort = 'default';
    function apply() {
      var out = list.slice();
      if (filter === 'builtin') out = out.filter(function (t) { return t._acc.hasBuiltin; });
      else if (filter === 'link') out = out.filter(function (t) { return t._acc.mode === 'link'; });
      else if (filter === 'ref') out = out.filter(function (t) { return t._acc.mode === 'ref'; });
      if (sort === 'time') out.sort(function (a, b) { return (a.minutes || 99) - (b.minutes || 99); });
      else if (sort === 'items') out.sort(function (a, b) { return (a._n || 0) - (b._n || 0); });
      else if (sort === 'name') out.sort(function (a, b) { return a.cn.localeCompare(b.cn, 'zh'); });
      $('#cat-grid').innerHTML = out.length ? out.map(testCard).join('')
        : '<div class="empty"><div class="big">🔍</div>这个筛选下没有条目</div>';
      var cnt = $('#cat-count'); if (cnt) cnt.textContent = '显示 ' + out.length + ' / ' + list.length + ' 条';
    }
    $$('.chip[data-f]', bar).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.chip[data-f]', bar).forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on'); filter = b.getAttribute('data-f'); apply();
      });
    });
    var sel = $('#sort-' + id); if (sel) sel.addEventListener('change', function () { sort = sel.value; apply(); });
    apply();
  }

  /* ====================== 测试页 ====================== */
  var RUN = null;
  var LETTERS = 'ABCDEFGHIJ';

  function viewTest(id) {
    var t = INDEX[id];
    if (!t) return notFound('没有找到这个测试：' + esc(id));

    var c = catOf(t), acc = t._acc, m = A.MODE_TEXT[acc.mode] || A.MODE_TEXT.builtin;

    var h = '<div class="crumbs"><a href="#/">首页</a> / <a href="#/cat/' + t.cat + '">' + esc(c.cn) + '</a> / ' + esc(t.cn) + '</div>';
    h += '<section class="test-head">' +
      '<h1>' + esc(t.cn) + '</h1>' +
      '<div class="en-title">' + esc(t.en || '') + '</div>' +
      '<div class="meta-row">' + accPills(t) +
        (t._n ? '<span class="pill">' + t._n + ' 道题</span>' : '') +
        (t.minutes ? '<span class="pill">约 ' + t.minutes + ' 分钟</span>' : '') +
        (t.creator ? '<span class="pill">' + esc(t.creator.split(/[,(（]/)[0].trim()) + '</span>' : '') +
      '</div>' +
      '<p class="intro">' + safe(t.intro || t.desc || '') + '</p>' +
      sourceBox(t) +
      noticeBox(t) +
    '</section>';

    /* —— 首次测试前的知情同意门 ——
       简介与「出处与使用条件」已经渲染在上方，用户可以先读再决定；
       未确认前不渲染任何题目与外部作答入口。 */
    if (needsGate(t)) {
      h += consentGate(t);
      h += relatedBlock(t);
      return h;
    }

    if (acc.mode === 'link' || acc.mode === 'ref') {
      h += '<section class="runner">' +
        '<div class="alert ' + (acc.mode === 'link' ? 'ok' : 'info') + '">' +
          '<b>' + esc(m.label) + '：</b>' + esc(m.desc) +
        '</div>' +
        (acc.mode === 'link'
          ? '<p>本条目在源站可免费完成，因此本站不重复自建题本。请前往源站作答：</p>'
          : '<p>本条目因版权或施测资质限制无法自建。请通过下方官方途径获取：</p>') +
        (t.link ? '<p><a class="btn primary" href="' + esc(t.link) + '" target="_blank" rel="noopener noreferrer">前往源站 ↗</a></p>' : '') +
        (t.whyRef ? '<p class="small muted">原因：' + esc(t.whyRef) + '</p>' : '') +
        relatedBlock(t) +
      '</section>';
      return h;
    }

    /* —— 可作答 —— */
    if (!t._n) {
      h += '<section class="runner"><div class="empty"><div class="big">🚧</div>本条目尚未提供站内题本，请使用上方来源链接。</div></section>';
      return h;
    }

    /* access='both'：源站可访问且免费，按收录规则 ① 明确贴出官方网址，
       同时提供站内自建版（便于源站临时打不开、或想离线作答与留档）。 */
    if (acc.mode === 'both' && t.link) {
      h += '<section class="runner" style="margin-bottom:16px">' +
        '<div class="alert ok"><b>收录规则 ① 命中：源站在中国大陆可访问，且完成测试免费。</b><br>' +
        '按规则，这里直接给出官方网址；同时提供站内自建版，供源站访问不畅或想离线作答、保存记录时使用。两版题目同源。</div>' +
        '<p style="margin:0 0 8px">' +
          '<a class="btn primary" href="' + esc(t.link) + '" target="_blank" rel="noopener noreferrer">前往源站作答 ↗</a>' +
          '　<a class="btn" href="#/test/' + esc(t.id) + '" onclick="document.getElementById(\'runner\').scrollIntoView({behavior:\'smooth\'});return false;">使用站内自建版 ↓</a>' +
        '</p>' +
        '<p class="small muted" style="margin:0">源站：<a href="' + esc(t.link) + '" target="_blank" rel="noopener noreferrer">' + esc(t.link) + '</a></p>' +
        '</section>';
    }

    h += '<section class="runner" id="runner">' + runnerShell(t) + '</section>';
    RUN = { t:t, answers:new Array(t._n).fill(null), idx:0, mode:'one', done:false };
    setTimeout(function () { bindRunner(); }, 0);
    return h;
  }

  function sourceBox(t) {
    var srcs = (t.srcs || []).map(function (k) { return A.sources[k]; }).filter(Boolean);
    var h = '<div class="src-box"><h4>出处与使用条件</h4><ul>';
    if (t.creator) h += '<li><b>原始作者：</b>' + safe(t.creator) + '</li>';
    if (t.license) h += '<li><b>使用条件：</b>' + safe(t.license) + '</li>';
    srcs.forEach(function (s) {
      h += '<li><b>' + esc(s.name) + '</b>　' +
        '<span class="pill ' + (s.cn ? 'ok' : 'bad') + '">' + (s.cn ? '中国可访问' : '大陆访问不稳定') + '</span> ' +
        '<span class="pill ' + (s.free ? 'ok' : 'warn') + '">' + (s.free ? '免费' : '需付费/注册') + '</span><br>' +
        '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.url) + '</a><br>' +
        '<span class="muted">' + esc(s.note) + '</span></li>';
    });
    if (!srcs.length && t.link) {
      h += '<li><a href="' + esc(t.link) + '" target="_blank" rel="noopener noreferrer">' + esc(t.link) + '</a></li>';
    }
    h += '</ul>';
    if (t.desc2) h += '<div class="note">' + safe(t.desc2) + '</div>';
    h += '</div>';
    return h;
  }

  /** 中译说明 / 英文源站说明：附在「出处与使用条件」之后 */
  function noticeBox(t) {
    var h = '';
    if (t.zhFrom === 'en') {
      h += '<div class="src-box trans-note">' +
        '<h4>🌐 中译说明（原版为英文）</h4>' +
        '<p>' + safe(A.TRANS_NOTE) + '</p>' +
        '<p class="small muted" style="margin:0">本站中文题本共 <b>' + (t._n || 0) + ' 题</b>；' +
        '题库与切分点来源见上方「出处与使用条件」。如果你读英文不吃力，对照原文再做一次、看两边是否一致，是最稳妥的用法。</p>' +
        '</div>';
    }
    if (t.enOnly) {
      var alts = (t.zhAlt || []).map(function (id) {
        var x = INDEX[id];
        return x ? '<a href="#/test/' + esc(id) + '">' + esc(x.cn) + '</a>' : '';
      }).filter(Boolean);
      h += '<div class="src-box en-notice">' +
        '<h4>🌐 ' + esc(t.enOnlyTitle || '源站只有英文界面，站内没有同量表的中文自建版') + '</h4>' +
        '<p>' + safe(t.enOnlyNote || A.EN_ONLY_NOTE) + '</p>' +
        (alts.length
          ? '<p style="margin:0"><b>可以在站内用中文完成的替代测试：</b>' + alts.join('、') + '</p>'
          : '') +
        '</div>';
    }
    return h;
  }

  function relatedBlock(t) {
    var hits = A.clusters.filter(function (cl) {
      return (cl.keep || []).indexOf(t.id) > -1;
    });
    if (!hits.length) return '';
    var h = '<div class="src-box" style="margin-top:16px"><h4>同族 / 近义量表（已去重）</h4>';
    hits.forEach(function (cl) {
      h += '<div style="margin-bottom:10px"><b>' + esc(cl.title) + '</b><br>' +
        '<span class="small muted">' + safe(cl.why) + '</span><br>' +
        '<span class="small">本族保留：' + (cl.keep || []).map(function (k) {
          var x = INDEX[k];
          return x ? '<a href="#/test/' + k + '">' + esc(x.cn) + '</a>' : '<span class="muted">' + esc(k) + '</span>';
        }).join('、') + '</span>' +
        (cl.note ? '<br><span class="small muted">' + safe(cl.note) + '</span>' : '') + '</div>';
    });
    h += '</div>';
    return h;
  }

  function runnerShell(t) {
    return '<div class="progress-row">' +
        '<div class="progress"><i id="pbar"></i></div>' +
        '<span class="progress-txt" id="ptxt">0 / ' + t._n + '</span>' +
      '</div>' +
      '<div class="mode-toggle">' +
        '<button class="chip on" data-mode="one" type="button">逐题作答</button>' +
        '<button class="chip" data-mode="list" type="button">一页全览</button>' +
        '<span class="hint muted small">键盘：1–9 选项 · ← → 翻页 · Enter 下一题</span>' +
      '</div>' +
      '<div id="qhost"></div>' +
      '<div class="nav-row">' +
        '<button class="btn" id="btn-prev" type="button">← 上一题</button>' +
        '<button class="btn" id="btn-next" type="button">下一题 →</button>' +
        '<span class="spacer"></span>' +
        '<span class="unanswered" id="warn"></span>' +
        '<button class="btn primary" id="btn-done" type="button">查看结果 ✓</button>' +
      '</div>';
  }

  function qBlock(t, i, q, single) {
    var opts = A.qOptions(t, q), chosen = RUN.answers[i];
    var row = opts.length <= 5 ? ' row' : '';
    /* 用 <button role="radio"> 而不是 <label>+隐藏 radio：
       label 的激活行为会把点击再转发给内部 input，导致一次点击冒泡两次 click，
       委托处理器被调用两遍（历史 bug：答完第 x 题直接跳到第 x+2 题）。
       button 一次激活只派发一个 click，且原生支持 Enter/Space。 */
    var h = '<div class="q-block" data-i="' + i + '">' +
      '<div class="q-num">第 ' + (i + 1) + ' 题' + (q.hint ? '　·　' + esc(q.hint) : '') + '</div>' +
      '<div class="q-text">' + safe(q.t) + '</div>' +
      (t.stem ? '<div class="q-hint">' + safe(t.stem) + '</div>' : '') +
      '<div class="opts' + row + '" role="radiogroup" aria-label="第 ' + (i + 1) + ' 题的选项">';
    opts.forEach(function (label, oi) {
      var on = chosen === oi;
      h += '<button type="button" class="opt' + (on ? ' sel' : '') + '" data-o="' + oi + '"' +
        ' role="radio" aria-checked="' + (on ? 'true' : 'false') + '">' +
        '<span class="key" aria-hidden="true">' + (LETTERS[oi] || oi + 1) + '</span>' +
        '<span class="lab">' + esc(label) + '</span>' +
        (q.v ? '<span class="val">' + q.v[oi] + ' 分</span>' : '') +
        '</button>';
    });
    h += '</div></div>';
    return h;
  }

  function renderQ() {
    var t = RUN.t, host = $('#qhost'); if (!host) return;
    var qs = A.questions(t);
    if (RUN.mode === 'one') {
      host.className = '';
      host.innerHTML = qBlock(t, RUN.idx, qs[RUN.idx], true);
      var blk = $('.q-block', host); if (blk) blk.scrollIntoView({ block:'nearest' });
    } else {
      host.className = 'list';
      host.innerHTML = qs.map(function (q, i) { return qBlock(t, i, q, false); }).join('');
    }
    var answered = RUN.answers.filter(function (x) { return x != null; }).length;
    $('#pbar').style.width = Math.round((answered / t._n) * 100) + '%';
    $('#ptxt').textContent = answered + ' / ' + t._n;
    $('#btn-prev').disabled = (RUN.mode === 'list') || RUN.idx === 0;
    $('#btn-next').disabled = (RUN.mode === 'list') || RUN.idx === t._n - 1;
    $('#warn').textContent = answered < t._n ? '还有 ' + (t._n - answered) + ' 题未作答' : '';
  }

  /** 安排"答完自动翻到下一题"。可重入安全：
   *  ① 先取消上一次未执行的翻页；② 触发时再次校验状态没有变过。
   *  这样即使一次点击产生了多个事件（例如 label 转发）、或用户连续快速点击，
   *  也只会前进一格。 */
  function scheduleAdvance() {
    clearTimeout(RUN._timer);
    var from = RUN.idx;
    RUN._timer = setTimeout(function () {
      if (!RUN || RUN.done || RUN.mode !== 'one') return;
      if (RUN.idx !== from) return;                  // 期间已经手动翻页/跳题
      if (RUN.idx >= RUN.t._n - 1) return;           // 已是最后一题
      RUN.idx = from + 1;
      renderQ();
    }, 170);
  }

  function selectOption(i, oi) {
    /* 逐题模式只接受"当前显示的这一题"的选择：
       迟到的重复事件（针对已经翻过去的那一题）直接忽略，避免多跳一格。 */
    if (RUN.mode === 'one' && i !== RUN.idx) return;

    RUN.answers[i] = oi;
    if (RUN.mode === 'one') {
      var host = $('#qhost');
      $$('.opt', host).forEach(function (el) {
        el.classList.remove('sel');
        if (el.setAttribute) el.setAttribute('aria-checked', 'false');
      });
      var el = $('.opt[data-o="' + oi + '"]', host);
      if (el) {
        el.classList.add('sel');
        if (el.setAttribute) el.setAttribute('aria-checked', 'true');
      }
      var answered = RUN.answers.filter(function (x) { return x != null; }).length;
      $('#pbar').style.width = Math.round((answered / RUN.t._n) * 100) + '%';
      $('#ptxt').textContent = answered + ' / ' + RUN.t._n;
      $('#warn').textContent = answered < RUN.t._n ? '还有 ' + (RUN.t._n - answered) + ' 题未作答' : '';
      if (RUN.idx < RUN.t._n - 1) scheduleAdvance();
    } else {
      var wrap = $('.q-block[data-i="' + i + '"]', $('#qhost'));
      if (wrap) {
        $$('.opt', wrap).forEach(function (el) { el.classList.remove('sel'); });
        var e2 = $('.opt[data-o="' + oi + '"]', wrap); if (e2) e2.classList.add('sel');
      }
      var an = RUN.answers.filter(function (x) { return x != null; }).length;
      $('#pbar').style.width = Math.round((an / RUN.t._n) * 100) + '%';
      $('#ptxt').textContent = an + ' / ' + RUN.t._n;
      $('#warn').textContent = an < RUN.t._n ? '还有 ' + (RUN.t._n - an) + ' 题未作答' : '';
    }
  }

  function bindRunner() {
    var host = $('#runner'); if (!host) return;
    host.addEventListener('click', function (ev) {
      var opt = ev.target.closest ? ev.target.closest('.opt') : null;
      if (opt && host.contains(opt)) {
        var blk = opt.closest('.q-block');
        selectOption(parseInt(blk.getAttribute('data-i'), 10), parseInt(opt.getAttribute('data-o'), 10));
        return;
      }
      var mb = ev.target.closest ? ev.target.closest('.mode-toggle .chip') : null;
      if (mb) {
        clearTimeout(RUN._timer);
        $$('.mode-toggle .chip', host).forEach(function (x) { x.classList.remove('on'); });
        mb.classList.add('on');
        RUN.mode = mb.getAttribute('data-mode');
        if (RUN.mode === 'one') RUN.idx = firstUnanswered();
        renderQ();
        return;
      }
      var id = ev.target && ev.target.id;
      if (id === 'btn-prev') { clearTimeout(RUN._timer); RUN.idx = Math.max(0, RUN.idx - 1); renderQ(); }
      else if (id === 'btn-next') { clearTimeout(RUN._timer); RUN.idx = Math.min(RUN.t._n - 1, RUN.idx + 1); renderQ(); }
      else if (id === 'btn-done') { finish(); }
    });
    document.addEventListener('keydown', onKey);
    renderQ();
  }

  function onKey(ev) {
    if (!RUN || RUN.done) return;
    var tag = (ev.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (ev.key >= '1' && ev.key <= '9') {
      var oi = parseInt(ev.key, 10) - 1;
      var opts = A.qOptions(RUN.t, A.questions(RUN.t)[RUN.idx]);
      if (oi < opts.length) { ev.preventDefault(); selectOption(RUN.idx, oi); }
    } else if (ev.key === 'ArrowLeft' && RUN.mode === 'one') { RUN.idx = Math.max(0, RUN.idx - 1); renderQ(); }
    else if (ev.key === 'ArrowRight' && RUN.mode === 'one') { RUN.idx = Math.min(RUN.t._n - 1, RUN.idx + 1); renderQ(); }
    else if (ev.key === 'Enter') { finish(); }
  }

  function firstUnanswered() {
    var i = RUN.answers.indexOf(null);
    return i < 0 ? RUN.idx : i;
  }

  function finish() {
    clearTimeout(RUN._timer);
    var miss = RUN.answers.indexOf(null);
    if (miss >= 0 && RUN.mode === 'list') {
      RUN.idx = miss; RUN.mode = 'one'; renderQ();
      var w = $('#warn'); if (w) w.textContent = '第 ' + (miss + 1) + ' 题还没答哦';
      return;
    }
    if (miss >= 0) {
      RUN.idx = miss; renderQ();
      var w2 = $('#warn'); if (w2) w2.textContent = '第 ' + (miss + 1) + ' 题还没答哦';
      return;
    }
    RUN.done = true;
    document.removeEventListener('keydown', onKey);
    renderResult();
  }

  function renderResult() {
    var t = RUN.t, res = A.score(t, RUN.answers);
    var html = resultHtml(t, res);
    var runner = $('#runner');
    runner.innerHTML = html;

    var first = RUN.answers[0], last = RUN.answers[RUN.answers.length - 1];
    pushHistory({ id:t.id, cn:t.cn, at:Date.now(), headline:res.headline || '已完成', sub:res.sub || '' });

    runner.addEventListener('click', function (ev) {
      var id = ev.target && ev.target.id;
      if (id === 'btn-again') { location.hash = '#/test/' + t.id; location.reload(); }
      else if (id === 'btn-copy') { copyResult(t, res); }
      else if (id === 'btn-print') { window.print(); }
      else if (id === 'btn-home') { location.hash = '#/'; }
    });
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  function resultHtml(t, res) {
    var h = '';
    var isType = t.score && t.score.type === 'type';
    h += '<div class="result-head">' +
      '<div class="rlabel">' + esc(t.cn) + ' · 结果</div>' +
      '<div class="rbig' + (res.headline && res.headline.length > 8 ? ' txt-only' : '') + '">' +
        (t.score && t.score.type === 'most' ? '🏆 ' : '') + esc(res.headline || '已完成') + '</div>' +
      (res.sub ? '<div class="rscore">' + safe(res.sub) + '</div>' : '') +
      (res.scoreText ? '<div class="rscore muted small">' + esc(res.scoreText) + '</div>' : '') +
      gauge(res) +
    '</div>';

    if (res.alert) h += A.alertToHtml(res.alert);

    if (res.body) h += '<div class="para-card"><h3><span class="n">解</span>结果解读</h3><p>' + safe(res.body) + '</p></div>';

    if (t.itemAlert && RUN.answers[t.itemAlert.index] != null && RUN.answers[t.itemAlert.index] >= t.itemAlert.min) {
      h += '<div class="alert ' + (t.itemAlert.kind || 'bad') + '">' + safe(t.itemAlert.text) + '</div>';
    }

    var dims = (res.dims || []).slice();
    if (dims.length) {
      if (t.score && t.score.sortDims === 'desc') dims.sort(function (a, b) { return b.score - a.score; });
      h += '<div class="para-card"><h3><span class="n">维</span>各维度得分</h3><div class="dim-list">';
      dims.forEach(function (d) {
        h += '<div class="dim"><div class="dname">' + esc(d.cn) +
          (d.en ? '<small>' + esc(d.en) + '</small>' : '') + '</div>' +
          '<div class="dbar"><i style="width:' + Math.max(2, Math.min(100, d.pct)) + '%"></i></div>' +
          '<div class="dval">' + esc(d.level || '') + '</div></div>';
        if (d.text) h += '<div class="small muted" style="margin:-6px 0 8px 0">' + safe(d.text) + '</div>';
      });
      h += '</div></div>';
    }

    /* 维度解读展开（dims 型每维的正文本） */
    var deep = (res.dims || []).filter(function (d) { return d.text; });
    if (deep.length && !dims.some(function (d) { return d.text; })) {
      h += '<div class="para-card"><h3><span class="n">详</span>逐维度解读</h3>';
      deep.forEach(function (d) { h += '<p><b>' + esc(d.cn) + '：</b>' + safe(d.text) + '</p>'; });
      h += '</div>';
    }

    if (res.summary || (t.score && t.score.summary)) {
      h += '<div class="alert info">' + safe(res.summary || t.score.summary) + '</div>';
    }

    if (isType && res.parts && res.parts.length) {
      h += '<div class="para-card"><h3><span class="n">码</span>维度构成</h3><div class="dim-list">';
      res.parts.forEach(function (p) {
        h += '<div class="dim"><div class="dname">' + esc(p.axCn) + '</div>' +
          '<div class="dbar"><i style="width:' + Math.max(2, p.pct) + '%"></i></div>' +
          '<div class="dval">' + esc(p.cn) + ' ' + p.pct + '%</div></div>';
      });
      h += '</div></div>';
    }

    /* 分档明细表 */
    if (res.ranges && res.ranges.length) {
      h += '<div class="para-card"><h3><span class="n">档</span>分档参照</h3><div class="table-scroll"><table class="ranges">' +
        '<thead><tr><th>分数区间</th><th>判定</th><th>说明</th></tr></thead><tbody>';
      var prev = 0, num = (t.score && t.score.type === 'mean');
      res.ranges.forEach(function (r, i) {
        var label;
        if (num) label = (prev === 0 ? '≤ ' : (prev + 1) + ' – ') + Number(r[0]).toFixed(2);
        else label = prev === 0 ? '0 – ' + r[0] : (prev + 1) + ' – ' + r[0];
        prev = r[0];
        h += '<tr class="' + (i === res.levelIdx ? 'hit' : '') + '"><td class="mono">' + esc(label) + '</td>' +
          '<td>' + esc(r[1]) + '</td><td class="muted small">' + safe(stripShort(r[2])) + '</td></tr>';
      });
      h += '</tbody></table></div></div>';
    }

    /* 你的作答回顾 */
    h += answerReview(t);

    h += '<div class="alert info"><b>免责声明：</b>本结果是基于自评量表的<b>筛查性参考</b>，不构成诊断、治疗建议或任何专业意见。量表结果受当下情绪、作答环境与理解差异影响。如果你持续感到痛苦或功能受损，请寻求精神科/心理科医生的帮助。中国大陆心理援助热线：<b>12356</b>。</div>';

    if (t.zhFrom === 'en') {
      h += '<div class="alert info"><b>中译说明：</b>' + safe(A.TRANS_NOTE_SHORT) + '</div>';
    }

    h += authorSign();

    h += '<div class="nav-row">' +
      '<button class="btn" id="btn-again" type="button">↻ 重新测一次</button>' +
      '<button class="btn" id="btn-copy" type="button">📋 复制结果</button>' +
      '<button class="btn" id="btn-print" type="button">🖨 打印 / 存 PDF</button>' +
      '<span class="spacer"></span>' +
      '<a class="btn" href="#/cat/' + t.cat + '">返回分类</a>' +
      '<a class="btn ghost" href="#/">回到首页</a>' +
      '</div>';

    h += relatedBlock(t);
    return h;
  }

  function stripShort(s) {
    if (!s) return '';
    var x = String(s);
    return x.length > 60 ? x.slice(0, 60) + '…' : x;
  }

  function gauge(res) {
    if (!res.ranges || !res.ranges.length || res.raw == null || res.max == null) return '';
    var max = typeof res.max === 'number' ? res.max : res.ranges[res.ranges.length - 1][0];
    var colors = ['#3ddba5','#7fd67a','#f0b24a','#f08a4a','#e2445c','#b03a55'];
    var h = '<div class="gauge"><div class="scale">';
    var prev = 0;
    res.ranges.forEach(function (r, i) {
      var lo = prev, hi = Math.min(r[0], max);
      var w = Math.max(1, ((hi - lo) / max) * 100);
      h += '<span style="background:' + colors[Math.min(i, colors.length - 1)] + ';flex:0 0 ' + w + '%"></span>';
      prev = r[0];
    });
    h += '<i class="marker" style="left:calc(' + Math.max(0, Math.min(100, (res.raw / max) * 100)) + '% - 1.5px)"></i>';
    h += '</div><div class="ticks"><span>0</span>';
    res.ranges.forEach(function (r, i) { if (i < res.ranges.length - 1) h += '<span>' + r[0] + '</span>'; });
    h += '<span>' + max + '</span></div></div>';
    return h;
  }

  function answerReview(t) {
    var qs = A.questions(t);
    var h = '<details class="para-card"><summary style="cursor:pointer;font-weight:600">📝 查看你的作答回顾（' + t._n + ' 题）</summary><div style="margin-top:12px">';
    qs.forEach(function (q, i) {
      var opts = A.qOptions(t, q), a = RUN.answers[i];
      h += '<div class="small" style="padding:6px 0;border-bottom:1px dashed var(--line)">' +
        '<span class="muted mono">' + (i + 1) + '.</span> ' + safe(q.t) + '<br>' +
        '<b style="color:var(--accent)">' + (a == null ? '未作答' : esc(opts[a])) + '</b></div>';
    });
    h += '</div></details>';
    return h;
  }

  function copyResult(t, res) {
    var lines = ['【' + t.cn + '】结果', '', (res.headline || '') + (res.sub ? '　' + res.sub : '')];
    if (res.scoreText) lines.push(res.scoreText);
    if (res.body) lines.push('', String(res.body).replace(/<[^>]+>/g, ''));
    (res.dims || []).forEach(function (d) { lines.push('· ' + d.cn + '：' + d.level); });
    lines.push('', '—— 来自 All The Tests（心理测试收录库）。本结果仅供自我参考，不构成诊断。');
    var txt = lines.join('\n');
    var done = function () { var b = $('#btn-copy'); if (b) { b.textContent = '✓ 已复制'; setTimeout(function () { b.textContent = '📋 复制结果'; }, 1600); } };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt, done); });
    } else fallbackCopy(txt, done);
  }
  function fallbackCopy(txt, done) {
    var ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { alert('复制失败，请手动选择文本。'); }
    document.body.removeChild(ta);
  }

  /* ====================== 去重说明 ====================== */
  function viewDedup() {
    var h = '<div class="page-head"><h1>去重说明</h1>' +
      '<p>中文互联网上的心理测试存在大量<b>同构念重复</b>：同一个量表被改标题、换皮、拆成"儿童版/成人版"重复上线；同一个"MBTI"标签下其实是五套不同的题本；同一个"情商测试"可能一会儿是自评、一会儿是能力测验。' +
      '下面是我们做去重时依据的<b>' + A.clusters.length + ' 组判定规则</b>——每一组都说明了合并依据、保留了什么、以及为什么。</p></div>';

    h += '<div class="filters"><label>在去重组内搜索</label>' +
      '<input id="dedup-q" type="search" placeholder="例如：大五 / 依恋 / MBTI / 拖延" ' +
      'style="flex:1;min-width:200px;padding:7px 12px;border:1px solid var(--line-strong);border-radius:999px;background:var(--surface-2);color:var(--text)">' +
      '<span class="hint muted small" id="dedup-count"></span></div>';

    h += '<div id="dedup-list">';
    A.clusters.forEach(function (cl) {
      h += clusterHtml(cl);
    });
    h += '</div>';

    h += sectionHead('📐 我们还做了这些技术性去重', '同一构念下只保留最优版本');
    h += '<div class="cluster"><h3>同 ID 冲突</h3><p class="why">数据层如果有两条测试使用了相同的 id，索引只保留第一条，第二条会被忽略并记录在控制台。</p>' +
      '<div class="' + (DUP.length ? 'drop' : 'keep') + '">当前冲突条目：' + (DUP.length ? DUP.join('、') : '无 ✓') + '</div></div>';
    h += '<div class="cluster"><h3>同构念取长版</h3><p class="why">同一量表存在多种长度版本时（如 PSS-14/10/4、UCLA-20/8/3），只保留心理测量学表现最好的版本，其余并入 merged 列表，不重复计数。</p></div>';
    h += '<div class="cluster"><h3>同名不同构念的拆分</h3><p class="why">"睡眠量表"其实包含三种不同构念：睡眠质量（PSQI）、失眠严重度（ISI）、日间嗜睡（ESS）。把它们合并成"一个睡眠测试"会造成结果互相矛盾，因此拆开保留。</p></div>';
    h += '<div class="cluster"><h3>娱乐测试的换皮识别</h3><p class="why">娱乐类测试的题目常被整体复制换标题（把"你是哪种动物"改成"你的恋爱人格"）。本站对娱乐类测试一律自建原创题本，且同一构念只保留一个版本。</p></div>';
    return h;
  }

  function clusterHtml(cl) {
    var keep = (cl.keep || []).map(function (k) {
      var t = INDEX[k];
      return t ? '<a href="#/test/' + k + '">' + esc(t.cn) + '</a>' : '<span class="muted">' + esc(k) + '（未收录）</span>';
    }).join('、');
    var merged = (cl.merged || []).map(function (m) { return esc(m); }).join('、');
    return '<div class="cluster" data-search="' + esc([cl.title, cl.why, (cl.keep || []).join(' '), (cl.merged || []).join(' ')].join(' ')) + '">' +
      '<h3>🧩 ' + esc(cl.title) + '</h3>' +
      '<div class="why">' + safe(cl.why) + '</div>' +
      '<div class="keep">✔ 保留：' + keep + '</div>' +
      (merged ? '<div class="drop">✘ 已并入并按重复处理：' + merged + '</div>' : '') +
      (cl.note ? '<div class="why" style="margin:8px 0 0"><b>判读：</b>' + safe(cl.note) + '</div>' : '') +
      '</div>';
  }

  /* ====================== 我的记录 ====================== */
  function viewMine() {
    var h = history();
    var out = '<div class="page-head"><h1>我的记录</h1>' +
      '<p>所有记录只保存在<b>你这台设备的浏览器本地</b>（localStorage），没有上传、没有账号、没有追踪。清除浏览器数据会一并清空。</p></div>';
    if (!h.length) {
      out += '<div class="empty"><div class="big">🗂️</div>还没有记录。去<a href="#/">首页</a>挑一个测试开始吧。<br>' +
        '<span class="small">（娱乐类测试的记录同样会出现在这里）</span></div>';
      return out + mineControls();
    }
    out += '<div class="filters"><label>共 ' + h.length + ' 条</label><span style="flex:1"></span>' +
      '<button class="btn sm" id="btn-clear-h" type="button">清空记录</button></div>';
    out += '<div class="test-grid">';
    h.forEach(function (r) {
      var t = INDEX[r.id];
      out += '<a class="t-card" href="#/test/' + esc(r.id) + '">' +
        '<span class="marker"></span>' +
        '<h3>' + esc(r.cn || r.id) + '</h3>' +
        '<div class="en-name">' + new Date(r.at).toLocaleString('zh-CN') + '</div>' +
        '<p class="desc"><b>' + esc(r.headline || '') + '</b>' + (r.sub ? '<br>' + esc(r.sub) : '') + '</p>' +
        '<div class="t-foot">' + (t ? '<span class="pill">' + esc(catOf(t).cn) + '</span>' : '') +
        '<span class="pill accent">再测一次</span></div></a>';
    });
    out += '</div>';
    out += mineControls();
    setTimeout(function () {
      var b = $('#btn-clear-h');
      if (b) b.addEventListener('click', function () {
        if (confirm('确定要清空全部本地记录吗？此操作不可撤销。')) { clearHistory(); route(); }
      });
      var rb = $('#btn-reset-consent');
      if (rb) rb.addEventListener('click', function () {
        try { localStorage.removeItem(LS_CONSENT); } catch (e) {}
        rb.textContent = '✓ 已重置，下次进入测试会再次要求确认';
        rb.disabled = true;
      });
    }, 0);
    return out;
  }

  /** 本机状态控制区：让用户知道存了什么、也能自己清掉 */
  function mineControls() {
    return '<div class="src-box" style="margin-top:20px">' +
      '<h4>本机保存了什么</h4><ul>' +
      '<li><b>测试记录</b>（<code>att.history.v1</code>）：' + history().length + ' 条，仅「测试名 + 结果摘要 + 时间」。</li>' +
      '<li><b>首测确认状态</b>（<code>' + LS_CONSENT + '</code>）：' +
        (hasConsent() ? '已确认（因此进入测试时不会再弹出说明）' : '尚未确认（进入测试前会先要求确认）') + '。</li>' +
      '</ul>' +
      '<p style="margin:12px 0 0"><button class="btn sm" id="btn-reset-consent" type="button">重置首测确认</button>　' +
      '<span class="small muted">重置后，下一次进入任何一个测试都会重新要求你确认那段说明。</span></p>' +
      '</div>';
  }

  /* ====================== 关于 / 测量学说明 ====================== */
  function viewAbout() {
    return '<div class="page-head"><h1>关于本站 · 作者、测量学说明与版权声明</h1>' +
      '<p>All The Tests 是一个<b>纯静态</b>的心理测试收录与索引项目：没有后端、没有数据库、没有账号、没有埋点。你在任何页面上的作答都只停留在浏览器内存里；只有"我的记录"会把分数摘要写进本机 localStorage。</p></div>' +
      '<div class="author-card">' +
        '<img src="' + AUTHOR_LOGO + '" alt="' + AUTHOR + ' 的标识" width="88" height="88">' +
        '<div>' +
          '<h3>' + AUTHOR + '</h3>' +
          '<div class="role">创作者 &amp; 维护者</div>' +
          '<p><b>本测试是由' + AUTHOR + '创作的个人项目，仅作娱乐，并不能代替任何现实心理诊断和治疗，也不保证测试结果严谨准确。</b></p>' +
          '<p>项目的出发点是：中文互联网上的心理测试散落各处、重复严重、来路不明——同一个"MBTI"底下有五套不同题本，同一份量表被反复换皮。' +
          '于是这里尝试把能找到的正式量表与娱乐测试收进一处，标明出处与使用条件，并明确区分"能直接外链的"与"必须自建的"。</p>' +
          '<p class="small muted">本站为个人非商业作品。若你认为某处引用不当，或希望增删某个条目，欢迎提出。</p>' +
        '</div>' +
      '</div>' +
      '<div class="prose">' +
      '<h2>一、收录与自建的判定标准</h2>' +
      '<ol>' +
        '<li><b>源站在中国大陆常规网络环境下可访问，且完成测试本身免费 → 只贴网址。</b>这类条目不再重复自建题本，避免制造第二套可能与原版不一致的题目。</li>' +
        '<li><b>源站不可访问、或测试需要付费/注册/资质 → 按公开量表题本自建站内测试页。</b>题目、选项、计分规则与分档依据都写在页面上，可自行核对。</li>' +
        '<li><b>题目受版权保护、或必须由持证人员施测 → 只做说明性收录。</b>我们不伪造官方量表，只标注出处、获取途径与免费替代方案（例如：不做韦氏智力测验，改外链门萨官方免费测验）。</li>' +
      '</ol>' +
      '<p class="small muted">"中国大陆可访问"的判断基于常规网络环境下的实际访问经验，会随时间与地区变化；"免费"指完成测试本身不需要付费，部分站点的高级报告仍需付费，我们在条目里标注了这一点。</p>' +

      '<h2>二、自建量表的使用条件</h2>' +
      '<p>我们优先选择<b>公共领域</b>或<b>明确允许免费用于研究 / 临床 / 教育</b>的量表，并在每个测试页的「出处与使用条件」栏里标明原始作者与许可。具体包括：</p>' +
      '<ul>' +
        '<li><b>公共领域</b>：IPIP 国际人格题库、PHQ-9 / GAD-7 / PHQ-15（Pfizer 免费授权）、AUDIT（WHO）、PCL-5（美国 VA）、ACE 问卷等。</li>' +
        '<li><b>学术免费使用</b>：DASS-21、PSS-10、ECR-R、SD3、IRI、MFQ、SWLS、PANAS、GQ-6、MLQ、ISI、PSQI、SCS-SF、BRS、TAS-20 等——这些量表在学术研究中普遍免费，但若用于商业用途通常需要另行授权。</li>' +
        '<li><b>原创题本</b>：所有娱乐类测试、以及少数没有统一公开题库的构念（如 DISC 式行为风格、职业锚、团队角色），由本站自编并在页面标明"原创题本"，不冒充任何官方量表。</li>' +
      '</ul>' +
      '<p><b>如果你是量表作者或版权方，认为本项目的某处使用不当，请告知，我们会立即调整或移除。</b></p>' +

      '<h2>三、这些结果到底意味着什么</h2>' +
      '<ul>' +
        '<li><b>自评量表测的是"你如何看待自己"，不是"事实是什么"。</b>两者相关，但不是一回事。</li>' +
        '<li><b>筛查 ≠ 诊断。</b>PHQ-9、GAD-7、AQ-10、ASRS 这类工具的设计目的是"把可能需要帮助的人筛出来"，因此它们的假阳性率是<b>刻意</b>留高的。达到阈值意味着"值得做一次专业评估"，而不是"你有这个病"。</li>' +
        '<li><b>状态会影响结果。</b>睡眠不足、急性压力、近期重大事件都会显著抬高几乎所有症状量表的分数。建议在不同时间复测一次，看的是<b>走势</b>而不是单点数值。</li>' +
        '<li><b>常模差异是真实的。</b>多数经典量表的切分点来自西方样本；中文版虽经修订，不同人群的分数分布仍有差异。分数更适合用来自比与追踪，而不是与他人比。</li>' +
        '<li><b>娱乐类测试没有测量学基础。</b>本站的娱乐测试全部自编、无常模、无信效度数据，请只当作自我投射与聊天素材。</li>' +
      '</ul>' +

      '<h2>四、首次测试前的确认</h2>' +
      '<p>在你第一次开始任何一个测试之前，站点会要求你先确认下面这段说明：</p>' +
      '<blockquote style="margin:0 0 1em;padding:14px 16px;border-left:4px solid var(--warn);background:var(--surface-2);border-radius:10px">' + esc(CONSENT_TEXT) + '</blockquote>' +
      '<p>确认结果只记录在<b>你本机的浏览器</b>里（<code>att.consent.v2</code>），确认过一次后就不再出现；清除浏览器数据后会重新出现。' +
      '在你确认之前，测试页<b>不会渲染任何题目</b>，外链条目也不会给出作答入口——但简介与「出处与使用条件」始终可以先读。</p>' +

      '<h2>五、特别提醒：涉及危机的条目</h2>' +
      '<p>涉及自伤、自杀意念、创伤、进食障碍的条目，结果页会自动显示求助信息。如果你或你关心的人正在经历危机，请联系：</p>' +
      '<ul>' +
        '<li>中国大陆全国统一心理援助热线：<b>12356</b></li>' +
        '<li>北京心理危机研究与干预中心：<b>010-8295-1332</b>（24 小时）</li>' +
        '<li>希望 24 热线：<b>400-161-9995</b></li>' +
        '<li>紧急情况：<b>120</b>，或前往最近的医院急诊</li>' +
      '</ul>' +

      '<h2>六、技术说明</h2>' +
      '<ul>' +
        '<li>纯静态站点，零依赖、零构建。数据以 JS 对象形式按类别拆分为 ' +
          '<code>assets/js/data/*.js</code>，每个量表包含题目、选项、计分与分档解读。</li>' +
        '<li>作者标识原图 <code>AuthorLogo.png</code>（1254×1254，1.5 MB）保留在项目根目录；' +
          '页面实际加载的是等比缩放的 <code>assets/img/author-logo-96.png</code>（顶部标识、favicon）与 ' +
          '<code>assets/img/author-logo-256.png</code>（关于页、首测确认页），避免为一个小图标拉取 1.5 MB 原图。</li>' +
        '<li>计分在浏览器本地完成；支持总分型、多维度型、类型编码型、计次归类型与自定义函数五种计分方式。</li>' +
        '<li>所有富文本都经过白名单净化，外部链接强制 <code>rel="noopener noreferrer"</code>。</li>' +
        '<li>键盘可用：<code>1–9</code> 选选项、<code>← →</code> 翻题、<code>Enter</code> 提交、<code>/</code> 聚焦搜索。</li>' +
      '</ul>' +

      '<h2>七、当前收录统计</h2>' +
      '<div class="table-scroll"><table class="data"><thead><tr><th>类别</th><th>条目</th><th>站内可做</th><th>免费外链</th><th>仅说明</th></tr></thead><tbody>' +
      A.cats.map(function (c) {
        var l = byCat(c.id);
        return '<tr><td>' + c.emoji + ' ' + esc(c.cn) + '</td><td>' + l.length + '</td>' +
          '<td>' + l.filter(function (t) { return t._acc.hasBuiltin; }).length + '</td>' +
          '<td>' + l.filter(function (t) { return t._acc.mode === 'link'; }).length + '</td>' +
          '<td>' + l.filter(function (t) { return t._acc.mode === 'ref'; }).length + '</td></tr>';
      }).join('') +
      '<tr><td><b>合计</b></td><td><b>' + TESTS.length + '</b></td>' +
      '<td><b>' + (byAccess('builtin') + byAccess('both')) + '</b></td>' +
      '<td><b>' + byAccess('link') + '</b></td><td><b>' + byAccess('ref') + '</b></td></tr>' +
      '</tbody></table></div>' +
      '<p class="small muted">自建量表题目总数：<b>' + TESTS.reduce(function (s, t) { return s + t._n; }, 0) + '</b> 道；登记来源站点：<b>' + Object.keys(A.sources).length + '</b> 个；去重判定组：<b>' + A.clusters.length + '</b> 组。</p>' +

      '<h2>八、免责声明</h2>' +
      '<p>本站是心理测量量表的<b>整理与索引项目</b>，由 <b>' + AUTHOR + '</b> 个人创作与维护，所有内容仅供自我了解、科普与娱乐，' +
      '<b>不构成医学诊断、心理治疗、法律或任何其他专业建议，也不保证测试结果严谨准确</b>。' +
      '任何人依据本站内容做出的决定，其后果由本人承担。若你正在经历持续的情绪困扰、睡眠问题、自伤念头或功能受损，请及时联系精神科/心理科医生或拨打上方的心理援助热线。</p>' +
      '</div>';
  }

  /* ====================== 搜索 ====================== */
  var SIDX = TESTS.map(function (t) {
    return { t:t, s:(t.cn + ' ' + (t.en || '') + ' ' + t.id + ' ' + (t.tags || []).join(' ') + ' ' + catOf(t).cn).toLowerCase() };
  });
  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    var terms = q.split(/\s+/);
    var out = [];
    SIDX.forEach(function (r) {
      var score = 0, ok = true;
      terms.forEach(function (term) {
        var i = r.s.indexOf(term);
        if (i < 0) { ok = false; return; }
        score += (r.t.id.toLowerCase() === term ? 100 : 0) + (r.t.cn.toLowerCase().indexOf(term) === 0 ? 40 : 0) + Math.max(0, 20 - i / 4);
      });
      if (ok) out.push({ t:r.t, score:score });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, 12).map(function (x) { return x.t; });
  }

  function renderSearchPanel(list, sel) {
    var p = $('#search-panel');
    if (!list.length) {
      p.innerHTML = '<div class="sr-empty">没有匹配的测试。试试"抑郁""依恋""拖延""大五"。</div>';
      p.hidden = false; return;
    }
    var h = '<div class="sr-head">匹配到 ' + list.length + ' 个测试</div>';
    list.forEach(function (t, i) {
      var c = catOf(t), m = A.MODE_TEXT[t._acc.mode] || {};
      h += '<a class="sr-item' + (i === sel ? ' on' : '') + '" href="#/test/' + esc(t.id) + '">' +
        '<b>' + esc(t.cn) + '</b>' +
        '<span class="pill ' + (m.pill || '') + '" style="margin-left:6px">' + esc(m.label || '') + '</span>' +
        '<span class="sr-sub">' + c.emoji + ' ' + esc(c.cn) + ' · ' + esc(t.en || '') + '</span></a>';
    });
    p.innerHTML = h; p.hidden = false;
  }

  /* ====================== 作者与知情同意 ====================== */
  var AUTHOR = 'FZYZ LSY';
  var AUTHOR_LOGO = 'assets/img/author-logo-256.png';
  var AUTHOR_LOGO_SM = 'assets/img/author-logo-96.png';

  /* 首次测试前必须确认的原话（逐字保留，不要改写） */
  var CONSENT_TEXT = '本测试是由FZYZ LSY创作的个人项目，仅作娱乐，并不能代替任何现实心理诊断和治疗，也不保证测试结果严谨准确。请知晓以开始测试：';

  var LS_CONSENT = 'att.consent.v2';
  function hasConsent() {
    try { return localStorage.getItem(LS_CONSENT) === 'yes'; } catch (e) { return false; }
  }
  function grantConsent() {
    try { localStorage.setItem(LS_CONSENT, 'yes'); } catch (e) {}
  }

  /** 该条目在用户实际操作前是否需要先过知情同意门 */
  function needsGate(t) {
    if (hasConsent()) return false;
    var m = t._acc.mode;
    if (m === 'ref') return false;              // 纯说明条目，没有可做的测试
    if (m === 'link') return true;              // 要跳到源站做测试，同样先告知
    return !!(t._acc.hasBuiltin && t._n);       // 站内可作答
  }

  function consentGate(t) {
    return '<section class="consent" id="consent-gate">' +
      '<img class="consent-logo" src="' + AUTHOR_LOGO + '" alt="' + AUTHOR + '" width="66" height="66">' +
      '<h2>开始测试前，请先知晓</h2>' +
      '<div class="who">All The Tests · 由 <b>' + AUTHOR + '</b> 创作</div>' +
      '<blockquote id="consent-text">' + esc(CONSENT_TEXT) + '</blockquote>' +
      '<label class="agree" id="consent-agree">' +
        '<input type="checkbox" id="consent-box">' +
        '<span>我已阅读并知晓以上说明，理解它仅作娱乐、不能替代任何现实心理诊断与治疗。</span>' +
      '</label>' +
      '<div class="actions">' +
        '<button class="btn primary" id="consent-go" type="button" disabled>开始测试 ✓</button>' +
        '<a class="btn" href="#/cat/' + esc(t.cat) + '">先不测，返回分类</a>' +
      '</div>' +
      '<p class="foot">勾选后点击「开始测试」即表示你已知晓。确认一次后不会再次出现（记录在本机浏览器）。<br>' +
        '你也可以先阅读上方的<b>简介</b>与<b>出处与使用条件</b>，再决定是否作答。' +
        '<a href="#/about">了解作者与测量学说明 →</a></p>' +
      '</section>';
  }

  function bindConsentGate() {
    var box = $('#consent-box'), btn = $('#consent-go'), lab = $('#consent-agree');
    if (!box || !btn) return;
    box.addEventListener('change', function () {
      btn.disabled = !box.checked;
      if (lab) lab.classList.toggle('on', !!box.checked);
    });
    btn.addEventListener('click', function () {
      if (!box.checked) return;
      grantConsent();
      route();          // 重新渲染当前测试页，这次直接进入测试
    });
  }

  function authorSign() {
    return '<div class="author-sign">' +
      '<img src="' + AUTHOR_LOGO_SM + '" alt="" width="24" height="24" loading="lazy">' +
      '本测试由 <b>' + AUTHOR + '</b> 创作的个人项目提供，仅作娱乐，不保证结果严谨准确、不能替代现实心理诊断与治疗。' +
      '</div>';
  }

  /* ====================== 路由 ====================== */
  function notFound(msg) {
    return '<div class="empty"><div class="big">🧭</div>' + esc(msg || '页面不存在') +
      '<br><br><a class="btn" href="#/">回到首页</a></div>';
  }

  var main = $('#main');
  function route() {
    if (RUN && !RUN.done) { document.removeEventListener('keydown', onKey); RUN = null; }
    var hash = location.hash.replace(/^#/, '') || '/';
    var parts = hash.split('/').filter(Boolean);
    var html, nav = parts[0] || 'home';

    if (parts[0] === 'test' && parts[1]) { html = viewTest(decodeURIComponent(parts[1])); nav = 'cats'; }
    else if (parts[0] === 'cat' && parts[1]) { html = viewCat(parts[1]); nav = 'cats'; }
    else if (parts[0] === 'cats') { html = viewCats(); nav = 'cats'; }
    else if (parts[0] === 'dedup') { html = viewDedup(); nav = 'dedup'; }
    else if (parts[0] === 'mine') { html = viewMine(); nav = 'mine'; }
    else if (parts[0] === 'about') { html = viewAbout(); nav = 'about'; }
    else { html = viewHome(); nav = 'home'; }

    main.innerHTML = html;
    $$('.topnav a[data-nav]').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-nav') === nav);
    });
    window.scrollTo(0, 0);
    if (parts[0] === 'dedup') setTimeout(bindDedupSearch, 0);
    if (parts[0] === 'test') setTimeout(bindConsentGate, 0);
    var rb = $('#btn-random');
    if (rb) rb.addEventListener('click', function () {
      var pool = TESTS.filter(function (t) { return t._acc.hasBuiltin; });
      var pick = pool[Math.floor(Math.random() * pool.length)];
      location.hash = '#/test/' + pick.id;
    });
  }

  function bindDedupSearch() {
    var inp = $('#dedup-q'); if (!inp) return;
    var cl = $$('.cluster'), cnt = $('#dedup-count');
    inp.addEventListener('input', function () {
      var q = inp.value.trim().toLowerCase(), n = 0;
      cl.forEach(function (c) {
        if (!c.getAttribute('data-search')) return;
        var hit = !q || c.getAttribute('data-search').toLowerCase().indexOf(q) > -1;
        c.style.display = hit ? '' : 'none';
        if (hit) n++;
      });
      if (cnt) cnt.textContent = '命中 ' + n + ' / ' + cl.length + ' 组';
    });
    if (cnt) cnt.textContent = '共 ' + cl.length + ' 组';
  }

  /* ====================== 启动 ====================== */
  function boot() {
    initTheme();
    $('#theme-btn').addEventListener('click', toggleTheme);
    window.addEventListener('hashchange', route);
    route();

    var inp = $('#search'), panel = $('#search-panel'), sel = -1, cur = [];
    function close() { panel.hidden = true; sel = -1; }
    inp.addEventListener('input', function () {
      cur = search(inp.value); sel = cur.length ? 0 : -1; renderSearchPanel(cur, sel);
    });
    inp.addEventListener('focus', function () { if (inp.value.trim()) { cur = search(inp.value); renderSearchPanel(cur, sel); } });
    inp.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { inp.blur(); close(); return; }
      if (!cur.length) return;
      if (ev.key === 'ArrowDown') { ev.preventDefault(); sel = Math.min(cur.length - 1, sel + 1); renderSearchPanel(cur, sel); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); sel = Math.max(0, sel - 1); renderSearchPanel(cur, sel); }
      else if (ev.key === 'Enter') { ev.preventDefault(); if (cur[sel]) { location.hash = '#/test/' + cur[sel].id; inp.value = ''; close(); } }
    });
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest || !ev.target.closest('.search-wrap')) close();
      if (ev.target.closest && ev.target.closest('.sr-item')) { close(); inp.value = ''; }
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === '/' && document.activeElement !== inp && !/input|textarea|select/i.test(document.activeElement.tagName)) {
        ev.preventDefault(); inp.focus();
      }
    });

    var st = $('#footer-stats');
    if (st) st.textContent = '已收录 ' + TESTS.length + ' 个测试 · ' + A.cats.length + ' 个类别 · ' +
      (byAccess('builtin') + byAccess('both')) + ' 个站内可做 · ' +
      TESTS.reduce(function (s, t) { return s + t._n; }, 0) + ' 道自建题目';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* 供验证脚本使用（tools/smoke.js）——浏览器里也只是一组内部函数引用 */
  window.ATT_APP = {
    TESTS:TESTS, INDEX:INDEX, DUP:DUP, CATS:CATS, byCat:byCat, byAccess:byAccess, route:route,
    _t:{
      viewHome:viewHome, viewCats:viewCats, viewCat:viewCat, viewTest:viewTest,
      viewDedup:viewDedup, viewMine:viewMine, viewAbout:viewAbout,
      resultHtml:resultHtml, search:search,
      setRun:function (t, answers) { RUN = { t:t, answers:answers.slice(), idx:0, mode:'list', done:true }; return RUN; },
      getRun:function () { return RUN; }
    }
  };
})();
