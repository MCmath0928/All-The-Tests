/* ==========================================================================
   All The Tests — 渲染冒烟测试（Node + 极简 DOM 垫片）
   用法： node tools/smoke.js
   目的：在没有浏览器的前提下，把 app.js 真正跑起来，逐个渲染
        首页 / 分类页 / 全部测试页 / 去重页 / 记录页 / 关于页 / 全部结果页，
        捕获任何运行期异常与明显的渲染缺陷。
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'assets/js/data/registry.js',
  'assets/js/engine.js',
  'assets/js/data/personality.js',
  'assets/js/data/clinical.js',
  'assets/js/data/mind.js',
  'assets/js/data/relate.js',
  'assets/js/data/self.js',
  'assets/js/data/fun.js',
  'assets/js/app.js'
];

/* ============================ 极简 DOM 垫片 ============================
   带一个真正的迷你 HTML 解析器：这样 engine 的 safe() 净化函数
   （白名单标签、属性剥离、replaceWith 降级）会被真实执行，而不是被跳过。
   ====================================================================== */
const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']);
const ATTR_RE = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function makeNode(tag) {
  const n = {
    nodeType: 1, tagName: String(tag).toUpperCase(), childNodes: [], attributes: [], parentNode: null,
    get textContent() {
      if (!this.childNodes.length) return '';
      return this.childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join('');
    },
    getAttribute(k) { const a = this.attributes.find((x) => x.name === k); return a ? a.value : null; },
    setAttribute(k, v) {
      const a = this.attributes.find((x) => x.name === k);
      if (a) a.value = String(v); else this.attributes.push({ name:k, value:String(v) });
    },
    removeAttribute(k) { this.attributes = this.attributes.filter((x) => x.name !== k); },
    remove() { if (this.parentNode) this.parentNode.childNodes = this.parentNode.childNodes.filter((c) => c !== this); },
    replaceWith(node) {
      if (!this.parentNode) return;
      const i = this.parentNode.childNodes.indexOf(this);
      if (i > -1) this.parentNode.childNodes.splice(i, 1, node);
      if (node) node.parentNode = this.parentNode;
    }
  };
  return n;
}
function textNode(t) { return { nodeType:3, nodeValue:String(t), textContent:String(t), parentNode:null }; }

