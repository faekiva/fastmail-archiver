import eslintConfigCodely from "eslint-config-codely";

export default [
	...eslintConfigCodely.full,
	{
		ignores: ["dist/**/*"],
	},
	{
		rules: {
			"no-console": "off",
		},
	},
];
