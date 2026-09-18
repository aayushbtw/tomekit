import * as stylex from "@stylexjs/stylex";
import { Link, useParams } from "@tanstack/react-router";

import { DocIcon } from "#/components/doc-icon";
import { GithubIcon } from "#/components/github-icon";
import { docLink, homeSlug } from "#/lib/links";
import { sectionsWithoutIcons } from "#/lib/sections";
import { site } from "#/lib/site";
import {
  colors,
  durations,
  layout,
  space,
  weights,
} from "#/styles/tokens.stylex";
import { typography } from "#/styles/typography";

interface Nav {
  pages: { slug: string; title: string }[];
  section: string | undefined;
}

interface DocsNavProps {
  nav: Nav[];
}

const styles = stylex.create({
  active: {
    color: colors.textPrimary,
    fontVariationSettings: weights.medium,
  },
  footer: {
    alignItems: "center",
    borderBlockStartColor: colors.borderSubtle,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: 1,
    display: "flex",
    flexShrink: 0,
    height: layout.pageTop,
    justifyContent: "space-between",
  },
  github: {
    alignItems: "center",
    color: {
      ":hover": colors.textPrimary,
      default: colors.textMuted,
    },
    display: "flex",
    gap: space.px8,
    transitionDuration: durations.fast,
    transitionProperty: "color",
  },
  version: {
    color: colors.textFaint,
  },
  label: {
    alignItems: "center",
    color: colors.textPrimary,
    display: "flex",
    fontVariationSettings: weights.medium,
    height: layout.itemHeight,
  },
  link: {
    alignItems: "center",
    color: {
      ":hover": colors.textPrimary,
      default: colors.textMuted,
    },
    display: "flex",
    fontVariationSettings: {
      ":hover": weights.medium,
      default: weights.regular,
    },
    gap: space.px8,
    height: layout.itemHeight,
    transitionDuration: durations.fast,
    transitionProperty: "color, font-variation-settings",
  },
  nav: {
    display: "flex",
    flex: 1,
    flexDirection: "column",
    gap: space.px24,
    overflowY: "auto",
    paddingBlockEnd: space.px24,
    scrollbarWidth: "none",
  },
  section: {
    display: "flex",
    flexDirection: "column",
  },
});

function DocsNav({ nav }: DocsNavProps) {
  const { slug: current = homeSlug } = useParams({ strict: false });

  return (
    <>
      <nav {...stylex.props(typography.xs, styles.nav)}>
        {nav.map(({ pages, section }) => {
          const withIcons =
            section === undefined || !sectionsWithoutIcons.includes(section);

          return (
            <div key={section ?? "pages"} {...stylex.props(styles.section)}>
              {section === undefined ? null : (
                <p {...stylex.props(styles.label)}>{section}</p>
              )}
              {pages.map(({ slug, title }) => (
                <Link
                  key={slug}
                  {...docLink(slug)}
                  {...stylex.props(
                    styles.link,
                    slug === current && styles.active
                  )}
                >
                  {withIcons ? <DocIcon slug={slug} /> : null}
                  {title}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
      <div {...stylex.props(styles.footer)}>
        <a
          href="https://github.com/aayushbtw/tomekit"
          {...stylex.props(typography.sm, styles.github)}
        >
          <GithubIcon />
          GitHub
        </a>
        <span {...stylex.props(typography.sm, styles.version)}>
          v{site.version}
        </span>
      </div>
    </>
  );
}

export { DocsNav };

export type { Nav };
