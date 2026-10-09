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
  function e(v) { return ftEsc(v == null ? '' : v); }
  function n(v) { return v ? String(v) : ''; }
  /* ตารางจำนวนการปฏิบัติ (ถูกต้อง/ไม่ถูกต้อง) ตามแบบประเมินแบบที่ 1 และ 2 */
  function countTable(sem, t, opts) {
    opts = opts || {};
    var S = FT_CUR.sems[sem], h = [];
    var tot = { ok: 0, bad: 0 };
    function row(label, c, cls) { h.push('<tr class="' + (cls || '') + '"><td' + (cls === 'item' ? ' class="ind"' : '') + '>' + label + '</td><td class="c">' + n(c && c.ok) + '</td><td class="c">' + n(c && c.bad) + '</td><td></td></tr>'); }
    function sumRow(c) { h.push('<tr class="sum"><td class="right">รวมจำนวนการปฏิบัติ</td><td class="c">' + c.ok + '</td><td class="c">' + c.bad + '</td><td></td></tr>'); tot.ok += c.ok; tot.bad += c.bad; }
    function grp(label) { h.push('<tr class="grp"><td colspan="4">' + label + '</td></tr>'); }
    h.push('<table><thead><tr><th rowspan="2">รายการปฏิบัติ</th><th colspan="2" class="c">ผลการปฏิบัติ</th><th rowspan="2" class="c" style="width:16%">หมายเหตุ</th></tr>'
      + '<tr><th class="c" style="width:12%">ถูกต้อง</th><th class="c" style="width:12%">ไม่ถูกต้อง</th></tr></thead><tbody>');
    grp('ความพร้อมก่อนปฏิบัติงาน');
    FT_CUR.prepItems.forEach(function (it, i) { row((i + 1) + '. ' + e(it), t.prep[i], 'item'); });
    if (t.prepLegacy.ok + t.prepLegacy.bad) row('(บันทึกตามเกณฑ์เดิม)', t.prepLegacy, 'item');
    sumRow(t.prepTotal);
    grp('การปฏิบัติงาน');
    S.cats.forEach(function (c) {
      h.push('<tr class="grp"><td colspan="4">' + e(c.formName || c.name) + '</td></tr>');
      c.items.forEach(function (it, i) {
        if (c.breaks && c.breaks[i + 1]) h.push('<tr><td class="ind"><b>' + e(c.breaks[i + 1]) + '</b></td><td></td><td></td><td></td></tr>');
        row((i + 1) + '. ' + e(it.name), t.items[it.code], 'item');
      });
      if (t.legacy[c.id]) row('(บันทึกตามเกณฑ์เดิม) ' + e(Object.keys(t.legacyNames[c.id] || {}).join(', ')), t.legacy[c.id], 'item');
      sumRow(t.catTotal[c.id]);
    });
    grp('หลังปฏิบัติงาน');
    FT_CUR.postItems.forEach(function (it, i) { row((i + 1) + '. ' + e(it), t.post[i], 'item'); });
    if (t.postLegacy.ok + t.postLegacy.bad) row('(บันทึกตามเกณฑ์เดิม)', t.postLegacy, 'item');
    sumRow(t.postTotal);
    h.push('<tr class="sum"><td class="right">รวมจำนวนการปฏิบัติทั้งหมด</td><td class="c">' + tot.ok + '</td><td class="c">' + tot.bad + '</td><td class="c">ทั้งหมด <span' + (opts.totalId ? ' id="' + opts.totalId + '"' : '') + '>' + (tot.ok + tot.bad) + '</span> ครั้ง</td></tr>');
    h.push('</tbody></table>');
    return h.join('');
  }
  /* บันทึกผลคะแนนของภาคเรียน (แบบประเมินแบบที่ 2 หน้าบันทึกผลคะแนน) */
  function scoreTable(sem, r) {
    var h = ['<table><thead><tr><th>ภาคเรียนที่ ' + sem + ' — รายการปฏิบัติ</th><th class="c">จำนวนการปฏิบัติทั้งหมด</th><th class="c">จำนวนการปฏิบัติที่ทำได้ถูกต้อง</th><th class="c">คะแนนเต็ม</th><th class="c">คะแนน</th></tr></thead><tbody>'];
    r.rows.forEach(function (x) {
      var label = x.item.kind === 'work' ? '<span class="ind">' + e(x.item.title.replace(/ \(.*\)$/, '')) + '</span>' : '<b>' + e(x.item.title) + '</b>';
      if (x.item.kind === 'work' && r.rows.indexOf(x) === 1) h.push('<tr><td><b>การปฏิบัติงาน</b></td><td></td><td></td><td></td><td></td></tr>');
      h.push('<tr><td>' + label + '</td><td class="c">' + (x.pending ? '-' : x.ev) + '</td><td class="c">' + (x.pending ? '-' : x.ps) + '</td><td class="c">' + x.item.maxScore + '</td><td class="c"' + (!x.pending && x.item.kind === 'work' && x.pct < 60 ? ' style="color:#c00;font-weight:700"' : '') + '>' + (x.pending ? 'ยังไม่ประเมิน' : x.sc) + '</td></tr>');
    });
    h.push('<tr class="sum"><td class="right">รวม</td><td class="c">' + r.ev + '</td><td class="c">' + r.ps + '</td><td class="c">' + FT_CUR.sems[sem].max + '</td><td class="c">' + r.score + '</td></tr></tbody></table>');
    return h.join('');
  }
  function formulaNote() {
    return '<div style="font-size:11pt;margin-top:6pt"><b>สูตรการคำนวณผลคะแนน</b><br>'
      + 'คะแนนความพร้อมก่อนปฏิบัติงาน / การมีมนุษยสัมพันธ์ที่ดี / หลังปฏิบัติงาน = (จำนวนการปฏิบัติที่ทำได้ถูกต้อง × 50) ÷ จำนวนการปฏิบัติทั้งหมด<br>'
      + 'คะแนนการปฏิบัติตามประเภทงาน = (จำนวนการปฏิบัติที่ทำได้ถูกต้อง × 100) ÷ จำนวนการปฏิบัติทั้งหมด<br>'
      + '<b>เกณฑ์การประเมิน</b> ร้อยละ 80 – 100 = ผ่าน (ดี) · ร้อยละ 60 – 79 = ผ่าน (พอใช้) · ร้อยละ 0 – 59 = ไม่ผ่าน</div>';
  }
  function signBox(title, name) {
    return '<div><div class="lines"></div><div>(' + (name ? e(name) : '..........................................') + ')</div>'
      + '<div>ตำแหน่ง ..........................................</div><div>' + title + '</div></div>';
  }
  /* ลายมือชื่อแบบที่ 2: ครูพี่เลี้ยงประจำสถานีตำรวจ + ครู – อาจารย์ ของหน่วยฝึกอบรม */
  function signForm2(mentor) {
    return '<div class="sign">' + signBox('ครูพี่เลี้ยงผู้ควบคุมการฝึกหัดปฏิบัติราชการ<br>ประจำสถานีตำรวจ', mentor) + signBox('ครู – อาจารย์<br>ของหน่วยฝึกอบรม', '') + '</div>';
  }
  /* แบบประเมินแบบที่ 1: แบบบันทึกผลการปฏิบัติงาน (รายวัน) */
  function form1(o) {
    var t = FT_SCORE.tally(o.logs, o.name, { semester: o.sem, from: o.date, to: o.date });
    var notes = t.logs.map(function (l) { return '• ' + FT_CUR.topicLabel(l.topicCode) + (l.traineeNote ? ': ' + l.traineeNote : ''); }).join('\n');
    var fb = t.logs.map(function (l) { return l.mentorFeedback; }).filter(Boolean).join('\n');
    var pending = (o.logs || []).filter(function (l) { return l.traineeName === o.name && l.date === o.date && l.status !== 'evaluated'; }).length;
    return '<div class="pg">แบบประเมินแบบที่ 1</div><h2>แบบบันทึกผลการปฏิบัติงาน (รายวัน)</h2>'
      + '<div class="sub ft-sub">วันที่ ' + e(ftThaiDate(o.date, true)) + ' · ภาคเรียนที่ ' + e(o.sem) + '</div>'
      + '<div>ชื่อ - สกุล นักเรียนนายสิบตำรวจ <b>' + e(o.name) + '</b> &nbsp; สังกัด/สถานที่ฝึก <b>' + e(o.station || '-') + '</b></div>'
      + '<div style="font-size:11pt">คำชี้แจง ให้พิจารณารายการปฏิบัติของนักเรียนนายสิบตำรวจ แล้วบันทึกจำนวนครั้งที่ปฏิบัติถูกต้อง/ไม่ถูกต้อง'
      + (pending ? ' <span class="no-print" style="color:#c00">(มี ' + pending + ' รายการของวันนี้ที่ยังไม่ได้ตรวจ — ไม่นับในแบบนี้)</span>' : '') + '</div>'
      + countTable(o.sem, t)
      + '<div class="sign">' + signBox('ครูพี่เลี้ยงหรือผู้ควบคุมการฝึกหัดปฏิบัติราชการ', o.mentor) + '</div>'
      + '<div style="page-break-before:always;margin-top:14pt"><div class="pg">แบบประเมินแบบที่ 1</div><b>บันทึกการปฏิบัติงานประจำวันสำหรับผู้ฝึกหัดปฏิบัติราชการ</b><div class="note">' + e(notes) + '</div>'
      + '<div class="sign">' + signBox('ผู้ฝึกหัดปฏิบัติราชการ', o.name) + '</div>'
      + '<b>ข้อเสนอแนะประจำวัน (เฉพาะครูพี่เลี้ยง)</b><div class="note">' + e(fb) + '</div>'
      + '<div class="sign">' + signBox('ครูพี่เลี้ยง', o.mentor) + signBox('ผู้ฝึกหัด', o.name) + '</div></div>';
  }
  /* แบบประเมินแบบที่ 2: แบบสรุปผลการปฏิบัติงาน (รายภาคเรียน หรือเฉพาะเดือน) */
  function form2(o) {
    var t = FT_SCORE.tally(o.logs, o.name, { semester: o.sem, month: o.month || '' });
    var r = FT_SCORE.semRows(o.sem, t);
    var first = t.days[0], last = t.days[t.days.length - 1];
    return { tally: t, rows: r, html: '<div class="pg">แบบประเมินแบบที่ 2</div><h2>แบบสรุปผลการปฏิบัติงาน</h2>'
      + '<div class="ft-sub">เพื่อใช้วัดผลสัมฤทธิ์การฝึกหัดปฏิบัติราชการ (ภาคเรียนที่ ' + e(o.sem) + ')' + (o.month ? ' — เฉพาะเดือน ' + e(ftThaiDate(o.month + '-01', true).replace(/^1 /, '')) : '') + '</div>'
      + '<div>ระหว่างวันที่ ' + (first ? e(ftThaiDate(first, true)) : '……………') + ' ถึง วันที่ ' + (last ? e(ftThaiDate(last, true)) : '……………') + ' จำนวน ' + t.days.length + ' วัน</div>'
      + '<div>ชื่อ - สกุล นักเรียนนายสิบตำรวจ <b>' + e(o.name) + '</b> &nbsp; สังกัด/สถานที่ฝึก <b>' + e(o.station || '-') + '</b></div>'
      + '<div style="font-size:11pt">คำชี้แจง สรุปผลการปฏิบัติงานจากแบบบันทึกผลการปฏิบัติงาน (รายวัน) โดยใส่ตัวเลขจำนวนการปฏิบัติตามผลการปฏิบัติจริง ตั้งแต่วันแรกจนถึงวันสุดท้ายของการฝึก</div>'
      + countTable(o.sem, t, { totalId: o.totalId })
      + '<div style="margin-top:12pt"><b>บันทึกผลคะแนน</b></div>' + scoreTable(o.sem, r)
      + '<div style="margin-top:6pt">คะแนนเต็ม <b>' + FT_CUR.sems[o.sem].max + '</b> · คะแนนที่ทำได้ <b>' + r.score + '</b> · คิดเป็นร้อยละ <b>' + (r.score / FT_CUR.sems[o.sem].max * 100).toFixed(2) + '</b>'
      + (r.done < r.rows.length ? ' <span style="color:#c00">(ยังประเมินไม่ครบ ' + r.done + '/' + r.rows.length + ' หัวข้อ)</span>' : '') + '</div>'
      + formulaNote() };
  }
  /* บันทึกผลคะแนนรวม 2 ภาคเรียน (เต็ม 850) */
  function scoreSummary(res) {
    var h = scoreTable('1', { rows: res.s1Rows, ev: res.s1Eval, ps: res.s1Pass, score: res.s1Score })
      + '<div style="height:8pt"></div>' + scoreTable('2', { rows: res.s2Rows, ev: res.s2Eval, ps: res.s2Pass, score: res.s2Score });
    h += '<table style="margin-top:10pt"><thead><tr><th class="c">คะแนนเต็ม</th><th class="c">คะแนนที่ทำได้</th><th class="c">คิดเป็นร้อยละ</th><th class="c">ผลการปฏิบัติงาน</th></tr></thead><tbody>'
      + '<tr><td class="c">' + FT_CUR.total + '</td><td class="c"><b>' + res.totalScore + '</b></td><td class="c">' + res.percent.toFixed(2) + '</td><td class="c"><b>' + e(FT_SCORE.statusText(res)) + '</b></td></tr></tbody></table>';
    return h + formulaNote();
  }
  /* รบ 3: บัญชีรวมคะแนนการฝึกหัดปฏิบัติราชการ (รายภาคเรียน) */
  function rb3(sem, people, unit) {
    var rowsDef = FT_SCORE.rowsFor(sem);
    var head = rowsDef.map(function (x) { return '<th class="c" style="font-size:10pt">' + e(x.kind === 'work' ? x.title.replace(/ \(.*\)$/, '') : x.title) + '<br>(' + x.maxScore + ')</th>'; }).join('');
    var body = people.map(function (p, i) {
      var r = sem === '1' ? p.res.s1Rows : p.res.s2Rows, sc = sem === '1' ? p.res.s1Score : p.res.s2Score;
      return '<tr><td class="c">' + (i + 1) + '</td><td></td><td>' + e(p.name) + '</td>' + r.map(function (x) { return '<td class="c">' + (x.pending ? '-' : x.sc) + '</td>'; }).join('')
        + '<td class="c"><b>' + sc + '</b></td><td style="font-size:10pt">' + (r.some(function (x) { return x.pending; }) ? 'ยังประเมินไม่ครบ' : '') + '</td></tr>';
    }).join('');
    return '<div class="pg">รบ 3</div><h2>บัญชีรวมคะแนนการฝึกหัดปฏิบัติราชการ</h2><div class="ft-sub">(ภาคเรียนที่ ' + sem + ') ประจำปี พ.ศ. ' + (new Date().getFullYear() + 543) + '<br>ศูนย์ฝึกอบรม ' + e(unit || '...............................................') + '</div>'
      + '<table><thead><tr><th class="c">ลำดับ</th><th class="c">เลขประจำตัว</th><th style="min-width:150px">ชื่อ - สกุล</th>' + head + '<th class="c">รวม<br>(' + FT_CUR.sems[sem].max + ')</th><th class="c">หมายเหตุ</th></tr></thead><tbody>'
      + (body || '<tr><td colspan="' + (rowsDef.length + 5) + '" class="c">ไม่มีข้อมูล</td></tr>') + '</tbody></table>';
  }
  return { countTable: countTable, scoreTable: scoreTable, form1: form1, form2: form2, scoreSummary: scoreSummary, signForm2: signForm2, rb3: rb3 };
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
function ftPrintOnly(el) {
  document.body.classList.add('ft-print-isolate');
  el.classList.add('ft-print-target');
  var done = function () { document.body.classList.remove('ft-print-isolate'); el.classList.remove('ft-print-target'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(done, 1000);
}
(function () {
  try {
    var st = document.createElement('style');
    st.textContent = '.ft-form{display:none}.ft-doc .scr-only{}@media print{.ft-doc{font-size:12pt}.ft-doc .no-print{display:none!important}body.ft-print-isolate .container>*:not(.ft-print-target),body.ft-print-isolate>*:not(.container){display:none!important}body.ft-print-isolate .ft-print-target{display:block!important}}'
      + '.ft-doc{font-family:Sarabun,sans-serif;color:#000;font-size:13pt}.ft-doc h2{font-size:15pt;text-align:center;margin:0 0 4pt}.ft-doc .ft-sub{text-align:center;margin-bottom:6pt}'
      + '.ft-doc table{width:100%;border-collapse:collapse;margin-top:6pt}.ft-doc th,.ft-doc td{border:1px solid #000;padding:3pt 6pt;font-size:12pt}.ft-doc .c{text-align:center}'
      + '.ft-doc .grp td{font-weight:700;background:#f3f3f3}.ft-doc .ind{padding-left:18pt}.ft-doc .sum td{font-weight:700}.ft-doc .right{text-align:right}'
      + '.ft-doc .sign{display:flex;justify-content:space-around;margin-top:22pt;text-align:center;gap:20pt}.ft-doc .lines{border-bottom:1px dotted #000;min-height:18pt;margin:2pt 0}'
      + '.ft-doc .pg{text-align:right;font-size:11pt}.ft-doc .note{white-space:pre-wrap;border:1px solid #000;padding:6pt;min-height:60pt}';
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
