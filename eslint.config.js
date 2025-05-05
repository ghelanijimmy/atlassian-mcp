import eslintPluginImport from "eslint-plugin-import";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module"
      }
    },
    plugins: {
      import: eslintPluginImport,
      "@typescript-eslint": tseslint
    },
    rules: {
      "import/extensions": [
        "error",
        "ignorePackages",
        {
          js: "always",
          ts: "never"
        }
      ]
    },
    settings: {
      "import/resolver": {
        node: {
          extensions: [".js", ".ts"]
        }
      }
    }
  }
]; 