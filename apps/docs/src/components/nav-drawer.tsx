import { Drawer } from "@base-ui/react/drawer";
import * as stylex from "@stylexjs/stylex";
import { useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { DocsNav } from "#/components/docs-nav";
import type { Nav } from "#/components/docs-nav";
import {
  below,
  colors,
  durations,
  layout,
  space,
  weights,
} from "#/styles/tokens.stylex";
import { typography } from "#/styles/typography";

interface NavDrawerProps {
  nav: Nav[];
}

const styles = stylex.create({
  title: {
    alignItems: "center",
    color: colors.textPrimary,
    display: "flex",
    flexShrink: 0,
    fontVariationSettings: weights.medium,
    height: layout.itemHeight,
    marginBlockEnd: space.px16,
  },
  trigger: {
    alignItems: "center",
    backgroundColor: "transparent",
    color: {
      ":hover": colors.textPrimary,
      default: colors.textMuted,
    },
    display: {
      [below.lg]: "flex",
      default: "none",
    },
    height: layout.itemHeight,
    justifyContent: "center",
    transitionDuration: durations.fast,
    transitionProperty: "color",
    width: layout.itemHeight,
  },
});

function NavDrawer({ nav }: NavDrawerProps) {
  const [open, setOpen] = useState(false);
  const pathname = useLocation({ select: (location) => location.pathname });

  // A link inside the drawer navigates without closing it.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Drawer.Root onOpenChange={setOpen} open={open}>
      <Drawer.Trigger
        aria-label="Open the docs navigation"
        {...stylex.props(styles.trigger)}
      >
        <svg
          aria-hidden
          fill="none"
          height="16"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
          viewBox="0 0 16 16"
          width="16"
        >
          <path d="M2 4h12M2 8h12M2 12h12" />
        </svg>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop className="drawer-backdrop" />
        <Drawer.Viewport className="drawer-viewport">
          <Drawer.Popup className="drawer-popup">
            <Drawer.Close
              aria-label="Close the docs navigation"
              className="drawer-handle"
            >
              <span className="drawer-handle-bar" />
            </Drawer.Close>
            <Drawer.Content className="drawer-content">
              <Drawer.Title {...stylex.props(typography.base, styles.title)}>
                Docs
              </Drawer.Title>
              <DocsNav nav={nav} />
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export { NavDrawer };
