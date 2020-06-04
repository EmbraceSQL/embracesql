module.exports = {
  hooks: {
    "pre-commit": "yarn pretty && yarn test",
  },
};
