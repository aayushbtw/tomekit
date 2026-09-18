import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { CopyButton } from "#/components/copy-button";
import { colors, layout, space } from "#/styles/tokens.stylex";

interface CodeFrameProps {
  /** The bordered box under the header. */
  children: ReactNode;
  /** The header's left side: tabs, or a language and filename. */
  header: ReactNode;
  label: string;
  style?: StyleXStyles;
  text: string | (() => string);
}

const styles = stylex.create({
  header: {
    alignItems: "center",
    color: colors.textMuted,
    display: "flex",
    gap: space.px8,
    height: layout.itemHeight,
    marginBlockEnd: space.px8,
  },
  // Keeps copy at the end even when the header has no left side.
  push: {
    display: "flex",
    marginInlineStart: "auto",
  },
});

function CodeFrame({ children, header, label, style, text }: CodeFrameProps) {
  return (
    <div {...stylex.props(style)}>
      <div {...stylex.props(styles.header)}>
        {header}
        <span {...stylex.props(styles.push)}>
          <CopyButton label={label} text={text} />
        </span>
      </div>
      {children}
    </div>
  );
}

export { CodeFrame };
