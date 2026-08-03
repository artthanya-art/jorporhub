import { useEffect } from "react";

// เนื้อหาหน้า Landing (e-brochure) ฝังไว้เป็นสตริงคงที่ แยกไฟล์ต่างหากจาก App.jsx
// เพราะเป็น markup/CSS ก้อนใหญ่ที่ไม่ต้องยุ่งกับ state ของแอปหลักเลย
const LANDING_STYLE = `
  :root{
    --navy:#1E2A42; --navy-deep:#141B2E; --navy-2:#26344C;
    --mint:#4FC796; --mint-dark:#2FAE7D; --mint-pastel:#DFFBEC;
    --yellow-pastel:#FFF6D8; --red-pastel:#FFEAEC;
    --red-text:#D8555F; --yellow-text:#B4842A;
    --body-bg:#F7F9FB; --white:#FFFFFF; --line:#E3E8EC; --ink:#1E2A3A; --muted:#647084;
    --shadow: 0 14px 34px rgba(20,32,50,0.12);
  }
  *{box-sizing:border-box;}
  html{scroll-behavior:smooth;}
  body{ margin:0; background:var(--body-bg); color:var(--ink); font-family:'Sarabun', sans-serif;
    font-size:16px; line-height:1.65; -webkit-font-smoothing:antialiased; }
  h1,h2,h3,.display{ font-family:'Prompt','Sarabun',sans-serif; font-weight:700; margin:0; }
  .mono{ font-family:'JetBrains Mono', monospace; letter-spacing:0.4px; }
  a{color:inherit;}
  img,svg{display:block;}
  :focus-visible{outline:3px solid var(--mint-dark); outline-offset:3px;}
  .wrap{max-width:1180px; margin:0 auto; padding:0 28px;}

  /* NAV */
  .nav{ position:sticky; top:0; z-index:50; backdrop-filter:saturate(150%) blur(8px);
    background:rgba(247,249,251,0.88); border-bottom:1px solid var(--line); transition:background .3s ease; }
  .nav .wrap{ display:flex; align-items:center; justify-content:space-between; height:74px; }
  .brand-logo{ height:40px; width:auto; }
  .nav-cta{ background:var(--navy); color:#fff; border:none; font-family:'Prompt'; font-weight:600; font-size:0.95rem;
    padding:11px 22px; border-radius:8px; cursor:pointer; box-shadow:0 6px 16px rgba(30,42,66,0.25);
    transition:transform .15s ease, box-shadow .15s ease; }
  .nav-cta:hover{ transform:translateY(-1px); background:var(--navy-2); }

  /* HERO */
  .hero{ padding:80px 0 60px; overflow:hidden; }
  .hero .wrap{ display:grid; grid-template-columns:1.05fr 1fr; gap:50px; align-items:center; }
  .eyebrow{ display:inline-flex; align-items:center; gap:8px; font-family:'JetBrains Mono'; font-size:0.78rem; font-weight:600;
    color:var(--mint-dark); background:var(--mint-pastel); padding:6px 14px; border-radius:20px; margin-bottom:22px; letter-spacing:0.5px; }
  .eyebrow::before{ content:"●"; color:var(--mint-dark); font-size:0.6rem; }
  h1.headline{ font-size:clamp(2.05rem, 3.8vw, 3rem); line-height:1.22; color:var(--navy); margin-bottom:20px; }
  h1.headline .hl{ color:var(--navy); box-decoration-break:clone; background:linear-gradient(180deg, transparent 60%, var(--mint-pastel) 60%); padding:0 3px; }
  .sub{ font-size:1.1rem; color:var(--muted); max-width:540px; margin-bottom:30px; }
  .sub b{ color:var(--navy); font-weight:700; }
  .cta-row{ display:flex; gap:14px; flex-wrap:wrap; margin-bottom:28px; }
  .btn-primary, .btn-secondary{ font-family:'Prompt'; font-weight:600; font-size:1rem; padding:15px 28px; border-radius:9px;
    cursor:pointer; border:none; display:inline-flex; align-items:center; gap:8px; transition:transform .15s ease, box-shadow .15s ease, background .15s ease; }
  .btn-primary{ background:var(--navy); color:#fff; box-shadow:0 10px 24px rgba(30,42,66,0.28); }
  .btn-primary:hover{ transform:translateY(-2px); background:var(--navy-2); }
  .btn-secondary{ background:transparent; color:var(--navy); border:2px solid var(--navy); }
  .btn-secondary:hover{ background:var(--navy); color:#fff; }
  .trust-line{ display:flex; gap:20px; flex-wrap:wrap; font-size:0.85rem; color:var(--muted); }
  .trust-line span{ display:flex; align-items:center; gap:7px; }
  .trust-line svg{ width:16px; height:16px; flex:none; stroke:var(--mint-dark); }

  /* CHAOS -> ORDER HERO VISUAL */
  .stage{ position:relative; height:430px; }
  .clutter{ position:absolute; display:flex; align-items:center; gap:7px; background:var(--white); border:1px solid var(--line);
    border-radius:9px; padding:8px 11px; box-shadow:0 6px 16px rgba(20,32,50,0.10); opacity:0.68; filter:saturate(0.55);
    font-family:'Sarabun'; font-size:0.72rem; color:#7C8695; z-index:1; }
  .clutter .ic{ width:22px; height:22px; border-radius:5px; display:flex; align-items:center; justify-content:center; flex:none; }
  .c1{ top:2%; left:0%; transform:rotate(-11deg); }
  .c1 .ic{ background:#DDF1E4; }
  .c2{ top:14%; right:4%; transform:rotate(9deg); }
  .c2 .ic{ background:#FCE9D2; }
  .c3{ top:66%; left:3%; transform:rotate(7deg); }
  .c3 .ic{ background:#FBE9AE; }
  .c4{ top:78%; right:9%; transform:rotate(-8deg); }
  .c4 .ic{ background:#F6D3D6; }
  .c5{ top:44%; left:-2%; transform:rotate(-6deg); }
  .c5 .ic{ background:#DCE6F5; }
  .clutter-label{ position:absolute; top:-2%; left:2%; font-family:'JetBrains Mono'; font-size:0.68rem; color:#9AA5B1;
    background:var(--white); border:1px dashed var(--line); border-radius:20px; padding:4px 12px; z-index:1; }
  .arrow-mid{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); z-index:2; width:38px; height:38px;
    border-radius:50%; background:var(--navy); display:flex; align-items:center; justify-content:center; box-shadow:var(--shadow); }
  .arrow-mid svg{ width:18px; height:18px; stroke:#fff; }

  .mock{ background:var(--white); border-radius:18px; box-shadow:var(--shadow); padding:16px; border:1px solid var(--line);
    position:absolute; right:0; bottom:0; width:82%; z-index:3; }
  .mock-header{ background:linear-gradient(135deg, var(--navy-deep), var(--navy-2)); border-radius:12px; padding:18px 20px; margin-bottom:12px; }
  .mock-header .greet{ color:#fff; font-family:'Prompt'; font-weight:700; font-size:1.05rem; margin-bottom:4px; }
  .mock-header .sub2{ color:#AEB9C8; font-size:0.76rem; }
  .mock-grid{ display:grid; grid-template-columns:1fr 1fr; gap:9px; }
  .mock-card{ border-radius:11px; padding:12px 12px 10px; position:relative; }
  .mock-card.n{ background:var(--white); border:1px solid var(--line); }
  .mock-card.mint{ background:var(--mint-pastel); }
  .mock-card.yellow{ background:var(--yellow-pastel); }
  .mock-card.red{ background:var(--red-pastel); }
  .mock-card .lbl{ font-size:0.68rem; color:var(--ink); font-weight:600; line-height:1.3; max-width:80%; }
  .mock-card .val{ font-family:'Prompt'; font-weight:700; font-size:1.4rem; margin-top:6px; color:var(--navy); }
  .mock-card.mint .val{ color:var(--mint-dark); } .mock-card.yellow .val{ color:var(--yellow-text); } .mock-card.red .val{ color:var(--red-text); }
  .mock-foot{ margin-top:10px; font-size:0.64rem; color:var(--muted); background:var(--white); border:1px solid var(--line);
    border-radius:9px; padding:8px 10px; }
  .stage-tag{ position:absolute; z-index:4; background:var(--navy); color:#fff; font-family:'Prompt'; font-weight:600;
    font-size:0.72rem; padding:6px 12px; border-radius:20px; box-shadow:var(--shadow); }
  .tag-after{ bottom:-10px; left:6%; background:var(--mint-dark); }

  @media (prefers-reduced-motion: reduce){ *{scroll-behavior:auto !important;} }

  /* PILLARS */
  .pillars{ padding:76px 0 20px; }
  .pillar-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:20px; align-items:stretch; }
  .pillar-card{ background:var(--white); border:1px solid var(--line); border-radius:16px; padding:26px 24px 24px;
    position:relative; box-shadow:0 4px 14px rgba(20,32,50,0.05); display:flex; flex-direction:column; }
  .pillar-card.is-lead{ background:var(--navy); border-color:var(--navy); }
  .pillar-num{ position:absolute; top:20px; right:22px; font-size:0.72rem; color:#C7D0D8; }
  .pillar-card.is-lead .pillar-num{ color:#4C5B72; }
  .pillar-icon{ width:44px; height:44px; border-radius:12px; background:var(--mint-pastel); display:flex; align-items:center;
    justify-content:center; margin-bottom:16px; }
  .pillar-icon svg{ width:23px; height:23px; stroke:var(--navy); }
  .pillar-card.is-lead .pillar-icon{ background:rgba(79,199,150,0.16); }
  .pillar-card.is-lead .pillar-icon svg{ stroke:var(--mint); }
  .pillar-card h3{ font-size:1.12rem; margin-bottom:10px; color:var(--navy); }
  .pillar-card.is-lead h3{ color:#fff; }
  .pillar-card p{ font-size:0.9rem; color:var(--muted); margin:0 0 16px; line-height:1.6; }
  .pillar-card.is-lead p{ color:#B7C3CA; }
  .pillar-list{ list-style:none; margin:0; padding:14px 0 0; border-top:1px solid var(--line); display:flex;
    flex-direction:column; gap:8px; margin-top:auto; }
  .pillar-card.is-lead .pillar-list{ border-top:1px solid #33465F; }
  .pillar-list li{ font-size:0.83rem; color:var(--ink); display:flex; align-items:center; gap:8px; }
  .pillar-card.is-lead .pillar-list li{ color:#DCE4E8; }
  .pillar-list li::before{ content:""; width:5px; height:5px; border-radius:50%; background:var(--mint-dark); flex:none; }
  .pillar-card.is-lead .pillar-list li::before{ background:var(--mint); }

  /* REGISTRY SPOTLIGHT */
  .registry{ padding:64px 0 76px; }
  .registry-grid{ display:grid; grid-template-columns:0.85fr 1.15fr; gap:44px; align-items:center; }
  .registry-stats{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:6px; }
  .rs{ background:var(--white); border:1px solid var(--line); border-radius:11px; padding:12px 10px; text-align:center; }
  .rs-n{ display:block; font-family:'Prompt'; font-weight:700; font-size:1.3rem; color:var(--navy); }
  .rs-l{ display:block; font-size:0.66rem; color:var(--muted); margin-top:3px; line-height:1.3; }
  .rs-red{ background:var(--red-pastel); border-color:#F6D2D5; } .rs-red .rs-n{ color:var(--red-text); }
  .rs-yellow{ background:var(--yellow-pastel); border-color:#F5E4AE; } .rs-yellow .rs-n{ color:var(--yellow-text); }
  .rs-mint{ background:var(--mint-pastel); border-color:#BEEBD3; } .rs-mint .rs-n{ color:var(--mint-dark); }
  .registry-table{ background:var(--white); border:1px solid var(--line); border-radius:16px; box-shadow:var(--shadow); overflow:hidden; }
  .rt-head, .rt-row{ display:grid; grid-template-columns:2.1fr 1fr 1fr 1fr; gap:10px; padding:14px 18px; align-items:center; }
  .rt-head{ background:var(--body-bg); font-size:0.72rem; font-weight:600; color:var(--muted); }
  .rt-row{ border-top:1px solid var(--line); font-size:0.82rem; color:var(--ink); }
  .rt-row .danger{ color:var(--red-text); font-weight:600; }
  .pill{ display:inline-block; font-size:0.7rem; font-weight:600; padding:4px 10px; border-radius:20px; width:fit-content; }
  .pill-mint{ background:var(--mint-pastel); color:var(--mint-dark); }
  .pill-red{ background:var(--red-pastel); color:var(--red-text); }
  .registry-punch{ margin-top:38px; padding-top:28px; border-top:1px solid var(--line); }
  .registry-punch h3{ font-size:1.3rem; line-height:1.5; color:var(--navy); max-width:640px; }
  .registry-punch .hl{ color:var(--mint-dark); }

  /* FEATURES — bento */
  .features{ padding:76px 0 64px; }
  .section-head{ max-width:660px; margin-bottom:42px; }
  .kicker{ font-family:'JetBrains Mono'; font-size:0.78rem; font-weight:600; color:var(--mint-dark); text-transform:uppercase;
    letter-spacing:1px; margin-bottom:10px; display:block; }
  .features h2{ font-size:clamp(1.45rem,2.5vw,2.05rem); margin-bottom:12px; color:var(--navy); }
  .features .lede{ color:var(--muted); font-size:1.02rem; }
  .bento{ display:grid; grid-template-columns:repeat(4, 1fr); grid-auto-rows:150px; gap:16px; }
  .b-item{ position:relative; background:var(--white); border:1px solid var(--line); border-radius:16px;
    padding:22px 22px 18px; box-shadow:0 4px 14px rgba(20,32,50,0.05); display:flex; flex-direction:column;
    transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease; opacity:0; transform:translateY(14px); }
  .b-item.in-view{ animation:riseIn .55s ease forwards; }
  @keyframes riseIn{ to{ opacity:1; transform:translateY(0); } }
  .b-item:hover{ transform:translateY(-4px); box-shadow:0 14px 28px rgba(20,32,50,0.12); border-color:var(--navy); }
  .b-item.big{ grid-column:span 2; grid-row:span 2; }
  .b-item.wide{ grid-column:span 2; }
  .b-icon{ width:40px; height:40px; border-radius:11px; background:var(--mint-pastel); display:flex; align-items:center;
    justify-content:center; margin-bottom:14px; flex:none; }
  .b-icon svg{ width:21px; height:21px; stroke:var(--navy); }
  .b-item h3{ font-size:1rem; margin-bottom:6px; color:var(--navy); }
  .b-item.big h3{ font-size:1.2rem; }
  .b-item p{ font-size:0.86rem; color:var(--muted); margin:0; }
  .b-item.big p{ font-size:0.95rem; }
  .b-item .spacer{ flex:1; }
  .b-item .b-num{ font-family:'JetBrains Mono'; font-size:0.68rem; color:#B9C2CC; margin-top:auto; }

  /* COMPLIANCE */
  .compliance{ padding:70px 0; }
  .comp-box{ background:var(--navy); border-radius:18px; color:#fff; padding:44px 40px; display:grid;
    grid-template-columns:1.3fr 1fr; gap:36px; align-items:center; }
  .comp-box h2{ color:#fff; font-size:clamp(1.25rem,2.1vw,1.6rem); margin-bottom:14px; line-height:1.4; }
  .comp-box p{ color:#AEB9C8; font-size:0.95rem; margin:0; }
  .comp-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:14px; }
  .comp-list li{ display:flex; gap:12px; align-items:flex-start; font-size:0.92rem; color:#DCE4E8; }
  .comp-list .tick{ flex:none; width:20px; height:20px; border-radius:6px; background:var(--mint);
    display:flex; align-items:center; justify-content:center; margin-top:1px; }
  .comp-list .tick svg{ width:12px; height:12px; stroke:var(--navy-deep); }

  /* FINAL CTA */
  .final-cta{ padding:86px 0 96px; text-align:center; }
  .final-cta h2{ font-size:clamp(1.6rem,3.1vw,2.3rem); margin-bottom:16px; color:var(--navy); line-height:1.4; }
  .final-cta h2 .hl{ color:var(--mint-dark); }
  .final-cta p{ color:var(--muted); max-width:560px; margin:0 auto 34px; font-size:1.03rem; }
  .final-btns{ display:flex; gap:16px; justify-content:center; flex-wrap:wrap; }

  /* FOOTER */
  footer{ background:var(--navy-deep); color:#A9B4C2; padding:46px 0 30px; }
  .foot-grid{ display:grid; grid-template-columns:1.4fr 1fr 1fr; gap:36px; margin-bottom:30px; }
  .foot-brand{ margin-bottom:12px; }
  .foot-brand img{ height:28px; filter:brightness(0) invert(1); opacity:0.95; }
  .foot-col h4{ font-family:'Prompt'; color:#fff; font-size:0.92rem; margin-bottom:12px; font-weight:600; }
  .foot-col p, .foot-col a{ font-size:0.87rem; color:#8D9AAA; text-decoration:none; display:block; margin-bottom:8px; }
  .foot-col a:hover{ color:var(--mint); }
  .foot-bottom{ border-top:1px solid #2C3B52; padding-top:20px; font-size:0.8rem; color:#71809270;
    display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; }
  .placeholder{ color:var(--mint); }

  @media (max-width: 980px){
    .bento{ grid-template-columns:repeat(2,1fr); grid-auto-rows:auto; }
    .b-item.big{ grid-column:span 2; grid-row:span 1; }
    .b-item{ min-height:150px; }
  }
  @media (max-width: 880px){
    .hero .wrap{ grid-template-columns:1fr; }
    .stage{ order:-1; height:360px; margin-bottom:10px; }
    .comp-box{ grid-template-columns:1fr; }
    .foot-grid{ grid-template-columns:1fr 1fr; }
    .pillar-grid{ grid-template-columns:1fr; }
    .registry-grid{ grid-template-columns:1fr; }
  }
  @media (max-width: 700px){
    .rt-head, .rt-row{ grid-template-columns:1.6fr 1fr 1fr; font-size:0.72rem; padding:12px 12px; }
    .rt-head span:nth-child(4), .rt-row span:nth-child(4){ display:none; }
    .rt-row{ position:relative; }
    .rt-row .pill{ position:absolute; top:10px; right:12px; }
  }
  @media (max-width: 560px){
    .bento{ grid-template-columns:1fr; }
    .b-item.big, .b-item.wide{ grid-column:span 1; }
    .foot-grid{ grid-template-columns:1fr; }
    .cta-row{ flex-direction:column; align-items:stretch; }
    .btn-primary, .btn-secondary{ justify-content:center; }
    .c1,.c2,.c3,.c4,.c5{ display:none; }
    .stage{ height:300px; }
    .registry-stats{ grid-template-columns:1fr 1fr; }
    .rt-head, .rt-row{ grid-template-columns:1fr 1fr; }
    .rt-head span:nth-child(2), .rt-row span:nth-child(2){ display:none; }
  }
`;

