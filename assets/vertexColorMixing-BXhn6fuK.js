import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{n as t,t as n}from"./shaderStore-Ctc--YQD.js";var r,i,a;function o(){return(o=e((()=>{t(),r=`vertexColorMixing`,i=`#if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)
vColor=vec4(1.0);
#ifdef VERTEXCOLOR
#ifdef VERTEXALPHA
vColor*=colorUpdated;
#else
vColor.rgb*=colorUpdated.rgb;
#endif
#endif
#ifdef INSTANCESCOLOR
vColor*=instanceColor;
#endif
#endif
`,n.IncludesShadersStore[r]||(n.IncludesShadersStore[r]=i),a={name:r,shader:i}})))()}export{a as n,o as t};