const remarkImport = require("remark-code-import");
const remarkMermaid = require("remark-mermaid");

module.exports = {
  scripts: [
    "https://cdnjs.cloudflare.com/ajax/libs/mermaid/8.4.4/mermaid.min.js",
    "/init.js",
  ],
  title: "EmbraceSQL",
  tagline: "You type the SQL, we'll do the REST",
  url: " https://embracesql.github.io/",
  baseUrl: "/",
  favicon: "img/favicon.ico",
  organizationName: "embracesql", // Usually your GitHub org/user name.
  projectName: "embracesql.github.io", // Usually your repo name.
  themeConfig: {
    navbar: {
      title: "EmbraceSQL",
      logo: {
        alt: "My Site Logo",
        src: "img/logo.svg",
      },
      links: [
        {
          to: "/",
          activeBasePath: "docs",
          label: "Docs",
          position: "left",
        },
        {
          href: "https://github.com/civitaslearning/embrace-sql",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [],
      copyright: `Copyright © ${new Date().getFullYear()} Civitas Learning, Inc. Built with Docusaurus.`,
    },
  },
  presets: [
    [
      "@docusaurus/preset-classic",
      {
        docs: {
          remarkPlugins: [remarkImport, [remarkMermaid, {simple: true}]],
          routeBasePath: "/",
          sidebarPath: require.resolve("./sidebars.js"),
          editUrl:
            "https://github.com/civitaslearning/embrace-sql/edit/master/",
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      },
    ],
  ],
};
