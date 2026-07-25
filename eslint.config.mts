import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	...obsidianmd.configs.recommended,
	{
		files: ["**/*.ts"],
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parser: tseslint.parser,
			parserOptions: {
				project: "./tsconfig.json",
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		// no-plugin-as-component is a type-aware TS rule; disable it for JSON files
		files: ["**/*.json"],
		rules: { "obsidianmd/no-plugin-as-component": "off" },
	},
	{
		// Test files run under Node via vitest and are never bundled into
		// main.js, so Node built-ins (reading docs/examples off disk) and Node
		// globals (__dirname) are legitimate here even though the plugin
		// itself must avoid them for mobile compatibility.
		files: ["**/*.test.ts"],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		rules: { "import/no-nodejs-modules": "off" },
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"vitest.config.ts",
		"version-bump.mjs",
		"versions.json",
		"main.js",
		"**/*.json",
	]),
);
