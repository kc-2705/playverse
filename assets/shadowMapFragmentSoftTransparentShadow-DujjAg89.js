import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";var i=t({shadowMapFragmentSoftTransparentShadow:()=>s}),a,o,s;function c(){return(c=e((()=>{n(),a=`shadowMapFragmentSoftTransparentShadow`,o=`#if SM_SOFTTRANSPARENTSHADOW==1
if ((bayerDither8(floor(mod(gl_FragCoord.xy,8.0))))/64.0>=softTransparentShadowSM.x*alpha) discard;
#endif
`,r.IncludesShadersStore[a]||(r.IncludesShadersStore[a]=o),s={name:a,shader:o}})))()}export{i as n,c as t};