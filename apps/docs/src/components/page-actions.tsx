import * as stylex from "@stylexjs/stylex";

import { CopyButton } from "#/components/copy-button";
import { markdownPath } from "#/lib/markdown";
import { borderWidths, colors, durations, space } from "#/styles/tokens.stylex";
import { typography } from "#/styles/typography";

interface PageActionsProps {
  /** The page's slug, which names its Markdown path. */
  slug: string;
}

const styles = stylex.create({
  divider: {
    backgroundColor: colors.border,
    height: 14,
    width: borderWidths.thin,
  },
  icon: {
    height: 16,
    width: 16,
  },
  // Text actions, not buttons: no border, background or padding.
  item: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderStyle: "none",
    color: {
      ":hover": colors.textPrimary,
      default: colors.textMuted,
    },
    cursor: "pointer",
    display: "flex",
    gap: space.px6,
    height: "auto",
    paddingInline: 0,
    textDecorationLine: "none",
    transitionDuration: durations.fast,
    transitionProperty: "color",
    width: "auto",
  },
  row: {
    alignItems: "center",
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: borderWidths.thin,
    display: "flex",
    flexWrap: "wrap",
    gap: space.px12,
    marginBlockEnd: space.px24,
    paddingBlockEnd: space.px16,
  },
});

async function pageMarkdown(path: string) {
  const response = await fetch(path);

  return await response.text();
}

function MarkdownIcon() {
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
      <rect height="12" rx="2" width="16" x="2" y="4" />
      <path d="M5 13V7l2.5 3L10 7v6" />
      <path d="M14.5 7v6M12.5 11l2 2 2-2" />
    </svg>
  );
}

function PageActions({ slug }: PageActionsProps) {
  const path = markdownPath(slug);

  return (
    <div {...stylex.props(typography.sm, styles.row)}>
      <CopyButton
        label="Copy as Markdown"
        style={[typography.sm, styles.item]}
        text={async () => await pageMarkdown(path)}
      >
        Copy as Markdown
      </CopyButton>
      <span aria-hidden="true" {...stylex.props(styles.divider)} />
      <a href={path} {...stylex.props(typography.sm, styles.item)}>
        <MarkdownIcon />
        View as Markdown
      </a>
    </div>
  );
}

export { PageActions };
