import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{n as t,t as n}from"./shaderStore-Ctc--YQD.js";var r,i,a;function o(){return(o=e((()=>{t(),r=`logDepthVertex`,i=`#ifdef LOGARITHMICDEPTH
vFragmentDepth=1.0+gl_Position.w;gl_Position.z=log2(max(0.000001,vFragmentDepth))*logarithmicDepthConstant;
#endif
`,n.IncludesShadersStore[r]||(n.IncludesShadersStore[r]=i),a={name:r,shader:i}})))()}export{a as n,o as t};