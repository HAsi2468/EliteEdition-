import{r as i,j as e,i as pe,X as F,aF as oe,aS as _,s as me,a2 as de,ag as ae,Q as se,f as ce,aT as ie,T as le,aY as fe,S as ue,P as ge}from"./vendor-react-CHHTaQIC.js";import{m as he}from"./searchUtils-CJ8GV7sK.js";import{S as xe}from"./SmartThumbnail-DBQq_Y9J.js";import{M as be,E as B,R as ye,g as we}from"./ErpTableParts-sVa26Hgn.js";import"./imageUrlHelper-CFNAPFYG.js";function Ce({existingBrands:x=[],customBrands:p,onAddBrand:G,onDeleteBrand:V,onUpdateBrand:Z,onClose:ee}){const[U,Y]=i.useState(""),[u,I]=i.useState(""),[N,g]=i.useState(""),[v,l]=i.useState(""),[E,j]=i.useState(null),[L,O]=i.useState(""),J=i.useRef(0);i.useEffect(()=>(J.current=window.scrollY||document.documentElement.scrollTop||0,()=>{const r=J.current;typeof window<"u"&&r>0&&(window.scrollTo({top:r,behavior:"instant"}),setTimeout(()=>window.scrollTo({top:r,behavior:"instant"}),30),setTimeout(()=>window.scrollTo({top:r,behavior:"instant"}),100),setTimeout(()=>window.scrollTo({top:r,behavior:"instant"}),300))}),[]);const P=r=>{r&&r.preventDefault&&r.preventDefault(),r&&r.stopPropagation&&r.stopPropagation(),document.activeElement&&typeof document.activeElement.blur=="function"&&document.activeElement.blur();const a=J.current||window.scrollY||0;ee&&ee(),typeof window<"u"&&a>0&&(window.scrollTo({top:a,behavior:"instant"}),requestAnimationFrame(()=>window.scrollTo({top:a,behavior:"instant"})),setTimeout(()=>window.scrollTo({top:a,behavior:"instant"}),30),setTimeout(()=>window.scrollTo({top:a,behavior:"instant"}),100),setTimeout(()=>window.scrollTo({top:a,behavior:"instant"}),300))},[b,X]=i.useState("brands"),[S,q]=i.useState(()=>{if(Array.isArray(p)&&p.length>0)return p;try{const r=localStorage.getItem("elite_managed_brands");return r?JSON.parse(r):["ANOUK","ELITE EDITION","HERA","MYNTRA"]}catch{return["ANOUK","ELITE EDITION","HERA","MYNTRA"]}}),[R,D]=i.useState(""),[te,W]=i.useState(null),[$,M]=i.useState(""),[C,re]=i.useState(()=>{try{const r=localStorage.getItem("elite_managed_categories");return r?JSON.parse(r):["KURTA SET","CO-ORD SET","DRESS","SUIT","SAREE","LEHENGA","TOP","BOTTOM","ETHNIC","STITCHING SET"]}catch{return["KURTA SET","CO-ORD SET","DRESS","SUIT","SAREE","LEHENGA","TOP","BOTTOM"]}}),K=r=>{re(r);try{localStorage.setItem("elite_managed_categories",JSON.stringify(r)),window.dispatchEvent(new Event("storage")),window.dispatchEvent(new CustomEvent("elite_categories_updated",{detail:r}))}catch{}},k=r=>{r.preventDefault(),g(""),l("");const a=R.trim().toUpperCase();if(!a){g("Category name cannot be empty.");return}if(C.some(m=>m.toLowerCase()===a.toLowerCase())){g(`Category "${a}" already exists.`);return}const c=[...C,a];K(c),D(""),l(`Category "${a}" added successfully.`),setTimeout(()=>l(""),3e3)},ne=r=>{if(!window.confirm(`Delete custom category "${r}"?`))return;g(""),l("");const a=C.filter(c=>c.toLowerCase()!==r.toLowerCase());K(a),l(`Category "${r}" removed.`),setTimeout(()=>l(""),3e3)},t=r=>{const a=$.trim().toUpperCase();if(!a){g("Category name cannot be empty.");return}if(a!==r.toUpperCase()&&C.some(m=>m.toLowerCase()===a.toLowerCase())){g(`Category "${a}" already exists.`);return}const c=C.map(m=>m.toLowerCase()===r.toLowerCase()?a:m);K(c),W(null),l(`Updated category to "${a}".`),setTimeout(()=>l(""),3e3)};i.useEffect(()=>{Array.isArray(p)&&p.length>0&&q(p)},[p]),i.useEffect(()=>{const r=a=>{a.key==="Escape"&&P(a)};return window.addEventListener("keydown",r),()=>window.removeEventListener("keydown",r)},[]);const o=i.useMemo(()=>Array.isArray(x)?x.filter(Boolean):[],[x]),s=i.useMemo(()=>{const r=new Set;return[...S,...o].forEach(a=>{a&&typeof a=="string"&&r.add(a.toUpperCase())}),Array.from(r).sort()},[S,o]),f=i.useMemo(()=>u.trim()?s.filter(r=>r.toLowerCase().includes(u.trim().toLowerCase())):s,[s,u]),w=i.useMemo(()=>u.trim()?C.filter(r=>r.toLowerCase().includes(u.trim().toLowerCase())):C,[C,u]),h=r=>{q(r);try{localStorage.setItem("elite_managed_brands",JSON.stringify(r)),window.dispatchEvent(new Event("storage")),window.dispatchEvent(new CustomEvent("elite_brands_updated",{detail:r}))}catch(a){console.error("Failed to save brands to localStorage",a)}},y=r=>{r.preventDefault(),g(""),l("");const a=U.trim().toUpperCase();if(!a){g("Brand name cannot be empty.");return}if(s.some(m=>m.toLowerCase()===a.toLowerCase())){g(`Brand "${a}" already exists.`);return}const c=[...S,a];h(c),G&&G(a),Y(""),l(`Brand "${a}" added successfully.`),setTimeout(()=>l(""),3e3)},T=r=>{if(!window.confirm(`Delete custom brand "${r}"?`))return;g(""),l("");const a=S.filter(c=>c.toLowerCase()!==r.toLowerCase());h(a),V&&V(r),l(`Brand "${r}" removed.`),setTimeout(()=>l(""),3e3)},z=r=>{j(r),O(r),g("")},H=r=>{const a=L.trim().toUpperCase();if(!a){g("Brand name cannot be empty.");return}if(a!==r.toUpperCase()&&s.some(m=>m.toLowerCase()===a.toLowerCase())){g(`Brand "${a}" already exists.`);return}const c=S.map(m=>m.toLowerCase()===r.toLowerCase()?a:m);h(c),Z&&Z(r,a),j(null),l(`Updated to "${a}".`),setTimeout(()=>l(""),3e3)},Q=e.jsx("div",{className:"modal-overlay",style:n.overlay,onClick:P,children:e.jsxs("div",{style:n.container,onClick:r=>r.stopPropagation(),children:[e.jsxs("div",{style:n.header,children:[e.jsxs("div",{style:n.headerTitleGroup,children:[e.jsxs("div",{style:n.badge,children:[e.jsx(pe,{size:13,style:{marginRight:"4px"}}),"DYNAMIC CATALOG SETTINGS"]}),e.jsx("h2",{style:n.title,children:"Manage Catalog Brands & Categories"})]}),e.jsx("button",{type:"button",onClick:P,style:n.closeBtn,title:"Close Modal (Esc)",children:e.jsx(F,{size:18})})]}),e.jsxs("div",{style:{display:"flex",gap:"0.5rem",padding:"0.6rem 1.5rem",background:"#f8fafc",borderBottom:"1px solid #e2e8f0",flexWrap:"wrap"},children:[e.jsxs("button",{type:"button",onClick:()=>{X("brands"),g(""),l(""),I("")},style:{display:"flex",alignItems:"center",gap:"0.4rem",padding:"0.45rem 1rem",borderRadius:"8px",border:b==="brands"?"1.5px solid #2563eb":"1px solid #cbd5e1",background:b==="brands"?"#eff6ff":"#ffffff",color:b==="brands"?"#1d4ed8":"#64748b",fontWeight:700,fontSize:"0.82rem",cursor:"pointer"},children:[e.jsx(oe,{size:14,color:b==="brands"?"#2563eb":"#64748b"}),e.jsxs("span",{children:["Manage Brands (",s.length,")"]})]}),e.jsxs("button",{type:"button",onClick:()=>{X("categories"),g(""),l(""),I("")},style:{display:"flex",alignItems:"center",gap:"0.4rem",padding:"0.45rem 1rem",borderRadius:"8px",border:b==="categories"?"1.5px solid #059669":"1px solid #cbd5e1",background:b==="categories"?"#ecfdf5":"#ffffff",color:b==="categories"?"#047857":"#64748b",fontWeight:700,fontSize:"0.82rem",cursor:"pointer"},children:[e.jsx(_,{size:14,color:b==="categories"?"#059669":"#64748b"}),e.jsxs("span",{children:["Manage Categories (",C.length,")"]})]})]}),e.jsx("div",{style:n.statsStrip,children:b==="brands"?e.jsxs(e.Fragment,{children:[e.jsxs("div",{style:n.statBox,children:[e.jsx("span",{style:n.statLabel,children:"TOTAL BRANDS"}),e.jsx("span",{style:n.statValue,children:s.length})]}),e.jsx("div",{style:n.statDivider}),e.jsxs("div",{style:n.statBox,children:[e.jsx("span",{style:n.statLabel,children:"CUSTOM BRANDS"}),e.jsx("span",{style:n.statValueCustom,children:S.length})]}),e.jsx("div",{style:n.statDivider}),e.jsxs("div",{style:n.statBox,children:[e.jsx("span",{style:n.statLabel,children:"CATALOG BRANDS"}),e.jsx("span",{style:n.statValueCat,children:o.length})]})]}):e.jsxs(e.Fragment,{children:[e.jsxs("div",{style:n.statBox,children:[e.jsx("span",{style:n.statLabel,children:"TOTAL CATEGORIES"}),e.jsx("span",{style:{...n.statValue,color:"#059669"},children:C.length})]}),e.jsx("div",{style:n.statDivider}),e.jsxs("div",{style:n.statBox,children:[e.jsx("span",{style:n.statLabel,children:"ACTIVE GARMENT TYPES"}),e.jsx("span",{style:n.statValueCustom,children:"All Dynamic"})]})]})}),e.jsxs("div",{style:n.body,children:[N&&e.jsxs("div",{style:n.alertError,children:[e.jsx(me,{size:14,style:{flexShrink:0}}),e.jsx("span",{children:N})]}),v&&e.jsxs("div",{style:n.alertSuccess,children:[e.jsx(de,{size:14,style:{flexShrink:0}}),e.jsx("span",{children:v})]}),b==="brands"&&e.jsxs(e.Fragment,{children:[e.jsx("form",{onSubmit:y,style:n.addForm,children:e.jsxs("div",{style:n.inputGroup,children:[e.jsx(oe,{size:18,color:"#2563eb",style:{marginLeft:"10px",flexShrink:0}}),e.jsx("input",{type:"text",value:U,onChange:r=>Y(r.target.value),placeholder:"Type new brand name (e.g. ZARA, HERA, MYNTRA)...",style:n.input,autoFocus:!0}),e.jsxs("button",{type:"submit",style:n.addBtn,children:[e.jsx(ae,{size:15}),e.jsx("span",{children:"Add Brand"})]})]})}),e.jsxs("div",{style:n.searchWrap,children:[e.jsx(se,{size:15,color:"#64748b",style:{marginLeft:"10px",flexShrink:0}}),e.jsx("input",{type:"text",value:u,onChange:r=>I(r.target.value),placeholder:"Search brand list...",style:n.searchInput}),u&&e.jsx("button",{onClick:()=>I(""),style:n.clearSearchBtn,title:"Clear Search",children:e.jsx(F,{size:13})})]}),e.jsx("div",{style:n.sectionHeader,children:e.jsxs("span",{children:["ACTIVE BRANDS DIRECTORY (",f.length,")"]})}),e.jsx("div",{style:n.brandsGrid,children:f.length===0?e.jsxs("div",{style:n.emptyState,children:[e.jsx(_,{size:24,color:"#94a3b8"}),e.jsx("p",{style:{margin:"0.3rem 0 0 0",fontSize:"0.82rem",color:"#64748b"},children:u?`No brands matching "${u}"`:"No active brands available."})]}):f.map((r,a)=>{const c=S.some(A=>A.toLowerCase()===r.toLowerCase());return E===r?e.jsxs("div",{style:n.brandChipEditing,children:[e.jsx("input",{type:"text",value:L,onChange:A=>O(A.target.value),style:n.editInput,autoFocus:!0,onKeyDown:A=>{A.key==="Enter"&&H(r),A.key==="Escape"&&j(null)}}),e.jsx("button",{type:"button",onClick:()=>H(r),style:n.saveBtn,title:"Save Brand Name",children:e.jsx(ce,{size:13,color:"#ffffff"})}),e.jsx("button",{type:"button",onClick:()=>j(null),style:n.cancelBtn,title:"Cancel Editing",children:e.jsx(F,{size:13,color:"#64748b"})})]},`edit-${a}`):e.jsxs("div",{style:c?n.brandChipCustom:n.brandChip,children:[e.jsxs("div",{style:n.brandChipLeft,children:[e.jsx(_,{size:13,color:c?"#2563eb":"#64748b"}),e.jsx("span",{style:c?n.brandNameCustom:n.brandName,children:r})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"0.3rem"},children:[e.jsx("span",{style:c?n.customBadge:n.catBadge,children:c?"Custom":"Catalog"}),c&&e.jsxs(e.Fragment,{children:[e.jsx("button",{type:"button",onClick:()=>z(r),style:n.actionIconBtn,title:`Rename ${r}`,children:e.jsx(ie,{size:13,color:"#2563eb"})}),e.jsx("button",{type:"button",onClick:()=>T(r),style:n.actionIconBtn,title:`Delete ${r}`,children:e.jsx(le,{size:13,color:"#ef4444"})})]})]})]},`brand-${a}`)})})]}),b==="categories"&&e.jsxs(e.Fragment,{children:[e.jsx("form",{onSubmit:k,style:n.addForm,children:e.jsxs("div",{style:n.inputGroup,children:[e.jsx(_,{size:18,color:"#059669",style:{marginLeft:"10px",flexShrink:0}}),e.jsx("input",{type:"text",value:R,onChange:r=>D(r.target.value),placeholder:"Type new category name (e.g. DRESS, LEHENGA, SAREE)...",style:n.input,autoFocus:!0}),e.jsxs("button",{type:"submit",style:{...n.addBtn,background:"#059669"},children:[e.jsx(ae,{size:15}),e.jsx("span",{children:"Add Category"})]})]})}),e.jsxs("div",{style:n.searchWrap,children:[e.jsx(se,{size:15,color:"#64748b",style:{marginLeft:"10px",flexShrink:0}}),e.jsx("input",{type:"text",value:u,onChange:r=>I(r.target.value),placeholder:"Search category list...",style:n.searchInput}),u&&e.jsx("button",{onClick:()=>I(""),style:n.clearSearchBtn,title:"Clear Search",children:e.jsx(F,{size:13})})]}),e.jsx("div",{style:n.sectionHeader,children:e.jsxs("span",{children:["ACTIVE CATEGORIES DIRECTORY (",w.length,")"]})}),e.jsx("div",{style:n.brandsGrid,children:w.length===0?e.jsxs("div",{style:n.emptyState,children:[e.jsx(_,{size:24,color:"#94a3b8"}),e.jsx("p",{style:{margin:"0.3rem 0 0 0",fontSize:"0.82rem",color:"#64748b"},children:u?`No categories matching "${u}"`:"No categories available."})]}):w.map((r,a)=>te===r?e.jsxs("div",{style:{...n.brandChipEditing,borderColor:"#059669"},children:[e.jsx("input",{type:"text",value:$,onChange:m=>M(m.target.value),style:n.editInput,autoFocus:!0,onKeyDown:m=>{m.key==="Enter"&&t(r),m.key==="Escape"&&W(null)}}),e.jsx("button",{type:"button",onClick:()=>t(r),style:{...n.saveBtn,background:"#059669"},title:"Save Category Name",children:e.jsx(ce,{size:13,color:"#ffffff"})}),e.jsx("button",{type:"button",onClick:()=>W(null),style:n.cancelBtn,title:"Cancel Editing",children:e.jsx(F,{size:13,color:"#64748b"})})]},`edit-cat-${a}`):e.jsxs("div",{style:{...n.brandChipCustom,background:"#ecfdf5",borderColor:"#a7f3d0"},children:[e.jsxs("div",{style:n.brandChipLeft,children:[e.jsx(_,{size:13,color:"#059669"}),e.jsx("span",{style:{...n.brandNameCustom,color:"#047857"},children:r})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"0.3rem"},children:[e.jsx("button",{type:"button",onClick:()=>{W(r),M(r),g("")},style:n.actionIconBtn,title:`Rename ${r}`,children:e.jsx(ie,{size:13,color:"#059669"})}),e.jsx("button",{type:"button",onClick:()=>ne(r),style:n.actionIconBtn,title:`Delete ${r}`,children:e.jsx(le,{size:13,color:"#ef4444"})})]})]},`cat-${a}`))})]})]}),e.jsx("div",{style:n.footer,children:e.jsxs("button",{type:"button",onClick:P,style:n.doneBtn,children:[e.jsx(de,{size:15}),e.jsx("span",{children:"Done"})]})})]})});return typeof document<"u"&&document.body?fe.createPortal(Q,document.body):Q}if(typeof document<"u"){const x="brand-manager-modal-responsive-style";if(!document.getElementById(x)){const p=document.createElement("style");p.id=x,p.innerHTML=`
      @media (max-width: 768px) {
        .brand-manager-container {
          width: 95vw !important;
          max-width: 95vw !important;
          max-height: 92vh !important;
          border-radius: 12px !important;
          box-sizing: border-box !important;
        }
        .brand-manager-header {
          padding: 0.75rem !important;
        }
        .brand-manager-stats-strip {
          padding: 0.5rem !important;
          gap: 0.25rem !important;
        }
        .brand-manager-add-form {
          flex-direction: column !important;
          gap: 0.5rem !important;
        }
        .brand-manager-add-form button {
          width: 100% !important;
          justify-content: center !important;
        }
        .brand-manager-grid {
          grid-template-columns: 1fr !important;
        }
      }
    `,document.head.appendChild(p)}}const n={overlay:{position:"fixed",top:0,left:0,width:"100vw",height:"100vh",backgroundColor:"rgba(15, 23, 42, 0.65)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999999,padding:"1rem",boxSizing:"border-box"},container:{backgroundColor:"#ffffff",borderRadius:"14px",width:"100%",maxWidth:"540px",boxShadow:"0 25px 50px -12px rgba(15, 23, 42, 0.35), 0 2px 4px rgba(0, 0, 0, 0.1)",border:"1px solid #e2e8f0",overflow:"hidden",display:"flex",flexDirection:"column",maxHeight:"85vh",position:"relative",margin:"auto"},header:{padding:"1rem 1.25rem 0.85rem 1.25rem",background:"#ffffff",borderBottom:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"},headerTitleGroup:{display:"flex",alignItems:"center",gap:"0.75rem"},badge:{display:"inline-flex",alignItems:"center",backgroundColor:"#e0e7ff",color:"#3730a3",fontSize:"0.65rem",fontWeight:"800",padding:"0.2rem 0.55rem",borderRadius:"20px",letterSpacing:"0.04em",border:"1px solid #c7d2fe"},title:{fontSize:"1.15rem",fontWeight:"800",color:"#0f172a",margin:0,letterSpacing:"-0.01em"},closeBtn:{background:"#f1f5f9",border:"1px solid #cbd5e1",borderRadius:"50%",width:"30px",height:"30px",display:"flex",alignItems:"center",justifyContent:"center",color:"#64748b",cursor:"pointer",transition:"all 0.15s ease"},statsStrip:{display:"flex",alignItems:"center",justifyContent:"space-around",background:"linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",borderBottom:"1px solid #e2e8f0",padding:"0.45rem 1rem"},statBox:{display:"flex",flexDirection:"column",alignItems:"center"},statLabel:{fontSize:"0.6rem",fontWeight:"800",color:"#64748b",letterSpacing:"0.04em"},statValue:{fontSize:"1rem",fontWeight:"800",color:"#0f172a"},statValueCustom:{fontSize:"1rem",fontWeight:"800",color:"#2563eb"},statValueCat:{fontSize:"1rem",fontWeight:"800",color:"#475569"},statDivider:{width:"1px",height:"20px",backgroundColor:"#cbd5e1"},body:{padding:"1rem 1.25rem",overflowY:"auto",display:"flex",flexDirection:"column",gap:"0.75rem"},alertError:{display:"flex",alignItems:"center",gap:"0.4rem",backgroundColor:"#fef2f2",border:"1px solid #fecaca",color:"#991b1b",padding:"0.45rem 0.75rem",borderRadius:"6px",fontSize:"0.78rem",fontWeight:"600"},alertSuccess:{display:"flex",alignItems:"center",gap:"0.4rem",backgroundColor:"#f0fdf4",border:"1px solid #bbf7d0",color:"#166534",padding:"0.45rem 0.75rem",borderRadius:"6px",fontSize:"0.78rem",fontWeight:"600"},addForm:{display:"flex",flexDirection:"column"},inputGroup:{display:"flex",alignItems:"center",border:"2px solid #2563eb",borderRadius:"8px",backgroundColor:"#ffffff",overflow:"hidden",boxShadow:"0 2px 8px rgba(37, 99, 235, 0.12)"},input:{flex:1,border:"none",outline:"none",padding:"0.55rem 0.65rem",fontSize:"0.85rem",backgroundColor:"transparent",color:"#0f172a",fontWeight:"700"},addBtn:{backgroundColor:"#2563eb",color:"#ffffff",border:"none",padding:"0.55rem 1rem",fontWeight:"800",fontSize:"0.825rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.3rem",transition:"background 0.15s ease"},searchWrap:{display:"flex",alignItems:"center",backgroundColor:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:"6px",overflow:"hidden"},searchInput:{flex:1,border:"none",outline:"none",padding:"0.45rem 0.65rem",fontSize:"0.8rem",backgroundColor:"transparent",color:"#0f172a"},clearSearchBtn:{background:"none",border:"none",color:"#64748b",cursor:"pointer",padding:"0.25rem 0.5rem",display:"flex",alignItems:"center"},sectionHeader:{fontSize:"0.68rem",fontWeight:"800",color:"#64748b",letterSpacing:"0.04em",borderBottom:"1px solid #e2e8f0",paddingBottom:"0.25rem"},brandsGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(210px, 1fr))",gap:"0.45rem",maxHeight:"260px",overflowY:"auto",paddingRight:"2px"},emptyState:{gridColumn:"1 / -1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"1.5rem 1rem",textAlign:"center"},brandChip:{display:"flex",alignItems:"center",justifyContent:"space-between",backgroundColor:"#f8fafc",border:"1px solid #e2e8f0",padding:"0.4rem 0.65rem",borderRadius:"6px",gap:"0.4rem"},brandChipCustom:{display:"flex",alignItems:"center",justifyContent:"space-between",backgroundColor:"#eff6ff",border:"1px solid #bfdbfe",padding:"0.4rem 0.65rem",borderRadius:"6px",gap:"0.4rem"},brandChipEditing:{display:"flex",alignItems:"center",gap:"0.35rem",backgroundColor:"#ffffff",border:"1px solid #2563eb",padding:"0.25rem 0.45rem",borderRadius:"6px"},editInput:{flex:1,border:"none",outline:"none",background:"transparent",color:"#0f172a",fontSize:"0.82rem",fontWeight:"700"},saveBtn:{backgroundColor:"#2563eb",border:"none",borderRadius:"4px",padding:"0.2rem 0.35rem",cursor:"pointer",display:"flex",alignItems:"center"},cancelBtn:{background:"none",border:"none",cursor:"pointer",padding:"0.2rem",display:"flex",alignItems:"center"},brandChipLeft:{display:"flex",alignItems:"center",gap:"0.35rem",overflow:"hidden"},brandName:{fontWeight:"700",color:"#334155",fontSize:"0.82rem",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},brandNameCustom:{fontWeight:"800",color:"#1e40af",fontSize:"0.82rem",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},catBadge:{fontSize:"0.62rem",color:"#64748b",backgroundColor:"#e2e8f0",padding:"0.1rem 0.35rem",borderRadius:"4px",fontWeight:"600"},customBadge:{fontSize:"0.62rem",color:"#1e40af",backgroundColor:"#dbeafe",padding:"0.1rem 0.35rem",borderRadius:"4px",fontWeight:"800"},actionIconBtn:{background:"none",border:"none",cursor:"pointer",padding:"0.1rem",display:"flex",alignItems:"center",borderRadius:"3px"},footer:{padding:"0.75rem 1.25rem",borderTop:"1px solid #e2e8f0",display:"flex",justifyContent:"flex-end",backgroundColor:"#f8fafc"},doneBtn:{padding:"0.5rem 1.4rem",borderRadius:"8px",border:"none",backgroundColor:"#2563eb",color:"#ffffff",fontSize:"0.825rem",fontWeight:"800",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"0.4rem",boxShadow:"0 2px 8px rgba(37, 99, 235, 0.25)"}};function Te({items:x,onEdit:p,onDelete:G,onAdd:V,onSync:Z,onOpenManager:ee}){const[U,Y]=i.useState(""),[u,I]=i.useState("All"),[N,g]=i.useState("All"),[v,l]=i.useState("description"),[E,j]=i.useState("asc"),[L,O]=i.useState({}),[J,P]=i.useState(!1),[b,X]=i.useState(!1),S=i.useRef(0);i.useEffect(()=>{const t=()=>{if(!b){const o=window.scrollY||document.documentElement.scrollTop||0;o>0&&(S.current=o)}};return window.addEventListener("scroll",t,{passive:!0}),()=>window.removeEventListener("scroll",t)},[b]);const q=()=>{document.activeElement&&typeof document.activeElement.blur=="function"&&document.activeElement.blur();const t=S.current||0;X(!1);const o=()=>{typeof window<"u"&&window.scrollTo({top:t,behavior:"instant"})};o(),requestAnimationFrame(o),setTimeout(o,30),setTimeout(o,100),setTimeout(o,300)},[R,D]=i.useState(()=>{try{const t=localStorage.getItem("elite_managed_brands");return t?JSON.parse(t):["ANOUK","ELITE EDITION","HERA","MYNTRA"]}catch{return["ANOUK","ELITE EDITION","HERA","MYNTRA"]}});i.useEffect(()=>{const t=()=>{try{const o=localStorage.getItem("elite_managed_brands");o&&D(JSON.parse(o))}catch{}};return window.addEventListener("storage",t),window.addEventListener("elite_brands_updated",t),()=>{window.removeEventListener("storage",t),window.removeEventListener("elite_brands_updated",t)}},[]);const te=t=>{const o=[...R,t];D(o);try{localStorage.setItem("elite_managed_brands",JSON.stringify(o)),window.dispatchEvent(new Event("storage")),window.dispatchEvent(new CustomEvent("elite_brands_updated",{detail:o}))}catch{}},W=t=>{const o=R.filter(s=>s.toLowerCase()!==t.toLowerCase());D(o);try{localStorage.setItem("elite_managed_brands",JSON.stringify(o)),window.dispatchEvent(new Event("storage")),window.dispatchEvent(new CustomEvent("elite_brands_updated",{detail:o}))}catch{}},$=new Map,M=t=>{if(!t||typeof t!="string")return;const o=t.trim();if(!o||o.toUpperCase()==="ALL")return;const s=o.toUpperCase();$.has(s)||$.set(s,s)};(x||[]).forEach(t=>{t.brand&&M(t.brand),Array.isArray(t.brandCodes)&&t.brandCodes.forEach(o=>{const s=typeof o=="object"?o.brand:o;M(s)})}),(R||[]).forEach(t=>M(t));const C=Array.from($.values()).sort((t,o)=>t.localeCompare(o,void 0,{sensitivity:"base"})),re=["All",...C],K=["All",...new Set(x.flatMap(t=>t.size||[]).filter(Boolean))],k=x.filter(t=>{const o=he(t,U,["description","brand","skuCode","categoryName","color","size"]),s=u==="All"||t.size&&t.size.includes(u),f=N==="All"||t.brand&&t.brand.trim().toLowerCase()===N.trim().toLowerCase()||Array.isArray(t.brandCodes)&&t.brandCodes.some(w=>{const h=typeof w=="object"?w.brand:w;return h&&h.trim().toLowerCase()===N.trim().toLowerCase()});return o&&s&&f}).sort((t,o)=>{let s=t[v],f=o[v];return s==null&&(s=""),f==null&&(f=""),typeof s=="string"&&(s=s.toLowerCase(),f=f.toLowerCase()),s<f?E==="asc"?-1:1:s>f?E==="asc"?1:-1:0}),ne=t=>{const o=t.skuCode||t.sku||"NO-SKU",s=Array.isArray(t.size)?t.size.join("/"):t.size||"N/A",f=t.brand&&t.brand.toUpperCase()!=="ELITE ONLINE"&&t.brand.toUpperCase()!=="ALL"?t.brand.toUpperCase():"EON",w=window.prompt(`How many barcode stickers to print for SKU "${o}"?`,"1");if(w===null)return;const h=parseInt(w,10);if(isNaN(h)||h<=0){alert("Please enter a valid positive number.");return}const y=window.open("","_blank","width=800,height=600"),T=Math.ceil(h/2);let z="";for(let r=0;r<T;r++){const a=r*2,c=r*2+1,m=`
        <div class="sticker">
          <div class="title">${f}</div>
          <div class="barcode-container">
            <svg class="barcode-img" id="barcode_${a}"></svg>
          </div>
          <div class="footer-row">
            <span class="sku-text">${o}</span>
            <span class="size-text">Size: ${s}</span>
          </div>
        </div>
      `,A=c<h?`
          <div class="sticker">
            <div class="title">${f}</div>
            <div class="barcode-container">
              <svg class="barcode-img" id="barcode_${c}"></svg>
            </div>
            <div class="footer-row">
              <span class="sku-text">${o}</span>
              <span class="size-text">Size: ${s}</span>
            </div>
          </div>
        `:'<div class="sticker" style="visibility: hidden;"></div>';z+=`
        <div class="sheet">
          ${m}
          ${A}
        </div>
      `}let H="";for(let r=0;r<h;r++)H+=`
        JsBarcode("#barcode_${r}", "${o}", {
          format: "CODE128",
          displayValue: false,
          margin: 0,
          background: "transparent",
          lineColor: "#000",
          width: 2,
          height: 40
        });
      `;const Q=`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Barcodes - ${o}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
        <style>
          @page { size: 100mm 25mm; margin: 0; }
          body { margin: 0; padding: 0; font-family: sans-serif; background: white; color: black; }
          .sheet { display: flex; width: 100mm; height: 25mm; box-sizing: border-box; overflow: hidden; page-break-after: always; }
          .sheet:last-child { page-break-after: avoid; }
          .sticker { flex: 1; width: 50mm; height: 25mm; box-sizing: border-box; padding: 2.2mm 3.5mm 1.5mm 3.5mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; overflow: hidden; }
          .title { font-size: 8.5pt; font-weight: bold; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }
          .barcode-container { display: flex; align-items: center; justify-content: center; height: 12.5mm; width: 100%; }
          .barcode-img { max-width: 44mm; height: 11mm; }
          .footer-row { display: flex; justify-content: space-between; width: 100%; font-size: 7.5pt; font-weight: 500; }
          .sku-text { font-family: monospace; font-weight: bold; }
          .size-text { font-weight: bold; }
        </style>
      </head>
      <body>
        ${z}
        <script>
          try { ${H} } catch(e) { console.error(e); }
          window.onload = function() {
            setTimeout(function() { window.print(); window.close(); }, 300);
          }
        <\/script>
      </body>
      </html>
    `;y.document.open(),y.document.write(Q),y.document.close()};return e.jsxs("div",{className:"glass-panel",style:d.gridPanel,children:[e.jsxs("div",{className:"catalog-control-header",style:{...d.controlHeader,display:"flex",flexDirection:"row",flexWrap:"nowrap",alignItems:"center",justify:"space-between",padding:"0.45rem 0.85rem",borderRadius:"12px",background:"#ffffff",border:"1px solid #e2e8f0",boxShadow:"0 4px 16px rgba(0,0,0,0.03)",gap:"0.5rem",overflowX:"auto",whiteSpace:"nowrap"},children:[e.jsxs("div",{className:"catalog-left-controls",style:{...d.leftControls,flexShrink:0,flexWrap:"nowrap"},children:[e.jsxs("div",{className:"catalog-search-box",style:{...d.searchBox,minWidth:"180px",maxWidth:"240px"},children:[e.jsx(se,{size:14,color:"#64748b",style:d.searchIcon}),e.jsx("input",{type:"text",value:U,onChange:t=>Y(t.target.value),placeholder:"Search catalog by SKU, name...",style:d.searchInput})]}),e.jsxs("div",{className:"catalog-filter-box",style:d.filterBox,children:[e.jsx(ue,{size:14,color:"#059669"}),e.jsx("select",{value:u,onChange:t=>I(t.target.value),style:d.selectInput,children:K.map((t,o)=>e.jsx("option",{value:t,children:t==="All"?"All Sizes":`Size ${t}`},o))})]}),e.jsxs("div",{className:"catalog-filter-box",style:d.filterBox,children:[e.jsx(oe,{size:14,color:"#059669"}),e.jsx("select",{value:N,onChange:t=>g(t.target.value),style:d.selectInput,children:re.map((t,o)=>e.jsx("option",{value:t,children:t==="All"?"All Brands":t},o))})]})]}),e.jsx("div",{className:"catalog-action-group",style:{display:"flex",gap:"0.4rem",alignItems:"center",flexShrink:0,flexWrap:"nowrap"},children:e.jsxs("button",{onClick:V,className:"btn-success",style:{...d.primaryAddBtn,padding:"0.45rem 0.85rem"},children:[e.jsx(ae,{size:14}),e.jsx("span",{children:"+ Add Product"})]})})]}),e.jsx("div",{className:"table-container data-table-container",style:{...d.tableWrap,overflowX:"auto",WebkitOverflowScrolling:"touch",width:"100%"},children:k.length===0?e.jsx("div",{style:d.emptyTable,children:"No products match your filters."}):e.jsxs("table",{className:"data-table",style:{...d.table,minWidth:"820px",width:"100%"},children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx(be,{allSelected:k.length>0&&k.every(t=>!!L[t._id]),someSelected:k.some(t=>!!L[t._id]),onToggleAll:t=>{t.target.checked?O(k.reduce((o,s)=>(o[s._id]=!0,o),{})):O({})},totalCount:k.length}),e.jsx(B,{columnKey:"description",sortState:{columnKey:v,order:E},onSortChange:({columnKey:t,order:o})=>{l(t),j(o||"asc")},children:"PRODUCT DETAILS"}),e.jsx(B,{columnKey:"skuCode",sortState:{columnKey:v,order:E},onSortChange:({columnKey:t,order:o})=>{l(t),j(o||"asc")},children:"SKU CODE"}),e.jsx(B,{columnKey:"brand",sortState:{columnKey:v,order:E},onSortChange:({columnKey:t,order:o})=>{l(t),j(o||"asc")},children:"BRAND"}),e.jsx(B,{hideSort:!0,children:"SIZES"}),e.jsx(B,{columnKey:"basePrice",sortState:{columnKey:v,order:E},onSortChange:({columnKey:t,order:o})=>{l(t),j(o||"asc")},align:"right",children:"BASE PRICE"}),e.jsx(B,{columnKey:"price",sortState:{columnKey:v,order:E},onSortChange:({columnKey:t,order:o})=>{l(t),j(o||"asc")},align:"right",children:"PRICE"}),e.jsx(B,{hideSort:!0,align:"center",children:"LIVE STOCK"}),e.jsx(B,{hideSort:!0,align:"center",children:"ACTIONS"})]})}),e.jsx("tbody",{children:k.map(t=>{const o=!!L[t._id],s=t.inventorySnapshots?.inventory,f=s!=null;let w="badge-success",h=f?`${s} Units`:"No Live Sync";return f&&s===0?(w="badge-danger",h="0 Units (Out of Stock)"):f&&s<=5&&(w="badge-warning",h=`${s} Units (Low Stock)`),e.jsxs("tr",{style:{background:we(o)},children:[e.jsx(ye,{checked:o,onChange:y=>{O(T=>{const z={...T};return y.target.checked?z[t._id]=!0:delete z[t._id],z})}}),e.jsx("td",{children:e.jsxs("div",{style:d.itemCell,children:[e.jsx(xe,{src:t.imageUrl,alt:t.description||"Product",title:t.description||"Product",size:"md",aspectRatio:"1:1",category:"catalog",metadata:{SKU:t.skuCode,Category:t.categoryName||"KURTA SET",Stock:h}}),e.jsxs("div",{children:[e.jsx("div",{style:d.itemName,children:t.description||"Unnamed Product"}),e.jsxs("div",{style:d.itemMeta,children:["Category: ",t.categoryName||"KURTA SET"]})]})]})}),e.jsxs("td",{children:[e.jsx("span",{style:d.skuBadge,children:t.skuCode}),Array.isArray(t.brandCodes)&&t.brandCodes.length>0&&e.jsx("div",{style:{display:"flex",gap:"3px",flexWrap:"wrap",marginTop:"4px"},children:t.brandCodes.map((y,T)=>e.jsx("span",{style:{fontSize:"0.68rem",background:"#f1f5f9",color:"#475569",border:"1px solid #cbd5e1",borderRadius:"4px",padding:"1px 5px",fontWeight:600},children:typeof y=="string"?y:`${y.brand?y.brand+": ":""}${y.code}`},T))})]}),e.jsx("td",{children:e.jsx("span",{style:d.brandBadge,children:t.brand||"ANOUK"})}),e.jsx("td",{children:Array.isArray(t.size)?e.jsx("div",{style:d.sizeWrap,children:t.size.map((y,T)=>e.jsx("span",{style:d.sizeBadge,children:y},T))}):e.jsx("span",{style:d.sizeBadge,children:t.size||"N/A"})}),e.jsxs("td",{children:["Rs. ",(t.basePrice||0).toFixed(2)]}),e.jsxs("td",{style:{fontWeight:"700",color:"var(--text-primary)"},children:["Rs. ",(t.price||0).toFixed(2)]}),e.jsx("td",{className:"text-center",children:e.jsx("span",{className:`badge ${w}`,children:h})}),e.jsx("td",{className:"text-center",children:e.jsxs("div",{style:d.actionGroup,children:[e.jsx("button",{onClick:()=>ne(t),className:"btn-icon",title:"Print Stock Barcode Sticker",style:{color:"#2563eb"},children:e.jsx(ge,{size:15})}),e.jsx("button",{onClick:()=>p(t),className:"btn-icon",title:"Edit Product Details",children:e.jsx(ie,{size:15})}),e.jsx("button",{onClick:()=>G(t._id),className:"btn-icon",style:d.trashBtn,title:"Delete Product",children:e.jsx(le,{size:15})})]})})]},t._id)})})]})}),b&&e.jsx(Ce,{existingBrands:C||[],customBrands:R||[],onAddBrand:te,onDeleteBrand:W,onClose:q})]})}if(typeof document<"u"){const x="product-catalog-grid-responsive-style";if(!document.getElementById(x)){const p=document.createElement("style");p.id=x,p.innerHTML=`
      @media (max-width: 1200px) {
        .catalog-control-header {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 0.85rem !important;
        }
        .catalog-left-controls {
          width: 100% !important;
          flex-wrap: wrap !important;
          justify-content: flex-start !important;
        }
        .catalog-search-box {
          flex: 1 !important;
          min-width: 220px !important;
        }
        .catalog-action-group {
          width: 100% !important;
          justify-content: flex-start !important;
        }
      }

      @media (max-width: 768px) {
        .catalog-control-header {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 0.75rem !important;
        }
        .catalog-left-controls {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 0.5rem !important;
          width: 100% !important;
        }
        .catalog-search-box {
          grid-column: span 2 !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        .catalog-filter-box {
          width: 100% !important;
          justify-content: space-between !important;
        }
        .catalog-filter-box select {
          flex: 1 !important;
          width: 100% !important;
        }
        .catalog-action-group {
          width: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 0.5rem !important;
        }
        .catalog-action-group button {
          width: 100% !important;
          justify-content: center !important;
          font-size: 0.8rem !important;
          padding: 0.6rem 0.5rem !important;
        }
        .data-table-container {
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }
      }
    `,document.head.appendChild(p)}}const d={gridPanel:{padding:"1.5rem",display:"flex",flexDirection:"column",gap:"1.2rem",minHeight:"450px"},controlHeader:{display:"flex",flexDirection:"row",justify:"space-between",alignItems:"center",gap:"0.5rem",flexWrap:"nowrap",overflowX:"auto",whiteSpace:"nowrap"},leftControls:{display:"flex",alignItems:"center",gap:"0.6rem",flexWrap:"nowrap"},searchBox:{position:"relative",width:"260px",flexShrink:0,display:"flex",alignItems:"center"},searchIcon:{position:"absolute",left:"0.75rem",pointerEvents:"none"},searchInput:{width:"100%",padding:"0.55rem 0.75rem 0.55rem 2.2rem",borderRadius:"8px",border:"1px solid #cbd5e1",backgroundColor:"#ffffff",color:"#0f172a",fontSize:"0.85rem",fontWeight:"500",outline:"none",boxSizing:"border-box"},filterBox:{display:"flex",alignItems:"center",gap:"0.4rem",backgroundColor:"#ffffff",border:"1px solid #cbd5e1",padding:"0 0.65rem",borderRadius:"8px",height:"38px",boxSizing:"border-box",flexShrink:0},selectInput:{border:"none",backgroundColor:"transparent",padding:"0.4rem 0.2rem",fontSize:"0.85rem",fontWeight:"600",color:"#0f172a",outline:"none",cursor:"pointer"},primaryAddBtn:{padding:"0.55rem 1.25rem",borderRadius:"8px",border:"none",backgroundColor:"#059669",color:"#ffffff",fontSize:"0.85rem",fontWeight:"700",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"0.4rem",height:"38px",boxShadow:"0 4px 6px -1px rgba(5, 150, 105, 0.3)"},tableWrap:{flex:1},emptyTable:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"4rem 1rem",textAlign:"center"},itemCell:{display:"flex",alignItems:"center",gap:"0.75rem"},itemName:{fontWeight:"500",color:"var(--text-primary)"},itemMeta:{fontSize:"0.7rem",color:"var(--text-muted)",marginTop:"2px"},sizeBadge:{fontSize:"0.8rem",fontWeight:"600",color:"var(--text-primary)",background:"rgba(255, 255, 255, 0.06)",padding:"0.15rem 0.45rem",borderRadius:"4px",border:"1px solid var(--border-light)"},trashBtn:{color:"#fca5a5",borderColor:"rgba(239, 68, 68, 0.1)"}};if(typeof document<"u"){const x="catalog-grid-responsive-style";if(!document.getElementById(x)){const p=document.createElement("style");p.id=x,p.innerHTML=`
      @media (max-width: 768px) {
        .catalog-control-header {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 0.65rem !important;
          padding: 0.85rem !important;
        }
        .catalog-left-controls {
          flex-direction: column !important;
          width: 100% !important;
          gap: 0.5rem !important;
        }
        .catalog-search-box {
          width: 100% !important;
        }
        .catalog-filter-box {
          width: 100% !important;
        }
        .catalog-action-group {
          display: grid !important;
          grid-template-columns: repeat(2, 1fr) !important;
          width: 100% !important;
          gap: 0.5rem !important;
        }
        .catalog-action-group button {
          width: 100% !important;
          justify-content: center !important;
          box-sizing: border-box !important;
        }
      }
    `,document.head.appendChild(p)}}export{Te as default};
