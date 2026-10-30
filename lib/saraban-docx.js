/**
 * สำเนาจาก saraban-ai/docx-builder-v10.js (30 ต.ค. 2569) + export ตัวช่วย _h — ใช้กับ fee-docs.js
 * docx-builder.js — สร้างไฟล์ Word (.docx) หนังสือราชการในเบราว์เซอร์ (ไม่ต้องมีเซิร์ฟเวอร์)
 * พอร์ตมาจาก docx_generator.py + ขั้นตอนเตรียมข้อมูลของ main.py (/api/export/docx)
 * ให้ผลลัพธ์ตรงกับรุ่นเซิร์ฟเวอร์ทุกค่า — แก้ค่ามาตรฐานที่ CONFIG ด้านล่าง
 *
 * ใช้ไลบรารี docx (vendor/docx.iife.js → window.docx)
 * public:  window.SarabanDocx.exportDocument(doc)  → ดาวน์โหลดไฟล์ .docx
 *          window.SarabanDocx.buildBlob(doc)        → Promise<Blob>
 *          (doc = ระเบียนเอกสารจาก SarabanStore — content_json เป็นสตริง JSON)
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // ค่ามาตรฐาน (ตรงกับ docx_generator.py และตัวแปร CSS ใน style.css)
  // ---------------------------------------------------------------------------
  const CONFIG = {
    FONT: 'TH SarabunIT๙',
    BODY_PT: 16,
    MEMO_TITLE_PT: 29,
    CONTACT_PT: 14,
    PARA_INDENT_CM: 2.5,
    SIG_INDENT_CM: 8.0,
    AXIS_CM: 8.0,               // แกนกลางพื้นที่พิมพ์ (แนวครุฑ)
    EXT_ORG_CM: 9.5,            // ที่ตั้งส่วนราชการเจ้าของหนังสือ (หนังสือภายนอก)
    PRINTABLE_WIDTH_CM: 16.0,   // 21 - 3 - 2
    MEMO_META_LEFT_CM: 8.0,     // โทร./วันที่ เริ่มที่แกนกลาง
    SIG_BLANK_LINES_MEMO: 2,
    SIG_BLANK_LINES_EXT: 3,
    SIG_BLANK_LINES_SUB: 2,
    RANK_GAP_CM: 0.2,
    BODY_SPACE_AFTER_PT: 4,
    SUB_HEADING_INDENT_CM: 1.27,
    SUB_BODY_INDENT_CM: 1.75,
    EXT_LABELS_BOLD: false,
    LABEL_TAB_CM: { 'เรื่อง': 1.4, 'เรียน': 1.4, 'อ้างถึง': 1.75, 'สิ่งที่ส่งมาด้วย': 3.0 },
    SUBMISSION_ASTERISKS: '.....................................................................................................................................................................',   // เส้นจุดคั่นตามแบบเสนองานของ กก.5
    SUBMISSION_SECTIONS: [
      ['original_story', 'เรื่องเดิม'],
      ['facts', 'ข้อเท็จจริง'],
      ['regulations', 'ระเบียบ/ข้อกฎหมายที่เกี่ยวข้อง'],
      ['proposals', 'ข้อพิจารณา/ข้อเสนอแนะ'],
    ],
    // ระยะขอบ/ตำแหน่ง ตามไฟล์จริงของ กก.5 (D:\เสนองาน, D:\E บันทึกข้อความ ต่างๆ ปี 2569)
    MARGINS: {
      police_submission: { top: 1.75, right: 2.09, bottom: 2.75, left: 2.54 },
      internal_memo: { top: 2.5, right: 2.0, bottom: 2.0, left: 3.0 },     // ตามระบบสารบรรณเดิม
      external_letter: { top: 2.5, right: 2.0, bottom: 2.0, left: 3.0 },
    },
    LABEL_BIG_PT: 20,            // ส่วนราชการ / ที่ / วันที่ / เรื่อง ในบันทึกข้อความ
    SUB_TITLE_PT: 20,            // หัวบันทึกนำเสนอ
    SUB_LABEL_CM: 1.25,          // เรื่อง/เรียน/หัวข้อ ของบันทึกนำเสนอ
    SUB_SIG_RANK_END_CM: 8.75,   // ยศชิดขวาที่ 8.75 ซม. ชื่อเริ่มที่จุดเดียวกัน
    SUB_SIG_CENTER_CM: 10.25,    // ตำแหน่ง/วันที่
    MEMO_SIG_RANK_CM: 7.0,       // ยศผู้ลงนามบันทึกข้อความ
    MEMO_DATE_TAB_CM: 8.0,       // "วันที่" ในบรรทัดเดียวกับ "ที่"
    GARUDA_MEMO: 'garuda_1_5cm.png',
    GARUDA_EXT: 'garuda_3_0cm.png',
  };

  const D = () => root.docx;                 // ไลบรารี docx
  const cm = v => Math.round(v * 567);       // ซม. → twips (1 ซม. ≈ 566.9 twips)
  const pt20 = v => Math.round(v * 20);      // pt → twips

  // ---------------------------------------------------------------------------
  // ตัวเลขไทย / วันที่ (ตรงกับ thai_formatter.py)
  // ---------------------------------------------------------------------------
  const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
  const THAI_MONTHS_FULL = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const THAI_MONTHS_SHORT = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const toThai = s => String(s).replace(/[0-9]/g, d => THAI_DIGITS[+d]);
  const toArabic = s => String(s).replace(/[๐-๙]/g, d => String(THAI_DIGITS.indexOf(d)));
  const PROTECTED_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+|(?:https?:\/\/|www\.)\S+/g;

  function applyNumeralMode(text, useThai) {
    if (text === null || text === undefined) return '';
    const str = String(text);
    const conv = useThai ? toThai : toArabic;
    let out = '', last = 0, m;
    PROTECTED_RE.lastIndex = 0;
    while ((m = PROTECTED_RE.exec(str)) !== null) {
      out += conv(str.slice(last, m.index)) + toArabic(m[0]);   // อีเมล/URL คงเลขอารบิก
      last = m.index + m[0].length;
    }
    return out + conv(str.slice(last));
  }

  const ISO_RE = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
  function parseIso(v) {
    const [y, mo, d] = String(v).split('T')[0].split('-').map(n => parseInt(n, 10));
    return { y, mo, d };
  }
  function formatDocDate(value, useThai, blankDay) {
    if (!value) return '';
    value = String(value).trim();
    if (!ISO_RE.test(value)) return applyNumeralMode(value, useThai);
    const { y, mo, d } = parseIso(value);
    const text = blankDay
      ? `${' '.repeat(7)}${THAI_MONTHS_FULL[mo]}  ${y + 543}`
      : `${d} ${THAI_MONTHS_FULL[mo]} ${y + 543}`;
    return applyNumeralMode(text, useThai);
  }
  function formatShortDate(value, useThai, blankDay) {
    if (!value) return '';
    value = String(value).trim();
    if (!ISO_RE.test(value)) return applyNumeralMode(value, useThai);
    const { y, mo, d } = parseIso(value);
    const tail = `${THAI_MONTHS_SHORT[mo]}${String(y + 543).slice(-2)}`;
    return applyNumeralMode(blankDay ? `${' '.repeat(6)}${tail}` : `${d} ${tail}`, useThai);
  }

  // ---------------------------------------------------------------------------
  // ความกว้างโดยประมาณของข้อความ (TH Sarabun PSK) — ใช้วางยศ/ชื่อ/ตำแหน่ง
  // ---------------------------------------------------------------------------
  const COMBINING = new Set([0x0E31, ...Array.from({ length: 7 }, (_, i) => 0x0E34 + i),
    ...Array.from({ length: 8 }, (_, i) => 0x0E47 + i)].map(c => String.fromCharCode(c)));
  function estimateWidthCm(text, sizePt = CONFIG.BODY_PT) {
    let em = 0;
    for (const ch of String(text || '')) {
      if (COMBINING.has(ch)) continue;
      if (' ().,'.includes(ch)) em += 0.28;
      else if ('เโใไ'.includes(ch)) em += 0.36;
      else if (ch === 'แ') em += 0.57;
      else if (ch >= '๐' && ch <= '๙') em += 0.62;
      else if (ch >= '฀' && ch <= '๿') em += 0.58;
      else em += 0.50;
    }
    return em * sizePt / 72 * 2.54;
  }

  // ---------------------------------------------------------------------------
  // ตัวช่วยสร้างย่อหน้า / ข้อความ
  // ---------------------------------------------------------------------------
  function run(text, { size = CONFIG.BODY_PT, bold = false, color } = {}) {
    const { TextRun, Tab } = D();
    const parts = String(text ?? '').split('\t');
    const children = [];
    parts.forEach((p, i) => { if (i > 0) children.push(new Tab()); if (p) children.push(p); });
    return new TextRun({
      children: children.length ? children : [''],
      font: { ascii: CONFIG.FONT, hAnsi: CONFIG.FONT, cs: CONFIG.FONT, eastAsia: CONFIG.FONT },
      size: size * 2, sizeComplexScript: size * 2,           // sz + szCs (ภาษาไทยใช้ szCs)
      ...(bold ? { bold: true, boldComplexScript: true } : {}),   // b + bCs (ภาษาไทยใช้ bCs)
      ...(color ? { color } : {}),
      language: { value: 'th-TH', bidirectional: 'th-TH' },
    });
  }

  function para(children, o = {}) {
    const { Paragraph } = D();
    const indent = {};
    if (o.left !== undefined) indent.left = cm(o.left);
    if (o.right !== undefined) indent.right = cm(o.right);
    if (o.first !== undefined) {
      if (o.first < 0) indent.hanging = cm(-o.first); else indent.firstLine = cm(o.first);
    }
    return new Paragraph({
      children: Array.isArray(children) ? children : [children],
      alignment: (o.align === undefined || o.align === D().AlignmentType.LEFT) ? D().AlignmentType.THAI_DISTRIBUTE : o.align,
      indent: Object.keys(indent).length ? indent : undefined,
      spacing: { before: pt20(o.before || 0), after: pt20(o.after || 0), line: 240, lineRule: 'auto' },
      tabStops: o.tabs,
      keepNext: !!o.keepNext,
    });
  }

  const A = () => D().AlignmentType;
  const blank = (keepNext = true) => para(run(''), { keepNext });

  function labelled(label, value, { before = 0, after = 0, bold = true } = {}) {
    const tab = CONFIG.LABEL_TAB_CM[label] || 1.4;
    return para([run(label, { bold }), run('\t' + (value || ''))], {
      before, after, left: tab, first: -tab,
      tabs: [{ type: D().TabStopType.LEFT, position: cm(tab) }],
    });
  }

  function bodyParagraphs(list, firstCm = CONFIG.PARA_INDENT_CM) {
    return list.map(t => para(run(t), {
      after: CONFIG.BODY_SPACE_AFTER_PT, first: firstCm, align: A().THAI_DISTRIBUTE,
    }));
  }

  function bodyList(v) {
    if (typeof v === 'string') return v.split('\n').map(s => s.trim()).filter(Boolean);
    return (v || []).map(s => String(s).trim()).filter(Boolean);
  }

  // ตารางจัดคอลัมน์ ไร้เส้น ไม่มี cell margin (ชิดขอบซ้ายพอดี)
  function layoutTable(widthsCm, rows) {
    const { Table, TableRow, TableCell, WidthType, TableLayoutType, BorderStyle, VerticalAlign } = D();
    const none = { style: BorderStyle.NONE, size: 0, color: 'auto' };
    const borders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
    return new Table({
      width: { size: cm(widthsCm.reduce((a, b) => a + b, 0)), type: WidthType.DXA },
      columnWidths: widthsCm.map(cm),
      layout: TableLayoutType.FIXED,
      borders,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      indent: { size: 0, type: WidthType.DXA },
      rows: rows.map(cells => new TableRow({
        children: cells.map((c, i) => new TableCell({
          width: { size: cm(widthsCm[i]), type: WidthType.DXA },
          borders: { top: none, bottom: none, left: none, right: none },
          verticalAlign: c.vcenter ? VerticalAlign.CENTER : undefined,
          children: c.paragraphs && c.paragraphs.length ? c.paragraphs : [para(run(''))],
        })),
      })),
    });
  }

  function wrapName(name) {
    name = String(name || '').trim();
    return !name ? '' : (name.startsWith('(') ? name : `( ${name} )`);
  }

  /**
   * ส่วนลงชื่อ อ้างอิงแกนกลาง AXIS_CM (ตรงกับ _add_police_signature)
   *  memo:     ยศเริ่มที่แกนกลาง, "(" ของชื่อต่อจากท้ายคำยศ
   *  external: ท้ายคำยศจบที่แกนกลาง, "(" ของชื่อเริ่มที่แกนกลาง
   *  ตำแหน่ง/วันที่: กึ่งกลางใต้ชื่อทุกบรรทัด
   */
  function signature(rank, name, position, { blankLines = 1, extraLines = [], style = 'memo', axis = CONFIG.AXIS_CM } = {}) {
    rank = String(rank || '').trim();
    const nameTxt = wrapName(name);
    const posLines = String(position || '').split('\n').map(s => s.trim()).filter(Boolean);
    const out = [];
    for (let i = 0; i < blankLines + (rank ? 0 : 1); i++) out.push(blank());

    let nameLeft = style === 'external'
      ? axis
      : axis + (rank ? estimateWidthCm(rank) + CONFIG.RANK_GAP_CM : 0);
    nameLeft = Math.round(nameLeft * 100) / 100;

    if (rank) {
      if (style === 'external') {
        out.push(para(run('\t' + rank), {
          align: A().LEFT, left: 0, keepNext: true,
          tabs: [{ type: D().TabStopType.RIGHT, position: cm(axis - CONFIG.RANK_GAP_CM / 2) }],
        }));
      } else {
        out.push(para(run(rank), { align: A().LEFT, left: axis, keepNext: true }));
      }
    }

    const lines = posLines.concat((extraLines || []).filter(Boolean));
    out.push(para(run(nameTxt), { align: A().LEFT, left: nameLeft, keepNext: lines.length > 0 }));

    const c = nameLeft + estimateWidthCm(nameTxt) / 2;
    const h = Math.min(c, CONFIG.PRINTABLE_WIDTH_CM - c);
    lines.forEach((line, i) => out.push(para(run(line), {
      align: A().CENTER, left: Math.round((c - h) * 100) / 100,
      right: Math.round((CONFIG.PRINTABLE_WIDTH_CM - (c + h)) * 100) / 100,
      keepNext: i < lines.length - 1,
    })));
    return out;
  }

  function splitPhone(orgRaw, phoneRaw) {
    let org = orgRaw, phone = phoneRaw;
    if (!phoneRaw && orgRaw.includes('โทร')) {
      const m = orgRaw.match(/^(.*?)(โทร(?:\.|\s|).*)$/);
      if (m) { org = m[1].trim(); phone = m[2].trim(); }
    }
    return [org, String(phone || '').replace(/^โทร\.?\s*/, '').trim()];
  }

  // ---------------------------------------------------------------------------
  // รูปครุฑ
  // ---------------------------------------------------------------------------
  let imageLoader = async (src) => {
    const emb = root.SARABAN_GARUDA && root.SARABAN_GARUDA[src];
    if (emb) {
      const bin = atob(emb), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const dv = new DataView(buf.buffer);                    // PNG IHDR: กว้าง/สูงที่ byte 16/20
      return { data: buf.buffer, width: dv.getUint32(16), height: dv.getUint32(20) };
    }
    const res = await fetch(src);
    if (!res.ok) throw new Error('โหลดรูปครุฑไม่ได้: ' + src);
    const buf = await res.arrayBuffer();
    const bmp = await createImageBitmap(new Blob([buf]));
    return { data: buf, width: bmp.width, height: bmp.height };
  };

  async function garudaRun(src, heightCm, fallbackText) {
    try {
      const img = await imageLoader(src);
      const hPx = heightCm / 2.54 * 96;
      return new (D().ImageRun)({
        type: 'png', data: img.data,
        transformation: { width: Math.round(hPx * img.width / img.height), height: Math.round(hPx) },
      });
    } catch (e) {
      if (root.console) console.warn('garuda', e);
      return run(fallbackText, { size: 12, bold: true });
    }
  }

  const URGENCY = ['ด่วนที่สุด', 'ด่วนมาก', 'ด่วน'];
  const urgencyOf = d => { const u = String(d.urgency || '').trim(); return URGENCY.includes(u) ? u : ''; };
  const urgencyRun = u => run(u, { size: 32, bold: true, color: 'FF0000' });

  // ---------------------------------------------------------------------------
  // [ก] บันทึกข้อความ
  // ---------------------------------------------------------------------------
  async function buildMemo(data) {
    const children = [];
    const g = await garudaRun(CONFIG.GARUDA_MEMO, 1.5, '[ครุฑ ๑.๕ ซม.]');
    if (urgencyOf(data)) children.push(para(urgencyRun(urgencyOf(data))));
    children.push(layoutTable([2.5, CONFIG.PRINTABLE_WIDTH_CM - 5.0, 2.5], [[
      { paragraphs: [para(g, { align: A().LEFT })] },
      { vcenter: true, paragraphs: [para(run('บันทึกข้อความ', { size: CONFIG.MEMO_TITLE_PT, bold: true }), { align: A().CENTER })] },
      { paragraphs: [] },
    ]]));

    const [org, phone] = splitPhone(String(data.sender_org || '').trim(),
      String(data.phone || data.sender_phone || '').trim());
    const cell = (pair, before) => ({
      paragraphs: [pair ? para([run(pair[0], { size: CONFIG.LABEL_BIG_PT, bold: true }), run('  ' + (pair[1] || ''))], { before })
                        : para(run(''), { before })],
    });
    // ส่วนราชการ + โทร บรรทัดเดียว (รูปแบบที่ผู้ใช้แก้ ต.ค. 2569: "กก.๕ … อ.แม่แตง จว.เชียงใหม่ ๕๐๑๕๐ โทร 0 5304 6615")
    children.push(para([run('ส่วนราชการ', { size: CONFIG.LABEL_BIG_PT, bold: true }),
      run('  ' + org + (phone ? '  โทร ' + phone : ''))], { before: 4 }));
    children.push(layoutTable([CONFIG.MEMO_META_LEFT_CM, CONFIG.PRINTABLE_WIDTH_CM - CONFIG.MEMO_META_LEFT_CM], [
      [cell(['ที่', data.doc_number || ''], 2), cell(['วันที่', data.doc_date || ''], 2)],
    ]));
    children.push(para([run('เรื่อง', { size: CONFIG.LABEL_BIG_PT, bold: true }), run('\t' + (data.subject || ''))], {
      before: 2, left: 1.4, first: -1.4, tabs: [{ type: D().TabStopType.LEFT, position: cm(1.4) }] }));
    children.push(labelled('เรียน', data.recipient, { before: 6, after: 6 }));
    children.push(...bodyParagraphs(bodyList(data.body_paragraphs)));
    children.push(...signature(data.signer_rank, data.signer_name, data.signer_position,
      { blankLines: CONFIG.SIG_BLANK_LINES_MEMO }));
    return children;
  }

  // ---------------------------------------------------------------------------
  // [ข] หนังสือภายนอก
  // ---------------------------------------------------------------------------
  async function buildExternal(data) {
    const children = [];
    const bold = CONFIG.EXT_LABELS_BOLD;
    const ge = await garudaRun(CONFIG.GARUDA_EXT, 3.0, '[ตราครุฑ ๓.๐ ซม.]');
    if (urgencyOf(data)) {                     // ชั้นความเร็วมุมบนซ้าย แถวเดียวกับครุฑ
      const side = (CONFIG.PRINTABLE_WIDTH_CM - 4.0) / 2;
      children.push(layoutTable([side, 4.0, side], [[
        { vcenter: true, paragraphs: [para(urgencyRun(urgencyOf(data)))] },
        { paragraphs: [para(ge, { align: A().CENTER })] },
        { paragraphs: [] },
      ]]));
    } else children.push(para(ge, { align: A().CENTER }));

    const orgLines = String(data.sender_org_full || data.sender_org || '').split('\n').map(s => s.trim()).filter(Boolean);
    children.push(layoutTable([CONFIG.EXT_ORG_CM, CONFIG.PRINTABLE_WIDTH_CM - CONFIG.EXT_ORG_CM], [[
      { paragraphs: [para([run('ที่'), run('  ' + (data.doc_number || ''))], { before: 6 })] },
      { paragraphs: (orgLines.length ? orgLines : ['']).map((l, i) => para(run(l), { before: i === 0 ? 6 : 0, align: A().LEFT })) },
    ]]));

    children.push(para(run(data.doc_date || ''), { before: 6, after: 6, left: CONFIG.SIG_INDENT_CM }));
    children.push(labelled('เรื่อง', data.subject, { after: 6, bold }));
    children.push(labelled('เรียน', data.recipient, { after: 6, bold }));
    if (data.reference) children.push(labelled('อ้างถึง', data.reference, { after: 6, bold }));
    if (data.enclosures) children.push(labelled('สิ่งที่ส่งมาด้วย', data.enclosures, { after: 6, bold }));
    children.push(...bodyParagraphs(bodyList(data.body_paragraphs)));

    children.push(para(run(data.closing_phrase || 'ขอแสดงความนับถือ'),
      { before: 12, left: CONFIG.SIG_INDENT_CM, keepNext: true }));
    children.push(...signature(data.signer_rank, data.signer_name, data.signer_position,
      { blankLines: CONFIG.SIG_BLANK_LINES_EXT, style: 'external' }));

    String(data.contact_info || '').split('\n').filter(l => l.trim()).forEach((l, i) =>
      children.push(para(run(l.trim(), { size: CONFIG.CONTACT_PT }), { before: i === 0 ? 36 : 0 })));
    return children;
  }

  // ---------------------------------------------------------------------------
  // [ค] บันทึกเสนองาน
  // ---------------------------------------------------------------------------
  async function buildSubmission(data) {
    const children = [];
    const flag = data.use_thai_numerals;
    const useThai = (flag === undefined || flag === null || flag === '') ? true : !!Number(flag);
    const T = D().TabStopType, L = CONFIG.SUB_LABEL_CM;
    if (urgencyOf(data)) children.push(para(urgencyRun(urgencyOf(data))));

    children.push(para(run(String(data.unit_info || 'บันทึกนำเสนองานการฝึกและวิชาการ โทร. 053-046615').trim(),
      { size: CONFIG.SUB_TITLE_PT, bold: true }), { align: A().CENTER }));
    [['ผู้รับผิดชอบ', 'head_officer'], ['ผู้ดำเนินการ', 'action_officer'], ['เจ้าหน้าที่รับผิดชอบ', 'duty_officer']]
      .forEach(([label, key]) => {
        const v = String(data[key] || '').trim();
        if (v) children.push(para(run(label + '  ' + v), { align: A().CENTER }));
      });
    children.push(para(run(CONFIG.SUBMISSION_ASTERISKS), { align: A().CENTER }));

    const lab = (label, value, before) => para([run(label), run('\t' + (value || ''))], {
      before, left: L, first: -L, align: A().THAI_DISTRIBUTE, tabs: [{ type: T.LEFT, position: cm(L) }],
    });
    children.push(lab('เรื่อง', data.subject, 6));
    children.push(lab('เรียน', data.recipient_chain ||
      'ผกก.๕ บก.กฝ.บช.ตชด. (ผ่าน รอง ผกก.๕ บก.กฝ.ฯ , สว.กก.๕ บก.กฝ.ฯ (กฝว.))', 0));

    CONFIG.SUBMISSION_SECTIONS.forEach(([key, title], i) => {
      const num = useThai ? toThai(i + 1) : String(i + 1);
      children.push(para(run(`${num}. ${title}`, { bold: true }),
        { before: 6, keepNext: true, first: L }));
      const content = data[key];
      const lines = Array.isArray(content) ? content : String(content || '').split('\n');
      const ls = lines.map(s => String(s).trim()).filter(Boolean);
      (ls.length ? ls : ['-']).forEach(l =>
        children.push(para(run(l), { first: CONFIG.SUB_BODY_INDENT_CM, align: A().THAI_DISTRIBUTE })));
    });

    children.push(para(run(data.closing_phrase || 'จึงเรียนมาเพื่อโปรดพิจารณา'),
      { before: 6, first: CONFIG.SUB_BODY_INDENT_CM, keepNext: true }));
    children.push(para(run(''), { before: 6, keepNext: true }), para(run(''), { keepNext: true }));
    const rank = String(data.signer_rank || '').trim(), nameTxt = wrapName(data.signer_name);
    const end = cm(CONFIG.SUB_SIG_RANK_END_CM), mid = cm(CONFIG.SUB_SIG_CENTER_CM);
    if (rank) children.push(para(run('\t' + rank), { keepNext: true, tabs: [{ type: T.RIGHT, position: end }] }));
    children.push(para(run('\t' + (nameTxt || '(                              )')), { keepNext: true, tabs: [{ type: T.LEFT, position: end }] }));
    String(data.signer_position || '').split('\n').map(s => s.trim()).filter(Boolean).forEach(l =>
      children.push(para(run('\t' + l), { keepNext: true, tabs: [{ type: T.CENTER, position: mid }] })));
    const dateSig = String(data.submission_date || '').trim();
    if (dateSig) children.push(para(run('\t' + dateSig), { tabs: [{ type: T.LEFT, position: mid }] }));
    return children;
  }

  // ---------------------------------------------------------------------------
  // เตรียมข้อมูล (ตรงกับ export_docx ใน main.py)
  // ---------------------------------------------------------------------------
  function prepareData(doc) {
    let content = {};
    try {
      content = typeof doc.content_json === 'string' ? JSON.parse(doc.content_json || '{}') : (doc.content_json || {});
      if (!content || typeof content !== 'object' || Array.isArray(content)) content = {};
    } catch (e) { content = {}; }

    const merged = {};
    Object.entries(doc).forEach(([k, v]) => { merged[k] = v === null || v === undefined ? '' : v; });
    Object.entries(content).forEach(([k, v]) => { if (!merged[k]) merged[k] = v === null || v === undefined ? '' : v; });

    const useThai = !!Number(doc.use_thai_numerals || 0);
    merged.doc_date = formatDocDate(doc.doc_date, useThai, !!content.blank_day);
    if (doc.doc_type === 'police_submission') {
      merged.submission_date = formatShortDate(content.sign_date, useThai,
        content.sign_blank_day === undefined ? true : !!content.sign_blank_day);
    }

    const skip = new Set(['doc_type', 'status', 'urgency', 'signer_signature_img', 'attachment_path', 'content_json',
      'created_at', 'updated_at', 'created_by', 'doc_date', 'id', 'use_thai_numerals', 'blank_day',
      'submission_date', 'sign_date', 'sign_blank_day', 'phone', 'sender_phone']);  // เบอร์โทรคงเลขอารบิกตามที่ผู้ใช้พิมพ์
    Object.keys(merged).forEach(k => {
      if (skip.has(k)) return;
      const v = merged[k];
      if (typeof v === 'string' && v) merged[k] = applyNumeralMode(v, useThai);
      else if (Array.isArray(v)) merged[k] = v.map(x => applyNumeralMode(String(x), useThai));
    });
    return merged;
  }

  async function buildDocument(doc) {
    const d = D();
    if (!d) throw new Error('ไม่พบไลบรารี docx (vendor/docx.iife.js)');
    const data = prepareData(doc);
    const type = doc.doc_type || 'internal_memo';
    const M = CONFIG.MARGINS[type] || CONFIG.MARGINS.internal_memo;
    const children = type === 'external_letter' ? await buildExternal(data)
      : type === 'police_submission' ? await buildSubmission(data)
      : await buildMemo(data);

    return new d.Document({
      creator: 'e-Saraban กก.๕ บก.กฝ.บช.ตชด.',
      title: String(doc.subject || ''),
      styles: {
        default: {
          document: {
            run: {
              font: { ascii: CONFIG.FONT, hAnsi: CONFIG.FONT, cs: CONFIG.FONT, eastAsia: CONFIG.FONT },
              size: CONFIG.BODY_PT * 2, sizeComplexScript: CONFIG.BODY_PT * 2,
              language: { value: 'th-TH', bidirectional: 'th-TH' },
            },
            paragraph: { spacing: { before: 0, after: 0, line: 240, lineRule: 'auto' } },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            size: { width: cm(21.0), height: cm(29.7) },
            margin: { top: cm(M.top), bottom: cm(M.bottom), left: cm(M.left), right: cm(M.right), header: cm(1.25), footer: cm(1.25) },
          },
        },
        children,
      }],
    });
  }

  async function buildBlob(doc) {
    const P = D().Packer, file = await buildDocument(doc);
    if (!P.compiler) return P.toBlob(file);
    const zip = P.compiler.compile(file, undefined, []);
    const path = 'word/document.xml', xml = await zip.file(path).async('string');
    zip.file(path, xml.replace(/<w:lang /g, '<w:cs/><w:lang '));
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  function fileName(doc) {
    const clean = String(doc.subject || 'document').replace(/[^\p{L}\p{M}\p{N} _-]/gu, '').trim().slice(0, 40) || 'document';
    return `${clean}.docx`;
  }

  async function exportDocument(doc) {
    const blob = await buildBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName(doc);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return a.download;
  }

  root.SarabanDocx = {
    CONFIG, exportDocument, buildBlob, buildDocument, prepareData, fileName,
    applyNumeralMode, formatDocDate, formatShortDate, estimateWidthCm,
    _setImageLoader(fn) { imageLoader = fn; },   // สำหรับทดสอบใน Node
    // ตัวช่วยภายใน ให้เอกสารอื่น (เช่น บันทึกค่าสอน fee-docs.js) ใช้รูปแบบเดียวกัน
    _h: { run, para, labelled, layoutTable, signature, bodyParagraphs, garudaRun, blank, cm, pt20, A, D, toThai, estimateWidthCm },
  };
})(typeof window !== 'undefined' ? window : globalThis);
