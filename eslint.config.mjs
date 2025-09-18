import eslintConfigCodely from "eslint-config-codely";

export default [
  ...eslintConfigCodely.full,
  {
    rules: {
      "no-console": "off"
    }
  }
];
