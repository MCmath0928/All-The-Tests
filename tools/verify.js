/* ==========================================================================
   All The Tests — 数据集自检脚本（Node，无需浏览器）
   用法： node tools/verify.js
   检查项：schema 完整性 / id 唯一性 / 分类与来源引用 / 选项与分值一致性 /
           计分分档覆盖 / 维度题目归属 / 类型学标题完整性 / 全量答题模拟
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
  'assets/js/data/fun.js'
];

/* ---- 最小 DOM 垫片：engine 顶层的 A.safe 只在调用时才用到 document ---- */
global.window = global.window || {};
global.document = { createElement: () => { throw new Error('verify 不应调用 DOM'); } };

for (const f of FILES) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.error('缺少文件：' + f); process.exit(2); }
  try {
    // eslint-disable-next-line no-eval
    (0, eval)(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error('加载失败 ' + f + '\n' + e.stack);
    process.exit(2);
  }
}

const A = global.window.ATT;
const errors = [];
const warns = [];
const E = (m) => errors.push(m);
const W = (m) => warns.push(m);

/* ====================== 1. 基础结构 ====================== */
const catIds = new Set(A.cats.map((c) => c.id));
const catDup = A.cats.map((c) => c.id).filter((x, i, a) => a.indexOf(x) !== i);
if (catDup.length) E('分类 id 重复：' + catDup.join(', '));
if (!A.sources || !Object.keys(A.sources).length) E('来源登记表为空');
if (!A.clusters || !A.clusters.length) E('去重簇为空');

/* ====================== 2. 逐条测试校验 ====================== */
const ids = new Map();
const TESTS = A.tests;
const SCORE_TYPES = ['sum', 'mean', 'dims', 'type', 'most', 'fn'];
const ACCESS = ['link', 'builtin', 'both', 'ref'];

