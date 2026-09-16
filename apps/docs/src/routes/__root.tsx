import * as stylex from "@stylexjs/stylex";
import { createThemeCss } from "@tanstack/highlight/theme";
import { githubDarkTheme } from "@tanstack/highlight/themes/github-dark";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

import { NotFound } from "#/components/not-found";
import { site } from "#/lib/site";

// Relative, not `#/`: the StyleX compiler can't resolve package import aliases.
import { colors, fonts } from "../tokens.stylex";

import appCss from "../styles.css?url";

// The prose `pre` replaces the highlighter's class names but keeps `data-lang`.
const highlightCss = createThemeCss({
  dark: githubDarkTheme,
  lineNumbersSelector: "pre[data-lang]",
});

const xHandle = "@aayushbtw";

const ogImage = new URL("/og.png", site.url).href;

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
        title: site.name,
      },
      {
        name: "description",
        content: site.description,
      },
      {
        property: "og:title",
        content: site.name,
      },
      {
        property: "og:description",
        content: site.description,
      },
      {
        property: "og:image",
        content: ogImage,
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:site_name",
        content: site.name,
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:image",
        content: ogImage,
      },
      {
        name: "twitter:site",
        content: xHandle,
      },
      {
        name: "twitter:creator",
        content: xHandle,
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
        sizes: "32x32",
      },
      {
        rel: "icon",
        href: "/favicon.svg",
        type: "image/svg+xml",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "manifest",
        href: "/manifest.webmanifest",
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
