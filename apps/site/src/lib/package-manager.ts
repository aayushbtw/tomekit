const managers = ["pnpm", "npm", "yarn", "bun"] as const;

type PackageManager = (typeof managers)[number];

const commands = {
  bun: "bun add",
  npm: "npm install",
  pnpm: "pnpm add",
  yarn: "yarn add",
} satisfies Record<PackageManager, string>;

const storageKey = "package-manager";

const listeners = new Set<() => void>();

let current: PackageManager = managers[0];

let restored = false;

function isPackageManager(value: unknown): value is PackageManager {
  return managers.some((manager) => manager === value);
}

// Only ever read on the client: the first subscribe happens after hydration, so the
// server and the first client render share the default and nothing mismatches.
function restore() {
  restored = true;

  try {
    const stored = localStorage.getItem(storageKey);

    if (isPackageManager(stored)) {
      current = stored;
    }
  } catch {
    // Site data blocked: the default stands.
  }
}

function subscribePackageManager(listener: () => void) {
  if (!restored) {
    restore();
  }

  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function packageManager() {
  return current;
}

function selectPackageManager(manager: PackageManager) {
  current = manager;

  try {
    localStorage.setItem(storageKey, manager);
  } catch {
    // Site data blocked: the choice lasts for this session only.
  }

  for (const listener of listeners) {
    listener();
  }
}

export {
  commands,
  isPackageManager,
  managers,
  packageManager,
  selectPackageManager,
  subscribePackageManager,
};

export type { PackageManager };
