/** D76 M2: original line icons (24 px grid, currentColor) for the editor shell. */
const paths={
 draw:'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
 openings:'M5 21V4h9v17M14 4l5 2v15l-5-2M11 13h.01M3 21h18',
 furniture:'M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M3 11h18v6H3zM5 17v3M19 17v3',
 materials:'M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1.1.2-2.2 1.4-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10ZM7.5 11.5h.01M10 7.5h.01M15 7.5h.01',
 copilot:'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3ZM18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z',
 project:'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
 close:'M6 6l12 12M18 6 6 18',
 undo:'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
 redo:'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
 export:'M12 3v12M7 10l5 5 5-5M5 21h14',
} as const;
export type IconName=keyof typeof paths;
export function Icon({name}:{name:IconName}){
 return <svg className="icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]}/></svg>;
}
