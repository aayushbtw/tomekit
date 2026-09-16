import * as stylex from "@stylexjs/stylex";
import { useEffect, useState } from "react";

import { colors, durations, layout, radii } from "../tokens.stylex";

interface CopyButtonProps {
  /** Announced to screen readers, eg "Copy install command". */
  label: string;
  /** A function is resolved at click time, for text that only exists in the DOM. */
  text: string | (() => string);
}

const copiedFor = 2000;

const styles = stylex.create({
  button: {
    alignItems: "center",
    backgroundColor: {
      ":hover": colors.fill,
      default: "transparent",
    },
    borderRadius: radii.sm,
    borderStyle: "none",
    color: {
      ":hover": colors.textPrimary,
      default: colors.textMuted,
    },
    cursor: "pointer",
    display: "flex",
    flexShrink: 0,
    height: layout.itemHeight,
    justifyContent: "center",
    transitionDuration: durations.fast,
    transitionProperty: "background-color, color",
    width: layout.itemHeight,
  },
  hidden: {
    filter: "blur(2px)",
    opacity: 0,
    transform: "scale(0.25)",
  },
  icon: {
    height: 16,
    width: 16,
  },
  // Both icons share one grid cell so they cross over in place.
  layer: {
    display: "flex",
    gridArea: "1 / 1",
    transitionDuration: {
      "@media (prefers-reduced-motion: reduce)": "0s",
      default: durations.swap,
    },
    transitionProperty: "filter, opacity, transform",
    transitionTimingFunction: "ease-in-out",
    willChange: "filter, opacity, transform",
  },
  shown: {
    filter: "blur(0)",
    opacity: 1,
    transform: "scale(1)",
  },
  stack: {
    display: "grid",
    height: 16,
    width: 16,
  },
});

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 20 20"
      {...stylex.props(styles.icon)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="m13,7h2c1.105,0,2,.895,2,2v6c0,1.105-.895,2-2,2h-6c-1.105,0-2-.895-2-2v-2" />
      <rect height="10" rx="2" ry="2" width="10" x="3" y="3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 20 20"
      {...stylex.props(styles.icon)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <polyline points="4 11 8 15 16 5" />
    </svg>
  );
}

function CopyButton({ label, text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = setTimeout(() => setCopied(false), copiedFor);

    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        text instanceof Function ? text() : text
      );
      setCopied(true);
    } catch {
      // No clipboard, eg an insecure context: the text stays selectable.
    }
  }

  return (
    <button
      aria-label={copied ? "Copied" : label}
      onClick={() => void copy()}
      type="button"
      {...stylex.props(styles.button)}
    >
      <span {...stylex.props(styles.stack)}>
        <span
          {...stylex.props(styles.layer, copied ? styles.shown : styles.hidden)}
        >
          <CheckIcon />
        </span>
        <span
          {...stylex.props(styles.layer, copied ? styles.hidden : styles.shown)}
        >
          <CopyIcon />
        </span>
      </span>
    </button>
  );
}

export { CopyButton };
