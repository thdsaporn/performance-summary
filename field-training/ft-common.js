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
  var PREP = 'แต่งกายถูกต้องตามระเบียบ, ตรงต่อเวลา, เครื่องมือ/อุปกรณ์ประจำกายครบถ้วนพร้อมใช้งาน';
  var POST = 'เก็บ/บำรุงรักษาเครื่องมือ อุปกรณ์ ยานพาหนะ, จัดทำบันทึกรายงานผล, แลกเปลี่ยนประสบการณ์';
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
      { id: 'k2_pat', no: '2.1', name: 'การปฏิบัติงานสายตรวจ (รวมการเผชิญเหตุ/ตรวจค้น/จับกุม)', max: 100,
        items: it('k2_pat', ['สายตรวจเดินเท้า', 'สายตรวจรถจักรยานยนต์', 'สายตรวจรถยนต์', 'รับแจ้งเหตุ', 'ระงับเหตุ',
                             'ตรวจค้นตัวบุคคล/สถานที่/รถยนต์', 'รักษาสถานที่เกิดเหตุ', 'ตั้งจุดตรวจ/จุดสกัด']) },
      { id: 'k2_trf', no: '2.2', name: 'การปฏิบัติงานด้านจราจร', max: 100,
        items: it('k2_trf', ['อำนวยการจราจรโดยใช้สัญญาณมือ', 'ควบคุมสัญญาณไฟ', 'ใช้กรวยยาง', 'ใช้ไฟฉายกะพริบ', 'ใช้ไซเรน',
                             'ใช้เครื่องตรวจวัดปริมาณแอลกอฮอล์', 'ใช้อุปกรณ์เครื่องตรวจจับความเร็ว', 'จัดการอุบัติเหตุ/เหตุฉุกเฉิน']) },
      { id: 'k2_inv', no: '2.3', name: 'การปฏิบัติงานด้านสืบสวน (รวมการควบคุม/ตรวจสอบ/ดูแลผู้ต้องหา)', max: 100,
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
           topicLabel: topicLabel, prepText: PREP, postText: POST };
})();

var FT_SCORE = (function () {
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

  /* หัวข้อที่ยังไม่มีผลประเมิน: คะแนน 0 และสถานะ "ยังไม่ประเมิน" — สรุปผ่าน/ไม่ผ่านเมื่อประเมินครบทุกหัวข้อ */
  function compute(allLogs, traineeName) {
    var traineeLogs = (allLogs || []).filter(function (l) { return l.traineeName === traineeName && l.status === 'evaluated'; });
    var stats = {};
    function bump(key, passed) {
      if (!stats[key]) stats[key] = { eval: 0, pass: 0 };
      stats[key].eval++;
      if (passed) stats[key].pass++;
    }
    traineeLogs.forEach(function (log) {
      var sem = String(log.semester) === '2' ? '2' : '1';
      if (log.evalPrep === 'ผ่าน' || log.evalPrep === 'ไม่ผ่าน') bump('k' + sem + '_prep', log.evalPrep === 'ผ่าน');
      var cat = FT_CUR.catOf(log.topicCode);
      if (cat && (log.evalWork === 'ผ่าน' || log.evalWork === 'ไม่ผ่าน')) bump(cat, log.evalWork === 'ผ่าน');
      if (log.evalPost === 'ผ่าน' || log.evalPost === 'ไม่ผ่าน') bump('k' + sem + '_post', log.evalPost === 'ผ่าน');
    });
    var workOk = true;
    function calc(sem) {
      var out = { rows: [], score: 0, ev: 0, ps: 0, fl: 0, done: 0 };
      rowsFor(sem).forEach(function (item) {
        var st = stats[item.id];
        if (!st || st.eval === 0) {
          out.rows.push({ item: item, ev: 0, ps: 0, fl: 0, sc: 0, pct: 0, pending: true });
          return;
        }
        var sc = Math.round((st.pass * item.maxScore) / st.eval);
        var pct = (sc / item.maxScore) * 100;
        if (item.kind === 'work' && pct < 60) workOk = false;
        out.rows.push({ item: item, ev: st.eval, ps: st.pass, fl: st.eval - st.pass, sc: sc, pct: pct, pending: false });
        out.score += sc; out.ev += st.eval; out.ps += st.pass; out.fl += st.eval - st.pass; out.done++;
      });
      return out;
    }
    var a = calc('1'), b = calc('2');
    var totalScore = a.score + b.score;
    var itemsTotal = a.rows.length + b.rows.length;
    var itemsDone = a.done + b.done;
    var complete = itemsDone === itemsTotal;
    var pct = (totalScore / FT_CUR.total) * 100;
    var isPass = complete && totalScore >= FT_CUR.passScore && workOk;
    return {
      traineeLogs: traineeLogs,
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
  return { compute: compute, statusText: statusText, rowsFor: rowsFor };
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
