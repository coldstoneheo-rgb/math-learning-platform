import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "node_modules/**",
    "next-env.d.ts",
    "*.generated.*",
    // Test and script files
    "e2e/**",
    "scripts/**",
    "scratch/**",
    "scratch_test.ts",
  ]),
  // Custom rule overrides
  {
    rules: {
      // Disable react-compiler rules that cause false positives
      // These rules flag valid patterns like calling functions defined after useEffect
      "react-compiler/react-compiler": "off",
      // Relax react-hooks rules - function hoisting in useEffect is safe at runtime
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
