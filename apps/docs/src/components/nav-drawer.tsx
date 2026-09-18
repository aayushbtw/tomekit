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
  radii,
  space,
  weights,
} from "#/styles/tokens.stylex";
import { typography } from "#/styles/typography";

interface NavDrawerProps {
  nav: Nav[];
}

// Keeps the sheet's background under the screen's bottom edge, so a bounced swipe never shows the page behind it.
const bleed = "3rem";

const ease = "cubic-bezier(0.32, 0.72, 0, 1)";

// Transitions read Base UI's `--drawer-swipe-*` variables and `data-*` states.
const drawer = stylex.create({
  backdrop: {
    backgroundColor: "var(--black-a8)",
    inset: 0,
    opacity: {
      ":is([data-starting-style], [data-ending-style])": 0,
      default: "calc(1 - var(--drawer-swipe-progress, 0))",
    },
    position: "fixed",
    transitionDuration: "450ms",
    transitionProperty: "opacity",
    transitionTimingFunction: ease,
  },
  content: {
    display: "flex",
    flex: 1,
    flexDirection: "column",
    minHeight: 0,
  },
  // The bar is the close button, so its row carries the hit area.
  handle: {
    alignItems: "center",
    backgroundColor: "transparent",
    display: "flex",
    flexShrink: 0,
    height: layout.itemHeight,
    justifyContent: "center",
    marginBlockEnd: space.px8,
  },
  handleBar: {
    backgroundColor: colors.borderStrong,
    borderRadius: 999,
    height: 4,
    width: 36,
  },
  popup: {
    backgroundColor: colors.background,
    borderStartEndRadius: radii.lg,
    borderStartStartRadius: radii.lg,
    borderTopColor: colors.border,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    display: "flex",
    flexDirection: "column",
    marginBlockEnd: `calc(-1 * ${bleed})`,
    maxHeight: `calc(85dvh + ${bleed})`,
    outline: 0,
    overflow: "hidden",
    paddingBlockEnd: `calc(${bleed} + env(safe-area-inset-bottom, 0px))`,
    paddingBlockStart: space.px8,
    paddingInline: space.px24,
    transform: {
      ":is([data-starting-style], [data-ending-style])": `translateY(calc(100% - ${bleed} + 2px))`,
      default: "translateY(var(--drawer-swipe-movement-y))",
    },
    transitionDuration: {
      // A flick closes faster than a drag.
      ":is([data-ending-style]):not([data-swiping])":
        "calc(var(--drawer-swipe-strength) * 400ms)",
      // Following a finger, not animating to it.
      ":is([data-swiping])": "0ms",
      default: "450ms",
    },
    transitionProperty: "transform",
    transitionTimingFunction: ease,
    width: "100%",
    willChange: "transform",
  },
  viewport: {
    alignItems: "flex-end",
    display: "flex",
    inset: 0,
    position: "fixed",
  },
});

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
        <Drawer.Backdrop {...stylex.props(drawer.backdrop)} />
        <Drawer.Viewport {...stylex.props(drawer.viewport)}>
          <Drawer.Popup {...stylex.props(drawer.popup)}>
            <Drawer.Close
              aria-label="Close the docs navigation"
              {...stylex.props(drawer.handle)}
            >
              <span {...stylex.props(drawer.handleBar)} />
            </Drawer.Close>
            <Drawer.Content {...stylex.props(drawer.content)}>
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
