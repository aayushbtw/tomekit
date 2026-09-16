import { Tabs } from "@base-ui/react/tabs";
import * as stylex from "@stylexjs/stylex";
import { useSyncExternalStore } from "react";

import { CodeFrame } from "#/components/code-frame";
import { PackageManagerIcon } from "#/components/package-manager-icon";
import { shellTokens } from "#/lib/highlight";
import {
  commands,
  isPackageManager,
  managers,
  packageManager,
  selectPackageManager,
  subscribePackageManager,
} from "#/lib/package-manager";

import {
  borderWidths,
  colors,
  durations,
  fonts,
  fontSizes,
  layout,
  radii,
  space,
  weights,
} from "../tokens.stylex";
import { typography } from "../typography";

interface InstallProps {
  /** Package names, separated by spaces, as written in the Markdown attribute. */
  packages?: string;
}

const styles = stylex.create({
  command: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderStyle: "solid",
    borderWidth: borderWidths.thin,
    paddingBlock: space.px10,
    paddingInline: space.px16,
  },
  line: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: fontSizes.xs,
    overflowX: "auto",
    scrollbarWidth: "none",
    whiteSpace: "pre",
  },
  manager: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderStyle: "none",
    color: {
      ":hover": colors.textPrimary,
      default: colors.textMuted,
    },
    cursor: "pointer",
    display: "flex",
    fontVariationSettings: {
      ":hover": weights.medium,
      default: weights.regular,
    },
    gap: space.px6,
    height: layout.itemHeight,
    transitionDuration: durations.fast,
    transitionProperty: "color, font-variation-settings",
  },
  selected: {
    color: colors.textPrimary,
    fontVariationSettings: weights.medium,
  },
  tabs: {
    display: "flex",
    gap: space.px16,
  },
});

function Install({ packages = "tomekit" }: InstallProps) {
  const selected = useSyncExternalStore(
    subscribePackageManager,
    packageManager,
    packageManager
  );

  return (
    <Tabs.Root
      onValueChange={(value) => {
        if (isPackageManager(value)) {
          selectPackageManager(value);
        }
      }}
      value={selected}
      {...stylex.props(typography.xs)}
    >
      <CodeFrame
        header={
          <Tabs.List {...stylex.props(styles.tabs)}>
            {managers.map((manager) => (
              <Tabs.Tab
                key={manager}
                value={manager}
                {...stylex.props(
                  typography.xs,
                  styles.manager,
                  manager === selected && styles.selected
                )}
              >
                <PackageManagerIcon manager={manager} />
                {manager}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        }
        label="Copy install command"
        text={`${commands[selected]} ${packages}`}
      >
        {managers.map((manager) => {
          const command = `${commands[manager]} ${packages}`;

          return (
            <Tabs.Panel
              key={manager}
              value={manager}
              {...stylex.props(styles.command)}
            >
              <code {...stylex.props(styles.line)}>
                {shellTokens(command).map(({ className, value }, index) =>
                  className === undefined ? (
                    value
                  ) : (
                    <span className={`th-token th-${className}`} key={index}>
                      {value}
                    </span>
                  )
                )}
              </code>
            </Tabs.Panel>
          );
        })}
      </CodeFrame>
    </Tabs.Root>
  );
}

export { Install };