function parseHtml(html) {
  const root = { nodeType:1, tagName:'#ROOT', childNodes:[] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:(?:"[^"]*"|'[^']*'|[^>"'])*))(\/?)>/g;
  let last = 0, m;
  const pushText = (t) => { if (t) { const n = textNode(t); n.parentNode = stack[stack.length - 1]; stack[stack.length - 1].childNodes.push(n); } };
  const pushEl = (el) => { el.parentNode = stack[stack.length - 1]; stack[stack.length - 1].childNodes.push(el); };
  while ((m = re.exec(html)) !== null) {
    if (m.index > last) pushText(html.slice(last, m.index));
    last = re.lastIndex;
    if (m[0].slice(0, 2) === '<!--' || m[0].slice(0, 9) === '<![CDATA[') continue;
    const tag = String(m[1]).toLowerCase();
    if (m[0][1] === '/') {
      for (let i = stack.length - 1; i > 0; i--) { if (stack[i].tagName === tag.toUpperCase()) { stack.length = i; break; } }
      continue;
    }
    const el = makeEl(tag);   // 解析出的节点同样带完整元素 API
    const attrs = m[2] || '';
    let am;
    ATTR_RE.lastIndex = 0;
    while ((am = ATTR_RE.exec(attrs)) !== null) {
      if (!am[1]) continue;
      const v = am[2] != null ? am[2] : am[3] != null ? am[3] : am[4] != null ? am[4] : '';
      el.attributes.push({ name:am[1], value:v });
    }
    pushEl(el);
    if (!VOID.has(tag) && m[3] !== '/') stack.push(el);
  }
  if (last < html.length) pushText(html.slice(last));
  return root.childNodes;
}
function serialize(nodes) {
  return nodes.map((n) => {
    if (n.nodeType === 3) return n.nodeValue;
    const tag = n.tagName.toLowerCase();
    const attrs = n.attributes.map((a) => (a.value === '' ? ' ' + a.name : ' ' + a.name + '="' + a.value + '"')).join('');
    if (VOID.has(tag)) return '<' + tag + attrs + '>';
    return '<' + tag + attrs + '>' + serialize(n.childNodes) + '</' + tag + '>';
  }).join('');
}

function makeEl(tag) {
  const el = Object.assign(makeNode(tag), {
    nodeType: 1, value: '', hidden: false,
    style: {}, className: '', _h: {},
    addEventListener(t, f) { (this._h[t] = this._h[t] || []).push(f); },
    removeEventListener(t, f) {
      if (!this._h[t]) return;
      this._h[t] = this._h[t].filter((x) => x !== f);
    },
    appendChild(c) { this.childNodes.push(c); if (c) c.parentNode = this; return c; },
    removeChild(c) { this.childNodes = this.childNodes.filter((x) => x !== c); },
    /* 委托事件依赖 closest/contains，必须是真实实现，否则交互路径根本走不到 */
    closest(sel) {
      const groups = String(sel).trim().split(/\s+/);
      const last = groups[groups.length - 1];
      let n = this;
      while (n && n.nodeType === 1) {
        if (matchSimple(n, last)) {
          let ok = true, cur = n.parentNode;
          for (let i = groups.length - 2; i >= 0; i--) {
            let found = false;
            while (cur && cur.nodeType === 1) {
              if (matchSimple(cur, groups[i])) { found = true; cur = cur.parentNode; break; }
              cur = cur.parentNode;
            }
            if (!found) { ok = false; break; }
          }
          if (ok) return n;
        }
        n = n.parentNode;
      }
      return null;
    },
    contains(node) { let n = node; while (n) { if (n === this) return true; n = n.parentNode; } return false; },
    querySelector(sel) { return findAll(this, sel)[0] || makeEl('div'); },
    querySelectorAll(sel) { return findAll(this, sel); },
    scrollIntoView() {}, focus() {}, blur() {}, select() {},
    dispatch(t, ev) { (this._h[t] || []).forEach((f) => f(ev || { target:{}, preventDefault(){} })); }
  });
  let kids = [];
  Object.defineProperty(el, 'childNodes', { get: () => kids, set: (v) => { kids = v; }, configurable:true, enumerable:true });
  Object.defineProperty(el, 'innerHTML', {
    /* 关键：解析出的顶层节点必须重新挂到 el 自己身上，
       否则 parentNode 链断在临时 root 上，冒泡与 closest/contains 全部失效 */
    get: () => serialize(kids),
    set: (v) => {
      kids = parseHtml(String(v));
      kids.forEach((k) => { k.parentNode = el; });
    },
    configurable: true, enumerable: true
  });
  Object.defineProperty(el, 'textContent', {
    get: () => kids.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join(''),
    set: (v) => { kids = (v === '' || v == null) ? [] : [textNode(v)]; },
    configurable: true, enumerable: true
  });
  /* classList 真正读写 class 属性（否则 toggle/add 是空操作，交互类断言会失真） */
  Object.defineProperty(el, 'classList', {
    value: {
      _list() { return (el.getAttribute('class') || '').split(/\s+/).filter(Boolean); },
      _set(a) { el.setAttribute('class', a.join(' ')); },
      add(c) { const a = this._list(); if (a.indexOf(c) < 0) { a.push(c); this._set(a); } },
      remove(c) { this._set(this._list().filter((x) => x !== c)); },
      toggle(c, force) {
        const has = this._list().indexOf(c) > -1;
        const want = force === undefined ? !has : !!force;
        if (want && !has) this.add(c); else if (!want && has) this.remove(c);
        return want;
      },
      contains(c) { return this._list().indexOf(c) > -1; }
    },
    configurable: true, enumerable: true
  });
  /* disabled / checked / hidden / id 与内容属性互相反映，和浏览器 IDL 属性一致 */
  ['disabled', 'checked', 'hidden'].forEach((prop) => {
    Object.defineProperty(el, prop, {
      get: () => el.attributes.some((a) => a.name === prop),
      set: (v) => { if (v) el.setAttribute(prop, ''); else el.removeAttribute(prop); },
      configurable: true, enumerable: true
    });
  });
  Object.defineProperty(el, 'id', {
    get: () => el.getAttribute('id') || '',
    set: (v) => el.setAttribute('id', v),
    configurable: true, enumerable: true
  });
  return el;
}
/* --------------------- 迷你选择器引擎 --------------------- */
function walkAll(root, fn) {
  (root.childNodes || []).forEach((c) => { if (c.nodeType === 1) { fn(c); walkAll(c, fn); } });
}
function matchSimple(el, s) {
  if (!el || el.nodeType !== 1 || typeof el.getAttribute !== 'function') return false;
  const m = /^([a-zA-Z][\w-]*)?((?:[#.][\w\u4e00-\u9fa5-]+|\[[^\]]+\])*)$/.exec(s);
  if (!m) return false;
  if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
  const parts = m[2].match(/[#.][\w\u4e00-\u9fa5-]+|\[[^\]]+\]/g) || [];
  for (const p of parts) {
    if (p[0] === '#') { if (el.getAttribute('id') !== p.slice(1)) return false; }
    else if (p[0] === '.') {
      const cls = (el.getAttribute('class') || '').split(/\s+/);
      if (cls.indexOf(p.slice(1)) < 0) return false;
    } else {
      const a = p.slice(1, -1);
      const eq = a.indexOf('=');
      if (eq > -1) {
        const k = a.slice(0, eq), v = a.slice(eq + 1).replace(/^["']|["']$/g, '');
        if (el.getAttribute(k) !== v) return false;
      } else if (el.getAttribute(a) == null) return false;
    }
  }
  return true;
}
function findAll(root, sel) {
  const groups = String(sel).trim().split(/\s+/);
  let cur = [root];
  for (const g of groups) {
    const next = [];
    cur.forEach((n) => walkAll(n, (el) => { if (matchSimple(el, g)) next.push(el); }));
    cur = next;
    if (!cur.length) return [];
  }
  return cur;
}
const REG = new Map();
const SEARCH_ROOTS = [];
function q(sel) {
  for (const r of SEARCH_ROOTS) {
    if (String(sel).indexOf(' ') < 0 && matchSimple(r, sel)) return r;
    const hit = findAll(r, sel)[0]; if (hit) return hit;
  }
  if (!REG.has(sel)) REG.set(sel, makeEl('div'));
  return REG.get(sel);
}
function qa(sel, root) {
  const roots = root ? [root] : SEARCH_ROOTS;
  for (const r of roots) { const hit = findAll(r, sel); if (hit.length) return hit; }
  return [];
}

const winHandlers = {};
const docHandlers = {};

global.document = {
  _h: docHandlers,
  readyState: 'complete',
  documentElement: makeEl('html'),
  body: makeEl('body'),
  activeElement: { tagName: 'BODY' },
  querySelector: q,
  querySelectorAll: (s) => qa(s),
  createElement: (t) => makeEl(t),
  createTextNode: (t) => textNode(t),
  addEventListener(t, f) { (docHandlers[t] = docHandlers[t] || []).push(f); },
  removeEventListener(t, f) {
    if (docHandlers[t]) docHandlers[t] = docHandlers[t].filter((x) => x !== f);
  },
  execCommand() { return true; }
};
function def(name, value) {
  Object.defineProperty(globalThis, name, { value, writable: true, configurable: true, enumerable: true });
}
def('navigator', { clipboard: null });
def('localStorage', {
  _d: {},
  getItem(k) { return this._d[k] == null ? null : this._d[k]; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; }
});
def('location', { hash: '' });
def('confirm', () => true);
def('alert', (m) => { throw new Error('意外 alert: ' + m); });
def('window', {
  addEventListener(t, f) { (winHandlers[t] = winHandlers[t] || []).push(f); },
  matchMedia: () => ({ matches: false }),
  scrollTo() {}, print() {},
  location: globalThis.location,
  localStorage: globalThis.localStorage
});
global.setTimeout = (f) => { TIMERS.push(f); return TIMERS.length; };
global.clearTimeout = () => {};
const TIMERS = [];
/* 真实浏览器里 setTimeout(fn,0) 会在当前任务之后执行；这里显式 flush，
   保证 main.innerHTML 已经写入后再跑 bindRunner / bindCatFilters。 */
function flush() {
  let guard = 0;
  while (TIMERS.length && guard++ < 200) {
    const f = TIMERS.shift();
    /* 延迟回调（如自动翻页）抛异常时，记成一条可读的失败而不是让整个进程崩掉 */
    try { f(); } catch (e) { errors.push(`延迟回调（setTimeout）抛出异常：${e.message}`); }
  }
}

/* ============================ 加载全部脚本 ============================ */
const main = makeEl('div');
main.setAttribute('id', 'main');
SEARCH_ROOTS.push(main);

const errors = [];
for (const f of FILES) {
  try {
    (0, eval)(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  } catch (e) {
    console.error('✘ 加载 ' + f + ' 失败：\n' + e.stack);
    process.exit(2);
  }
}
const A = global.window.ATT;
const APP = global.window.ATT_APP;

/* ============================ 断言工具 ============================ */
let checks = 0;
function check(cond, msg) { checks++; if (!cond) errors.push(msg); }
function render(label, fn) {
  try { return fn(); } catch (e) {
    errors.push(`执行「${label}」抛出异常：${e.message}\n     ${(e.stack || '').split('\n')[1] || ''}`);
    return '';
  }
}
/** 渲染一个路由页面：执行 → flush 延迟回调 → 返回 main.innerHTML */
function renderPage(label, setup) {
  try { setup(); flush(); return main.innerHTML; } catch (e) {
    errors.push(`渲染「${label}」抛出异常：${e.message}\n     ${(e.stack || '').split('\n')[1] || ''}`);
    return '';
  }
}
function mustContain(label, html, needles) {
  needles.forEach((n) => check(html.indexOf(n) > -1, `渲染「${label}」缺少关键内容：${n}`));
}
/** 与 A.esc 保持一致的属性转义，用于断言链接是否真的写进了 HTML */
function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ============================ 1. 页面级路由 ============================ */
const pages = [
  ['首页', '#/', ['把全网的心理测试', 'cat-grid', 'test-grid', '按类别浏览']],
  ['分类总览', '#/cats', ['全部分类', 'cat-grid']],
  ['去重说明', '#/dedup', ['去重说明', 'cluster']],
  ['我的记录', '#/mine', ['我的记录']],
  ['关于', '#/about', ['测量学说明', '免责声明', '当前收录统计', 'FZYZ LSY']]
];
pages.forEach(([label, hash, needles]) => {
  global.location.hash = hash;
  mustContain(label, renderPage(label, () => APP.route()), needles);
});

/* 所有分类页 */
A.cats.forEach((c) => {
  global.location.hash = '#/cat/' + c.id;
  const html = renderPage('分类:' + c.cn, () => APP.route());
  mustContain('分类:' + c.cn, html, [c.cn, 'test-grid']);
});

/* 不存在的分类 / 测试 */
global.location.hash = '#/cat/__nope__';
check(renderPage('未知分类', () => APP.route()).indexOf('没有这个分类') > -1, '未知分类没有给出提示');
global.location.hash = '#/test/__nope__';
check(renderPage('未知测试', () => APP.route()).indexOf('没有找到这个测试') > -1, '未知测试没有给出提示');

/* ============================ 2. 首次测试前的知情同意门 ============================
   用户要求「在用户的第一个测试前，要求其确认」下面这句话，此处逐字校验。
   注意：这段文字在测试里是硬编码的独立副本——如果 app.js 里被改写，这里会失败。
   ================================================================================= */
const REQUIRED_CONSENT_TEXT = '本测试是由FZYZ LSY创作的个人项目，仅作娱乐，并不能代替任何现实心理诊断和治疗，也不保证测试结果严谨准确。请知晓以开始测试：';
const CONSENT_KEY = 'att.consent.v2';

/** 只在真的命中了页面里的元素时才返回它（否则 q() 会给出占位桩） */
function findReal(sel) {
  const el = q(sel);
  if (!el || typeof el.getAttribute !== 'function') return null;
  if (sel[0] === '#' && el.getAttribute('id') !== sel.slice(1)) return null;
  return el;
}

/* 未确认前：站内可做的、以及要跳去源站做的条目，都应被门挡住 */
localStorage.removeItem(CONSENT_KEY);
let gatedKinds = 0;
[['phq-9', 'both'], ['ipip-bigfive-50', 'builtin'], ['openpsy-ipip-neo-120', 'link']].forEach(([id, kind]) => {
  global.location.hash = '#/test/' + id;
  const html = renderPage('同意门:' + id, () => APP.route());
  gatedKinds++;
  check(html.indexOf(REQUIRED_CONSENT_TEXT) > -1,
    `${kind} 条目 ${id} 未确认前没有显示那句必须逐字出现的说明文字`);
  check(html.indexOf('id="consent-gate"') > -1, `${kind} 条目 ${id} 没有渲染同意门`);
  check(html.indexOf('id="consent-box"') > -1, `${kind} 条目 ${id} 同意门缺少确认勾选框`);
  check(html.indexOf('id="consent-go"') > -1, `${kind} 条目 ${id} 同意门缺少开始按钮`);
  check(html.indexOf('disabled') > -1, `${kind} 条目 ${id} 的开始按钮初始应当不可点击`);
  check(html.indexOf('FZYZ LSY') > -1, `${kind} 条目 ${id} 同意门里没有作者署名`);
  check(html.indexOf('author-logo-256.png') > -1, `${kind} 条目 ${id} 同意门里没有作者标识图`);
  /* 关键：未确认前不能渲染任何题目，也不能给出外部作答入口 */
  check(html.indexOf('q-block') < 0, `${kind} 条目 ${id} 在未确认前就渲染了题目`);
  check(html.indexOf('id="runner"') < 0, `${kind} 条目 ${id} 在未确认前就渲染了答题器`);
  check(html.indexOf('前往源站作答') < 0, `${kind} 条目 ${id} 在未确认前就给出了外部作答入口`);
  /* 简介与出处仍然要可读，方便用户先了解再决定 */
  check(html.indexOf('出处与使用条件') > -1, `${kind} 条目 ${id} 同意门挡住了本应可读的出处信息`);
  check(html.indexOf('简介') > -1 || html.indexOf('test-head') > -1, `${kind} 条目 ${id} 同意门挡住了简介`);
});

/* 纯说明性条目（ref）没有可做的测试，不应弹门 */
global.location.hash = '#/test/mbti-official';
const refHtml = renderPage('同意门:ref 条目', () => APP.route());
check(refHtml.indexOf('id="consent-gate"') < 0, '没有可做测试的 ref 条目不应出现同意门');

/* 交互：勾选 → 按钮解禁 → 点击 → 写入本机 → 页面重新渲染并直接进入测试 */
global.location.hash = '#/test/phq-9';
renderPage('同意门交互', () => APP.route());
const cbox = findReal('#consent-box'), cgo = findReal('#consent-go'), clab = findReal('#consent-agree');
check(!!cbox, '找不到同意门的勾选框（无法验证交互）');
check(!!cgo, '找不到同意门的开始按钮（无法验证交互）');
if (cbox && cgo) {
  check(cgo.disabled === true, '未勾选时开始按钮应当是禁用的');
  cbox.checked = true;
  cbox.dispatch('change');
  check(cgo.disabled === false, '勾选后开始按钮应当解禁');
  check(!!clab && clab.getAttribute('class').indexOf('on') > -1, '勾选后确认框应当有选中样式');
  cgo.dispatch('click');
  flush();
  check(localStorage.getItem(CONSENT_KEY) === 'yes', '点击开始后没有把确认结果写进本机存储');
  const after = main.innerHTML;
  check(after.indexOf('id="consent-gate"') < 0, '确认之后同意门应当消失');
  check(after.indexOf('q-block') > -1, '确认之后应当直接进入测试并渲染题目');
  check(after.indexOf('收录规则 ①') > -1, '确认之后 dual 条目应当恢复规则 ① 的源站入口');
}

/* 确认过一次后，其他测试页不应再次弹门 */
localStorage.setItem(CONSENT_KEY, 'yes');
global.location.hash = '#/test/gad-7';
const again = renderPage('同意门:二次访问', () => APP.route());
check(again.indexOf('id="consent-gate"') < 0, '已确认过一次后不应再次弹门');
check(again.indexOf('q-block') > -1, '已确认后应当直接渲染题目');

/* ============================ 3. 逐题作答的翻页行为 ============================
   回归测试：真实浏览器里点击 <label class="opt"> 会派发两次 click——
   一次在 label 上，一次由 label 的激活行为转发给内部的 <input type="radio">，
   两者都会冒泡到 #runner 的委托处理器。此前这会让「答完第 x 题」直接跳到第 x+2 题。
   ============================================================================ */
/** 模拟事件冒泡：从 target 一路向上触发各级监听器 */
function bubble(target, type, extra) {
  let n = target;
  while (n) {
    const hs = (n._h && n._h[type]) || [];
    hs.forEach((f) => f(Object.assign({ target, preventDefault() {} }, extra || {})));
    n = n.parentNode;
  }
}
/** 模拟一次真实鼠标点击：label 上的 click + label 转发给内部控件的 click */
function clickOption(host, oi) {
  const opt = host.querySelector('.opt[data-o="' + oi + '"]');
  if (!opt) return false;
  bubble(opt, 'click');
  const inner = opt.querySelector('input') || opt.querySelector('button[data-o]');
  if (inner && inner !== opt) bubble(inner, 'click');
  flush();
  return true;
}

const turnTest = APP.INDEX['phq-9'];
global.location.hash = '#/test/' + turnTest.id;
renderPage('翻页:进入测试', () => APP.route());
let turnRun = APP._t.getRun();
check(!!turnRun && turnRun.mode === 'one', '进入测试后应处于逐题作答模式');
check(!!turnRun && turnRun.idx === 0, '进入测试后应停在第 1 题');

if (turnRun) {
  const host = findReal('#qhost');
  check(!!host, '找不到题目容器 #qhost');

  /* 连续回答前 4 题，每题都必须只前进一格 */
  for (let step = 0; step < 4; step++) {
    const before = APP._t.getRun().idx;
    const ok = clickOption(host, step % 2);          // 交替选不同选项
    check(ok, `第 ${before + 1} 题找不到可点击的选项`);
    const after = APP._t.getRun().idx;
    check(after === before + 1,
      `答完第 ${before + 1} 题后应停在第 ${before + 2} 题，实际停在第 ${after + 1} 题（跳了 ${after - before} 格）`);
    const shown = main.innerHTML.match(/第 (\d+) 题/);
    check(!!shown && Number(shown[1]) === after + 1,
      `界面显示与内部状态不一致：状态在第 ${after + 1} 题，界面显示第 ${shown ? shown[1] : '?'} 题`);
  }

  /* 回到上一题改答案，应当只前进一格（而不是因为"已答过"就停住或跳两格） */
  const beforeBack = APP._t.getRun().idx;
  bubble(findReal('#btn-prev'), 'click');
  flush();
  check(APP._t.getRun().idx === beforeBack - 1, '点「上一题」应当只后退一格');
  const beforeRe = APP._t.getRun().idx;
  clickOption(host, 1);
  check(APP._t.getRun().idx === beforeRe + 1,
    `回头改答案后应只前进一格，实际前进 ${APP._t.getRun().idx - beforeRe} 格`);
  const btnNext = findReal('#btn-next');
  if (btnNext) { bubble(btnNext, 'click'); flush(); }
  check(APP._t.getRun().idx === beforeRe + 2, '点「下一题」应当只前进一格');

  /* 键盘数字键也必须只前进一格 */
  const beforeKey = APP._t.getRun().idx;
  bubble(document, 'keydown', { key:'2' });
  flush();
  check(APP._t.getRun().idx === beforeKey + 1,
    `键盘选选项后应只前进一格，实际前进 ${APP._t.getRun().idx - beforeKey} 格`);

  /* 连续快速点击同一个选项（抖动）也只前进一格 */
  const beforeSpam = APP._t.getRun().idx;
  const spamHost = findReal('#qhost');
  for (let k = 0; k < 5; k++) {
    const opt = spamHost.querySelector('.opt[data-o="0"]');
    if (opt) { bubble(opt, 'click'); const inp = opt.querySelector('input'); if (inp) bubble(inp, 'click'); }
  }
  flush();
  check(APP._t.getRun().idx === beforeSpam + 1,
    `连续抖动点击应只前进一格，实际前进 ${APP._t.getRun().idx - beforeSpam} 格`);

  /* 病态情况：一次激活派发两个 click（label 包装 radio 时浏览器就会这样），
     这正是用户报告的"答完第 x 题跳到第 x+2 题"的成因。必须仍然只前进一格。 */
  const doubleHost = findReal('#qhost');
  const beforeDouble = APP._t.getRun().idx;
  const dOpt = doubleHost.querySelector('.opt[data-o="1"]');
  check(!!dOpt, '双事件用例找不到可点击的选项');
  if (dOpt) {
    bubble(dOpt, 'click');
    bubble(dOpt, 'click');
    flush();
    check(APP._t.getRun().idx === beforeDouble + 1,
      `一次激活派发两个 click 时仍应只前进一格，实际前进 ${APP._t.getRun().idx - beforeDouble} 格`);
  }

  /* 迟到的重复事件：已经翻到下一题之后，才收到针对上一题的重复 click —— 必须被忽略 */
  const lateFrom = APP._t.getRun().idx;
  const lateHost = findReal('#qhost');
  const staleOpt = lateHost.querySelector('.opt[data-o="0"]');   // 当前这一题的选项
  const staleIndex = lateFrom;
  if (staleOpt) {
    bubble(staleOpt, 'click');           // 正常回答，安排翻页
    APP._t.getRun().idx = staleIndex + 1; // 模拟"翻页已经发生"
    bubble(staleOpt, 'click');           // 迟到事件，携带的是旧题号
    flush();
    check(APP._t.getRun().idx === staleIndex + 1,
      `针对已翻过去那一题的迟到事件应被忽略，实际停在第 ${APP._t.getRun().idx + 1} 题`);
  }
}

/* ============================ 5. 中译说明 / 英文源站说明 ============================ */
/* (a) 标记了 zhFrom='en' 的条目：页面上必须有「中译说明」+「可能破坏原意」的提示，
       卡片上必须有「中译」标识，结果页也要复述一次。 */
const zhTests = A.tests.filter((t) => t.zhFrom === 'en');
check(zhTests.length >= 4, `标记为英文原版中译的条目过少：${zhTests.length}`);
zhTests.forEach((t) => {
  global.location.hash = '#/test/' + t.id;
  const html = renderPage('中译说明:' + t.id, () => APP.route());
  check(html.indexOf('中译说明') > -1, `${t.id} 页面上没有「中译说明」`);
  check(html.indexOf('可能小部分破坏原意') > -1, `${t.id} 的中译说明里没有「可能小部分破坏原意」的提示`);
  check(html.indexOf('原文') > -1 || html.indexOf('英文原版') > -1, `${t.id} 的中译说明没有指向英文原版`);
  check(html.indexOf('id="runner"') > -1, `${t.id} 既然提供了中文版就应当可以站内作答`);
  /* 卡片标识 */
  const card = APP._t.viewCat(t.cat);
  check(card.indexOf('title="站内中文题本译自英文原版，中译可能小部分破坏原意"') > -1,
    `${t.id} 所在分类页的卡片上没有「中译」标识`);
  /* 结果页复数一次 */
  const ans = A.questions(t).map(() => 0);
  APP._t.setRun(t, ans);
  const rh = APP._t.resultHtml(t, A.score(t, ans));
  check(rh.indexOf('中译说明') > -1, `${t.id} 的结果页没有复述中译说明`);
  check(rh.indexOf('偏离原意') > -1, `${t.id} 的结果页中译说明没有提到偏离原意`);
});
/* 所有"从英文原版翻译"的条目都必须是可作答的，且题目数是真实值 */
zhTests.forEach((t) => {
  check(t._n > 0, `${t.id} 标记了中译版但没有题目`);
  check(t._acc.hasBuiltin, `${t.id} 标记了中译版但不是站内可作答`);
});

/* (b) 英文源站、无同量表中文自建版的条目：必须有说明 + 站内中文替代 */
const enNotes = Object.keys(A.enOnlyNotes || {});
check(enNotes.length >= 15, `英文源站说明登记过少：${enNotes.length}`);
enNotes.forEach((id) => {
  global.location.hash = '#/test/' + id;
  const html = renderPage('英文源站说明:' + id, () => APP.route());
  const t = APP.INDEX[id];
  if (!t) { errors.push(`英文源站说明登记了不存在的 ${id}`); return; }
  check(html.indexOf('en-notice') > -1, `${id} 页面上没有英文源站说明区块`);
  check(/英文|英语|注册|施测者|图形|自编/.test(html),
    `${id} 的说明里没有点出无法自建的具体原因（应为英文界面 / 需注册 / 施测者工具 / 图形题 / 商业自编题本之一）`);
  const alt = t.zhAlt || [];
  check(alt.length > 0, `${id} 没有给出站内中文替代`);
  alt.forEach((a) => {
    const x = APP.INDEX[a];
    check(!!x, `${id} 的中文替代 "${a}" 不存在`);
    if (x) {
      check(html.indexOf('#/test/' + a) > -1, `${id} 的页面上没有列出中文替代 ${a} 的入口`);
      check(A.access(x).hasBuiltin || x.zhFrom, `${id} 的中文替代 "${a}" 本身不是站内可作答的中文测试`);
    }
  });
});
/* 卡片上要有「英文源站」标识 */
enNotes.forEach((id) => {
  const t = APP.INDEX[id]; if (!t) return;
  const card = APP._t.viewCat(t.cat);
  check(card.indexOf('英文源站') > -1, `${id} 所在分类页的卡片上没有「英文源站」标识`);
});

/* ============================ 6. 每个测试页 ============================ */
let builtinPages = 0, linkPages = 0, refPages = 0;
A.tests.forEach((t) => {
  global.location.hash = '#/test/' + t.id;
  const html = renderPage('测试页:' + t.id, () => APP.route());
  check(html.indexOf(t.cn) > -1, `测试页 ${t.id} 没有显示标题`);
  /* 每个页面都必须展示出处与使用条件 */
  check(html.indexOf('出处与使用条件') > -1, `测试页 ${t.id} 缺少「出处与使用条件」栏`);
  if (t.access === 'builtin' || t.access === 'both') {
    builtinPages++;
    if (t.q && t.q.length) {
      check(html.indexOf('id="runner"') > -1, `测试页 ${t.id} 没有答题器容器`);
      check(html.indexOf('id="qhost"') > -1, `测试页 ${t.id} 没有题目容器`);
      check(html.indexOf('q-block') > -1, `测试页 ${t.id} 没有渲染出题目`);
      check(html.indexOf('查看结果') > -1, `测试页 ${t.id} 缺少「查看结果」按钮`);
      check(html.indexOf('逐题作答') > -1, `测试页 ${t.id} 缺少作答模式切换`);
      /* 绝对不能在作答界面显示选项分值——那是计分用的内部映射，渲染出来就泄露答案。
         CRT-7 的 v=[0,1,0,0] 会把正确答案直接圈出来；AQ-10 的 [0,0,1,1]、
         RAADS-R 的 [3,2,1,0]、EAT-26 的 [3,2,1,0,0,0] 会同时泄露方向与正误。 */
      check(html.indexOf('class="val"') < 0, `测试页 ${t.id} 在选项上渲染了分值，会泄露答案或计分方向`);
      const optHtml = html.slice(html.indexOf('id="qhost"'), html.indexOf('id="qhost"') + 4000);
      check(!/\d+\s*分<\/span>/.test(optHtml), `测试页 ${t.id} 的选项里出现了"几分"字样`);
    }
    /* 收录规则 ①：源站可访问且免费的条目，必须把官方网址直接贴出来 */
    if (t.access === 'both') {
      check(html.indexOf('收录规则 ①') > -1, `dual 条目 ${t.id} 没有按规则 ① 标出源站可访问且免费`);
      check(html.indexOf('前往源站作答') > -1, `dual 条目 ${t.id} 没有醒目的「前往源站作答」入口`);
      check(!!t.link && html.indexOf(escAttr(t.link)) > -1, `dual 条目 ${t.id} 页面上没有展示源站网址`);
    }
  } else if (t.access === 'link') { linkPages++; check(html.indexOf('前往源站') > -1, `外链条目 ${t.id} 没有「前往源站」按钮`); }
  else { refPages++; check(html.indexOf('无法自建') > -1 || html.indexOf('说明性收录') > -1 || html.indexOf('仅作收录说明') > -1, `说明性条目 ${t.id} 没有解释为什么不自建`); }
});
check(builtinPages >= 80, `站内可做页面数异常：${builtinPages}`);
check(linkPages >= 20, `外链页面数异常：${linkPages}`);
check(refPages >= 15, `说明性条目数异常：${refPages}`);

/* ============================ 8. 答案泄露回归（选项分值） ============================
   用户报告：CRT-7 等测试直接显示了选项分值。q.v 是计分用的内部映射，
   渲染出来等于把答案（CRT-7 的 [0,1,0,0]）或计分方向（RAADS-R 的 [3,2,1,0]）告诉作答者。
   ================================================================================== */
['crt-7', 'aq-10', 'raads-r', 'eat-26', 'ftnd', 'audit', 'psqi'].forEach((id) => {
  const t = APP.INDEX[id];
  if (!t) { errors.push(`答案泄露回归：找不到 ${id}`); return; }
  global.location.hash = '#/test/' + id;
  const html = renderPage('答案泄露:' + id, () => APP.route());
  check(html.indexOf('class="val"') < 0, `${id} 在作答界面渲染了选项分值`);
  const host = findReal('#qhost');
  if (!host) { errors.push(`答案泄露回归：${id} 找不到题目容器`); return; }
  const opts = host.querySelectorAll('.opt');
  check(opts.length > 0, `${id} 没有渲染出选项`);
  /* 同一题内的选项必须完全对称：除了文字，不能有任何区分正确项的信息 */
  const byQ = {};
  opts.forEach((o) => {
    const blk = o.closest('.q-block');
    const qi = blk ? blk.getAttribute('data-i') : '?';
    (byQ[qi] = byQ[qi] || []).push(o);
  });
  Object.keys(byQ).forEach((qi) => {
    const group = byQ[qi];
    const sig = (o) => o.childNodes.filter((c) => c.nodeType === 1)
      .map((c) => c.tagName + ':' + (c.getAttribute('class') || '')).join('|');
    const first = sig(group[0]);
    group.slice(1).forEach((o, k) => {
      check(sig(o) === first,
        `${id} 第 ${Number(qi) + 1} 题的选项结构不对称（第 ${k + 2} 个与其他不同），可能泄露答案`);
    });
    /* 属性里也不能带分值（data-o 是选项序号，不算） */
    group.forEach((o, k) => {
      const leak = o.attributes.filter((a) => a.name !== 'data-o' && /\d/.test(a.value));
      check(leak.length === 0,
        `${id} 第 ${Number(qi) + 1} 题第 ${k + 1} 个选项的属性里带了数字：${leak.map((a) => a.name + '=' + a.value).join(', ')}`);
    });
  });
});

/* 知识型测试（有客观正确答案）应当只在结果页、且默认折叠时才揭示答案 */
{
  const t = APP.INDEX['crt-7'];
  check(t && t.revealAnswers === true, 'CRT-7 应当开启 revealAnswers，让用户在交卷后能看到正确答案');
  const right = A.questions(t).map((q) => q.v.indexOf(Math.max.apply(null, q.v)));
  APP._t.setRun(t, right);
  const allRight = APP._t.resultHtml(t, A.score(t, right));
  check(allRight.indexOf('✓ 正确') > -1, 'CRT-7 全对时结果页没有逐题标出正确');
  check(allRight.indexOf('正确答案：') < 0, 'CRT-7 全对时不应出现"正确答案"提示');
  check(allRight.indexOf('<details') > -1, 'CRT-7 的答案回顾应当默认折叠');
  const wrong = right.map((r) => (r + 1) % 4);
  APP._t.setRun(t, wrong);
  const allWrong = APP._t.resultHtml(t, A.score(t, wrong));
  check(allWrong.indexOf('正确答案：') > -1, 'CRT-7 答错时结果页没有给出正确答案');
  /* 症状类量表一律不做对错判定 */
  const sym = APP.INDEX['phq-9'];
  APP._t.setRun(sym, sym.q.map(() => 0));
  const symHtml = APP._t.resultHtml(sym, A.score(sym, sym.q.map(() => 0)));
  check(symHtml.indexOf('正确答案：') < 0 && symHtml.indexOf('✓ 正确') < 0,
    '症状类量表（PHQ-9）不应出现对错判定');
}

/* ============================ 9. 分档参照完整性（不截断） ============================
   用户报告：结果页的「分档参照」被截断。根因是渲染时对说明列调用了 stripShort()，
   把每一档的判读文本砍到 60 字。这张表的意义就是把计分规则与判读完整公开，
   截断等于把最有用的部分删掉。这里逐条断言每一档的文本都完整出现在结果页里。
   ================================================================================== */
const stripTags = (s) => String(s).replace(/<[^>]*>/g, '');
let rangeRows = 0;
A.tests.forEach((t) => {
  if (!t.q || !t.q.length || !t.score) return;
  const qs = A.questions(t);
  /* 用三种作答各跑一遍，覆盖不同 levelIdx */
  const variants = [
    qs.map((x) => A.qOptions(t, x).length - 1),
    qs.map(() => 0),
    qs.map((x) => Math.floor((A.qOptions(t, x).length - 1) / 2))
  ];
  variants.forEach((ans, vi) => {
    const res = A.score(t, ans);
    if (!res.ranges || !res.ranges.length) return;
    APP._t.setRun(t, ans);
    const html = APP._t.resultHtml(t, res);
    const plain = stripTags(html);
    res.ranges.forEach((r, i) => {
      const full = stripTags(r[2] || '');
      if (!full) return;
      rangeRows++;
      /* 取文本尾部作为特征片段：截断时尾部必然缺失 */
      const tail = full.length > 14 ? full.slice(-14) : full;
      check(plain.indexOf(tail) > -1,
        `${t.id} 分档参照第 ${i + 1} 档的说明被截断（缺少结尾片段「…${tail}」）`);
      /* 也不能出现截断省略号 */
      check(plain.indexOf(full.slice(0, 30) + '…') < 0,
        `${t.id} 分档参照第 ${i + 1} 档的说明带截断省略号`);
    });
  });
});
check(rangeRows > 300, `分档参照校验覆盖面过小：只检查了 ${rangeRows} 行`);

/* ============================ 10. 结果页 ============================ */
let resultOk = 0;
A.tests.forEach((t) => {
  if (!t.q || !t.q.length) return;
  const qs = A.questions(t);
  const variants = [
    qs.map((x) => A.qOptions(t, x).length - 1),
    qs.map(() => 0),
    qs.map((x, i) => (A.qOptions(t, x).length - 1) * (i % 3) / 2 | 0)
  ];
  variants.forEach((ans, vi) => {
    const label = `结果页:${t.id}#${vi}`;
    try {
      const res = A.score(t, ans);
      APP._t.setRun(t, ans);
      const html = APP._t.resultHtml(t, res);
      resultOk++;
      check(html.indexOf('result-head') > -1, `${label} 缺少结果头`);
      check(html.indexOf('免责声明') > -1, `${label} 缺少免责声明`);
      check(html.indexOf('复制结果') > -1, `${label} 缺少操作按钮`);
      /* 结果头必须有非空标题 */
      check(/<div class="rbig[^"]*">[^<]*\S/.test(html), `${label} 结果标题为空`);
      /* 不允许出现未替换的 undefined / NaN */
      check(html.indexOf('undefined') < 0, `${label} 渲染结果里出现 undefined`);
      check(html.indexOf('NaN') < 0, `${label} 渲染结果里出现 NaN`);
      check(html.indexOf('[object Object]') < 0, `${label} 渲染结果里出现 [object Object]`);
      /* HTML 标签闭合粗检 */
      const opens = (html.match(/<div\b/g) || []).length, closes = (html.match(/<\/div>/g) || []).length;
      check(opens === closes, `${label} <div> 标签不配对（${opens} 开 / ${closes} 闭）`);
      const ul = (html.match(/<ul\b/g) || []).length, ulc = (html.match(/<\/ul>/g) || []).length;
      check(ul === ulc, `${label} <ul> 标签不配对`);
      const tb = (html.match(/<table\b/g) || []).length, tbc = (html.match(/<\/table>/g) || []).length;
      check(tb === tbc, `${label} <table> 标签不配对`);
    } catch (e) {
      errors.push(`${label} 抛出异常：${e.message}`);
    }
  });
});

/* ============================ 4. 搜索 ============================ */
const sq = [
  ['phq', 'phq-9'], ['PHQ-9', 'phq-9'], ['抑郁', null], ['依恋', null],
  ['大五', null], ['拖延', null], ['mbti', null], ['IPIP', null], ['不存在的测试xyz', null]
];
sq.forEach(([term, expect]) => {
  const r = render('搜索:' + term, () => APP._t.search(term));
  check(Array.isArray(r), `搜索「${term}」返回值不是数组`);
  if (expect) check(r.some((x) => x.id === expect), `搜索「${term}」没有命中 ${expect}`);
  if (term.indexOf('不存在') > -1) check(r.length === 0, `搜索「${term}」应当无结果，实际 ${r.length} 条`);
});
check(APP._t.search('抑郁').length > 0, '搜索「抑郁」无结果');

/* ============================ 5. 记录页（写入后） ============================ */
global.localStorage.setItem('att.history.v1', JSON.stringify([
  { id:'phq-9', cn:'抑郁筛查量表（PHQ-9）', at: Date.now(), headline:'轻度抑郁症状', sub:'7 / 27 分' },
  { id:'fun-slack', cn:'摸鱼指数测试', at: Date.now(), headline:'资深摸鱼人', sub:'30 分' }
]));
global.location.hash = '#/mine';
const mineHtml = renderPage('我的记录(有数据)', () => APP.route());
check(mineHtml.indexOf('PHQ-9') > -1, '记录页没有显示历史记录');
check(mineHtml.indexOf('清空记录') > -1, '记录页没有清空按钮');
check(mineHtml.indexOf('btn-reset-consent') > -1, '记录页没有「重置首测确认」按钮');
/* 重置按钮应当真的把确认状态清掉，让首测说明再次出现 */
const resetBtn = findReal('#btn-reset-consent');
check(!!resetBtn, '找不到「重置首测确认」按钮');
if (resetBtn) {
  resetBtn.dispatch('click');
  check(localStorage.getItem(CONSENT_KEY) == null, '点击重置后首测确认状态没有被清除');
  global.location.hash = '#/test/rosenberg';
  const regated = renderPage('重置后再次弹门', () => APP.route());
  check(regated.indexOf('id="consent-gate"') > -1, '重置后进入测试应当重新要求确认');
  localStorage.setItem(CONSENT_KEY, 'yes');   // 恢复，避免影响后续断言
}

/* ============================ 6. 数据交叉引用 ============================ */
A.clusters.forEach((cl, i) => {
  (cl.keep || []).forEach((k) => {
    check(!!APP.INDEX[k], `去重簇#${i + 1} keep 引用了不存在的测试 ${k}`);
  });
});
/* 每个自建测试都必须能在某个去重簇里被解释，或被明确标注为独立条目 */
const clustered = new Set();
A.clusters.forEach((cl) => (cl.keep || []).forEach((k) => clustered.add(k)));
check(clustered.size >= 30, `去重簇覆盖的条目过少：${clustered.size}`);

/* ============================ 12. 作者信息与资源文件 ============================ */
/* 静态入口文件（不经过 main.innerHTML，所以单独读文件校验） */
const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
['FZYZ LSY', 'assets/img/author-logo-96.png', 'assets/img/author-logo-256.png'].forEach((n) => {
  check(htmlSrc.indexOf(n) > -1, `index.html 里缺少作者信息或标识引用：${n}`);
});
check(/<meta name="author"[^>]*FZYZ LSY/.test(htmlSrc), 'index.html 缺少 author meta 标签');
['AuthorLogo.png', 'assets/img/author-logo-96.png', 'assets/img/author-logo-256.png'].forEach((f) => {
  check(fs.existsSync(path.join(ROOT, f)), `缺少作者标识资源文件：${f}`);
});
/* 原图必须还在（不应被优化副本取代） */
if (fs.existsSync(path.join(ROOT, 'AuthorLogo.png'))) {
  const sz = fs.statSync(path.join(ROOT, 'AuthorLogo.png')).size;
  check(sz > 100 * 1024, `AuthorLogo.png 原图疑似被覆盖为小文件（${sz} 字节）`);
}

/* 关于页 */
global.location.hash = '#/about';
const aboutHtml = renderPage('关于页(作者)', () => APP.route());
check(aboutHtml.indexOf('FZYZ LSY') > -1, '关于页没有作者署名');
check(aboutHtml.indexOf('author-logo-256.png') > -1, '关于页没有作者标识图');
check(aboutHtml.indexOf('创作者') > -1, '关于页没有说明作者身份');
check(aboutHtml.indexOf(REQUIRED_CONSENT_TEXT) > -1, '关于页没有复述那句必须逐字出现的须知文字');

/* 结果页署名 */
const progT = APP.INDEX['phq-9'];
const progAns = progT.q.map(() => 0);
APP._t.setRun(progT, progAns);
const rHtml = APP._t.resultHtml(progT, A.score(progT, progAns));
check(rHtml.indexOf('author-sign') > -1, '结果页没有作者署名区块');
check(rHtml.indexOf('FZYZ LSY') > -1, '结果页署名里没有作者名');
check(rHtml.indexOf('author-logo-96.png') > -1, '结果页署名里没有作者标识图');

/* ============================ 输出 ============================ */
console.log('══════════════════════════════════════════════════════════════');
console.log(' All The Tests — 渲染冒烟测试报告');
console.log('══════════════════════════════════════════════════════════════');
console.log(` 路由页面渲染      ${pages.length} 个 + ${A.cats.length} 个分类页 + 2 个错误页`);
console.log(` 首测同意门        3 种条目形态（both / builtin / link）+ ref 免门 + 完整交互链路`);
console.log(` 中译 / 英文源站   ${zhTests.length} 个中译自建版（页面+卡片+结果页三处提示）+ ${enNotes.length} 条英文源站说明`);
console.log(` 作者信息与资源    index.html / 关于页 / 结果页署名 / 3 个标识文件`);
console.log(` 测试详情页渲染    ${A.tests.length} 个（自建 ${builtinPages} / 外链 ${linkPages} / 说明 ${refPages}）`);
console.log(` 结果页渲染        ${resultOk} 次（每个量表 × 3 种作答）`);
console.log(` 搜索用例          ${sq.length} 组`);
console.log(` 断言总数          ${checks}`);
console.log('──────────────────────────────────────────────────────────────');
if (errors.length) {
  console.log(` ✘ 失败 ${errors.length} 项：`);
  errors.slice(0, 40).forEach((e) => console.log('   - ' + e));
  if (errors.length > 40) console.log(`   …… 另有 ${errors.length - 40} 项`);
  console.log('══════════════════════════════════════════════════════════════');
  process.exit(1);
}
console.log(' ✔ 全部通过：所有页面与结果页均可正常渲染，无异常、无空标题、');
console.log('   无 undefined/NaN 泄漏、标签配对正常、搜索可用；');
console.log('   首测知情同意门逐字文案与拦截行为、中译说明与英文源站说明均已验证。');
console.log('══════════════════════════════════════════════════════════════');
