import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{n as t,t as n}from"./shaderStore-Ctc--YQD.js";import{t as r}from"./objectIdFunctions-ChM7u7hc.js";var i,a,o;function s(){return(s=e((()=>{t(),r(),i=`prePassDeclaration`,a=`#ifdef PREPASS
#ifndef PREPASS_CUSTOM_VARYINGS
#ifdef PREPASS_LOCAL_POSITION
varying vPosition : vec3f;
#endif
#ifdef PREPASS_DEPTH
varying vViewPos: vec3f;
#endif
#ifdef PREPASS_NORMALIZED_VIEW_DEPTH
varying vNormViewDepth: f32;
#endif
#if (defined(PREPASS_VELOCITY) || defined(PREPASS_VELOCITY_LINEAR)) && !defined(PREPASS_VELOCITY_ZERO)
varying vCurrentPosition: vec4f;varying vPreviousPosition: vec4f;
#endif
#endif
#ifdef PREPASS_OBJECT_ID
uniform objectId: f32;
#include<objectIdFunctions>
#endif
#ifdef PREPASS_MESH_BLEND_TAG
uniform meshBlendTag: i32;
#endif
#endif
`,n.IncludesShadersStoreWGSL[i]||(n.IncludesShadersStoreWGSL[i]=a),o={name:i,shader:a}})))()}var c,l,u;function d(){return(d=e((()=>{t(),c=`meshBlendTagFragmentOutput`,l=`#if SCENE_MRT_COUNT>{X}
#if defined(PREPASS_MESH_BLEND_TAG) && PREPASS_MESH_BLEND_TAG_INDEX=={X}
fragmentOutputs.fragData{X}=meshBlendTagOutput;
#else
fragmentOutputs.fragData{X}=fragData[{X}];
#endif
#endif
`,n.IncludesShadersStoreWGSL[c]||(n.IncludesShadersStoreWGSL[c]=l),u={name:c,shader:l}})))()}export{o as i,u as n,s as r,d as t};