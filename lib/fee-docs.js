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
    // ช่องการเงินตรวจสอบ + คำสั่ง (ตัวเล็ก 14 pt ให้อยู่หน้าเดียวกับบันทึก) — START = ชิดซ้ายจริง ไม่กระจายตัวอักษร
    const SM = 14;
    const L = (t, o = {}) => para(run(num(t), { size: SM }), { align: A().START, ...o });
    const C2 = t => para(run(num(t), { size: SM }), { align: A().CENTER });
    const sigBlock = (rank, name, pos) => [C2(`(ลงชื่อ) ${rank || '.............................'}`),
      C2(`( ${name || '..........................................'} )`), C2(pos || '')];
    const f = d.finance || {};
    p2.push(para(run(''), { before: 6 }));
    p2.push(layoutTable([8.5, 7.5], [[
      { paragraphs: [
        L('เรียน  ผกก.5 บก.กฝ.บช.ตชด. (ผ่าน สว.การเงินและพัสดุฯ)'),
        L('ได้ตรวจสอบแล้วปรากฏว่า.................................................', { left: 1.0 }),
        L('ปัจจุบัน.........................................................สนับสนุนได้'),
        L('เพื่อโปรดพิจารณา', { after: 10 }),
        ...sigBlock(f.checkRank, f.checkName, f.checkPos),
        L('(   )  เงินยืมงบประมาณ     (   )  เงินทดรองราชการ', { before: 6 }),
        L('เพื่อโปรดสั่งการ', { after: 10 }),
        ...sigBlock(f.chiefRank, f.chiefName, f.chiefPos),
      ] },
      { paragraphs: [
        L('คำสั่ง     (    )  อนุมัติ        (    )  ไม่อนุมัติ', { after: 30 }),
        ...sigBlock(f.cmdRank, f.cmdName, f.cmdPos),
      ] },
    ]]));

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

  root.FeeDocs = { exportMemo, build, bahtText, money };
})(typeof window !== 'undefined' ? window : globalThis);
