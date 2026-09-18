import * as stylex from "@stylexjs/stylex";
import { Link } from "@tanstack/react-router";

import type { Nav } from "#/components/docs-nav";
import { Logo } from "#/components/logo";
import { NavDrawer } from "#/components/nav-drawer";
import { colors, layout, zIndices } from "#/styles/tokens.stylex";

interface HeaderProps {
  nav: Nav[];
}

const styles = stylex.create({
  header: {
    backgroundColor: colors.background,
    height: layout.pageTop,
    insetInline: 0,
    position: "fixed",
    top: 0,
    zIndex: zIndices.header,
  },
  inner: {
    alignItems: "center",
    display: "flex",
    height: "100%",
    justifyContent: "space-between",
    marginInline: "auto",
    maxWidth: layout.width,
    paddingInline: layout.pagePadding,
  },
  logo: {
    alignItems: "center",
    color: colors.textPrimary,
    display: "flex",
  },
});

function Header({ nav }: HeaderProps) {
  return (
    <header {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.inner)}>
        <Link aria-label="tomekit home" to="/" {...stylex.props(styles.logo)}>
          <Logo />
        </Link>
        <NavDrawer nav={nav} />
      </div>
    </header>
  );
}

export { Header };
