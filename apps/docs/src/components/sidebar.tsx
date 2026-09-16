import * as stylex from "@stylexjs/stylex";

import { DocsNav } from "#/components/docs-nav";
import type { Nav } from "#/components/docs-nav";

import { below, layout } from "../tokens.stylex";

interface SidebarProps {
  nav: Nav[];
}

const styles = stylex.create({
  sidebar: {
    display: {
      [below.lg]: "none",
      default: "flex",
    },
    flexDirection: "column",
    flexShrink: 0,
    height: "100dvh",
    marginInlineEnd: layout.columnGap,
    paddingBlockStart: layout.contentTop,
    position: "sticky",
    scrollbarWidth: "none",
    top: 0,
    width: layout.sidebarWidth,
  },
});

function Sidebar({ nav }: SidebarProps) {
  return (
    <aside {...stylex.props(styles.sidebar)}>
      <DocsNav nav={nav} />
    </aside>
  );
}

export { Sidebar };