const LANDING_BODY = `

<nav class="nav">
  <div class="wrap">
    <img class="brand-logo" src="/logo.png" alt="JorPorHub">
    <button class="nav-cta" onclick="window.__jorporGoToLogin && window.__jorporGoToLogin()">เข้าสู่ระบบ</button>
  </div>
</nav>

<header class="hero">
  <div class="wrap">
    <div>
      <div class="eyebrow">ผู้ช่วยจัดการเอกสารของ จป. ทุกระดับ</div>
      <h1 class="headline">เอกสาร จป. ยุ่งแค่ไหน<br>ให้ <span class="hl">JorPorHub</span> ช่วยจำแทนคุณ</h1>
      <p class="sub">JorPorHub ช่วยจัดการงานเอกสารที่ยุ่งยากที่สุดของ จป. — ตั้งแต่<b>บันทึก</b>ข้อมูลหน้างาน <b>ตรวจสถานที่</b>ตามรอบ ไปจนถึง<b>ติดตามความพร้อมของอุปกรณ์</b>ทุกชิ้นในทะเบียน ให้แม่นยำโดยไม่ต้องจำเอง</p>
      <div class="cta-row">
        <button class="btn-primary" onclick="window.__jorporGoToRegister && window.__jorporGoToRegister()">เริ่มต้นใช้งานฟรี</button>
        <button class="btn-secondary" onclick="document.getElementById('pillars').scrollIntoView()">ดูว่าช่วยอะไรได้บ้าง</button>
      </div>
      <div class="trust-line">
        <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/></svg>แยกข้อมูลตามองค์กร</span>
        <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16M12 4v16"/></svg>ภาษาไทยทั้งระบบ</span>
        <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>เข้าถึงได้ทุกที่</span>
      </div>
    </div>

    <div class="stage">
      <div class="clutter-label">แบบเดิม</div>
      <div class="clutter c1"><span class="ic"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#4C9A6B" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span>รายงาน_ล่าสุด.xlsx</div>
      <div class="clutter c2"><span class="ic"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#B9803A" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg></span>Fwd: แจ้งเหตุด่วน</div>
      <div class="clutter c3"><span class="ic"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#A8862A" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h5"/></svg></span>โน้ตจากหัวหน้างาน</div>
      <div class="clutter c4"><span class="ic"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#C15E68" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="1.5"/><circle cx="16" cy="7" r="2"/></svg></span>แบบฟอร์ม กท.16</div>
      <div class="clutter c5"><span class="ic"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#4A6FB0" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 01-8.6 8.4A8.7 8.7 0 015 18l-2 1 1-3a8.3 8.3 0 01-1-4A8.4 8.4 0 0111.6 3 8.5 8.5 0 0121 11.5z"/></svg></span>ไลน์กลุ่มความปลอดภัย</div>

      <div class="arrow-mid"><svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>

      <div class="mock">
        <div class="mock-header">
          <div class="greet">สวัสดี [ชื่อองค์กรคุณ]</div>
          <div class="sub2">อัปเดตล่าสุดวันนี้</div>
        </div>
        <div class="mock-grid">
          <div class="mock-card n"><div class="lbl">อุบัติเหตุในรอบ 30 วัน</div><div class="val">1</div></div>
          <div class="mock-card mint"><div class="lbl">วันไม่มีอุบัติเหตุ (LTI)</div><div class="val">1</div></div>
          <div class="mock-card yellow"><div class="lbl">PPE ใกล้หมดอายุ</div><div class="val">0</div></div>
          <div class="mock-card red"><div class="lbl">อุปกรณ์ต้องเฝ้าระวัง</div><div class="val">1</div></div>
        </div>
        <div class="mock-foot">พนักงาน 4 คน · สถานที่ 1 แห่ง · อุปกรณ์ความปลอดภัย 2 ชิ้น</div>
      </div>
      <div class="stage-tag tag-after">กับ JorPorHub</div>
    </div>
  </div>
</header>

<section class="pillars" id="pillars">
  <div class="wrap">
    <div class="section-head">
      <span class="kicker">งานที่ JorPorHub ช่วยจัดการให้</span>
      <h2>3 งานเอกสารที่กินเวลาของ จป. มากที่สุด</h2>
      <p class="lede">และวิธีที่ JorPorHub เข้ามาช่วยแต่ละงาน ให้คุณไม่ต้องจำหรือคีย์ซ้ำเอง</p>
    </div>
    <div class="pillar-grid">
      <div class="pillar-card">
        <div class="pillar-num mono">01</div>
        <div class="pillar-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5a2 2 0 012-2h8l4 4v12a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><path d="M14 3v4h4M8 12h8M8 16h5"/></svg></div>
        <h3>การบันทึก</h3>
        <p>หัวหน้างานกรอกฟอร์มอุบัติเหตุ การกระทำไม่ปลอดภัย และผลตรวจวัดสิ่งแวดล้อมได้เองจากหน้างาน จป. ไม่ต้องคีย์ซ้ำจากอีเมลหรือกระดาษอีกต่อไป</p>
        <ul class="pillar-list">
          <li>อุบัติเหตุ/เหตุการณ์</li>
          <li>การกระทำ/สภาพที่ไม่ปลอดภัย</li>
          <li>ผลตรวจวัดสิ่งแวดล้อมในการทำงาน</li>
        </ul>
      </div>
      <div class="pillar-card">
        <div class="pillar-num mono">02</div>
        <div class="pillar-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></div>
        <h3>การตรวจสถานที่</h3>
        <p>เดินตรวจตามหัวข้อมาตรฐาน 15 หัวข้อ พร้อมแนบภาพก่อน-หลังการแก้ไขในมือถือ ไม่ต้องกลับมาพิมพ์รายงานทีหลัง</p>
        <ul class="pillar-list">
          <li>ตรวจความปลอดภัย 15 หัวข้อมาตรฐาน</li>
          <li>Pre-work Checklist งานเสี่ยงสูง</li>
          <li>แนบภาพก่อน-หลังครบทุกเคส</li>
        </ul>
      </div>
      <div class="pillar-card is-lead">
        <div class="pillar-num mono">03</div>
        <div class="pillar-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l2.5 2.5"/></svg></div>
        <h3>ติดตามความพร้อมของอุปกรณ์ในทะเบียน</h3>
        <p>ระบบจำวันครบกำหนดของอุปกรณ์ทุกชิ้นแทนคุณ — PPE ใกล้หมดอายุ เครื่องจักรใกล้ถึงรอบตรวจ อุปกรณ์เซฟตี้ที่ต้องตรวจซ้ำ แจ้งเตือนล่วงหน้าเสมอ ไม่ต้องจำเองอีกต่อไป</p>
        <ul class="pillar-list">
          <li>PPE &amp; อุปกรณ์เซฟตี้ 9 หมวด</li>
          <li>ทะเบียนเครื่องจักร + ใบรับรอง</li>
          <li>ทะเบียนสารเคมี + SDS</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<section class="registry">
  <div class="wrap">
    <div class="registry-grid">
      <div>
        <span class="kicker">ไม่มีวันลืมอีกต่อไป</span>
        <h2>ระบบจำวันครบกำหนดของอุปกรณ์ทุกชิ้นแทนคุณ</h2>
        <p class="lede" style="margin-bottom:22px;">ไม่ว่าจะเป็น PPE เครื่องจักร หรืออุปกรณ์เซฟตี้ในทะเบียน — เห็นภาพรวมทั้งหมด พร้อมสถานะและวันครบกำหนดถัดไป ในหน้าเดียว ก่อนจะถึงวันที่สายเกินไป</p>
        <div class="registry-stats">
          <div class="rs"><span class="rs-n">2</span><span class="rs-l">อุปกรณ์ทั้งหมด</span></div>
          <div class="rs rs-red"><span class="rs-n">1</span><span class="rs-l">รอตรวจซ้ำ</span></div>
          <div class="rs rs-yellow"><span class="rs-n">0</span><span class="rs-l">ใกล้ครบกำหนด</span></div>
          <div class="rs rs-mint"><span class="rs-n">1</span><span class="rs-l">ปกติ</span></div>
        </div>
      </div>
      <div class="registry-table">
        <div class="rt-head">
          <span>อุปกรณ์ / รหัส</span><span>รอบตรวจ</span><span>กำหนดถัดไป</span><span>สถานะ</span>
        </div>
        <div class="rt-row">
          <span>ชุดช่วยหายใจ SCBA · Sctav3000</span><span>ทุก 3 เดือน</span><span>25 ต.ค. 2569</span><span class="pill pill-mint">ปกติ</span>
        </div>
        <div class="rt-row">
          <span>ถังดับเพลิง · s01</span><span>ทุก 6 เดือน</span><span class="danger">1 ส.ค. 2569</span><span class="pill pill-red">รอตรวจซ้ำ</span>
        </div>
      </div>
    </div>
    <div class="registry-punch">
      <h3>งานของ จป. คือป้องกันอุบัติเหตุ <span class="hl">ไม่ใช่ตามหาไฟล์เก่า</span></h3>
    </div>
  </div>
</section>

<section class="features" id="features">
  <div class="wrap">
    <div class="section-head">
      <span class="kicker">มากกว่านั้น</span>
      <h2>และยังช่วยเรื่องอื่นที่ จป. ต้องดูแลด้วย</h2>
      <p class="lede">นอกจาก 3 งานหลักด้านบน ระบบยังครอบคลุมงานที่เกี่ยวข้องกันไว้ในที่เดียว</p>
    </div>
    <div class="bento" id="bentoGrid">
      <div class="b-item wide">
        <div class="b-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5a2 2 0 012-2h8l4 4v12a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><path d="M14 3v4h4M8 13h8M8 17h5"/></svg></div>
        <h3>รายงานราชการ</h3><p>จัดทำ กท.16, สปร.5 คำนวณ IFR/ISR อัตโนมัติจากข้อมูลที่บันทึกไว้แล้ว ส่งออกเป็น Excel หลายชีตพร้อมยื่น ไม่ต้องคำนวณมือ</p>
      </div>
      <div class="b-item">
        <div class="b-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4L2 8l10 4 10-4-10-4z"/><path d="M6 10v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></svg></div>
        <h3>Training Matrix</h3><p>แจ้งเตือนหลักสูตรที่ยังไม่ผ่าน</p>
      </div>
      <div class="b-item">
        <div class="b-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M8 4v14"/></svg></div>
        <h3>Dashboard ภาพรวม</h3><p>สถานะความปลอดภัยทั้งองค์กรในหน้าเดียว</p>
      </div>
    </div>
  </div>
</section>

<section class="compliance">
  <div class="wrap">
    <div class="comp-box">
      <div>
        <h2>ไม่ว่าคุณจะเป็น จป. ระดับไหน กฎหมายก็ครบในระบบเดียว</h2>
        <p>ออกแบบให้ตรงตามกฎกระทรวงกำหนดมาตรฐานในการบริหารและการจัดการด้านความปลอดภัยฯ พ.ศ. 2565 ครอบคลุมหน้าที่ที่กฎหมายกำหนดไว้ให้ครบ ไม่ว่าองค์กรของคุณจะมี จป.บริหาร จป.หัวหน้างาน จป.เทคนิค จป.เทคนิคขั้นสูง หรือ จป.วิชาชีพ</p>
      </div>
      <ul class="comp-list">
        <li><span class="tick"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><path d="M4 12l5 5L20 6"/></svg></span>รองรับ คปอ. และการประชุมความปลอดภัย</li>
        <li><span class="tick"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><path d="M4 12l5 5L20 6"/></svg></span>ครอบคลุม Work Permit, LOTO, SCBA, GHS/SDS</li>
        <li><span class="tick"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><path d="M4 12l5 5L20 6"/></svg></span>แยกข้อมูลตามองค์กร ปลอดภัยตามมาตรฐาน</li>
      </ul>
    </div>
  </div>
</section>

<section class="final-cta" id="cta">
  <div class="wrap">
    <h2>ให้ จป. จำแค่เรื่องสำคัญ<br><span class="hl">ปล่อยให้ระบบจำวันครบกำหนดแทนคุณ</span></h2>
    <p>ทดลองใช้ฟรี พร้อมทีมงานช่วยตั้งค่าข้อมูลเริ่มต้นให้องค์กรของคุณ ไม่มีข้อผูกมัด</p>
    <div class="final-btns">
      <button class="btn-primary" onclick="window.__jorporGoToLogin && window.__jorporGoToLogin()">ขอสาธิตระบบฟรี</button>
      <button class="btn-secondary">ดาวน์โหลดโบรชัวร์ฉบับเต็ม</button>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <div class="foot-brand"><img src="/logo-light.png" alt="JorPorHub"></div>
        <p>ระบบบริหารจัดการงานความปลอดภัย อาชีวอนามัย และสภาพแวดล้อมในการทำงาน สำหรับสถานประกอบการไทย</p>
      </div>
      <div class="foot-col">
        <h4>ติดต่อเรา</h4>
        <a href="#" class="placeholder">[ใส่เบอร์โทรของคุณ]</a>
        <a href="#" class="placeholder">[ใส่อีเมลของคุณ]</a>
        <a href="#" class="placeholder">[ใส่ไลน์/เว็บไซต์]</a>
      </div>
      <div class="foot-col">
        <h4>บริษัท</h4>
        <a href="#">ฟีเจอร์ทั้งหมด</a>
        <a href="#">แผนราคา</a>
        <a href="#" onclick="event.preventDefault(); window.__jorporGoToLogin && window.__jorporGoToLogin()">ขอสาธิตระบบ</a>
      </div>
    </div>
    <div class="foot-bottom">
      <span>© 2026 JorPorHub — พัฒนาสำหรับสถานประกอบการไทย</span>
      <span class="placeholder">[เพิ่มเลขทะเบียนบริษัท/ที่อยู่ของคุณที่นี่]</span>
    </div>
  </div>
</footer>

<script>
  const bItems = document.querySelectorAll('.b-item');
  const io = new IntersectionObserver((entries)=>{
    entries.forEach((e, idx)=>{
      if(e.isIntersecting){
        e.target.style.animationDelay = (idx % 4) * 0.07 + 's';
        e.target.classList.add('in-view');
        io.unobserve(e.target);
      }
    });
  }, {threshold:0.12});
  bItems.forEach(el=>io.observe(el));

  window.addEventListener('scroll', ()=>{
    const nav = document.querySelector('.nav');
    nav.style.background = window.scrollY > 12 ? 'rgba(247,249,251,0.97)' : 'rgba(247,249,251,0.88)';
  });
</script>

`;

