export const markdown_extensions = [
  "md",
  "mkd",
  "mdwn",
  "mdown",
  "mdtxt",
  "mdtext",
  "markdown",
  "text",
  "md.txt",
] as const;
type MarkdownExtension = typeof markdown_extensions[number];

const yaml_extensions = ["yml", "yaml"];
type YamlExtension = typeof yaml_extensions[number];

export type RequirementsCandidate =
  | "package.json"
  | `tea.${YamlExtension}`
  | `README.${MarkdownExtension}`;

export const enum RequirementsCandidateType {
  PACKAGE_JSON,
  TEA_YAML,
  README,
}

export const candidateType = (
  candiate: RequirementsCandidate
): RequirementsCandidateType => {
  switch (true) {
    case candiate === "package.json":
      return RequirementsCandidateType.PACKAGE_JSON;
    case /^tea\.ya?ml$/.test(candiate):
      return RequirementsCandidateType.TEA_YAML;
    default:
      return RequirementsCandidateType.README;
  }
};

export const buildRequirementsCandidates = (): RequirementsCandidate[] => {
  const markdownFiles = markdown_extensions.map(
    (mde) => `README.${mde}` as const
  );
  const yamlFiles = yaml_extensions.map((ye) => `tea.${ye}` as const);
  return ["package.json", ...yamlFiles, ...markdownFiles];
};
