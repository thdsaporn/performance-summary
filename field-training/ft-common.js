/* ft-common.js — ส่วนกลางของระบบประเมินผลฝึกปฏิบัติราชการ (นสต.)
 * ใช้ร่วมกันใน trainee/ mentor/ admin/
 *  1) FT_SYNC  : ซิงก์ข้อมูลข้ามเครื่องผ่าน Google Sheets (Apps Script Web App)
 *  2) FT_CUR / FT_SCORE : หัวข้อและสูตรคะแนนตามหลักสูตร นสต. พ.ศ. 2567 (ใช้ทั้ง 3 หน้า)
 *  3) ftEsc    : ป้องกันข้อความแปลกปลอมแทรกโค้ดในหน้าเว็บ
 *
 * ===== ตั้งค่า =====
 * ใส่ URL ของ Web App (ลงท้าย /exec) ที่ได้จากการติดตั้ง google_apps_script/Code.gs
 * ถ้าเว้นว่าง ระบบจะทำงานแบบเดิม (เก็บข้อมูลเฉพาะในเบราว์เซอร์เครื่องนี้)
 */
var FT_SYNC_URL = 'https://script.google.com/macros/s/AKfycbyLkQvV8yNgGgAqHz0P83LebMRn4trnSQiMG7v2ole3Va4QvxeLX2Ac75ZRN0w39iuQ/exec';

