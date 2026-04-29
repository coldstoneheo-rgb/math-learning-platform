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
    "next-env.d.ts",
    // Test and script files
    "e2e/**",
    "scripts/**",
  ]),
  // Custom rule overrides
  {
    rules: {
      // Disable react-compiler rules that cause false positives
      // These rules flag valid patterns like calling functions defined after useEffect
      "react-compiler/react-compiler": "off",
      // Relax react-hooks rules - function hoisting in useEffect is safe at runtime
      "react-hooks/immutability": "off",
    },
  },
]);

export default eslintConfig;
