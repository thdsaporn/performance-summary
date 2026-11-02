/**
 * fee-docs.js — บันทึกขออนุมัติยืมเงินค่าสมนาคุณวิทยากร (Word) จากระบบตารางฝึกอบรม
 * แบบตามบันทึกจริงของ กก.5 (กดต.13, ชุดปฏิบัติการพิเศษ, ยุทธวิธียาเสพติด):
 *   หน้า 1  เรื่อง ขออนุมัติยืมเงินค่าสมนาคุณ — รายละเอียดชั่วโมง/อัตรา/รายวิชา
 *   หน้า 2  เรื่อง ขออนุมัติยืมเงินค่าสมนาคุณให้แก่วิทยากร — สรุปยอด + ช่องการเงินตรวจสอบ + คำสั่ง
 * ใช้ตัวช่วยจาก lib/saraban-docx.js (รูปแบบบันทึกข้อความเดียวกับห้องร่างหนังสือ AI)
 * public: window.FeeDocs.exportMemo(data) → ดาวน์โหลด .docx, window.FeeDocs.bahtText(n)
 */
(function (root) {
  'use strict';
  const S = () => root.SarabanDocx, H = () => root.SarabanDocx._h;

  // ---------- ตัวเลขเป็นตัวอักษร (บาทถ้วน) ----------
  const DIG = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const POS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
  function readInt(n) {
    if (n === 0) return '';
    if (n >= 1e6) return readInt(Math.floor(n / 1e6)) + 'ล้าน' + readInt(n % 1e6);
    const s = String(n); let out = '';
    for (let i = 0; i < s.length; i++) {
      const d = +s[i], p = s.length - 1 - i;
      if (!d) continue;
      if (p === 1 && d === 1) out += 'สิบ';
      else if (p === 1 && d === 2) out += 'ยี่สิบ';
      else if (p === 0 && d === 1 && s.length > 1) out += 'เอ็ด';
      else out += DIG[d] + POS[p];
    }
    return out;
  }
  function bahtText(amount) {
    const satang = Math.round(amount * 100) % 100, baht = Math.floor(Math.round(amount * 100) / 100);
    if (!baht && !satang) return 'ศูนย์บาทถ้วน';
    return (baht ? readInt(baht) + 'บาท' : '') + (satang ? readInt(satang) + 'สตางค์' : 'ถ้วน');
  }
  const money = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  // ---------- สร้างเอกสาร ----------
  async function build(d) {
    const h = H(), { run, para, labelled, layoutTable, garudaRun, cm, A, D } = h;
    const num = s => d.thaiNum ? h.toThai(s) : String(s);
    const C = S().CONFIG, TAB = D().TabStopType, PB = () => new (D().PageBreak)();
    const body = (t, o = {}) => para(run(num(t)), { first: C.PARA_INDENT_CM, after: C.BODY_SPACE_AFTER_PT, ...o });
    // ส่วนลงชื่อ (ผู้ใช้กำหนด 30 ต.ค. 2569): ยศเริ่มที่แกนกลาง, "(" เริ่มตรงท้ายคำยศ,
    // ชื่อและตำแหน่งจัดกึ่งกลางที่จุดเดียวกัน — ความกว้างประมาณจาก estimateWidthCm × 0.66 (วัดจาก PDF จริงของ TH SarabunIT๙)
    const W = t => h.estimateWidthCm(t) * 0.66;
    function signature(rank, name, position, { blankLines = 2 } = {}) {
      rank = String(rank || '').trim();
      const nm = String(name || '').trim(), nameTxt = '( ' + (nm || '.........................................') + ' )';
      const out = [];
      for (let i = 0; i < blankLines; i++) out.push(para(run(''), { keepNext: true }));
      const axis = C.AXIS_CM, start = rank ? axis + W(rank) : axis;
      out.push(para(run(rank || ' '), { align: A().START, left: axis, keepNext: true }));
      const c = Math.min(start + W(nameTxt) / 2, C.PRINTABLE_WIDTH_CM - 0.5), half = Math.min(c, C.PRINTABLE_WIDTH_CM - c);
      const box = { align: A().CENTER, left: Math.round((c - half) * 100) / 100, right: Math.round((C.PRINTABLE_WIDTH_CM - c - half) * 100) / 100 };
      out.push(para(run(nameTxt), { ...box, keepNext: true }));
      String(position || '').split('\n').filter(s => s.trim()).forEach(s => out.push(para(run(s.trim()), box)));
      return out;
    }

    async function head(subject, recipient) {
      const g = await garudaRun(C.GARUDA_MEMO, 1.5, '[ครุฑ]');
      return [
        layoutTable([2.5, C.PRINTABLE_WIDTH_CM - 5.0, 2.5], [[
          { paragraphs: [para(g, { align: A().LEFT })] },
          { vcenter: true, paragraphs: [para(run('บันทึกข้อความ', { size: C.MEMO_TITLE_PT, bold: true }), { align: A().CENTER })] },
          { paragraphs: [] },
        ]]),
        para([run('ส่วนราชการ', { size: C.LABEL_BIG_PT, bold: true }), run('  ' + num(d.org) + (d.phone ? '  โทร ' + d.phone : ''))], { before: 4 }),
        layoutTable([C.MEMO_META_LEFT_CM, C.PRINTABLE_WIDTH_CM - C.MEMO_META_LEFT_CM], [[
          { paragraphs: [para([run('ที่', { size: C.LABEL_BIG_PT, bold: true }), run('  ' + num(d.docNo))], { before: 2 })] },
          { paragraphs: [para([run('วันที่', { size: C.LABEL_BIG_PT, bold: true }), run('  ' + num(d.docDate))], { before: 2 })] },
        ]]),
        para([run('เรื่อง', { size: C.LABEL_BIG_PT, bold: true }), run('\t' + subject)], {
          before: 2, left: 1.4, first: -1.4, tabs: [{ type: TAB.LEFT, position: cm(1.4) }] }),
        labelled('เรียน', num(recipient), { before: 6, after: 6 }),
      ];
    }

    // หน้า 1: รายละเอียด
    const p1 = await head('ขออนุมัติยืมเงินค่าสมนาคุณ', d.recipient1);
    (d.intro || '').split('\n').map(s => s.trim()).filter(Boolean).forEach(t => p1.push(body(t)));
    p1.push(body(`งานจัดการฝึกและวิชาการขออนุมัติยืมเงินของทางราชการเพื่อเป็นค่าสมนาคุณให้แก่วิทยากรที่มาฝึกปฏิบัติในหลักสูตรดังกล่าว ห้วงวันที่ ${d.period} พร้อมนี้ได้แนบสัญญาการยืมเงินมาด้วยแล้ว จำนวน 1 ฉบับ ดังนี้`));
    const subjTabs = [{ type: TAB.LEFT, position: cm(3.3) }, { type: TAB.LEFT, position: cm(10.5) }, { type: TAB.RIGHT, position: cm(13.3) }, { type: TAB.LEFT, position: cm(13.7) }];
    d.groups.forEach(g => {
      const mult = g.mult > 1 || g.multUnit ? `  ${g.mult} ${g.multUnit || ''}` : '';
      p1.push(para(run(num(`${g.label}  จำนวน  ${g.hours}  ชั่วโมง ๆ ละ ${money(g.rate)}.- บาท${mult}  เป็นเงิน\t${money(g.amount)}.-\tบาท`)), {
        align: A().LEFT, before: 6, tabs: [{ type: TAB.RIGHT, position: cm(14.6) }, { type: TAB.LEFT, position: cm(15.0) }] }));
      g.subjects.forEach((s, i) => p1.push(para(run(num(`\t${i + 1}  วิชา  ${s.name}\tจำนวน\t${s.hours}\tชั่วโมง`)), {
        align: A().LEFT, left: 0, tabs: [{ type: TAB.LEFT, position: cm(2.5) }, ...subjTabs] })));
    });
    p1.push(para(run(num(`รวมเป็นเงินทั้งสิ้น  ${money(d.total)}.-  บาท  ( - ${bahtText(d.total)} - )`)), { first: C.PARA_INDENT_CM, before: 8 }));
    p1.push(body('จึงเรียนมาเพื่อโปรดพิจารณา', { before: 6 }));
    p1.push(...signature(d.borrower.rank, d.borrower.name, num(d.borrower.position), { blankLines: 2 }));

    // หน้า 2: สรุป + การเงินตรวจสอบ + คำสั่ง
    const p2 = await head('ขออนุมัติยืมเงินค่าสมนาคุณให้แก่วิทยากร', d.recipient2);
    p2.push(body(`ตามอนุมัติหลักการ ผกก.5 บก.กฝ.บช.ตชด. ให้งาน กฝว.กก.5 บก.กฝ.ฯ ดำเนินการเบิก - จ่ายค่าสมนาคุณให้แก่วิทยากร หลักสูตร ${d.course} นั้น`));
    p2.push(body(`งาน กฝว.ฯ มีความประสงค์ที่จะขออนุมัติเบิกยืมเงินของทางราชการเพื่อเป็นค่าสมนาคุณให้แก่วิทยากรในหลักสูตรดังกล่าว เป็นเงิน ${money(d.total)}.- บาท ( - ${bahtText(d.total)} - ) พร้อมนี้ได้แนบสัญญาการยืมเงินมาด้วยแล้ว`));
    p2.push(body('จึงเรียนมาเพื่อโปรดพิจารณา', { before: 6 }));
    p2.push(...signature(d.borrower.rank, d.borrower.name, num(d.borrower.position), { blankLines: 1 }));
    // ช่องการเงินตรวจสอบ + คำสั่ง — ตามแบบบันทึกจริงของ กก.5 (กดต.13) ระยะวัดจากฉบับจริง (ซม. จากขอบซ้ายพื้นที่พิมพ์)
    const f = d.finance || {};
    const T = (cmList) => cmList.map(v => ({ type: TAB.LEFT, position: cm(v) }));
    const L = (t, left, o = {}) => para(run(num(t)), { align: A().START, left, ...o });
    const dateTxt = num(d.shortDate || '');
    const sigLines = (rank, name) => [`(ลงชื่อ) ${rank || ''}`, `( ${name || '                              '} )`];
    if (dateTxt) p2.push(para(run(dateTxt), { align: A().START, left: 11.1 }));   // วันที่ใต้ตำแหน่งผู้เสนอ (เว้นวัน)
    p2.push(L('เรียน   ผกก.5 บก.กฝ.บช.ตชด.(ผ่าน สว.การเงินและพัสดุฯ)', -1.3, { before: 4 }));
    p2.push(L('- ได้ตรวจสอบแล้วปรากฏว่า.......................................', 1.15));
    p2.push(L('ปัจจุบัน...................................................สนับสนุนได้', 1.5));
    p2.push(L('- เพื่อโปรดพิจารณา', 1.15));
    p2.push(L(f.checkRank || '', 4.85, { before: 10, keepNext: true }));
    p2.push(L(`( ${f.checkName || '                              '} )`, 6.0, { keepNext: true }));
    p2.push(para(run(num(f.checkPos || '')), { align: A().CENTER, left: 4.0, right: 2.8 }));
    p2.push(L('(   )  เงินยืมงบประมาณ', 1.65));
    p2.push(L('(   )  เงินทดรองราชการ', 1.65));
    p2.push(L('เพื่อโปรดสั่งการ\tคำสั่ง     (    )  อนุมัติ        (    )  ไม่อนุมัติ', -0.45, { tabs: T([8.7]) }));
    const [cl1, cl2] = sigLines(f.chiefRank, f.chiefName), [cr1, cr2] = sigLines(f.cmdRank, f.cmdName);
    p2.push(L(cl1, 0.25));
    p2.push(L(`${cl2}\t${cr1}`, 3.2, { tabs: T([9.7]) }));
    p2.push(L(`(ตำแหน่ง)\t${num(f.chiefPos || '')}\t${cr2}`, -0.1, { tabs: T([2.5, 11.8]) }));
    p2.push(L(`\t${dateTxt}\t(ตำแหน่ง)\t${num(f.cmdPos || '')}`, 0, { tabs: T([5.5, 9.7, 11.5]) }));
    if (dateTxt) p2.push(L(`\t${dateTxt}`, 0, { tabs: T([13.4]) }));

    return new (D().Document)({
      creator: 'ระบบตารางฝึกอบรม กก.๕ บก.กฝ.บช.ตชด.',
      title: 'ขออนุมัติยืมเงินค่าสมนาคุณ ' + d.course,
      styles: { default: { document: {
        run: { font: { ascii: C.FONT, hAnsi: C.FONT, cs: C.FONT, eastAsia: C.FONT }, size: C.BODY_PT * 2, sizeComplexScript: C.BODY_PT * 2,
               language: { value: 'th-TH', bidirectional: 'th-TH' } },
        paragraph: { spacing: { before: 0, after: 0, line: 240, lineRule: 'auto' } } } } },
      sections: [p1, p2].map(children => ({
        properties: { page: { size: { width: cm(21.0), height: cm(29.7) },
          margin: { top: cm(2.5), bottom: cm(2.0), left: cm(3.0), right: cm(2.0), header: cm(1.25), footer: cm(1.25) } } },
        children,
      })),
    });
  }

  async function exportMemo(d) {
    const file = await build(d), P = H().D().Packer;
    let blob;
    if (P.compiler) {   // ภาษาไทยต้องมี <w:cs/> เหมือนห้องร่างหนังสือ
      const zip = P.compiler.compile(file, undefined, []), path = 'word/document.xml';
      zip.file(path, (await zip.file(path).async('string')).replace(/<w:lang /g, '<w:cs/><w:lang '));
      blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    } else blob = await P.toBlob(file);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ('ขออนุมัติยืมเงินค่าสมนาคุณ ' + d.course).replace(/[\\/:*?"<>|]/g, ' ').slice(0, 80) + '.docx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return blob;
  }

  // ---------- ขั้น B: ใบสำคัญรับเงินค่าสมนาคุณวิทยากร (Excel ตามแบบ กก.5 — lib/template-receipt.xlsx) ----------
  // 1 แผ่น = วิทยากร 1 รายการ × วิชา × เดือน × อัตรา (สูงสุด 15 บรรทัด/แผ่น) + แผ่น "สรุป"
  // คัดลอกแผ่นต้นแบบระดับ XML (JSZip) — คงเส้นกรอบ/ฟอนต์/ระยะ/สูตร BAHTTEXT ตามต้นฉบับทุกจุด
  // (เดิมลองใช้ ExcelJS: เส้นกรอบของช่องที่รวมกันหาย และฟอนต์มาตรฐานเปลี่ยน ทำให้ 1 ใบเป็น 4 หน้า)
  const TH_MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const FIRST = 12, ROWS = 15;          // แถว 12–26 (แถว 27 เป็นช่องรวมเซลล์ของแบบฟอร์ม)
  const stripRank = t => String(t || '').replace(/^(?:ว่าที่\s*)?(?:[ก-ฮ]{1,4}\.){1,4}\s*(?:หญิง\s*)?/, '').trim();
  const xesc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const colNum = c => c.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

  // แทนค่าในช่อง (คงรูปแบบ s= ของต้นแบบ) — v: string | number | {f: สูตร} | null
  function setCell(xml, ref, v) {
    const re = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
    const m = xml.match(re);
    const style = m ? ((m[1].match(/\ss="\d+"/) || [''])[0]) : '';
    let el;
    if (v === null || v === undefined || v === '') el = `<c r="${ref}"${style}/>`;
    else if (typeof v === 'number') el = `<c r="${ref}"${style} t="n"><v>${v}</v></c>`;
    else if (v.f) el = `<c r="${ref}"${style}><f>${xesc(v.f)}</f></c>`;
    else el = `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xesc(v)}</t></is></c>`;
    if (m) return xml.replace(re, () => el);   // ใช้ฟังก์ชัน — สูตรมี $J$10 ซึ่ง replace แบบข้อความจะตีความเป็นกลุ่ม $1
    // ไม่มีช่องนี้ในแถว: แทรกตามลำดับคอลัมน์
    const row = ref.replace(/^[A-Z]+/, ''), col = colNum(ref.replace(/\d+$/, ''));
    const rre = new RegExp(`(<row r="${row}"[^>]*>)([\\s\\S]*?)(</row>)`);
    return xml.replace(rre, (all, a, cells, z) => {
      const parts = cells.match(/<c r="[A-Z]+\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || [];
      const i = parts.findIndex(p => colNum(p.match(/<c r="([A-Z]+)/)[1]) > col);
      if (i < 0) parts.push(el); else parts.splice(i, 0, el);
      return a + parts.join('') + z;
    });
  }

  function summarySheet(rows) {
    const cell = (r, c, v) => typeof v === 'number' ? `<c r="${c}${r}" t="n"><v>${v}</v></c>`
      : v && v.f ? `<c r="${c}${r}"><f>${xesc(v.f)}</f></c>`
      : `<c r="${c}${r}" t="inlineStr"><is><t xml:space="preserve">${xesc(v)}</t></is></c>`;
    const body = rows.map((vals, i) => `<row r="${i + 1}">${vals.map((v, j) => v === '' ? '' : cell(i + 1, 'ABCDEF'[j], v)).join('')}</row>`).join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
      '<cols><col min="1" max="1" width="6" customWidth="1"/><col min="2" max="2" width="30" customWidth="1"/><col min="3" max="3" width="30" customWidth="1"/>' +
      '<col min="4" max="4" width="34" customWidth="1"/><col min="5" max="5" width="8" customWidth="1"/><col min="6" max="6" width="12" customWidth="1"/></cols>' +
      `<sheetData>${body}</sheetData><pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>` +
      '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
  }

  async function buildReceipts(o) {
    // o: { template:ArrayBuffer, entries:[{date,start,end,subjectName,teacher,hours,rate}], course, payerRank, payerName }
    const zip = await root.JSZip.loadAsync(o.template);
    const base = (await zip.file('xl/worksheets/sheet1.xml').async('string')).replace(/\stabSelected="1"/, '');
    const groups = new Map();
    o.entries.slice().sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).forEach(e => {
      const k = [e.date.slice(0, 7), e.teacher || '', e.subjectName || '', e.rate].join('\u0001');
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    });
    const sheets = [], made = [], used = new Set(['สรุป']);
    for (const [, items] of groups) {
      for (let p = 0; p < items.length; p += ROWS) {
        const chunk = items.slice(p, p + ROWS), e0 = chunk[0];
        const [y, m] = e0.date.split('-').map(Number), by = y + 543;
        let name = `${TH_MON[m - 1]}${String(by).slice(-2)} ${(e0.subjectName || '').slice(0, 10)} ${stripRank(e0.teacher).slice(0, 12)}`.replace(/[\\/*?:[\]']/g, '').slice(0, 31).trim();
        for (let i = 2; used.has(name); i++) name = name.slice(0, 27) + '-' + i;
        used.add(name);
        let x = base;
        x = setCell(x, 'K1', `ที่........................../${String(by).slice(-2)}.........................`);
        x = setCell(x, 'B5', `หลักสูตร     ${o.course}`);
        x = setCell(x, 'H6', `วันที่            เดือน  ${TH_MONTH[m - 1]}   พ.ศ. ${by}`);
        x = setCell(x, 'J10', Number(e0.rate) || 0);
        let prev = '';
        for (let k = 0; k < ROWS; k++) {
          const r = FIRST + k, e = chunk[k];
          if (!e) { x = setCell(x, 'N' + r, null); continue; }
          const [yy, mm, dd] = e.date.split('-').map(Number);
          x = setCell(x, 'B' + r, e.date !== prev ? `วันที่ ${dd} ${TH_MON[mm - 1]}${String(yy + 543).slice(-2)} ` : null);
          prev = e.date;
          x = setCell(x, 'C' + r, '  เวลา ');
          x = setCell(x, 'D' + r, String(e.start || '').replace(':', '.'));
          x = setCell(x, 'E' + r, '-');
          x = setCell(x, 'F' + r, String(e.end || '').replace(':', '.'));
          x = setCell(x, 'G' + r, 'น.');
          x = setCell(x, 'H' + r, ` วิชา  ${e.subjectName || ''}`);
          x = setCell(x, 'L' + r, { f: `$J$10*N${r}` });
          x = setCell(x, 'N' + r, Number(e.hours) || 0);   // ชั่วโมงจากตาราง (เดิมใช้สูตร F-D ซึ่งผิดเมื่อเวลาไม่ลงตัวชั่วโมง)
        }
        x = setCell(x, 'N27', null);
        // ผู้รับเงิน: ยศบรรทัดลงชื่อ + ชื่อในวงเล็บ — เว้นว่างให้เขียนเองเมื่อยังไม่ทราบตัวผู้รับ
        // (ติ๊กเว้นทุกใบ หรือชื่อในตารางเป็นชื่อกลาง เช่น ครูฝึก/คณะครูฝึก/และคณะ/หลายชื่อ)
        const t0 = String(e0.teacher || '').trim();
        const known = !o.blankPayee && t0 && !/คณะ|ครูฝึก|จนท|\/|,|\sและ\s/.test(t0);
        const payeeRank = known ? ((t0.match(/^(?:ว่าที่\s*)?(?:[ก-ฮ]{1,4}\.){1,4}(?:\s*หญิง)?/) || [''])[0]) : '';
        const payee = known ? stripRank(t0) : '';
        x = setCell(x, 'B7', known ? `ข้าพเจ้า  ${t0}` : 'ข้าพเจ้า  ');
        x = setCell(x, 'C30', `( ลงชื่อ )  ${payeeRank}`);
        x = setCell(x, 'C31', payee ? `                           (   ${payee}   )` : '                           (                                      )');
        x = setCell(x, 'C32', `( ลงชื่อ )  ${o.payerRank || ''}`);
        x = setCell(x, 'C33', o.payerName ? `                            (   ${o.payerName}   )` : '                            (                                      )');
        const hrs = Math.round(chunk.reduce((a, e) => a + (Number(e.hours) || 0), 0) * 100) / 100;
        sheets.push({ name, xml: x });
        made.push([name, e0.teacher || '', e0.subjectName || '', hrs, Math.round(hrs * e0.rate * 100) / 100]);
      }
    }
    const sum = [[`สรุปใบสำคัญรับเงิน ${o.course}`, '', '', '', '', ''], ['ลำดับ', 'แผ่น', 'วิทยากร', 'วิชา', 'ชม.', 'บาท']]
      .concat(made.map((mm, i) => [i + 1, ...mm]))
      .concat([['', '', '', 'รวม', { f: `SUM(E3:E${made.length + 2})` }, { f: `SUM(F3:F${made.length + 2})` }]]);

    // ประกอบไฟล์: แผ่น 1 = สรุป, แผ่น 2.. = ใบสำคัญ (ใช้ styles/theme ของต้นแบบ)
    zip.remove('xl/worksheets/sheet1.xml');
    const all = [{ name: 'สรุป', xml: summarySheet(sum) }].concat(sheets);
    all.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, s.xml));
    zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<workbookPr/><bookViews><workbookView activeTab="0"/></bookViews><sheets>' +
      all.map((s, i) => `<sheet name="${xesc(s.name)}" sheetId="${i + 1}" r:id="rIdS${i + 1}"/>`).join('') + '</sheets><definedNames>' +
      sheets.map((s, i) => `<definedName name="_xlnm.Print_Area" localSheetId="${i + 1}">'${xesc(s.name)}'!$A$1:$L$33</definedName>`).join('') +
      '</definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>');
    zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      all.map((s, i) => `<Relationship Id="rIdS${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      '<Relationship Id="rIdSt" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rIdTh" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/></Relationships>');
    const ct = (await zip.file('[Content_Types].xml').async('string')).replace(/<Override PartName="\/xl\/worksheets\/[^>]*\/>/g, '')
      .replace('</Types>', all.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>');
    zip.file('[Content_Types].xml', ct);
    return { buffer: await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }), made };
  }

  async function exportReceipts(o) {
    const { buffer, made } = await buildReceipts(o);
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ('ใบสำคัญรับเงิน ' + o.course).replace(/[\\/:*?"<>|]/g, ' ').slice(0, 80) + '.xlsx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return made;
  }

  root.FeeDocs = { exportMemo, build, bahtText, money, buildReceipts, exportReceipts };
})(typeof window !== 'undefined' ? window : globalThis);
