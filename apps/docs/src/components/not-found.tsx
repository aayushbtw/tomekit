import * as stylex from "@stylexjs/stylex";
import { Link } from "@tanstack/react-router";

import { docLink, homeSlug } from "#/lib/links";

import {
  below,
  colors,
  durations,
  fontSizes,
  layout,
  letterSpacings,
  lineHeights,
  space,
  weights,
} from "../tokens.stylex";
import { typography } from "../typography";

const styles = stylex.create({
  description: {
    color: colors.textSecondary,
    marginBlockEnd: space.px24,
  },
  link: {
    color: {
      ":hover": colors.textPrimary,
      default: colors.textMuted,
    },
    textDecorationColor: {
      ":hover": colors.textPrimary,
      default: colors.borderStrong,
    },
    textDecorationLine: "underline",
    textUnderlineOffset: space.px2,
    transitionDuration: durations.fast,
    transitionProperty: "color, text-decoration-color",
  },
  notFound: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minHeight: "100dvh",
    paddingInline: layout.pagePadding,
    textAlign: "center",
  },
  title: {
    color: colors.textPrimary,
    fontSize: {
      [below.md]: fontSizes.xxl,
      default: fontSizes.xl,
    },
    fontVariationSettings: {
      [below.md]: weights.bold,
      default: weights.semibold,
    },
    letterSpacing: {
      [below.md]: letterSpacings.xxl,
      default: letterSpacings.xl,
    },
    lineHeight: {
      [below.md]: lineHeights.xxl,
      default: lineHeights.xl,
    },
    marginBlockEnd: space.px8,
  },
});

function NotFound() {
  return (
    <div {...stylex.props(styles.notFound)}>
      <h1 {...stylex.props(styles.title)}>Page not found</h1>
      <p {...stylex.props(typography.base, styles.description)}>
        That page has moved or never existed.
      </p>
      <Link
        {...docLink(homeSlug)}
        {...stylex.props(typography.sm, styles.link)}
      >
        Go to getting started
      </Link>
    </div>
  );
}

export { NotFound };