export default function LandingPage({ onGoToLogin, onGoToRegister }) {
  useEffect(() => {
    // ปุ่มต่างๆ ในหน้านี้เป็น HTML ดิบ (dangerouslySetInnerHTML) เรียก onclick ผ่านฟังก์ชัน
    // ที่ผูกไว้กับ window ชั่วคราว เพราะ React event handler ปกติใช้กับ HTML ดิบแบบนี้ไม่ได้
    window.__jorporGoToLogin = onGoToLogin;
    window.__jorporGoToRegister = onGoToRegister;

    // ย้ายมาจาก <script> เดิมในไฟล์ต้นฉบับ (dangerouslySetInnerHTML ไม่รัน <script> ที่ฝังมาด้วย)
    const bItems = document.querySelectorAll(".b-item");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e, idx) => {
          if (e.isIntersecting) {
            e.target.style.animationDelay = (idx % 4) * 0.07 + "s";
            e.target.classList.add("in-view");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    bItems.forEach((el) => io.observe(el));

    const onScroll = () => {
      const nav = document.querySelector(".nav");
      if (nav) nav.style.background = window.scrollY > 12 ? "rgba(247,249,251,0.97)" : "rgba(247,249,251,0.88)";
    };
    window.addEventListener("scroll", onScroll);

    return () => {
      delete window.__jorporGoToLogin;
      delete window.__jorporGoToRegister;
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, [onGoToLogin, onGoToRegister]);

  return (
    <>
      <style>{LANDING_STYLE}</style>
      <div dangerouslySetInnerHTML={{ __html: LANDING_BODY }} />
    </>
  );
}
