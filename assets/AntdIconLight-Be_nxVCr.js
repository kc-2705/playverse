import{a as e,n as t}from"./rolldown-runtime-sJBDdmOt.js";import{t as n}from"./react-DlPsW1c0.js";function r(e){var t,n,i=``;if(typeof e==`string`||typeof e==`number`)i+=e;else if(typeof e==`object`){if(Array.isArray(e)){var a=e.length;for(t=0;t<a;t++)e[t]&&(n=r(e[t]))&&(i&&(i+=` `),i+=n)}else for(n in e)e[n]&&(i&&(i+=` `),i+=n)}return i}function i(){for(var e,t,n=0,i=``,a=arguments.length;n<a;n++)(e=arguments[n])&&(t=r(e))&&(i&&(i+=` `),i+=t);return i}function a(){return(a=t((()=>{})))()}var o,s;function c(){return(c=t((()=>{o=n(),s=(0,o.createContext)({})})))()}function l(){return!!(typeof window<`u`&&window.document&&window.document.createElement)}function u(e,t){if(!e||!t)return!1;if(e.contains)return e.contains(t);let n=t;for(;n;){if(n===e)return!0;n=n.parentNode}return!1}function d({mark:e}={}){return e?e.startsWith(`data-`)?e:`data-${e}`:w}function f(e){return e.attachTo?e.attachTo:document.querySelector(`head`)||document.body}function p(e){return e===`queue`?`prependQueue`:e?`prepend`:`append`}function m(e){return Array.from((T.get(e)||e).children).filter(e=>e.tagName===`STYLE`)}function h(e,t={}){if(!l())return null;let{csp:n,prepend:r,priority:i=0}=t,a=p(r),o=a===`prependQueue`,s=document.createElement(`style`);s.setAttribute(S,a),o&&i&&s.setAttribute(C,`${i}`),n?.nonce&&(s.nonce=n.nonce),s.innerHTML=e;let c=f(t),{firstChild:u}=c;if(r){if(o){let e=(t.styles||m(c)).filter(e=>{if(![`prepend`,`prependQueue`].includes(e.getAttribute(S)))return!1;let t=Number(e.getAttribute(C)||0);return i>=t});if(e.length)return c.insertBefore(s,e[e.length-1].nextSibling),s}c.insertBefore(s,u)}else c.appendChild(s);return s}function g(e,t={}){let{styles:n}=t;return n||=m(f(t)),n.find(n=>n.getAttribute(d(t))===e)}function _(e,t){let n=T.get(e);if(!n||!u(document,n)){let n=h(``,t);if(!n)return;let{parentNode:r}=n;T.set(e,r),e.removeChild(n)}}function v(e,t,n={}){if(!l())return null;let r=f(n),i=m(r),a={...n,styles:i};_(r,a);let o=g(t,a);if(o)return a.csp?.nonce&&o.nonce!==a.csp.nonce&&(o.nonce=a.csp.nonce),o.innerHTML!==e&&(o.innerHTML=e),o;let s=h(e,a);return s?.setAttribute(d(a),t),s}function y(e){return e?.getRootNode?.()}function b(e){let t=y(e);return typeof ShadowRoot<`u`&&t instanceof ShadowRoot?t:null}function x(e,t){e||E[t]||(E[t]=!0)}var S,C,w,T,E;function D(){return(D=t((()=>{S=`data-rc-order`,C=`data-rc-priority`,w=`rc-util-key`,T=new Map,E={}})))()}function O(e){return e.replace(/-(.)/g,(e,t)=>t.toUpperCase())}function k(e,t){x(e,`[@ant-design/icons] ${t}`)}function A(e){return typeof e==`object`&&!!e&&typeof e.name==`string`&&typeof e.theme==`string`&&(typeof e.icon==`object`||typeof e.icon==`function`)}function j(e={}){return Object.keys(e).reduce((t,n)=>{let r=e[n];switch(n){case`class`:t.className=r,delete t.class;break;default:delete t[n],t[O(n)]=r}return t},{})}function M(e,t,n){return n?N.createElement(e.tag,{key:t,...j(e.attrs),...n},(e.children||[]).map((n,r)=>M(n,`${t}-${e.tag}-${r}`))):N.createElement(e.tag,{key:t,...j(e.attrs)},(e.children||[]).map((n,r)=>M(n,`${t}-${e.tag}-${r}`)))}var N,P,F;function I(){return(I=t((()=>{N=e(n()),c(),D(),P=`
.anticon {
  display: inline-flex;
  align-items: center;
  color: inherit;
  font-style: normal;
  line-height: 0;
  text-align: center;
  text-transform: none;
  vertical-align: -0.125em;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.anticon > * {
  line-height: 1;
}

.anticon svg {
  display: inline-block;
  vertical-align: inherit;
}

.anticon::before {
  display: none;
}

.anticon .anticon-icon {
  display: block;
}

.anticon[tabindex] {
  cursor: pointer;
}

.anticon-spin {
  -webkit-animation: loadingCircle 1s infinite linear;
  animation: loadingCircle 1s infinite linear;
}

@-webkit-keyframes loadingCircle {
  100% {
    -webkit-transform: rotate(360deg);
    transform: rotate(360deg);
  }
}

@keyframes loadingCircle {
  100% {
    -webkit-transform: rotate(360deg);
    transform: rotate(360deg);
  }
}
`,F=e=>{let{csp:t,prefixCls:n,layer:r,zeroRuntime:i}=(0,N.useContext)(s),a=P;n&&(a=a.replace(/anticon/g,n)),r&&(a=`@layer ${r} {\n${a}\n}`),(0,N.useEffect)(()=>{if(i)return;let n=e.current,o=b(n);v(a,`@ant-design-icons`,{prepend:!r,csp:t,attachTo:o})},[])}})))()}var L,R;function z(){return(z=t((()=>{L=e(n()),I(),R=e=>{let{icon:t,className:n,onClick:r,style:i,primaryColor:a,secondaryColor:o,...s}=e,c=L.useRef(null);if(F(c),k(A(t),`icon should be icon definiton, but got ${typeof t}`),!A(t))return null;let l=t;return M(l.icon,`svg-${l.name}`,{className:n,onClick:r,style:i,"data-icon":l.name,width:`1em`,height:`1em`,fill:`currentColor`,"aria-hidden":`true`,...s,ref:c})},R.displayName=`IconReact`})))()}function B(){return B=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(e[r]=n[r])}return e},B.apply(this,arguments)}var V,H;function U(){return(U=t((()=>{V=e(n()),a(),c(),z(),I(),H=V.forwardRef((e,t)=>{let{className:n,icon:r,spin:a,rotate:o,tabIndex:c,onClick:l,twoToneColor:u,...d}=e,{prefixCls:f=`anticon`,rootClassName:p}=V.useContext(s);if(k(A(r),`icon should be icon definiton, but got ${typeof r}`),!A(r))return null;let m=i(p,f,{[`${f}-${r.name}`]:!!r.name,[`${f}-spin`]:!!a||r.name===`loading`},n),h=c;h===void 0&&l&&(h=-1);let g=o?{msTransform:`rotate(${o}deg)`,transform:`rotate(${o}deg)`}:void 0;return V.createElement(`span`,B({role:`img`,"aria-label":r.name},d,{ref:t,tabIndex:h,onClick:l,className:m}),V.createElement(R,{icon:r,style:g}))})})))()}export{i as a,c as i,U as n,a as o,s as r,H as t};