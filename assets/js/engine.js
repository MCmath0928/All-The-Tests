/* ==========================================================================
   All The Tests — 测评引擎
   题型 / 计分 / 结果解读 / 危机提示
   ========================================================================== */
(function (A) {
  'use strict';

  /* --------------------------- 工具 --------------------------- */
  var ALLOWED = { B:1, STRONG:1, I:1, EM:1, U:1, BR:1, P:1, UL:1, OL:1, LI:1,
                  A:1, SPAN:1, SMALL:1, CODE:1, TABLE:1, TR:1, TD:1, TH:1,
                  THEAD:1, TBODY:1, H3:1, H4:1, DIV:1, SUP:1, SUB:1 };

  /** 极简白名单净化：只允许排版标签，链接强制 target/rel */
  A.safe = function (html) {
    if (html == null) return '';
    var s = String(html);
    if (s.indexOf('<') === -1) return s;
    var tmp = document.createElement('div');
    tmp.innerHTML = s;
    (function walk(node) {
      var kids = Array.prototype.slice.call(node.childNodes);
      for (var i = 0; i < kids.length; i++) {
        var el = kids[i];
        if (el.nodeType === 1) {
          if (!ALLOWED[el.tagName]) { el.replaceWith(document.createTextNode(el.textContent || '')); continue; }
          var href = el.getAttribute('href'), cls = el.getAttribute('class');
          Array.prototype.slice.call(el.attributes).forEach(function (at) { el.removeAttribute(at.name); });
          if (href && /^(https?:|#|\/)/i.test(href)) {
            el.setAttribute('href', href);
            if (/^https?:/i.test(href)) { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
          }
          if (cls) el.setAttribute('class', cls);
          walk(el);
        } else if (el.nodeType === 8) {
          el.remove();
        }
      }
    })(tmp);
    return tmp.innerHTML;
  };

  A.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  };

  /* --------------------------- 题目归一化 --------------------------- */
  /**
   * 题目写法：
   *   '题干'                                   —— 使用量表统一选项
   *   {t, r, d, o, v, k, noScore, hint}
   *     r  反向计分
   *     d  所属维度
   *     o  该题专用选项文本数组（覆盖 scale）
   *     v  选项分值数组（默认取下标）
   *     k  most 型计分的选项归类键（与 o 一一对应）
   */
  A.normQ = function (q) {
    if (typeof q === 'string') return { t: q, _s: q };
    var o = { t: q.t };
    if (q.r) o.r = 1;
    if (q.d) o.d = q.d;
    if (q.o) o.o = q.o;
    if (q.v) o.v = q.v;
    if (q.k) o.k = q.k;
    if (q.noScore) o.noScore = 1;
    if (q.hint) o.hint = q.hint;
    return o;
  };

  /** 某一题的选项文本 */
  A.qOptions = function (t, qi) { return qi.o || t.scale || ['否', '是']; };
  /** 某一题某个选项对应的分值 */
  A.qValue = function (qi, oi) { return (qi.v && qi.v[oi] != null) ? qi.v[oi] : oi; };
  /** 某一题的最大可选分值 */
  A.qMax = function (t, qi) {
    var opts = A.qOptions(t, qi);
    if (qi.v) return Math.max.apply(null, qi.v);
    return opts.length - 1;
  };

  A.questions = function (t) { return (t.q || []).map(A.normQ); };
  A.itemCount = function (t) { return (t.q || []).length; };
  A.maxTotal = function (t) {
    var qs = A.questions(t), s = 0;
    for (var i = 0; i < qs.length; i++) if (!qs[i].noScore) s += A.qMax(t, qs[i]);
    return s;
  };

  /* --------------------------- 计分 --------------------------- */
  /**
   * 返回 {ok, headline, sub, scoreText, dims:[], levelIdx, ranges:[], alerts:[]}
   */
  A.score = function (t, answers) {
    var sc = t.score || {};
    var qs = A.questions(t);
    var out = { headline:'', sub:'', scoreText:'', dims:[], levelIdx:-1, ranges:[], alerts:[], code:'' };

    function rawVal(i) {
      var v = answers[i];
      if (v == null) return null;
      if (qs[i].noScore) return null;
      return A.qValue(qs[i], v);
    }
    function val(i) {
      var v = rawVal(i);
      if (v == null) return null;
      return qs[i].r ? (A.qMax(t, qs[i]) - v) : v;
    }

    /* --- 1. 总分型 --- */
    if (sc.type === 'sum' || sc.type === 'mean') {
      var total = 0, cnt = 0;
      for (var i = 0; i < qs.length; i++) { var v = val(i); if (v != null) { total += v; cnt++; } }
      var raw = sc.type === 'mean' ? (cnt ? total / cnt : 0) : total;
      var idx = -1, rng = sc.ranges || [];
      for (var r = 0; r < rng.length; r++) { if (raw <= rng[r][0]) { idx = r; break; } }
      if (idx === -1) idx = rng.length - 1;
      out.levelIdx = idx;
      out.ranges = rng;
      out.max = A.maxTotal(t);
      out.scoreText = sc.type === 'mean'
        ? '均分 ' + raw.toFixed(2) + '（共 ' + cnt + ' 题）'
        : '总分 ' + raw + ' / ' + out.max + '（共 ' + cnt + ' 题）';
      if (rng[idx]) {
        out.headline = rng[idx][1];
        out.sub = sc.type === 'mean' ? raw.toFixed(2) + ' 分' : raw + ' / ' + out.max + ' 分';
        out.body = rng[idx][2] || '';
        out.alert = rng[idx][3] || null;
      }
      out.raw = raw;
      if (sc.dims) out.dims = dimScores(t, qs, answers, sc.dims, out);
      return out;
    }

    /* --- 2. 多维度型 --- */
    if (sc.type === 'dims') {
      out.dims = dimScores(t, qs, answers, sc.dims, out);
      if (sc.headline !== null) {
        var worst = null, worstIdx = -1;
        out.dims.forEach(function (d) {
          if (d.levelIdx > worstIdx) { worstIdx = d.levelIdx; worst = d; }
        });
        if (worst) {
          out.headline = sc.headline === 'label' ? (worst.cn + ' · ' + worst.level) : worst.level;
          out.sub = out.dims.map(function (d) { return d.cn + '：' + d.level; }).join('　·　');
          out.body = sc.summary || '';
          out.worst = worst;
          out.alert = (worst.alert && worst.alert.kind ? worst.alert : null) || null;
        } else { out.headline = '已完成'; out.body = sc.summary || ''; }
      } else { out.headline = ''; out.body = ''; }
      return out;
    }

    /* --- 3. 类型编码型（MBTI 式 / 四象限） --- */
    if (sc.type === 'type') {
      var axes = sc.axes || {}, letters = '', parts = [];
      Object.keys(axes).forEach(function (ax) {
        var def = axes[ax], sum = 0, n = 0, maxSum = 0;
        for (var i = 0; i < qs.length; i++) {
          if (qs[i].d !== ax) continue;
          maxSum += A.qMax(t, qs[i]);
          var x = val(i); if (x == null) continue;
          sum += x; n++;
        }
        var pos = sum >= maxSum / 2;
        var letter = pos ? def.pos : def.neg;
        letters += letter;
        var pct = maxSum ? Math.round((sum / maxSum) * 100) : 50;
        var pole = def[letter] || {};
        parts.push({ letter:letter, cn:pole.cn || letter, en:pole.en || '', html:pole.html || '',
                     pct: pos ? pct : 100 - pct, ax:ax, axCn:def.cn || ax });
        out.dims.push({
          key: ax, cn: (def.cn || ax) + ' · ' + (pole.cn || letter),
          pct: pos ? pct : 100 - pct, score:sum, max:maxSum, level: pole.cn || letter,
          levelIdx: pos ? 1 : 0, text:'',
          left: def[def.neg] && def[def.neg].cn, right: def[def.pos] && def[def.pos].cn,
          answered: n
        });
      });
      out.code = letters;
      out.parts = parts;
      var title = (sc.titles && sc.titles[letters]) ? sc.titles[letters] : '';
      out.headline = (sc.titleAsHeadline && title) ? title : letters;
      out.sub = title
        ? (sc.titleAsHeadline ? letters + '　·　' + parts.map(function (p) { return p.cn; }).join(' + ') : title)
        : parts.map(function (p) { return p.cn; }).join(' + ');
      out.body = parts.map(function (p) { return p.html; }).join('');
      out.alert = null;
      return out;
    }

    /* --- 4. 计次归类型（哪种成分最多） --- */
    if (sc.type === 'most') {
      var tally = {}, opts = sc.opts || {};
      qs.forEach(function (q, i) {
        var v = answers[i]; if (v == null || !q.k) return;
        var key = q.k[v];
        if (!key) return;
        tally[key] = (tally[key] || 0) + 1;
      });
      var list = Object.keys(tally).map(function (k) {
        return { k:k, n:tally[k], cn:(opts[k] && opts[k].cn) || k, html:(opts[k] && opts[k].html) || '' };
      }).sort(function (a, b) { return b.n - a.n; });
      out.tally = list;
      out.dims = list.map(function (x) {
        return { key:x.k, cn:x.cn, pct: Math.round((x.n / qs.length) * 100), score:x.n, max:qs.length,
                 level:x.n + ' 项', levelIdx:x.n, text:'' };
      });
      if (list[0]) {
        out.headline = list[0].cn;
        out.sub = '共命中 ' + list[0].n + ' / ' + qs.length + ' 项';
        out.body = list[0].html;
      }
      if (sc.summary) out.summary = sc.summary;
      return out;
    }

    /* --- 5. 自定义函数 --- */
    if (typeof sc.fn === 'function') {
      var res = sc.fn(answers, t, { questions: qs, maxTotal: A.maxTotal(t), dims: dimScores });
      return Object.assign(out, res || {});
    }

    out.headline = '已记录';
    out.body = '本测试为记录型，没有标准分。';
    return out;
  };

  function dimScores(t, qs, answers, defs, out) {
    var keys = Object.keys(defs), res = [];
    keys.forEach(function (k) {
      var def = defs[k], sum = 0, n = 0, maxRaw = 0;
      for (var i = 0; i < qs.length; i++) {
        if (qs[i].d !== k) continue;
        if (qs[i].noScore) continue;
        var m = A.qMax(t, qs[i]);
        maxRaw += m;
        var v = answers[i];
        if (v == null) continue;
        var rv = A.qValue(qs[i], v);
        sum += qs[i].r ? (m - rv) : rv;
        n++;
      }
      var factor = def.factor || 1;
      var raw = sum * factor;
      var max = def.max || (maxRaw * factor);
      var idx = -1, rng = def.ranges || [];
      for (var r = 0; r < rng.length; r++) { if (raw <= rng[r][0]) { idx = r; break; } }
      if (idx === -1) idx = rng.length - 1;
      res.push({
        key: k, cn: def.cn || k, en: def.en || '',
        score: raw, max: max,
        pct: max ? Math.round((raw / max) * 100) : 0,
        levelIdx: idx, level: rng[idx] ? rng[idx][1] : '',
        text: rng[idx] ? (rng[idx][2] || '') : '',
        alert: rng[idx] ? (rng[idx][3] || null) : null,
        ranges: rng, answered: n
      });
    });
    return res;
  }

  /* --------------------------- 提示分级 --------------------------- */
  A.alertToHtml = function (a) {
    if (!a) return '';
    if (typeof a === 'string') a = { kind: a };
    var kind = a.kind || 'info';
    var txt = a.text || '';
    return '<div class="alert ' + kind + '">' + txt + '</div>';
  };

  A.CRISIS = '<b>如果你此刻有伤害自己的念头，请立即寻求帮助：</b>中国大陆全国统一心理援助热线 <b>12356</b>；' +
    '北京心理危机研究与干预中心 <b>010-8295-1332</b>（24 小时）；希望 24 热线 <b>400-161-9995</b>；' +
    '紧急情况请直接拨打 <b>120</b> 或前往最近的急诊。你不是一个人，专业帮助真的有用。';

  /* --------------------------- 中译与英文源站说明 --------------------------- */
  /** 站内中文题本译自英文原版时要显示的告示 */
  A.TRANS_NOTE = '本页中文题本由本站据公开的<b>英文原版题本</b>翻译整理，题量与计分规则遵循原版。' +
    '翻译过程中，个别题目在<b>语义、语气或文化内涵上可能与原版存在细微差异</b>——也就是说，' +
    '<b>中译版可能小部分破坏原意</b>。若你的结果落在临界值附近，或需要用于研究、临床等正式用途，' +
    '请以英文原版（见上方「出处与使用条件」）为准，或对照原文再做一次。';

  /** 结果页用的短版 */
  A.TRANS_NOTE_SHORT = '本页中文题本译自英文原版，<b>中译可能在小部分题目的语义或文化内涵上偏离原意</b>；' +
    '若结果落在临界值附近，建议对照英文原版复核。';

  /** 外链源站只有英文界面、且站内暂无同量表中文自建版时的说明 */
  A.EN_ONLY_NOTE = '这个条目的源站只有英文界面。下面说明为什么站内没有对应的中文自建版，' +
    '并给出可以在站内用中文完成的替代测试。';

  /** 判定：该条目是否"外链为英文站、且没有站内中文题本" */
  A.isEnOnly = function (t) { return !!t.enOnly; };

  /* --------------------------- 兼容性判定 --------------------------- */
  A.access = function (t) {
    var srcs = (t.srcs || []).map(function (k) { return A.sources[k]; }).filter(Boolean);
    var cnOK = srcs.length ? srcs.some(function (s) { return s.cn; }) : !!t.cn;
    var free = srcs.length ? srcs.some(function (s) { return s.free; }) : !!t.free;
    var mode = t.access || (cnOK && free ? 'link' : 'builtin');
    return { cn: cnOK, free: free, mode: mode,
             canLink: mode === 'link' || mode === 'both',
             hasBuiltin: mode === 'builtin' || mode === 'both' };
  };

  A.MODE_TEXT = {
    link:    { label:'外链源站', pill:'ok',   desc:'源站在中国大陆可访问、测试免费 —— 直接前往源站作答。' },
    builtin: { label:'自建测试', pill:'warn', desc:'源站不可访问或测试不免费 —— 已按公开量表题本自建站内测试页。' },
    both:    { label:'外链 + 自建', pill:'accent', desc:'源站可访问且免费，同时提供站内自建版，便于离线作答与保存记录。' },
    ref:     { label:'仅作收录说明', pill:'',   desc:'受版权、商标或施测资质限制，无法自建题本 —— 提供出处与获取途径。' }
  };

})(window.ATT);
