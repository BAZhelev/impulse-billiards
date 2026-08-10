export default {
  "*.{ts,tsx}": ["prettier --write", "eslint --max-warnings 0 --fix"],
  "*.{md,json,css,html,yaml,yml}": ["prettier --write"],
};
