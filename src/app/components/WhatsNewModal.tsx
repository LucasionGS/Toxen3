import React from "react";
import { modals } from "@mantine/modals";
import { Button, ScrollArea } from "@mantine/core";
import Settings from "../toxen/Settings";
import showdown from "showdown";
import htmlToReactParser, { Element, Text } from "html-react-parser";
import ExternalUrl from "./ExternalUrl/ExternalUrl";
import { Toxen } from "../ToxenApp";

function parseChangeNotes(markdown: string, version: string): string | null {
  // Sections are delimited by HTML comments like <!-- VERSION: x.y.z --> until next version marker or end
  const regex = new RegExp(`<!--\\s*VERSION:\\s*${version.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*-->[\\s\\S]*?(?=(?:<!--\\s*VERSION:)|$)`, "i");
  const m = markdown.match(regex);
  if (!m) return null;
  // Strip the leading version comment marker for display
  return m[0].replace(/^<!--[\s\S]*?-->\s*/i, "").trim();
}

export async function showWhatsNewIfNeeded(appVersion: string) {
  try {
    const lastShown = Settings.get("lastShownChangeNotesVersion") || "";
    if (lastShown === appVersion) return; // already acknowledged
    const text = await fetch(Toxen.changeLogsUrl).then(r => r.text());
    const section = parseChangeNotes(text || "", appVersion);
    if (!section) return; // no section for this version

    const id = `whats-new-${appVersion}`;
    // Convert markdown to React, mirroring the Changes panel
    const converter = new showdown.Converter();
    const html = converter.makeHtml(section);
    const content = htmlToReactParser(html, {
      replace: (domNode: Element) => {
        if (domNode.name == "a" && domNode.attribs?.href && !domNode.attribs.href.startsWith("#")) {
          return <ExternalUrl href={domNode.attribs.href}>{domNode.children.map((c: Text) => (c as any).data)}</ExternalUrl>;
        }
      }
    });

    modals.open({
      id,
      title: `What's new in v${appVersion}`,
      centered: true,
      size: "xl",
      onClose() {
          Settings.apply({ lastShownChangeNotesVersion: appVersion }, true);
      },
      children: (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ScrollArea h={500} type="auto" offsetScrollbars>
            <div>{content}</div>
          </ScrollArea>
        </div>
      ),
    });
  } catch {
    // ignore failures
  }
}