/* ------------------------------------------------------------------ */
function ftEsc(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/[&<>"'`]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c];
  });
}
function ftNewId() {
  return 'log_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/* ===================== FT_CUR / FT_SCORE =====================
 * เกณฑ์การฝึกหัดปฏิบัติราชการ ตามหลักสูตรนักเรียนนายสิบตำรวจ พ.ศ. 2567 (ผนวก ง)
 * - ภาคเรียนที่ 1 เต็ม 450: ความพร้อม 50, งานสารบรรณ 100, การเขียนรายงาน 100, เทคโนโลยีสารสนเทศ 100, มนุษยสัมพันธ์ 50, หลังปฏิบัติ 50
 * - ภาคเรียนที่ 2 เต็ม 400: ความพร้อม 50, สายตรวจ 100, จราจร 100, สืบสวน 100, หลังปฏิบัติ 50
 * - คะแนนรายการ = (จำนวนครั้งที่ทำได้ถูกต้อง × คะแนนเต็มรายการ) ÷ จำนวนครั้งทั้งหมด
 * - เต็ม 850 ผ่านเมื่อ ≥ 510 (ร้อยละ 60) และผ่านทุกประเภทงาน (แต่ละประเภทงาน ≥ ร้อยละ 60)
 * - ระดับ: ร้อยละ 80–100 ผ่าน (ดี), 60–79 ผ่าน (พอใช้), ต่ำกว่า 60 ไม่ผ่าน
 * - บัญชีรวมคะแนน (รบ 4): น้ำหนัก 10% = 310 คะแนน (ค่าน้ำหนัก 310/850 ≈ 0.365)
 */
var FT_CUR = (function () {
  function it(prefix, names) { return names.map(function (n, i) { return { code: prefix + '_' + (i + 1), name: n }; }); }
  var PREP_ITEMS = ['แต่งกายถูกต้องตามระเบียบ', 'ตรงต่อเวลา', 'เครื่องมือ/อุปกรณ์ประจำกาย ครบถ้วนพร้อมใช้งาน'];
  var POST_ITEMS = ['เก็บ, บำรุงรักษาเครื่องมือ/อุปกรณ์/ยานพาหนะ', 'จัดทำบันทึกรายงานผลการปฏิบัติ', 'แลกเปลี่ยนประสบการณ์ในการปฏิบัติงานร่วมกัน'];
  var PREP = PREP_ITEMS.join(', ');
  var POST = POST_ITEMS.join(', ');
  var SEMS = {
    '1': { max: 450, prep: 50, post: 50, cats: [
      { id: 'k1_doc', no: '2.1', name: 'งานสารบรรณ', max: 100,
        items: it('k1_doc', ['พิมพ์ร่างหนังสือ', 'รับหนังสือ', 'ส่งหนังสือ']) },
      { id: 'k1_rep', no: '2.2', name: 'การเขียนรายงานในหน้าที่ตำรวจ', max: 100,
        items: it('k1_rep', ['เขียนบันทึกจับกุม', 'เขียนบันทึกตรวจค้น', 'เขียนรายงานประจำวัน', 'เขียนบันทึกเปรียบเทียบปรับ', 'เขียนรายงานการสืบสวน']) },
      { id: 'k1_it', no: '2.3', name: 'การใช้เทคโนโลยีสารสนเทศ', max: 100,
        items: it('k1_it', ['สืบค้นข้อมูลผ่านเครือข่าย Internet', 'สืบค้นและบันทึกข้อมูล ระบบ POLIS', 'สืบค้นและบันทึกข้อมูล ระบบ CRIMES',
                            'รับ - ส่ง จดหมายอิเล็กทรอนิกส์', 'ใช้งานเครื่องโทรศัพท์', 'ใช้งานเครื่องโทรสาร', 'ใช้งานเครื่องวิทยุสื่อสาร']) },
      { id: 'k1_hr', no: '2.4', name: 'การมีมนุษยสัมพันธ์ที่ดี', max: 50,
        items: it('k1_hr', ['ให้คำแนะนำ/คำปรึกษาที่ดีแก่ประชาชน']) }
    ] },
    '2': { max: 400, prep: 50, post: 50, cats: [
      { id: 'k2_pat', no: '2.1', name: 'การปฏิบัติงานสายตรวจ (รวมการเผชิญเหตุ/ตรวจค้น/จับกุม)', formName: 'การปฏิบัติงานสายตรวจ', breaks: { 4: 'การเผชิญเหตุ/ตรวจค้น/จับกุม' }, max: 100,
        items: it('k2_pat', ['สายตรวจเดินเท้า', 'สายตรวจรถจักรยานยนต์', 'สายตรวจรถยนต์', 'รับแจ้งเหตุ', 'ระงับเหตุ',
                             'ตรวจค้นตัวบุคคล/สถานที่/รถยนต์', 'รักษาสถานที่เกิดเหตุ', 'ตั้งจุดตรวจ/จุดสกัด']) },
      { id: 'k2_trf', no: '2.2', name: 'การปฏิบัติงานด้านจราจร', max: 100,
        items: it('k2_trf', ['อำนวยการจราจรโดยใช้สัญญาณมือ', 'ควบคุมสัญญาณไฟ', 'ใช้กรวยยาง', 'ใช้ไฟฉายกะพริบ', 'ใช้ไซเรน',
                             'ใช้เครื่องตรวจวัดปริมาณแอลกอฮอล์', 'ใช้อุปกรณ์เครื่องตรวจจับความเร็ว', 'จัดการอุบัติเหตุ/เหตุฉุกเฉิน']) },
      { id: 'k2_inv', no: '2.3', name: 'การปฏิบัติงานด้านสืบสวน (รวมการควบคุม/ตรวจสอบ/ดูแลผู้ต้องหา)', formName: 'การปฏิบัติงานด้านสืบสวน', breaks: { 6: 'การควบคุม/ตรวจสอบ/ดูแลผู้ต้องหา' }, max: 100,
        items: it('k2_inv', ['เฝ้าจุด/สังเกตการณ์', 'สะกดรอย/ติดตาม', 'ล่อซื้อ', 'หาข่าว', 'จับกุมผู้ต้องหาตามหมายจับ',
                             'ค้นตัวผู้ต้องหา', 'ใช้เครื่องพันธนาการ', 'ลงบัญชีสิ่งของในการเก็บรักษา',
                             'ควบคุม/ตรวจสอบสิ่งของ อาหารที่ญาติผู้ต้องหานำมาให้', 'นำตัวผู้ต้องหาไปผัดฟ้อง/ฝากขัง']) }
    ] }
  };
  // บันทึกเก่า (เกณฑ์ บช.ศ. 1,160 คะแนน) → ประเภทงานตามหลักสูตร 2567
  var LEGACY = { s1_2_1: 'k1_doc', s1_2_2: 'k1_rep', s1_2_3: 'k1_it', s1_2_4: 'k1_hr',
    s2_2_5: 'k2_pat', s2_2_6: 'k2_inv', s2_2_7: 'k2_pat', s2_2_8: 'k2_pat', s2_2_9: 'k2_pat', s2_2_10: 'k2_pat',
    s2_2_11: 'k2_trf', s2_2_12: 'k2_trf', s2_2_13: 'k2_inv', s2_2_14: 'k2_inv' };
  var byItem = {}, byCat = {};
  Object.keys(SEMS).forEach(function (sem) {
    SEMS[sem].cats.forEach(function (c) {
      c.sem = sem; byCat[c.id] = c;
      c.items.forEach(function (i) { i.cat = c.id; i.sem = sem; byItem[i.code] = i; });
    });
  });
  function catOf(code) {
    if (byItem[code]) return byItem[code].cat;
    if (byCat[code]) return code;
    return LEGACY[code] || null;
  }
  function topicLabel(code) {
    var i = byItem[code];
    if (i) return byCat[i.cat].name.replace(/ \(.*\)$/, '') + ' › ' + i.name;
    var c = byCat[catOf(code)];
    return c ? c.name : String(code || '');
  }
  return { version: 'หลักสูตร นสต. พ.ศ. 2567', total: 850, passScore: 510, weightTotal: 310,
           sems: SEMS, catOf: catOf, cat: function (id) { return byCat[id] || null; }, item: function (c) { return byItem[c] || null; },
           topicLabel: topicLabel, prepText: PREP, postText: POST, prepItems: PREP_ITEMS, postItems: POST_ITEMS };
})();

/* ===================== FT_DAY =====================
 * บันทึกแบบ "1 วัน = 1 แบบฟอร์ม" (แบบประเมินแบบที่ 1)
 *   items     : { รหัสรายการ: จำนวนครั้งที่ นสต. ปฏิบัติ }        ← นสต. กรอก
 *   evalItems : { รหัสรายการ: { ok: n, bad: n } }                 ← ครูพี่เลี้ยงบันทึก
 *   prepItems / postItems : ['ผ่าน'|'ไม่ผ่าน' × 3]                ← ครูพี่เลี้ยงบันทึก
 * บันทึกรุ่นเก่า (1 บันทึก = 1 รายการ, topicCode/evalWork) ยังอ่านและคิดคะแนนได้ */
var FT_DAY = (function () {
  function isDay(l) { return !!(l && l.form === 'day'); }
  function itemCodes(l) {
    if (isDay(l)) return Object.keys(l.items || {}).filter(function (c) { return (+l.items[c] || 0) > 0; });
    return l && l.topicCode ? [l.topicCode] : [];
  }
  /* ข้อความสรุปรายการปฏิบัติของบันทึก เช่น "รับหนังสือ ×2, ใช้งานเครื่องวิทยุสื่อสาร" */
  function summary(l, maxN) {
    if (!isDay(l)) return FT_CUR.item(l.topicCode) ? FT_CUR.topicLabel(l.topicCode) : (l.topicName || l.topicCode || '');
    var parts = itemCodes(l).map(function (c) {
      var it = FT_CUR.item(c), n = +l.items[c] || 0;
      return (it ? it.name : c) + (n > 1 ? ' ×' + n : '');
    });
    if (maxN && parts.length > maxN) return parts.slice(0, maxN).join(', ') + ' และอีก ' + (parts.length - maxN) + ' รายการ';
    return parts.join(', ');
  }
  function performed(l) {
    if (!isDay(l)) return l && l.topicCode ? 1 : 0;
    return itemCodes(l).reduce(function (a, c) { return a + (+l.items[c] || 0); }, 0);
  }
  /* ผลรวมถูกต้อง/ไม่ถูกต้องของการปฏิบัติงาน (ไม่รวมความพร้อม/หลังปฏิบัติ) */
  function workTotals(l) {
    var t = { ok: 0, bad: 0 };
    if (isDay(l)) Object.keys(l.evalItems || {}).forEach(function (c) { t.ok += +(l.evalItems[c] || {}).ok || 0; t.bad += +(l.evalItems[c] || {}).bad || 0; });
    else if (l.evalWork === 'ผ่าน') t.ok = 1; else if (l.evalWork === 'ไม่ผ่าน') t.bad = 1;
    return t;
  }
  return { isDay: isDay, itemCodes: itemCodes, summary: summary, performed: performed, workTotals: workTotals };
})();

var FT_SCORE = (function () {
  var OK = 'ถูกต้อง', BAD = 'ไม่ถูกต้อง';
  function isOk(v) { return v === 'ผ่าน' || v === OK; }
  function isMarked(v) { return v === 'ผ่าน' || v === 'ไม่ผ่าน' || v === OK || v === BAD; }
  function zero() { return { ok: 0, bad: 0 }; }
  function add(c, v) { if (!isMarked(v)) return; if (isOk(v)) c.ok++; else c.bad++; }

  /* นับจำนวนการปฏิบัติตามแบบบันทึกผลการปฏิบัติงาน (รายวัน) — หลักสูตร นสต. 2567
   * - ความพร้อม/หลังปฏิบัติงาน: 3 ข้อย่อย นับวันละ 1 ครั้ง (ใช้ผลของบันทึกที่ตรวจล่าสุดของวันนั้น)
   * - การปฏิบัติงาน: นับตามรายการของแต่ละบันทึก
   * - บันทึกเก่าที่ยังไม่มีข้อย่อย: นับความพร้อม/หลังปฏิบัติ 1 ครั้งต่อบันทึก (legacy)
   * opts: { semester: '1'|'2', from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', month: 'YYYY-MM' } */
  function tally(allLogs, traineeName, opts) {
    opts = opts || {};
    var sem = opts.semester ? String(opts.semester) : null;
    var logs = (allLogs || []).filter(function (l) {
      if (l.traineeName !== traineeName || l.status !== 'evaluated') return false;
      var ls = String(l.semester) === '2' ? '2' : '1';
      if (sem && ls !== sem) return false;
      var d = String(l.date || '');
      if (opts.month && d.indexOf(opts.month) !== 0) return false;
      if (opts.from && d < opts.from) return false;
      if (opts.to && d > opts.to) return false;
      return true;
    });
    var t = { logs: logs, days: [], prep: [zero(), zero(), zero()], post: [zero(), zero(), zero()],
              prepLegacy: zero(), postLegacy: zero(), items: {}, legacy: {}, legacyNames: {} };
    var byDay = {};
    logs.forEach(function (l) {
      var key = (String(l.semester) === '2' ? '2' : '1') + '|' + l.date;
      (byDay[key] = byDay[key] || []).push(l);
      if (FT_DAY.isDay(l)) {
        Object.keys(l.evalItems || {}).forEach(function (c) {
          var r = l.evalItems[c] || {}, okN = +r.ok || 0, badN = +r.bad || 0;
          if (!okN && !badN) return;
          var bucket = FT_CUR.item(c) ? (t.items[c] = t.items[c] || zero()) : null;
          if (bucket) { bucket.ok += okN; bucket.bad += badN; }
        });
        return;
      }
      var code = l.topicCode, cat = FT_CUR.catOf(code);
      if (FT_CUR.item(code)) { add(t.items[code] = t.items[code] || zero(), l.evalWork); }
      else if (cat) {
        add(t.legacy[cat] = t.legacy[cat] || zero(), l.evalWork);
        (t.legacyNames[cat] = t.legacyNames[cat] || {})[l.topicName || code] = 1;
      }
    });
    Object.keys(byDay).sort().forEach(function (key) {
      var day = byDay[key];
      t.days.push(key.split('|')[1]);
      ['prep', 'post'].forEach(function (k) {
        var withItems = day.filter(function (l) { return Array.isArray(l[k + 'Items']) && l[k + 'Items'].length === 3; });
        if (withItems.length) {
          withItems.sort(function (a, b) { return (a.evalAt || 0) - (b.evalAt || 0); });
          var src = withItems[withItems.length - 1][k + 'Items'];
          src.forEach(function (v, i) { add(t[k][i], v); });
        }
        day.forEach(function (l) {
          if (!(Array.isArray(l[k + 'Items']) && l[k + 'Items'].length === 3) && !withItems.length) {
            add(t[k + 'Legacy'], k === 'prep' ? l.evalPrep : l.evalPost);
          }
        });
      });
    });
    function sum(list) { return list.reduce(function (a, c) { if (c) { a.ok += c.ok; a.bad += c.bad; } return a; }, zero()); }
    t.prepTotal = sum(t.prep.concat([t.prepLegacy]));
    t.postTotal = sum(t.post.concat([t.postLegacy]));
    t.catTotal = {};
    Object.keys(FT_CUR.sems).forEach(function (s) {
      FT_CUR.sems[s].cats.forEach(function (c) {
        t.catTotal[c.id] = sum(c.items.map(function (i) { return t.items[i.code]; }).concat([t.legacy[c.id]]));
      });
    });
    return t;
  }

  function rowsFor(sem) {
    var S = FT_CUR.sems[sem], p = 'k' + sem;
    var out = [{ id: p + '_prep', kind: 'prep', no: '1.', title: 'ความพร้อมก่อนปฏิบัติงาน', sub: FT_CUR.prepText, maxScore: S.prep }];
    S.cats.forEach(function (c) {
      out.push({ id: c.id, kind: 'work', no: c.no, title: c.name, sub: c.items.map(function (i) { return i.name; }).join(', '), maxScore: c.max });
    });
    out.push({ id: p + '_post', kind: 'post', no: '3.', title: 'หลังปฏิบัติงาน', sub: FT_CUR.postText, maxScore: S.post });
    return out;
  }
  function grade(pct) { return pct >= 80 ? 'ผ่าน (ดี)' : pct >= 60 ? 'ผ่าน (พอใช้)' : 'ไม่ผ่าน'; }

  /* คะแนนของภาคเรียน จากผลนับ (tally) */
  function semRows(sem, t) {
    var out = { rows: [], score: 0, ev: 0, ps: 0, fl: 0, done: 0, workOk: true };
    rowsFor(sem).forEach(function (item) {
      var c = item.kind === 'prep' ? t.prepTotal : item.kind === 'post' ? t.postTotal : t.catTotal[item.id];
      var ev = c.ok + c.bad;
      if (!ev) { out.rows.push({ item: item, ev: 0, ps: 0, fl: 0, sc: 0, pct: 0, pending: true }); return; }
      var sc = Math.round((c.ok * item.maxScore) / ev);
      var pct = (sc / item.maxScore) * 100;
      if (item.kind === 'work' && pct < 60) out.workOk = false;
      out.rows.push({ item: item, ev: ev, ps: c.ok, fl: c.bad, sc: sc, pct: pct, pending: false });
      out.score += sc; out.ev += ev; out.ps += c.ok; out.fl += c.bad; out.done++;
    });
    return out;
  }

  /* หัวข้อที่ยังไม่มีผลประเมิน: คะแนน 0 และสถานะ "ยังไม่ประเมิน" — สรุปผ่าน/ไม่ผ่านเมื่อประเมินครบทุกหัวข้อ */
  function compute(allLogs, traineeName) {
    var t1 = tally(allLogs, traineeName, { semester: '1' }), t2 = tally(allLogs, traineeName, { semester: '2' });
    var a = semRows('1', t1), b = semRows('2', t2);
    var workOk = a.workOk && b.workOk;
    var totalScore = a.score + b.score;
    var itemsTotal = a.rows.length + b.rows.length;
    var itemsDone = a.done + b.done;
    var complete = itemsDone === itemsTotal;
    var pct = (totalScore / FT_CUR.total) * 100;
    var isPass = complete && totalScore >= FT_CUR.passScore && workOk;
    return {
      traineeLogs: t1.logs.concat(t2.logs), tally1: t1, tally2: t2,
      s1Rows: a.rows, s1Score: a.score, s1Eval: a.ev, s1Pass: a.ps, s1Fail: a.fl, s1Max: FT_CUR.sems['1'].max,
      s2Rows: b.rows, s2Score: b.score, s2Eval: b.ev, s2Pass: b.ps, s2Fail: b.fl, s2Max: FT_CUR.sems['2'].max,
      totalScore: totalScore, totalMax: FT_CUR.total, percent: pct,
      weightedScore: +(totalScore * (FT_CUR.weightTotal / FT_CUR.total)).toFixed(2),
      workAllPass: workOk,
      itemsDone: itemsDone, itemsTotal: itemsTotal, complete: complete,
      isPass: isPass,
      grade: !complete ? '' : (isPass ? grade(pct) : 'ไม่ผ่าน')
    };
  }
  /* ข้อความสถานะสำหรับแสดงผล */
  function statusText(res) {
    if (!res.complete) return 'ยังประเมินไม่ครบ (' + res.itemsDone + '/' + res.itemsTotal + ' หัวข้อ)';
    if (res.isPass) return res.grade;
    return res.workAllPass ? 'ไม่ผ่าน (คะแนนรวมต่ำกว่า ' + FT_CUR.passScore + ')' : 'ไม่ผ่าน (มีประเภทงานต่ำกว่าร้อยละ 60)';
  }
  return { compute: compute, statusText: statusText, rowsFor: rowsFor, tally: tally, semRows: semRows, grade: grade, OK: OK, BAD: BAD, isOk: isOk };
})();

/* ===================== FT_FORMS =====================
 * แบบฟอร์มตามหลักสูตร นสต. พ.ศ. 2567 (ผนวก ง): แบบประเมินแบบที่ 1, แบบที่ 2, รบ 3 */
var FT_FORMS = (function () {
  /* แบบพิมพ์ตามผนวก ง หลักสูตร นสต. พ.ศ. 2567 (แบบประเมินแบบที่ 1, 2) และ รบ 3 (ผนวก ก)
   * - จัดเป็นแผ่น (.ft-sheet) ตามฟอร์มกระดาษ: หัวกระดาษ/หัวตารางซ้ำทุกแผ่น, "แบบประเมินแบบที่ … หน้า …/…"
   * - ตัวเลขในแบบพิมพ์เป็นเลขไทย */
  var TH = '๐๑๒๓๔๕๖๗๘๙';
  function th(v) { return String(v == null ? '' : v).replace(/[0-9]/g, function (d) { return TH[+d]; }); }
  /* แปลงเลขอารบิกเป็นเลขไทยเฉพาะข้อความ (ไม่แตะแท็ก/แอตทริบิวต์) */
  function thHtml(h) { return h.replace(/>([^<]+)</g, function (m, t) { return '>' + th(t) + '<'; }); }
  function e(v) { return ftEsc(v == null ? '' : v); }
  function dot(v, w) { return '<span class="dt" style="min-width:' + Math.round((w || 90) * 0.8) + 'pt">' + (v ? e(v) : '&nbsp;') + '</span>'; }
  var DOTS = '..........................................................';
  function dateParts(d) {
    var m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    var long = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return { d: +m[3], m: long[+m[2] - 1], y: +m[1] + 543 };
  }
  function dateLine(d) {
    var p = dateParts(d) || {};
    return 'วันที่' + dot(p.d, 24) + 'เดือน' + dot(p.m, 70) + 'ปี' + dot(p.y, 40);
  }
  function nameLine(o) {
    return '<div class="ln">ชื่อ - สกุล นักเรียนนายสิบตำรวจ ' + dot(o.name, 110) + ' สังกัด' + dot(o.station, 90) + ' <span style="white-space:nowrap">เลขประจำตัว' + dot(o.tid, 60) + '</span></div>';
  }
  function sheets(label, pages, cls) {
    return pages.map(function (body, i) {
      return '<section class="ft-sheet' + (cls ? ' ' + cls : '') + '"><div class="pg">' + label + (pages.length > 1 ? ' หน้า ' + (i + 1) + '/' + pages.length : '') + '</div>' + body + '</section>';
    }).join('');
  }

  /* ---------- ตารางรายการปฏิบัติ (แบบที่ 1 และ 2) แบ่งเป็นบล็อก แล้วจัดลงแผ่น ---------- */
  function countBlocks(sem, t, mode) {
    var S = FT_CUR.sems[sem], blocks = [], tot = { ok: 0, bad: 0 };
    function cell(v, used) {
      if (mode === 'day') return !used ? '-' : (v ? (v === 1 ? '✓' : String(v)) : '');
      return v ? String(v) : '';
    }
    function item(label, c, noDash) {
      var used = !!(c && (c.ok || c.bad)) || noDash;
      return '<tr><td class="it">' + label + '</td><td class="c">' + cell(c && c.ok, used) + '</td><td class="c">' + cell(c && c.bad, used) + '</td><td></td></tr>';
    }
    function sum(c) {
      tot.ok += c.ok; tot.bad += c.bad;
      return '<tr class="sum"><td class="r">รวมจำนวนการปฏิบัติ</td><td class="c pk">' + (c.ok || (c.bad ? '' : '')) + '</td><td class="c">' + (c.bad || '') + '</td><td></td></tr>';
    }
    function sec(label) { return '<tr><td class="sec">' + label + '</td><td></td><td></td><td></td></tr>'; }
    function cat(label) { return '<tr><td class="cat">' + e(label) + '</td><td></td><td></td><td></td></tr>'; }
    function lst(items, arr, legacy) {
      return items.map(function (x, i) { return item((i + 1) + '. ' + e(x), arr[i], mode === 'day'); }).join('')
        + (legacy && legacy.ok + legacy.bad ? item('(บันทึกตามเกณฑ์เดิม)', legacy) : '');
    }
    blocks.push({ w: 6, h: sec('ความพร้อมก่อนปฏิบัติงาน') + lst(FT_CUR.prepItems, t.prep, t.prepLegacy) + sum(t.prepTotal) });
    S.cats.forEach(function (c, ci) {
      var h = (ci === 0 ? sec('การปฏิบัติงาน') : '') + cat(c.formName || c.name), w = (ci === 0 ? 1 : 0) + 2 + c.items.length;
      c.items.forEach(function (x, i) {
        if (c.breaks && c.breaks[i + 1]) { h += '<tr><td class="brk">' + e(c.breaks[i + 1]) + '</td><td></td><td></td><td></td></tr>'; w++; }
        if (x.name.length > 40) w += 0.6;
        h += item((i + 1) + '. ' + e(x.name), t.items[x.code]);
      });
      if (t.legacy[c.id]) { h += item('(บันทึกตามเกณฑ์เดิม) ' + e(Object.keys(t.legacyNames[c.id] || {}).join(', ')), t.legacy[c.id]); w++; }
      blocks.push({ w: w, h: h + sum(t.catTotal[c.id]) });
    });
    var post = sec('หลังปฏิบัติงาน') + lst(FT_CUR.postItems, t.post, t.postLegacy) + sum(t.postTotal);
    blocks.push({ w: 7, h: post + '<tr class="sum"><td class="r"><b>รวมจำนวนการปฏิบัติทั้งหมด</b></td><td class="c pk"><b>' + tot.ok + '</b></td><td class="c"><b>' + (tot.bad || '') + '</b></td><td></td></tr>', tot: tot });
    return { blocks: blocks, tot: tot };
  }
  function packTables(blocks, cap) {
    var pages = [], cur = [], used = 0;
    blocks.forEach(function (b) {
      if (cur.length && used + b.w > cap) { pages.push(cur); cur = []; used = 0; }
      cur.push(b); used += b.w;
    });
    if (cur.length) pages.push(cur);
    var head = '<table class="ct"><colgroup><col><col style="width:13%"><col style="width:13%"><col style="width:17%"></colgroup>'
      + '<thead><tr><th rowspan="2">รายการปฏิบัติ</th><th colspan="2">ผลการปฏิบัติ</th><th rowspan="2">หมายเหตุ</th></tr>'
      + '<tr><th class="pk">ถูกต้อง</th><th>ไม่ถูกต้อง</th></tr></thead><tbody>';
    return pages.map(function (p) { return head + p.map(function (b) { return b.h; }).join('') + '</tbody></table>'; });
  }
  /* (ใช้ภายใน/ทดสอบ) ตารางเดียวไม่แบ่งแผ่น */
  function countTable(sem, t, opts) {
    var r = countBlocks(sem, t, (opts && opts.mode) || 'sum');
    return thHtml(packTables(r.blocks, 1e9)[0]);
  }

  /* ---------- แบบประเมินแบบที่ 1: แบบบันทึกผลการปฏิบัติงาน (รายวัน) ---------- */
  function ruled(text, lines) {
    return '<div class="ruled" style="min-height:' + (lines * 22) + 'pt">' + e(text) + '</div>';
  }
  function signLine(role, name, extra) {
    return '<div class="sg"><div>(ลงชื่อ) ' + DOTS.slice(0, 34) + role + '</div><div>(' + (name ? '&nbsp;' + e(name) + '&nbsp;' : DOTS.slice(0, 34)) + ')</div><div>ตำแหน่ง' + DOTS.slice(0, 34) + '</div>' + (extra || '') + '</div>';
  }
  function form1(o) {
    var t = FT_SCORE.tally(o.logs, o.name, { semester: o.sem, from: o.date, to: o.date });
    var notes = t.logs.map(function (l) { return FT_DAY.isDay(l) ? (l.traineeNote || '') : '• ' + FT_DAY.summary(l) + (l.traineeNote ? ': ' + l.traineeNote : ''); }).filter(Boolean).join('\n');
    var fb = t.logs.map(function (l) { return l.mentorFeedback; }).filter(Boolean).join('\n');
    var pending = (o.logs || []).filter(function (l) { return l.traineeName === o.name && l.date === o.date && l.status !== 'evaluated'; }).length;
    var head = '<div class="ttl">แบบบันทึกผลการปฏิบัติงาน (รายวัน)</div><div class="ttl2">' + dateLine(o.date) + '</div>'
      + nameLine(o)
      + '<div class="ln"><b>คำชี้แจง</b> ให้พิจารณารายการปฏิบัติของนักเรียนนายสิบตำรวจ แล้วทำเครื่องหมาย ✓ ตามผลการปฏิบัติจริง'
      + (pending ? ' <span class="no-print" style="color:#c00">(มี ' + pending + ' รายการของวันนี้ที่ยังไม่ได้ตรวจ — ไม่นับในแบบนี้)</span>' : '') + '</div>';
    var foot = '<div class="foot"><b>ครูพี่เลี้ยงหรือผู้ควบคุมการฝึกหัดปฏิบัติราชการ</b> ยศ ชื่อ - สกุล ' + dot(o.mentor, 120) + ' <span style="white-space:nowrap">ตำแหน่ง' + dot('', 90) + '</span></div>';
    var pages = packTables(countBlocks(o.sem, t, 'day').blocks, 30).map(function (tb) { return head + tb + foot; });
    pages.push('<div class="hd">บันทึกการปฏิบัติงานประจำวันสำหรับผู้ฝึกหัดปฏิบัติราชการ</div>' + ruled(notes, 10)
      + '<div class="sgrow end">' + signLine('ผู้ฝึกหัดปฏิบัติราชการ', o.name) + '</div>'
      + '<div class="hd" style="margin-top:14pt">ข้อเสนอแนะประจำวัน (เฉพาะครูพี่เลี้ยง)</div>' + ruled(fb, 9)
      + '<div class="sgrow">' + signLine('ครูพี่เลี้ยง', o.mentor) + signLine('ผู้ฝึกหัดฯ/ทราบ', o.name) + '</div>');
    return thHtml(sheets('แบบประเมินแบบที่ 1', pages));
  }

  /* ---------- บันทึกผลคะแนน (แบบที่ 2 หน้าสุดท้าย) ---------- */
  function scoreTable(sem, r) {
    var h = '<div class="semh">ภาคเรียนที่ ' + sem + '</div><table class="st"><colgroup><col><col style="width:17%"><col style="width:19%"><col style="width:14%"></colgroup>'
      + '<thead><tr><th>รายการปฏิบัติ</th><th>จำนวน<br>การปฏิบัติ<br>ทั้งหมด</th><th>จำนวน<br>การปฏิบัติ<br>ที่ทำได้ถูกต้อง</th><th>คะแนน</th></tr></thead><tbody>';
    var workHead = false;
    r.rows.forEach(function (x) {
      var isW = x.item.kind === 'work';
      if (isW && !workHead) { h += '<tr><td>การปฏิบัติงาน</td><td></td><td></td><td></td></tr>'; workHead = true; }
      h += '<tr><td' + (isW ? ' class="ind"' : '') + '>' + e(isW ? x.item.title.replace(/ \(.*\)$/, '') : x.item.title) + '</td><td class="c">' + (x.pending ? '' : x.ev) + '</td><td class="c">' + (x.pending ? '' : x.ps) + '</td><td class="c' + (!x.pending && isW && x.pct < 60 ? ' low' : '') + '">' + (x.pending ? '<span class="no-print">ยังไม่ประเมิน</span>' : x.sc) + '</td></tr>';
    });
    return h + '<tr class="sum"><td class="c"><b>รวม</b></td><td class="c"><b>' + r.ev + '</b></td><td class="c"><b>' + r.ps + '</b></td><td class="c"><b>' + r.score + '</b></td></tr></tbody></table>';
  }
  function signBoxes(mentor) {
    function box(t1, t2, name) {
      return '<div class="bx"><div class="c"><b>' + t1 + '</b></div><div class="c"><b>' + t2 + '</b></div>'
        + '<div class="ln2">ยศ ชื่อ – สกุล ' + dot(name, 130) + '</div><div class="ln2">ตำแหน่ง ' + dot('', 150) + '</div></div>';
    }
    return '<div class="bxrow">' + box('ครูพี่เลี้ยงผู้ควบคุมการฝึกหัดปฏิบัติราชการ', 'ประจำสถานีตำรวจ', mentor) + box('ครู – อาจารย์/ฝ่ายปกครองฯ', 'ของหน่วยฝึกอบรม', '') + '</div>';
  }
  function evalBoxes(max, score, pct, res) {
    var g = res ? FT_SCORE.statusText(res) : '';
    function ck(lbl, on) { return '<span class="ck">' + (on ? '☑' : '☐') + ' ' + lbl + '</span>'; }
    var done = res && res.complete;
    var good = done && res.isPass && pct >= 80, fair = done && res.isPass && pct < 80, fail = done && !res.isPass;
    return '<div class="bxrow"><div class="bx"><div class="c"><b>การประเมินผลตามเกณฑ์ที่กำหนด</b></div>'
      + '<table class="st sm"><thead><tr><th>คะแนน<br>เต็ม</th><th>คะแนน<br>ที่ทำได้</th><th>คิดเป็น<br>ร้อยละ</th><th>ผลการ<br>ปฏิบัติงาน</th></tr></thead>'
      + '<tbody><tr><td class="c">' + max + '</td><td class="c">' + score + '</td><td class="c">' + pct.toFixed(2) + '</td><td class="c">' + e(done ? (res.isPass ? (pct >= 80 ? 'ผ่าน (ดี)' : 'ผ่าน (พอใช้)') : 'ไม่ผ่าน') : '') + '</td></tr></tbody></table></div>'
      + '<div class="bx"><div class="c"><b>ผลการประเมิน</b></div><div class="cks">' + ck('ผ่าน (ดี)', good) + ck('ไม่ผ่าน', fail) + '<br>' + ck('ผ่าน (พอใช้)', fair) + '</div>'
      + (done ? '' : '<div class="no-print" style="color:#c00;font-size:11pt">' + e(g) + '</div>') + '</div></div>';
  }
  function formulaNote() {
    return '<div class="no-print" style="font-size:11pt;margin-top:6pt"><b>สูตรการคำนวณผลคะแนน</b> (ผนวก ง)<br>'
      + 'ความพร้อมก่อนปฏิบัติงาน / การมีมนุษยสัมพันธ์ที่ดี / หลังปฏิบัติงาน = (จำนวนที่ทำได้ถูกต้อง × 50) ÷ จำนวนการปฏิบัติทั้งหมด · '
      + 'การปฏิบัติตามประเภทงาน = (จำนวนที่ทำได้ถูกต้อง × 100) ÷ จำนวนการปฏิบัติทั้งหมด<br>'
      + '<b>เกณฑ์ตัดสิน</b> ร้อยละ 80 – 100 = ผ่าน (ดี) · ร้อยละ 60 – 79 = ผ่าน (พอใช้) · ร้อยละ 0 – 59 = ไม่ผ่าน</div>';
  }

  /* ---------- แบบประเมินแบบที่ 2: แบบสรุปผลการปฏิบัติงาน (รายภาคเรียน หรือเฉพาะเดือน) ---------- */
  function form2(o) {
    var t = FT_SCORE.tally(o.logs, o.name, { semester: o.sem, month: o.month || '' });
    var r = FT_SCORE.semRows(o.sem, t);
    var first = t.days[0], last = t.days[t.days.length - 1];
    var cb = countBlocks(o.sem, t, 'sum');
    var head = '<div class="ttl">แบบสรุปผลการปฏิบัติงาน</div><div class="ttl2">เพื่อใช้วัดผลสัมฤทธิ์การฝึกหัดปฏิบัติราชการ (ภาคเรียนที่ ' + e(o.sem) + ')'
      + (o.month ? ' <span class="no-print">— เฉพาะเดือน ' + e(ftThaiDate(o.month + '-01', true).replace(/^1 /, '')) + '</span>' : '') + '</div>'
      + '<div class="ttl2">ระหว่าง' + dateLine(first) + ' ถึง ' + dateLine(last) + ' จำนวน' + dot(t.days.length, 26) + 'วัน</div>'
      + nameLine(o)
      + '<div class="ln"><b>คำชี้แจง</b> ให้สรุปผลการปฏิบัติงานของนักเรียนนายสิบตำรวจ จากแบบบันทึกผลการปฏิบัติงาน (รายวัน) โดยใส่ตัวเลขจำนวนการปฏิบัติงานตามผลการปฏิบัติจริง ตั้งแต่วันแรกจนถึงวันสุดท้ายของการฝึกหัดปฏิบัติราชการ</div>';
    var pages = packTables(cb.blocks, 29).map(function (tb) { return head + tb; });
    pages.push('<div class="hd">บันทึกผลคะแนน</div><div class="ln">ชื่อ - สกุล นักเรียนนายสิบตำรวจ ' + dot(o.name, 120) + ' เลขประจำตัว' + dot(o.tid, 70) + '</div>'
      + '<div class="frame">' + scoreTable(o.sem, r) + '</div>'
      + (r.done < r.rows.length ? '<div class="no-print" style="color:#c00">ยังประเมินไม่ครบ ' + r.done + '/' + r.rows.length + ' หัวข้อ</div>' : '')
      + signBoxes(o.mentor) + formulaNote());
    var html = sheets('แบบประเมินแบบที่ 2', pages);
    var all = cb.tot.ok + cb.tot.bad;
    return { tally: t, rows: r, html: thHtml(html) + (o.totalId ? '<span id="' + o.totalId + '" hidden>' + all + '</span>' : '') };
  }
  /* บันทึกผลคะแนนรวม 2 ภาคเรียน (แบบที่ 2 หน้าบันทึกผลคะแนน, เต็ม 850) */
  function scoreSummary(res, o) {
    o = o || {};
    var body = '<div class="hd">บันทึกผลคะแนนการฝึกหัดปฏิบัติราชการ</div>'
      + (o.name ? nameLine(o) : '')
      + '<div class="frame">' + scoreTable('1', { rows: res.s1Rows, ev: res.s1Eval, ps: res.s1Pass, score: res.s1Score })
      + scoreTable('2', { rows: res.s2Rows, ev: res.s2Eval, ps: res.s2Pass, score: res.s2Score }) + '</div>'
      + signBoxes(o.mentor) + evalBoxes(FT_CUR.total, res.totalScore, res.percent, res) + formulaNote();
    return thHtml(sheets('แบบประเมินแบบที่ 2', [body]));
  }
  /* (เข้ากันกับหน้าเดิม) ลายมือชื่ออยู่ในแบบพิมพ์แล้ว */
  function signForm2() { return ''; }

  /* ---------- รบ 3: บัญชีรวมคะแนนการฝึกหัดปฏิบัติราชการ (รายภาคเรียน) ---------- */
  var RB3_NAME = { k2_pat: 'งานสายตรวจ', k2_trf: 'งานจราจร', k2_inv: 'งานสืบสวน' };
  function rb3(sem, people, unit, opts) {
    opts = opts || {};
    var rowsDef = FT_SCORE.rowsFor(sem);
    var vh = rowsDef.map(function (x) { return '<th class="v"><div>' + e(x.kind === 'work' ? (RB3_NAME[x.id] || x.title.replace(/ \(.*\)$/, '')) : x.title) + '</div></th>'; }).join('');
    var mx = rowsDef.map(function (x) { return '<th>' + x.maxScore + '</th>'; }).join('');
    var body = people.map(function (p, i) {
      var r = sem === '1' ? p.res.s1Rows : p.res.s2Rows, sc = sem === '1' ? p.res.s1Score : p.res.s2Score;
      var pend = r.some(function (x) { return x.pending; });
      return '<tr><td class="c">' + (i + 1) + '</td><td class="c">' + e(p.tid || '') + '</td><td>' + e(p.name) + '</td>' + r.map(function (x) { return '<td class="c">' + (x.pending ? '-' : x.sc) + '</td>'; }).join('')
        + '<td style="font-size:11pt">รวม ' + sc + (pend ? ' (ยังประเมินไม่ครบ)' : '') + '</td></tr>';
    }).join('');
    for (var k = people.length; k < (opts.minRows || 10); k++) body += '<tr><td>&nbsp;</td><td></td><td></td>' + rowsDef.map(function () { return '<td></td>'; }).join('') + '<td></td></tr>';
    var y = new Date().getFullYear() + 543;
    return thHtml('<section class="ft-sheet land"><div class="pg">รบ 3</div><div class="ttl">บัญชีรวมคะแนนการฝึกหัดปฏิบัติราชการ</div><div class="ttl2"><b>(ภาคเรียนที่ ' + sem + ') ประจำปี พ.ศ. ' + y + '</b></div>'
      + '<div class="ttl2"><b>ศูนย์ฝึกอบรม</b>' + dot(unit, 200) + '</div>'
      + '<table class="rb"><thead><tr><th rowspan="3" style="width:6%">ลำดับ</th><th rowspan="3" style="width:11%">เลขประจำตัว</th><th rowspan="3" style="width:22%">ชื่อ - สกุล</th><th colspan="' + rowsDef.length + '">รายการฝึกปฏิบัติราชการ</th><th rowspan="3" style="width:15%">หมายเหตุ</th></tr>'
      + '<tr>' + vh + '</tr><tr>' + mx + '</tr></thead><tbody>' + body + '</tbody></table></section>');
  }
  return { th: th, countTable: countTable, scoreTable: scoreTable, form1: form1, form2: form2, scoreSummary: scoreSummary, signForm2: signForm2, rb3: rb3 };
})();

/* วันที่แบบไทย เช่น 8 ต.ค. 2569 */
function ftThaiDate(d, full) {
  var m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(d || '');
  var short = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var long = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  return (+m[3]) + ' ' + (full ? long : short)[+m[2] - 1] + ' ' + (+m[1] + 543);
}

/* พิมพ์เฉพาะส่วนที่ระบุ (ซ่อนส่วนอื่นของหน้า) */
function ftPrintOnly(el, landscape) {
  var pst = null;
  if (landscape) { pst = document.createElement('style'); pst.textContent = '@page{size:A4 landscape;margin:10mm 12mm}'; document.head.appendChild(pst); }
  document.body.classList.add('ft-print-isolate');
  el.classList.add('ft-print-target');
  var done = function () { if (pst && pst.parentNode) pst.parentNode.removeChild(pst); document.body.classList.remove('ft-print-isolate'); el.classList.remove('ft-print-target'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(done, 1000);
}
(function () {
  try {
    var st = document.createElement('style');
    st.textContent = [
      '.ft-form{display:none}.ft-doc,.ft-doc *{box-sizing:border-box}',
      /* แผ่นเอกสารบนจอ */
      '.ft-doc .ft-sheet{background:#fff;color:#000;border:1px solid #cbd5e1;box-shadow:0 2px 8px rgba(0,0,0,.06);padding:18pt 22pt;margin:0 auto 14pt;max-width:820px;font-family:Sarabun,sans-serif;font-size:12pt;line-height:1.45}',
      '.ft-doc .ft-sheet.land{max-width:1120px}',
      '.ft-doc .pg{text-align:right;font-size:11pt}',
      '.ft-doc .ttl{text-align:center;font-weight:700;font-size:13.5pt}.ft-doc .ttl2{text-align:center;margin-bottom:2pt}',
      '.ft-doc .hd{font-weight:700;margin:4pt 0}.ft-doc .ln{margin:4pt 0}.ft-doc .ln2{margin:6pt 0}',
      '.ft-doc .dt{display:inline-block;border-bottom:1px dotted #000;text-align:center;padding:0 4pt;line-height:1.2}',
      '.ft-doc table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:6pt}',
      '.ft-doc th,.ft-doc td{border:1px solid #000;padding:1pt 5pt;font-size:12pt;line-height:1.25;vertical-align:middle;overflow-wrap:anywhere;color:#000;background:#fff!important}',
      '.ft-doc th{font-weight:700;text-align:center}.ft-doc .c{text-align:center}.ft-doc .r{text-align:right}',
      '.ft-doc .pk{background:#fbd5f3!important}@media screen{.ft-doc .low{color:#c00}}',
      '.ft-doc .sec{text-align:center;font-weight:700;text-decoration:underline}.ft-doc .cat{font-weight:700}.ft-doc .it,.ft-doc .brk{padding-left:6pt}',
      '.ft-doc .ind{padding-left:22pt}.ft-doc .sum td{font-weight:400}',
      '.ft-doc .foot{margin-top:12pt}',
      '.ft-doc .ruled{white-space:pre-wrap;line-height:22pt;padding:0 2pt;background-image:repeating-linear-gradient(to bottom,#fff 0,#fff 21pt,transparent 21pt,transparent 22pt),repeating-linear-gradient(to right,#000 0,#000 1.2pt,transparent 1.2pt,transparent 3.5pt)}',
      '.ft-doc .sgrow{display:flex;justify-content:space-around;gap:16pt;margin-top:16pt}.ft-doc .sgrow.end{justify-content:flex-end}',
      '.ft-doc .sg{text-align:center;line-height:1.9}',
      '.ft-doc .semh{font-weight:700;margin:6pt 0 0}.ft-doc .frame{border:1px solid #000;padding:4pt 14pt 8pt}',
      '.ft-doc .st th{background:#d9d9d9!important;font-weight:400}.ft-doc .st.sm th,.ft-doc .st.sm td{font-size:11pt}',
      '.ft-doc .bxrow{display:flex;gap:16pt;margin-top:8pt}.ft-doc .bx{flex:1;border:1px solid #000;padding:6pt 10pt}',
      '.ft-doc .cks{padding:4pt 18pt;line-height:1.8}.ft-doc .ck{display:inline-block;min-width:110pt}',
      '.ft-doc .rb th,.ft-doc .rb td{font-size:12pt;padding:2pt 4pt}.ft-doc .rb td{height:16pt}',
      '.ft-doc .rb th.v{height:182pt;padding:4pt 0;font-size:11.5pt;vertical-align:bottom}.ft-doc .rb th.v div{writing-mode:vertical-rl;transform:rotate(180deg);display:inline-block;white-space:nowrap;font-weight:400;line-height:1.2}',
      /* พิมพ์ */
      '@page{size:A4;margin:12mm 14mm}',
      '@media print{.ft-doc .no-print{display:none!important}',
      'body.ft-print-isolate .container>*:not(.ft-print-target),body.ft-print-isolate>*:not(.container){display:none!important}',
      'body.ft-print-isolate .ft-print-target{display:block!important}',
      '.ft-doc .ft-sheet{border:none!important;box-shadow:none!important;margin:0!important;padding:0 3pt!important;max-width:none!important;break-after:page;page-break-after:always}',
      '.ft-doc .ft-sheet:last-of-type{break-after:auto!important;page-break-after:auto!important}',
      'body.ft-print-isolate,body.ft-print-isolate .container{padding:0!important;margin:0!important;min-height:0!important}',
      '.ft-doc tr{break-inside:avoid}.ft-doc thead{display:table-header-group}',
      '.ft-doc,.ft-doc *{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}
})();

/* ===================== FT_SYNC ===================== */
var FT_SYNC = (function () {
  var STATE_KEY = 'police_field_training_sync_v1';
  var KEYS = { logs: 'police_field_training_logs_v1', roster: 'police_field_training_roster_v1', feedback: 'police_field_training_monthly_feedback_v1' };
  // ข้อมูลตัวอย่างเดิมในระบบ — ไม่อัปโหลดขึ้นที่เก็บกลาง
  var SAMPLE_LOG_IDS = /^l\d{1,2}$/;
  var SAMPLE_NAMES = ['นสต. ทศพร สุมาลี', 'นสต. สมชาย ใจดี', 'นสต. วิชัย รักชาติ', 'นสต. กิตติพงษ์ สิทธิชัย', 'นสต. ธีรภัทร ชัยมงคล'];
  var MAX_RECORD = 40000;   // ตัวอักษรต่อรายการ (Google Sheets รับได้ 50,000 ต่อเซลล์)
  var TIMEOUT = 60000;   // Apps Script ตอบช้าได้ถึง ~30 วินาทีเมื่อไม่ได้ใช้งานนาน

  var state = loadState();       // { snap:{logs:{},roster:{},feedback:{}}, queue:[{seq,...}], seq, lastPull }
  var listeners = [];
  var running = 0, lastError = '', chain = Promise.resolve();

  function enabled() { return !!(FT_SYNC_URL && /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)[:\/])/.test(FT_SYNC_URL)); }
  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
      if (s && s.snap) { s.queue = s.queue || []; s.seq = s.seq || 0; return s; }
    } catch (e) {}
    return { snap: { logs: {}, roster: {}, feedback: {} }, queue: [], seq: 0, lastPull: 0 };
  }
  // อ่านสถานะล่าสุดจาก localStorage ก่อนแก้ทุกครั้ง (กันแท็บอื่นในเบราว์เซอร์เดียวกันเขียนทับ)
  function fresh() { state = loadState(); }
  function saveState() { try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) {} }

  function toMap(kind, data) {
    var m = {};
    if (kind === 'feedback') {
      Object.keys(data || {}).forEach(function (k) { m[k] = { text: data[k] }; });
    } else {
      (data || []).forEach(function (o) {
        var k = o && (kind === 'logs' ? o.id : o.name);
        if (k) m[k] = o;
      });
    }
    return m;
  }
  function isSample(kind, key) {
    if (kind === 'logs') return SAMPLE_LOG_IDS.test(key);
    if (kind === 'roster') return SAMPLE_NAMES.indexOf(key) !== -1;
    return false;
  }
  function changedFields(a, b) {
    var f = [], seen = {};
    Object.keys(a || {}).concat(Object.keys(b || {})).forEach(function (k) {
      if (seen[k]) return; seen[k] = 1;
      if (JSON.stringify((a || {})[k]) !== JSON.stringify((b || {})[k])) f.push(k);
    });
    return f;
  }
  function enqueue(op) { op.seq = ++state.seq; state.queue.push(op); }
  var warnedSize = false;

  /* เรียกหลังผู้ใช้แก้ข้อมูล: เทียบกับสถานะล่าสุดของที่เก็บกลาง แล้วส่งเฉพาะส่วนที่เปลี่ยน
   * opts.noDelete = ['roster'] : ไม่ส่งการลบของชนิดนั้น (หน้า นสต. เพิ่มรายชื่อได้แต่ไม่ลบ)
   * ก่อนดึงข้อมูลจากที่เก็บกลางสำเร็จครั้งแรก จะยังไม่ส่งอะไร (ข้อมูลเก็บในเครื่องไว้ก่อน
   * แล้วรายการใหม่จะถูกส่งตอนเชื่อมต่อครั้งแรก) เพื่อไม่ให้ข้อมูลเก่าในเครื่องทับข้อมูลกลาง */
  function push(data, opts) {
    if (!enabled()) return;
    fresh();
    if (!state.lastPull) { render(); return; }
    opts = opts || {};
    Object.keys(data).forEach(function (kind) {
      var cur = toMap(kind, data[kind]), snap = state.snap[kind] || (state.snap[kind] = {});
      Object.keys(cur).forEach(function (k) {
        if (isSample(kind, k)) return;
        if (JSON.stringify(cur[k]).length > MAX_RECORD) {
          if (!warnedSize) { warnedSize = true; alert('รายการนี้ยาวเกินไป ระบบกลางรับไม่ได้ กรุณาย่อข้อความให้สั้นลง'); }
          return;
        }
        var before = snap[k];
        if (!before) enqueue({ kind: kind, key: k, data: cur[k] });
        else {
          var f = changedFields(before, cur[k]);
          if (f.length) enqueue({ kind: kind, key: k, data: cur[k], fields: f });
        }
        snap[k] = JSON.parse(JSON.stringify(cur[k]));
      });
      if (!(opts.noDelete && opts.noDelete.indexOf(kind) !== -1)) {
        Object.keys(snap).forEach(function (k) {
          if (!cur[k]) { enqueue({ kind: kind, key: k, deleted: true }); delete snap[k]; }
        });
      }
    });
    saveState();
    flush();
  }

  function req(url, init) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT) : null;
    init = init || {}; if (ctl) init.signal = ctl.signal;
    return fetch(url, init).then(function (r) { return r.json(); })
      .then(function (j) { if (t) clearTimeout(t); if (!j || !j.ok) throw new Error((j && j.error) || 'เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ'); return j; },
            function (e) { if (t) clearTimeout(t); throw e; });
  }
  // งานเครือข่ายทั้งหมดทำทีละงานตามลำดับ (กันส่งซ้ำ/ลบคิวผิด)
  function serial(fn) {
    running++; render();
    var p = chain.then(fn).catch(function (e) { lastError = String((e && e.message) || e); })
      .then(function (v) { running--; render(); return v; });
    chain = p.then(function () {}, function () {});
    return p;
  }

  function flush() {
    if (!enabled()) { render(); return Promise.resolve(); }
    return serial(function sendMore() {
      fresh();
      if (!state.lastPull || !state.queue.length) return;
      var batch = state.queue.slice(0, 200);
      // text/plain เพื่อไม่ให้เบราว์เซอร์ส่ง preflight (Apps Script ไม่รองรับ OPTIONS)
      return req(FT_SYNC_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                                body: JSON.stringify({ action: 'apply', ops: batch }) })
        .then(function (j) {
          fresh();
          var sent = {}; batch.forEach(function (o) { sent[o.seq] = 1; });
          state.queue = state.queue.filter(function (o) { return !sent[o.seq]; });
          saveState();
          lastError = (j.rejected && j.rejected.length) ? 'บันทึกไม่ได้ ' + j.rejected.length + ' รายการ (ข้อมูลไม่ถูกต้องหรือยาวเกินไป)' : '';
          if (state.queue.length) return sendMore();
        });
    });
  }

  function viewFrom(server) {
    var out = {
      logs: Object.keys(server.logs).map(function (k) { return server.logs[k]; })
        .sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')) || String(b.id).localeCompare(String(a.id)); }),
      roster: Object.keys(server.roster).map(function (k) { return server.roster[k]; })
        .sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'th'); }),
      feedback: {}
    };
    Object.keys(server.feedback).forEach(function (k) { out.feedback[k] = server.feedback[k].text; });
    return out;
  }
  function emit(out) { listeners.forEach(function (fn) { try { fn(out); } catch (e) { console.error(e); } }); }

  /* ดึงข้อมูลล่าสุดจากที่เก็บกลาง แล้วซ้อนการแก้ไขที่ยังส่งไม่สำเร็จไว้ด้านบน */
  function pull() {
    if (!enabled()) return Promise.resolve(null);
    return serial(function () {
      return req(FT_SYNC_URL + (FT_SYNC_URL.indexOf('?') === -1 ? '?' : '&') + 'action=all&t=' + Date.now())
        .then(function (j) {
          fresh();
          var server = { logs: {}, roster: {}, feedback: {} };
          (j.records || []).forEach(function (rec) { if (server[rec.kind]) server[rec.kind][rec.key] = rec.data; });
          var firstSync = !state.lastPull;
          state.snap = JSON.parse(JSON.stringify(server));
          var view = JSON.parse(JSON.stringify(server));
          state.queue.forEach(function (op) {
            if (!view[op.kind]) return;
            if (op.deleted) { delete view[op.kind][op.key]; delete state.snap[op.kind][op.key]; return; }
            var base = view[op.kind][op.key];
            var merged = op.data;
            if (base && op.fields) { merged = JSON.parse(JSON.stringify(base)); op.fields.forEach(function (f) { if (f in op.data) merged[f] = op.data[f]; else delete merged[f]; }); }
            view[op.kind][op.key] = merged;
            state.snap[op.kind][op.key] = JSON.parse(JSON.stringify(merged));
          });
          // เชื่อมครั้งแรก: ส่งรายการที่มีเฉพาะในเครื่องนี้ขึ้นที่เก็บกลาง (ไม่รวมข้อมูลตัวอย่าง)
          if (firstSync) {
            var local = readLocal();
            ['logs', 'roster', 'feedback'].forEach(function (kind) {
              var lm = toMap(kind, local[kind]);
              Object.keys(lm).forEach(function (k) {
                if (view[kind][k] || isSample(kind, k) || JSON.stringify(lm[k]).length > MAX_RECORD) return;
                view[kind][k] = lm[k];
                state.snap[kind][k] = JSON.parse(JSON.stringify(lm[k]));
                enqueue({ kind: kind, key: k, data: lm[k] });
              });
            });
          }
          state.lastPull = Date.now(); lastError = '';
          var out = viewFrom(view);
          writeLocal(out);
          saveState();
          emit(out);
          return out;
        });
    }).then(function (out) { fresh(); if (state.queue.length) flush(); return out || null; });
  }

  function readLocal() {
    var o = {};
    Object.keys(KEYS).forEach(function (k) {
      try { o[k] = JSON.parse(localStorage.getItem(KEYS[k]) || (k === 'feedback' ? '{}' : '[]')); } catch (e) { o[k] = k === 'feedback' ? {} : []; }
    });
    return o;
  }
  function writeLocal(d) {
    try {
      localStorage.setItem(KEYS.logs, JSON.stringify(d.logs));
      localStorage.setItem(KEYS.roster, JSON.stringify(d.roster));
      localStorage.setItem(KEYS.feedback, JSON.stringify(d.feedback));
    } catch (e) { lastError = 'หน่วยความจำเบราว์เซอร์เต็ม'; }
  }

  /* ป้ายสถานะมุมขวาล่าง */
  var badge;
  function render() {
    if (typeof document === 'undefined' || !document.body) return;
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'ft-sync-badge';
      badge.setAttribute('role', 'status');
      badge.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9999;font:13px/1.4 Sarabun,sans-serif;padding:6px 12px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.15);cursor:pointer;max-width:calc(100vw - 24px);';
      badge.title = 'คลิกเพื่อส่งและดึงข้อมูลล่าสุด';
      badge.onclick = function () { if (enabled()) { flush(); pull(); } };
      document.body.appendChild(badge);
      var st = document.createElement('style');
      st.textContent = '@media print{#ft-sync-badge{display:none!important}}';
      document.head.appendChild(st);
    }
    var bg = '#e8f5e9', fg = '#1b5e20', txt, q = state.queue.length;
    if (!enabled()) { bg = '#f1f1f1'; fg = '#555'; txt = 'เก็บข้อมูลเฉพาะเครื่องนี้'; }
    else if (running) { bg = '#e3f2fd'; fg = '#0d47a1'; txt = 'กำลังซิงก์…'; }
    else if (lastError) { bg = '#fdecea'; fg = '#a32d2d'; txt = lastError.indexOf('บันทึกไม่ได้') === 0 || lastError.indexOf('หน่วยความจำ') === 0 ? lastError : 'เชื่อมต่อไม่ได้' + (q ? ' · รอส่ง ' + q + ' รายการ' : '') + ' (คลิกเพื่อลองใหม่)'; }
    else if (!state.lastPull) { bg = '#fff8e1'; fg = '#8a5a00'; txt = 'ยังไม่ได้เชื่อมที่เก็บกลาง (คลิกเพื่อลองใหม่)'; }
    else if (q) { bg = '#fff8e1'; fg = '#8a5a00'; txt = 'รอส่ง ' + q + ' รายการ'; }
    else { var d = new Date(state.lastPull); txt = '✓ ซิงก์แล้ว ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); }
    badge.style.background = bg; badge.style.color = fg; badge.textContent = txt;
  }

  function onData(fn) { listeners.push(fn); }

  function start() {
    render();
    if (!enabled()) return;
    pull();
    setInterval(function () { if (document.visibilityState === 'visible' && !running) { flush(); pull(); } }, 60000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && !running) { flush(); pull(); } });
    window.addEventListener('online', function () { flush(); pull(); });
    // แท็บอื่นในเบราว์เซอร์เดียวกันแก้ข้อมูล → อัปเดตหน้านี้ตาม (กันข้อมูลในหน้าค้างแล้วไปลบของคนอื่น)
    window.addEventListener('storage', function (e) {
      if (e.key === STATE_KEY) { fresh(); render(); return; }
      if (e.key === KEYS.logs || e.key === KEYS.roster || e.key === KEYS.feedback) {
        var l = readLocal();
        emit({ logs: l.logs, roster: l.roster, feedback: l.feedback });
      }
    });
  }
  if (typeof window !== 'undefined') window.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); });

  return { enabled: enabled, push: push, pull: pull, flush: flush, onData: onData,
           _state: function () { return state; } };
})();

/* ค่าสำหรับใส่ใน onclick="fn(...)" อย่างปลอดภัย: ได้สตริง JS ที่ escape แล้ว */
function ftJs(s) { return ftEsc(JSON.stringify(String(s === undefined || s === null ? '' : s))); }
/* ค่าสำหรับไฟล์ CSV: ใส่เครื่องหมายคำพูด และกันสูตร Excel */
function ftCsv(v) {
  v = v === undefined || v === null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return '"' + v.replace(/"/g, '""') + '"';
}
