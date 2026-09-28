import{r as i,j as e,f as w,C as v,ab as k,ae as z,q as C,a7 as S,L as E,E as N,a as R,A as I,l as B}from"./vendor-react-V2Q5292L.js";import{a as L}from"./index-2FxKWQBV.js";import"./vendor-socket-SYmKJpIj.js";function G({onLoginSuccess:c,onSwitchToStaff:p}){const[a,f]=i.useState(""),[s,x]=i.useState(""),[n,u]=i.useState(!1),[o,m]=i.useState(!1),[g,l]=i.useState(""),[h,b]=i.useState(!1),y=async r=>{if(r.preventDefault(),!a.trim()||!s.trim()){l("Please enter both your registered mobile number and password.");return}m(!0),l("");try{const d=await L.clientLogin({mobile:a.trim(),password:s.trim()});c&&c(d)}catch(d){l(d.message||"Login failed. Please verify your mobile number and password.")}finally{m(!1)}},j=()=>{const r=`${window.location.origin}/#client-login`;navigator.clipboard.writeText(r).then(()=>{b(!0),setTimeout(()=>b(!1),2500)})};return e.jsxs("div",{className:"client-login-container",style:t.container,children:[e.jsx("style",{children:`
        .client-login-container {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at 50% 0%, #dbeafe 0%, #eff6ff 45%, #f8fafc 100%);
          position: relative;
          overflow: hidden;
          padding: 1.5rem;
          box-sizing: border-box;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .client-login-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 440px;
          padding: 2.5rem 2rem;
          border-radius: 24px;
          background: #ffffff;
          border: 1px solid #dbeafe;
          box-shadow: 0 20px 45px -12px rgba(37, 99, 235, 0.15), 0 0 0 1px rgba(219, 234, 254, 0.8);
          box-sizing: border-box;
          transition: transform 0.2s ease;
        }
        .client-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          background: #f8fafc;
          border: 1.5px solid #cbd5e1;
          border-radius: 12px;
          transition: all 0.2s ease;
          overflow: hidden;
        }
        .client-input-wrapper:focus-within {
          border-color: #2563eb !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.16) !important;
        }
        .client-input-field {
          width: 100%;
          padding: 0.85rem 1rem 0.85rem 2.6rem;
          background: transparent;
          border: none;
          color: #0f172a;
          font-size: 16px; /* Prevents auto-zoom on iOS Safari */
          font-weight: 600;
          outline: none;
          box-sizing: border-box;
        }
        .client-input-field::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }
        .client-btn-primary {
          margin-top: 0.5rem;
          padding: 0.9rem 1.25rem;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          font-size: 0.96rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          box-shadow: 0 6px 20px rgba(37, 99, 235, 0.35);
          cursor: pointer;
          transition: all 0.18s ease;
          width: 100%;
          box-sizing: border-box;
        }
        .client-btn-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          box-shadow: 0 8px 25px rgba(37, 99, 235, 0.45);
          transform: translateY(-1px);
        }
        .client-btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }
        .client-copy-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          padding: 0.35rem 0.65rem;
          color: #2563eb;
          font-size: 0.72rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .client-copy-btn:hover {
          background: #dbeafe;
          border-color: #93c5fd;
          color: #1d4ed8;
        }
        @media (max-width: 480px) {
          .client-login-container {
            padding: 1rem 0.75rem !important;
          }
          .client-login-card {
            padding: 1.75rem 1.15rem !important;
            border-radius: 20px !important;
          }
          .client-title {
            font-size: 1.5rem !important;
          }
          .client-subtitle {
            font-size: 0.82rem !important;
          }
          .client-logo-badge {
            width: 52px !important;
            height: 52px !important;
            border-radius: 15px !important;
            margin-bottom: 0.85rem !important;
          }
        }
      `}),e.jsx("div",{style:t.bgGlowTop}),e.jsx("div",{style:t.bgGlowBottom}),e.jsxs("div",{className:"client-login-card",children:[e.jsxs("div",{style:t.badgeRow,children:[e.jsxs("div",{style:t.badge,children:[e.jsx(w,{size:13,color:"#2563eb"}),e.jsx("span",{children:"CLIENT & PARTNER PORTAL"})]}),e.jsx("button",{type:"button",onClick:j,className:"client-copy-btn",title:"Copy direct link for clients",children:h?e.jsxs(e.Fragment,{children:[e.jsx(v,{size:13,color:"#2563eb"}),e.jsx("span",{children:"Link Copied!"})]}):e.jsxs(e.Fragment,{children:[e.jsx(k,{size:13,color:"#2563eb"}),e.jsx("span",{children:"Copy Link"})]})})]}),e.jsxs("div",{style:t.header,children:[e.jsx("div",{className:"client-logo-badge",style:t.logoBadge,children:e.jsx(z,{size:30,color:"#ffffff"})}),e.jsx("h2",{className:"client-title",style:t.title,children:"Elite Edition"}),e.jsx("p",{className:"client-subtitle",style:t.subtitle,children:"Client Order & Design Tracking Portal"})]}),g&&e.jsxs("div",{style:t.errorContainer,children:[e.jsx(C,{size:16,color:"#dc2626",style:{flexShrink:0}}),e.jsx("span",{children:g})]}),e.jsxs("form",{onSubmit:y,style:t.form,children:[e.jsxs("div",{style:t.inputGroup,children:[e.jsx("label",{style:t.label,children:"Registered Mobile Number"}),e.jsxs("div",{className:"client-input-wrapper",children:[e.jsx(S,{size:17,style:t.inputIcon}),e.jsx("input",{type:"tel",value:a,onChange:r=>f(r.target.value),placeholder:"e.g. 9876543210",className:"client-input-field",autoFocus:!0,required:!0,autoComplete:"tel"})]})]}),e.jsxs("div",{style:t.inputGroup,children:[e.jsx("label",{style:t.label,children:"Password"}),e.jsxs("div",{className:"client-input-wrapper",children:[e.jsx(E,{size:17,style:t.inputIcon}),e.jsx("input",{type:n?"text":"password",value:s,onChange:r=>x(r.target.value),placeholder:"••••••••",className:"client-input-field",style:{paddingRight:"2.8rem"},required:!0,autoComplete:"current-password"}),e.jsx("button",{type:"button",onClick:()=>u(!n),style:t.eyeBtn,title:n?"Hide password":"Show password",children:n?e.jsx(N,{size:17,color:"#64748b"}):e.jsx(R,{size:17,color:"#64748b"})})]})]}),e.jsx("button",{type:"submit",disabled:o,className:"client-btn-primary",style:{opacity:o?.75:1,cursor:o?"not-allowed":"pointer"},children:o?e.jsx("span",{style:t.spinner}):e.jsxs(e.Fragment,{children:[e.jsx("span",{children:"Access Client Portal"}),e.jsx(I,{size:18})]})})]}),e.jsxs("div",{style:t.footer,children:[e.jsxs("div",{style:t.securityNote,children:[e.jsx(B,{size:15,color:"#2563eb"}),e.jsx("span",{children:"End-to-End Encrypted Secure Portal"})]}),p&&e.jsxs("button",{type:"button",onClick:p,style:t.switchBtn,children:["Are you staff or admin? ",e.jsx("strong",{style:{color:"#2563eb"},children:"Go to Staff Login →"})]})]})]})]})}const t={container:{},bgGlowTop:{position:"absolute",top:"-20%",left:"50%",transform:"translateX(-50%)",width:"700px",height:"450px",background:"radial-gradient(circle, rgba(37, 99, 235, 0.12) 0%, rgba(239, 246, 255, 0) 70%)",pointerEvents:"none",zIndex:0},bgGlowBottom:{position:"absolute",bottom:"-15%",right:"10%",width:"600px",height:"400px",background:"radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, rgba(248, 250, 252, 0) 70%)",pointerEvents:"none",zIndex:0},badgeRow:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"0.5rem",marginBottom:"1.5rem",flexWrap:"wrap"},badge:{display:"inline-flex",alignItems:"center",gap:"0.45rem",padding:"0.35rem 0.75rem",borderRadius:"20px",background:"rgba(37, 99, 235, 0.08)",border:"1px solid rgba(37, 99, 235, 0.25)",color:"#1d4ed8",fontSize:"0.72rem",fontWeight:800,letterSpacing:"0.04em"},header:{textAlign:"center",marginBottom:"1.75rem"},logoBadge:{width:"60px",height:"60px",borderRadius:"18px",background:"linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 1rem auto",boxShadow:"0 10px 22px rgba(37, 99, 235, 0.28)"},title:{fontSize:"1.75rem",fontWeight:800,color:"#0f172a",margin:"0 0 0.4rem 0",letterSpacing:"-0.02em"},subtitle:{fontSize:"0.88rem",color:"#64748b",margin:0,lineHeight:1.45},errorContainer:{display:"flex",alignItems:"center",gap:"0.65rem",background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",padding:"0.8rem 1rem",borderRadius:"12px",fontSize:"0.83rem",marginBottom:"1.35rem",lineHeight:1.35},form:{display:"flex",flexDirection:"column",gap:"1.15rem"},inputGroup:{display:"flex",flexDirection:"column",gap:"0.45rem"},label:{fontSize:"0.74rem",fontWeight:700,color:"#1e3a8a",textTransform:"uppercase",letterSpacing:"0.04em"},inputIcon:{position:"absolute",left:"12px",color:"#2563eb",pointerEvents:"none"},eyeBtn:{position:"absolute",right:"10px",background:"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:"5px"},spinner:{width:"18px",height:"18px",border:"2px solid rgba(255, 255, 255, 0.35)",borderTopColor:"#ffffff",borderRadius:"50%",animation:"spin 0.8s linear infinite"},footer:{marginTop:"1.75rem",display:"flex",flexDirection:"column",alignItems:"center",gap:"0.85rem",borderTop:"1px solid #e2e8f0",paddingTop:"1.25rem"},securityNote:{display:"flex",alignItems:"center",gap:"0.45rem",fontSize:"0.78rem",color:"#64748b"},switchBtn:{background:"none",border:"none",color:"#64748b",fontSize:"0.82rem",cursor:"pointer",padding:"5px 10px",borderRadius:"6px",transition:"color 0.15s ease"}};export{G as default};
