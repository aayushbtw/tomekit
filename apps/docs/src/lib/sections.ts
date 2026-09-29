const sections = ["Guide", "Content", "Frameworks", "Tools", "API"] as const;

/** Sections whose links render as plain text, with no icon in front. */
const sectionsWithoutIcons: string[] = [
  "Content",
  "Frameworks",
  "Tools",
  "API",
];

export { sections, sectionsWithoutIcons };