TESTS.forEach((t, ti) => {
  const tag = t.id || ('#' + ti);

  /* 基本字段 */
  ['id', 'cn', 'en', 'cat', 'access', 'desc', 'intro', 'creator', 'license'].forEach((k) => {
    if (t[k] == null || t[k] === '') E(`${tag}: 缺少字段 ${k}`);
  });
  if (!catIds.has(t.cat)) E(`${tag}: 分类 "${t.cat}" 不存在`);
  if (ACCESS.indexOf(t.access) < 0) E(`${tag}: access "${t.access}" 非法`);

  /* id 唯一 */
  if (ids.has(t.id)) E(`${tag}: id 与第 ${ids.get(t.id)} 条重复`);
  else ids.set(t.id, ti);

  /* 来源引用 */
  (t.srcs || []).forEach((k) => {
    if (!A.sources[k]) E(`${tag}: 引用了未登记的来源 "${k}"`);
  });

  /* 外链条目应有链接 */
  if ((t.access === 'link' || t.access === 'ref') && !t.link) {
    W(`${tag}: access=${t.access} 但没有 link 字段`);
  }
  if (t.link && !/^https?:\/\//.test(t.link)) E(`${tag}: link 不是 http(s) 地址：${t.link}`);
  Object.keys(A.sources).forEach((k) => {
    const s = A.sources[k];
    if (!/^https?:\/\//.test(s.url || '')) E(`来源 ${k}: url 非法`);
    if (typeof s.cn !== 'boolean' || typeof s.free !== 'boolean') E(`来源 ${k}: 缺少 cn/free 布尔标记`);
  });

  /* 需自建的条目必须有题 */
  const needsItems = t.access === 'builtin' || t.access === 'both';
  if (needsItems && !(t.q && t.q.length)) { E(`${tag}: access=${t.access} 但没有题目`); return; }
  if (!t.q || !t.q.length) return;

  /* 题目结构 */
  const qs = A.questions(t);
  if (!t.scale && !qs.some((q) => q.o)) E(`${tag}: 既没有 scale 也没有逐题选项`);

  qs.forEach((q, qi) => {
    const p = `${tag} 第 ${qi + 1} 题`;
    if (!q.t || !String(q.t).trim()) E(`${p}: 题干为空`);
    if (q.o) {
      if (!Array.isArray(q.o) || q.o.length < 2) E(`${p}: 选项数组非法`);
      if (q.v && q.v.length !== q.o.length) E(`${p}: v 长度(${q.v.length}) != o 长度(${q.o.length})`);
      if (q.k && q.k.length !== q.o.length) E(`${p}: k 长度(${q.k.length}) != o 长度(${q.o.length})`);
      q.o.forEach((o) => { if (!o || !String(o).trim()) E(`${p}: 存在空选项`); });
    } else if (!t.scale) {
      E(`${p}: 没有可用选项`);
    }
  });

  /* 计分校验 */
  const sc = t.score;
  if (!sc) { E(`${tag}: 缺少 score`); return; }
  if (SCORE_TYPES.indexOf(sc.type) < 0 && typeof sc.fn !== 'function') {
    E(`${tag}: score.type "${sc.type}" 非法`);
  }

  const maxTotal = A.maxTotal(t);
  const itemMax = Math.max.apply(null, qs.filter((q) => !q.noScore).map((q) => A.qMax(t, q)));

  function checkRanges(label, ranges, ceiling) {
    if (!Array.isArray(ranges) || !ranges.length) { E(`${label}: ranges 为空`); return; }
    let prev = -Infinity;
    ranges.forEach((r, i) => {
      if (!Array.isArray(r) || r.length < 2) { E(`${label}: ranges[${i}] 结构非法`); return; }
      if (typeof r[0] !== 'number') E(`${label}: ranges[${i}][0] 必须为数字`);
      if (r[0] <= prev) E(`${label}: ranges 未严格递增（第 ${i + 1} 档 ${r[0]}）`);
      prev = r[0];
      if (!r[1]) E(`${label}: ranges[${i}] 缺少判定名`);
    });
    const last = ranges[ranges.length - 1][0];
    if (ceiling != null && last < ceiling) {
      E(`${label}: 最高档上限 ${last} < 实际最高分 ${ceiling}，满分将落不到合适档位`);
    }
    if (ceiling != null && ranges.length > 1 && ranges[0][0] >= ceiling) {
      W(`${label}: 最低档上限 ${ranges[0][0]} 已接近满分 ${ceiling}`);
    }
  }

  if (sc.type === 'sum') checkRanges(tag + ' sum', sc.ranges, maxTotal);
  if (sc.type === 'mean') checkRanges(tag + ' mean', sc.ranges, itemMax);

  if (sc.type === 'dims') {
    if (!sc.dims) { E(`${tag}: score.type=dims 但没有 dims 定义`); }
    else {
      const declared = Object.keys(sc.dims);
      const used = new Set(qs.filter((q) => q.d).map((q) => q.d));
      used.forEach((u) => { if (declared.indexOf(u) < 0) E(`${tag}: 题目维度 "${u}" 未在 score.dims 中定义`); });
      declared.forEach((k) => {
        const def = sc.dims[k];
        let sum = 0, n = 0;
        qs.forEach((q) => { if (q.d === k && !q.noScore) { sum += A.qMax(t, q); n++; } });
        if (!n) { E(`${tag}: 维度 "${k}" 没有任何题目归属`); return; }
        const factor = def.factor || 1;
        const realMax = sum * factor;
        if (def.max == null) W(`${tag}: 维度 "${k}" 未声明 max，实际最高 ${realMax}`);
        else if (def.max < realMax) E(`${tag}: 维度 "${k}" 声明 max=${def.max} 小于实际最高 ${realMax}`);
        else if (def.max > realMax) W(`${tag}: 维度 "${k}" 声明 max=${def.max} 大于实际最高 ${realMax}（分档可能永远打不到）`);
        if (def.ranges) {
          const last = def.ranges[def.ranges.length - 1][0];
          if (last < realMax) E(`${tag}: 维度 "${k}" 最高档上限 ${last} < 实际最高 ${realMax}`);
          checkRanges(`${tag} 维度 ${k}`, def.ranges, null);
        }
      });
    }
  }

  if (sc.type === 'sum' && sc.dims) {
    Object.keys(sc.dims).forEach((k) => {
      const def = sc.dims[k];
      let sum = 0;
      qs.forEach((q) => { if (q.d === k && !q.noScore) sum += A.qMax(t, q); });
      const real = sum * (def.factor || 1);
      if (def.max == null) W(`${tag}: 附加维度 "${k}" 未声明 max（实际 ${real}）`);
      else if (def.max !== real) E(`${tag}: 附加维度 "${k}" 声明 max=${def.max} 与实际 ${real} 不一致`);
    });
  }

  if (sc.type === 'type') {
    if (!sc.axes) E(`${tag}: score.type=type 但没有 axes`);
    else {
      const axes = Object.keys(sc.axes);
      axes.forEach((ax) => {
        const def = sc.axes[ax];
        ['neg', 'pos', 'cn'].forEach((k) => { if (!def[k]) E(`${tag}: 轴 "${ax}" 缺少 ${k}`); });
        if (!def[def.neg] || !def[def.pos]) E(`${tag}: 轴 "${ax}" 缺少 ${def.neg}/${def.pos} 极点定义`);
        const n = qs.filter((q) => q.d === ax).length;
        if (!n) E(`${tag}: 轴 "${ax}" 没有题目`);
        if (n % 2 !== 0) W(`${tag}: 轴 "${ax}" 题目数为奇数(${n})，可能出现判定平局`);
      });
      qs.forEach((q, i) => {
        if (q.d && axes.indexOf(q.d) < 0) E(`${tag}: 第 ${i + 1} 题维度 "${q.d}" 不是有效轴`);
      });
      const combos = [];
      (function gen(p, k) {
        if (k === axes.length) { combos.push(p); return; }
        gen(p + sc.axes[axes[k]].neg, k + 1);
        gen(p + sc.axes[axes[k]].pos, k + 1);
      })('', 0);
      combos.forEach((c) => {
        if (!sc.titles || !sc.titles[c]) E(`${tag}: 缺少类型 "${c}" 的标题`);
      });
    }
  }

  if (sc.type === 'most') {
    if (!sc.opts) E(`${tag}: score.type=most 但没有 opts`);
    else {
      const keys = new Set();
      qs.forEach((q, i) => {
        if (!q.k) E(`${tag} 第 ${i + 1} 题: most 型计分需要 k 数组`);
        else q.k.forEach((k) => keys.add(k));
      });
      keys.forEach((k) => { if (!sc.opts[k]) E(`${tag}: 选项键 "${k}" 未在 opts 中定义`); });
      Object.keys(sc.opts).forEach((k) => {
        if (!keys.has(k)) W(`${tag}: opts 中的 "${k}" 从未被任何选项使用`);
      });
    }
  }

  /* ====================== 3. 全量答题模拟 ====================== */
  try {
    const allMax = qs.map((q) => A.qOptions(t, q).length - 1);
    const allMin = qs.map(() => 0);
    const mid = qs.map((q) => Math.floor((A.qOptions(t, q).length - 1) / 2));
    [allMax, allMin, mid].forEach((ans, si) => {
      const res = A.score(t, ans);
      if (res == null) E(`${tag}: 模拟作答(${['全选最高', '全选最低', '全选中位'][si]}) 返回空`);
      else if (!res.headline && sc.type !== 'dims') W(`${tag}: 模拟作答(${['全选最高', '全选最低', '全选中位'][si]}) 没有 headline`);
      (res.dims || []).forEach((d) => {
        if (d.score > d.max) E(`${tag}: 维度 ${d.key} 得分 ${d.score} 超过 max ${d.max}`);
        if (d.pct < 0 || d.pct > 100) E(`${tag}: 维度 ${d.key} 百分比越界 ${d.pct}`);
      });
      if (res.ranges && res.levelIdx >= res.ranges.length) E(`${tag}: levelIdx 越界`);
    });
  } catch (e) {
    E(`${tag}: 模拟作答抛出异常 —— ${e.message}`);
  }
});

/* ====================== 4.5 中译 / 英文源站登记表校验 ====================== */
const zhFromCount = TESTS.filter((t) => t.zhFrom === 'en').length;
TESTS.filter((t) => t.zhFrom === 'en').forEach((t) => {
  if (!A.access(t).hasBuiltin) E(`${t.id}: 标记了 zhFrom='en' 却没有站内可作答的中文题本`);
  if (!t.q || !t.q.length) E(`${t.id}: 标记了 zhFrom='en' 却没有题目`);
});
if (zhFromCount < 4) W(`标记为中译版的条目只有 ${zhFromCount} 条，确认是否遗漏`);
checkNoOrphan: {
  const notes = A.enOnlyNotes || {};
  Object.keys(notes).forEach((id) => {
    const t = TESTS.find((x) => x.id === id);
    if (!t) { E(`A.enOnlyNotes 里的 "${id}" 在数据集中不存在`); return; }
    const n = notes[id];
    if (!n.title) E(`A.enOnlyNotes["${id}"] 缺少 title`);
    if (!n.note || n.note.length < 30) E(`A.enOnlyNotes["${id}"] 的说明太短，需要解释为什么不自建`);
    if (!Array.isArray(n.alt) || !n.alt.length) E(`A.enOnlyNotes["${id}"] 必须给出至少一个站内中文替代测试`);
    (n.alt || []).forEach((a) => {
      const x = TESTS.find((y) => y.id === a);
      if (!x) { E(`A.enOnlyNotes["${id}"].alt 引用了不存在的测试 "${a}"`); return; }
      if (!A.access(x).hasBuiltin) E(`A.enOnlyNotes["${id}"].alt 里的 "${a}" 不是站内可作答的中文测试`);
      if (a === id) E(`A.enOnlyNotes["${id}"].alt 不能指向自己`);
    });
    if (t.access === 'ref') W(`"${id}" 已经是 ref 说明性条目，通常不需要再登记 enOnlyNotes`);
  });
  /* 反向：外链是英文站、又没有中文自建版的条目，应当被登记 */
  const hasZhSrc = (t) => (t.srcs || []).some((k) => A.sources[k] && A.sources[k].zh);
  const langless = TESTS.filter((t) => t.access === 'link' && !t.zhFrom && !notes[t.id] && !hasZhSrc(t));
  if (langless.length) W(`以下外链条目既没有中文自建版、也没登记英文源站说明：${langless.map((t) => t.id).join('、')}`);
  const zhLink = TESTS.filter((t) => t.access === 'link' && hasZhSrc(t) && !notes[t.id]);
  console.log(` 中文界面外链      ${zhLink.length}（无需另建中文版：${zhLink.map((t) => t.id).join('、')}）`);
  console.log(` 中译自建版        ${zhFromCount}（${TESTS.filter((t) => t.zhFrom === 'en').map((t) => t.id).join('、')}）`);
  console.log(` 英文源站说明登记  ${Object.keys(notes).length} 条`);
}

/* ====================== 5. 去重簇校验 ====================== */
A.clusters.forEach((cl, i) => {
  const p = `去重簇#${i + 1}(${cl.title || '未命名'})`;
  if (!cl.title || !cl.why) E(`${p}: 缺少 title/why`);
  if (!cl.keep || !cl.keep.length) E(`${p}: 没有 keep 列表`);
  (cl.keep || []).forEach((k) => { if (!ids.has(k)) E(`${p}: keep 中的 "${k}" 在数据集中不存在`); });
  (cl.merged || []).forEach((m) => {
    if (ids.has(m) && (cl.keep || []).indexOf(m) < 0) {
      W(`${p}: "${m}" 既被列为已合并、又作为独立条目存在`);
    }
  });
});

/* ====================== 5. 汇总统计 ====================== */
const byCat = {};
A.cats.forEach((c) => { byCat[c.id] = []; });
TESTS.forEach((t) => { if (byCat[t.cat]) byCat[t.cat].push(t); });
const modOf = (t) => A.access(t).mode;
const count = (f) => TESTS.filter(f).length;

const items = TESTS.reduce((s, t) => s + A.itemCount(t), 0);
const builtinItems = TESTS.filter((t) => A.access(t).hasBuiltin).reduce((s, t) => s + A.itemCount(t), 0);

console.log('══════════════════════════════════════════════════════════════');
console.log(' All The Tests — 数据集自检报告');
console.log('══════════════════════════════════════════════════════════════');
console.log(` 测试条目总数      ${TESTS.length}`);
console.log(`  ├ 站内自建可做   ${count((t) => A.access(t).hasBuiltin)}  （题目合计 ${builtinItems} 道）`);
console.log(`  ├ 免费外链       ${count((t) => modOf(t) === 'link')}`);
console.log(`  ├ 外链 + 自建    ${count((t) => modOf(t) === 'both')}`);
console.log(`  └ 版权受限·说明  ${count((t) => modOf(t) === 'ref')}`);
console.log(` 所有条目题目合计  ${items} 道`);
console.log(` 分类数            ${A.cats.length}`);
console.log(` 登记来源站点      ${Object.keys(A.sources).length}`);
console.log(` 去重判定组        ${A.clusters.length}`);
console.log('──────────────────────────────────────────────────────────────');
console.log(' 按类别：');
A.cats.forEach((c) => {
  const l = byCat[c.id];
  const b = l.filter((t) => A.access(t).hasBuiltin).length;
  const n = l.reduce((s, t) => s + A.itemCount(t), 0);
  console.log(`   ${c.emoji} ${c.cn.padEnd(12, '　')} 条目 ${String(l.length).padStart(2)} · 自建 ${String(b).padStart(2)} · 题目 ${String(n).padStart(4)}`);
});
console.log('──────────────────────────────────────────────────────────────');
const emptyCats = A.cats.filter((c) => !byCat[c.id].length);
if (emptyCats.length) W('空分类：' + emptyCats.map((c) => c.cn).join('、'));

if (warns.length) {
  console.log(` ⚠ 警告 ${warns.length} 条：`);
  warns.forEach((w) => console.log('   - ' + w));
  console.log('');
}
if (errors.length) {
  console.log(` ✘ 错误 ${errors.length} 条：`);
  errors.forEach((e) => console.log('   - ' + e));
  console.log('══════════════════════════════════════════════════════════════');
  process.exit(1);
}
console.log(' ✔ 全部校验通过：结构、引用、选项与分值、分档覆盖、维度归属、');
console.log('   类型学标题完整性、全量答题模拟（3 种极端作答）均无错误。');
console.log('══════════════════════════════════════════════════════════════');
