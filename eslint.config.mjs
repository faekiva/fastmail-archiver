import eslintConfigCodely from "eslint-config-codely";

export default [
	...eslintConfigCodely.full,
	{
		ignores: ["dist/**/*", "tsdown.config.ts"],
	},
	{
		rules: {
			"no-console": "off",
		},
	},
];
