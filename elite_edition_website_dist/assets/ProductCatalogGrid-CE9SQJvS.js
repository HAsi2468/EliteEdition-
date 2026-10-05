import{r as i,j as e,i as ce,X as M,al as ne,ax as D,s as pe,aD as le,aq as oe,O as ae,f as de,ay as se,d as ie,aE as me,S as fe,P as ue}from"./vendor-react-DXt8b0XR.js";import{m as ge}from"./searchUtils-CJ8GV7sK.js";function xe({existingBrands:h=[],customBrands:p,onAddBrand:_,onDeleteBrand:P,onUpdateBrand:q,onClose:Z}){const[W,F]=i.useState(""),[g,k]=i.useState(""),[z,x]=i.useState(""),[C,u]=i.useState(""),[E,T]=i.useState(null),[Q,ee]=i.useState(""),B=i.useRef(0);i.useEffect(()=>(B.current=window.scrollY||document.documentElement.scrollTop||0,()=>{const r=B.current;typeof window<"u"&&r>0&&(window.scrollTo({top:r,behavior:"instant"}),setTimeout(()=>window.scrollTo({top:r,behavior:"instant"}),30),setTimeout(()=>window.scrollTo({top:r,behavior:"instant"}),100),setTimeout(()=>window.scrollTo({top:r,behavior:"instant"}),300))}),[]);const N=r=>{r&&r.preventDefault&&r.preventDefault(),r&&r.stopPropagation&&r.stopPropagation(),document.activeElement&&typeof document.activeElement.blur=="function"&&document.activeElement.blur();const o=B.current||window.scrollY||0;Z&&Z(),typeof window<"u"&&o>0&&(window.scrollTo({top:o,behavior:"instant"}),requestAnimationFrame(()=>window.scrollTo({top:o,behavior:"instant"})),setTimeout(()=>window.scrollTo({top:o,behavior:"instant"}),30),setTimeout(()=>window.scrollTo({top:o,behavior:"instant"}),100),setTimeout(()=>window.scrollTo({top:o,behavior:"instant"}),300))},[b,H]=i.useState("brands"),[w,R]=i.useState(()=>{if(Array.isArray(p)&&p.length>0)return p;try{const r=localStorage.getItem("elite_managed_brands");return r?JSON.parse(r):["ANOUK","ELITE EDITION","HERA","MYNTRA"]}catch{return["ANOUK","ELITE EDITION","HERA","MYNTRA"]}}),[G,V]=i.useState(""),[$,I]=i.useState(null),[U,Y]=i.useState(""),[v,A]=i.useState(()=>{try{const r=localStorage.getItem("elite_managed_categories");return r?JSON.parse(r):["KURTA SET","CO-ORD SET","DRESS","SUIT","SAREE","LEHENGA","TOP","BOTTOM","ETHNIC","STITCHING SET"]}catch{return["KURTA SET","CO-ORD SET","DRESS","SUIT","SAREE","LEHENGA","TOP","BOTTOM"]}}),L=r=>{A(r);try{localStorage.setItem("elite_managed_categories",JSON.stringify(r)),window.dispatchEvent(new Event("storage")),window.dispatchEvent(new CustomEvent("elite_categories_updated",{detail:r}))}catch{}},te=r=>{r.preventDefault(),x(""),u("");const o=G.trim().toUpperCase();if(!o){x("Category name cannot be empty.");return}if(v.some(f=>f.toLowerCase()===o.toLowerCase())){x(`Category "${o}" already exists.`);return}const m=[...v,o];L(m),V(""),u(`Category "${o}" added successfully.`),setTimeout(()=>u(""),3e3)},t=r=>{if(!window.confirm(`Delete custom category "${r}"?`))return;x(""),u("");const o=v.filter(m=>m.toLowerCase()!==r.toLowerCase());L(o),u(`Category "${r}" removed.`),setTimeout(()=>u(""),3e3)},a=r=>{const o=U.trim().toUpperCase();if(!o){x("Category name cannot be empty.");return}if(o!==r.toUpperCase()&&v.some(f=>f.toLowerCase()===o.toLowerCase())){x(`Category "${o}" already exists.`);return}const m=v.map(f=>f.toLowerCase()===r.toLowerCase()?o:f);L(m),I(null),u(`Updated category to "${o}".`),setTimeout(()=>u(""),3e3)};i.useEffect(()=>{Array.isArray(p)&&p.length>0&&R(p)},[p]),i.useEffect(()=>{const r=o=>{o.key==="Escape"&&N(o)};return window.addEventListener("keydown",r),()=>window.removeEventListener("keydown",r)},[]);const s=i.useMemo(()=>Array.isArray(h)?h.filter(Boolean):[],[h]),d=i.useMemo(()=>{const r=new Set;return[...w,...s].forEach(o=>{o&&typeof o=="string"&&r.add(o.toUpperCase())}),Array.from(r).sort()},[w,s]),y=i.useMemo(()=>g.trim()?d.filter(r=>r.toLowerCase().includes(g.trim().toLowerCase())):d,[d,g]),c=i.useMemo(()=>g.trim()?v.filter(r=>r.toLowerCase().includes(g.trim().toLowerCase())):v,[v,g]),j=r=>{R(r);try{localStorage.setItem("elite_managed_brands",JSON.stringify(r)),window.dispatchEvent(new Event("storage")),window.dispatchEvent(new CustomEvent("elite_brands_updated",{detail:r}))}catch(o){console.error("Failed to save brands to localStorage",o)}},re=r=>{r.preventDefault(),x(""),u("");const o=W.trim().toUpperCase();if(!o){x("Brand name cannot be empty.");return}if(d.some(f=>f.toLowerCase()===o.toLowerCase())){x(`Brand "${o}" already exists.`);return}const m=[...w,o];j(m),_&&_(o),F(""),u(`Brand "${o}" added successfully.`),setTimeout(()=>u(""),3e3)},K=r=>{if(!window.confirm(`Delete custom brand "${r}"?`))return;x(""),u("");const o=w.filter(m=>m.toLowerCase()!==r.toLowerCase());j(o),P&&P(r),u(`Brand "${r}" removed.`),setTimeout(()=>u(""),3e3)},J=r=>{T(r),ee(r),x("")},X=r=>{const o=Q.trim().toUpperCase();if(!o){x("Brand name cannot be empty.");return}if(o!==r.toUpperCase()&&d.some(f=>f.toLowerCase()===o.toLowerCase())){x(`Brand "${o}" already exists.`);return}const m=w.map(f=>f.toLowerCase()===r.toLowerCase()?o:f);j(m),q&&q(r,o),T(null),u(`Updated to "${o}".`),setTimeout(()=>u(""),3e3)},S=e.jsx("div",{className:"modal-overlay",style:n.overlay,onClick:N,children:e.jsxs("div",{style:n.container,onClick:r=>r.stopPropagation(),children:[e.jsxs("div",{style:n.header,children:[e.jsxs("div",{style:n.headerTitleGroup,children:[e.jsxs("div",{style:n.badge,children:[e.jsx(ce,{size:13,style:{marginRight:"4px"}}),"DYNAMIC CATALOG SETTINGS"]}),e.jsx("h2",{style:n.title,children:"Manage Catalog Brands & Categories"})]}),e.jsx("button",{type:"button",onClick:N,style:n.closeBtn,title:"Close Modal (Esc)",children:e.jsx(M,{size:18})})]}),e.jsxs("div",{style:{display:"flex",gap:"0.5rem",padding:"0.6rem 1.5rem",background:"#f8fafc",borderBottom:"1px solid #e2e8f0",flexWrap:"wrap"},children:[e.jsxs("button",{type:"button",onClick:()=>{H("brands"),x(""),u(""),k("")},style:{display:"flex",alignItems:"center",gap:"0.4rem",padding:"0.45rem 1rem",borderRadius:"8px",border:b==="brands"?"1.5px solid #2563eb":"1px solid #cbd5e1",background:b==="brands"?"#eff6ff":"#ffffff",color:b==="brands"?"#1d4ed8":"#64748b",fontWeight:700,fontSize:"0.82rem",cursor:"pointer"},children:[e.jsx(ne,{size:14,color:b==="brands"?"#2563eb":"#64748b"}),e.jsxs("span",{children:["Manage Brands (",d.length,")"]})]}),e.jsxs("button",{type:"button",onClick:()=>{H("categories"),x(""),u(""),k("")},style:{display:"flex",alignItems:"center",gap:"0.4rem",padding:"0.45rem 1rem",borderRadius:"8px",border:b==="categories"?"1.5px solid #059669":"1px solid #cbd5e1",background:b==="categories"?"#ecfdf5":"#ffffff",color:b==="categories"?"#047857":"#64748b",fontWeight:700,fontSize:"0.82rem",cursor:"pointer"},children:[e.jsx(D,{size:14,color:b==="categories"?"#059669":"#64748b"}),e.jsxs("span",{children:["Manage Categories (",v.length,")"]})]})]}),e.jsx("div",{style:n.statsStrip,children:b==="brands"?e.jsxs(e.Fragment,{children:[e.jsxs("div",{style:n.statBox,children:[e.jsx("span",{style:n.statLabel,children:"TOTAL BRANDS"}),e.jsx("span",{style:n.statValue,children:d.length})]}),e.jsx("div",{style:n.statDivider}),e.jsxs("div",{style:n.statBox,children:[e.jsx("span",{style:n.statLabel,children:"CUSTOM BRANDS"}),e.jsx("span",{style:n.statValueCustom,children:w.length})]}),e.jsx("div",{style:n.statDivider}),e.jsxs("div",{style:n.statBox,children:[e.jsx("span",{style:n.statLabel,children:"CATALOG BRANDS"}),e.jsx("span",{style:n.statValueCat,children:s.length})]})]}):e.jsxs(e.Fragment,{children:[e.jsxs("div",{style:n.statBox,children:[e.jsx("span",{style:n.statLabel,children:"TOTAL CATEGORIES"}),e.jsx("span",{style:{...n.statValue,color:"#059669"},children:v.length})]}),e.jsx("div",{style:n.statDivider}),e.jsxs("div",{style:n.statBox,children:[e.jsx("span",{style:n.statLabel,children:"ACTIVE GARMENT TYPES"}),e.jsx("span",{style:n.statValueCustom,children:"All Dynamic"})]})]})}),e.jsxs("div",{style:n.body,children:[z&&e.jsxs("div",{style:n.alertError,children:[e.jsx(pe,{size:14,style:{flexShrink:0}}),e.jsx("span",{children:z})]}),C&&e.jsxs("div",{style:n.alertSuccess,children:[e.jsx(le,{size:14,style:{flexShrink:0}}),e.jsx("span",{children:C})]}),b==="brands"&&e.jsxs(e.Fragment,{children:[e.jsx("form",{onSubmit:re,style:n.addForm,children:e.jsxs("div",{style:n.inputGroup,children:[e.jsx(ne,{size:18,color:"#2563eb",style:{marginLeft:"10px",flexShrink:0}}),e.jsx("input",{type:"text",value:W,onChange:r=>F(r.target.value),placeholder:"Type new brand name (e.g. ZARA, HERA, MYNTRA)...",style:n.input,autoFocus:!0}),e.jsxs("button",{type:"submit",style:n.addBtn,children:[e.jsx(oe,{size:15}),e.jsx("span",{children:"Add Brand"})]})]})}),e.jsxs("div",{style:n.searchWrap,children:[e.jsx(ae,{size:15,color:"#64748b",style:{marginLeft:"10px",flexShrink:0}}),e.jsx("input",{type:"text",value:g,onChange:r=>k(r.target.value),placeholder:"Search brand list...",style:n.searchInput}),g&&e.jsx("button",{onClick:()=>k(""),style:n.clearSearchBtn,title:"Clear Search",children:e.jsx(M,{size:13})})]}),e.jsx("div",{style:n.sectionHeader,children:e.jsxs("span",{children:["ACTIVE BRANDS DIRECTORY (",y.length,")"]})}),e.jsx("div",{style:n.brandsGrid,children:y.length===0?e.jsxs("div",{style:n.emptyState,children:[e.jsx(D,{size:24,color:"#94a3b8"}),e.jsx("p",{style:{margin:"0.3rem 0 0 0",fontSize:"0.82rem",color:"#64748b"},children:g?`No brands matching "${g}"`:"No active brands available."})]}):y.map((r,o)=>{const m=w.some(O=>O.toLowerCase()===r.toLowerCase());return E===r?e.jsxs("div",{style:n.brandChipEditing,children:[e.jsx("input",{type:"text",value:Q,onChange:O=>ee(O.target.value),style:n.editInput,autoFocus:!0,onKeyDown:O=>{O.key==="Enter"&&X(r),O.key==="Escape"&&T(null)}}),e.jsx("button",{type:"button",onClick:()=>X(r),style:n.saveBtn,title:"Save Brand Name",children:e.jsx(de,{size:13,color:"#ffffff"})}),e.jsx("button",{type:"button",onClick:()=>T(null),style:n.cancelBtn,title:"Cancel Editing",children:e.jsx(M,{size:13,color:"#64748b"})})]},`edit-${o}`):e.jsxs("div",{style:m?n.brandChipCustom:n.brandChip,children:[e.jsxs("div",{style:n.brandChipLeft,children:[e.jsx(D,{size:13,color:m?"#2563eb":"#64748b"}),e.jsx("span",{style:m?n.brandNameCustom:n.brandName,children:r})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"0.3rem"},children:[e.jsx("span",{style:m?n.customBadge:n.catBadge,children:m?"Custom":"Catalog"}),m&&e.jsxs(e.Fragment,{children:[e.jsx("button",{type:"button",onClick:()=>J(r),style:n.actionIconBtn,title:`Rename ${r}`,children:e.jsx(se,{size:13,color:"#2563eb"})}),e.jsx("button",{type:"button",onClick:()=>K(r),style:n.actionIconBtn,title:`Delete ${r}`,children:e.jsx(ie,{size:13,color:"#ef4444"})})]})]})]},`brand-${o}`)})})]}),b==="categories"&&e.jsxs(e.Fragment,{children:[e.jsx("form",{onSubmit:te,style:n.addForm,children:e.jsxs("div",{style:n.inputGroup,children:[e.jsx(D,{size:18,color:"#059669",style:{marginLeft:"10px",flexShrink:0}}),e.jsx("input",{type:"text",value:G,onChange:r=>V(r.target.value),placeholder:"Type new category name (e.g. DRESS, LEHENGA, SAREE)...",style:n.input,autoFocus:!0}),e.jsxs("button",{type:"submit",style:{...n.addBtn,background:"#059669"},children:[e.jsx(oe,{size:15}),e.jsx("span",{children:"Add Category"})]})]})}),e.jsxs("div",{style:n.searchWrap,children:[e.jsx(ae,{size:15,color:"#64748b",style:{marginLeft:"10px",flexShrink:0}}),e.jsx("input",{type:"text",value:g,onChange:r=>k(r.target.value),placeholder:"Search category list...",style:n.searchInput}),g&&e.jsx("button",{onClick:()=>k(""),style:n.clearSearchBtn,title:"Clear Search",children:e.jsx(M,{size:13})})]}),e.jsx("div",{style:n.sectionHeader,children:e.jsxs("span",{children:["ACTIVE CATEGORIES DIRECTORY (",c.length,")"]})}),e.jsx("div",{style:n.brandsGrid,children:c.length===0?e.jsxs("div",{style:n.emptyState,children:[e.jsx(D,{size:24,color:"#94a3b8"}),e.jsx("p",{style:{margin:"0.3rem 0 0 0",fontSize:"0.82rem",color:"#64748b"},children:g?`No categories matching "${g}"`:"No categories available."})]}):c.map((r,o)=>$===r?e.jsxs("div",{style:{...n.brandChipEditing,borderColor:"#059669"},children:[e.jsx("input",{type:"text",value:U,onChange:f=>Y(f.target.value),style:n.editInput,autoFocus:!0,onKeyDown:f=>{f.key==="Enter"&&a(r),f.key==="Escape"&&I(null)}}),e.jsx("button",{type:"button",onClick:()=>a(r),style:{...n.saveBtn,background:"#059669"},title:"Save Category Name",children:e.jsx(de,{size:13,color:"#ffffff"})}),e.jsx("button",{type:"button",onClick:()=>I(null),style:n.cancelBtn,title:"Cancel Editing",children:e.jsx(M,{size:13,color:"#64748b"})})]},`edit-cat-${o}`):e.jsxs("div",{style:{...n.brandChipCustom,background:"#ecfdf5",borderColor:"#a7f3d0"},children:[e.jsxs("div",{style:n.brandChipLeft,children:[e.jsx(D,{size:13,color:"#059669"}),e.jsx("span",{style:{...n.brandNameCustom,color:"#047857"},children:r})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"0.3rem"},children:[e.jsx("button",{type:"button",onClick:()=>{I(r),Y(r),x("")},style:n.actionIconBtn,title:`Rename ${r}`,children:e.jsx(se,{size:13,color:"#059669"})}),e.jsx("button",{type:"button",onClick:()=>t(r),style:n.actionIconBtn,title:`Delete ${r}`,children:e.jsx(ie,{size:13,color:"#ef4444"})})]})]},`cat-${o}`))})]})]}),e.jsx("div",{style:n.footer,children:e.jsxs("button",{type:"button",onClick:N,style:n.doneBtn,children:[e.jsx(le,{size:15}),e.jsx("span",{children:"Done"})]})})]})});return typeof document<"u"&&document.body?me.createPortal(S,document.body):S}if(typeof document<"u"){const h="brand-manager-modal-responsive-style";if(!document.getElementById(h)){const p=document.createElement("style");p.id=h,p.innerHTML=`
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
    `,document.head.appendChild(p)}}const n={overlay:{position:"fixed",top:0,left:0,width:"100vw",height:"100vh",backgroundColor:"rgba(15, 23, 42, 0.65)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999999,padding:"1rem",boxSizing:"border-box"},container:{backgroundColor:"#ffffff",borderRadius:"14px",width:"100%",maxWidth:"540px",boxShadow:"0 25px 50px -12px rgba(15, 23, 42, 0.35), 0 2px 4px rgba(0, 0, 0, 0.1)",border:"1px solid #e2e8f0",overflow:"hidden",display:"flex",flexDirection:"column",maxHeight:"85vh",position:"relative",margin:"auto"},header:{padding:"1rem 1.25rem 0.85rem 1.25rem",background:"#ffffff",borderBottom:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"},headerTitleGroup:{display:"flex",alignItems:"center",gap:"0.75rem"},badge:{display:"inline-flex",alignItems:"center",backgroundColor:"#e0e7ff",color:"#3730a3",fontSize:"0.65rem",fontWeight:"800",padding:"0.2rem 0.55rem",borderRadius:"20px",letterSpacing:"0.04em",border:"1px solid #c7d2fe"},title:{fontSize:"1.15rem",fontWeight:"800",color:"#0f172a",margin:0,letterSpacing:"-0.01em"},closeBtn:{background:"#f1f5f9",border:"1px solid #cbd5e1",borderRadius:"50%",width:"30px",height:"30px",display:"flex",alignItems:"center",justifyContent:"center",color:"#64748b",cursor:"pointer",transition:"all 0.15s ease"},statsStrip:{display:"flex",alignItems:"center",justifyContent:"space-around",background:"linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",borderBottom:"1px solid #e2e8f0",padding:"0.45rem 1rem"},statBox:{display:"flex",flexDirection:"column",alignItems:"center"},statLabel:{fontSize:"0.6rem",fontWeight:"800",color:"#64748b",letterSpacing:"0.04em"},statValue:{fontSize:"1rem",fontWeight:"800",color:"#0f172a"},statValueCustom:{fontSize:"1rem",fontWeight:"800",color:"#2563eb"},statValueCat:{fontSize:"1rem",fontWeight:"800",color:"#475569"},statDivider:{width:"1px",height:"20px",backgroundColor:"#cbd5e1"},body:{padding:"1rem 1.25rem",overflowY:"auto",display:"flex",flexDirection:"column",gap:"0.75rem"},alertError:{display:"flex",alignItems:"center",gap:"0.4rem",backgroundColor:"#fef2f2",border:"1px solid #fecaca",color:"#991b1b",padding:"0.45rem 0.75rem",borderRadius:"6px",fontSize:"0.78rem",fontWeight:"600"},alertSuccess:{display:"flex",alignItems:"center",gap:"0.4rem",backgroundColor:"#f0fdf4",border:"1px solid #bbf7d0",color:"#166534",padding:"0.45rem 0.75rem",borderRadius:"6px",fontSize:"0.78rem",fontWeight:"600"},addForm:{display:"flex",flexDirection:"column"},inputGroup:{display:"flex",alignItems:"center",border:"2px solid #2563eb",borderRadius:"8px",backgroundColor:"#ffffff",overflow:"hidden",boxShadow:"0 2px 8px rgba(37, 99, 235, 0.12)"},input:{flex:1,border:"none",outline:"none",padding:"0.55rem 0.65rem",fontSize:"0.85rem",backgroundColor:"transparent",color:"#0f172a",fontWeight:"700"},addBtn:{backgroundColor:"#2563eb",color:"#ffffff",border:"none",padding:"0.55rem 1rem",fontWeight:"800",fontSize:"0.825rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.3rem",transition:"background 0.15s ease"},searchWrap:{display:"flex",alignItems:"center",backgroundColor:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:"6px",overflow:"hidden"},searchInput:{flex:1,border:"none",outline:"none",padding:"0.45rem 0.65rem",fontSize:"0.8rem",backgroundColor:"transparent",color:"#0f172a"},clearSearchBtn:{background:"none",border:"none",color:"#64748b",cursor:"pointer",padding:"0.25rem 0.5rem",display:"flex",alignItems:"center"},sectionHeader:{fontSize:"0.68rem",fontWeight:"800",color:"#64748b",letterSpacing:"0.04em",borderBottom:"1px solid #e2e8f0",paddingBottom:"0.25rem"},brandsGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(210px, 1fr))",gap:"0.45rem",maxHeight:"260px",overflowY:"auto",paddingRight:"2px"},emptyState:{gridColumn:"1 / -1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"1.5rem 1rem",textAlign:"center"},brandChip:{display:"flex",alignItems:"center",justifyContent:"space-between",backgroundColor:"#f8fafc",border:"1px solid #e2e8f0",padding:"0.4rem 0.65rem",borderRadius:"6px",gap:"0.4rem"},brandChipCustom:{display:"flex",alignItems:"center",justifyContent:"space-between",backgroundColor:"#eff6ff",border:"1px solid #bfdbfe",padding:"0.4rem 0.65rem",borderRadius:"6px",gap:"0.4rem"},brandChipEditing:{display:"flex",alignItems:"center",gap:"0.35rem",backgroundColor:"#ffffff",border:"1px solid #2563eb",padding:"0.25rem 0.45rem",borderRadius:"6px"},editInput:{flex:1,border:"none",outline:"none",background:"transparent",color:"#0f172a",fontSize:"0.82rem",fontWeight:"700"},saveBtn:{backgroundColor:"#2563eb",border:"none",borderRadius:"4px",padding:"0.2rem 0.35rem",cursor:"pointer",display:"flex",alignItems:"center"},cancelBtn:{background:"none",border:"none",cursor:"pointer",padding:"0.2rem",display:"flex",alignItems:"center"},brandChipLeft:{display:"flex",alignItems:"center",gap:"0.35rem",overflow:"hidden"},brandName:{fontWeight:"700",color:"#334155",fontSize:"0.82rem",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},brandNameCustom:{fontWeight:"800",color:"#1e40af",fontSize:"0.82rem",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},catBadge:{fontSize:"0.62rem",color:"#64748b",backgroundColor:"#e2e8f0",padding:"0.1rem 0.35rem",borderRadius:"4px",fontWeight:"600"},customBadge:{fontSize:"0.62rem",color:"#1e40af",backgroundColor:"#dbeafe",padding:"0.1rem 0.35rem",borderRadius:"4px",fontWeight:"800"},actionIconBtn:{background:"none",border:"none",cursor:"pointer",padding:"0.1rem",display:"flex",alignItems:"center",borderRadius:"3px"},footer:{padding:"0.75rem 1.25rem",borderTop:"1px solid #e2e8f0",display:"flex",justifyContent:"flex-end",backgroundColor:"#f8fafc"},doneBtn:{padding:"0.5rem 1.4rem",borderRadius:"8px",border:"none",backgroundColor:"#2563eb",color:"#ffffff",fontSize:"0.825rem",fontWeight:"800",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"0.4rem",boxShadow:"0 2px 8px rgba(37, 99, 235, 0.25)"}};function ye({items:h,onEdit:p,onDelete:_,onAdd:P,onSync:q,onOpenManager:Z}){const[W,F]=i.useState(""),[g,k]=i.useState("All"),[z,x]=i.useState("All"),[C,u]=i.useState("description"),[E,T]=i.useState("asc"),[Q,ee]=i.useState(!1),[B,N]=i.useState(!1),b=i.useRef(0);i.useEffect(()=>{const t=()=>{if(!B){const a=window.scrollY||document.documentElement.scrollTop||0;a>0&&(b.current=a)}};return window.addEventListener("scroll",t,{passive:!0}),()=>window.removeEventListener("scroll",t)},[B]);const H=()=>{document.activeElement&&typeof document.activeElement.blur=="function"&&document.activeElement.blur();const t=b.current||0;N(!1);const a=()=>{typeof window<"u"&&window.scrollTo({top:t,behavior:"instant"})};a(),requestAnimationFrame(a),setTimeout(a,30),setTimeout(a,100),setTimeout(a,300)},[w,R]=i.useState(()=>{try{const t=localStorage.getItem("elite_managed_brands");return t?JSON.parse(t):["ANOUK","ELITE EDITION","HERA","MYNTRA"]}catch{return["ANOUK","ELITE EDITION","HERA","MYNTRA"]}});i.useEffect(()=>{const t=()=>{try{const a=localStorage.getItem("elite_managed_brands");a&&R(JSON.parse(a))}catch{}};return window.addEventListener("storage",t),window.addEventListener("elite_brands_updated",t),()=>{window.removeEventListener("storage",t),window.removeEventListener("elite_brands_updated",t)}},[]);const G=t=>{const a=[...w,t];R(a);try{localStorage.setItem("elite_managed_brands",JSON.stringify(a)),window.dispatchEvent(new Event("storage")),window.dispatchEvent(new CustomEvent("elite_brands_updated",{detail:a}))}catch{}},V=t=>{const a=w.filter(s=>s.toLowerCase()!==t.toLowerCase());R(a);try{localStorage.setItem("elite_managed_brands",JSON.stringify(a)),window.dispatchEvent(new Event("storage")),window.dispatchEvent(new CustomEvent("elite_brands_updated",{detail:a}))}catch{}},$=new Map,I=t=>{if(!t||typeof t!="string")return;const a=t.trim();if(!a||a.toUpperCase()==="ALL")return;const s=a.toUpperCase();$.has(s)||$.set(s,s)};(h||[]).forEach(t=>{t.brand&&I(t.brand),Array.isArray(t.brandCodes)&&t.brandCodes.forEach(a=>{const s=typeof a=="object"?a.brand:a;I(s)})}),(w||[]).forEach(t=>I(t));const U=Array.from($.values()).sort((t,a)=>t.localeCompare(a,void 0,{sensitivity:"base"})),Y=["All",...U],v=["All",...new Set(h.flatMap(t=>t.size||[]).filter(Boolean))],A=t=>{C===t?T(E==="asc"?"desc":"asc"):(u(t),T("asc"))},L=h.filter(t=>{const a=ge(t,W,["description","brand","skuCode","categoryName","color","size"]),s=g==="All"||t.size&&t.size.includes(g),d=z==="All"||t.brand&&t.brand.trim().toLowerCase()===z.trim().toLowerCase()||Array.isArray(t.brandCodes)&&t.brandCodes.some(y=>{const c=typeof y=="object"?y.brand:y;return c&&c.trim().toLowerCase()===z.trim().toLowerCase()});return a&&s&&d}).sort((t,a)=>{let s=t[C],d=a[C];return s==null&&(s=""),d==null&&(d=""),typeof s=="string"&&(s=s.toLowerCase(),d=d.toLowerCase()),s<d?E==="asc"?-1:1:s>d?E==="asc"?1:-1:0}),te=t=>{const a=t.skuCode||t.sku||"NO-SKU",s=Array.isArray(t.size)?t.size.join("/"):t.size||"N/A",d=t.brand&&t.brand.toUpperCase()!=="ELITE ONLINE"&&t.brand.toUpperCase()!=="ALL"?t.brand.toUpperCase():"EON",y=window.prompt(`How many barcode stickers to print for SKU "${a}"?`,"1");if(y===null)return;const c=parseInt(y,10);if(isNaN(c)||c<=0){alert("Please enter a valid positive number.");return}const j=window.open("","_blank","width=800,height=600"),re=Math.ceil(c/2);let K="";for(let S=0;S<re;S++){const r=S*2,o=S*2+1,m=`
        <div class="sticker">
          <div class="title">${d}</div>
          <div class="barcode-container">
            <svg class="barcode-img" id="barcode_${r}"></svg>
          </div>
          <div class="footer-row">
            <span class="sku-text">${a}</span>
            <span class="size-text">Size: ${s}</span>
          </div>
        </div>
      `,f=o<c?`
          <div class="sticker">
            <div class="title">${d}</div>
            <div class="barcode-container">
              <svg class="barcode-img" id="barcode_${o}"></svg>
            </div>
            <div class="footer-row">
              <span class="sku-text">${a}</span>
              <span class="size-text">Size: ${s}</span>
            </div>
          </div>
        `:'<div class="sticker" style="visibility: hidden;"></div>';K+=`
        <div class="sheet">
          ${m}
          ${f}
        </div>
      `}let J="";for(let S=0;S<c;S++)J+=`
        JsBarcode("#barcode_${S}", "${a}", {
          format: "CODE128",
          displayValue: false,
          margin: 0,
          background: "transparent",
          lineColor: "#000",
          width: 2,
          height: 40
        });
      `;const X=`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Barcodes - ${a}</title>
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
        ${K}
        <script>
          try { ${J} } catch(e) { console.error(e); }
          window.onload = function() {
            setTimeout(function() { window.print(); window.close(); }, 300);
          }
        <\/script>
      </body>
      </html>
    `;j.document.open(),j.document.write(X),j.document.close()};return e.jsxs("div",{className:"glass-panel",style:l.gridPanel,children:[e.jsxs("div",{className:"catalog-control-header",style:{...l.controlHeader,display:"flex",flexDirection:"row",flexWrap:"nowrap",alignItems:"center",justify:"space-between",padding:"0.45rem 0.85rem",borderRadius:"12px",background:"#ffffff",border:"1px solid #e2e8f0",boxShadow:"0 4px 16px rgba(0,0,0,0.03)",gap:"0.5rem",overflowX:"auto",whiteSpace:"nowrap"},children:[e.jsxs("div",{className:"catalog-left-controls",style:{...l.leftControls,flexShrink:0,flexWrap:"nowrap"},children:[e.jsxs("div",{className:"catalog-search-box",style:{...l.searchBox,minWidth:"180px",maxWidth:"240px"},children:[e.jsx(ae,{size:14,color:"#64748b",style:l.searchIcon}),e.jsx("input",{type:"text",value:W,onChange:t=>F(t.target.value),placeholder:"Search catalog by SKU, name...",style:l.searchInput})]}),e.jsxs("div",{className:"catalog-filter-box",style:l.filterBox,children:[e.jsx(fe,{size:14,color:"#059669"}),e.jsx("select",{value:g,onChange:t=>k(t.target.value),style:l.selectInput,children:v.map((t,a)=>e.jsx("option",{value:t,children:t==="All"?"All Sizes":`Size ${t}`},a))})]}),e.jsxs("div",{className:"catalog-filter-box",style:l.filterBox,children:[e.jsx(ne,{size:14,color:"#059669"}),e.jsx("select",{value:z,onChange:t=>x(t.target.value),style:l.selectInput,children:Y.map((t,a)=>e.jsx("option",{value:t,children:t==="All"?"All Brands":t},a))})]})]}),e.jsx("div",{className:"catalog-action-group",style:{display:"flex",gap:"0.4rem",alignItems:"center",flexShrink:0,flexWrap:"nowrap"},children:e.jsxs("button",{onClick:P,className:"btn-success",style:{...l.primaryAddBtn,padding:"0.45rem 0.85rem"},children:[e.jsx(oe,{size:14}),e.jsx("span",{children:"+ Add Product"})]})})]}),e.jsx("div",{className:"table-container data-table-container",style:{...l.tableWrap,overflowX:"auto",WebkitOverflowScrolling:"touch",width:"100%"},children:L.length===0?e.jsx("div",{style:l.emptyTable,children:"No products match your filters."}):e.jsxs("table",{className:"data-table",style:{...l.table,minWidth:"820px",width:"100%"},children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsxs("th",{onClick:()=>A("description"),style:{cursor:"pointer"},children:["PRODUCT DETAILS ",C==="description"?E==="asc"?"▲":"▼":""]}),e.jsxs("th",{onClick:()=>A("skuCode"),style:{cursor:"pointer"},children:["SKU CODE ",C==="skuCode"?E==="asc"?"▲":"▼":""]}),e.jsxs("th",{onClick:()=>A("brand"),style:{cursor:"pointer"},children:["BRAND ",C==="brand"?E==="asc"?"▲":"▼":""]}),e.jsx("th",{children:"SIZES"}),e.jsxs("th",{onClick:()=>A("basePrice"),style:{cursor:"pointer"},children:["BASE PRICE ",C==="basePrice"?E==="asc"?"▲":"▼":""]}),e.jsxs("th",{onClick:()=>A("price"),style:{cursor:"pointer"},children:["PRICE ",C==="price"?E==="asc"?"▲":"▼":""]}),e.jsx("th",{className:"text-center",children:"LIVE STOCK"}),e.jsx("th",{className:"text-center",children:"ACTIONS"})]})}),e.jsx("tbody",{children:L.map(t=>{const a=t.inventorySnapshots?.inventory,s=a!=null;let d="badge-success",y=s?`${a} Units`:"No Live Sync";return s&&a===0?(d="badge-danger",y="0 Units (Out of Stock)"):s&&a<=5&&(d="badge-warning",y=`${a} Units (Low Stock)`),e.jsxs("tr",{children:[e.jsx("td",{children:e.jsxs("div",{style:l.itemCell,children:[e.jsxs("div",{style:l.itemImgWrapper,children:[t.imageUrl?e.jsx("img",{src:t.imageUrl,alt:t.description,style:l.itemImg,onError:c=>{c.target.style.display="none",c.target.nextSibling.style.display="flex"}}):null,e.jsx("div",{style:{...l.imgPlaceholder,display:t.imageUrl?"none":"flex"},children:t.description?t.description[0].toUpperCase():"P"})]}),e.jsxs("div",{children:[e.jsx("div",{style:l.itemName,children:t.description||"Unnamed Product"}),e.jsxs("div",{style:l.itemMeta,children:["Category: ",t.categoryName||"KURTA SET"]})]})]})}),e.jsxs("td",{children:[e.jsx("span",{style:l.skuBadge,children:t.skuCode}),Array.isArray(t.brandCodes)&&t.brandCodes.length>0&&e.jsx("div",{style:{display:"flex",gap:"3px",flexWrap:"wrap",marginTop:"4px"},children:t.brandCodes.map((c,j)=>e.jsx("span",{style:{fontSize:"0.68rem",background:"#f1f5f9",color:"#475569",border:"1px solid #cbd5e1",borderRadius:"4px",padding:"1px 5px",fontWeight:600},children:typeof c=="string"?c:`${c.brand?c.brand+": ":""}${c.code}`},j))})]}),e.jsx("td",{children:e.jsx("span",{style:l.brandBadge,children:t.brand||"ANOUK"})}),e.jsx("td",{children:Array.isArray(t.size)?e.jsx("div",{style:l.sizeWrap,children:t.size.map((c,j)=>e.jsx("span",{style:l.sizeBadge,children:c},j))}):e.jsx("span",{style:l.sizeBadge,children:t.size||"N/A"})}),e.jsxs("td",{children:["Rs. ",(t.basePrice||0).toFixed(2)]}),e.jsxs("td",{style:{fontWeight:"700",color:"var(--text-primary)"},children:["Rs. ",(t.price||0).toFixed(2)]}),e.jsx("td",{className:"text-center",children:e.jsx("span",{className:`badge ${d}`,children:y})}),e.jsx("td",{className:"text-center",children:e.jsxs("div",{style:l.actionGroup,children:[e.jsx("button",{onClick:()=>te(t),className:"btn-icon",title:"Print Stock Barcode Sticker",style:{color:"#2563eb"},children:e.jsx(ue,{size:15})}),e.jsx("button",{onClick:()=>p(t),className:"btn-icon",title:"Edit Product Details",children:e.jsx(se,{size:15})}),e.jsx("button",{onClick:()=>_(t._id),className:"btn-icon",style:l.trashBtn,title:"Delete Product",children:e.jsx(ie,{size:15})})]})})]},t._id)})})]})}),B&&e.jsx(xe,{existingBrands:U||[],customBrands:w||[],onAddBrand:G,onDeleteBrand:V,onClose:H})]})}if(typeof document<"u"){const h="product-catalog-grid-responsive-style";if(!document.getElementById(h)){const p=document.createElement("style");p.id=h,p.innerHTML=`
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
    `,document.head.appendChild(p)}}const l={gridPanel:{padding:"1.5rem",display:"flex",flexDirection:"column",gap:"1.2rem",minHeight:"450px"},controlHeader:{display:"flex",flexDirection:"row",justify:"space-between",alignItems:"center",gap:"0.5rem",flexWrap:"nowrap",overflowX:"auto",whiteSpace:"nowrap"},leftControls:{display:"flex",alignItems:"center",gap:"0.6rem",flexWrap:"nowrap"},searchBox:{position:"relative",width:"260px",flexShrink:0,display:"flex",alignItems:"center"},searchIcon:{position:"absolute",left:"0.75rem",pointerEvents:"none"},searchInput:{width:"100%",padding:"0.55rem 0.75rem 0.55rem 2.2rem",borderRadius:"8px",border:"1px solid #cbd5e1",backgroundColor:"#ffffff",color:"#0f172a",fontSize:"0.85rem",fontWeight:"500",outline:"none",boxSizing:"border-box"},filterBox:{display:"flex",alignItems:"center",gap:"0.4rem",backgroundColor:"#ffffff",border:"1px solid #cbd5e1",padding:"0 0.65rem",borderRadius:"8px",height:"38px",boxSizing:"border-box",flexShrink:0},selectInput:{border:"none",backgroundColor:"transparent",padding:"0.4rem 0.2rem",fontSize:"0.85rem",fontWeight:"600",color:"#0f172a",outline:"none",cursor:"pointer"},primaryAddBtn:{padding:"0.55rem 1.25rem",borderRadius:"8px",border:"none",backgroundColor:"#059669",color:"#ffffff",fontSize:"0.85rem",fontWeight:"700",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"0.4rem",height:"38px",boxShadow:"0 4px 6px -1px rgba(5, 150, 105, 0.3)"},tableWrap:{flex:1},emptyTable:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"4rem 1rem",textAlign:"center"},itemCell:{display:"flex",alignItems:"center",gap:"0.75rem"},itemImgWrapper:{width:"38px",height:"38px",borderRadius:"8px",overflow:"hidden",background:"rgba(255, 255, 255, 0.03)",border:"1px solid var(--border-light)",flexShrink:0,position:"relative"},itemImg:{width:"100%",height:"100%",objectFit:"cover"},imgPlaceholder:{width:"100%",height:"100%",alignItems:"center",justifyContent:"center",fontSize:"0.9rem",fontWeight:"600",color:"var(--primary)",background:"rgba(6, 182, 212, 0.1)"},itemName:{fontWeight:"500",color:"var(--text-primary)"},itemMeta:{fontSize:"0.7rem",color:"var(--text-muted)",marginTop:"2px"},sizeBadge:{fontSize:"0.8rem",fontWeight:"600",color:"var(--text-primary)",background:"rgba(255, 255, 255, 0.06)",padding:"0.15rem 0.45rem",borderRadius:"4px",border:"1px solid var(--border-light)"},trashBtn:{color:"#fca5a5",borderColor:"rgba(239, 68, 68, 0.1)"}};if(typeof document<"u"){const h="catalog-grid-responsive-style";if(!document.getElementById(h)){const p=document.createElement("style");p.id=h,p.innerHTML=`
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
    `,document.head.appendChild(p)}}export{ye as default};
