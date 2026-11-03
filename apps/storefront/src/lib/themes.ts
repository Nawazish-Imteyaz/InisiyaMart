// Design options shown to the family for voting. Colours mirror globals.css [data-theme] blocks.
export const themes = [
  { id: "rose", name: "Rose Plum", note: "Recommended · soft & feminine", colors: ["#6B2142", "#F3D6DC", "#FFFAF5", "#C9A24A"] },
  { id: "noir", name: "Nizamabad Noir", note: "Black pottery · quiet luxury", colors: ["#17140F", "#E4E1DC", "#F4EFE6", "#A97C2F"] },
  { id: "zari", name: "Zari Royal", note: "Plum & gold · festive", colors: ["#5A1E33", "#EBD9B4", "#FBF6EC", "#D4AF5A"] },
  { id: "ribbon", name: "Gulf Ribbon", note: "Teal & blush · modern", colors: ["#0F4C4A", "#E8C4B8", "#F7F1E8", "#B8893B"] },
] as const;

export type ThemeId = (typeof themes)[number]["id"];

export const THEME_KEY = "ih-theme";

// Runs before the page paints: applies ?theme=… from the link, or the last chosen design.
export const themeBootScript = `(function(){try{var ok=${JSON.stringify(themes.map((t) => t.id))};var t=new URLSearchParams(location.search).get('theme');if(t&&ok.indexOf(t)>-1){localStorage.setItem('${THEME_KEY}',t)}else{t=localStorage.getItem('${THEME_KEY}')}if(t&&ok.indexOf(t)>-1&&t!=='rose'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})();`;
