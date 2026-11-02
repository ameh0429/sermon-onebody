import { useEffect, useState, type CSSProperties } from "react";

export interface YouVersionDisplay {
  html: string;
  stylesheets: { kind: "bible" | "font"; rel: "stylesheet"; href: string }[];
  containerAttributes: { "data-yv-sdk": ""; "data-slot": "yv-bible-renderer" };
}
export function YouVersionText({
  display,
  fontSize,
}: {
  display: YouVersionDisplay;
  fontSize: number;
}) {
  const [dark, setDark] = useState(
    () => document.documentElement.dataset.theme === "dark",
  );
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setDark(document.documentElement.dataset.theme === "dark"),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const links: HTMLLinkElement[] = [];
    for (const sheet of display.stylesheets) {
      const url = new URL(sheet.href);
      const allowed =
        url.protocol === "https:" &&
        ((sheet.kind === "bible" &&
          url.origin === "https://cdn.youversion.com" &&
          url.pathname === "/platform/1/bible.css") ||
          (sheet.kind === "font" &&
            url.origin === "https://api.youversion.com" &&
            url.pathname === "/v1/fonts/1/stylesheet"));
      if (!allowed) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url.href;
      link.dataset.yvStylesheet = sheet.kind;
      document.head.append(link);
      links.push(link);
    }
    return () => links.forEach((link) => link.remove());
  }, [display]);
  return (
    <div
      data-yv-sdk=""
      data-slot="yv-bible-renderer"
      data-yv-theme={dark ? "dark" : "light"}
      style={
        {
          "--yv-reader-font-size": `${fontSize}px`,
          "--yv-reader-line-height": "1.625",
          "--yv-reader-max-width": "65ch",
        } as CSSProperties
      }
      // Only the official SDK's sanitized and transformed HTML reaches this component.
      dangerouslySetInnerHTML={{ __html: display.html }}
    />
  );
}
