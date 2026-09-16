import * as stylex from "@stylexjs/stylex";
import { createThemeCss } from "@tanstack/highlight/theme";
import { githubDarkTheme } from "@tanstack/highlight/themes/github-dark";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

import { NotFound } from "#/components/not-found";

// Relative, not `#/`: the StyleX compiler can't resolve package import aliases.
import { colors, fonts } from "../tokens.stylex";

import appCss from "../styles.css?url";

// The prose `pre` replaces the highlighter's class names but keeps `data-lang`.
const highlightCss = createThemeCss({
  dark: githubDarkTheme,
  lineNumbersSelector: "pre[data-lang]",
});

const tagline = "Fully typed content collections for Markdown.";

export const Route = createRootRoute({
  head: () => ({
    styles: [{ children: highlightCss }],
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "color-scheme",
        content: "dark",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "tomekit",
      },
      {
        name: "description",
        content: tagline,
      },
      {
        property: "og:title",
        content: "tomekit",
      },
      {
        property: "og:description",
        content: tagline,
      },
      {
        property: "og:image",
        content: "/og.png",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:creator",
        content: "@aayushbtw",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.svg",
        type: "image/svg+xml",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      // In dev, StyleX serves its CSS from this virtual module instead of appending to appCss.
      ...(import.meta.env.DEV
        ? [{ rel: "stylesheet", href: "/virtual:stylex.css" }]
        : []),
    ],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
});

const styles = stylex.create({
  body: {
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
  },
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // `dark` selects the dark Radix grays and highlight theme, which are both scoped to `.dark`.
    <html className="dark" lang="en">
      <head>
        <HeadContent />
      </head>
      <body {...stylex.props(styles.body)}>
        {children}

        <Scripts />
      </body>
    </html>
  );
}
