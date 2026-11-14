import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";var i=t({gaussianSplattingVertexDeclaration:()=>s}),a,o,s;function c(){return(c=e((()=>{n(),a=`gaussianSplattingVertexDeclaration`,o=`attribute vec3 position;attribute vec4 splatIndex0;attribute vec4 splatIndex1;attribute vec4 splatIndex2;attribute vec4 splatIndex3;uniform mat4 view;uniform mat4 projection;uniform mat4 world;uniform vec4 vEyePosition;
#ifdef PREPASS
uniform mat4 inverseProjection;
#endif
`,r.IncludesShadersStore[a]||(r.IncludesShadersStore[a]=o),s={name:a,shader:o}})))()}export{i as n,c as r,s as t};