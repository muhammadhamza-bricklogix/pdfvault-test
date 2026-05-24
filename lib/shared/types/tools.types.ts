/** Backend tool category enum (kept in sync with `ToolCategory` on the API). */
export type ToolCategory = "pdf" | "image";

/** Single tool tile shown in catalog / suggestions. */
export type Tool = {
  /** Stable slug used as React key and icon lookup. */
  id: string;
  /** Display name shown on the tile. */
  name: string;
  /** One-line tile subtitle. */
  description: string;
  /** Used by the Tools page tabs to group tiles. */
  category: ToolCategory;
  /** Frontend route the tile links to. */
  route: string;
  /**
   * Underlying conversion type when the tool maps to a `/conversion` operation.
   * Absent for non-conversion tools.
   */
  conversionType?: string;
  /** Whether the tool is AI-powered (renders an "AI" badge). */
  isAi: boolean;
};

/** One section in the grouped tools view. */
export type ToolCategorySection = {
  id: ToolCategory;
  /** Display label for the section heading, e.g. "PDF tools". */
  label: string;
  tools: Tool[];
};

/** Response from `GET /tools`. Includes flat `items` and grouped `sections`. */
export type ToolsListResponse = {
  items: Tool[];
  sections: ToolCategorySection[];
};
