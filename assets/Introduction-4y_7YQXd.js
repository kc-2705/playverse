import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{t}from"./jsx-runtime-MKhVqBIO.js";import{i as n,r}from"./react-DITjJg24.js";import{l as i,s as a}from"./blocks-ChrYp-Mi.js";function o(e){let t={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,strong:`strong`,ul:`ul`,...n(),...e.components};return(0,c.jsxs)(c.Fragment,{children:[(0,c.jsx)(a,{title:`Introduction`}),`
`,(0,c.jsx)(t.h1,{id:`playverse-ui-components`,children:`Playverse UI components`}),`
`,(0,c.jsxs)(t.p,{children:[`These are the React components around the games in `,(0,c.jsx)(t.strong,{children:`Playverse`}),`, a 3D browser game hub built with React, TypeScript,
Ant Design and Babylon.js. The 3D games themselves run on a canvas; everything around them (game cards, leaderboards,
sign-in, the app shell) is documented here.`]}),`
`,(0,c.jsx)(t.h2,{id:`how-to-use-this-storybook`,children:`How to use this Storybook`}),`
`,(0,c.jsxs)(t.ul,{children:[`
`,(0,c.jsx)(t.li,{children:`Pick a component in the sidebar. Each story is one state of it.`}),`
`,(0,c.jsxs)(t.li,{children:[`Change props live in the `,(0,c.jsx)(t.strong,{children:`Controls`}),` panel, and see events like `,(0,c.jsx)(t.code,{children:`onPlay`}),` in `,(0,c.jsx)(t.strong,{children:`Actions`}),`.`]}),`
`,(0,c.jsxs)(t.li,{children:[`Check phone and tablet sizes with the `,(0,c.jsx)(t.strong,{children:`Viewport`}),` button.`]}),`
`,(0,c.jsxs)(t.li,{children:[`Open the `,(0,c.jsx)(t.strong,{children:`Accessibility`}),` panel to see automatic WCAG checks (axe-core).`]}),`
`,(0,c.jsxs)(t.li,{children:[`Stories with a `,(0,c.jsx)(t.strong,{children:`play function`}),` run a scripted test. Watch it step by step in the `,(0,c.jsx)(t.strong,{children:`Interactions`}),` panel.`]}),`
`]}),`
`,(0,c.jsx)(t.h2,{id:`interaction-tests`,children:`Interaction tests`}),`
`,(0,c.jsx)(t.p,{children:`| Story | What it checks |
| --- | --- |
| CharacterPicker / Interactive | Clicking a tile selects it and deselects the other |
| AuthModal / Sign Up | Switching tabs shows the sign-up fields |
| AuthModal / Validation | Empty fields show inline messages |
| AuthModal / Wrong Password | A rejected login shows the server's message |`}),`
`,(0,c.jsx)(t.h2,{id:`no-server-needed`,children:`No server needed`}),`
`,(0,c.jsxs)(t.p,{children:[`Stories use a small mock game server (`,(0,c.jsx)(t.code,{children:`.storybook/mockApi.ts`}),`). Each story says what the server should answer:`]}),`
`,(0,c.jsx)(t.pre,{children:(0,c.jsx)(t.code,{className:`language-ts`,children:`export const WrongPassword: Story = {
  parameters: { api: { 'POST /auth/login': fail(401, 'Wrong username or password.') } },
};
`})}),`
`,(0,c.jsxs)(t.p,{children:[`Set `,(0,c.jsx)(t.code,{children:`parameters: { signedIn: true }`}),` to render a story as a signed-in player.`]})]})}function s(e={}){let{wrapper:t}={...n(),...e.components};return t?(0,c.jsx)(t,{...e,children:(0,c.jsx)(o,{...e})}):o(e)}var c;function l(){return(l=e((()=>{c=t(),r(),i()})))()}l();export{s as default};